import { pool } from "./db.js";
import { cleanupSummary, deleteExpiredUsage } from "./usage-retention.js";

try {
  if (process.argv.length > 2) {
    throw new Error("Usage: npm run usage:cleanup");
  }

  const deletedRows = await deleteExpiredUsage(pool);
  console.log(cleanupSummary(deletedRows));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Usage cleanup failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
