# ROS2-Docs MCP Server

ROS2-Docs is a public, stateless [Model Context Protocol](https://modelcontextprotocol.io/)
service for searching indexed ROS 2 documentation. It covers **Humble**, **Jazzy**,
and **Lyrical** and searches a Neon Postgres database; it never scrapes
`docs.ros.org` at request time.

The public endpoint is:

```text
https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp
```

It is compatible with MCP-capable clients that support Streamable HTTP and custom
headers. That does **not** mean every chatbot product can connect directly; a
client must implement MCP and allow an `Authorization` header.

## Tools

- `search_docs(query, distro?, limit?)` searches full-text indexed documentation.
  `distro` is one of `humble`, `jazzy`, or `lyrical`; `limit` is 1–20 (default 5).
- `get_distro_status()` returns lifecycle and indexing status for ROS 2 distros.

The local stdio server also retains `count_words` as a diagnostic tool. It is not
advertised by the public Worker.

## Public Worker setup

1. Create a Cloudflare account and authenticate Wrangler:

   ```bash
   cd server
   npx wrangler login
   ```

2. Create a Neon Postgres project. Use its **pooled** connection string for the
   Worker and its direct connection string for migrations and ingestion.

3. Apply the base schema and idempotent Worker migration to Neon:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   psql "$DATABASE_URL" -f db/migrations/20260812_worker_rate_limits.sql
   ```

4. Provision a bearer key from a trusted machine. The raw token is printed once;
   the database stores only its SHA-256 hash.

   ```bash
   cd server
   DATABASE_URL='postgresql://…' npm run create:key -- my-client free
   ```

5. Add Worker secrets. `ALLOWED_ORIGINS` is a comma-separated allow-list for
   browser clients. Server-to-server MCP clients without an `Origin` header are
   supported. Do not use `*`.

   ```bash
   cd server
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put RATE_LIMIT_DAILY   # use 75
   npx wrangler secret put ALLOWED_ORIGINS    # e.g. https://app.example.com
   ```

6. Type-check and deploy. Cloudflare assigns a `workers.dev` hostname; adding a
   custom domain later is a Cloudflare route/domain setting and requires no code
   change.

   ```bash
   npm run check:worker
   npm run deploy:worker
   ```

`GET /health` is intentionally unauthenticated and returns a small status JSON.
`/mcp` requires `Authorization: Bearer r2d_…`; every authenticated MCP request
uses the per-user daily allowance (75 by default), atomically tracked in Neon.
Missing/invalid keys return `401`, quota exhaustion returns `429`, and browser
origins outside `ALLOWED_ORIGINS` return `403`.

## Connecting a generic MCP client

Use the deployed URL and include the bearer header in the client’s Streamable
HTTP configuration. The exact configuration field names vary by client, but the
connection is equivalent to:

```json
{
  "url": "https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp",
  "headers": {
    "Authorization": "Bearer r2d_your_key_here"
  }
}
```

Never paste a bearer key into a public client configuration or commit it to a
repository.

## Development and verification

Node.js 22 or newer is required by the pinned Wrangler toolchain.

```bash
cd server
npm install
npm run build          # Node/stdio type-check and emit
npm test               # auth, quota reset, inputs, no-results, distro filter
npm run check:worker   # Cloudflare Worker type-check
cp .dev.vars.example .dev.vars  # add a non-production Neon URL locally
npm run dev:worker
```

With a valid key, test the local Worker via the MCP Inspector or any Streamable
HTTP client. Check tool discovery, `search_docs` for all three distros, and
`get_distro_status`; also confirm no/malformed key gives `401` and a deliberately
small `RATE_LIMIT_DAILY` gives `429`.

After applying the migration to Neon, verify the existing indexed package/distro
coverage before deploying:

```sql
SELECT distro, count(*) AS packages
FROM packages
GROUP BY distro
ORDER BY distro;

SELECT dc.distro, count(*) AS matching_chunks
FROM doc_chunks dc
WHERE to_tsvector('english', dc.section_title || ' ' || dc.content)
      @@ plainto_tsquery('english', 'tf2')
GROUP BY dc.distro
ORDER BY dc.distro;
```

The expected package result is 21 packages for each of the three indexed distros
(63 total). The weekly Neon ingestion workflow remains unchanged.

## GitHub deployment

The `deploy-worker.yml` workflow deploys on pushes to `main` and can be run
manually. Add these repository secrets before using it:

- `CLOUDFLARE_API_TOKEN` — permissions to deploy Workers for this account.
- `CLOUDFLARE_ACCOUNT_ID` — the target Cloudflare account ID.

Worker runtime secrets (`DATABASE_URL`, `RATE_LIMIT_DAILY`, and
`ALLOWED_ORIGINS`) are configured with Wrangler once and are not copied through
GitHub Actions.

## Notes for builders

- Documentation ingestion fetches source repositories rather than bot-protected
  `docs.ros.org`. Distro scope is locked in `config/distros.yaml`.
- API keys are SHA-256 hashes only. Do not log, persist, or echo raw tokens.
- The free tier remains 75 requests/day. Tighten it only after daily requests
  exceed 5,000 for two consecutive weeks or monthly infra/database cost exceeds
  $15.
