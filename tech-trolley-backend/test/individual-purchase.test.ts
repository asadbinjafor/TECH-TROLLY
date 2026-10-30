import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";
import { minor } from "@tech-trolley/contracts";

test(
  "individual phone purchases preserve acquisition cycles, exact accounts, private identity and retry safety",
  { timeout: 120000 },
  async (t) => {
    const source = process.env.TEST_DATABASE_URL;
    if (!source || !new URL(source).pathname.endsWith("_test"))
      throw new Error(
        "Explicit isolated TEST_DATABASE_URL ending in _test required",
      );
    const admin = new Client({ connectionString: source });
    await admin.connect();
    const name = `individual_${randomUUID().replaceAll("-", "")}_test`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(source);
    url.pathname = "/" + name;
    process.env.DATABASE_URL = url.toString();
    process.env.DATABASE_SSL = "false";
    process.env.BOOTSTRAP_OWNER_EMAIL = "individual.owner@example.test";
    process.env.BOOTSTRAP_OWNER_PASSWORD = "individual-test-password";
    const { db } = require("../dist/database/database"),
      { migrate } = require("../dist/database/migrate"),
      { bootstrap } = require("../dist/auth/bootstrap"),
      { createApp } = require("../dist/main");
    let app: any;
    try {
      await migrate();
      await bootstrap();
      app = await createApp();
      await app.init();
      const http = app.getHttpServer();
      const signed = await request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({
          identity: process.env.BOOTSTRAP_OWNER_EMAIL,
          password: process.env.BOOTSTRAP_OWNER_PASSWORD,
        });
      assert.equal(signed.status, 201);
      const token = signed.body.token;
      const api = (
        method: string,
        path: string,
        body?: any,
        bearer = token,
      ) => {
        const r = (request(http) as any)
          [method](path)
          .set("Authorization", `Bearer ${bearer}`);
        return body === undefined ? r : r.send(body);
      };
      const post = (
        kind: string,
        data: any,
        key = randomUUID(),
        bearer = token,
      ) =>
        api("post", "/commands/" + kind, data, bearer).set(
          "Idempotency-Key",
          key,
        );
      const cmd = async (
        kind: string,
        data: any,
        key = randomUUID(),
        bearer = token,
      ) => {
        const r = await post(kind, data, key, bearer);
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body;
      };
      const state = async () => {
        const r = await api("get", "/shop/state");
        assert.equal(r.status, 200);
        return r.body;
      };
      await cmd("opening", { cash: "100000", bank: "100000" });
      const party = (
        await api("post", "/parties", {
          kind: "supplier",
          name: "Sample seller",
          phone: "01700000000",
          address: "",
        })
      ).body;
      const customer = (
        await api("post", "/parties", {
          kind: "customer",
          name: "Sample buyer",
          phone: "01800000000",
          address: "",
        })
      ).body;
      await t.test(
        "migration upgrades a populated earlier schema without changing its business records",
        async () => {
          const legacy = await cmd("purchase", {
            model: "Legacy migration fixture",
            brand: "QA",
            variant: "",
            category: "phone",
            condition: "used",
            imei: "860000000000000",
            supplierId: party.id,
            cost: "1",
            paid: "1",
            account: "cash",
            procurement: "0",
            treatment: "capitalize",
            note: "",
          });
          const fingerprints = async () => {
            const result: Record<string, string> = {};
            for (const table of [
              "document",
              "journal_line",
              "allocation",
              "inventory_movement",
              "inventory_unit",
            ]) {
              const [r] = await db.query(
                `SELECT md5(COALESCE(string_agg((to_jsonb(t)-'previous_unit_id')::text,'|' ORDER BY id),'')) AS hash FROM ${table} t`,
              );
              result[table] = r.hash;
            }
            return result;
          };
          const before = await fingerprints();
          assert.match(name, /^individual_[a-f0-9]{32}_test$/);
          assert.equal(
            (await db.query("SELECT count(*) FROM purchase_declaration"))[0]
              .count,
            "0",
          );
          // Only this freshly created, explicitly owned test database is rewound to
          // the previous additive schema. No app or production database is touched.
          await db.transaction(async (em: any) => {
            await em.query("DROP TABLE purchase_declaration");
            await em.query("DROP TABLE individual_seller_profile");
            await em.query("DROP INDEX inventory_one_active_imei");
            await em.query("DROP INDEX inventory_imei_history");
            await em.query(
              "ALTER TABLE inventory_unit DROP COLUMN previous_unit_id",
            );
            await em.query(
              "ALTER TABLE inventory_unit ADD CONSTRAINT inventory_unit_imei_key UNIQUE(imei)",
            );
            await em.query(
              "DELETE FROM schema_migration WHERE name='009_individual_phone_purchases.sql'",
            );
          });
          await migrate();
          assert.deepEqual(await fingerprints(), before);
          await cmd("reversal", {
            documentId: legacy.id,
            note: "Finish synthetic migration fixture",
          });
          const s = await state();
          assert.equal(s.balances.cash, "100000.00");
          assert.equal(s.balances.inventory, "0.00");
        },
      );
      const data = {
        supplierId: party.id,
        sellerName: "নমুনা বিক্রেতা",
        sellerPhone: "01700000000",
        fatherName: "Private Father QA",
        motherName: "Private Mother QA",
        presentAddress: "Private present address QA",
        permanentAddress: "Private permanent address QA",
        identityNumber: "PRIVATE-NID-QA-123",
        nomineeName: "Private Nominee QA",
        nomineePhone: "01900000000",
        model: "iPhone QA",
        brand: "Apple",
        storage: "128",
        color: "Blue",
        variant: "Japan",
        category: "phone",
        condition: "used",
        imei: "860000000000001",
        battery: 78,
        box: "with",
        accessories: "Cable",
        cost: "60000",
        cash: "40000",
        bank: "15000",
        note: "",
      };
      const key = randomUUID();
      let purchase: any, unit: any, sale: any, second: any, secondUnit: any;
      await t.test(
        "one split purchase posts once even with simultaneous identical retries",
        async () => {
          const both = await Promise.all([
            post("individualPurchase", data, key),
            post("individualPurchase", data, key),
          ]);
          assert.ok(
            both.every((r) => r.status === 201),
            JSON.stringify(both.map((r) => r.body)),
          );
          assert.equal(both[0].body.id, both[1].body.id);
          purchase = both[0].body;
          const s = await state();
          unit = s.units.find((u: any) => u.purchase_id === purchase.id);
          assert.equal(s.balances.cash, "60000.00");
          assert.equal(s.balances.bank, "85000.00");
          assert.equal(s.balances.inventory, "60000.00");
          assert.equal(s.balances.payable, "5000.00");
          assert.equal(s.balances.loan, "0.00");
          assert.equal(
            s.documents.find((d: any) => d.id === purchase.id).kind,
            "purchase",
          );
          assert.equal(unit.box, "with");
          assert.equal(
            (await db.query("SELECT count(*) FROM purchase_declaration"))[0]
              .count,
            "1",
          );
          assert.equal(
            (
              await post(
                "individualPurchase",
                { ...data, identityNumber: "changed" },
                key,
              )
            ).status,
            409,
          );
          const old = await api("get", "/commands/status/" + key);
          assert.equal(old.body.result.id, purchase.id);
        },
      );
      await t.test(
        "identity is restricted to explicit private reads, not ordinary state/contacts/reports",
        async () => {
          const s = await state(),
            serialized = JSON.stringify(s);
          for (const value of [
            data.identityNumber,
            data.fatherName,
            data.motherName,
            data.presentAddress,
            data.permanentAddress,
            data.nomineeName,
            data.nomineePhone,
          ])
            assert.ok(
              !serialized.includes(value),
              "Private identity leaked into state",
            );
          const declaration = await api(
            "get",
            `/purchases/${purchase.id}/declaration`,
          );
          assert.equal(declaration.status, 200);
          assert.equal(
            declaration.body.seller.identityNumber,
            data.identityNumber,
          );
          assert.equal(declaration.body.originalDue, "5000.00");
          assert.equal(
            (await api("get", `/purchases/sellers/${party.id}`)).body.seller
              .fatherName,
            data.fatherName,
          );
          assert.equal(
            (await request(http).get(`/purchases/${purchase.id}/declaration`))
              .status,
            401,
          );
          const csv = await api("get", "/reports/export?period=today&lang=bn");
          assert.equal(csv.status, 200);
          assert.ok(!csv.text.includes(data.identityNumber));
          assert.equal(
            (await api("get", `/documents/${purchase.id}/receipt`)).status,
            404,
          );
        },
      );
      await t.test(
        "missing identity/box, overpayment, duplicate stock and insufficient funds make no partial postings",
        async () => {
          const before = (await db.query("SELECT count(*) FROM document"))[0]
            .count;
          for (const field of [
            "sellerName",
            "sellerPhone",
            "fatherName",
            "motherName",
            "presentAddress",
            "permanentAddress",
            "identityNumber",
            "nomineeName",
            "nomineePhone",
            "box",
          ]) {
            const input: any = { ...data };
            delete input[field];
            assert.equal(
              (await post("individualPurchase", input)).status,
              400,
              field,
            );
          }
          assert.equal(
            (
              await post("individualPurchase", {
                ...data,
                imei: "860000000000002",
                cash: "60000.01",
                bank: "0",
              })
            ).status,
            400,
          );
          const duplicate = await post("individualPurchase", data);
          assert.equal(duplicate.status, 409);
          assert.equal(duplicate.body.code, "IMEI_IN_STOCK");
          const noFunds = await post("individualPurchase", {
            ...data,
            imei: "860000000000002",
            cost: "200000",
            cash: "200000",
            bank: "0",
            identityNumber: "DO-NOT-SAVE",
          });
          assert.equal(noFunds.status, 409);
          assert.equal(noFunds.body.code, "INSUFFICIENT_FUNDS");
          assert.equal(
            (await db.query("SELECT count(*) FROM document"))[0].count,
            before,
          );
          assert.equal(
            (await api("get", `/purchases/sellers/${party.id}`)).body.seller
              .identityNumber,
            data.identityNumber,
          );
        },
      );
      await t.test(
        "selling then repurchasing the same IMEI creates a new cost and box cycle without changing the old purchase",
        async () => {
          sale = await cmd("sale", {
            unitId: unit.id,
            price: "65000",
            discount: "0",
            cash: "65000",
            bank: "0",
            customerId: null,
            note: "",
          });
          second = await cmd("individualPurchase", {
            ...data,
            cost: "55000",
            cash: "55000",
            bank: "0",
            box: "without",
            identityNumber: "SECOND-PRIVATE-NID",
            fatherName: "Second father",
          });
          const s = await state();
          secondUnit = s.units.find((u: any) => u.purchase_id === second.id);
          assert.notEqual(secondUnit.id, unit.id);
          assert.equal(secondUnit.previous_unit_id, unit.id);
          assert.equal(secondUnit.cost, "55000.00");
          assert.equal(secondUnit.box, "without");
          assert.equal(
            s.units.find((u: any) => u.id === unit.id).cost,
            "60000.00",
          );
          assert.equal(s.units.find((u: any) => u.id === unit.id).box, "with");
          assert.equal(s.balances.cash, "70000.00");
          assert.equal(s.balances.bank, "85000.00");
          assert.equal(s.balances.inventory, "55000.00");
          assert.equal(s.balances.payable, "5000.00");
          assert.equal(s.report.grossProfit, "5000.00");
          assert.equal(
            (await api("get", `/purchases/${purchase.id}/declaration`)).body
              .seller.identityNumber,
            data.identityNumber,
          );
          const blocked = await post("reversal", {
            documentId: sale.id,
            note: "Cannot resurrect old cycle",
          });
          assert.equal(blocked.status, 409);
          assert.equal(blocked.body.code, "LATER_ACQUISITION");
        },
      );
      await t.test(
        "paying an older purchase due after buyback settles only that original purchase with no second expense",
        async () => {
          const paymentKey = randomUUID();
          await cmd(
            "supplierPayment",
            {
              documentId: purchase.id,
              amount: "5000",
              account: "bank",
              note: "",
            },
            paymentKey,
          );
          await cmd(
            "supplierPayment",
            {
              documentId: purchase.id,
              amount: "5000",
              account: "bank",
              note: "",
            },
            paymentKey,
          );
          const s = await state();
          assert.equal(s.balances.bank, "80000.00");
          assert.equal(s.balances.payable, "0.00");
          assert.equal(s.report.grossProfit, "5000.00");
          assert.equal(s.report.expense, "0.00");
          assert.equal(
            s.documents.find((d: any) => d.id === second.id).due,
            "0.00",
          );
          assert.equal(
            (await api("get", `/purchases/${purchase.id}/declaration`)).body
              .originalDue,
            "5000.00",
          );
          assert.equal(
            (
              await post("supplierPayment", {
                documentId: purchase.id,
                amount: "0.01",
                account: "cash",
                note: "",
              })
            ).status,
            409,
          );
        },
      );
      await t.test(
        "stock corrections retain signed facts; later sales use only the new cost",
        async () => {
          await cmd("stockEdit", {
            unitId: secondUnit.id,
            revision: 0,
            model: data.model,
            brand: data.brand,
            storage: data.storage,
            color: "Red",
            variant: data.variant,
            category: "phone",
            condition: "used",
            imei: data.imei,
            battery: 78,
            box: "with",
            note: "Correct box entry",
          });
          const original = await api(
            "get",
            `/purchases/${second.id}/declaration`,
          );
          assert.equal(original.body.unit.box, "without");
          assert.equal(original.body.unit.color, "Blue");
          await cmd("sale", {
            unitId: secondUnit.id,
            price: "58000",
            discount: "0",
            cash: "0",
            bank: "57000",
            customerId: customer.id,
            note: "",
          });
          const s = await state();
          assert.equal(s.report.grossProfit, "8000.00");
          assert.equal(s.balances.inventory, "0.00");
          assert.equal(s.balances.receivable, "1000.00");
          assert.equal(s.balances.bank, "137000.00");
          assert.equal(
            (
              await post("reversal", {
                documentId: sale.id,
                note: "Blocked after subsequent sale too",
              })
            ).body.code,
            "LATER_ACQUISITION",
          );
        },
      );
      await t.test(
        "ordinary supplier purchases can reacquire phones too; purchase returns keep other customer dues intact",
        async () => {
          const third = await cmd("purchase", {
            model: "Third cycle",
            brand: "QA",
            variant: "",
            category: "phone",
            condition: "used",
            imei: data.imei,
            supplierId: party.id,
            cost: "50000",
            procurement: "0",
            treatment: "capitalize",
            paid: "0",
            account: "cash",
            note: "",
          });
          let s = await state();
          const u = s.units.find((u: any) => u.purchase_id === third.id);
          assert.equal(u.previous_unit_id, secondUnit.id);
          assert.equal(s.balances.payable, "50000.00");
          assert.equal(s.balances.receivable, "1000.00");
          await cmd("purchaseReturn", {
            unitId: u.id,
            revision: 0,
            returnValue: "50000",
            note: "Supplier accepted faulty phone",
          });
          s = await state();
          assert.equal(s.balances.payable, "0.00");
          assert.equal(s.balances.inventory, "0.00");
          assert.equal(s.balances.receivable, "1000.00");
          assert.equal(s.report.grossProfit, "8000.00");
          assert.equal(s.balances.loan, "0.00");
          const fourth = await cmd("individualPurchase", {
            ...data,
            cost: "45000",
            cash: "45000",
            bank: "0",
            box: "without",
          });
          await cmd("reversal", {
            documentId: fourth.id,
            note: "Cancel newest purchase before activity",
          });
          s = await state();
          assert.equal(s.balances.cash, "70000.00");
          assert.equal(s.balances.inventory, "0.00");
          assert.equal(s.balances.bank, "137000.00");
          assert.equal(s.report.grossProfit, "8000.00");
        },
      );
      await t.test(
        "concurrent different keys cannot stock one IMEI twice and authoritative amounts keep exact cents",
        async () => {
          const input = {
            ...data,
            imei: "860000000000003",
            cost: "0.30",
            cash: "0.10",
            bank: "0.20",
          };
          const r = await Promise.all([
            post("individualPurchase", input),
            post("individualPurchase", input),
          ]);
          assert.deepEqual(r.map((r) => r.status).sort(), [201, 409]);
          const s = await state();
          assert.equal(s.balances.cash, "69999.90");
          assert.equal(s.balances.bank, "136999.80");
          assert.equal(s.balances.inventory, "0.30");
          assert.equal(
            (
              await db.query(
                "SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0",
              )
            ).length,
            0,
          );
          const [{ cost }] = await db.query(
            "SELECT COALESCE(sum(cost),0) AS cost FROM inventory_unit WHERE status='IN_STOCK'",
          );
          assert.equal(BigInt(cost), minor(s.balances.inventory));
        },
      );
      await t.test(
        "private history retains date authorization, original retry results, immutability and RLS",
        async () => {
          const staff = (
            await api("post", "/users", {
              name: "Rony QA",
              login: "individual.staff",
              email: "",
              role: "STAFF",
              password: "staff-qa-password",
            })
          ).body;
          assert.ok(staff.id);
          const login = await request(http)
            .post("/auth/login")
            .set("X-Native-Client", "1")
            .send({
              identity: "individual.staff",
              password: "staff-qa-password",
            });
          assert.equal(login.status, 201);
          assert.equal(
            (
              await api(
                "get",
                `/purchases/${purchase.id}/declaration`,
                undefined,
                login.body.token,
              )
            ).status,
            200,
          );
          // Explicit, owned synthetic fixture only: simulate yesterday without altering production.
          await db.transaction(async (em: any) => {
            await em.query(
              "ALTER TABLE document DISABLE TRIGGER document_immutable",
            );
            await em.query(
              "UPDATE document SET business_date=business_date-1 WHERE id=$1",
              [purchase.id],
            );
            await em.query(
              "ALTER TABLE document ENABLE TRIGGER document_immutable",
            );
            await em.query(
              "UPDATE individual_seller_profile SET updated_at=updated_at-interval '1 day' WHERE party_id=$1",
              [party.id],
            );
          });
          assert.equal(
            (
              await api(
                "get",
                `/purchases/${purchase.id}/declaration`,
                undefined,
                login.body.token,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await api(
                "get",
                `/purchases/${purchase.id}/pdf`,
                undefined,
                login.body.token,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await api(
                "get",
                `/purchases/sellers/${party.id}`,
                undefined,
                login.body.token,
              )
            ).body.seller,
            null,
          );
          assert.equal(
            (await api("get", `/purchases/${purchase.id}/declaration`)).status,
            200,
          );
          const staffPurchase = await cmd(
            "individualPurchase",
            {
              ...data,
              imei: "860000000000004",
              cost: "1",
              cash: "0",
              bank: "0",
            },
            randomUUID(),
            login.body.token,
          );
          const staffDeclaration = await api(
            "get",
            `/purchases/${staffPurchase.id}/declaration`,
            undefined,
            login.body.token,
          );
          assert.equal(staffDeclaration.status, 200);
          assert.deepEqual(staffDeclaration.body.buyer, {
            name: "Rony QA",
            role: "STAFF",
          });
          assert.equal(
            (
              await api(
                "get",
                `/purchases/${purchase.id}/declaration`,
                undefined,
                login.body.token,
              )
            ).status,
            404,
          );
          assert.equal(
            (await cmd("individualPurchase", data, key)).id,
            purchase.id,
          );
          await assert.rejects(
            db.query(
              "UPDATE purchase_declaration SET terms='changed' WHERE document_id=$1",
              [purchase.id],
            ),
          );
          await assert.rejects(
            db.query("DELETE FROM purchase_declaration WHERE document_id=$1", [
              purchase.id,
            ]),
          );
          const tables = await db.query(
            "SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('individual_seller_profile'::regclass,'purchase_declaration'::regclass)",
          );
          assert.ok(tables.every((r: any) => r.relrowsecurity));
          for (const role of ["anon", "authenticated", "service_role"])
            if (
              (
                await db.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
                  role,
                ])
              ).length
            )
              for (const table of [
                "individual_seller_profile",
                "purchase_declaration",
              ])
                assert.equal(
                  (
                    await db.query(
                      "SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') AS granted",
                      [role, table],
                    )
                  )[0].granted,
                  false,
                );
        },
      );
    } finally {
      await app?.close();
      if (db.isInitialized) await db.destroy();
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
        [name],
      );
      await admin.query(`DROP DATABASE "${name}"`);
      await admin.end();
    }
  },
);
