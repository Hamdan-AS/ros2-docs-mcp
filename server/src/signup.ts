import type { SignupRepository } from "./repository.js";

const encoder = new TextEncoder();

export class SignupInputError extends Error {}
export class SignupUnavailableError extends Error {}

export interface SignupDependencies {
  repository: SignupRepository;
  otpPepper: string;
  verifyHuman(token: string, action: "signup" | "verify", remoteIp?: string): Promise<boolean>;
  emailAllowed(email: string): Promise<boolean>;
  sendOtp(email: string, otp: string): Promise<void>;
  sendKey(email: string, apiKey: string, idempotencyKey: string): Promise<void>;
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new SignupInputError("Invalid signup input.");
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SignupInputError("Invalid signup input.");
  }
  return email;
}

function requiredString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw new SignupInputError("Invalid signup input.");
  }
  return value;
}

export async function hashSignupValue(value: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateOtp(): string {
  // Rejection sampling avoids modulo bias while keeping the OTP uniformly random.
  const bytes = new Uint8Array(6);
  let output = "";
  while (output.length < 6) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 250) output += String(byte % 10);
      if (output.length === 6) break;
    }
  }
  return output;
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `r2d_${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

export function secureHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length || !/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function requestSignup(
  input: { email?: unknown; turnstileToken?: unknown },
  dependencies: SignupDependencies,
  remoteIp?: string
): Promise<void> {
  const email = normalizeEmail(input.email);
  const turnstileToken = requiredString(input.turnstileToken, 4096);
  if (!(await dependencies.verifyHuman(turnstileToken, "signup", remoteIp))) {
    throw new SignupInputError("Invalid signup input.");
  }
  if (!(await dependencies.emailAllowed(email))) return;

  const otp = generateOtp();
  const otpHash = await hashSignupValue(`${email}:${otp}`, dependencies.otpPepper);
  const shouldSend = await dependencies.repository.beginSignup(email, otpHash);
  if (!shouldSend) return;

  try {
    await dependencies.sendOtp(email, otp);
  } catch {
    await dependencies.repository.cancelSignup(email, otpHash);
    throw new SignupUnavailableError("Signup email delivery failed.");
  }
}

export async function verifySignup(
  input: { email?: unknown; otp?: unknown; turnstileToken?: unknown },
  dependencies: SignupDependencies,
  remoteIp?: string
): Promise<void> {
  const email = normalizeEmail(input.email);
  const otp = requiredString(input.otp, 6);
  if (!/^\d{6}$/.test(otp)) throw new SignupInputError("Invalid signup input.");
  const turnstileToken = requiredString(input.turnstileToken, 4096);
  if (!(await dependencies.verifyHuman(turnstileToken, "verify", remoteIp))) {
    throw new SignupInputError("Invalid signup input.");
  }
  if (!(await dependencies.emailAllowed(email))) return;

  const otpHash = await hashSignupValue(`${email}:${otp}`, dependencies.otpPepper);
  const apiKey = generateApiKey();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const apiKeyHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

  const status = await dependencies.repository.verifySignup(email, otpHash, apiKeyHash);
  if (status !== "issued") return;

  try {
    await dependencies.sendKey(email, apiKey, `signup-key-${apiKeyHash}`);
  } catch {
    await dependencies.repository.rollbackKeyDelivery(email, apiKeyHash, otpHash);
    throw new SignupUnavailableError("Access-key delivery failed.");
  }
}
