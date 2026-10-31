import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";
import bcrypt from "bcrypt";
import {
  newPassword,
  loginSchema,
  passwordSchema,
  userSchema,
  userUpdateSchema,
} from "@tech-trolley/contracts";

test("new passwords are exactly four ASCII digits, including leading zeroes", () => {
  for (const password of ["0000", "0123", "1234", "9999"]) {
    assert.equal(newPassword.parse(password), password);
    assert.equal(
      passwordSchema.parse({ currentPassword: "legacy-password", password })
        .password,
      password,
    );
    assert.equal(
      userSchema.parse({ name: "Test", login: "test", role: "STAFF", password })
        .password,
      password,
    );
    assert.equal(userUpdateSchema.parse({ password }).password, password);
  }
  for (const password of [
    "",
    "123",
    "12345",
    "abcd",
    "12a4",
    "12 4",
    " 1234",
    "1234 ",
    "1234\n",
    "১২৩৪",
    "１２３４",
    1234,
    null,
  ]) {
    assert.equal(
      newPassword.safeParse(password).success,
      false,
      JSON.stringify(password),
    );
    assert.equal(userUpdateSchema.safeParse({ password }).success, false);
  }
  assert.ok(
    loginSchema.safeParse({ identity: "owner", password: "legacy-password" })
      .success,
  );
});

test("four-digit credentials preserve existing access, revoke sessions and throttle account-wide", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  assert.ok(
    source && new URL(source).pathname.endsWith("_test"),
    "Explicit isolated test PostgreSQL required",
  );
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const name = "password_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(source);
  url.pathname = "/" + name;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: "false",
    DATABASE_SSL_CA_BASE64: "",
    BOOTSTRAP_OWNER_EMAIL: "pin.owner@example.test",
    BOOTSTRAP_OWNER_PASSWORD: "1023",
    WEB_ORIGIN: "http://localhost:3001",
  });
  const { db } = require("../dist/database/database"),
    { migrate } = require("../dist/database/migrate"),
    { bootstrap } = require("../dist/auth/bootstrap"),
    { createApp } = require("../dist/main"),
    { AuthService } = require("../dist/auth/auth.service"),
    { passwordAttemptKey } = require("../dist/auth/password-check");
  let app: any;
  try {
    await migrate();
    await bootstrap();
    const [original] = await db.query(
      "SELECT * FROM app_user WHERE login='owner'",
    );
    const legacy = "existing-owner-password";
    const oldHash = await bcrypt.hash(legacy, 12);
    // Simulate an existing installation only inside this newly created database.
    await db.query("UPDATE app_user SET password_hash=$2 WHERE id=$1", [
      original.id,
      oldHash,
    ]);
    app = await createApp();
    await app.init();
    const http = app.getHttpServer();
    const login = (identity: string, password: string) =>
      request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({ identity, password });
    const call = (token: string, method: string, path: string, body?: any) =>
      (request(http) as any)
        [method](path)
        .set("Authorization", "Bearer " + token)
        .send(body);
    let owner: any, staff: any;
    await t.test(
      "legacy passwords still login, verify and authorize identity changes; bootstrap never overwrites them",
      async () => {
        await bootstrap();
        assert.equal(
          (
            await db.query("SELECT password_hash FROM app_user WHERE id=$1", [
              original.id,
            ])
          )[0].password_hash,
          oldHash,
        );
        const r = await login("owner", legacy);
        assert.equal(r.status, 201);
        owner = r.body;
        assert.equal(
          (
            await call(owner.token, "post", "/auth/verify-password", {
              password: legacy,
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await call(owner.token, "patch", "/auth/profile", {
              name: "Owner",
              login: "pin.owner",
              email: "pin.owner@example.test",
              currentPassword: legacy,
            })
          ).status,
          200,
        );
        owner = (await login("pin.owner@example.test", legacy)).body;
      },
    );
    await t.test(
      "invalid new passwords cannot change hashes, create accounts or invalidate sessions",
      async () => {
        for (const password of [
          "123",
          "12345",
          "abcd",
          "12 4",
          "1234\n",
          "১২৩৪",
          1234,
        ]) {
          for (const [method, path, body] of [
            ["post", "/auth/password", { currentPassword: legacy, password }],
            [
              "post",
              "/users",
              { name: "Invalid", login: "invalid", role: "STAFF", password },
            ],
            ["patch", "/users/" + original.id, { password }],
          ] as const) {
            const r = await call(owner.token, method, path, body);
            assert.equal(r.status, 400);
            assert.ok(r.body.details.some((d: any) => d.field === "password"));
            if (typeof password === "string")
              assert.ok(
                r.body.details.some((d: any) => d.code === "PASSWORD_FORMAT"),
              );
          }
        }
        assert.equal(
          (
            await db.query("SELECT password_hash FROM app_user WHERE id=$1", [
              original.id,
            ])
          )[0].password_hash,
          oldHash,
        );
        assert.equal(
          (await db.query("SELECT count(*) FROM app_user"))[0].count,
          "1",
        );
        assert.equal((await call(owner.token, "get", "/auth/me")).status, 200);
      },
    );
    await t.test(
      "Owner changes to 0123 without losing its leading zero and every old session is revoked",
      async () => {
        const second = (await login("pin.owner", legacy)).body;
        assert.equal(
          (
            await call(owner.token, "post", "/auth/password", {
              currentPassword: legacy,
              password: "0123",
            })
          ).status,
          201,
        );
        for (const token of [owner.token, second.token])
          assert.equal((await call(token, "get", "/auth/me")).status, 401);
        assert.equal((await login("pin.owner", legacy)).status, 401);
        assert.equal((await login("pin.owner", "123")).status, 401);
        const r = await login("pin.owner", "0123");
        assert.equal(r.status, 201);
        owner = r.body;
        const [saved] = await db.query(
          "SELECT password_hash FROM app_user WHERE id=$1",
          [original.id],
        );
        assert.ok(await bcrypt.compare("0123", saved.password_hash));
        assert.equal(await bcrypt.compare("123", saved.password_hash), false);
      },
    );
    await t.test(
      "Staff creation, self-change and Owner reset follow the same rule and revoke prior sessions",
      async () => {
        const r = await call(owner.token, "post", "/users", {
          name: "Pin Staff",
          login: "pin.staff",
          role: "STAFF",
          password: "0234",
        });
        assert.equal(r.status, 201);
        staff = (await login("pin.staff", "0234")).body;
        assert.equal(
          (
            await call(staff.token, "post", "/auth/password", {
              currentPassword: "0234",
              password: "0345",
            })
          ).status,
          201,
        );
        assert.equal((await call(staff.token, "get", "/auth/me")).status, 401);
        staff = (await login("pin.staff", "0345")).body;
        assert.equal(
          (
            await call(owner.token, "patch", "/users/" + staff.user.id, {
              password: "0456",
            })
          ).status,
          200,
        );
        assert.equal((await call(staff.token, "get", "/auth/me")).status, 401);
        assert.equal((await login("pin.staff", "0345")).status, 401);
        const next = await login("pin.staff", "0456");
        assert.equal(next.status, 201);
        staff = next.body;
      },
    );
    await t.test(
      "aliases, IP changes, sessions and current-password endpoints cannot bypass five failed guesses",
      async () => {
        const auth = app.get(AuthService);
        for (let i = 0; i < 3; i++)
          await assert.rejects(
            auth.login(
              i % 2 ? "PIN.OWNER@example.test" : "pin.owner",
              "9999",
              "198.51.100." + i,
            ),
            (e: any) => e.getStatus() === 401,
          );
        assert.equal(
          (
            await call(owner.token, "post", "/auth/password", {
              currentPassword: "9999",
              password: "1111",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await call(owner.token, "patch", "/auth/profile", {
              name: "Owner",
              login: "pin.owner",
              currentPassword: "9999",
            })
          ).status,
          400,
        );
        for (const [path, body] of [
          ["/auth/verify-password", { password: "0123" }],
          ["/auth/password", { currentPassword: "0123", password: "1111" }],
        ] as const)
          assert.equal(
            (await call(owner.token, "post", path, body)).status,
            429,
          );
        await assert.rejects(
          auth.login("pin.owner@example.test", "0123", "203.0.113.1"),
          (e: any) => e.getStatus() === 429,
        );
        assert.equal(
          (
            await call(staff.token, "post", "/auth/verify-password", {
              password: "0456",
            })
          ).status,
          201,
        );
        // Advance only this owned isolated fixture's window, never a live counter.
        await db.query(
          "UPDATE auth_attempt SET reset_at=now()-interval '1 second' WHERE key=$1",
          [passwordAttemptKey(original.id)],
        );
        assert.equal(
          (
            await call(owner.token, "post", "/auth/verify-password", {
              password: "0123",
            })
          ).status,
          201,
        );
      },
    );
    await t.test(
      "atomic persisted limits bound parallel guesses and success resets the window",
      async () => {
        const auth = app.get(AuthService);
        const attempts = await Promise.allSettled(
          Array.from({ length: 8 }, (_, i) =>
            auth.login("pin.owner", "9999", "203.0.113." + (10 + i)),
          ),
        );
        assert.equal(
          attempts.filter((r: any) => r.reason?.getStatus() === 401).length,
          5,
        );
        assert.equal(
          attempts.filter((r: any) => r.reason?.getStatus() === 429).length,
          3,
        );
        await db.query(
          "UPDATE auth_attempt SET reset_at=now()-interval '1 second' WHERE key=$1",
          [passwordAttemptKey(original.id)],
        );
        assert.equal(
          (
            await call(owner.token, "post", "/auth/verify-password", {
              password: "0123",
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await db.query("SELECT count(*) FROM auth_attempt WHERE key=$1", [
              passwordAttemptKey(original.id),
            ])
          )[0].count,
          "0",
        );
      },
    );
    await t.test(
      "no business records or plaintext credentials are written",
      async () => {
        for (const table of [
          "document",
          "journal_line",
          "inventory_unit",
          "allocation",
        ])
          assert.equal(
            (await db.query(`SELECT count(*) FROM ${table}`))[0].count,
            "0",
          );
        const audit = JSON.stringify(
          await db.query("SELECT * FROM audit_event"),
        );
        for (const secret of [legacy, "0123", "0234", "0345", "0456"])
          assert.ok(!audit.includes(secret));
      },
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    assert.match(name, /^password_[a-f0-9]{32}_test$/);
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
