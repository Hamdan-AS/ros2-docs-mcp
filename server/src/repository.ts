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

export type SignupVerificationStatus = "issued" | "invalid" | "already_active";

export interface SignupRepository {
  /** Atomically applies resend and ban limits and stores the next hashed OTP. */
  beginSignup(email: string, otpHash: string): Promise<boolean>;
  /** Reverses a failed OTP-email attempt without exposing the address publicly. */
  cancelSignup(email: string, otpHash: string): Promise<void>;
  /** Atomically verifies an OTP, enforces the failure ban, and stores a key hash. */
  verifySignup(email: string, otpHash: string, keyHash: string): Promise<SignupVerificationStatus>;
  /** Removes a key whose delivery failed and restores the verified OTP for retry. */
  rollbackKeyDelivery(email: string, keyHash: string, otpHash: string): Promise<void>;
}
