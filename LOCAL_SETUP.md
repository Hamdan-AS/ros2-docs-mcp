# Local Setup — Run Server & Connect Codex

## Prerequisites
- Docker running
- Node.js 22+
- OpenAI Codex CLI installed

## 1. Start local Postgres

```bash
cd ~/sandbox/ros2-docs-mcp
docker compose up -d
```

Verify it's running:
```bash
docker compose ps
```

## 2. Initialize the database

```bash
# Create base tables (packages, doc_chunks, users, api_keys, etc.)
docker exec -i ros2docs-db psql -U ros2docs -d ros2docs \
  < ~/sandbox/ros2-docs-mcp/db/schema.sql

# Apply migrations (adds credit_limit, quota functions, signup schema)
cd ~/sandbox/ros2-docs-mcp/server
DATABASE_URL="postgresql://ros2docs:ros2docs@localhost:5432/ros2docs" npm run migrate
```

## 3. Build the server

```bash
cd ~/sandbox/ros2-docs-mcp/server
npm install
npm run build
```

## 4. Generate an API key

```bash
node dist/key_admin.js issue "hamdan" free
```

Your key: `r2d_q4zlio3lxBG2Za283_VhNM4VYnV5Hc7dsefB2t3M3WY`

## 5. Run the server (stdio mode)

```bash
npm start
```

Leave this terminal running. Stdio mode has no auth — unlimited local dev access.

## 6. Configure Codex

Edit `~/.codex/config.toml` — add these lines at the bottom:

```toml
[mcp_servers.ros2-docs]
command = "node"
args = ["/home/elite/sandbox/ros2-docs-mcp/server/dist/index.js"]
```

## 7. Test in Codex

Open Codex and ask:

> Search ROS 2 docs for tf2 transform in Jazzy

Codex will call `search_docs` and `get_distro_status` automatically.

## Optional — Run via HTTP instead

If you want to test the Worker path locally:

```bash
cd ~/sandbox/ros2-docs-mcp/server
npm run dev:worker
```

Then configure Codex with HTTP:

```json
{
  "mcpServers": {
    "ros2-docs": {
      "type": "streamable-http",
      "url": "http://localhost:8787/mcp",
      "headers": {
        "Authorization": "Bearer r2d_q4zlio3lxBG2Za283_VhNM4VYnV5Hc7dsefB2t3M3WY"
      }
    }
  }
}
```

## Quick test with curl

```bash
curl -X POST http://localhost:8787/mcp \
  -H "Authorization: Bearer r2d_q4zlio3lxBG2Za283_VhNM4VYnV5Hc7dsefB2t3M3WY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```
