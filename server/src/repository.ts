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
  daily_limit: number | null;
}

export interface ApiAccessRepository {
  findUserByKeyHash(keyHash: string): Promise<AuthenticatedUser | undefined>;
  markKeyUsed(keyHash: string): Promise<void>;
  /**
   * Atomically consumes one request for this UTC date.  Undefined means the
   * user had already reached the supplied limit.
   */
  consumeDailyQuota(userId: number, day: string, limit: number): Promise<number | undefined>;
}
