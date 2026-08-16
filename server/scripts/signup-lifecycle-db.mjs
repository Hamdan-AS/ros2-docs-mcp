import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) throw new Error("NEON_DATABASE_URL is required.");

const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
const marker = randomUUID();
const email = `signup-acceptance-${marker}@example.invalid`;
const validOtpHash = createHash("sha256").update(`valid-${marker}`).digest("hex");
const keyHash = createHash("sha256").update(`key-${marker}`).digest("hex");

function check(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const first = await pool.query("SELECT should_send FROM begin_api_signup($1, $2)", [email, validOtpHash]);
  check(first.rows[0]?.should_send === true, "First OTP send was not accepted.");
  const immediate = await pool.query("SELECT should_send FROM begin_api_signup($1, $2)", [email, validOtpHash]);
  check(immediate.rows[0]?.should_send === false, "60-second resend throttle was not enforced.");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const wrong = createHash("sha256").update(`wrong-${attempt}-${marker}`).digest("hex");
    const result = await pool.query("SELECT status FROM verify_api_signup($1, $2, $3)", [email, wrong, keyHash]);
    check(result.rows[0]?.status === "invalid", `Wrong OTP attempt ${attempt} was not rejected.`);
  }
  const banned = await pool.query(
    "SELECT failed_attempts, banned_until > now() AS active, otp_hash IS NULL AS otp_cleared FROM api_signup_verifications WHERE email_normalized = $1",
    [email]
  );
  check(banned.rows[0]?.failed_attempts === 3, "Failure counter did not reach three.");
  check(banned.rows[0]?.active === true, "Two-hour ban did not activate.");
  check(banned.rows[0]?.otp_cleared === true, "OTP hash was not cleared on ban.");

  await pool.query(
    `UPDATE api_signup_verifications
        SET banned_until = now() - INTERVAL '1 second',
            send_window_start = now() - INTERVAL '3 hours',
            last_sent_at = now() - INTERVAL '3 hours'
      WHERE email_normalized = $1`,
    [email]
  );
  const retry = await pool.query("SELECT should_send FROM begin_api_signup($1, $2)", [email, validOtpHash]);
  check(retry.rows[0]?.should_send === true, "Expired ban did not allow a fresh OTP.");
  const issued = await pool.query("SELECT status FROM verify_api_signup($1, $2, $3)", [email, validOtpHash, keyHash]);
  check(issued.rows[0]?.status === "issued", "Valid OTP did not issue a key hash.");
  const repeated = await pool.query("SELECT status FROM verify_api_signup($1, $2, $3)", [email, validOtpHash, keyHash]);
  check(repeated.rows[0]?.status === "already_active", "One-active-key guard did not hold.");
  const state = await pool.query(
    `SELECT count(*)::int AS keys, count(q.user_id)::int AS quota_rows
       FROM users u JOIN api_keys k ON k.user_id = u.id
       LEFT JOIN api_quota_state q ON q.user_id = u.id
      WHERE u.email_normalized = $1`,
    [email]
  );
  check(state.rows[0]?.keys === 1 && state.rows[0]?.quota_rows === 1, "Key or quota state was not initialized exactly once.");
  console.log("Signup database lifecycle passed; no raw OTP or API key was generated or logged.");
} finally {
  await pool.query("DELETE FROM users WHERE email_normalized = $1", [email]).catch(() => undefined);
  await pool.query("DELETE FROM api_signup_verifications WHERE email_normalized = $1", [email]).catch(() => undefined);
  await pool.end();
}
