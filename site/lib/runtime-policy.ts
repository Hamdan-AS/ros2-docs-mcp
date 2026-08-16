export type SiteLocale = "en" | "ur-Latn";

const SOUTH_ASIAN_COUNTRIES = new Set(["PK", "IN", "BD", "LK", "NP", "BT", "MV"]);

export function localeForCountry(country: string | null | undefined): SiteLocale {
  return country && SOUTH_ASIAN_COUNTRIES.has(country.toUpperCase()) ? "ur-Latn" : "en";
}

export function configuredSupportUrl(value: string | null | undefined): string | undefined {
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
