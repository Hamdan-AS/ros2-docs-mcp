# Operations

Use the direct Neon URL for administration and ingestion. The Worker uses the
pooled Neon URL stored in its Cloudflare `DATABASE_URL` secret.

## Database migrations

```bash
cd server
NEON_DATABASE_URL="$NEON_DATABASE_URL" npm run migrate
```

## Keys

```bash
cd server
DATABASE_URL="$NEON_DATABASE_URL" npm run key:issue -- customer-name free
DATABASE_URL="$NEON_DATABASE_URL" npm run key:list
DATABASE_URL="$NEON_DATABASE_URL" npm run key:revoke -- KEY_ID
DATABASE_URL="$NEON_DATABASE_URL" npm run key:replace -- KEY_ID
DATABASE_URL="$NEON_DATABASE_URL" npm run key:set-limit -- USER_ID CREDIT_LIMIT
```

Raw keys are shown once. Deliver them privately and never log or commit them.
`key:list` reports each user's credit limit, credits used, and cooldown end. A
limit of `default` removes the per-user override. Changing a key does not reset
the user's quota state; delete that user's `api_quota_state` row only when an
intentional operator reset is required.

## Usage retention

Daily usage counts are retained for 90 days. Delete older rows with the
parameterless operator command below; it prints only the number of rows
deleted and does not expose customer or credential data.

```bash
cd server
DATABASE_URL="$NEON_DATABASE_URL" npm run usage:cleanup
```

The `cleanup-usage` GitHub Actions workflow runs this command every Monday at
04:30 UTC and also supports manual dispatch. It requires the repository secret
`NEON_DATABASE_URL`. A failed run leaves the rows in place, so inspect the job
log, restore database connectivity or the secret, and rerun the workflow
manually. Repeated runs are safe because only rows with
`usage_date < CURRENT_DATE - INTERVAL '90 days'` are deleted.

## Verification

```bash
cd server
npm run smoke:public
MCP_URL="https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp" \
MCP_API_KEY="$CUSTOMER_KEY" npm run smoke:live
NEON_DATABASE_URL="$NEON_DATABASE_URL" \
MCP_URL="https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp" \
npm run test:lifecycle
```

The lifecycle test uses a temporary two-credit limit, confirms the final credit
starts a 48-hour cooldown, validates the `429` reset metadata, and deletes its
test user.

## Refresh, deploy, and rollback

- Run `weekly-ingest-check` manually when an immediate refresh is required.
- Push reviewed Worker, database, or relevant configuration changes to `main`,
  or manually run `deploy-worker` to deploy. Documentation-only and
  landing-site-only changes do not trigger a Worker deployment.
- The deployment workflow runs the server tests and Worker type-check before
  applying idempotent Neon migrations and deploying. A test, type-check, or
  migration failure prevents deployment, so the Worker cannot start against an
  older schema. After deployment, an isolated temporary user verifies the live
  credit/cooldown, revocation, and replacement lifecycle and is deleted. The
  workflow requires the `NEON_DATABASE_URL` repository secret.
- Roll back by reverting the faulty Git commit and pushing the revert.

## Monitoring

- `production-health-check` validates `/health` and the `401` gate hourly.
- GitHub Actions reports deployment and ingestion failures.
- Cloudflare and Neon dashboards remain the source for traffic, errors, and cost.
