import { formatMoney as formatMoneyIn, formatMoneyRange, parseMoney } from "@store-builder/api-client";
import type { OrderAddressSnapshot, Variant } from "@store-builder/api-client";
import { getIntlLocale, getLocale } from "@/i18n/LocaleContext";

export { formatMoneyRange, parseMoney };

/**
 * Integer minor units -> display string, in the app's language: Arabic
 * digits under "ar", Latin digits under "en". Both use the Egyptian region
 * (ar-EG / en-EG). An explicit `locale` still wins.
 */
export function formatMoney(
  amountMinorUnits: number | string | null | undefined,
  currency = "EGP",
  locale: string = getLocale() === "ar" ? "ar-EG" : "en-EG"
): string {
  return formatMoneyIn(amountMinorUnits, currency, locale);
}

/**
 * Display form of a product's `productCode`, e.g. "#482910573". Returns null
 * when the field is absent (older responses / backend not deployed) so callers
 * can skip rendering the label entirely. Tolerates a value that already has a
 * leading "#".
 */
export function formatProductCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = String(code).replace(/^#/, "").trim();
  return digits ? `#${digits}` : null;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(getIntlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(getIntlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** { Size: "M", Color: "Red" } -> "Size: M · Color: Red" */
export function formatOptions(options: Record<string, string> | null | undefined): string {
  if (!options) return "";
  const entries = Object.entries(options);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export function formatAddress(address: OrderAddressSnapshot | null | undefined): string {
  if (!address) return "No shipping address";
  return [address.addressLine, address.city, address.province, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
}

/** Human label for a variant in a picker: options, or SKU, or a short id. */
export function variantLabel(variant: Variant): string {
  const opts = formatOptions(variant.optionValues);
  if (opts) return opts;
  if (variant.sku) return variant.sku;
  return `Variant ${variant.id.slice(0, 8)}`;
}

const HUMANIZE: Record<string, string> = {
  partially_paid: "Partially paid",
  partially_refunded: "Partially refunded",
  partially_fulfilled: "Partially fulfilled",
  out_for_delivery: "Out for delivery",
  in_transit: "In transit",
  picked_up: "Picked up",
  no_longer_wanted: "No longer wanted",
  not_as_described: "Not as described",
  wrong_item: "Wrong item",
  arrived_late: "Arrived late",
  bank_transfer: "Bank transfer",
  cod: "Cash on delivery",
};

/** "partially_paid" -> "Partially paid" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  if (HUMANIZE[value]) return HUMANIZE[value];
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

// --- Money input helpers: the API speaks integer minor units (piastres) -----

/** "199.50" (major units, as typed) -> 19950 (integer minor units). NaN if unparseable. */
export function majorToMinor(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return NaN;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

/** 19950 (minor units, string or number) -> "199.50" for an editable field. */
export function minorToMajorInput(minor: string | number | null | undefined): string {
  if (minor === null || minor === undefined || minor === "") return "";
  const n = parseMoney(minor);
  return (n / 100).toFixed(2);
}

// --- Percentage helpers: the API speaks basis points where 100 = 1% --------
// (10% -> 1000, 100% -> 10000). Same maths as the money helpers above but a
// distinct name so call sites read correctly.

/** "10" or "12.5" (percent, as typed) -> 1000 / 1250 (integer basis points). NaN if unparseable. */
export function percentToBasisPoints(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return NaN;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

/** 1000 (basis points, string or number) -> "10" for an editable percent field. */
export function basisPointsToPercentInput(bp: string | number | null | undefined): string {
  if (bp === null || bp === undefined || bp === "") return "";
  const n = typeof bp === "number" ? bp : Number(bp);
  if (!Number.isFinite(n)) return "";
  return String(n / 100);
}

/** 1000 (basis points, string or number) -> "10%" for display. */
export function formatPercent(bp: string | number | null | undefined): string {
  const text = basisPointsToPercentInput(bp);
  return text === "" ? "—" : `${text}%`;
}

/**
 * 0.1234 -> "12.3%". Takes a ratio (not basis points) — used for
 * period-over-period deltas on <KpiCard>, where the change is already a
 * fraction. `formatPercent` above is the basis-points variant the discount
 * and tax screens use.
 */
export function formatPercentValue(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}
