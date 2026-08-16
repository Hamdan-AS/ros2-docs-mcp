export interface SignupCleanupDatabase {
  query(sql: string): Promise<{ rowCount: number | null }>;
}

export const DELETE_STALE_SIGNUPS_SQL = `
DELETE FROM api_signup_verifications
WHERE (verified_at IS NOT NULL AND updated_at < now() - INTERVAL '7 days')
   OR (verified_at IS NULL
       AND updated_at < now() - INTERVAL '24 hours'
       AND (banned_until IS NULL OR banned_until <= now()))
`;

export async function deleteStaleSignups(database: SignupCleanupDatabase): Promise<number> {
  const result = await database.query(DELETE_STALE_SIGNUPS_SQL);
  return result.rowCount ?? 0;
}

export function signupCleanupSummary(deletedRows: number): string {
  return `Deleted ${deletedRows} stale signup row${deletedRows === 1 ? "" : "s"}.`;
}
