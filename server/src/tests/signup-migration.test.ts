import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../db/migrations/20260816_self_serve_signup.sql", import.meta.url);
const runnerUrl = new URL("../../scripts/apply-migrations.mjs", import.meta.url);

test("signup migration locks the required expiry, throttling, ban, and uniqueness policy", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /INTERVAL '10 minutes'/);
  assert.match(sql, /INTERVAL '60 seconds'/);
  assert.match(sql, /send_count >= 3/);
  assert.match(sql, /INTERVAL '2 hours'/);
  assert.match(sql, /failed_attempts >= 3/);
  assert.match(sql, /api_keys_one_active_per_user/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /api_quota_state/);
  assert.doesNotMatch(sql, /raw_otp|raw_key/i);
});

test("deployment migration runner includes self-serve signup", async () => {
  const runner = await readFile(runnerUrl, "utf8");
  assert.match(runner, /20260816_self_serve_signup\.sql/);
});
