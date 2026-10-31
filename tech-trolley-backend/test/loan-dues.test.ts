import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";
import {
  loanAccounts,
  minor,
  forms,
  prepareForm,
  formDefaults,
} from "@tech-trolley/contracts";

test("person loan dues reconcile with real postings, reversals and date authorization", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  assert.ok(
    source && new URL(source).pathname.endsWith("_test"),
    "Explicit isolated test server required",
  );
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const database = "loan_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(source);
  url.pathname = "/" + database;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "loans@example.test",
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
    const api = (method: string, path: string, body?: any, auth = token) => {
      const call = (request(http) as any)
        [method](path)
        .set("Authorization", "Bearer " + auth);
      return body === undefined ? call : call.send(body);
    };
    const send = (kind: string, data: any, key = randomUUID(), auth = token) =>
      api("post", "/commands/" + kind, data, auth).set("Idempotency-Key", key);
    const cmd = async (kind: string, data: any, key = randomUUID()) => {
      const r = await send(kind, data, key);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    const state = async (auth = token) =>
      (await api("get", "/shop/state", undefined, auth)).body;
    await cmd("opening", { cash: "100000", bank: "50000" });
    const person = async (name: string, phone = "") => {
      const r = await api("post", "/parties", {
        kind: "person",
        name,
        phone,
        address: "",
      });
      assert.equal(r.status, 201);
      return r.body.id;
    };
    const rony = await person("Rony"),
      mony = await person("Mony"),
      otherRony = await person("Rony", "01800000000");
    const lend = (partyId: string, amount: string, account: string) =>
      cmd("loan", { partyId, amount, account, note: "Personal loan" });
    const a = await lend(rony, "20000", "cash"),
      b = await lend(rony, "3000", "bank");
    await lend(mony, "7000", "cash");
    const c = await lend(otherRony, "5000", "bank");
    const group = async (partyId = rony) =>
      loanAccounts(await state()).find((g) => g.partyId === partyId)!;
    await t.test(
      "groups repeated loans by stable person ID without merging identical names",
      async () => {
        const groups = loanAccounts(await state());
        assert.equal(groups.length, 3);
        assert.equal((await group()).given, "23000.00");
        assert.equal((await group()).due, "23000.00");
        assert.equal((await group(otherRony)).due, "5000.00");
        const s = await state();
        assert.equal(s.balances.cash, "73000.00");
        assert.equal(s.balances.bank, "42000.00");
        assert.equal(s.report.netProfit, "0.00");
      },
    );
    await t.test(
      "partial Cash receipt decreases due once and exact retries do not duplicate money",
      async () => {
        const payload = {
            documentId: a.id,
            amount: "5000",
            account: "cash",
            note: "",
          },
          key = randomUUID();
        const r = await cmd("loanRepayment", payload, key);
        assert.deepEqual(await cmd("loanRepayment", payload, key), r);
        assert.equal((await state()).balances.cash, "78000.00");
        assert.equal((await group()).received, "5000.00");
        assert.equal((await group()).due, "18000.00");
        assert.equal(
          (await send("loanRepayment", { ...payload, amount: "5001" }, key))
            .status,
          409,
        );
        const current = await state();
        assert.throws(() =>
          prepareForm(
            "loanRepayment",
            {
              ...formDefaults("loanRepayment", current.today),
              documentId: a.id,
              amount: "15000.01",
            },
            current,
          ),
        );
        assert.equal(
          (await send("loanRepayment", { ...payload, amount: "15000.01" }))
            .status,
          409,
        );
      },
    );
    await cmd("loanRepayment", {
      documentId: a.id,
      amount: "15000",
      account: "bank",
      note: "Bank receipt",
    });
    const paid = await cmd("loanRepayment", {
      documentId: b.id,
      amount: "3000",
      account: "bank",
      note: "",
    });
    await t.test(
      "full repayment retains cleared history and bank receipts without adding profit",
      async () => {
        const g = await group();
        assert.equal(g.given, "23000.00");
        assert.equal(g.received, "23000.00");
        assert.equal(g.due, "0.00");
        assert.equal(g.history.length, 5);
        assert.equal((await state()).balances.bank, "60000.00");
        assert.equal((await state()).report.netProfit, "0.00");
      },
    );
    await t.test(
      "repayment reversal reopens due and a cancelled loan remains visible without overstating totals",
      async () => {
        await cmd("reversal", {
          documentId: paid.id,
          note: "Receipt entered incorrectly",
        });
        assert.equal((await group()).received, "20000.00");
        assert.equal((await group()).due, "3000.00");
        await cmd("reversal", {
          documentId: c.id,
          note: "Cancelled disbursement",
        });
        const g = await group(otherRony);
        assert.equal(g.given, "0.00");
        assert.equal(g.received, "0.00");
        assert.equal(g.history.length, 2);
        const current = await state();
        assert.equal(
          loanAccounts(current).reduce((sum, g) => sum + minor(g.due), 0n),
          minor(current.balances.loan),
        );
      },
    );
    await t.test(
      "renaming or archiving preserves the person account and still allows collection",
      async () => {
        assert.equal(
          (
            await api("patch", "/parties/" + rony, {
              name: "Rony staff",
              phone: "01700000000",
              address: "",
            })
          ).status,
          200,
        );
        assert.equal((await api("delete", "/parties/" + rony)).status, 200);
        const g = await group();
        assert.equal(g.name, "Rony staff");
        assert.equal(g.active, false);
        assert.equal(g.due, "3000.00");
        const original = (await state()).documents.find(
          (d: any) => d.id === a.id,
        );
        assert.equal(original.snapshot.partyName, "Rony");
        assert.equal(
          (
            await send("loan", {
              partyId: rony,
              amount: "1",
              account: "cash",
              note: "Archived",
            })
          ).status,
          404,
        );
        await cmd("loanRepayment", {
          documentId: b.id,
          amount: "3000",
          account: "cash",
          note: "Final receipt",
        });
        assert.equal((await group()).due, "0.00");
      },
    );
    await t.test(
      "optional expense details post successfully while custom expense names remain mandatory",
      async () => {
        const current = await state();
        for (const details of [
          { categoryId: current.categories[0].id, note: "" },
          { categoryId: "custom", expenseName: "Shop repair" },
        ])
          await cmd("expense", { ...details, amount: "1", account: "cash" });
        assert.equal(
          (
            await send("expense", {
              categoryId: "custom",
              amount: "1",
              account: "cash",
            })
          ).status,
          400,
        );
        assert.equal((await state()).report.netProfit, "-2.00");
      },
    );
    await t.test(
      "Staff cannot see or collect a historical loan and salary advances stay separate",
      async () => {
        const created = await api("post", "/users", {
          name: "Rony staff",
          login: "rony",
          role: "STAFF",
          password: "2034",
        });
        assert.equal(created.status, 201);
        await cmd("advance", {
          staffId: created.body.id,
          amount: "100",
          account: "cash",
          note: "Salary advance",
        });
        assert.equal(loanAccounts(await state()).length, 3);
        const { shift } = require("../dist/reports/reports.service"),
          today = (await state()).today;
        const old = randomUUID();
        // Explicit old fixtures only in this owned test database; no business history is rewritten.
        await db.transaction(async (em: any) => {
          await em.query(
            "INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,original_due,party_id,snapshot) VALUES($1,$2,'loan',$3,'Historical owner',$4,$5,1000,1000,$6,$7)",
            [
              old,
              "OLD-" + old,
              login.body.user.id,
              shift(today, -1) + "T06:00:00Z",
              shift(today, -1),
              mony,
              { partyName: "Mony", account: "cash", note: "Old loan" },
            ],
          );
          await em.query(
            "INSERT INTO journal_line(document_id,account,amount) VALUES($1,'loan',1000),($1,'cash',-1000)",
            [old],
          );
        });
        const staff = await request(http)
          .post("/auth/login")
          .set("X-Native-Client", "1")
          .send({ identity: "rony", password: "2034" });
        assert.equal(staff.status, 201);
        assert.ok(
          !(await state(staff.body.token)).documents.some(
            (d: any) => d.id === old,
          ),
        );
        assert.equal(
          (
            await send(
              "loanRepayment",
              { documentId: old, amount: "10", account: "cash", note: "" },
              randomUUID(),
              staff.body.token,
            )
          ).status,
          403,
        );
        await cmd("loanRepayment", {
          documentId: old,
          amount: "10",
          account: "bank",
          note: "Owner historical collection",
        });
        assert.equal(
          (await state()).documents.find((d: any) => d.id === old).due,
          "0.00",
        );
        assert.equal((await state()).balances.advance, "100.00");
      },
    );
    await t.test(
      "all per-person balances reconcile to the loan journal and journal entries balance",
      async () => {
        const s = await state();
        assert.equal(
          loanAccounts(s).reduce((sum, a) => sum + minor(a.due), 0n),
          minor(s.balances.loan),
        );
        assert.deepEqual(
          await db.query(
            "SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0",
          ),
          [],
        );
        assert.equal((await request(http).get("/shop/state")).status, 401);
      },
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    assert.match(database, /^loan_[a-f0-9]{32}_test$/);
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
