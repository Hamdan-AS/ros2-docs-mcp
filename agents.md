<!-- Meta -->
- Path: /home/elite/sandbox/ros2-docs-mcp/agents.md
- Repo: ROS2-Docs MCP Server
- Updated: 2026-08-15
- Scope: all agents working inside this folder
- Authoritative docs: README.md (product), checkpoint.md is replaced by NEW_.md (build roadmap/status), db/schema.sql, config/*.yaml

# ROS2-Docs MCP Server — Critical Info for Agents

MCP server answering ROS 2 documentation questions for the supported LTS
distros: **Humble Hawksbill, Jazzy Jalisco, Lyrical Luth**. Indexed doc
content lives in Postgres; agents query it via MCP tools (no scraping at
request time).

## Lay of the land

```
ros2-docs-mcp/
├── README.md                 # product README: scope, phases, rate-limit trigger, auth
├── NEW_.md                   # phase-wise checkpoints (replaces checkpoint.md, 2026-08-12)
├── docker-compose.yml        # local Postgres 16 (ros2docs-db, port 5432)
├── .github/workflows/ingest-weekly.yml  # weekly dry-run check + Neon refresh
├── config/
│   ├── distros.yaml          # distro scope, release/EOL/LTS, doc source repos (LOCKED)
│   ├── priority_packages.yaml# 21 ranked packages, categories; personal pkgs out of scope
│   └── ingest_manifest.yaml  # package → doc sources (main_docs/interfaces/readme)
├── db/schema.sql             # packages, doc_chunks (+GIN FTS), users, api_keys
├── ingest/                   # Python 3.10; run with .venv/bin/python
│   ├── fetch_one.py          # fetch 1 RST from ros2_documentation, parse sections
│   ├── load_one.py           # fetch + parse + load single page into Postgres
│   ├── ingest_all.py         # bulk ingest, idempotent, [--dry-run] [--distro X]
│   └── last_run_report.txt   # last real ingest: 63 pkgs×distro, 2,234 chunks
└── server/                   # TypeScript (ESM, type: module), src/ → dist/
    ├── package.json          # build/deploy, key:* administration, smoke/lifecycle scripts
    ├── src/index.ts          # stdio entry (unlimited, local dev)
    ├── src/worker.ts         # stateless Streamable HTTP Worker (/mcp, /health)
    ├── src/mcp.ts            # public tools: search_docs, get_distro_status
    ├── src/db.ts             # pg pool: DATABASE_URL (SSL) or ROS2DOCS_DB_* defaults
    ├── src/access.ts         # Bearer key → SHA-256 → users/api_keys lookup + quota service
    ├── src/worker-repository.ts # Neon HTTP search/auth/atomic quota implementation
    ├── src/key_admin.ts      # issue/list/revoke/replace/set-limit; raw keys print once
    └── src/distros.ts        # distro lifecycle data (keep in sync w/ distros.yaml)
```

## MCP tools (server/src/mcp.ts)
- `count_words(text)` — stdio-only diagnostic smoke-test tool.
- `search_docs(query, distro?, limit?)` — Postgres FTS (english tsvector/tsquery),
  ranked, distro filter optional, limit 1–20 default 5. Returns sections + source URLs.
- `get_distro_status()` — lifecycle (release/EOL/LTS/indexed) from config/distros.yaml.

## MCP endpoints
- stdio: `npm start` (in server/) — deliberately unlimited, local dev.
- Worker HTTP: `https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp`, requires
  `Authorization: Bearer <key>` (401 without/invalid), per-user 75/day (429 over).
  `GET /health` is unauthenticated. Browser Origin headers must match the
  `ALLOWED_ORIGINS` Worker secret; server-to-server MCP clients need no Origin.

## Key administration & rate limiting
- Issue key: `npm run key:issue -- <name> [tier] [daily-limit]` — token `r2d_...`
  printed ONCE; only the SHA-256 hash is stored (never the raw token).
- Other administration commands: `npm run key:list -- [USER_ID]`,
  `npm run key:revoke -- KEY_ID`, `npm run key:replace -- KEY_ID`, and
  `npm run key:set-limit -- USER_ID <daily-limit|default>`. Missing, invalid, or
  revoked keys return 401.
- Daily limit: Worker secret `RATE_LIMIT_DAILY` (default 75). Budgets are atomic
  per user across Worker instances, stored in `api_daily_usage` and reset by UTC
  date. Tightening trigger locked:
  only if daily requests exceed 5,000 for 2 consecutive weeks OR monthly infra+DB
  cost exceeds $15 (Phase 6; see README). 429 message is explicit (includes limit + reset).
- Stdio path (index.ts) has NO auth/rate gate — intended.

## Database
- Local: `docker compose up -d` → postgres:16, user/db/pass `ros2docs`, 127.0.0.1:5432.
- Cloud (Neon): set `DATABASE_URL` (SSL, `rejectUnauthorized: false`). Schema + data
  (63 pkgs / 2,234 chunks / users / api_keys) migrated; sequences reset.
  Direct connection for schema/ingest; pooled for the server.
- Tables: `packages(id,name,distro,source_url, UNIQUE(name,distro))`;
  `doc_chunks(id,package_id→packages,distro,section_title,content,source_url,last_scraped_at)`
  with GIN index on `to_tsvector('english', section_title||' '||content)`;
  `users(id,name,tier,created_at)`; `api_keys(id,user_id→users,key_hash UNIQUE,created_at,last_used_at)`;
  `api_daily_usage(user_id,usage_date,request_count)` for atomic Worker quotas.
- Env that overrides local DB (ingest + db.ts): PGDATABASE/PGUSER/PGPASSWORD/PGHOST/PGPORT
  or ROS2DOCS_DATABASE_URL; ingest scripts also accept DATABASE_URL.

## Ingestion
- Sources come from GitHub repos, NOT docs.ros.org (Anubis proof-of-work blocks scraping).
  Raw fetch `raw.githubusercontent.com`, tarball listing via `codeload.github.com`
  (no GitHub API → no unauth rate-limit issues).
- Manifest source types: `main_docs` (RST paths under `ros2/ros2_documentation/{distro}/source/`),
  `interfaces` (`.msg/.srv/.action` in package repos), `readme` (repo README; custom `path`/`ref`).
- Branch resolution at fetch: distro branch → rolling → master → main.
- Idempotent: re-run deletes + reinserts each package's chunks (per distro).
- Known skip: lyrical lacks `Single-Package-Define-And-Use-Interface.rst` — loader skips + reports 404s.
- Priority/packages: 21 in `config/priority_packages.yaml` (rank 1–21); realsense2_camera
  readme source is `realsenseai/realsense-ros` `ref: ros2-development` (no distro branches).
- Personal packages (rslidar_msg, lidar_pipeline_pkg, d435i_kf_demo) are OUT of ingestion scope.
- Run: `.venv/bin/python ingest/ingest_all.py [--dry-run] [--distro X]`.

## Distro scope (config/distros.yaml — locked)
- humble ⏳ EOL 2027-05-31 | jazzy EOL 2029-05-31 | lyrical EOL 2031-05-31 — all LTS, in scope.
- kilted: non-LTS, EOL 2026-12-31 → excluded. rolling → excluded.
- Distro branches in ros2_documentation == distro name.

## Build/dev commands (in server/)
- Node.js 22+ is required by the pinned Wrangler toolchain.
- `npm install` · `npm run build` (tsc → dist/) · `npm start` (stdio) ·
  `npm run check:worker` · `npm run dev:worker` · `npm run deploy:worker`.
- Deps: `@modelcontextprotocol/sdk` ^1.30.0, `@neondatabase/serverless`, `pg`,
  `zod`; dev: TypeScript, Wrangler, Cloudflare Worker types.

## GitHub Action (ingest-weekly.yml)
- `check`: Mondays 04:00 UTC + workflow_dispatch; dry-run ingest, prints existence report,
  uploads `ingest/last_run_report.txt`. `refresh` (needs check): real ingest against Neon via
  `NEON_DATABASE_URL` repo secret, uploads `ingest/refresh_report.txt`.
- Python deps installed inline: `pyyaml psycopg2-binary`; python 3.10.

## Big no-nos / gotchas
- Do NOT scrape docs.ros.org HTML (bot-protected). Use source repos.
- No pgvector until FTS proves insufficient (explicit ground rule).
- Never store/log raw API keys — only SHA-256 hashes.
- Keep `distros.ts` in sync with `config/distros.yaml` (config is source of truth).
- Phase 5+ data drift is refreshed weekly by CI; manual cross-checks against rosdistro
  confirmed all 21 packages exist in all 3 distros.
- If a `v1/v2/copy/backup` variant appears, ask which is authoritative before editing.

## Remaining work (see NEW_.md for full checklist)
- Deploy the customer landing site with its public privacy route and record the URL.
- Enable Cloudflare and Neon provider alerts for the public operator contact.
- Run a three-to-five-user custom-connector beta and observe it for one week.
- Phase 8A support link (Patreon not available in-region; vetted fallback: GitHub Sponsors + fiscal host).
- Phase 8B paid gate only if the locked trigger fires; tier flip hook (`users.tier`) already in place.
- Phase 9 custom-connector launch steps. OAuth and official Claude Connectors
  Directory submission are separate post-beta work.
