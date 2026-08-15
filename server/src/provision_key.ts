import { createHash, randomBytes } from "node:crypto";

import { pool } from "./db.js";

const [name, tier = "free"] = process.argv.slice(2);
if (!name) {
  console.error("Usage: npm run create:key -- <name> [tier]");
  process.exit(1);
}

const token = `r2d_${randomBytes(32).toString("base64url")}`;
const keyHash = createHash("sha256").update(token).digest("hex");

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query<{ id: number }>(
    "INSERT INTO users (name, tier) VALUES ($1, $2) RETURNING id",
    [name, tier]
  );
  await client.query(
    "INSERT INTO api_keys (user_id, key_hash) VALUES ($1, $2)",
    [rows[0].id, keyHash]
  );
  await client.query("COMMIT");
  console.log(token);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
}

await pool.end();
