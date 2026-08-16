import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/", { country, supportUrl, headers = {} } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const request = new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...headers } });
  if (country !== undefined) Object.defineProperty(request, "cf", { value: { country } });
  return worker.fetch(
    request,
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, SUPPORT_URL: supportUrl },
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
  assert.match(html, /75 credits/);
  assert.match(html, /48-hour cooldown/);
  assert.match(html, /Free, independently funded service/);
  assert.match(html, /self-funded service can stay available/);
  assert.doesNotMatch(html, /Support on Patreon/);
  assert.match(html, /Beta access status/);
  assert.match(html, /href="\/signup"/);
  assert.match(html, /href="\/faq"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="mailto:qwerty_786@protonmail\.com">Support/);
  assert.match(html, /og-v2\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("server-renders self-serve signup without exposing secrets", async () => {
  const response = await render("/signup");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Get beta access - ROS2-Docs MCP/);
  assert.match(html, /Get your private key/);
  assert.match(html, /Email address/);
  assert.match(html, /10 minutes/);
  assert.match(html, /Three wrong codes/);
  assert.match(html, /one active key/i);
  assert.match(html, /Public signup opens after a production email domain is verified/);
  assert.doesNotMatch(html, /TURNSTILE_SECRET|RESEND_API_KEY|postgres(?:ql)?:\/\//i);
});

test("renders Roman Urdu quota copy and a configured Patreon link for South Asia", async () => {
  const supportUrl = "https://www.patreon.com/ros2docs";
  const home = await render("/", { country: "PK", supportUrl });
  const homeHtml = await home.text();
  assert.match(homeHtml, /75th credit ke baad 48 ghantay/);
  assert.match(homeHtml, /href="https:\/\/www\.patreon\.com\/ros2docs"/);
  assert.match(homeHtml, /Patreon par support karein/);

  const faq = await render("/faq", { country: "IN", supportUrl });
  const faqHtml = await faq.text();
  assert.match(faqHtml, /Credits aur cooldown kaise kaam karte hain/);
  assert.match(faqHtml, /Har authenticated HTTP request aik credit/);
  assert.match(faqHtml, /support bilkul voluntary hai/);
});

test("ignores spoofed locale headers and invalid support URLs", async () => {
  const response = await render("/", {
    country: "US",
    supportUrl: "https://example.com/not-patreon",
    headers: { "x-ros2-docs-locale": "ur-Latn", "x-ros2-docs-support-url": "https://www.patreon.com/spoofed" },
  });
  const html = await response.text();
  assert.match(html, /Free, independently funded service/);
  assert.doesNotMatch(html, /48 ghantay|patreon\.com/);
});

test("server-renders quota, errors, setup, and privacy FAQ", async () => {
  const response = await render("/faq");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Frequently asked questions/);
  assert.match(html, /75th request succeeds/);
  assert.match(html, /reset_at/);
  assert.match(html, /401/);
  assert.match(html, /403/);
  assert.match(html, /429/);
  assert.match(html, /one active key/i);
  assert.match(html, /Privacy policy|privacy policy/);
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
  assert.match(html, /credits consumed/);
  assert.match(html, /Cloudflare hosts the landing site and MCP Worker/);
  assert.match(html, /Turnstile bot check/);
  assert.match(html, /Country-based presentation/);
  assert.match(html, /English or Roman Urdu/);
  assert.match(html, /Neon hosts the/);
  assert.match(html, /Resend delivers/);
  assert.match(html, /points to Patreon/);
  assert.match(html, /GitHub hosts the source repository/);
  assert.match(html, /Retention and deletion/);
  assert.match(html, /Historical daily usage records are automatically deleted/);
  assert.match(html, /after 90 days/);
  assert.match(html, /stale for 24/);
  assert.match(html, /after seven days/);
  assert.match(html, /href="mailto:qwerty_786@protonmail\.com"/);
  assert.match(html, /uses HTTPS, stores only API-key hashes/);
  assert.match(html, /GitHub issues are public/);
  assert.match(html, /do not include an API key/);
  assert.doesNotMatch(html, /does not promise a fixed automatic deletion period/);
  assert.doesNotMatch(html, /r2d_[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\//i);
});
