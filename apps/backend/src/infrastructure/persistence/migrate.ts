import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const migrationName = "0001_core";
try {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [728310041]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS app_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = await client.query(
      "SELECT 1 FROM app_migrations WHERE name=$1",
      [migrationName],
    );
    if (applied.rowCount) {
      console.log("Database schema is up to date.");
    } else {
      const sql = await readFile(
        fileURLToPath(new URL("./migrations/0001_core.sql", import.meta.url)),
        "utf8",
      );
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO app_migrations(name) VALUES($1)", [
          migrationName,
        ]);
        await client.query("COMMIT");
        console.log("Database schema migrated.");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [728310041]);
    client.release();
  }
} finally {
  await pool.end();
}
