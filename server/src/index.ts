import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { buildServer } from "./mcp.js";
import { NodePostgresDocsRepository } from "./node-repository.js";

const server = buildServer(new NodePostgresDocsRepository(), { includeDiagnostics: true });

const transport = new StdioServerTransport();
await server.connect(transport);
