import { createHash, randomBytes } from "node:crypto";

import { pool } from "./db.js";

function newKey(): { token: string; hash: string } {
  const token = `r2d_${randomBytes(32).toString("base64url")}`;
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

function positiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

async function issue(name: string | undefined, tier = "free", limit?: string): Promise<void> {
  if (!name) throw new Error("Usage: key:issue -- <customer-name> [tier] [credit-limit]");
  const creditLimit = limit === undefined ? null : positiveInteger(limit, "credit-limit");
  const { token, hash } = newKey();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: number }>(
      "INSERT INTO users (name, tier, credit_limit) VALUES ($1, $2, $3) RETURNING id",
      [name, tier, creditLimit]
    );
    const key = await client.query<{ id: number }>(
      "INSERT INTO api_keys (user_id, key_hash) VALUES ($1, $2) RETURNING id",
      [user.rows[0].id, hash]
    );
    await client.query("COMMIT");
    console.error(`Issued key ${key.rows[0].id} for user ${user.rows[0].id}. The raw key is shown once:`);
    console.log(token);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function revoke(keyIdValue: string | undefined): Promise<void> {
  const keyId = positiveInteger(keyIdValue, "key-id");
  const result = await pool.query<{ user_id: number }>(
    "DELETE FROM api_keys WHERE id = $1 RETURNING user_id",
    [keyId]
  );
  if (result.rowCount !== 1) throw new Error(`Key ${keyId} was not found.`);
  console.log(`Revoked key ${keyId} for user ${result.rows[0].user_id}.`);
}

async function replace(keyIdValue: string | undefined): Promise<void> {
  const keyId = positiveInteger(keyIdValue, "key-id");
  const { token, hash } = newKey();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ user_id: number }>(
      "SELECT user_id FROM api_keys WHERE id = $1 FOR UPDATE",
      [keyId]
    );
    if (existing.rowCount !== 1) throw new Error(`Key ${keyId} was not found.`);
    await client.query("DELETE FROM api_keys WHERE id = $1", [keyId]);
    const replacement = await client.query<{ id: number }>(
      "INSERT INTO api_keys (user_id, key_hash) VALUES ($1, $2) RETURNING id",
      [existing.rows[0].user_id, hash]
    );
    await client.query("COMMIT");
    console.error(`Replaced key ${keyId} with key ${replacement.rows[0].id}. The raw key is shown once:`);
    console.log(token);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setLimit(userIdValue: string | undefined, limitValue: string | undefined): Promise<void> {
  const userId = positiveInteger(userIdValue, "user-id");
  const creditLimit = limitValue === "default" ? null : positiveInteger(limitValue, "credit-limit");
  const result = await pool.query(
    "UPDATE users SET credit_limit = $2 WHERE id = $1",
    [userId, creditLimit]
  );
  if (result.rowCount !== 1) throw new Error(`User ${userId} was not found.`);
  console.log(`User ${userId} credit limit set to ${creditLimit ?? "the service default"}.`);
}

async function list(userIdValue: string | undefined): Promise<void> {
  const params: number[] = [];
  let filter = "";
  if (userIdValue !== undefined) {
    params.push(positiveInteger(userIdValue, "user-id"));
    filter = "WHERE u.id = $1";
  }
  const result = await pool.query(
    `SELECT u.id AS user_id, u.name, u.tier, u.credit_limit,
            q.credits_used, q.cooldown_until,
            k.id AS key_id, k.created_at, k.last_used_at
       FROM users u
       LEFT JOIN api_quota_state q ON q.user_id = u.id
       LEFT JOIN api_keys k ON k.user_id = u.id
       ${filter}
      ORDER BY u.id, k.id`,
    params
  );
  console.log(JSON.stringify(result.rows, null, 2));
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "issue":
      await issue(args[0], args[1], args[2]);
      break;
    case "revoke":
      await revoke(args[0]);
      break;
    case "replace":
      await replace(args[0]);
      break;
    case "set-limit":
      await setLimit(args[0], args[1]);
      break;
    case "list":
      await list(args[0]);
      break;
    default:
      throw new Error("Usage: key_admin <issue|revoke|replace|set-limit|list> [arguments]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Key administration failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
