# ROS2-Docs MCP customer site

The small public-beta landing and setup site for ROS2-Docs MCP. It contains
product facts, supported-client configuration, self-serve beta access, service
limits, FAQ, privacy policy, and the live health link. The browser sends signup
input directly to the MCP Worker and never receives or stores an API key; a
verified key is delivered privately by email. Production runs as the
`ros2-docs-mcp-site` Cloudflare Worker with bundled static assets.

The Worker derives English/Roman Urdu quota presentation from Cloudflare's
request country without persisting location. An optional `SUPPORT_URL` is shown
only when it is a valid HTTPS Patreon URL. Public signup remains closed while
the MCP API reports disabled or operator-test mode.

Production: `https://ros2-docs-mcp-site.notriful-beligum.workers.dev/`

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
