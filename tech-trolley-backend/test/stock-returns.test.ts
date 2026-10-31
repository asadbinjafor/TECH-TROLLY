import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import request from "supertest";
import {
  minor,
  unitFormValues,
  prepareForm,
  choices,
  forms,
  correctableDocument,
} from "@tech-trolley/contracts";

test("stock edits and supplier returns preserve immutable accounting and actual refund timing", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  assert.ok(
    source && new URL(source).pathname.endsWith("_test"),
    "Explicit isolated test server required",
  );
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const database = "stock_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(source);
  url.pathname = "/" + database;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "stock.owner@example.test",
    BOOTSTRAP_OWNER_PASSWORD: "1023",
    WEB_ORIGIN: "http://localhost:3001",
  });
  const { db, connect } = require("../dist/database/database");
  const { migrate } = require("../dist/database/migrate");
  const { bootstrap } = require("../dist/auth/bootstrap");
  const { createApp } = require("../dist/main");
  let app: any;
  try {
    // Exercise an upgrade with real version-7 purchase history in this owned database.
    await connect();
    await db.query(
      "CREATE TABLE schema_migration(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const dir = resolve(__dirname, "../migrations");
    for (const name of (await readdir(dir))
      .filter((n) => n.endsWith(".sql") && n < "008_")
      .sort()) {
      const sql = await readFile(resolve(dir, name), "utf8");
      await db.transaction(async (em: any) => {
        await em.query(sql);
        await em.query(
          "INSERT INTO schema_migration(name,hash) VALUES($1,$2)",
          [name, createHash("sha256").update(sql).digest("hex")],
        );
      });
    }
    await bootstrap();
    // The current PostingService writes this nullable acquisition link. Add it
    // temporarily to the explicitly owned v7 fixture, then remove it before
    // exercising the real v7 -> v8 -> v9 startup migration below.
    await db.query(
      "ALTER TABLE inventory_unit ADD COLUMN previous_unit_id uuid",
    );
    await db.query(
      "ALTER TABLE inventory_unit ADD COLUMN phone_type text, ADD COLUMN ram text",
    );
    app = await createApp();
    await app.init();
    const http = app.getHttpServer();
    const signIn = async (identity: string, password: string) => {
      const r = await request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({ identity, password });
      assert.equal(r.status, 201);
      return r.body;
    };
    const owner = await signIn("owner", "1023");
    const api = (
      method: string,
      path: string,
      body?: any,
      token = owner.token,
    ) => {
      const r = (request(http) as any)
        [method](path)
        .set("Authorization", "Bearer " + token);
      return body === undefined ? r : r.send(body);
    };
    const send = (
      kind: string,
      data: any,
      key = randomUUID(),
      token = owner.token,
    ) =>
      api("post", "/commands/" + kind, data, token).set("Idempotency-Key", key);
    const cmd = async (
      kind: string,
      data: any,
      key = randomUUID(),
      token = owner.token,
    ) => {
      const r = await send(kind, data, key, token);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    const state = async (token = owner.token) =>
      (await api("get", "/shop/state", undefined, token)).body;
    const doc = async (id: string) =>
      (await state()).documents.find((d: any) => d.id === id);
    const balance = async () => (await state()).balances;
    const report = async () => (await api("get", "/reports?period=today")).body;
    await cmd("opening", { cash: "1000000", bank: "100000" });
    const supplier = (
      await api("post", "/parties", {
        kind: "supplier",
        name: "Stock return supplier",
        phone: "",
      })
    ).body.id;
    let serial = 860000000000001n;
    const buy = async (
      cost = "32000",
      paid = cost,
      procurement = "0",
      treatment = "capitalize",
    ) => {
      const d = await cmd("purchase", {
        model: "Return QA",
        brand: "QA",
        storage: "128",
        color: "Blue",
        variant: "Japan",
        category: "phone",
        condition: "used",
        imei: String(serial++),
        battery: 80,
        box: "with",
        supplierId: supplier,
        cost,
        paid,
        procurement,
        treatment,
        account: "cash",
        note: "Test stock",
      });
      return (await state()).units.find((u: any) => u.purchase_id === d.id);
    };
    const old = await buy("100", "100");
    await t.test(
      "migration preserves original records, balances and RLS",
      async () => {
        const documents = await db.query(
          "SELECT * FROM document ORDER BY number",
        );
        const journal = await db.query(
          "SELECT * FROM journal_line ORDER BY id",
        );
        await db.query(
          "ALTER TABLE inventory_unit DROP COLUMN previous_unit_id",
        );
        await db.query(
          "ALTER TABLE inventory_unit DROP COLUMN phone_type, DROP COLUMN ram",
        );
        await migrate();
        assert.deepEqual(
          await db.query("SELECT * FROM document ORDER BY number"),
          documents,
        );
        assert.deepEqual(
          await db.query("SELECT * FROM journal_line ORDER BY id"),
          journal,
        );
        assert.equal(
          (await state()).units.find((u: any) => u.id === old.id).revision,
          0,
        );
        const rows = await db.query(
          "SELECT relrowsecurity FROM pg_class WHERE oid IN ('document'::regclass,'journal_line'::regclass,'inventory_unit'::regclass)",
        );
        assert.ok(rows.every((r: any) => r.relrowsecurity));
      },
    );
    const staffCreated = await api("post", "/users", {
      name: "Stock Staff",
      login: "stock.staff",
      role: "STAFF",
      password: "2034",
    });
    assert.equal(staffCreated.status, 201);
    const staff = await signIn("stock.staff", "2034");
    const editData = (u: any, extra = {}) => ({
      unitId: u.id,
      ...unitFormValues("stockEdit", u),
      phoneType: u.phoneType || null,
      ram: u.ram || null,
      revision: u.revision,
      note: "Corrected physical label",
      ...extra,
      battery: u.battery,
    });
    const returnData = (u: any, value = "32000") => ({
      unitId: u.id,
      revision: u.revision,
      returnValue: value,
      note: "Fault found; supplier accepted return",
    });
    await t.test(
      "metadata edits are audited, idempotent and do not change money or original purchases",
      async () => {
        const u = await buy();
        const journal = await db.query(
          "SELECT * FROM journal_line ORDER BY id",
        );
        const original = await doc(u.purchase_id),
          key = randomUUID();
        const data = editData(u, {
          variant: "USA",
          imei: "860000000009999",
          storage: "256",
          color: "Black",
        });
        const changed = await cmd("stockEdit", data, key, staff.token);
        assert.equal(
          (await cmd("stockEdit", data, key, staff.token)).id,
          changed.id,
        );
        const next = (await state()).units.find((x: any) => x.id === u.id);
        assert.equal(next.variant, "USA");
        assert.equal(next.imei, data.imei);
        assert.equal(next.revision, 1);
        assert.deepEqual(
          await db.query("SELECT * FROM journal_line ORDER BY id"),
          journal,
        );
        assert.deepEqual(await doc(u.purchase_id), original);
        const change = await doc(changed.id);
        assert.equal(change.snapshot.before.variant, "Japan");
        assert.equal(change.snapshot.after.variant, "USA");
        assert.equal(
          (await send("stockEdit", data, randomUUID(), staff.token)).body.code,
          "STOCK_CHANGED",
        );
        assert.equal(
          (await send("stockEdit", { ...data, cost: "1" })).status,
          400,
        );
        const duplicate = editData(next, { imei: old.imei });
        assert.equal((await send("stockEdit", duplicate)).status, 409);
        assert.equal(
          (await state()).units.find((x: any) => x.id === u.id).revision,
          1,
        );
        const sale = await cmd("sale", {
          unitId: u.id,
          price: "35000",
          cash: "35000",
          bank: "0",
        });
        const receipt = (await api("get", `/documents/${sale.id}/receipt`))
          .body;
        assert.equal(receipt.unit.variant, "USA");
        assert.equal(receipt.unit.imei, data.imei);
        assert.equal(
          (await send("stockEdit", editData(next))).body.code,
          "STOCK_CONFLICT",
        );
        assert.equal(
          (await send("purchaseReturn", returnData(next))).body.code,
          "STOCK_CONFLICT",
        );
        assert.equal(
          (
            await send("reversal", {
              documentId: changed.id,
              note: "No generic stock reversal",
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "a full paid return creates a supplier receivable without inventing cash or profit",
      async () => {
        const u = await buy(),
          before = await balance(),
          previous = await report(),
          key = randomUUID();
        const original = await doc(u.purchase_id);
        const d = await cmd("purchaseReturn", returnData(u), key);
        assert.equal(
          (await cmd("purchaseReturn", returnData(u), key)).id,
          d.id,
        );
        assert.equal((await send("purchaseReturn", returnData(u))).status, 409);
        const after = await balance(),
          r = await report();
        assert.equal(after.cash, before.cash);
        assert.equal(after.bank, before.bank);
        assert.equal(
          minor(after.inventory),
          minor(before.inventory) - 3200000n,
        );
        assert.equal(
          minor(after.supplierReceivable),
          minor(before.supplierReceivable) + 3200000n,
        );
        assert.equal(after.receivable, before.receivable);
        assert.equal(r.netProfit, previous.netProfit);
        assert.equal((await doc(d.id)).due, "32000.00");
        assert.equal(
          (await state()).units.find((x: any) => x.id === u.id).status,
          "RETURNED",
        );
        assert.deepEqual(await doc(u.purchase_id), original);
        assert.ok(
          !choices(
            forms.sale.find((f) => f.key === "unitId")!,
            await state(),
            "en",
          ).some((o) => o.value === u.id),
        );
        assert.equal(
          (
            await send("sale", {
              unitId: u.id,
              price: "35000",
              cash: "35000",
              bank: "0",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await send("reversal", {
              documentId: d.id,
              note: "Cannot erase an accepted return",
            })
          ).status,
          409,
        );
        const collectKey = randomUUID();
        const collected = await cmd(
          "supplierRefund",
          { documentId: d.id, amount: "10000", account: "cash" },
          collectKey,
        );
        assert.equal(
          (
            await cmd(
              "supplierRefund",
              { documentId: d.id, amount: "10000", account: "cash" },
              collectKey,
            )
          ).id,
          collected.id,
        );
        assert.equal((await doc(d.id)).due, "22000.00");
        assert.equal(
          minor((await balance()).cash),
          minor(before.cash) + 1000000n,
        );
        assert.equal(
          (
            await send("supplierRefund", {
              documentId: d.id,
              amount: "22000.01",
              account: "bank",
            })
          ).body.code,
          "DUE_EXCEEDED",
        );
        await cmd("supplierRefund", {
          documentId: d.id,
          amount: "22000",
          account: "bank",
        });
        assert.equal((await doc(d.id)).due, "0.00");
        assert.equal(
          minor((await balance()).bank),
          minor(before.bank) + 2200000n,
        );
        assert.equal((await report()).netProfit, previous.netProfit);
        await cmd("reversal", {
          documentId: collected.id,
          note: "Refund entry used wrong account",
        });
        assert.equal((await doc(d.id)).due, "10000.00");
        await cmd("supplierRefund", {
          documentId: d.id,
          amount: "10000",
          account: "bank",
        });
        assert.equal((await doc(d.id)).due, "0.00");
      },
    );
    await t.test(
      "part paid purchases, later supplier payments and deductions reconcile to the actual refund",
      async () => {
        const u = await buy("32000", "20000");
        const payment = await cmd("supplierPayment", {
          documentId: u.purchase_id,
          amount: "5000",
          account: "cash",
        });
        const before = await balance(),
          previous = await report();
        const ret = await cmd("purchaseReturn", returnData(u, "30000"));
        const d = await doc(ret.id);
        assert.equal(d.due, "23000.00");
        assert.equal(d.snapshot.returnOffset, "7000.00");
        assert.equal(d.snapshot.returnLoss, "2000.00");
        assert.equal((await doc(u.purchase_id)).due, "0.00");
        assert.equal((await balance()).cash, before.cash);
        assert.equal(
          minor((await balance()).payable),
          minor(before.payable) - 700000n,
        );
        assert.equal(
          minor((await report()).netProfit),
          minor(previous.netProfit) - 200000n,
        );
        assert.equal(
          (
            await send("reversal", {
              documentId: payment.id,
              note: "Would invalidate closed purchase refund",
            })
          ).status,
          409,
        );
        assert.equal(
          correctableDocument(await doc(payment.id), await state()),
          false,
        );
        assert.equal(
          (
            await send("supplierPayment", {
              documentId: u.purchase_id,
              amount: "1",
              account: "cash",
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "unpaid and zero-credit returns keep real liabilities, with no impossible refund",
      async () => {
        const u = await buy("100", "0");
        const before = await balance();
        const d = await cmd("purchaseReturn", returnData(u, "100"));
        assert.equal((await doc(d.id)).due, "0.00");
        assert.equal((await doc(u.purchase_id)).due, "0.00");
        assert.equal(
          (await balance()).supplierReceivable,
          before.supplierReceivable,
        );
        assert.equal((await balance()).cash, before.cash);
        const cut = await buy("100", "0");
        const cutReturn = await cmd("purchaseReturn", returnData(cut, "80"));
        assert.equal((await doc(cutReturn.id)).due, "0.00");
        assert.equal((await doc(cut.purchase_id)).due, "20.00");
        const postReturnPayment = await cmd("supplierPayment", {
          documentId: cut.purchase_id,
          amount: "20",
          account: "cash",
        });
        await cmd("reversal", {
          documentId: postReturnPayment.id,
          note: "Correct a payment entered after the return",
        });
        assert.equal((await doc(cut.purchase_id)).due, "20.00");
        const zero = await buy("100", "100");
        const loss = await cmd("purchaseReturn", returnData(zero, "0"));
        assert.equal((await doc(loss.id)).snapshot.returnLoss, "100.00");
      },
    );
    await t.test(
      "courier costs are expensed exactly once and invalid values cannot post",
      async () => {
        for (const treatment of ["capitalize", "expense"]) {
          const u = await buy("100", "100", "5", treatment),
            previous = await report();
          assert.equal(
            (await send("purchaseReturn", returnData(u, "100.01"))).body.code,
            "RETURN_VALUE_INVALID",
          );
          const d = await cmd("purchaseReturn", returnData(u, "100"));
          assert.equal(
            (await doc(d.id)).snapshot.returnLoss,
            treatment === "capitalize" ? "5.00" : "0.00",
          );
          assert.equal(
            minor((await report()).expense) - minor(previous.expense),
            treatment === "capitalize" ? 500n : 0n,
          );
        }
        const body = (await api("get", "/reports/export?period=today&lang=bn"))
          .text;
        assert.ok(body.includes("Supplier-এর কাছে ফেরত পাওনা"));
        assert.ok(body.includes("Supplier-কে পণ্য ফেরত"));
      },
    );
    await t.test(
      "simultaneous return/sale and over-collection never double-post",
      async () => {
        const u = await buy("100", "100");
        const results = await Promise.all([
          send("purchaseReturn", returnData(u, "100")),
          send("sale", { unitId: u.id, price: "110", cash: "110", bank: "0" }),
        ]);
        assert.deepEqual(results.map((r: any) => r.status).sort(), [201, 409]);
        const another = await buy("100", "100");
        const returned = await cmd(
          "purchaseReturn",
          returnData(another, "100"),
        );
        const refunds = await Promise.all([
          send("supplierRefund", {
            documentId: returned.id,
            amount: "60",
            account: "cash",
          }),
          send("supplierRefund", {
            documentId: returned.id,
            amount: "60",
            account: "bank",
          }),
        ]);
        assert.deepEqual(refunds.map((r: any) => r.status).sort(), [201, 409]);
        assert.equal((await doc(returned.id)).due, "40.00");
      },
    );
    await t.test(
      "a failed journal insert rolls back return, due allocations, movement and idempotency",
      async () => {
        const u = await buy("100", "25"),
          before = await balance(),
          original = await doc(u.purchase_id),
          key = randomUUID();
        const count = (await db.query("SELECT count(*) FROM document"))[0]
          .count;
        await db.query(
          "CREATE FUNCTION reject_refund_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.account='supplierReceivable' THEN RAISE EXCEPTION 'Synthetic test failure'; END IF; RETURN NEW; END $$",
        );
        await db.query(
          "CREATE TRIGGER reject_return BEFORE INSERT ON journal_line FOR EACH ROW EXECUTE FUNCTION reject_refund_line()",
        );
        try {
          assert.equal(
            (await send("purchaseReturn", returnData(u, "100"), key)).status,
            500,
          );
        } finally {
          await db.query("DROP TRIGGER reject_return ON journal_line");
          await db.query("DROP FUNCTION reject_refund_line()");
        }
        assert.equal(
          (await state()).units.find((x: any) => x.id === u.id).status,
          "IN_STOCK",
        );
        assert.deepEqual(await balance(), before);
        assert.deepEqual(await doc(u.purchase_id), original);
        assert.equal(
          (await db.query("SELECT count(*) FROM document"))[0].count,
          count,
        );
        assert.equal(
          (await api("get", "/commands/status/" + key)).body.found,
          false,
        );
        await cmd("purchaseReturn", returnData(u, "100"), key);
      },
    );
    await t.test(
      "Staff stays today-only and cannot use stock editing to rewrite money or historical invoices",
      async () => {
        // Explicit synthetic historical purchase in this disposable database only.
        const s = await state();
        const yesterday = new Date(s.today + "T00:00:00Z");
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const day = yesterday.toISOString().slice(0, 10),
          historical = randomUUID(),
          historicalUnit = randomUUID();
        await db.transaction(async (em: any) => {
          await em.query(
            "INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,original_due,snapshot,unit_id,party_id) VALUES($1,$2,'purchase',$3,'Historical fixture',$4,$5,10000,0,$6,$7,$8)",
            [
              historical,
              "HIST-" + historical,
              owner.user.id,
              day + "T06:00:00Z",
              day,
              { cost: "100", paid: "100", partyName: "Historical supplier" },
              historicalUnit,
              supplier,
            ],
          );
          await em.query(
            "INSERT INTO inventory_unit(id,internal_id,model,brand,variant,category,condition,imei,battery,box,cost,status,purchase_id) VALUES($1,$2,'Historical stock','QA','Japan','phone','used',$3,80,'with',10000,'IN_STOCK',$4)",
            [
              historicalUnit,
              "HIST-" + historicalUnit,
              String(serial++),
              historical,
            ],
          );
          await em.query(
            "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,1)",
            [historicalUnit, historical],
          );
          await em.query(
            "INSERT INTO journal_line(document_id,account,amount) VALUES($1,'inventory',10000),($1,'cash',-10000)",
            [historical],
          );
        });
        const u = (await state()).units.find(
          (x: any) => x.id === historicalUnit,
        );
        const staffState = await state(staff.token);
        assert.ok(
          !choices(forms.stockEdit[0], staffState, "en").some(
            (o) => o.value === u.id,
          ),
        );
        assert.equal(
          (await send("stockEdit", editData(u), randomUUID(), staff.token)).body
            .code,
          "STAFF_TODAY_ONLY",
        );
        assert.equal(
          (
            await send(
              "purchaseReturn",
              returnData(u, "100"),
              randomUUID(),
              staff.token,
            )
          ).body.code,
          "STAFF_TODAY_ONLY",
        );
        const historicalReturn = randomUUID();
        await db.transaction(async (em: any) => {
          await em.query(
            "INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,original_due,snapshot,unit_id,party_id) VALUES($1,$2,'purchaseReturn',$3,'Historical return fixture',$4,$5,10000,10000,$6,$7,$8)",
            [
              historicalReturn,
              "HIST-RETURN-" + historicalReturn,
              owner.user.id,
              day + "T07:00:00Z",
              day,
              {
                purchaseId: historical,
                returnValue: "100",
                note: "Accepted historical return",
                paymentIds: [],
              },
              historicalUnit,
              supplier,
            ],
          );
          await em.query(
            "UPDATE inventory_unit SET status='RETURNED',revision=revision+1 WHERE id=$1",
            [historicalUnit],
          );
          await em.query(
            "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,-1)",
            [historicalUnit, historicalReturn],
          );
          await em.query(
            "INSERT INTO journal_line(document_id,account,amount) VALUES($1,'inventory',-10000),($1,'supplierReceivable',10000)",
            [historicalReturn],
          );
        });
        assert.equal(
          (
            await send(
              "supplierRefund",
              { documentId: historicalReturn, amount: "50", account: "cash" },
              randomUUID(),
              staff.token,
            )
          ).body.code,
          "STAFF_TODAY_ONLY",
        );
        await cmd("supplierRefund", {
          documentId: historicalReturn,
          amount: "50",
          account: "cash",
        });
        assert.equal((await doc(historicalReturn)).due, "50.00");
        const past = (
          await api("get", `/reports?period=range&from=${day}&to=${day}`)
        ).body;
        assert.equal(
          past.documents.find((d: any) => d.id === historicalReturn).due,
          "100.00",
        );
        assert.equal(past.closingSupplierRefund, "100.00");
        const current = await buy("100", "100");
        const st = await state(staff.token),
          raw = {
            ...unitFormValues("stockEdit", current),
            unitId: current.id,
            note: "Staff corrects today's IMEI",
          };
        assert.equal((prepareForm("stockEdit", raw, st) as any).revision, 0);
        const edited = await cmd(
          "stockEdit",
          prepareForm("stockEdit", raw, st),
          randomUUID(),
          staff.token,
        );
        assert.ok(edited.id);
        const now = (await state()).units.find((x: any) => x.id === current.id);
        const returned = await cmd(
          "purchaseReturn",
          returnData(now, "100"),
          randomUUID(),
          staff.token,
        );
        await cmd(
          "supplierRefund",
          { documentId: returned.id, amount: "100", account: "cash" },
          randomUUID(),
          staff.token,
        );
        assert.equal(
          (await request(http).post("/commands/stockEdit").send(editData(now)))
            .status,
          401,
        );
      },
    );
    const unbalanced = await db.query(
      "SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0",
    );
    assert.deepEqual(unbalanced, []);
    const receivable = (
      await db.query(
        "SELECT COALESCE(sum(original_due-COALESCE((SELECT sum(amount) FROM allocation WHERE target_id=d.id),0)),0) AS n FROM document d WHERE kind='purchaseReturn'",
      )
    )[0].n;
    assert.equal(
      minor((await balance()).supplierReceivable),
      BigInt(receivable),
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    assert.match(database, /^stock_[a-f0-9]{32}_test$/);
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
