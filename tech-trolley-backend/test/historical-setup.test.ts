import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";
import {
  choices,
  forms,
  loanAccounts,
  restoreFormDraft,
  prepareForm,
  correctableDocument,
} from "@tech-trolley/contracts";

test("historical onboarding carries real stock, dues and dated journals into today's business", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  assert.ok(
    source && new URL(source).pathname.endsWith("_test"),
    "Explicit isolated test server required",
  );
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const database = "history_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(source);
  url.pathname = "/" + database;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "history@example.test",
    BOOTSTRAP_OWNER_PASSWORD: "1023",
    WEB_ORIGIN: "http://localhost:3001",
  });
  const { db } = require("../dist/database/database");
  const { migrate } = require("../dist/database/migrate");
  const { bootstrap } = require("../dist/auth/bootstrap");
  const { createApp } = require("../dist/main");
  let app: any;
  try {
    await migrate();
    await bootstrap();
    app = await createApp();
    await app.init();
    const http = app.getHttpServer();
    const login = await request(http)
      .post("/auth/login")
      .set("X-Native-Client", "1")
      .send({ identity: "owner", password: "1023" });
    assert.equal(login.status, 201);
    const token = login.body.token;
    const api = (method: string, path: string, data?: any, auth = token) => {
      const r = (request(http) as any)
        [method](path)
        .set("Authorization", "Bearer " + auth);
      return data === undefined ? r : r.send(data);
    };
    const send = (kind: string, data: any, key = randomUUID(), auth = token) =>
      api("post", "/commands/" + kind, data, auth).set("Idempotency-Key", key);
    const cmd = async (kind: string, data: any, key = randomUUID()) => {
      const r = await send(kind, data, key);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    const reject = async (
      kind: string,
      data: any,
      code: string,
      auth = token,
    ) => {
      const r = await send(kind, data, randomUUID(), auth);
      assert.ok(r.status >= 400, JSON.stringify(r.body));
      assert.equal(r.body.code, code);
    };
    const state = async () => {
      const r = await api("get", "/shop/state");
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r.body;
    };
    const today = (await state()).today;
    const day = (offset: number) => {
      const d = new Date(today + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const from = day(-7),
      to = day(-1);
    const report = async (a = from, b = to) => {
      const r = await api("get", `/reports?period=range&from=${a}&to=${b}`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r.body;
    };
    const party = async (kind: string, name: string) => {
      const r = await api("post", "/parties", {
        kind,
        name,
        phone: "",
        address: "",
      });
      assert.equal(r.status, 201);
      return r.body.id;
    };
    const supplier = await party("supplier", "Old supplier"),
      customer = await party("customer", "Old customer"),
      person = await party("person", "Rony");
    const staff = await api("post", "/users", {
      name: "History staff",
      login: "history-staff",
      email: "",
      role: "STAFF",
      password: "0123",
    });
    assert.equal(staff.status, 201);
    const staffLogin = await request(http)
      .post("/auth/login")
      .set("X-Native-Client", "1")
      .send({ identity: "history-staff", password: "0123" });
    assert.equal(staffLogin.status, 201);
    const staffToken = staffLogin.body.token;
    const stock = (imei: string, cost: string) => ({
      phoneType: "iphone",
      storage: "128 GB",
      color: "Blue",
      variant: "Japan",
      model: "iPhone test",
      brand: "Apple",
      category: "phone",
      condition: "used",
      imei,
      battery: 90,
      box: "without",
      supplierId: supplier,
      cost,
      note: "Opening stock, already held",
    });
    let start: any,
      a: any,
      b: any,
      oldCustomer: any,
      oldSupplier: any,
      oldLoan: any,
      oldRefund: any,
      oldAdvance: any;
    const startKey = randomUUID(),
      startData = {
        startDate: from,
        endDate: to,
        cash: "100000",
        bank: "50000",
      };
    await t.test(
      "only Owner can start a real, non-future period once",
      async () => {
        await reject("historyStart", startData, "FORBIDDEN", staffToken);
        await reject(
          "historyStart",
          { ...startData, startDate: "2026-02-30" },
          "VALIDATION_ERROR",
        );
        await reject(
          "historyStart",
          { ...startData, startDate: to, endDate: from },
          "HISTORY_DATE_INVALID",
        );
        await reject(
          "historyStart",
          { ...startData, endDate: day(1) },
          "HISTORY_DATE_INVALID",
        );
        const results = await Promise.all([
          cmd("historyStart", startData, startKey),
          cmd("historyStart", startData, startKey),
        ]);
        assert.deepEqual(results[0], results[1]);
        start = results[0];
        await reject("historyStart", startData, "ALREADY_OPENED");
        assert.equal((await state()).shop.history_from, from);
        await reject(
          "expense",
          {
            categoryId: "custom",
            expenseName: "Lunch",
            amount: "1",
            account: "cash",
            note: "",
          },
          "HISTORY_LOCK_REQUIRED",
        );
      },
    );
    await t.test(
      "opening stock and three kinds of old due do not spend money or invent period purchases/profit",
      async () => {
        oldAdvance = await cmd("openingDue", {
          dueType: "advance",
          partyId: staff.body.id,
          amount: "2000",
          note: "Old salary advance",
        });
        oldRefund = await cmd("openingDue", {
          dueType: "refund",
          partyId: supplier,
          amount: "1000",
          note: "Old refund",
        });
        a = await cmd("openingStock", stock("111111111111111", "60000"));
        b = await cmd("openingStock", {
          ...stock("222222222222222", "20000"),
          supplierDue: "2000",
        });
        oldCustomer = await cmd("openingDue", {
          dueType: "customer",
          partyId: customer,
          amount: "8000",
          note: "Before period",
        });
        oldSupplier = await cmd("openingDue", {
          dueType: "supplier",
          partyId: supplier,
          amount: "5000",
          note: "Before period, not new purchase",
        });
        oldLoan = await cmd("openingDue", {
          dueType: "person",
          partyId: person,
          amount: "3000",
          note: "Old personal loan",
        });
        const s = await state(),
          r = await report();
        assert.equal(s.balances.cash, "100000.00");
        assert.equal(s.balances.bank, "50000.00");
        assert.equal(s.balances.inventory, "80000.00");
        assert.equal(s.balances.receivable, "8000.00");
        assert.equal(s.balances.payable, "7000.00");
        assert.equal(s.balances.loan, "3000.00");
        assert.equal(r.purchases, "0.00");
        assert.equal(r.netProfit, "0.00");
        assert.equal(r.externalIn, "0.00");
        assert.equal(r.externalOut, "0.00");
        assert.equal(r.moneyStatement.length, 0);
        for (const [source, id] of [
          ["salesDue", oldCustomer.id],
          ["purchasesDue", oldSupplier.id],
          ["loansDue", oldLoan.id],
          ["supplierRefundsDue", oldRefund.id],
          ["advancesDue", oldAdvance.id],
        ])
          assert.ok(
            choices(
              { key: "documentId", label: "", source: source as any },
              s,
              "en",
            ).some((c) => c.value === id),
          );
        assert.equal(loanAccounts(s)[0].due, "3000.00");
        const before = (
          await db.query("SELECT count(*)::int AS n FROM document")
        )[0].n;
        await reject(
          "openingStock",
          stock("111111111111111", "1"),
          "IMEI_IN_STOCK",
        );
        await reject(
          "openingDue",
          { dueType: "supplier", partyId: customer, amount: "1", note: "" },
          "NOT_FOUND",
        );
        assert.equal(
          (await db.query("SELECT count(*)::int AS n FROM document"))[0].n,
          before,
        );
      },
    );
    await t.test(
      "opening mistakes have append-only corrections before locking; confirmation is idempotent",
      async () => {
        const wrong = await cmd(
          "openingStock",
          stock("333333333333333", "5000"),
        );
        await cmd("reversal", {
          documentId: wrong.id,
          note: "Wrong opening stock",
        });
        const wrongDue = await cmd("openingDue", {
          dueType: "person",
          partyId: person,
          amount: "4000",
          note: "Wrong",
        });
        await cmd("reversal", {
          documentId: wrongDue.id,
          note: "Wrong opening due",
        });
        await cmd("openingAdjustment", {
          cash: "110000",
          bank: "50000",
          note: "Verified previous cash book",
        });
        const s = await state();
        assert.equal(s.balances.inventory, "80000.00");
        assert.equal(s.balances.loan, "3000.00");
        assert.equal(s.balances.cash, "110000.00");
        const r = await report();
        assert.equal(r.openingCash, "110000.00");
        assert.equal(r.cashIn, "0.00");
        assert.equal(r.externalIn, "0.00");
        assert.equal(r.netProfit, "0.00");
        const key = randomUUID();
        const lockData = { setupVersion: s.shop.history_version };
        const lock = await cmd("historyLock", lockData, key);
        assert.deepEqual(await cmd("historyLock", lockData, key), lock);
        assert.equal((await state()).shop.history_locked, true);
        await reject(
          "openingDue",
          { dueType: "person", partyId: person, amount: "1", note: "" },
          "HISTORY_OPENING_LOCKED",
        );
        await reject(
          "reversal",
          {
            documentId: oldCustomer.id,
            note: "No rebasing",
            businessDate: from,
          },
          "DEPENDENCY_CONFLICT",
        );
        assert.equal(
          correctableDocument(
            s.documents.find((d: any) => d.id === oldLoan.id),
            await state(),
          ),
          false,
        );
        await reject(
          "historyFinish",
          { cash: "110000", bank: "50000", setupVersion: 0 },
          "HISTORY_CHANGED",
        );
      },
    );
    let sale: any, purchase: any;
    const saleKey = randomUUID();
    let saleData: any;
    await t.test(
      "real transactions use chronological business dates and actual entry timestamps",
      async () => {
        const s = await state();
        const unit = s.units.find(
          (u: any) =>
            u.id === s.documents.find((d: any) => d.id === a.id).unit_id,
        );
        saleData = {
          unitId: unit.id,
          price: "70000",
          discount: "0",
          cash: "40000",
          bank: "25000",
          customerId: customer,
          note: "Prior-week sale",
          businessDate: from,
        };
        await reject(
          "sale",
          { ...saleData, businessDate: undefined },
          "HISTORY_DATE_INVALID",
        );
        await reject("sale", saleData, "HISTORY_OWNER_ONLY", staffToken);
        sale = await cmd("sale", saleData, saleKey);
        const beforeFailed = await state();
        await reject(
          "expense",
          {
            categoryId: "custom",
            expenseName: "Cannot use future funds",
            amount: "999999",
            account: "cash",
            note: "",
            businessDate: from,
          },
          "INSUFFICIENT_FUNDS",
        );
        assert.equal(
          (await state()).shop.history_version,
          beforeFailed.shop.history_version,
        );
        await cmd("supplierRefund", {
          documentId: oldRefund.id,
          amount: "1000",
          account: "bank",
          note: "Old refund collected",
          businessDate: from,
        });
        const posted = (await state()).documents.find(
          (d: any) => d.id === sale.id,
        );
        assert.equal(posted.business_date, from);
        assert.ok(posted.created_at.slice(0, 10) >= from);
        assert.equal(posted.actor_name, "Owner");
        const receipt = await api(
          "get",
          `/documents/${sale.id}/receipt?lang=en`,
        );
        assert.equal(receipt.status, 200);
        assert.equal(receipt.body.date, from);
        assert.equal(receipt.body.createdAt, posted.created_at);
        const raw = {
          ...stock("444444444444444", "30000"),
          paid: "20000",
          procurement: "0",
          treatment: "capitalize",
          account: "cash",
          businessDate: day(-6),
        };
        purchase = await cmd("purchase", raw);
        await reject(
          "expense",
          {
            categoryId: "custom",
            expenseName: "Lunch",
            amount: "1",
            account: "cash",
            businessDate: from,
          },
          "HISTORY_DATE_INVALID",
        );
        await cmd("expense", {
          categoryId: "custom",
          expenseName: "Lunch",
          amount: "1000",
          account: "cash",
          note: "",
          businessDate: day(-6),
        });
        await cmd("collection", {
          documentId: oldCustomer.id,
          amount: "8000",
          account: "bank",
          note: "",
          businessDate: day(-5),
        });
        await cmd("supplierPayment", {
          documentId: oldSupplier.id,
          amount: "5000",
          account: "cash",
          note: "",
          businessDate: day(-4),
        });
        await cmd("loanRepayment", {
          documentId: oldLoan.id,
          amount: "3000",
          account: "cash",
          note: "",
          businessDate: day(-4),
        });
        await cmd("salary", {
          staffId: staff.body.id,
          month: day(-4).slice(0, 7),
          amount: "2000",
          applyAdvance: "2000",
          account: "cash",
          note: "Salary adjusted against old advance",
          businessDate: day(-4),
        });
        const dayReport = await report(day(-4), day(-4));
        assert.equal(dayReport.netProfit, "-2000.00");
        const current = await state();
        const bought = current.documents.find((d: any) => d.id === purchase.id);
        await cmd("sale", {
          unitId: bought.unit_id,
          price: "28000",
          cash: "0",
          bank: "28000",
          discount: "0",
          note: "Sold at loss",
          businessDate: day(-3),
        });
        await cmd("contribution", {
          amount: "10000",
          account: "bank",
          note: "Owner added capital",
          businessDate: day(-2),
        });
        await cmd("collection", {
          documentId: sale.id,
          amount: "5000",
          account: "cash",
          note: "",
          businessDate: to,
        });
        await cmd("supplierPayment", {
          documentId: purchase.id,
          amount: "10000",
          account: "bank",
          note: "",
          businessDate: to,
        });
      },
    );
    await t.test(
      "opening stock sale/return, old dues and journal-led statements reconcile exactly",
      async () => {
        const s = await state();
        const unit = s.units.find(
          (u: any) =>
            u.id === s.documents.find((d: any) => d.id === b.id).unit_id,
        );
        const returned = await cmd("purchaseReturn", {
          unitId: unit.id,
          revision: unit.revision,
          returnValue: "19000",
          note: "Agreed supplier return",
          businessDate: to,
        });
        await cmd("supplierRefund", {
          documentId: returned.id,
          amount: "8000",
          account: "cash",
          note: "",
          businessDate: to,
        });
        await cmd("supplierRefund", {
          documentId: returned.id,
          amount: "9000",
          account: "bank",
          note: "",
          businessDate: to,
        });
        const r = await report(),
          current = await state();
        for (const [a, n] of Object.entries({
          cash: "140000.00",
          bank: "121000.00",
          inventory: "0.00",
          receivable: "0.00",
          payable: "0.00",
          loan: "0.00",
          supplierReceivable: "0.00",
        }))
          assert.equal(current.balances[a], n, a);
        assert.equal(r.purchases, "30000.00");
        assert.equal(r.revenue, "98000.00");
        assert.equal(r.cogs, "90000.00");
        assert.equal(r.grossProfit, "8000.00");
        assert.equal(r.expense, "4000.00");
        assert.equal(r.netProfit, "4000.00");
        assert.equal(r.openingCash, "110000.00");
        assert.equal(r.openingBank, "50000.00");
        assert.equal(r.closingCash, "140000.00");
        assert.equal(r.closingBank, "121000.00");
        const last = r.moneyStatement.at(-1);
        assert.equal(last.cashBalance, r.closingCash);
        assert.equal(last.bankBalance, r.closingBank);
        assert.ok(
          r.moneyStatement.every(
            (entry: any, i: number, all: any[]) =>
              !i || entry.date >= all[i - 1].date,
          ),
        );
        const nextDay = await report(day(-6), day(-6));
        assert.equal(nextDay.openingCash, "150000.00");
        assert.equal(nextDay.openingBank, "76000.00");
        const firstDay = await report(from, from);
        assert.equal(
          firstDay.documents.find((d: any) => d.id === sale.id).due,
          "5000.00",
        );
        assert.equal(
          firstDay.documents.find((d: any) => d.id === oldCustomer.id).due,
          "8000.00",
        );
        assert.equal(
          r.documents.find((d: any) => d.id === sale.id).due,
          "0.00",
        );
        const draft = restoreFormDraft("expense", null, today, current);
        assert.equal(draft.businessDate, to);
        assert.throws(() =>
          prepareForm(
            "expense",
            {
              ...draft,
              businessDate: from,
              categoryId: "custom",
              expenseName: "Lunch",
              amount: "1",
              account: "cash",
            },
            current,
          ),
        );
        const stmt = await api(
          "get",
          `/reports/export?period=range&from=${from}&to=${to}&lang=bn`,
        );
        assert.equal(stmt.status, 200);
        const staffReport = await api(
          "get",
          `/reports?period=range&from=${from}&to=${to}`,
          undefined,
          staffToken,
        );
        assert.equal(staffReport.status, 403);
      },
    );
    await t.test(
      "finish requires actual balances; retry remains exact after phase/date advancement",
      async () => {
        await reject(
          "historyFinish",
          {
            cash: "140001",
            bank: "121000",
            setupVersion: (await state()).shop.history_version,
          },
          "HISTORY_BALANCE_MISMATCH",
        );
        assert.equal((await state()).shop.history_active, true);
        const key = randomUUID(),
          data = {
            cash: "140000",
            bank: "121000",
            setupVersion: (await state()).shop.history_version,
          };
        const results = await Promise.all([
          cmd("historyFinish", data, key),
          cmd("historyFinish", data, key),
        ]);
        assert.deepEqual(results[0], results[1]);
        assert.deepEqual(await cmd("historyStart", startData, startKey), start);
        assert.deepEqual(await cmd("sale", saleData, saleKey), sale);
        await reject(
          "sale",
          { ...saleData, price: "70001" },
          "HISTORY_NOT_ACTIVE",
        );
        assert.equal((await state()).shop.history_active, false);
        assert.ok((await state()).shop.history_finished_at);
        await reject("historyStart", startData, "ALREADY_OPENED");
      },
    );
    await t.test(
      "today starts at historical closing; normal stock/cash/profit and Staff access resume",
      async () => {
        const raw = {
          ...stock("555555555555555", "10000"),
          paid: "10000",
          procurement: "0",
          treatment: "capitalize",
          account: "bank",
        };
        const bought = await cmd("purchase", raw);
        const u = (await state()).documents.find(
          (d: any) => d.id === bought.id,
        ).unit_id;
        const sold = await send(
          "sale",
          {
            unitId: u,
            price: "12000",
            cash: "12000",
            bank: "0",
            discount: "0",
            note: "Today",
          },
          randomUUID(),
          staffToken,
        );
        assert.equal(sold.status, 201, JSON.stringify(sold.body));
        const r = await report(today, today);
        assert.equal(r.openingCash, "140000.00");
        assert.equal(r.openingBank, "121000.00");
        assert.equal(r.closingCash, "152000.00");
        assert.equal(r.closingBank, "111000.00");
        assert.equal(r.netProfit, "2000.00");
        assert.equal((await report()).netProfit, "4000.00");
        const s = await state();
        assert.equal(s.balances.inventory, "0.00");
        assert.deepEqual(
          await db.query(
            "SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0",
          ),
          [],
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity",
            )
          )[0].n,
          21,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role','PUBLIC')",
            )
          )[0].n,
          0,
        );
        for (const table of [
          "document",
          "journal_line",
          "allocation",
          "inventory_movement",
        ])
          await assert.rejects(
            db.query(
              `UPDATE ${table} SET ${table === "document" ? "total=total" : table === "journal_line" ? "amount=amount" : table === "allocation" ? "amount=amount" : "delta=delta"}`,
            ),
            /Append-only/,
          );
      },
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    assert.match(database, /^history_[a-f0-9]{32}_test$/);
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
