import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL or NEON_DATABASE_URL is required.");
  process.exit(1);
}

const migrations = [
  "20260812_worker_rate_limits.sql",
  "20260815_user_daily_limits.sql",
  "20260815_credit_cooldown.sql",
];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(scriptDir, "..", "..", "db", "migrations");
const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

try {
  for (const migration of migrations) {
    const sql = await readFile(path.join(migrationsDir, migration), "utf8");
    await pool.query(sql);
    console.log(`Applied ${migration}`);
  }
} finally {
  await pool.end();
}
