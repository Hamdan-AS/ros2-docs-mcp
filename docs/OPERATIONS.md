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
```

Raw keys are shown once. Deliver them privately and never log or commit them.

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

The lifecycle test uses a temporary two-request limit and deletes its test user.

## Refresh, deploy, and rollback

- Run `weekly-ingest-check` manually when an immediate refresh is required.
- Push reviewed changes to `main` or manually run `deploy-worker` to deploy.
- Roll back by reverting the faulty Git commit and pushing the revert.

## Monitoring

- `production-health-check` validates `/health` and the `401` gate hourly.
- GitHub Actions reports deployment and ingestion failures.
- Cloudflare and Neon dashboards remain the source for traffic, errors, and cost.
