import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
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
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="mailto:qwerty_786@protonmail\.com">Support/);
  assert.match(html, /og-v2\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("server-renders the privacy policy and its data practices", async () => {
  const response = await render("/privacy");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Privacy policy — ROS2-Docs MCP<\/title>/);
  assert.match(html, /name="description" content="How ROS2-Docs MCP processes, uses, and retains service data\."/);
  assert.match(html, /Privacy policy/);
  assert.match(html, /Data we process/);
  assert.match(html, /authenticate access, enforce quotas, answer MCP/);
  assert.match(html, /Cloudflare hosts the landing site and MCP Worker/);
  assert.match(html, /Neon hosts the/);
  assert.match(html, /GitHub hosts the source repository/);
  assert.match(html, /Retention and deletion/);
  assert.match(html, /Daily usage records are automatically deleted/);
  assert.match(html, /after 90 days/);
  assert.match(html, /href="mailto:qwerty_786@protonmail\.com"/);
  assert.match(html, /uses HTTPS, stores only API-key hashes/);
  assert.match(html, /GitHub issues are public/);
  assert.match(html, /do not include an API key/);
  assert.doesNotMatch(html, /does not promise a fixed automatic deletion period/);
  assert.doesNotMatch(html, /r2d_[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\//i);
});
