import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { types } from "pg";
import { databaseOptions } from "./options";
// A business date is a calendar string, never a local-midnight Date converted through UTC.
types.setTypeParser(1082, (value) => value);
export const db = new DataSource({
  type: "postgres",
  ...databaseOptions(process.env),
  synchronize: false,
  logging: false,
});
export async function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  if (!db.isInitialized) await db.initialize();
  return db;
}
