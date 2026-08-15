import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

import { bearerToken, consumeQuota, effectiveCreditLimit, hashApiKey } from "../access.js";
import { buildServer, formatSearchResults, searchDocsInputSchema } from "../mcp.js";
import type { ApiAccessRepository } from "../repository.js";
import { buildDocsSearchQuery } from "../search-query.js";
import type { DocsRepository } from "../repository.js";

class FakeAccessRepository implements ApiAccessRepository {
  private readonly usage = new Map<number, { credits: number; cooldownUntil: number | null }>();
  now = new Date("2026-08-12T12:00:00.000Z");

  async findUserByKeyHash() {
    return undefined;
  }

  async markKeyUsed() {}

  async consumeCredit(userId: number, limit: number) {
    let state = this.usage.get(userId) ?? { credits: 0, cooldownUntil: null };
    if (state.cooldownUntil !== null && state.cooldownUntil > this.now.getTime()) {
      return {
        allowed: false,
        credits_used: state.credits,
        cooldown_until: new Date(state.cooldownUntil).toISOString(),
      };
    }
    if (state.cooldownUntil !== null) state = { credits: 0, cooldownUntil: null };
    state.credits += 1;
    if (state.credits === limit) state.cooldownUntil = this.now.getTime() + 48 * 60 * 60 * 1000;
    this.usage.set(userId, state);
    return {
      allowed: true,
      credits_used: state.credits,
      cooldown_until: state.cooldownUntil === null ? null : new Date(state.cooldownUntil).toISOString(),
    };
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

test("final credit is accepted, then a 48-hour cooldown is enforced", async () => {
  const repository = new FakeAccessRepository();
  assert.deepEqual(await consumeQuota(7, 2, repository), { allowed: true, credits_used: 1, cooldown_until: null });
  assert.deepEqual(await consumeQuota(7, 2, repository), {
    allowed: true,
    credits_used: 2,
    cooldown_until: "2026-08-14T12:00:00.000Z",
  });
  assert.deepEqual(await consumeQuota(7, 2, repository), {
    allowed: false,
    credits_used: 2,
    cooldown_until: "2026-08-14T12:00:00.000Z",
  });
  repository.now = new Date("2026-08-14T12:00:00.000Z");
  assert.deepEqual(await consumeQuota(7, 2, repository), { allowed: true, credits_used: 1, cooldown_until: null });
});

test("per-user quota overrides are isolated and validated", () => {
  assert.equal(effectiveCreditLimit({ credit_limit: 2 }, 75), 2);
  assert.equal(effectiveCreditLimit({ credit_limit: null }, 75), 75);
  assert.equal(effectiveCreditLimit({ credit_limit: 0 }, 75), 75);
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

test("server advertises version 0.3.0 and read-only titles for public tools", async () => {
  const repository: DocsRepository = {
    async searchDocs() {
      return [];
    },
  };
  const server = buildServer(repository);
  const client = new Client({ name: "metadata-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    assert.equal(client.getServerVersion()?.version, "0.3.0");
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map(({ name, title, annotations }) => ({ name, title, readOnlyHint: annotations?.readOnlyHint })),
      [
        { name: "search_docs", title: "Search ROS 2 documentation", readOnlyHint: true },
        { name: "get_distro_status", title: "Get ROS 2 distribution status", readOnlyHint: true },
      ]
    );
  } finally {
    await client.close();
    await server.close();
  }
});
