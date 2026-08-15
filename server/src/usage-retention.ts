/** Database surface needed by the usage-retention cleanup. */
export interface UsageCleanupDatabase {
  query(sql: string): Promise<{ rowCount: number | null }>;
}

export const DELETE_EXPIRED_USAGE_SQL = `
DELETE FROM api_daily_usage
WHERE usage_date < CURRENT_DATE - INTERVAL '90 days'
`;

/** Delete daily usage records older than 90 days, preserving the boundary date. */
export async function deleteExpiredUsage(database: UsageCleanupDatabase): Promise<number> {
  const result = await database.query(DELETE_EXPIRED_USAGE_SQL);
  return result.rowCount ?? 0;
}

export function cleanupSummary(deletedRows: number): string {
  return `Deleted ${deletedRows} usage row${deletedRows === 1 ? "" : "s"} older than 90 days.`;
}
