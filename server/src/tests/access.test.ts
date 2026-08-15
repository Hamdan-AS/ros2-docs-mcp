import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { bearerToken, consumeQuota, effectiveDailyLimit, hashApiKey, utcDay } from "../access.js";
import { formatSearchResults, searchDocsInputSchema } from "../mcp.js";
import type { ApiAccessRepository } from "../repository.js";
import { buildDocsSearchQuery } from "../search-query.js";

class FakeAccessRepository implements ApiAccessRepository {
  private readonly usage = new Map<string, number>();

  async findUserByKeyHash() {
    return undefined;
  }

  async markKeyUsed() {}

  async consumeDailyQuota(userId: number, day: string, limit: number) {
    const key = `${userId}:${day}`;
    const count = this.usage.get(key) ?? 0;
    if (count >= limit) return undefined;
    this.usage.set(key, count + 1);
    return count + 1;
  }
}

test("hashes API keys with SHA-256 and only accepts r2d bearer tokens", async () => {
  assert.equal(
    await hashApiKey("r2d_abcdefghijklmnopqrst"),
    "4ff5e80bf82e5bbff713d31f306b90534ae285aaff93406b6c28586800a32764"
  );
  assert.equal(bearerToken("Bearer r2d_abcdefghijklmnopqrst"), "r2d_abcdefghijklmnopqrst");
  assert.equal(bearerToken("Basic r2d_abcdefghijklmnopqrst"), undefined);
  assert.equal(bearerToken("Bearer not-a-project-key"), undefined);
});

test("quota increments atomically and resets by UTC date", async () => {
  const repository = new FakeAccessRepository();
  const firstDay = new Date("2026-08-12T23:59:59.000Z");
  assert.deepEqual(await consumeQuota(7, 2, repository, firstDay), { allowed: true, count: 1 });
  assert.deepEqual(await consumeQuota(7, 2, repository, firstDay), { allowed: true, count: 2 });
  assert.deepEqual(await consumeQuota(7, 2, repository, firstDay), { allowed: false });
  assert.deepEqual(await consumeQuota(7, 2, repository, new Date("2026-08-13T00:00:00.000Z")), { allowed: true, count: 1 });
  assert.equal(utcDay(firstDay), "2026-08-12");
});

test("per-user quota overrides are isolated and validated", () => {
  assert.equal(effectiveDailyLimit({ daily_limit: 2 }, 75), 2);
  assert.equal(effectiveDailyLimit({ daily_limit: null }, 75), 75);
  assert.equal(effectiveDailyLimit({ daily_limit: 0 }, 75), 75);
});

test("search input rejects invalid requests and reports no results clearly", () => {
  const schema = z.object(searchDocsInputSchema);
  assert.equal(schema.safeParse({ query: "  " }).success, false);
  assert.equal(schema.safeParse({ query: "tf2", limit: 21 }).success, false);
  assert.equal(schema.safeParse({ query: "tf2", distro: "foxy" }).success, false);
  assert.equal(schema.safeParse({ query: "tf2", distro: "jazzy", limit: 5 }).success, true);
  assert.equal(formatSearchResults([]), "No matches found.");
});

test("search query applies a distro filter only when requested", () => {
  const all = buildDocsSearchQuery("tf2", undefined, 5);
  assert.deepEqual(all.params, ["tf2", 5]);
  assert.equal(all.sql.includes("dc.distro = $3"), false);
  const jazzy = buildDocsSearchQuery("tf2", "jazzy", 5);
  assert.deepEqual(jazzy.params, ["tf2", 5, "jazzy"]);
  assert.equal(jazzy.sql.includes("AND dc.distro = $3"), true);
});
