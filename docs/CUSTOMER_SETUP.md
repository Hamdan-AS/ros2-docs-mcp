# Customer setup

Endpoint:

```text
https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp
```

Each beta user receives an individual `r2d_...` key with a 75-request daily
allowance that resets at UTC midnight. Never commit or post the key publicly.

## Visual Studio Code

Run **MCP: Open User Configuration** and add:

```json
{
  "inputs": [
    {
      "id": "ros2-docs-key",
      "type": "promptString",
      "description": "ROS2-Docs API key",
      "password": true
    }
  ],
  "servers": {
    "ros2-docs": {
      "type": "http",
      "url": "https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${input:ros2-docs-key}"
      }
    }
  }
}
```

Example question:

```text
Search the Jazzy tf2 documentation for transform listener usage.
```

## MCP Inspector

Inspector is supported for diagnostics:

```bash
npx @modelcontextprotocol/inspector --cli \
  https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp \
  --transport http --method tools/list \
  --header "Authorization: Bearer $MCP_API_KEY"
```

## Errors

- `401`: key missing, invalid, or revoked.
- `403`: browser origin not allow-listed.
- `429`: daily allowance exhausted; retry after UTC midnight.
- `500` or `503`: service failure; retry later and report the failure time.

To request beta access, open a GitHub issue titled `Beta access request`. Never
include credentials in an issue; keys must be delivered privately.
