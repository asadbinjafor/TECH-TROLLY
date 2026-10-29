import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { types } from "pg";
// A business date is a calendar string, never a local-midnight Date converted through UTC.
types.setTypeParser(1082, (value) => value);
export const db = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  synchronize: false,
  logging: false,
  extra: { max: 10, connectionTimeoutMillis: 5000 },
});
export async function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  if (!db.isInitialized) await db.initialize();
  return db;
}
