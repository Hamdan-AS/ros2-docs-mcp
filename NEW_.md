# ROS2-Docs MCP Server — Checkpoint

> Single checkpoint doc, aligned to repo state (2026-08-15).
> `[x]` = completed / verified. `[ ]` = remaining.

**Base layer:** ROS2 — Humble + Jazzy + Lyrical Luth (all currently-supported LTS)
**Model:** MCP server, generous free tier (75 req/day), paid tier later
**Protocol:** MCP 2026-07-28 spec (stateless core)

---

## Phase status

| Phase | Status |
|---|---|
| 0 — Pain point, distro scope, priority list | ✅ |
| 1 — Toy MCP server (count_words over stdio) | ✅ |
| 2 — Single-item ingestion (RST fetch + parse) | ✅ |
| 3 — Local Postgres 16 + schema | ✅ |
| 4 — search_docs FTS tool (distro filter) | ✅ |
| 5 — Bulk ingest, 21 pkgs × 3 distros = 63 combos / 2,234 chunks | ✅ |
| 6 — Hosted HTTP + daily quota policy | ✅ |
| 7 — Per-user accounts + per-key daily limits (HTTP edge) | ✅ |
| 8 — Neon + Cloudflare Worker hosting | ✅ production-verified |
| 8A — Patreon support link | ⏳ remaining |
| 8B — Paid gate | ⏳ remaining (only if trigger fires) |
| 8C — Customer setup, access form, operator runbook, landing source | ✅ |
| 9 — Custom-connector beta and launch post | ⏳ remaining |
| Post-beta — OAuth + official Claude directory | ⏳ deferred |

---

## Completed highlights

- **Phase 0:** scope locked to Humble/Jazzy/Lyrical. Kilted excluded (non-LTS, EOL 2026-12-31), Rolling excluded.
- **Phase 1:** `server/src/mcp.ts` with `@modelcontextprotocol/sdk` 1.30.0 + zod 4.4.3.
- **Phase 2:** `ingest/fetch_one.py` fetches RST from `ros2/ros2_documentation` (distro branches) and parses into sections. No scraping of docs.ros.org (Anubis anti-bot).
- **Phase 3:** Postgres 16 via `docker-compose.yml`; schema in `db/schema.sql`.
- **Phase 4:** `search_docs` tool runs Postgres FTS (`tsvector`/`tsquery`, English), ranked, distro filter, limit.
- **Phase 5:** `config/ingest_manifest.yaml` maps 21 priority packages to sources; `ingest/ingest_all.py` bulk-loads (idempotent delete+reinsert). Cross-checked vs rosdistro — all 21 exist in all 3 distros. `get_distro_status` serves REP 2000 data from `config/distros.yaml`. Weekly drift check: `.github/workflows/ingest-weekly.yml` (dry-run `check` + `refresh` against Neon).
- **Phase 6:** hosted HTTP and the 75-request default daily allowance were established. The current implementation supersedes the original process-local counter with atomic UTC-day usage rows in Postgres, shared across all stateless Worker instances.
- **Phase 7:** `users` + `api_keys` tables (SHA-256 key hashes); key administration through `server/src/key_admin.ts` and the `npm run key:*` commands; HTTP auth always-on Bearer (401); 429 over budget; stdio unlimited by design.
- **Phase 8:** schema + 63/2,234 moved to Neon; `server/src/db.ts` and ingest scripts read `DATABASE_URL` (SSL cloud / local defaults otherwise). Production is live at `https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp`. On 2026-08-15, GitHub deployment, weekly Neon refresh, authenticated SDK tool discovery, all three distro searches, per-user `429`, revoked-key `401`, replacement keys, and hourly health monitoring were verified.
- **Phase 8C:** customer setup supports Claude Code and Visual Studio Code, MCP Inspector is documented for diagnostics, operator procedures and automated 90-day usage cleanup are present, and a beta access issue form plus landing-site/privacy source are ready for deployment.

---

## Locked decisions / ground rules

- **Rate-limit tightening trigger:** only when daily requests exceed 5,000 for 2 consecutive weeks OR monthly infra+DB cost exceeds $15. Until then free tier = 75/day.
- **No pgvector/embeddings** until Postgres FTS proves insufficient.
- **Kilted stays out of ingestion scope.**
- **Priority package list** is an inherited draft (deferred rebuild from target-user friction is allowed later; no schema change needed).
- **Personal packages** (rslidar_msg, lidar_pipeline_pkg, d435i_kf_demo) are out of ingestion scope.
- Monetization sequence: generous free tier + support link → tighten only when trigger fires.

---

## Remaining (outstanding)

- [x] Smoke test from the official SDK client against the live URL.
- [x] Verify isolated quota, revocation, and replacement-key behavior.
- [ ] 8A: Patreon support link (in-region billing rails unavailable; fallback: GitHub Sponsors via Open Source Collective fiscal host).
- [ ] 8B: paid gate only if Phase 6 trigger fires (lower free limit → flat monthly sub → tier check in rate limiter).
- [ ] 9: deploy the customer site, enable provider alerts, run the three-to-five-user custom-connector beta for one stable week, then publish the ROS Discourse launch post.
- [ ] Post-beta: revisit an official Claude Connectors Directory submission only after adding OAuth 2.0 and obtaining Team or Enterprise organization submission access. Static bearer keys remain the custom-beta access model.
