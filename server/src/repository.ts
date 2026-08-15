/** Runtime-neutral data contracts shared by the Node and Worker servers. */
export interface DocSearchResult {
  distro: string;
  package: string;
  section_title: string;
  content: string;
  source_url: string;
}

export interface DocsRepository {
  searchDocs(query: string, distro: string | undefined, limit: number): Promise<DocSearchResult[]>;
}

export interface AuthenticatedUser {
  id: number;
  tier: string;
  /** Optional operator override used for isolated quota tests or custom tiers. */
  credit_limit: number | null;
}

export interface CreditQuotaResult {
  allowed: boolean;
  credits_used: number;
  cooldown_until: string | null;
}

export interface ApiAccessRepository {
  findUserByKeyHash(keyHash: string): Promise<AuthenticatedUser | undefined>;
  markKeyUsed(keyHash: string): Promise<void>;
  /** Atomically consumes one credit or reports the active cooldown. */
  consumeCredit(userId: number, limit: number): Promise<CreditQuotaResult>;
}
