import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";

test("rotating unknown names and forged forwarding headers share a persisted network budget", async () => {
  const source = process.env.TEST_DATABASE_URL!;
  assert.ok(source && new URL(source).pathname.endsWith("_test"));
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const name = "authbudget_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(source);
  url.pathname = "/" + name;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "budget@example.test",
    BOOTSTRAP_OWNER_PASSWORD: "0294",
  });
  const { migrate } = require("../dist/database/migrate"),
    { bootstrap } = require("../dist/auth/bootstrap"),
    { db } = require("../dist/database/database"),
    { createApp } = require("../dist/main"),
    { loginSourceKey } = require("../dist/auth/resource-budget");
  let app: any;
  try {
    await migrate();
    await bootstrap();
    await db.query(
      "INSERT INTO auth_attempt(key,count,reset_at) VALUES('expired-qa',1,now()-interval '1 hour'),('live-qa',1,now()+interval '1 hour')",
    );
    app = await createApp();
    await app.init();
    const http = app.getHttpServer();
    const initial = await request(http)
      .post("/auth/login")
      .set("X-Native-Client", "1")
      .send({ identity: "budget@example.test", password: "0294" });
    assert.equal(initial.status, 201);
    assert.equal(
      (await db.query("SELECT 1 FROM auth_attempt WHERE key='expired-qa'"))
        .length,
      0,
    );
    assert.equal(
      (await db.query("SELECT 1 FROM auth_attempt WHERE key='live-qa'")).length,
      1,
    );
    const [sourceRow] = await db.query(
      "SELECT key FROM auth_attempt WHERE key=ANY($1::text[])",
      [[loginSourceKey("::ffff:127.0.0.1"), loginSourceKey("127.0.0.1")]],
    );
    assert.ok(sourceRow);
    await db.query(
      "UPDATE auth_attempt SET count=59,reset_at=now()+interval '1 minute' WHERE key=$1",
      [sourceRow.key],
    );
    const a = await request(http)
      .post("/auth/login")
      .set("X-Forwarded-For", "198.51.100.1")
      .send({ identity: "unknown-a@example.test", password: "9999" });
    const b = await request(http)
      .post("/auth/login")
      .set("X-Forwarded-For", "203.0.113.2")
      .send({ identity: "unknown-b@example.test", password: "9999" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 429);
    assert.equal(b.body.code, "RATE_LIMIT");
    // A new app lifetime does not reset the persisted limit.
    await app.close();
    app = await createApp();
    await app.init();
    assert.equal(
      (
        await request(app.getHttpServer())
          .post("/auth/login")
          .send({ identity: "unknown-c@example.test", password: "9999" })
      ).status,
      429,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM document"))[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM journal_line"))[0].n,
      0,
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});

test("password work is bounded and released after success and failure", async () => {
  const { withPasswordBudget } = require("../dist/auth/resource-budget");
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const running = Array.from({ length: 8 }, () =>
    withPasswordBudget(() => gate),
  );
  try {
    await assert.rejects(
      withPasswordBudget(async () => true),
      (e: any) => e.getStatus() === 429,
    );
  } finally {
    release();
    await Promise.all(running);
  }
  await assert.rejects(
    withPasswordBudget(async () => {
      throw new Error("qa");
    }),
  );
  assert.equal(await withPasswordBudget(async () => true), true);
});
