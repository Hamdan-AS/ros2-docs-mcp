import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DISTROS } from "./distros.js";
import type { DocsRepository, DocSearchResult } from "./repository.js";

export const searchDocsInputSchema = {
  query: z.string().trim().min(1).max(500).describe("The documentation topic to search for."),
  distro: z
    .enum(["humble", "jazzy", "lyrical"])
    .optional()
    .describe("Filter results to one distro. Default: all indexed distros."),
  limit: z.number().int().min(1).max(20).optional().describe("Max results. Default 5."),
};

export function formatSearchResults(rows: DocSearchResult[]): string {
  return rows.length === 0
    ? "No matches found."
    : rows
        .map(
          (row) =>
            `[${row.distro}/${row.package}] ${row.section_title}\n` +
            `${row.content}\n` +
            `Source: ${row.source_url}\n`
        )
        .join("\n---\n");
}

export function buildServer(repository: DocsRepository, options: { includeDiagnostics?: boolean } = {}): McpServer {
  const server = new McpServer({
    name: "ros2-docs",
    version: "0.2.0",
  });

  if (options.includeDiagnostics) {
    server.registerTool(
      "count_words",
      {
        description: "Diagnostic-only: count words in text.",
        inputSchema: { text: z.string().describe("The text to count words in.") },
      },
      async ({ text }) => ({ content: [{ type: "text", text: `Word count: ${text.trim().split(/\s+/).filter(Boolean).length}` }] })
    );
  }

  server.registerTool(
    "search_docs",
    {
      description:
        "Full-text search over indexed ROS 2 documentation. Returns the most relevant sections with their source URLs.",
      inputSchema: searchDocsInputSchema,
    },
    async ({ query, distro, limit }) => {
      const lim = limit ?? 5;
      const rows = await repository.searchDocs(query, distro, lim);
      return {
        content: [{ type: "text", text: formatSearchResults(rows) }],
      };
    }
  );

  server.registerTool(
    "get_distro_status",
    {
      description:
        "Return lifecycle (release / EOL / LTS) status for ROS 2 distributions. EOL data from REP 2000 (see config/distros.yaml).",
      inputSchema: {},
    },
    async () => {
      const lines = DISTROS.map(
        (d) =>
          `${d.name} (${d.full_name})` +
          ` | released: ${d.released ?? "-"}` +
          ` | EOL: ${d.eol ?? "-"}` +
          ` | LTS: ${d.lts}` +
          ` | indexed: ${d.in_scope}` +
          (d.note ? ` | note: ${d.note}` : "")
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  return server;
}
