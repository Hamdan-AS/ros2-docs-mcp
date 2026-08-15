import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanupSummary,
  DELETE_EXPIRED_USAGE_SQL,
  deleteExpiredUsage,
  type UsageCleanupDatabase,
} from "../usage-retention.js";

test("usage cleanup deletes only rows older than the 90-day boundary", async () => {
  const statements: string[] = [];
  const database: UsageCleanupDatabase = {
    async query(sql) {
      statements.push(sql);
      return { rowCount: 4 };
    },
  };

  assert.equal(await deleteExpiredUsage(database), 4);
  assert.deepEqual(statements, [DELETE_EXPIRED_USAGE_SQL]);
  assert.match(DELETE_EXPIRED_USAGE_SQL, /usage_date\s*<\s*CURRENT_DATE\s*-\s*INTERVAL '90 days'/);
  assert.doesNotMatch(DELETE_EXPIRED_USAGE_SQL, /RETURNING/i);
});

test("usage cleanup reports useful singular, plural, and empty counts", () => {
  assert.equal(cleanupSummary(0), "Deleted 0 usage rows older than 90 days.");
  assert.equal(cleanupSummary(1), "Deleted 1 usage row older than 90 days.");
  assert.equal(cleanupSummary(2), "Deleted 2 usage rows older than 90 days.");
});
