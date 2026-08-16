import { pool } from "./db.js";
import { deleteStaleSignups, signupCleanupSummary } from "./signup-retention.js";

try {
  if (process.argv.length > 2) throw new Error("Usage: npm run signup:cleanup");
  console.log(signupCleanupSummary(await deleteStaleSignups(pool)));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Signup cleanup failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
