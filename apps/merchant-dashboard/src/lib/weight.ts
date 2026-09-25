import { MAX_WEIGHT_GRAMS } from "@store-builder/api-client";
import { getIntlLocale } from "@/i18n/LocaleContext";

// The API speaks integer grams; merchants type and read kilograms.

/** "1.25" (kg, as typed) -> 1250 g. null when empty, NaN when not a valid weight. */
export function kgInputToGrams(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed === "") return null;
  const kg = Number(trimmed);
  if (!Number.isFinite(kg) || kg < 0) return NaN;
  const grams = Math.round(kg * 1000);
  return grams > MAX_WEIGHT_GRAMS ? NaN : grams;
}

/** 1250 -> "1.25" for an editable kg field; "" when unset. */
export function gramsToKgInput(grams: number | null | undefined): string {
  if (grams === null || grams === undefined) return "";
  return String(grams / 1000);
}

/** 1250 -> "1.25" in the active locale (no unit). */
export function formatKg(grams: number): string {
  return new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 3 }).format(grams / 1000);
}
