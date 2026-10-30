import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

test("isolated PostgreSQL acceptance, authorization, accounting and retry safety", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  if (!source)
    throw new Error(
      "Set TEST_DATABASE_URL to the isolated PostgreSQL test server; never use production.",
    );
  const url = new URL(source);
  if (!url.pathname.endsWith("_test"))
    throw new Error("Test bootstrap database must end in _test");
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const name = "trolley_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = "/" + name;
  process.env.DATABASE_URL = url.toString();
  process.env.BOOTSTRAP_OWNER_EMAIL = "owner@example.test";
  process.env.BOOTSTRAP_OWNER_PASSWORD = "initial-test-password";
  const { db } = require("../dist/database/database");
  const { migrate } = require("../dist/database/migrate");
  const { bootstrap } = require("../dist/auth/bootstrap");
  const { createApp } = require("../dist/main");
  let app: any;
  let readRole: string | undefined;
  try {
    await migrate();
    await Promise.all([bootstrap(), bootstrap()]);
    await bootstrap();
    app = await createApp();
    await app.init();
    const http = app.getHttpServer();
    const login = async (identity: string, password: string) => {
      const r = await request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({ identity, password });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    let owner = await login("owner@example.test", "initial-test-password"),
      token = owner.token;
    const api = (method: string, path: string, body?: any, tok = token) => {
      let r = (request(http) as any)
        [method](path)
        .set("Authorization", `Bearer ${tok}`);
      if (body !== undefined) r = r.send(body);
      return r;
    };
    const cmd = async (
      kind: string,
      data: any,
      key = randomUUID(),
      tok = token,
    ) => {
      const r = await api("post", "/commands/" + kind, data, tok).set(
        "Idempotency-Key",
        key,
      );
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    await t.test(
      "fresh bootstrap, optional password change, no public signup and persistent credentials",
      async () => {
        const previousRevision = process.env.RENDER_GIT_COMMIT;
        try {
          process.env.RENDER_GIT_COMMIT = "a".repeat(40);
          const health = await request(http).get("/health");
          assert.equal(health.status, 200);
          assert.equal(health.body.status, "ok");
          assert.equal(health.body.revision, "a".repeat(40));
          process.env.RENDER_GIT_COMMIT = "invalid-not-a-git-revision";
          assert.ok(!("revision" in (await request(http).get("/health")).body));
        } finally {
          if (previousRevision === undefined)
            delete process.env.RENDER_GIT_COMMIT;
          else process.env.RENDER_GIT_COMMIT = previousRevision;
        }
        assert.equal(
          (await db.query("SELECT count(*) FROM app_user"))[0].count,
          "1",
        );
        assert.equal(
          (await db.query("SELECT count(*) FROM document"))[0].count,
          "0",
        );
        assert.equal(owner.user.must_change, false);
        assert.equal((await api("get", "/shop/state")).status, 200);
        assert.equal(
          (await request(http).post("/auth/register").send({})).status,
          404,
        );
        assert.equal((await request(http).get("/shop/state")).status, 401);
        assert.equal(
          (
            await api("post", "/auth/password", {
              currentPassword: "initial-test-password",
              password: "changed-test-password",
            })
          ).status,
          201,
        );
        assert.equal((await api("get", "/auth/me")).status, 401);
        await bootstrap();
        owner = await login("OWNER@example.test", "changed-test-password");
        token = owner.token;
        assert.equal(owner.user.must_change, false);
        const state = (await api("get", "/shop/state")).body;
        for (const value of Object.values(state.balances))
          assert.equal(value, "0.00");
        assert.equal(state.units.length, 0);
      },
    );
    const createParty = async (kind: string, name: string) => {
      const r = await api("post", "/parties", { kind, name, phone: "" });
      assert.equal(r.status, 201);
      return r.body.id;
    };
    const supplier = await createParty("supplier", "Test supplier"),
      customer = await createParty("customer", "Test customer"),
      person = await createParty("person", "Test borrower");
    let purchase: any, sale: any;
    const buy = (
      imei: string,
      cost = "70000",
      paid = "20000",
      procurement = "500",
    ) => ({
      model: "Test phone",
      brand: "Test brand",
      variant: "128 GB",
      category: "phone",
      condition: "used",
      imei,
      battery: null,
      box: "unspecified",
      supplierId: supplier,
      cost,
      procurement,
      treatment: "capitalize",
      paid,
      account: "cash",
      note: "",
    });
    await t.test(
      "opening is mandatory, atomic and once only; reference accounting B–F",
      async () => {
        assert.equal(
          (
            await api("post", "/commands/purchase", buy("000000000000001")).set(
              "Idempotency-Key",
              randomUUID(),
            )
          ).status,
          409,
        );
        const openings = await Promise.all([
          api("post", "/commands/opening", {
            cash: "100000",
            bank: "50000",
          }).set("Idempotency-Key", randomUUID()),
          api("post", "/commands/opening", {
            cash: "100000",
            bank: "50000",
          }).set("Idempotency-Key", randomUUID()),
        ]);
        assert.deepEqual(openings.map((r) => r.status).sort(), [201, 409]);
        const opened = (await api("get", "/shop/state")).body;
        assert.equal(opened.report.openingCash, "100000.00");
        assert.equal(opened.report.openingBank, "50000.00");
        assert.equal(opened.report.cashIn, "0.00");
        assert.equal(opened.report.revenue, "0.00");
        assert.equal(
          (
            await api("post", "/commands/opening", {
              cash: "0",
              bank: "0",
            }).set("Idempotency-Key", randomUUID())
          ).status,
          409,
        );
        purchase = await cmd("purchase", buy("000000000000001"));
        let state = (await api("get", "/shop/state")).body;
        assert.equal(state.balances.cash, "79500.00");
        assert.equal(state.balances.payable, "50000.00");
        assert.equal(state.units[0].cost, "70500.00");
        assert.equal(state.report.netProfit, "0.00");
        assert.equal(state.units[0].imei, "000000000000001");
        sale = await cmd("sale", {
          unitId: state.units[0].id,
          price: "76000",
          discount: "1000",
          cash: "25000",
          bank: "40000",
          customerId: customer,
          note: "",
        });
        state = (await api("get", "/shop/state")).body;
        assert.equal(state.report.revenue, "75000.00");
        assert.equal(state.report.cogs, "70500.00");
        assert.equal(state.report.grossProfit, "4500.00");
        assert.equal(state.balances.receivable, "10000.00");
        assert.equal(state.balances.cash, "104500.00");
        assert.equal(state.balances.bank, "90000.00");
        assert.equal(state.units[0].status, "SOLD");
        await cmd("expense", {
          categoryId: state.categories[0].id,
          amount: "150",
          account: "cash",
          note: "Acceptance expense",
        });
        state = (await api("get", "/shop/state")).body;
        assert.equal(state.balances.cash, "104350.00");
        assert.equal(state.report.netProfit, "4350.00");
        await cmd("collection", {
          documentId: sale.id,
          amount: "10000",
          account: "bank",
          note: "",
        });
        await cmd("supplierPayment", {
          documentId: purchase.id,
          amount: "50000",
          account: "bank",
          note: "",
        });
        state = (await api("get", "/shop/state")).body;
        assert.equal(state.balances.bank, "50000.00");
        assert.equal(state.balances.receivable, "0.00");
        assert.equal(state.balances.payable, "0.00");
        assert.equal(state.report.netProfit, "4350.00");
        const receipt = (await api("get", `/documents/${sale.id}/receipt`))
          .body;
        assert.equal(receipt.date, state.today);
        assert.equal(state.documents[0].business_date, state.today);
        assert.equal(receipt.originalDue, "10000.00");
        assert.equal(receipt.outstandingDue, "0.00");
        assert.ok(!JSON.stringify(receipt).includes("cogs"));
        assert.ok(!JSON.stringify(receipt).includes("70500"));
      },
    );
    await t.test(
      "concurrent sales, persisted duplicate results, changed-key payload and rollback",
      async () => {
        const p = await cmd(
          "purchase",
          buy("000000000000002", "100", "100", "0"),
        );
        const state = (await api("get", "/shop/state")).body;
        const u = state.units.find((x: any) => x.purchase_id === p.id),
          data = {
            unitId: u.id,
            price: "90",
            discount: "0",
            cash: "0",
            bank: "0",
            customerId: customer,
            note: "",
          };
        const key = randomUUID();
        const both = await Promise.all([
          cmd("sale", data, key),
          cmd("sale", data, key),
        ]);
        assert.equal(both[0].id, both[1].id);
        const changed = await api("post", "/commands/sale", {
          ...data,
          price: "91",
        }).set("Idempotency-Key", key);
        assert.equal(changed.status, 409);
        assert.equal(
          (await api("get", "/commands/status/" + key)).body.result.id,
          both[0].id,
        );
        await cmd("purchase", buy("000000000000003", "100", "100", "0"));
        const next = (await api("get", "/shop/state")).body.units.find(
          (x: any) => x.imei === "000000000000003",
        );
        const rs = await Promise.all([
          api("post", "/commands/sale", { ...data, unitId: next.id }).set(
            "Idempotency-Key",
            randomUUID(),
          ),
          api("post", "/commands/sale", { ...data, unitId: next.id }).set(
            "Idempotency-Key",
            randomUUID(),
          ),
        ]);
        assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
        const before = (await db.query("SELECT count(*) FROM document"))[0]
          .count;
        assert.equal(
          (
            await api("post", "/commands/purchase", buy("000000000000003")).set(
              "Idempotency-Key",
              randomUUID(),
            )
          ).status,
          409,
        );
        assert.equal(
          (await db.query("SELECT count(*) FROM document"))[0].count,
          before,
        );
      },
    );
    let staffToken: string, staffId: string;
    await t.test(
      "owner-managed users, monthly capability, last Owner and session revocation",
      async () => {
        const created = await api("post", "/users", {
          name: "Test staff",
          login: "test.staff",
          email: "staff@example.test",
          role: "STAFF",
          password: "initial-staff-password",
        });
        assert.equal(created.status, 201);
        staffId = created.body.id;
        let staff = await login("TEST.STAFF", "initial-staff-password");
        await api(
          "post",
          "/auth/password",
          {
            currentPassword: "initial-staff-password",
            password: "changed-staff-password",
          },
          staff.token,
        );
        staff = await login("staff@example.test", "changed-staff-password");
        staffToken = staff.token;
        assert.equal(
          (await api("get", "/reports?period=month", undefined, staffToken))
            .status,
          403,
        );
        assert.equal(
          (await api("get", "/reports?period=week", undefined, staffToken))
            .status,
          403,
        );
        assert.equal(
          (
            await api(
              "get",
              "/reports/export?period=month",
              undefined,
              staffToken,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await api(
              "get",
              "/reports?period=today&role=OWNER",
              undefined,
              staffToken,
            )
          ).status,
          400,
        );
        assert.equal(
          (await api("get", "/users", undefined, staffToken)).status,
          403,
        );
        assert.equal(
          (await api("post", "/users", { name: "Escalation" }, staffToken))
            .status,
          403,
        );
        assert.equal(
          (await api("patch", "/users/" + owner.user.id, { active: false }))
            .body.code,
          "LAST_OWNER",
        );
        assert.equal(
          (
            await api("post", "/users", {
              name: "Second Owner",
              login: "second.owner",
              email: "",
              role: "OWNER",
              password: "second-owner-password",
            })
          ).status,
          201,
        );
        await api("patch", "/users/" + staffId, {
          password: "reset-staff-password",
        });
        assert.equal(
          (await api("get", "/auth/me", undefined, staffToken)).status,
          401,
        );
        const cookieLogin = await request(http)
          .post("/auth/login")
          .send({ identity: "owner", password: "changed-test-password" });
        assert.ok(cookieLogin.headers["set-cookie"][0].includes("HttpOnly"));
        assert.equal(cookieLogin.body.token, undefined);
        assert.equal(
          (
            await request(http)
              .post("/commands/transfer")
              .set("Cookie", cookieLogin.headers["set-cookie"])
              .set("Origin", "https://untrusted.example")
              .set("Idempotency-Key", randomUUID())
              .send({ from: "cash", amount: "1", note: "" })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "funding, loans, salary advance, category history and traceable corrections",
      async () => {
        const before = (await api("get", "/shop/state")).body;
        await cmd("transfer", { from: "cash", amount: "1000", note: "" });
        await cmd("contribution", {
          account: "cash",
          amount: "100",
          note: "Capital",
        });
        await cmd("withdrawal", {
          account: "cash",
          amount: "100",
          note: "Drawing",
        });
        const loan = await cmd("loan", {
          partyId: person,
          amount: "100",
          account: "cash",
          note: "Loan",
        });
        await cmd("loanRepayment", {
          documentId: loan.id,
          amount: "100",
          account: "bank",
          note: "",
        });
        await cmd("advance", {
          staffId,
          amount: "1000",
          account: "cash",
          note: "Advance",
        });
        await cmd("salary", {
          staffId,
          month: "2026-10",
          amount: "1500",
          applyAdvance: "1000",
          account: "cash",
          note: "",
        });
        assert.equal(
          (
            await api("post", "/commands/salary", {
              staffId,
              month: "2026-10",
              amount: "1500",
              applyAdvance: "0",
              account: "cash",
              note: "",
            }).set("Idempotency-Key", randomUUID())
          ).status,
          409,
        );
        let state = (await api("get", "/shop/state")).body;
        assert.equal(state.balances.advance, "0.00");
        assert.equal(
          state.report.netProfit,
          (Number(before.report.netProfit) - 1500).toFixed(2),
        );
        const category = state.categories[0];
        const exp = await cmd("expense", {
          categoryId: category.id,
          amount: "1.23",
          account: "cash",
          note: "Historical label",
        });
        await api("patch", "/expense-categories/" + category.id, {
          bn: "পরিবর্তিত",
          en: "Renamed",
          active: false,
        });
        state = (await api("get", "/shop/state")).body;
        assert.equal(
          state.documents.find((d: any) => d.id === exp.id).snapshot
            .categoryLabels.en,
          category.en,
        );
        await cmd("cashCount", { counted: state.balances.cash, note: "" });
        await cmd("reversal", { documentId: exp.id, note: "Correction test" });
        state = (await api("get", "/shop/state")).body;
        assert.ok(state.counts[0].needs_review);
        assert.ok(
          state.documents.find((d: any) => d.id === exp.id).reversed_by,
        );
        assert.equal(
          (
            await api("post", "/commands/reversal", {
              documentId: sale.id,
              note: "Has collection",
            }).set("Idempotency-Key", randomUUID())
          ).status,
          409,
        );
        const journal = await db.query(
          "SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0",
        );
        assert.equal(journal.length, 0);
      },
    );
    await t.test(
      "concurrent overspending and overcollection have one winner, exact precision",
      async () => {
        const state = (await api("get", "/shop/state")).body;
        const amt = state.balances.bank;
        const rs = await Promise.all([
          api("post", "/commands/withdrawal", {
            account: "bank",
            amount: amt,
            note: "Race 1",
          }).set("Idempotency-Key", randomUUID()),
          api("post", "/commands/withdrawal", {
            account: "bank",
            amount: amt,
            note: "Race 2",
          }).set("Idempotency-Key", randomUUID()),
        ]);
        assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
        const d = state.documents.find(
          (d: any) => d.kind === "sale" && Number(d.due) > 0,
        );
        const cs = await Promise.all([
          api("post", "/commands/collection", {
            documentId: d.id,
            amount: d.due,
            account: "cash",
            note: "",
          }).set("Idempotency-Key", randomUUID()),
          api("post", "/commands/collection", {
            documentId: d.id,
            amount: d.due,
            account: "cash",
            note: "",
          }).set("Idempotency-Key", randomUUID()),
        ]);
        assert.deepEqual(cs.map((r) => r.status).sort(), [201, 409]);
        assert.equal(
          (
            await api("post", "/commands/contribution", {
              account: "cash",
              amount: "0.015",
              note: "Invalid precision",
            }).set("Idempotency-Key", randomUUID())
          ).status,
          400,
        );
      },
    );
    await t.test(
      "database failure rolls back the complete command and retry can recover",
      async () => {
        const state = (await api("get", "/shop/state")).body;
        const before = (await db.query("SELECT count(*) FROM document"))[0]
          .count;
        const key = randomUUID(),
          data = {
            categoryId: state.categories.find((c: any) => c.active).id,
            amount: "123.45",
            account: "cash",
            note: "Injected DB failure",
          };
        await db.query(
          `CREATE FUNCTION acceptance_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.amount=12345 THEN RAISE EXCEPTION 'Injected test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER acceptance_failure BEFORE INSERT ON journal_line FOR EACH ROW EXECUTE FUNCTION acceptance_failure()`,
        );
        assert.equal(
          (
            await api("post", "/commands/expense", data).set(
              "Idempotency-Key",
              key,
            )
          ).status,
          500,
        );
        assert.equal(
          (await db.query("SELECT count(*) FROM document"))[0].count,
          before,
        );
        assert.equal(
          (await api("get", "/commands/status/" + key)).body.found,
          false,
        );
        await db.query(
          "DROP TRIGGER acceptance_failure ON journal_line; DROP FUNCTION acceptance_failure()",
        );
        await cmd("expense", data, key);
        assert.equal(
          (await api("get", "/commands/status/" + key)).body.found,
          true,
        );
      },
    );
    await t.test(
      "accessories, stable walk-in, immutable corrections and schema documentation",
      async () => {
        const state = (await api("get", "/shop/state")).body;
        const beforeExpense = Number(state.report.expense);
        const p = await cmd("purchase", {
          ...buy("000000000000009", "100", "0", "5"),
          category: "accessory",
          imei: null,
          treatment: "expense",
        });
        let next = (await api("get", "/shop/state")).body;
        const unit = next.units.find((u: any) => u.purchase_id === p.id);
        assert.equal(unit.cost, "100.00");
        assert.equal(unit.imei, null);
        assert.equal(Number(next.report.expense), beforeExpense + 5);
        const s = await cmd("sale", {
          unitId: unit.id,
          price: "90",
          discount: "0",
          cash: "90",
          bank: "0",
          customerId: null,
          note: "Below cost",
        });
        const sold = (
          await db.query("SELECT * FROM document WHERE id=$1", [s.id])
        )[0];
        assert.ok(sold.party_id);
        assert.equal(sold.snapshot.cogs, "100.00");
        await cmd("reversal", {
          documentId: s.id,
          note: "Mistaken sale correction",
        });
        next = (await api("get", "/shop/state")).body;
        assert.equal(
          next.units.find((u: any) => u.id === unit.id).status,
          "IN_STOCK",
        );
        await cmd("sale", {
          unitId: unit.id,
          price: "110",
          discount: "0",
          cash: "110",
          bank: "0",
          customerId: null,
          note: "",
        });
        assert.equal(
          (await db.query("SELECT count(*) FROM party WHERE is_walk_in"))[0]
            .count,
          "1",
        );
        await assert.rejects(
          db.query("UPDATE document SET number='tamper' WHERE id=$1", [s.id]),
        );
        await assert.rejects(
          db.query("DELETE FROM journal_line WHERE document_id=$1", [s.id]),
        );
        const spec = (await request(http).get("/openapi.json")).body;
        assert.ok(
          spec.paths["/commands/purchase"].post.requestBody.content[
            "application/json"
          ].schema.properties.cost,
        );
        assert.equal(
          spec.paths["/commands/purchase"].post.requestBody.content[
            "application/json"
          ].schema.properties.sellingPrice,
          undefined,
        );
        const changed = await login(
          "staff@example.test",
          "reset-staff-password",
        );
        assert.equal(changed.user.must_change, false);
        assert.equal(
          (await api("get", "/shop/state", undefined, changed.token)).status,
          200,
        );
        await api("patch", "/users/" + staffId, { active: false });
        assert.equal(
          (await api("get", "/auth/me", undefined, changed.token)).status,
          401,
        );
      },
    );
    await t.test(
      "empty category lists remain empty, historical reads and canonical date validation",
      async () => {
        const state = (await api("get", "/shop/state")).body;
        for (const c of state.categories)
          if (c.active)
            await api("patch", "/expense-categories/" + c.id, {
              bn: c.bn,
              en: c.en,
              active: false,
            });
        await bootstrap();
        assert.equal(
          (await api("get", "/shop/state")).body.categories.filter(
            (c: any) => c.active,
          ).length,
          0,
        );
        assert.equal(
          (await api("get", "/reports?period=today&date=2026-02-30")).status,
          400,
        );
        assert.equal(
          (await api("get", "/reports?period=week&date=2026-10-01")).status,
          400,
        );
        assert.equal(
          (await api("get", "/reports?period=today&date=2000-01-01")).body
            .available,
          false,
        );
        const today = (await api("get", "/shop/state")).body.today;
        const { shift } = require("../dist/reports/reports.service");
        const first = today.slice(0, 8) + "01",
          previous = shift(first, -1);
        await db.query("UPDATE shop SET opening_date=$1 WHERE id=1", [
          previous,
        ]);
        for (const [instant, cents] of [
          [previous + "T17:59:59Z", 1000],
          [previous + "T18:00:00Z", 2000],
        ]) {
          const id = randomUUID();
          await db.transaction(async (em: any) => {
            await em.query(
              "INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,snapshot) VALUES($1,$2,'contribution',$3,'Boundary fixture',$4,($4::timestamptz AT TIME ZONE 'Asia/Dhaka')::date,$5,'{}')",
              [id, "BOUND-" + id, owner.user.id, instant, String(cents)],
            );
            await em.query(
              "INSERT INTO journal_line(document_id,account,amount) VALUES($1,'cash',$2),($1,'equity',$3)",
              [id, String(cents), String(-Number(cents))],
            );
          });
        }
        const previousReport = (
            await api("get", "/reports?period=today&date=" + previous)
          ).body,
          firstReport = (
            await api("get", "/reports?period=today&date=" + first)
          ).body;
        assert.equal(previousReport.closingCash, "10.00");
        assert.equal(firstReport.openingCash, "10.00");
        assert.equal(firstReport.closingCash, "30.00");
        assert.equal(firstReport.documents.length, 1);
        assert.equal(previousReport.documents.length, 1);
        assert.equal(firstReport.documents[0].business_date, first);
        assert.equal(previousReport.documents[0].business_date, previous);
      },
    );
    await t.test(
      "invoice snapshots preserve customer contact, Owner/Staff seller identity and shop details",
      async () => {
        const customerRecord = await api("post", "/parties", {
          name: "Invoice customer",
          phone: "01700000000",
          address: "Banasree, Dhaka",
          kind: "customer",
        });
        assert.equal(customerRecord.status, 201);
        const originalShop = (await api("get", "/shop/state")).body.shop;
        const stock = await cmd("purchase", {
          ...buy("000000000000167", "100", "0", "0"),
        });
        const stockId = (await api("get", "/shop/state")).body.units.find(
          (u: any) => u.purchase_id === stock.id,
        ).id;
        const data = {
          unitId: stockId,
          price: "200",
          discount: "10",
          cash: "100",
          bank: "0",
          customerId: customerRecord.body.id,
          note: "Invoice fixture",
        };
        const key = randomUUID(),
          issued = await cmd("sale", data, key);
        assert.equal((await cmd("sale", data, key)).id, issued.id);
        assert.equal(
          (
            await api("post", "/commands/sale", {
              ...data,
              customerAddress: "Changed invoice",
            }).set("Idempotency-Key", key)
          ).status,
          409,
        );
        await db.query(
          "UPDATE party SET name='Renamed customer',phone='01900000000',address='Changed address' WHERE id=$1",
          [customerRecord.body.id],
        );
        await db.query(
          "UPDATE app_user SET name='Renamed operator',role='STAFF' WHERE id=$1",
          [owner.user.id],
        );
        try {
          const saved = (await api("get", `/documents/${issued.id}/receipt`))
            .body;
          assert.equal(saved.customer, "Invoice customer");
          assert.equal(saved.phone, "01700000000");
          assert.equal(saved.address, "Banasree, Dhaka");
          assert.equal(saved.seller.name, owner.user.name);
          assert.equal(saved.seller.role, "OWNER");
          assert.equal(saved.unit.imei, "000000000000167");
          assert.equal(saved.unit.condition, "used");
          assert.equal(saved.paid, "100.00");
          assert.equal(saved.originalDue, "90.00");
          assert.equal(
            saved.shop.qrUrl,
            "https://www.facebook.com/share/1CWzbVs5hb/?mibextid=wwXIfr",
          );
          assert.equal(saved.shop.afterSalesTerms.length, 12);
          assert.equal(
            saved.shop.afterSalesTerms[0],
            "বিক্রিত পণ্য অফেরতযোগ্য।",
          );
          assert.ok(!("cogs" in saved));
          assert.ok(!("cost" in saved.unit));
        } finally {
          await db.query(
            "UPDATE app_user SET name=$2,role='OWNER' WHERE id=$1",
            [owner.user.id, owner.user.name],
          );
        }
        await api("patch", "/shop", {
          name: "Changed shop",
          address: "Changed shop address",
          phone: "01800000000",
        });
        assert.equal(
          (await api("get", `/documents/${issued.id}/receipt`)).body.shop.name,
          originalShop.name,
        );
        await api("patch", "/shop", {
          name: originalShop.name,
          address: originalShop.address,
          phone: originalShop.phone,
        });
        await api("patch", "/users/" + staffId, {
          active: true,
          role: "STAFF",
        });
        const staff = await login("staff@example.test", "reset-staff-password");
        const second = await cmd("purchase", {
          ...buy("000000000000168", "100", "0", "0"),
        });
        const secondId = (await api("get", "/shop/state")).body.units.find(
          (u: any) => u.purchase_id === second.id,
        ).id;
        const byStaff = await cmd(
          "sale",
          {
            unitId: secondId,
            price: "150",
            discount: "0",
            cash: "150",
            bank: "0",
            customerId: null,
            customerName: "নমুনা ক্রেতা",
            customerPhone: "01600000000",
            customerAddress: "ঢাকা",
            note: "",
          },
          randomUUID(),
          staff.token,
        );
        await db.query(
          "UPDATE app_user SET name='Renamed staff',role='OWNER' WHERE id=$1",
          [staffId],
        );
        const saved = (await api("get", `/documents/${byStaff.id}/receipt`))
          .body;
        assert.equal(saved.customer, "নমুনা ক্রেতা");
        assert.equal(saved.address, "ঢাকা");
        assert.equal(saved.phone, "01600000000");
        assert.equal(saved.seller.role, "STAFF");
        assert.equal(saved.seller.name, staff.user.name);
        assert.equal(saved.outstandingDue, "0.00");
        await db.query("UPDATE app_user SET name=$2,role='STAFF' WHERE id=$1", [
          staffId,
          staff.user.name,
        ]);
      },
    );
    await t.test(
      "model profit, separate product details, custom expenses and statement balances reconcile",
      async () => {
        const staff = await login("staff@example.test", "reset-staff-password");
        const postUnit = async (
          imei: string,
          cost: string,
          procurement: string,
          treatment: string,
          storage: string,
        ) => {
          const result = await cmd(
            "purchase",
            {
              ...buy(imei, cost, cost, procurement),
              brand: "QA",
              model: "Profit QA Alpha",
              storage,
              color: "Blue",
              variant: "US",
              treatment,
            },
            randomUUID(),
            staff.token,
          );
          const u = (
            await api("get", "/shop/state", undefined, staff.token)
          ).body.units.find((u: any) => u.purchase_id === result.id);
          assert.equal(u.storage, storage);
          assert.equal(u.color, "Blue");
          assert.equal(u.variant, "US");
          return u;
        };
        const first = await postUnit(
          "000000000000201",
          "123.45",
          "6.55",
          "capitalize",
          "256 GB",
        );
        assert.equal(first.cost, "130.00");
        const second = await postUnit(
          "000000000000202",
          "70",
          "5",
          "expense",
          "128 GB",
        );
        const issued = await cmd(
          "sale",
          {
            unitId: first.id,
            price: "200",
            discount: "10",
            cash: "150",
            bank: "0",
            customerId: customer,
            note: "",
          },
          randomUUID(),
          staff.token,
        );
        const secondSale = await cmd(
          "sale",
          {
            unitId: second.id,
            price: "100",
            discount: "0",
            cash: "100",
            bank: "0",
            customerId: null,
            note: "",
          },
          randomUUID(),
          staff.token,
        );
        const memo = (
          await api(
            "get",
            `/documents/${issued.id}/receipt`,
            undefined,
            staff.token,
          )
        ).body;
        assert.equal(memo.unit.storage, "256 GB");
        assert.equal(memo.unit.color, "Blue");
        assert.equal(memo.unit.variant, "US");
        const missing = await api(
          "post",
          "/commands/expense",
          {
            categoryId: "custom",
            amount: "30",
            account: "cash",
            note: "Repair counter",
          },
          staff.token,
        ).set("Idempotency-Key", randomUUID());
        assert.equal(missing.status, 400);
        const expense = await cmd(
          "expense",
          {
            categoryId: "custom",
            expenseName: "Shop repairs",
            amount: "30",
            account: "cash",
            note: "Replaced counter drawer",
          },
          randomUUID(),
          staff.token,
        );
        let r = (await api("get", "/reports?period=today")).body;
        let model = r.productProfit.find(
          (p: any) => p.model === "Profit QA Alpha",
        );
        assert.deepEqual(model, {
          brand: "QA",
          model: "Profit QA Alpha",
          quantity: 2,
          purchaseCost: "200.00",
          sales: "290.00",
          grossProfit: "90.00",
        });
        assert.equal(
          r.expenseBreakdown.find((e: any) => e.en === "Shop repairs").amount,
          "30.00",
        );
        assert.equal(
          r.expenseStatement.find((e: any) => e.id === expense.id).note,
          "Replaced counter drawer",
        );
        await cmd(
          "collection",
          {
            documentId: issued.id,
            amount: "10",
            account: "cash",
            note: "Later payment",
          },
          randomUUID(),
          staff.token,
        );
        assert.deepEqual(
          (await api("get", "/reports?period=today")).body.productProfit.find(
            (p: any) => p.model === "Profit QA Alpha",
          ),
          model,
        );
        await cmd(
          "reversal",
          { documentId: secondSale.id, note: "Same-day correction" },
          randomUUID(),
          staff.token,
        );
        await cmd(
          "reversal",
          { documentId: expense.id, note: "Correct custom expense" },
          randomUUID(),
          staff.token,
        );
        r = (await api("get", "/reports?period=today")).body;
        model = r.productProfit.find((p: any) => p.model === "Profit QA Alpha");
        assert.deepEqual(model, {
          brand: "QA",
          model: "Profit QA Alpha",
          quantity: 1,
          purchaseCost: "130.00",
          sales: "190.00",
          grossProfit: "60.00",
        });
        const cents = (v: string) => BigInt(v.replace(".", ""));
        assert.equal(
          r.productProfit.reduce(
            (n: bigint, p: any) => n + cents(p.grossProfit),
            0n,
          ),
          cents(r.grossProfit),
        );
        assert.equal(
          r.expenseBreakdown.reduce(
            (n: bigint, e: any) => n + cents(e.amount),
            0n,
          ),
          cents(r.expense),
        );
        assert.equal(r.moneyStatement.at(-1).cashBalance, r.closingCash);
        assert.equal(r.moneyStatement.at(-1).bankBalance, r.closingBank);
        const csv = await api(
          "get",
          "/reports/export?period=today&lang=en",
          undefined,
          staff.token,
        );
        assert.equal(csv.status, 200);
        for (const text of [
          "Profit by model",
          "Product profit statement",
          "Expenses by category",
          "Cash & bank statement",
          "Shop repairs",
          "Replaced counter drawer",
          "256 GB",
          "Blue",
        ])
          assert.ok(csv.text.includes(text), text);
      },
    );
    await t.test(
      "inclusive ranges and cross-day corrections preserve history while Staff only sees today",
      async () => {
        const today = (await api("get", "/shop/state")).body.today;
        const { shift } = require("../dist/reports/reports.service");
        const yesterday = shift(today, -1),
          oldId = randomUUID();
        await db.transaction(async (em: any) => {
          await em.query(
            "INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,original_due,snapshot) VALUES($1,$2,'sale',$3,'Historical seller',$4,$5,7500,2500,$6)",
            [
              oldId,
              "OLD-" + oldId,
              owner.user.id,
              yesterday + "T06:00:00Z",
              yesterday,
              {
                brand: "QA",
                model: "Historical QA Model",
                storage: "64 GB",
                color: "Black",
                variant: "Legacy",
                price: "75.00",
                discount: "0.00",
                cash: "50.00",
                bank: "0.00",
                cogs: "50.00",
                internalId: "HIST-01",
                box: "unspecified",
                battery: null,
              },
            ],
          );
          await em.query(
            "INSERT INTO journal_line(document_id,account,amount) VALUES($1,'cash',5000),($1,'receivable',2500),($1,'revenue',-7500),($1,'cogs',5000),($1,'inventory',-5000)",
            [oldId],
          );
        });
        const staff = await login("staff@example.test", "reset-staff-password");
        const state = (await api("get", "/shop/state", undefined, staff.token))
          .body;
        assert.ok(state.documents.every((d: any) => d.business_date === today));
        assert.ok(!state.documents.some((d: any) => d.id === oldId));
        assert.ok(!("revenue" in state.balances));
        assert.ok(
          state.units.some(
            (u: any) => u.storage === "256 GB" && u.cost === "130.00",
          ),
        );
        for (const query of [
          "period=week",
          "period=month",
          `period=today&date=${yesterday}`,
          `period=range&from=${today}&to=${today}`,
        ]) {
          assert.equal(
            (await api("get", "/reports?" + query, undefined, staff.token))
              .status,
            403,
          );
          assert.equal(
            (
              await api(
                "get",
                "/reports/export?" + query,
                undefined,
                staff.token,
              )
            ).status,
            403,
          );
        }
        assert.equal(
          (
            await api(
              "get",
              `/documents/${oldId}/receipt`,
              undefined,
              staff.token,
            )
          ).status,
          404,
        );
        for (const [kind, data] of [
          ["reversal", { documentId: oldId, note: "Forbidden old correction" }],
          [
            "collection",
            {
              documentId: oldId,
              amount: "1",
              account: "cash",
              note: "Old collection",
            },
          ],
        ])
          assert.equal(
            (
              await api("post", "/commands/" + kind, data, staff.token).set(
                "Idempotency-Key",
                randomUUID(),
              )
            ).status,
            403,
          );
        const before = (
          await api(
            "get",
            `/reports?period=range&from=${yesterday}&to=${yesterday}`,
          )
        ).body;
        assert.equal(
          before.productProfit.find(
            (p: any) => p.model === "Historical QA Model",
          ).grossProfit,
          "25.00",
        );
        await cmd("reversal", {
          documentId: oldId,
          note: "Owner corrects prior date",
        });
        const after = (
          await api("get", `/reports?period=today&date=${yesterday}`)
        ).body;
        assert.equal(
          after.productProfit.find(
            (p: any) => p.model === "Historical QA Model",
          ).grossProfit,
          "25.00",
        );
        const now = (await api("get", "/reports?period=today")).body;
        const corrected = now.productProfit.find(
          (p: any) => p.model === "Historical QA Model",
        );
        assert.equal(corrected.quantity, -1);
        assert.equal(corrected.purchaseCost, "-50.00");
        assert.equal(corrected.sales, "-75.00");
        assert.equal(corrected.grossProfit, "-25.00");
        const both = (
          await api(
            "get",
            `/reports?period=range&from=${yesterday}&to=${today}`,
          )
        ).body;
        assert.equal(both.from, yesterday);
        assert.equal(both.to, today);
        assert.equal(
          both.productProfit.find((p: any) => p.model === "Historical QA Model")
            .grossProfit,
          "0.00",
        );
        assert.equal(both.moneyStatement.at(-1).cashBalance, both.closingCash);
        for (const query of [
          `period=range&from=${today}&to=${yesterday}`,
          "period=range&from=2026-02-30&to=" + today,
          `period=range&from=${today}`,
          `period=range&from=${today}&to=${shift(today, 1)}`,
          `period=week&from=${today}&to=${today}`,
        ])
          assert.equal((await api("get", "/reports?" + query)).status, 400);
      },
    );
    await t.test(
      "custom party selections support Staff CRUD without changing posted history or dues",
      async () => {
        const staff = await login("staff@example.test", "reset-staff-password");
        assert.equal(
          (
            await request(http)
              .post("/parties")
              .send({ name: "Public", kind: "supplier" })
          ).status,
          401,
        );
        const made = await api(
          "post",
          "/parties",
          {
            name: "Custom supplier",
            kind: "supplier",
            phone: "01234567890",
            address: "Original address",
          },
          staff.token,
        );
        assert.equal(made.status, 201);
        const p = made.body;
        assert.equal(p.active, true);
        const duplicate = await api("post", "/parties", {
          name: " custom SUPPLIER ",
          kind: "supplier",
          phone: p.phone,
        });
        assert.equal(duplicate.status, 409);
        const bought = await cmd("purchase", {
          ...buy("999999999999991", "1", "0", "0"),
          supplierId: p.id,
        });
        const before = (
          await db.query("SELECT snapshot FROM document WHERE id=$1", [
            bought.id,
          ])
        )[0].snapshot;
        assert.equal(before.partyName, "Custom supplier");
        const details = {
          name: "Changed supplier",
          phone: "01999999999",
          address: "New address",
        };
        assert.equal(
          (
            await api("patch", "/parties/" + p.id, {
              ...details,
              kind: "customer",
            })
          ).status,
          400,
        );
        assert.equal(
          (await api("patch", "/parties/" + p.id, { ...details, name: " " }))
            .status,
          400,
        );
        assert.equal(
          (await api("patch", "/parties/" + p.id, details, staff.token)).status,
          200,
        );
        assert.equal(
          (await api("delete", "/parties/" + p.id, undefined, staff.token))
            .status,
          200,
        );
        let state = (await api("get", "/shop/state")).body;
        assert.equal(
          state.parties.find((x: any) => x.id === p.id).active,
          false,
        );
        const { choices, forms } = require("@tech-trolley/contracts");
        assert.ok(
          !choices(
            forms.purchase.find((f: any) => f.key === "supplierId"),
            state,
            "bn",
          ).some((x: any) => x.value === p.id),
        );
        const journalCount = (
          await db.query("SELECT count(*) FROM journal_line")
        )[0].count;
        assert.equal(
          (
            await api("post", "/commands/purchase", {
              ...buy("999999999999992", "1", "0", "0"),
              supplierId: p.id,
            }).set("Idempotency-Key", randomUUID())
          ).status,
          404,
        );
        assert.equal(
          (await db.query("SELECT count(*) FROM journal_line"))[0].count,
          journalCount,
        );
        // Historical payable settlement uses the original document, even when its supplier is hidden.
        await cmd("supplierPayment", {
          documentId: bought.id,
          amount: "1",
          account: "cash",
          note: "Settle archived supplier",
        });
        state = (await api("get", "/shop/state")).body;
        assert.equal(
          state.documents.find((x: any) => x.id === bought.id).due,
          "0.00",
        );
        assert.deepEqual(
          (
            await db.query("SELECT snapshot FROM document WHERE id=$1", [
              bought.id,
            ])
          )[0].snapshot,
          before,
        );
        assert.equal(
          (await api("patch", "/parties/" + p.id + "/active", { active: true }))
            .status,
          200,
        );
        state = (await api("get", "/shop/state")).body;
        assert.ok(
          choices(
            forms.purchase.find((f: any) => f.key === "supplierId"),
            state,
            "en",
          ).some(
            (x: any) => x.value === p.id && x.label.includes(details.name),
          ),
        );
        const walkIn = (
          await db.query("SELECT id FROM party WHERE is_walk_in")
        )[0];
        assert.equal(
          (await api("delete", "/parties/" + walkIn.id)).status,
          404,
        );
        assert.equal(
          (await api("patch", "/parties/not-an-id", details)).status,
          400,
        );
        const events = await db.query(
          "SELECT action,details FROM audit_event WHERE subject_id=$1 ORDER BY id",
          [p.id],
        );
        assert.deepEqual(
          events.map((e: any) => e.action),
          [
            "party_created",
            "party_updated",
            "party_archived",
            "party_restored",
          ],
        );
        assert.equal(events[1].details.before.name, "Custom supplier");
        assert.equal(events[1].details.after.name, details.name);
      },
    );
    await t.test(
      "release startup is idempotent and Supabase-style RLS blocks direct reads",
      async () => {
        const [{ count: before }] = await db.query(
          "SELECT count(*) FROM document",
        );
        const [{ password_hash: oldHash }] = await db.query(
          "SELECT password_hash FROM app_user WHERE id=$1",
          [owner.user.id],
        );
        const root = resolve(__dirname, "../..");
        const env = { ...process.env };
        delete env.BOOTSTRAP_OWNER_EMAIL;
        delete env.BOOTSTRAP_OWNER_PASSWORD;
        for (let attempt = 0; attempt < 2; attempt++)
          execFileSync(
            process.execPath,
            [resolve(root, "scripts/release-api.mjs")],
            { cwd: root, env, stdio: "pipe" },
          );
        assert.equal(
          (await db.query("SELECT count(*) FROM document"))[0].count,
          before,
        );
        assert.equal(
          (
            await db.query("SELECT password_hash FROM app_user WHERE id=$1", [
              owner.user.id,
            ])
          )[0].password_hash,
          oldHash,
        );
        const rows = await db.query(
          "SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('public.app_user'::regclass,'public.session'::regclass,'public.document'::regclass,'public.journal_line'::regclass,'public.schema_migration'::regclass)",
        );
        assert.ok(rows.every((r: any) => r.relrowsecurity));
        readRole = "trolley_read_" + randomUUID().replaceAll("-", "");
        await admin.query(`CREATE ROLE "${readRole}" NOLOGIN`);
        await db.query(`GRANT USAGE ON SCHEMA public TO "${readRole}"`);
        await db.query(`GRANT SELECT ON public.document TO "${readRole}"`);
        await db.transaction(async (em: any) => {
          await em.query(`SET LOCAL ROLE "${readRole}"`);
          assert.equal(
            (await em.query("SELECT count(*) FROM public.document"))[0].count,
            "0",
          );
        });
        assert.equal(
          (await db.query("SELECT count(*) FROM document"))[0].count,
          before,
        );
      },
    );
    await t.test(
      "web proxy keeps a real Nest login cookie and logout revocation working",
      async () => {
        const { proxyApi } =
          await import("../../tech-trolley-frontend/src/lib/api-proxy");
        await app.listen(0, "127.0.0.1");
        const options = { upstream: await app.getUrl(), production: false };
        const origin = "http://localhost:3001";
        const login = await proxyApi(
          new Request(origin + "/api/auth/login", {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({
              identity: "owner@example.test",
              password: "changed-test-password",
            }),
          }),
          ["auth", "login"],
          options,
        );
        assert.equal(login.status, 201);
        assert.equal((await login.json()).token, undefined);
        const setCookie = login.headers.getSetCookie()[0];
        assert.match(setCookie, /HttpOnly/);
        assert.match(setCookie, /SameSite=Strict/);
        const cookie = setCookie.split(";")[0];
        const me = await proxyApi(
          new Request(origin + "/api/auth/me", { headers: { Cookie: cookie } }),
          ["auth", "me"],
          options,
        );
        assert.equal(me.status, 200);
        assert.equal((await me.json()).id, owner.user.id);
        const csv = await proxyApi(
          new Request(origin + "/api/reports/export?period=today&lang=bn", {
            headers: { Cookie: cookie },
          }),
          ["reports", "export"],
          options,
        );
        assert.equal(csv.status, 200);
        assert.match(csv.headers.get("content-type")!, /text\/csv/);
        const logout = await proxyApi(
          new Request(origin + "/api/auth/logout", {
            method: "POST",
            headers: { Cookie: cookie, Origin: origin },
          }),
          ["auth", "logout"],
          options,
        );
        assert.equal(logout.status, 201);
        const expired = await proxyApi(
          new Request(origin + "/api/auth/me", { headers: { Cookie: cookie } }),
          ["auth", "me"],
          options,
        );
        assert.equal(expired.status, 401);
      },
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    if (readRole) await admin.query(`DROP ROLE "${readRole}"`);
    await admin.end();
  }
});
