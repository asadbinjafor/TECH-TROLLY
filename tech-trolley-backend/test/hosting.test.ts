import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseOptions } from "../src/database/options";
test("Supabase TLS cannot be downgraded by a copied connection string", () => {
  assert.throws(
    () =>
      databaseOptions({
        DATABASE_URL: "not-a-valid-private-connection-string",
      }),
    /^Error: DATABASE_URL_INVALID$/,
  );
  const options = databaseOptions({
    DATABASE_URL:
      "postgresql://app:synthetic@db.example:5432/postgres?sslmode=require",
    DATABASE_SSL: "true",
    DATABASE_POOL_MAX: "5",
  });
  assert.ok(!options.url?.includes("sslmode"));
  assert.equal(options.extra.max, 5);
  assert.notEqual(options.ssl, false);
  assert.equal(options.ssl && options.ssl.rejectUnauthorized, true);
  assert.throws(
    () =>
      databaseOptions({
        DATABASE_URL: "postgresql://app@db.example/postgres?sslmode=require",
        DATABASE_SSL: "false",
      }),
    /DATABASE_SSL_REQUIRED/,
  );
  assert.throws(
    () => databaseOptions({ DATABASE_POOL_MAX: "0" }),
    /DATABASE_POOL_MAX_INVALID/,
  );
  assert.throws(
    () =>
      databaseOptions({
        DATABASE_SSL: "true",
        DATABASE_SSL_CA_BASE64: "not-a-certificate",
      }),
    /DATABASE_SSL_CA_INVALID/,
  );
  assert.equal(
    databaseOptions({
      DATABASE_URL: "postgresql://app@localhost/postgres",
      DATABASE_SSL: "false",
    }).ssl,
    false,
  );
});
