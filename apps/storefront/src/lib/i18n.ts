import { formatWithFormat, isCustomFormat, requestMoneyFormat, type MoneyFormat } from "./moneyFormat";
import { formatMoney } from "@store-builder/api-client";
import type { Dictionary } from "./i18nEn";

export type { Dictionary } from "./i18nEn";

/**
 * Storefront UI strings. Every customer-facing label lives in lib/i18nEn.ts,
 * lib/i18nAr.ts and lib/i18nFr.ts, so pages never hard-code copy.
 * Merchant-authored content (product names, descriptions, page trees) is shown
 * as written and is not translated.
 *
 * Server components: `getDictionary(locale)`.
 * Client components: `useStore().t` (src/lib/StoreContext.tsx).
 */

// French (lib/i18nFr.ts): a store whose default language is French opens in it (SPEC §8.10).
export type Locale = "ar" | "en" | "fr";
export const LOCALES: readonly Locale[] = ["ar", "en", "fr"] as const;
export const DEFAULT_LOCALE: Locale = "ar";
export { LOCALE_COOKIE } from "./localeCookie";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en" || value === "fr";
}

/** "ar-EG", "en", "en-US" … → the UI locale; anything else → null. */
export function parseLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** BCP-47 tag for Intl formatting — the storefront serves Egyptian merchants. */
export function intlLocaleFor(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : locale === "fr" ? "fr" : "en-EG";
}

/**
 * A component's own strings by language ({ ar, en } and maybe fr): a language
 * it has no strings for reads English, except Arabic itself.
 */
export function pickText<T extends { ar: unknown; en: unknown; fr?: unknown }>(texts: T, locale: Locale): T["ar"] | T["en"] {
  if (locale === "fr" && texts.fr !== undefined) return texts.fr as T["en"];
  return locale === "ar" ? texts.ar : texts.en;
}

/**
 * The interface languages the language switch goes through: Arabic and
 * English always, French when the store offers it (dashboard → Languages,
 * GET /store/:ws `languages`).
 */
export function switchLocales(storeLanguages: readonly string[] | null | undefined): Locale[] {
  return (storeLanguages ?? []).some((l) => parseLocale(l) === "fr") ? ["ar", "en", "fr"] : ["ar", "en"];
}

/** The language after `current` in the switch, and how the switch shows and says it. */
export function nextLocale(current: Locale, storeLanguages: readonly string[] | null | undefined): Locale {
  const list = switchLocales(storeLanguages);
  return list[(list.indexOf(current) + 1) % list.length] ?? "ar";
}
export const LOCALE_SHORT: Record<Locale, string> = { ar: "ع", en: "EN", fr: "FR" };
export function switchLabel(t: Dictionary, next: Locale): string {
  return next === "en" ? t.common.switchToEnglish : next === "fr" ? t.common.switchToFrench : t.common.switchToArabic;
}

/** For data written in Arabic and English only (governorates, merchant labels): French reads English. */
export function arOrEn(locale: Locale): "ar" | "en" {
  return locale === "ar" ? "ar" : "en";
}

export function formatPrice(
  amountMinor: number | string | null | undefined,
  currency: string,
  locale: Locale,
  /** The store's currency format; on the server the page renderer's, when not given (lib/moneyFormat). */
  format: MoneyFormat | null = requestMoneyFormat()
): string {
  if (isCustomFormat(format)) return formatWithFormat(amountMinor, currency, intlLocaleFor(locale), format);
  return formatMoney(amountMinor, currency, intlLocaleFor(locale));
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocaleFor(locale)).format(value);
}

/*
 * A visit downloads its own language only. The server (server components and
 * the server render of client components alike) has every dictionary from the
 * start; in the browser each is a chunk of its own, which StoreContext waits
 * for before it hydrates (lib/dictionaryChunks.tsx), the server's HTML staying
 * as it is until then.
 */
const loaded: Partial<Record<Locale, Dictionary>> = {};
let loader: ((locale: Locale) => Promise<Dictionary>) | null = null;

// (Under vitest, which has no such bundler, src/test/setup.ts hands them over instead.)
if (typeof window === "undefined" && !process.env.VITEST) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- only on the server, so no browser chunk holds every language.
  Object.assign(loaded, (require("./i18nAll") as typeof import("./i18nAll")).ALL_DICTIONARIES);
}

/** lib/dictionaryChunks.tsx, as a language's chunk arrives. */
export function registerDictionary(locale: Locale, dictionary: Dictionary): void {
  loaded[locale] = dictionary;
}

/** lib/dictionaryChunks.tsx: how to ask for a language's chunk. */
export function setDictionaryLoader(next: (locale: Locale) => Promise<Dictionary>): void {
  loader = next;
}

/** The dictionary when it is already here (always, on the server), else null: see useDictionary. */
export function loadedDictionary(locale: Locale): Dictionary | null {
  return loaded[locale] ?? null;
}

/**
 * Works anywhere — server components, client components, plain modules. In the
 * browser every caller sits under StoreContext, so the store's language is
 * here; a language that is not (only the other language's line on two pages
 * asks for one, and those use useDictionary) reads as the one that is, rather
 * than breaking a click.
 */
export function getDictionary(locale: Locale): Dictionary {
  const found = loaded[locale] ?? loaded[DEFAULT_LOCALE] ?? Object.values(loaded)[0];
  if (found) {
    if (!loaded[locale] && isLocale(locale) && loader) void loader(locale).catch(() => undefined);
    return found;
  }
  // Nothing here yet, while rendering: React waits for it and renders again.
  if (loader) throw loader(locale);
  throw new Error("No dictionary is loaded yet");
}
