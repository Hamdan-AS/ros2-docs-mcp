# ROS2-Docs MCP customer site

The small public-beta landing and setup site for ROS2-Docs MCP. It contains
product facts, supported-client configuration, beta access, service limits,
a dedicated privacy policy, and the live health link. It does not issue or
store keys. Production runs as the `ros2-docs-mcp-site` Cloudflare Worker with
bundled static assets.

## Prerequisites

- Node.js `>=22.13.0`

## Local development

```bash
npm install
npm run dev
npm run build
```

## Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build and verify the rendered customer page
- `npm run lint`: run the source lint checks
- `npm run deploy`: build and deploy the site through Wrangler

Pushes that touch `site/**` are validated and deployed by
`.github/workflows/deploy-site.yml` using the repository's Cloudflare account
and API-token secrets.
