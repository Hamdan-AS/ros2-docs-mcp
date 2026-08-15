import type { ApiAccessRepository, AuthenticatedUser, CreditQuotaResult } from "./repository.js";

const encoder = new TextEncoder();

export function bearerToken(header: string | null): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer (r2d_[A-Za-z0-9_-]{20,})$/.exec(header);
  return match?.[1];
}

export async function hashApiKey(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function authenticateBearer(
  header: string | null,
  repository: ApiAccessRepository
): Promise<{ user: AuthenticatedUser; keyHash: string } | undefined> {
  const token = bearerToken(header);
  if (!token) return undefined;
  const keyHash = await hashApiKey(token);
  const user = await repository.findUserByKeyHash(keyHash);
  if (!user) return undefined;
  await repository.markKeyUsed(keyHash);
  return { user, keyHash };
}

export function effectiveCreditLimit(
  user: Pick<AuthenticatedUser, "credit_limit">,
  defaultLimit: number
): number {
  const override = user.credit_limit;
  return Number.isInteger(override) && (override ?? 0) > 0 ? override! : defaultLimit;
}

export async function consumeQuota(
  userId: number,
  limit: number,
  repository: ApiAccessRepository
): Promise<CreditQuotaResult> {
  return repository.consumeCredit(userId, limit);
}
