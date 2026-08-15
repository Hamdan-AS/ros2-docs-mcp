import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete product page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>ROS2-Docs MCP/);
  assert.match(html, /ROS 2 answers/);
  assert.match(html, /Claude Code/);
  assert.match(html, /VS Code/);
  assert.match(html, /search_docs/);
  assert.match(html, /75-request allowance/);
  assert.match(html, /Request a beta key/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
