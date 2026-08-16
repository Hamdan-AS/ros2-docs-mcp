import type { CreditQuotaResult } from "./repository.js";

export type MessageLocale = "en" | "ur-Latn";
export type SignupMode = "disabled" | "operator_test" | "public";

const SOUTH_ASIAN_COUNTRIES = new Set(["PK", "IN", "BD", "LK", "NP", "BT", "MV"]);

export function localeForCountry(country: string | null | undefined): MessageLocale {
  return country && SOUTH_ASIAN_COUNTRIES.has(country.toUpperCase()) ? "ur-Latn" : "en";
}

export function signupMode(value: string | undefined): SignupMode {
  return value === "operator_test" || value === "public" ? value : "disabled";
}

export function supportUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || (hostname !== "patreon.com" && !hostname.endsWith(".patreon.com"))) {
      return undefined;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function quotaError(locale: MessageLocale): string {
  return locale === "ur-Latn"
    ? "Credits khatam ho gaye hain. Yeh free, self-funded service hai; aakhri credit use hone ke baad access 48 ghantay ke liye pause hota hai."
    : "Credits are exhausted. This is a free, self-funded service; access pauses for 48 hours after the final credit is used.";
}

export function quotaHeaders(limit: number, quota: CreditQuotaResult): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(Math.max(0, limit - quota.credits_used)),
  };
  if (quota.cooldown_until) headers["x-ratelimit-reset-at"] = quota.cooldown_until;
  if (quota.allowed && quota.credits_used >= limit) {
    headers["x-ros2-docs-warning"] = "Last credit consumed; cooldown started";
  }
  return headers;
}
