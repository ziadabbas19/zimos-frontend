import { dateLocale, getActiveLocale } from "../i18n/activeLocale.ts";
/**
 * Formatting helpers. Plan prices carry their own currency (`plans.currency`),
 * so money formatters take one rather than assuming a single platform
 * currency; the fallback only applies where no currency is known.
 */
export const PLATFORM_CURRENCY = "EGP";

// Intl formatters are expensive to construct — one per currency, reused.
const moneyFmts = new Map<string, Intl.NumberFormat>();
const compactMoneyFmts = new Map<string, Intl.NumberFormat>();

function moneyFmt(currency: string): Intl.NumberFormat {
  let f = moneyFmts.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 });
    moneyFmts.set(currency, f);
  }
  return f;
}

function compactMoneyFmt(currency: string): Intl.NumberFormat {
  let f = compactMoneyFmts.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    compactMoneyFmts.set(currency, f);
  }
  return f;
}

const numberFmt = new Intl.NumberFormat("en");
const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatMoney(value: number, currency: string = PLATFORM_CURRENCY): string {
  return moneyFmt(currency).format(value);
}

export function formatMoneyCompact(value: number, currency: string = PLATFORM_CURRENCY): string {
  return compactMoneyFmt(currency).format(value);
}

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

export function formatCompact(value: number): string {
  return compactFmt.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Basis points → "2.50%". */
export function formatBp(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(dateLocale(), { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(dateLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return getActiveLocale() === "ar" ? "الآن" : "just now";
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(iso);
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

/** yyyy-mm-ddThh:mm (local) for <input type="datetime-local">. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

// ------------------------------------------------------------ minor units

/**
 * How many decimal places a currency's minor unit occupies (USD/EGP 2, JPY 0,
 * KWD 3). Read from Intl rather than assumed to be 2, and cached because
 * constructing a formatter to ask is not cheap.
 */
const minorDigits = new Map<string, number>();

export function minorUnitDigits(currency: string): number {
  let digits = minorDigits.get(currency);
  if (digits === undefined) {
    // The shared formatters pin maximumFractionDigits to 0, so this asks a
    // clean one for the currency's own default instead.
    // Typed as optional because it is absent for non-currency formatters; for
    // a currency one it is always the currency's own exponent. Falls back to
    // the near-universal 2 rather than to 0, which would silently render an
    // amount 100x too high on the one path this helper exists to get right.
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    minorDigits.set(currency, digits);
  }
  return digits;
}

/**
 * Minor units (piasters, cents) → a formatted amount.
 *
 * Every money field on the `/admin` surface is stored and served in minor
 * units: `plans.monthly_price_amount` is a BIGINT of 29900 for a $299.00 plan,
 * and `AdminSubscription.mrr` and the overview's `mrr`/`gmv30d` follow it.
 * Passing those straight to `formatMoney` renders them 100x too high: every
 * figure the API sends goes through one of the `formatMinorMoney*` helpers,
 * and the only division by the minor unit happens there (or in the two
 * converters below, for form inputs).
 */
export function formatMinorMoney(minor: number, currency: string = PLATFORM_CURRENCY): string {
  return formatMoney(toMajorAmount(minor, currency), currency);
}

/** Minor units → the amount a person reads and types (29900 USD → 299). */
export function toMajorAmount(minor: number, currency: string = PLATFORM_CURRENCY): number {
  return minor / 10 ** minorUnitDigits(currency);
}

/** An amount a person typed → minor units, rounded to the currency's own unit (299.5 USD → 29950). */
export function toMinorAmount(major: number, currency: string = PLATFORM_CURRENCY): number {
  return Math.round(major * 10 ** minorUnitDigits(currency));
}

const exactMoneyFmts = new Map<string, Intl.NumberFormat>();

/**
 * Minor units → an amount with the currency's own decimals ($80.73, not $81).
 * For ledgers and invoices, where the rounding `formatMinorMoney` does for
 * headline figures would misstate the amount owed.
 */
export function formatMinorMoneyExact(minor: number, currency: string = PLATFORM_CURRENCY): string {
  let f = exactMoneyFmts.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en", { style: "currency", currency });
    exactMoneyFmts.set(currency, f);
  }
  return f.format(minor / 10 ** minorUnitDigits(currency));
}

export function formatMinorMoneyCompact(
  minor: number,
  currency: string = PLATFORM_CURRENCY
): string {
  return formatMoneyCompact(minor / 10 ** minorUnitDigits(currency), currency);
}

/** A 0..1 fraction → "94.2%". Distinct from `formatPercent`, which takes 0..100. */
export function formatRate(fraction: number, digits = 1): string {
  return formatPercent(fraction * 100, digits);
}

// ------------------------------------------------------------ chart labels

/**
 * An ISO bucket key from a metrics series → a short display label.
 *
 * Handles exactly the two shapes the overview endpoint commits to —
 * "2026-09-16" (daily) and "2026-09" (monthly) — and passes anything else
 * through untouched. The match is an explicit pattern test rather than a
 * `new Date()` parse attempt: strings like "Sep 2026" also parse, so sniffing
 * would silently rewrite labels that were already display-ready.
 *
 * Formatted in UTC because the server buckets in UTC. Formatting in local time
 * would shift a bucket across midnight and label the wrong day.
 */
export function formatChartLabel(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return new Date(`${label}T00:00:00Z`).toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    return new Date(`${label}-01T00:00:00Z`).toLocaleDateString("en", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return label;
}
