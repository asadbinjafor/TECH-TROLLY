import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";
import sharp from "sharp";
import { samplePurchase } from "./fixtures/purchase";

test(
  "private purchase photos preserve permissions, exact financial history and independent retry safety",
  { timeout: 120000 },
  async (t) => {
    const source = process.env.TEST_DATABASE_URL;
    if (!source || !new URL(source).pathname.endsWith("_test"))
      throw Error("Explicit isolated TEST_DATABASE_URL required");
    const admin = new Client({ connectionString: source });
    await admin.connect();
    const name =
      "purchase_images_" + randomUUID().replaceAll("-", "") + "_test";
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(source);
    url.pathname = "/" + name;
    process.env.DATABASE_URL = url.toString();
    process.env.DATABASE_SSL = "false";
    process.env.BOOTSTRAP_OWNER_EMAIL = "images.owner@example.test";
    process.env.BOOTSTRAP_OWNER_PASSWORD = "0824";
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
      const login = await request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({
          identity: process.env.BOOTSTRAP_OWNER_EMAIL,
          password: "0824",
        });
      assert.equal(login.status, 201);
      const owner = login.body.token;
      const api = (method: string, path: string, body?: any, token = owner) => {
        const r = (request(http) as any)
          [method](path)
          .set("Authorization", "Bearer " + token);
        return body === undefined ? r : r.send(body);
      };
      const cmd = async (kind: string, data: any) => {
        const r = await api("post", "/commands/" + kind, data).set(
          "Idempotency-Key",
          randomUUID(),
        );
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body;
      };
      await api("post", "/users", {
        name: "Photo Staff",
        login: "photostaff",
        role: "STAFF",
        password: "1935",
      });
      const staff = (
        await request(http)
          .post("/auth/login")
          .set("X-Native-Client", "1")
          .send({ identity: "photostaff", password: "1935" })
      ).body.token;
      const supplier = (
        await api("post", "/parties", {
          kind: "supplier",
          name: "Photo supplier",
        })
      ).body;
      await cmd("opening", { cash: "100000", bank: "50000" });
      const supplierPurchase = () =>
        cmd("purchase", {
          model: "Photo cable",
          brand: "QA",
          category: "accessory",
          condition: "new",
          imei: null,
          battery: null,
          box: "without",
          supplierId: supplier.id,
          cost: "1000",
          procurement: "0",
          treatment: "capitalize",
          paid: "500",
          account: "cash",
          storage: "",
          color: "",
          variant: "",
        });
      const a = await supplierPurchase(),
        b = await supplierPurchase();
      const individual = await cmd("individualPurchase", {
        ...samplePurchase.seller,
        ...samplePurchase.unit,
        phoneType: "iphone",
        cost: "60000",
        cash: "10000",
        bank: "0",
      });
      const before = (await api("get", "/shop/state")).body;
      const originals = await db.query(
        "SELECT id,snapshot,total,original_due FROM document ORDER BY id",
      );
      const journal = await db.query("SELECT * FROM journal_line ORDER BY id");
      const png = await sharp({
        create: { width: 1000, height: 600, channels: 3, background: "#fff" },
      })
        .png()
        .toBuffer();
      const upload = (
        id: string,
        purpose = "memo",
        token = owner,
        bytes = png,
      ) =>
        api(
          "post",
          `/purchases/files/${id}?purpose=${purpose}`,
          undefined,
          token,
        )
          .set("Content-Type", "image/png")
          .send(bytes);
      const link = (doc: string, ids: string[], token = owner) =>
        api("post", `/purchases/${doc}/attachments`, { ids }, token);
      const memo = randomUUID(),
        front = randomUUID(),
        back = randomUUID();
      await t.test(
        "authenticated uploads validate/re-encode content, strip metadata and cannot leak through public paths",
        async () => {
          assert.equal(
            (
              await request(http)
                .post(`/purchases/files/${memo}?purpose=memo`)
                .set("Content-Type", "image/png")
                .send(png)
            ).status,
            401,
          );
          assert.equal((await upload(memo)).status, 201);
          assert.equal((await upload(memo)).status, 201);
          assert.equal((await upload(memo, "nidFront")).status, 409);
          const jpeg = await api("get", `/purchases/files/${memo}`);
          assert.equal(jpeg.status, 200);
          assert.match(jpeg.headers["content-type"], /^image\/jpeg/);
          assert.match(jpeg.headers["cache-control"], /no-store/);
          assert.ok(Buffer.isBuffer(jpeg.body));
          assert.equal((await sharp(jpeg.body).metadata()).exif, undefined);
          assert.equal(
            (await request(http).get(`/purchases/files/${memo}`)).status,
            401,
          );
          assert.equal(
            (await api("get", `/purchases/files/${memo}`, undefined, staff))
              .status,
            404,
          );
          assert.equal(
            (
              await upload(
                randomUUID(),
                "memo",
                owner,
                Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
              )
            ).status,
            400,
          );
          assert.equal(
            (await upload(randomUUID(), "memo", owner, Buffer.alloc(524289)))
              .status,
            413,
          );
          assert.equal((await upload(randomUUID(), "other")).status, 400);
          assert.equal(
            (
              await api(
                "post",
                `/purchases/files/${randomUUID()}?purpose=memo`,
                { data: "base64" },
              )
            ).status,
            400,
          );
        },
      );
      await t.test(
        "each evidence type binds only to its purchase, with no partial association and no new financial posting",
        async () => {
          assert.equal((await upload(front, "nidFront")).status, 201);
          assert.equal((await upload(back, "nidBack")).status, 201);
          assert.equal((await link(a.id, [memo, front])).status, 400);
          assert.equal(
            (await api("get", `/purchases/${a.id}/attachments`)).body.images
              .length,
            0,
          );
          assert.equal((await link(individual.id, [memo])).status, 400);
          assert.equal((await link(a.id, [memo])).status, 201);
          assert.equal((await link(a.id, [memo])).status, 201);
          assert.equal((await link(individual.id, [front, back])).status, 201);
          const extra = randomUUID();
          await upload(extra, "nidFront");
          assert.equal((await link(individual.id, [extra])).status, 409);
          assert.equal(
            (await api("get", `/purchases/${individual.id}/attachments`)).body
              .images.length,
            2,
          );
          assert.equal(
            (await api("get", `/purchases/files/${front}?download=1`)).status,
            200,
          );
          assert.match(
            (await api("get", `/purchases/files/${front}?download=1`)).headers[
              "content-disposition"
            ],
            /^attachment;/,
          );
          assert.equal(
            (await api("get", `/purchases/files/${front}`, undefined, staff))
              .status,
            200,
          );
          assert.equal((await link(b.id, [front])).status, 400);
          assert.deepEqual(
            (await api("get", "/shop/state")).body.balances,
            before.balances,
          );
          assert.deepEqual(
            await db.query("SELECT * FROM journal_line ORDER BY id"),
            journal,
          );
        },
      );
      await t.test(
        "CSRF, Staff historical access and removed-photo history are enforced on every endpoint",
        async () => {
          const own = randomUUID();
          await upload(own, "memo", staff);
          assert.equal((await link(b.id, [own], staff)).status, 201);
          const old = randomUUID(),
            oldDate = "2026-01-01";
          await db.query(
            `INSERT INTO document(id,number,kind,business_date,created_at,actor_id,actor_name,total,original_due,snapshot) SELECT $1,'QA-OLD','purchase',$2,created_at,actor_id,actor_name,total,original_due,snapshot FROM document WHERE id=$3`,
            [old, oldDate, b.id],
          );
          const hidden = randomUUID();
          await upload(hidden);
          assert.equal((await link(old, [hidden])).status, 201);
          for (const path of [
            `/purchases/${old}/attachments`,
            `/purchases/files/${hidden}`,
          ])
            assert.equal(
              (await api("get", path, undefined, staff)).status,
              404,
            );
          assert.equal((await link(old, [own], staff)).status, 404);
          assert.equal(
            (
              await api(
                "post",
                `/purchases/${old}/attachments/${hidden}/remove`,
                {},
                staff,
              )
            ).status,
            404,
          );
          const webLogin = await request(http)
            .post("/auth/login")
            .send({
              identity: process.env.BOOTSTRAP_OWNER_EMAIL,
              password: "0824",
            });
          assert.equal(webLogin.status, 201);
          assert.ok(webLogin.headers["set-cookie"]);
          const cookie = webLogin.headers["set-cookie"][0].split(";")[0];
          assert.equal(
            (
              await request(http)
                .post(`/purchases/${a.id}/attachments`)
                .set("Cookie", cookie)
                .set("Origin", "https://untrusted.example")
                .send({ ids: [memo] })
            ).status,
            403,
          );
          assert.equal(
            (
              await api(
                "post",
                `/purchases/${a.id}/attachments/${memo}/remove`,
                {},
              )
            ).status,
            201,
          );
          assert.equal((await link(a.id, [memo])).status, 201); // lost response cannot restore removed evidence
          assert.ok(
            (await api("get", `/purchases/${a.id}/attachments`)).body.images[0]
              .removed_at,
          );
          assert.equal(
            (await api("get", `/purchases/files/${memo}`, undefined, staff))
              .status,
            404,
          );
          assert.equal(
            (await api("get", `/purchases/files/${memo}`)).status,
            200,
          );
          await db.query(
            `DELETE FROM purchase_image_link WHERE document_id=$1`,
            [old],
          );
          // Synthetic old document remains, excluded explicitly from the frozen-before comparison below.
        },
      );
      await t.test(
        "link failure rolls back audit/association; concurrent attempts cannot attach an image twice",
        async () => {
          const c = await supplierPurchase(),
            d = await supplierPurchase(),
            retry = randomUUID();
          await upload(retry);
          await db.query(
            `CREATE FUNCTION qa_fail_image_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='purchase.image.link' THEN RAISE EXCEPTION 'QA injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER qa_image_audit BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION qa_fail_image_audit()`,
          );
          assert.equal((await link(c.id, [retry])).status, 500);
          assert.equal(
            (await api("get", `/purchases/${c.id}/attachments`)).body.images
              .length,
            0,
          );
          await db.query(
            "DROP TRIGGER qa_image_audit ON audit_event;DROP FUNCTION qa_fail_image_audit()",
          );
          const results = await Promise.all([
            link(c.id, [retry]),
            link(d.id, [retry]),
          ]);
          assert.equal(results.filter((r) => r.status === 201).length, 1);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int n FROM purchase_image_link WHERE image_id=$1",
                [retry],
              )
            )[0].n,
            1,
          );
        },
      );
      await t.test(
        "original money/snapshots remain byte-equivalent and image tables retain RLS/no Data API grants",
        async () => {
          const state = (await api("get", "/shop/state")).body;
          assert.ok(!JSON.stringify(state).includes("nidFront"));
          assert.ok(!JSON.stringify(state).includes(front));
          for (const original of originals) {
            assert.deepEqual(
              (
                await db.query(
                  "SELECT id,snapshot,total,original_due FROM document WHERE id=$1",
                  [original.id],
                )
              )[0],
              original,
            );
          }
          assert.deepEqual(
            await db.query(
              "SELECT * FROM journal_line WHERE id<= $1 ORDER BY id",
              [journal.at(-1).id],
            ),
            journal,
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int n FROM pg_class WHERE relname IN ('purchase_image','purchase_image_link') AND relrowsecurity",
              )
            )[0].n,
            2,
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int n FROM information_schema.role_table_grants WHERE table_name IN ('purchase_image','purchase_image_link') AND grantee IN ('anon','authenticated','service_role','PUBLIC')",
              )
            )[0].n,
            0,
          );
          assert.ok(before.balances.cash);
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
