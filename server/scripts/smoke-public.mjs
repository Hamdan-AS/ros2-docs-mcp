import assert from "node:assert/strict";

const mcpUrl = new URL(process.env.MCP_URL ?? "https://ros2-docs-mcp.notriful-beligum.workers.dev/mcp");
const healthUrl = new URL("/health", mcpUrl);

const health = await fetch(healthUrl, { signal: AbortSignal.timeout(15_000) });
assert.equal(health.status, 200, `health returned ${health.status}`);
assert.equal((await health.json()).status, "ok");

const missing = await fetch(mcpUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  signal: AbortSignal.timeout(15_000),
});
assert.equal(missing.status, 401, `missing key returned ${missing.status}`);

const invalid = await fetch(mcpUrl, {
  method: "POST",
  headers: {
    authorization: "Bearer r2d_abcdefghijklmnopqrstuvwxyz",
    "content-type": "application/json",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  signal: AbortSignal.timeout(15_000),
});
assert.equal(invalid.status, 401, `invalid key returned ${invalid.status}`);

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  endpoint: mcpUrl.origin,
  health: "passed",
  missingKey: "passed",
  invalidKey: "passed",
}));
