# ROS2-Docs MCP Server

ROS2-Docs is a public, stateless [Model Context Protocol](https://modelcontextprotocol.io/)
service for searching indexed ROS 2 documentation. It covers **Humble**, **Jazzy**,
and **Lyrical** and searches a Neon Postgres database; it never scrapes
`docs.ros.org` at request time.

The public endpoint is:

```text
https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp
```

Customer setup, beta access, service status, and the public privacy policy are
published at:

```text
https://ros2-docs-mcp-site.sidiquihamdan148.workers.dev/
https://ros2-docs-mcp-site.sidiquihamdan148.workers.dev/privacy
```

The locally verified source also defines `/faq` and `/signup`; those routes are
not claimed as live until Turnstile/Resend configuration and deployment pass.

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

3. Apply the base schema and idempotent migrations to Neon:

   ```bash
   cd server
   NEON_DATABASE_URL="$DATABASE_URL" npm run migrate
   ```

4. Manual key administration remains available for support and recovery. Normal
   customer access uses the self-serve Turnstile and email-OTP flow.

   ```bash
   cd server
   DATABASE_URL='postgresql://…' npm run key:issue -- my-client free
   ```

5. Add Worker secrets. `ALLOWED_ORIGINS` is a comma-separated allow-list for
   browser clients. Server-to-server MCP clients without an `Origin` header are
   supported. Do not use `*`.

   ```bash
   cd server
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put CREDIT_LIMIT      # use 75
   npx wrangler secret put ALLOWED_ORIGINS    # e.g. https://app.example.com
   npx wrangler secret put TURNSTILE_SITE_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put TURNSTILE_HOSTNAME
   npx wrangler secret put OTP_PEPPER
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put RESEND_FROM_EMAIL
   npx wrangler secret put SIGNUP_MODE          # disabled, operator_test, or public
   npx wrangler secret put SIGNUP_TEST_EMAIL_HASH
   npx wrangler secret put SUPPORT_URL          # optional Patreon HTTPS URL
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
consumes one of the user's 75 credits. Credits do not expire on a schedule. The
75th accepted request starts a 48-hour cooldown; requests during that cooldown
return `429` with `reset_at`. Missing/invalid keys return `401`, and browser
origins outside `ALLOWED_ORIGINS` return `403`.

Authenticated responses expose limit/remaining headers. Consuming the final
credit also returns `X-ROS2-Docs-Warning` and `X-RateLimit-Reset-At` without
modifying the MCP JSON-RPC body. The subsequent `429` uses English by default
and Roman Urdu for the locked South Asian country set reported by Cloudflare.

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

See [`docs/CUSTOMER_SETUP.md`](docs/CUSTOMER_SETUP.md) for self-serve access,
copy-paste Claude Code and VS Code instructions, plus MCP Inspector diagnostics.
The retired public GitHub issue form is not an access path.

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

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for migrations, key lifecycle,
production smoke tests, refresh, deployment, rollback, and monitoring.

Key issue, list, revoke, replacement, and per-user limit overrides are handled
by `server/src/key_admin.ts` through the `key:*` npm scripts. Usage is counted
atomically in Neon Postgres, so the credit state is shared across stateless Worker
instances rather than held in process memory. The `usage:cleanup` and
`signup:cleanup` commands and scheduled workflow remove historical daily usage
and stale verification state at their documented boundaries.

With a valid key, test the local Worker via the MCP Inspector or any Streamable
HTTP client. Check tool discovery, `search_docs` for all three distros, and
`get_distro_status`; also confirm no/malformed key gives `401` and a deliberately
small `CREDIT_LIMIT` gives `429` after its final credit is accepted.

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

The `deploy-worker.yml` workflow can deploy relevant pushes to `main` and can be
run manually. It tests, applies Neon migrations, deploys, and then verifies an
isolated live credit lifecycle. Add these repository secrets before using it:

- `CLOUDFLARE_API_TOKEN` — permissions to deploy Workers for this account.
- `CLOUDFLARE_ACCOUNT_ID` — the target Cloudflare account ID.
- `NEON_DATABASE_URL` — direct Neon connection used for migrations before deploy.

Worker runtime secrets are configured with Wrangler once and are not copied
through GitHub Actions. In addition to database/quota/origin settings, self-serve
signup requires the Turnstile, OTP pepper, and Resend values listed above.
`SIGNUP_MODE` defaults to `disabled`. Use `operator_test` only with a hashed
operator allow-list value generated locally:

```bash
OTP_PEPPER='the-same-worker-secret' npm run signup:hash-email -- operator@example.com
```

Resend's test sender is only for the operator acceptance test. Keep public
signup disabled until a custom domain is verified in Resend; Gmail is not a
fallback in this release plan.

The customer site is also hosted on Cloudflare Workers. Changes under `site/**`
run lint, rendered-content tests, and a production deployment through
`deploy-site.yml`. The first verified site deployment is run
[`31896567228`](https://github.com/Hamdan-AS/ros2-docs-mcp/actions/runs/31896567228).

## Release path

The current release target is a small, best-effort beta through manually added
custom connectors. A user passes Turnstile and email OTP verification, then
receives one separate, privately delivered and individually revocable bearer
key. The customer site never receives or stores the key.

An official Claude Connectors Directory submission is a separate post-beta
milestone. It is intentionally deferred until the project has an OAuth 2.0
authentication layer and access to a Team or Enterprise Claude organization;
neither is required for the custom-connector beta.

## Notes for builders

- Documentation ingestion fetches source repositories rather than bot-protected
  `docs.ros.org`. Distro scope is locked in `config/distros.yaml`.
- API keys are SHA-256 hashes only. Do not log, persist, or echo raw tokens.
- The free tier remains 75 credits followed by a 48-hour cooldown. Revisit it
  only after daily requests
  exceed 5,000 for two consecutive weeks or monthly infra/database cost exceeds
  $15.
