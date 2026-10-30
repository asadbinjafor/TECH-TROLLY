import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import request from "supertest";

test("profile editing keeps identities, sessions, permissions and invoice history consistent", async (t) => {
  const source = process.env.TEST_DATABASE_URL;
  assert.ok(
    source && new URL(source).pathname.endsWith("_test"),
    "Use the explicitly isolated PostgreSQL test server",
  );
  const admin = new Client({ connectionString: source });
  await admin.connect();
  const database = "profile_" + randomUUID().replaceAll("-", "") + "_test";
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(source);
  url.pathname = "/" + database;
  process.env.DATABASE_URL = url.toString();
  process.env.DATABASE_SSL = "false";
  process.env.DATABASE_SSL_CA_BASE64 = "";
  process.env.WEB_ORIGIN = "http://localhost:3001";
  process.env.BOOTSTRAP_OWNER_EMAIL = "profile.owner@example.test";
  process.env.BOOTSTRAP_OWNER_PASSWORD = "profile-owner-password";
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
    const signIn = (identity: string, password: string) =>
      request(http)
        .post("/auth/login")
        .set("X-Native-Client", "1")
        .send({ identity, password });
    const login = async (identity: string, password: string) => {
      const r = await signIn(identity, password);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    let ownerPassword = "profile-owner-password",
      staffPassword = "profile-staff-password";
    let owner = await login("owner", ownerPassword),
      ownerToken = owner.token;
    const api = (
      method: string,
      path: string,
      body?: any,
      token = ownerToken,
    ) => {
      let r = (request(http) as any)
        [method](path)
        .set("Authorization", "Bearer " + token);
      return body === undefined ? r : r.send(body);
    };
    const created = await api("post", "/users", {
      name: "Original Staff",
      login: "profile.staff",
      email: "profile.staff@example.test",
      role: "STAFF",
      password: staffPassword,
    });
    assert.equal(created.status, 201);
    const staffId = created.body.id;
    let staff = await login("profile.staff", staffPassword),
      staffToken = staff.token;
    const command = async (kind: string, data: any, token = ownerToken) => {
      const r = await api("post", "/commands/" + kind, data, token).set(
        "Idempotency-Key",
        randomUUID(),
      );
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    await command("opening", { cash: "1000", bank: "0" });
    const supplier = (
      await api("post", "/parties", {
        name: "Profile test supplier",
        kind: "supplier",
      })
    ).body;
    const sell = async (token: string) => {
      const bought = await command("purchase", {
        model: "Profile test accessory",
        brand: "Test",
        category: "accessory",
        condition: "new",
        supplierId: supplier.id,
        cost: "10",
        procurement: "0",
        treatment: "capitalize",
        paid: "10",
        account: "cash",
        note: "",
      });
      const [{ id }] = await db.query(
        "SELECT id FROM inventory_unit WHERE purchase_id=$1",
        [bought.id],
      );
      return command(
        "sale",
        {
          unitId: id,
          price: "20",
          discount: "0",
          cash: "20",
          bank: "0",
          note: "",
        },
        token,
      );
    };
    const originalOwnerSale = await sell(ownerToken),
      originalStaffSale = await sell(staffToken);
    const originalDocuments = await db.query(
      "SELECT id,actor_name,snapshot FROM document ORDER BY id",
    );
    const originalJournal = await db.query(
      "SELECT * FROM journal_line ORDER BY id",
    );
    const profile = (
      name: string,
      login: string,
      email: string,
      currentPassword?: string,
    ) => ({
      name,
      login,
      email,
      ...(currentPassword === undefined ? {} : { currentPassword }),
    });

    await t.test(
      "both roles can rename themselves without losing sessions or changing history",
      async () => {
        assert.equal(
          (await request(http).patch("/auth/profile").send({})).status,
          401,
        );
        for (const [token, data, role] of [
          [
            ownerToken,
            profile("Renamed Owner", "owner", "profile.owner@example.test"),
            "OWNER",
          ],
          [
            staffToken,
            profile(
              "Renamed Staff",
              "profile.staff",
              "profile.staff@example.test",
            ),
            "STAFF",
          ],
        ] as const) {
          const r = await api("patch", "/auth/profile", data, token);
          assert.equal(r.status, 200);
          assert.equal(r.body.requiresLogin, false);
          assert.equal(r.body.user.name, data.name);
          assert.equal(r.body.user.role, role);
          assert.ok(!("password_hash" in r.body.user));
          assert.equal(
            (await api("get", "/auth/me", undefined, token)).status,
            200,
          );
          for (const extra of [
            { role: "OWNER" },
            { id: owner.user.id },
            { password: "unexpected-password" },
            { active: false },
          ])
            assert.equal(
              (
                await api(
                  "patch",
                  "/auth/profile",
                  { ...data, ...extra },
                  token,
                )
              ).status,
              400,
            );
        }
        assert.equal(
          (
            await api(
              "patch",
              "/users/" + owner.user.id,
              { name: "Escalation" },
              staffToken,
            )
          ).status,
          403,
        );
        for (const invalid of [
          { name: " " },
          { login: "bad login" },
          { email: "bad email" },
        ])
          assert.equal(
            (
              await api("patch", "/auth/profile", {
                ...profile("Name", "owner", "profile.owner@example.test"),
                ...invalid,
              })
            ).status,
            400,
          );
        assert.deepEqual(
          await db.query(
            "SELECT id,actor_name,snapshot FROM document ORDER BY id",
          ),
          originalDocuments,
        );
        assert.deepEqual(
          await db.query("SELECT * FROM journal_line ORDER BY id"),
          originalJournal,
        );
        assert.equal(
          (await api("get", `/documents/${originalOwnerSale.id}/receipt`)).body
            .seller.name,
          "Renamed Owner",
        );
        assert.equal(
          (await api("get", `/documents/${originalStaffSale.id}/receipt`)).body
            .seller.name,
          "Original Staff",
        );
      },
    );

    await t.test(
      "identity edits require the current password, remove old aliases and revoke every session",
      async () => {
        const changed = profile(
          "Renamed Staff",
          "changed.staff",
          "changed.staff@example.test",
        );
        assert.equal(
          (await api("patch", "/auth/profile", changed, staffToken)).body.code,
          "CURRENT_PASSWORD_REQUIRED",
        );
        assert.equal(
          (
            await api(
              "patch",
              "/auth/profile",
              { ...changed, currentPassword: "incorrect" },
              staffToken,
            )
          ).body.code,
          "CURRENT_PASSWORD_INVALID",
        );
        assert.equal(
          (
            await api(
              "patch",
              "/auth/profile",
              profile(
                "Must rollback",
                "owner",
                "changed.staff@example.test",
                staffPassword,
              ),
              staffToken,
            )
          ).status,
          409,
        );
        assert.equal(
          (await api("get", "/auth/me", undefined, staffToken)).body.name,
          "Renamed Staff",
        );
        const cookieLogin = await request(http)
          .post("/auth/login")
          .send({ identity: "profile.staff", password: staffPassword });
        const cookie = cookieLogin.headers["set-cookie"][0].split(";")[0];
        const edited = await request(http)
          .patch("/auth/profile")
          .set("Cookie", cookie)
          .set("Origin", "http://localhost:3001")
          .send({ ...changed, currentPassword: staffPassword });
        assert.equal(edited.status, 200);
        assert.equal(edited.body.requiresLogin, true);
        assert.match(edited.headers["set-cookie"][0], /tt_session=;/);
        assert.equal(
          (await api("get", "/auth/me", undefined, staffToken)).status,
          401,
        );
        assert.equal(
          (await request(http).get("/auth/me").set("Cookie", cookie)).status,
          401,
        );
        for (const identity of ["profile.staff", "profile.staff@example.test"])
          assert.equal((await signIn(identity, staffPassword)).status, 401);
        staff = await login("CHANGED.STAFF@example.test", staffPassword);
        staffToken = staff.token;
        const removed = await api(
          "patch",
          "/auth/profile",
          profile("Renamed Staff", "changed.staff", "", staffPassword),
          staffToken,
        );
        assert.equal(removed.status, 200);
        assert.equal(removed.body.user.email, null);
        assert.equal(
          (await signIn("changed.staff@example.test", staffPassword)).status,
          401,
        );
        staff = await login("changed.staff", staffPassword);
        staffToken = staff.token;
        const ownerEdit = await api(
          "patch",
          "/auth/profile",
          profile(
            "Renamed Owner",
            "changed.owner",
            "changed.owner@example.test",
            ownerPassword,
          ),
        );
        assert.equal(ownerEdit.status, 200);
        assert.equal(ownerEdit.body.requiresLogin, true);
        owner = await login("changed.owner", ownerPassword);
        ownerToken = owner.token;
        assert.equal((await signIn("owner", ownerPassword)).status, 401);
        await bootstrap();
        assert.equal(
          (await api("get", "/auth/me")).body.login,
          "changed.owner",
        );
      },
    );

    await t.test(
      "Owner administration preserves authorization, rejects collisions atomically and audits no secrets",
      async () => {
        const named = await api("patch", "/users/" + staffId, {
          name: "Admin renamed Staff",
        });
        assert.equal(named.status, 200);
        assert.equal(named.body.name, "Admin renamed Staff");
        assert.equal(
          (await api("get", "/auth/me", undefined, staffToken)).status,
          200,
        );
        assert.equal(
          (await api("patch", "/users/" + staffId, { login: "admin.staff" }))
            .body.code,
          "CURRENT_PASSWORD_REQUIRED",
        );
        assert.equal(
          (
            await api("patch", "/users/" + staffId, {
              login: "admin.staff",
              currentPassword: staffPassword,
            })
          ).body.code,
          "CURRENT_PASSWORD_INVALID",
        );
        assert.equal(
          (
            await api("patch", "/users/" + staffId, {
              login: "admin.staff",
              currentPassword: ownerPassword,
            })
          ).status,
          200,
        );
        assert.equal(
          (await api("get", "/auth/me", undefined, staffToken)).status,
          401,
        );
        staff = await login("admin.staff", staffPassword);
        staffToken = staff.token;
        assert.equal(
          (
            await api("patch", "/users/" + owner.user.id, {
              name: "Must rollback",
              role: "STAFF",
            })
          ).body.code,
          "LAST_OWNER",
        );
        assert.equal((await api("get", "/auth/me")).body.name, "Renamed Owner");
        const second = await api("post", "/users", {
          name: "Second Staff",
          login: "second.staff",
          role: "STAFF",
          password: "second-staff-password",
        });
        const races = await Promise.all(
          [staffId, second.body.id].map((id) =>
            api("patch", "/users/" + id, {
              login: "race.winner",
              currentPassword: ownerPassword,
            }),
          ),
        );
        assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM identity WHERE value='race.winner'",
            )
          )[0].count,
          "1",
        );
        const audit = JSON.stringify(
          await db.query("SELECT details FROM audit_event"),
        );
        for (const secret of [
          ownerPassword,
          staffPassword,
          "second-staff-password",
          "password_hash",
          "currentPassword",
        ])
          assert.ok(!audit.includes(secret));
      },
    );

    await t.test(
      "both roles retain password change and new invoices use their updated names",
      async () => {
        assert.deepEqual(
          await db.query(
            "SELECT id,actor_name,snapshot FROM document ORDER BY id",
          ),
          originalDocuments,
        );
        assert.deepEqual(
          await db.query("SELECT * FROM journal_line ORDER BY id"),
          originalJournal,
        );
        const currentStaff = (
          await db.query("SELECT login FROM app_user WHERE id=$1", [staffId])
        )[0];
        staff = await login(currentStaff.login, staffPassword);
        staffToken = staff.token;
        for (const account of ["owner", "staff"]) {
          const token = account === "owner" ? ownerToken : staffToken;
          const previous = account === "owner" ? ownerPassword : staffPassword,
            password = "new-" + previous;
          const r = await api(
            "post",
            "/auth/password",
            { currentPassword: previous, password },
            token,
          );
          assert.equal(r.status, 201);
          assert.equal(
            (await api("get", "/auth/me", undefined, token)).status,
            401,
          );
          const result = await login(
            account === "owner" ? "changed.owner" : currentStaff.login,
            password,
          );
          if (account === "owner") {
            ownerPassword = password;
            ownerToken = result.token;
          } else {
            staffPassword = password;
            staffToken = result.token;
          }
        }
        const futureOwner = await sell(ownerToken),
          futureStaff = await sell(staffToken);
        assert.equal(
          (await api("get", `/documents/${futureOwner.id}/receipt`)).body.seller
            .name,
          "Renamed Owner",
        );
        assert.equal(
          (await api("get", `/documents/${futureStaff.id}/receipt`)).body.seller
            .name,
          "Admin renamed Staff",
        );
        assert.equal(
          (await api("get", `/documents/${originalOwnerSale.id}/receipt`)).body
            .seller.name,
          "Renamed Owner",
        );
        assert.equal(
          (await api("get", `/documents/${originalStaffSale.id}/receipt`)).body
            .seller.name,
          "Original Staff",
        );
      },
    );
    await t.test(
      "legacy placeholder seller receipts resolve only that seller's profile without rewriting history",
      async () => {
        assert.equal(
          (await api("patch", `/users/${staffId}`, { name: "Staff" })).status,
          200,
        );
        const sale = await sell(staffToken);
        const missing = (await api("get", `/documents/${sale.id}/receipt`))
          .body;
        assert.equal(missing.seller.id, staffId);
        assert.equal(missing.seller.name, "");
        assert.equal(missing.seller.nameMissing, true);
        const journal = await db.query(
          "SELECT * FROM journal_line ORDER BY id",
        );
        assert.equal(
          (
            await api("patch", `/users/${staffId}`, {
              name: "Actual Legacy Seller",
            })
          ).status,
          200,
        );
        const resolved = (await api("get", `/documents/${sale.id}/receipt`))
          .body;
        assert.equal(resolved.seller.name, "Actual Legacy Seller");
        assert.equal(resolved.seller.nameMissing, false);
        assert.equal(
          (
            await db.query("SELECT actor_name FROM document WHERE id=$1", [
              sale.id,
            ])
          )[0].actor_name,
          "Staff",
        );
        assert.equal(
          (await api("get", `/documents/${originalStaffSale.id}/receipt`)).body
            .seller.name,
          "Original Staff",
        );
        assert.deepEqual(
          await db.query("SELECT * FROM journal_line ORDER BY id"),
          journal,
        );
      },
    );
  } finally {
    if (app) await app.close();
    if (db.isInitialized) await db.destroy();
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
