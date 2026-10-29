import type { Locale } from "@/i18n/config";

const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-EG" : "en-US");

/** Decimal places of a currency's minor unit (EGP/USD 2, JPY 0, KWD 3), from Intl. */
function minorUnitDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * A price from the API — minor units of its currency — as a reader sees it,
 * divided by the currency's own unit: 79900 EGP → "799 ج.م.‏" / "EGP 799".
 * Whole amounts show no decimals.
 */
export function formatPrice(minor: number, currency: string, locale: Locale): string {
  const digits = minorUnitDigits(currency);
  const value = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : digits,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** "14" for "{days}-day", "١٤ يومًا" in Arabic, with the noun agreeing with its count. */
export function formatDays(days: number, locale: Locale): string {
  if (locale === "en") return String(days);
  const n = formatNumber(days, locale);
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

/**
 * A number of orders after "first" / "أول": "order", "10 orders" in English;
 * in Arabic the noun agrees with the count as it follows أول — "طلب",
 * "طلبين", "١٠ طلبات", "١١ طلبا", "١٠٠ طلب".
 */
export function formatOrderCount(count: number, locale: Locale): string {
  const n = formatNumber(count, locale);
  if (locale === "en") return count === 1 ? "order" : `${n} orders`;
  if (count === 1) return "طلب";
  if (count === 2) return "طلبين";
  const lastTwo = count % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return `${n} طلبات`;
  if (lastTwo >= 11) return `${n} طلبا`;
  return `${n} طلب`;
}

/** 2026-10-01 → "1 October 2026" / "١ أكتوبر ٢٠٢٦". */
export function formatLongDate(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
