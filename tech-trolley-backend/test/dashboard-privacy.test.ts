import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";

test("dashboard password verification is account-bound, throttled and leaves business data untouched", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  assert.ok(source && new URL(source).pathname.endsWith("_test"));
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const name = "privacy_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(source);
  url.pathname = "/" + name;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "privacy@example.test",
    BOOTSTRAP_OWNER_PASSWORD: "1023",
    WEB_ORIGIN: "http://localhost:3001",
  });
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
    const login = async (identity: string, password: string) => {
      const r = await request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({ identity, password });
      assert.equal(r.status, 201);
      return r.body;
    };
    const owner = await login("owner", "1023");
    const call = (token: string, password: string, extra = {}) =>
      request(http)
        .post("/auth/verify-password")
        .set("Authorization", "Bearer " + token)
        .send({ password, ...extra });
    const staffCreated = await request(http)
      .post("/users")
      .set("Authorization", "Bearer " + owner.token)
      .send({
        name: "Privacy staff",
        login: "privacy.staff",
        role: "STAFF",
        password: "2034",
      });
    assert.equal(staffCreated.status, 201);
    const staff = await login("privacy.staff", "2034");
    const rowsBefore = await db.query(
      "SELECT 'document' AS type,count(*)::int AS n FROM document UNION ALL SELECT 'journal',count(*)::int FROM journal_line UNION ALL SELECT 'allocation',count(*)::int FROM allocation",
    );
    const sessionsBefore = await db.query(
      "SELECT token_hash,user_id,expires_at,absolute_expires_at FROM session ORDER BY token_hash",
    );
    await t.test(
      "both roles must supply their own current password, never another account's",
      async () => {
        assert.equal(
          (
            await request(http)
              .post("/auth/verify-password")
              .send({ password: "1023" })
          ).status,
          401,
        );
        assert.equal((await call(owner.token, "2034")).status, 400);
        assert.equal((await call(staff.token, "1023")).status, 400);
        for (const [token, password] of [
          [owner.token, "1023"],
          [staff.token, "2034"],
        ]) {
          const r = await call(token, password);
          assert.equal(r.status, 201);
          assert.deepEqual(r.body, { ok: true, revealForSeconds: 60 });
          assert.equal(r.headers["set-cookie"], undefined);
        }
        assert.equal((await call(owner.token, "")).status, 400);
        assert.equal(
          (
            await call(owner.token, "1023", {
              userId: staff.user.id,
            })
          ).status,
          400,
        );
        assert.deepEqual(
          await db.query(
            "SELECT token_hash,user_id,expires_at,absolute_expires_at FROM session ORDER BY token_hash",
          ),
          sessionsBefore,
        );
      },
    );
    await t.test(
      "five failed attempts block login and reveal without blocking another user",
      async () => {
        for (let i = 0; i < 5; i++)
          assert.equal((await call(owner.token, "wrong-password")).status, 400);
        const another = owner; // The account limit also applies across endpoints.
        assert.equal((await call(another.token, "1023")).status, 429);
        assert.equal((await call(staff.token, "2034")).status, 201);
        const { digest } = require("../dist/auth/auth.service");
        // Only the explicitly owned isolated test database's auth window is advanced.
        await db.query(
          "UPDATE auth_attempt SET reset_at=now()-interval '1 second' WHERE key=$1",
          [digest("password-check:" + owner.user.id)],
        );
        assert.equal((await call(owner.token, "1023")).status, 201);
      },
    );
    await t.test(
      "password changes and logout revoke old verification sessions",
      async () => {
        const changed = await request(http)
          .post("/auth/password")
          .set("Authorization", "Bearer " + staff.token)
          .send({
            currentPassword: "2034",
            password: "3045",
          });
        assert.equal(changed.status, 201);
        assert.equal((await call(staff.token, "2034")).status, 401);
        const next = await login("privacy.staff", "3045");
        assert.equal((await call(next.token, "2034")).status, 400);
        assert.equal((await call(next.token, "3045")).status, 201);
        await request(http)
          .post("/auth/logout")
          .set("Authorization", "Bearer " + next.token);
        assert.equal((await call(next.token, "3045")).status, 401);
      },
    );
    await t.test(
      "verification never writes business records or changes role/date access",
      async () => {
        assert.deepEqual(
          await db.query(
            "SELECT 'document' AS type,count(*)::int AS n FROM document UNION ALL SELECT 'journal',count(*)::int FROM journal_line UNION ALL SELECT 'allocation',count(*)::int FROM allocation",
          ),
          rowsBefore,
        );
        assert.equal(
          (
            await request(http)
              .get("/reports?period=month")
              .set("Authorization", "Bearer " + staff.token)
          ).status,
          401,
        );
        const next = await login("privacy.staff", "3045");
        assert.equal(
          (
            await request(http)
              .get("/reports?period=month")
              .set("Authorization", "Bearer " + next.token)
          ).status,
          403,
        );
      },
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    assert.match(name, /^privacy_[a-f0-9]{32}_test$/);
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
