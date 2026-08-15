import { neon } from "@neondatabase/serverless";

import type {
  ApiAccessRepository,
  AuthenticatedUser,
  CreditQuotaResult,
  DocSearchResult,
  DocsRepository,
} from "./repository.js";
import { buildDocsSearchQuery } from "./search-query.js";

/** Neon HTTP repository.  It uses fetch, so it is safe in Cloudflare Workers. */
export class NeonHttpRepository implements DocsRepository, ApiAccessRepository {
  private readonly sql;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async searchDocs(query: string, distro: string | undefined, limit: number): Promise<DocSearchResult[]> {
    const { sql, params } = buildDocsSearchQuery(query, distro, limit);
    return (await this.sql.query(
      sql,
      params
    )) as DocSearchResult[];
  }

  async findUserByKeyHash(keyHash: string): Promise<AuthenticatedUser | undefined> {
    const rows = await this.sql.query<false, false>(
      `SELECT u.id, u.tier, u.credit_limit
         FROM api_keys k
         JOIN users u ON u.id = k.user_id
        WHERE k.key_hash = $1`,
      [keyHash]
    ) as AuthenticatedUser[];
    return rows[0];
  }

  async markKeyUsed(keyHash: string): Promise<void> {
    await this.sql.query("UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1", [keyHash]);
  }

  async consumeCredit(userId: number, limit: number): Promise<CreditQuotaResult> {
    const rows = await this.sql.query<false, false>(
      `SELECT allowed, credits_used, cooldown_until
         FROM consume_api_credit($1, $2)`,
      [userId, limit]
    ) as CreditQuotaResult[];
    const result = rows[0];
    if (!result) throw new Error("Quota function returned no result.");
    return result;
  }
}
