import { hashSignupValue, normalizeEmail } from "./signup.js";

const [email] = process.argv.slice(2);
const pepper = process.env.OTP_PEPPER;

try {
  if (!email || process.argv.length !== 3) throw new Error("Usage: npm run signup:hash-email -- operator@example.com");
  if (!pepper || pepper.length < 32) throw new Error("OTP_PEPPER must contain at least 32 characters.");
  console.log(await hashSignupValue(`allow:${normalizeEmail(email)}`, pepper));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Allow-list hash generation failed.");
  process.exitCode = 1;
}
