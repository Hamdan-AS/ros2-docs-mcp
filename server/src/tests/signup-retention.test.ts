import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteStaleSignups,
  DELETE_STALE_SIGNUPS_SQL,
  signupCleanupSummary,
  type SignupCleanupDatabase,
} from "../signup-retention.js";

test("signup cleanup preserves active bans and recently verified state", async () => {
  const statements: string[] = [];
  const database: SignupCleanupDatabase = {
    async query(sql) { statements.push(sql); return { rowCount: 3 }; },
  };
  assert.equal(await deleteStaleSignups(database), 3);
  assert.deepEqual(statements, [DELETE_STALE_SIGNUPS_SQL]);
  assert.match(DELETE_STALE_SIGNUPS_SQL, /verified_at IS NOT NULL[\s\S]*INTERVAL '7 days'/);
  assert.match(DELETE_STALE_SIGNUPS_SQL, /verified_at IS NULL[\s\S]*INTERVAL '24 hours'/);
  assert.match(DELETE_STALE_SIGNUPS_SQL, /banned_until IS NULL OR banned_until <= now\(\)/);
});

test("signup cleanup reports only aggregate counts", () => {
  assert.equal(signupCleanupSummary(0), "Deleted 0 stale signup rows.");
  assert.equal(signupCleanupSummary(1), "Deleted 1 stale signup row.");
});
