/**
 * Coerces an integer minor-unit amount to a number. Postgres BIGINT columns
 * come back as strings over JSON, so every amount from the API is `string | number`.
 * Returns 0 for null/undefined/non-numeric input.
 */
export function parseMoney(amountMinorUnits: number | string | null | undefined): number {
  if (amountMinorUnits === null || amountMinorUnits === undefined) return 0;
  const n = typeof amountMinorUnits === "string" ? Number(amountMinorUnits) : amountMinorUnits;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formats an integer minor-unit amount (piastres/cents) as a display string.
 * Handles the fact that Postgres BIGINT columns come back as strings.
 */
export function formatMoney(
  amountMinorUnits: number | string | null | undefined,
  currency = "EGP",
  locale = "ar-EG"
): string {
  const n = parseMoney(amountMinorUnits);
  const major = n / 100;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/**
 * Formats a low–high minor-unit range, collapsing to a single value when equal.
 * Used for a product's price range across its variants.
 */
export function formatMoneyRange(
  lowMinorUnits: number | string | null | undefined,
  highMinorUnits: number | string | null | undefined,
  currency = "EGP",
  locale = "ar-EG"
): string {
  const low = parseMoney(lowMinorUnits);
  const high = parseMoney(highMinorUnits);
  if (low === high) return formatMoney(low, currency, locale);
  return `${formatMoney(low, currency, locale)} – ${formatMoney(high, currency, locale)}`;
}
