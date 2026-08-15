import { neon } from "@neondatabase/serverless";

import type {
  ApiAccessRepository,
  AuthenticatedUser,
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
      `SELECT u.id, u.tier, u.daily_limit
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

  async consumeDailyQuota(userId: number, day: string, limit: number): Promise<number | undefined> {
    const rows = await this.sql.query<false, false>(
      `INSERT INTO api_daily_usage (user_id, usage_date, request_count)
       VALUES ($1, $2::date, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET request_count = api_daily_usage.request_count + 1
         WHERE api_daily_usage.request_count < $3
       RETURNING request_count`,
      [userId, day, limit]
    ) as Array<{ request_count: number }>;
    return rows[0]?.request_count;
  }
}
