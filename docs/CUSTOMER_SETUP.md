# Customer setup

Endpoint:

```text
https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp
```

Each beta user receives an individual `r2d_...` key with a 75-request daily
allowance that resets at UTC midnight. Never commit or post the key publicly.

## Officially supported clients

- Claude Code
- Visual Studio Code

MCP Inspector is supported as an operator diagnostic client.

## Claude Code

Set `ROS2_DOCS_MCP_API_KEY` in your environment, then create `.mcp.json` in
your project:

```json
{
  "mcpServers": {
    "ros2-docs": {
      "type": "http",
      "url": "https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${ROS2_DOCS_MCP_API_KEY}"
      }
    }
  }
}
```

Start Claude Code and approve the project MCP server when prompted. Use `/mcp`
to confirm that `ros2-docs` is connected.

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

To request beta access, use the
[beta access form](https://github.com/Hamdan-AS/ros2-docs-mcp/issues/new?template=beta-access.yml).
Never include credentials in an issue; keys must be delivered privately.
