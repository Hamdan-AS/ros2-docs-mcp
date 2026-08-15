import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import pg from "pg";

const mcpUrlValue = process.env.MCP_URL;
const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!mcpUrlValue || !databaseUrl) {
  console.error("MCP_URL and DATABASE_URL (or NEON_DATABASE_URL) are required.");
  process.exit(1);
}

const mcpUrl = new URL(mcpUrlValue);
if (mcpUrl.protocol !== "https:" && process.env.ALLOW_INSECURE_MCP_URL !== "1") {
  throw new Error("MCP_URL must use HTTPS unless ALLOW_INSECURE_MCP_URL=1.");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
});
const testName = `quota-lifecycle-${Date.now()}`;
let userId;

function makeKey() {
  const token = `r2d_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

async function post(token, id, method, params = {}) {
  const headers = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": "2025-06-18",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
}

function initializeParams() {
  return {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "quota-lifecycle-live", version: "1.0.0" },
  };
}

try {
  const missing = await post(undefined, 1, "initialize", initializeParams());
  assert.equal(missing.status, 401, `missing key returned ${missing.status}`);

  const invalid = await post("r2d_abcdefghijklmnopqrstuvwxyz", 2, "initialize", initializeParams());
  assert.equal(invalid.status, 401, `invalid key returned ${invalid.status}`);

  const issued = makeKey();
  const user = await pool.query(
    "INSERT INTO users (name, tier, credit_limit) VALUES ($1, 'quota-test', 2) RETURNING id",
    [testName]
  );
  userId = user.rows[0].id;
  const key = await pool.query(
    "INSERT INTO api_keys (user_id, key_hash) VALUES ($1, $2) RETURNING id",
    [userId, issued.hash]
  );

  const first = await post(issued.token, 3, "initialize", initializeParams());
  assert.equal(first.status, 200, `first allowed request returned ${first.status}`);
  const second = await post(issued.token, 4, "tools/list");
  assert.equal(second.status, 200, `second allowed request returned ${second.status}`);
  const limited = await post(issued.token, 5, "tools/list");
  assert.equal(limited.status, 429, `over-limit request returned ${limited.status}`);
  const limitedBody = await limited.json();
  assert.match(limitedBody.error, /paused for 48 hours/);
  assert.ok(Date.parse(limitedBody.reset_at), "429 response omitted a valid reset_at");
  assert.ok(Number(limited.headers.get("retry-after")) > 0, "429 response omitted Retry-After");

  const usage = await pool.query(
    "SELECT credits_used, cooldown_until FROM api_quota_state WHERE user_id = $1",
    [userId]
  );
  assert.equal(usage.rows[0]?.credits_used, 2, "rejected request changed the credit counter");
  assert.ok(usage.rows[0]?.cooldown_until, "final credit did not start cooldown");

  await pool.query("DELETE FROM api_keys WHERE id = $1", [key.rows[0].id]);
  const revoked = await post(issued.token, 6, "initialize", initializeParams());
  assert.equal(revoked.status, 401, `revoked key returned ${revoked.status}`);

  await pool.query("DELETE FROM api_quota_state WHERE user_id = $1", [userId]);
  const replacement = makeKey();
  await pool.query("INSERT INTO api_keys (user_id, key_hash) VALUES ($1, $2)", [userId, replacement.hash]);
  const replaced = await post(replacement.token, 7, "initialize", initializeParams());
  assert.equal(replaced.status, 200, `replacement key returned ${replaced.status}`);

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    endpoint: mcpUrl.origin,
    client: "quota-lifecycle-live/1.0.0",
    missingKey401: "passed",
    invalidKey401: "passed",
    quota429AtLimit2: "passed",
    revokedKey401: "passed",
    replacementKey: "passed",
    rawKeysLogged: false,
  }));
} finally {
  if (userId !== undefined) {
    await pool.query("DELETE FROM users WHERE id = $1 AND name = $2", [userId, testName]);
  }
  await pool.end();
}
