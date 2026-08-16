# Customer setup

Endpoint:

```text
https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp
```

Each beta user receives an individual `r2d_...` key with 75 credits. Credits do
not expire on a schedule. Consuming the 75th credit starts a 48-hour cooldown.
Never commit or post the key publicly.

## Get beta access

Public signup opens only after a production email domain is verified. After
production enablement, open
`https://ros2-docs-mcp-site.sidiquihamdan148.workers.dev/signup`, complete
the Turnstile check, and verify the six-digit code emailed to you. The code is
valid for 10 minutes. Three incorrect attempts pause verification for two hours;
resends wait 60 seconds and are limited to three per two hours. A successful
verification privately emails one key. Repeating signup does not reveal or
replace an existing active key.

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
- `429`: all credits were consumed and the 48-hour cooldown is active; use the
  response's `reset_at` timestamp or `Retry-After` header before retrying.
- `500` or `503`: service failure; retry later and report the failure time.

The final successful credit returns quota headers warning that cooldown has
started. Capacity messages use English by default and Roman Urdu for the South
Asian country set reported by Cloudflare. A Patreon link, when configured, is
voluntary and never changes access or quotas.

For lost or revoked keys, email `qwerty_786@protonmail.com`. Raw keys cannot be
recovered because the service stores only hashes. Never include a key in a
public issue, screenshot, or support message.
