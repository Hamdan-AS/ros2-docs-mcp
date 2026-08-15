# ROS2-Docs MCP customer site

The small public-beta landing and setup site for ROS2-Docs MCP. It contains
product facts, supported-client configuration, beta access, service limits,
privacy wording, and the live health link. It does not issue or store keys.

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
