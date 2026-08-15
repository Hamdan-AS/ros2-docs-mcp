import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL;
const apiKey = process.env.MCP_API_KEY;

if (!url || !apiKey) {
  console.error("MCP_URL and MCP_API_KEY are required.");
  process.exit(1);
}

const endpoint = new URL(url);
if (endpoint.protocol !== "https:" && process.env.ALLOW_INSECURE_MCP_URL !== "1") {
  console.error("MCP_URL must use HTTPS unless ALLOW_INSECURE_MCP_URL=1.");
  process.exit(1);
}

const health = await fetch(new URL("/health", endpoint), { signal: AbortSignal.timeout(15_000) });
assert.equal(health.status, 200, `health returned ${health.status}`);

const transport = new StreamableHTTPClientTransport(endpoint, {
  requestInit: {
    headers: { Authorization: `Bearer ${apiKey}` },
  },
});
const client = new Client({ name: "ros2-docs-production-smoke", version: "1.0.0" });

try {
  await client.connect(transport);

  const discovered = await client.listTools();
  const toolNames = discovered.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, ["get_distro_status", "search_docs"]);

  const status = await client.callTool({ name: "get_distro_status", arguments: {} });
  const statusText = status.content.find((item) => item.type === "text")?.text ?? "";
  for (const distro of ["Humble", "Jazzy", "Lyrical"]) {
    assert.match(statusText, new RegExp(distro, "i"));
  }

  const searches = {};
  for (const distro of ["humble", "jazzy", "lyrical"]) {
    const result = await client.callTool({
      name: "search_docs",
      arguments: { query: "tf2 transform", distro, limit: 1 },
    });
    const text = result.content.find((item) => item.type === "text")?.text ?? "";
    assert.match(text, new RegExp(`\\[${distro}/`, "i"));
    assert.match(text, /Source: https?:\/\//i);
    searches[distro] = "passed";
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    endpoint: endpoint.origin,
    client: "@modelcontextprotocol/sdk StreamableHTTPClientTransport",
    health: "passed",
    connected: true,
    tools: toolNames,
    distroStatus: "passed",
    searches,
    rawKeyLogged: false,
  }));
} finally {
  await client.close().catch(() => {});
}
