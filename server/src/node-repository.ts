import { pool } from "./db.js";
import type { DocSearchResult, DocsRepository } from "./repository.js";
import { buildDocsSearchQuery } from "./search-query.js";

/** Postgres-pool repository used only by local stdio and key provisioning. */
export class NodePostgresDocsRepository implements DocsRepository {
  async searchDocs(query: string, distro: string | undefined, limit: number): Promise<DocSearchResult[]> {
    const { sql, params } = buildDocsSearchQuery(query, distro, limit);
    const { rows } = await pool.query<DocSearchResult>(sql, params);
    return rows;
  }
}
