import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";

test("private state validators reauthorize, invalidate on every committed change and compress complete history", async () => {
  const source = process.env.TEST_DATABASE_URL!;
  assert.ok(source && new URL(source).pathname.endsWith("_test"));
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const name = "state_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(source);
  url.pathname = "/" + name;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "state@example.test",
    BOOTSTRAP_OWNER_PASSWORD: "0294",
  });
  const { migrate } = require("../dist/database/migrate"),
    { bootstrap } = require("../dist/auth/bootstrap"),
    { db } = require("../dist/database/database"),
    { createApp } = require("../dist/main");
  let app: any, early: any;
  try {
    await migrate();
    await bootstrap();
    app = await createApp();
    await app.init();
    const http = app.getHttpServer();
    const login = async (identity: string, password: string) => {
      const r = await request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({ identity, password });
      assert.equal(r.status, 201);
      return r.body;
    };
    const owner = await login("state@example.test", "0294");
    const state = (tag?: string, who = owner.token, encoding = "identity") => {
      const r = request(http)
        .get("/shop/state")
        .set("Authorization", "Bearer " + who)
        .set("Accept-Encoding", encoding);
      return tag ? r.set("If-None-Match", tag) : r;
    };
    const first = await state();
    assert.equal(first.status, 200);
    const tag = first.headers.etag;
    assert.match(tag, /^W\/"tt-state-[a-f0-9]{64}"$/);
    const same = await state(tag);
    assert.equal(same.status, 304);
    assert.equal(same.text, "");
    assert.equal(same.headers["cache-control"], "no-store");
    assert.equal(
      (await request(http).get("/shop/state").set("If-None-Match", tag)).status,
      401,
    );
    const staffCreate = await request(http)
      .post("/users")
      .set("Authorization", "Bearer " + owner.token)
      .send({
        name: "State staff",
        login: "state-staff",
        password: "0572",
        role: "STAFF",
      });
    assert.equal(staffCreate.status, 201);
    const staff = await login("state-staff", "0572");
    const other = await state(tag, staff.token);
    assert.equal(other.status, 200);
    assert.notEqual(other.headers.etag, tag);
    assert.equal(other.body.user.role, "STAFF");
    const updated = await state(tag);
    assert.equal(updated.status, 200);
    // Sequence numbers are allocated before commit. Max(id) alone misses this.
    early = db.createQueryRunner();
    await early.connect();
    await early.startTransaction();
    await early.query(
      "INSERT INTO party(id,name,kind) VALUES($1,'Late committed party','supplier')",
      [randomUUID()],
    );
    await early.query("INSERT INTO audit_event(action) VALUES('qa.late')");
    await db.query(
      "INSERT INTO party(id,name,kind) VALUES($1,'Earlier committed party','supplier')",
      [randomUUID()],
    );
    await db.query("INSERT INTO audit_event(action) VALUES('qa.earlier')");
    const beforeLate = await state();
    assert.ok(
      !beforeLate.body.parties.some(
        (p: any) => p.name === "Late committed party",
      ),
    );
    await early.commitTransaction();
    await early.release();
    early = null;
    const afterLate = await state(beforeLate.headers.etag);
    assert.equal(afterLate.status, 200);
    assert.ok(
      afterLate.body.parties.some(
        (p: any) => p.name === "Late committed party",
      ),
    );
    await db.query(
      "INSERT INTO party(id,name,phone,kind,address) SELECT gen_random_uuid(),'QA '||g||repeat('P',140),repeat('0',20),'supplier',repeat('A',300) FROM generate_series(1,100) g",
    );
    await db.query("INSERT INTO audit_event(action) VALUES('qa.contacts')");
    const plain = await state();
    const zipped = await state(undefined, owner.token, "gzip");
    assert.equal(zipped.status, 200);
    assert.equal(zipped.headers["content-encoding"], "gzip");
    assert.equal(zipped.body.parties.length, 102);
    assert.deepEqual(
      { ...zipped.body, now: null },
      { ...plain.body, now: null },
    );
    assert.ok(
      Number(zipped.headers["content-length"]) <
        Buffer.byteLength(JSON.stringify(plain.body)) / 3,
    );
    const beforeProfile = zipped.headers.etag;
    const profile = await request(http)
      .patch("/auth/profile")
      .set("Authorization", "Bearer " + owner.token)
      .send({
        name: "Updated state owner",
        login: owner.user.login,
        email: owner.user.email,
      });
    assert.equal(profile.status, 200);
    const freshUser = await state(beforeProfile);
    assert.equal(freshUser.status, 200);
    assert.equal(freshUser.body.user.name, "Updated state owner");
    const command = (kind: string, data: unknown, key = randomUUID()) =>
      request(http)
        .post("/commands/" + kind)
        .set("Authorization", "Bearer " + owner.token)
        .set("Idempotency-Key", key)
        .send(data);
    await command("opening", { cash: "100", bank: "0" }).expect(201);
    const opened = await state(freshUser.headers.etag);
    assert.equal(opened.status, 200);
    assert.equal(opened.body.balances.cash, "100.00");
    const key = randomUUID(),
      data = { amount: "25", account: "cash", note: "QA funding" };
    await command("contribution", data, key).expect(201);
    const funded = await state(opened.headers.etag);
    assert.equal(funded.status, 200);
    assert.equal(funded.body.balances.cash, "125.00");
    assert.equal(funded.body.report.netProfit, "0.00");
    await command("contribution", data, key).expect(201);
    assert.equal((await state(funded.headers.etag)).status, 304);
    await request(http)
      .post("/auth/logout")
      .set("Authorization", "Bearer " + owner.token)
      .expect(201);
    assert.equal((await state(funded.headers.etag)).status, 401);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM document"))[0].n,
      2,
    );
  } finally {
    if (early) {
      await early.rollbackTransaction();
      await early.release();
    }
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
