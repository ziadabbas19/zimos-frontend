/**
 * Locale configuration for the marketing site.
 *
 * Two locales only, routed by the first path segment (`/ar/…`, `/en/…`).
 * Arabic is the default and renders right-to-left.
 */

export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

export type Direction = "rtl" | "ltr";

const directions: Record<Locale, Direction> = {
  ar: "rtl",
  en: "ltr",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): Direction {
  return directions[locale];
}

/** The other locale — used by the language switcher. */
export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}
