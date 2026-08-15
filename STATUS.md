# ROS2-Docs MCP — Project Status

> Updated: 2026-08-15

## Achieved

- Scope fixed to the supported ROS 2 LTS distributions:
  - Humble Hawksbill
  - Jazzy Jalisco
  - Lyrical Luth
- Defined and indexed 21 priority ROS 2 packages across all three distributions.
- Built source-based documentation ingestion without scraping `docs.ros.org`.
- Added idempotent bulk ingestion and weekly documentation refresh automation.
- Loaded the Neon Postgres database with:
  - 63 package/distribution combinations
  - 2,234 documentation chunks
- Implemented PostgreSQL full-text search with distribution filtering and ranked results.
- Implemented the public MCP tools:
  - `search_docs`
  - `get_distro_status`
- Retained `count_words` as a local stdio diagnostic tool.
- Added local stdio MCP support for development.
- Added a stateless Streamable HTTP MCP server for Cloudflare Workers.
- Added Neon HTTP database access compatible with the Workers runtime.
- Added bearer API-key authentication.
- API keys are stored only as SHA-256 hashes; raw keys are printed once during provisioning.
- Added atomic, per-user credit/cooldown tracking in Postgres. Historical daily
  usage rows remain separate for 90-day operational retention.
- Added a weekly automated cleanup and operator command for usage rows older
  than 90 days.
- Configured 75 credits per cycle; the 75th accepted request starts a 48-hour
  cooldown and `429` responses include `reset_at` plus `Retry-After`.
- Added browser-origin enforcement and CORS handling.
- Added an unauthenticated `/health` endpoint.
- Added automated tests for API-key parsing, hashing, quota reset, search validation, no-result formatting, and distribution filtering.
- Added Cloudflare deployment configuration and a GitHub Actions deployment workflow.
- Deployed the production Worker at:

  ```text
  https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp
  ```

- Verified the live deployment:
  - `/health` returns `200 OK`.
  - `/mcp` without an API key returns `401 Unauthorized`.
- Verified locally through a real MCP client:
  - Tool discovery returned `count_words`, `search_docs`, and `get_distro_status`.
  - A Jazzy `tf2` documentation search returned an indexed result and source URL.
- Updated the project to Node.js 22+ and Wrangler 4.121.0.
- Published the source at `https://github.com/Hamdan-AS/ros2-docs-mcp`.
- Verified GitHub Actions deployment to Cloudflare Workers:
  - Build, type-check, and deployment passed.
  - Run: `https://github.com/Hamdan-AS/ros2-docs-mcp/actions/runs/31885933764`
- Verified the scheduled Neon refresh workflow:
  - Dry run and real refresh passed.
  - 63 package/distribution combinations and 2,234 chunks were written.
  - Run: `https://github.com/Hamdan-AS/ros2-docs-mcp/actions/runs/31883064860`
- Verified the production endpoint with the official Streamable HTTP SDK client:
  - Initialization and tool discovery passed.
  - Only `search_docs` and `get_distro_status` were advertised.
  - Humble, Jazzy, and Lyrical searches returned source-linked results.
- Verified the complete live access lifecycle with isolated temporary records:
  - Missing and invalid keys returned `401`.
  - A per-user two-credit cap accepted the final credit, started a 48-hour
    cooldown, then returned `429` with `reset_at` and `Retry-After`.
  - Revoked keys returned `401` and replacement keys worked.
  - Temporary users, keys, and usage rows were removed.
- Applied the credit/cooldown Neon migration and deployed the Worker through
  run `31901024384`; the automated post-deploy lifecycle passed in run
  `31901673070`.
- Added operator key issue/list/revoke/replace commands and idempotent migrations.
- Added an hourly production health workflow and verified it successfully:
  - Run: `https://github.com/Hamdan-AS/ros2-docs-mcp/actions/runs/31886448325`
- Added customer setup and operator runbooks in `docs/`.
- Added customer landing-site source with setup instructions, service limits,
  a dedicated privacy route, the 90-day retention policy, the public privacy
  and support contact, a health link, and a beta access path.
- Migrated the customer site from the undeployed GPT Sites project to a
  dedicated Cloudflare Worker and removed the Sites-specific build metadata.
- Published and verified the customer site:
  - Landing: `https://ros2-docs-mcp-site.sidiquihamdan148.workers.dev/`
  - Privacy: `https://ros2-docs-mcp-site.sidiquihamdan148.workers.dev/privacy`
  - Both routes return `200 OK` and contain the expected rendered content.
  - Cloudflare site deployment run:
    `https://github.com/Hamdan-AS/ros2-docs-mcp/actions/runs/31896567228`
- Locked customer clients to Claude Code and Visual Studio Code; MCP Inspector
  remains the diagnostic client.
- Added a structured GitHub beta-access request form that warns users not to
  post secrets.

## Remaining

### Immediate launch work

- Send Cloudflare Worker error, GitHub Actions failure, and Neon usage/cost
  alerts to `qwerty_786@protonmail.com`, then verify available test notifications.
- Run a small three-to-five-user beta and collect setup/search-quality feedback.

### Operations

- Confirm the Worker runtime secrets remain configured:
  - `DATABASE_URL`
  - `CREDIT_LIMIT=75`
  - `ALLOWED_ORIGINS` only if a browser client needs direct access
- Keep the automated 90-day retention cleanup and its failure reporting healthy.

### Phase 8A — Support

- Create a support/donation page.
- Use the selected regional fallback, such as GitHub Sponsors with an appropriate fiscal host.
- Add the support link to the README and launch material.

### Phase 8B — Paid Tier

- Do not tighten the free tier yet.
- Add paid access only if either locked trigger occurs:
  - More than 5,000 requests per day for two consecutive weeks, or
  - Monthly infrastructure and database cost exceeds $15.
- If triggered, connect billing to the existing `users.tier` field and retain a useful free allowance.

### Phase 9 — Custom-connector launch

- Prepare a short demonstration or screen recording.
- Publish a launch post on ROS Discourse.
- Submit only to MCP registries or directories compatible with the current
  individually issued bearer-key model.
- Provide setup examples for popular MCP clients that support Streamable HTTP and custom authorization headers.
- Collect search-quality feedback before considering embeddings or pgvector.

### Post-beta — Official Claude Connectors Directory

- Treat official directory submission as a separate milestone, not a blocker
  for the custom-connector beta.
- Add an OAuth 2.0 authentication layer before submission.
- Obtain Team or Enterprise Claude organization access with permission to submit.
- Prepare tool annotations, a reviewer account, example prompts, and listing
  metadata only when the two structural requirements above are met.

## Current Completion Boundary

The MCP API is technically production-ready for a custom-connector beta:
deployment, ingestion, authenticated tools, all supported distros, Postgres-backed
quotas, revocation, replacement keys, and hourly health monitoring are verified.
Remaining beta work is verifying provider alerts and completing the
three-to-five-user trial. OAuth and official
Claude Connectors Directory submission are explicitly deferred post-beta work.
