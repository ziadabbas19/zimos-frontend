"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { MoneyFormat } from "./moneyFormat";
import type { XsStorePages } from "./xsStorePages";
import { withStoreWords, type StoreWords } from "./storeWords";
import type {
  CheckoutSettings,
  LegalPolicyKey,
  StorefrontMeta,
  StorefrontOrderBump,
  ThankYouPageSettings,
  StorefrontHoliday,
} from "@store-builder/api-client";
import {
  DEFAULT_LOCALE,
  dirFor,
  formatPrice,
  getDictionary,
  intlLocaleFor,
  type Dictionary,
  type Locale,
} from "./i18n";

export interface StoreInfo {
  /** The route segment the store was reached by — its UUID or its slug. */
  workspaceId: string;
  /** The workspace's real UUID, whichever way the store was reached. */
  id: string;
  slug: string;
  name: string;
  currency: string;
  /** Where the currency symbol goes and whether decimals show (GET /store/:ws `currencyFormat`). */
  currencyFormat?: MoneyFormat | null;
  logoUrl: string | null;
  /** Merchant contact number from themeSettings, if saved. */
  phone: string | null;
  /** The languages the store offers (default first), as GET /store/:ws `languages` gives them; French joins the switch from here. */
  languages?: string[];
  /** Which optional checkout fields the merchant shows/requires (GET /store/:ws `checkout`). */
  checkout: CheckoutSettings;
  /** The thank-you page settings (GET /store/:ws `thankYou`); absent means the built-in page. */
  thankYou?: ThankYouPageSettings;
  /** Which legal policies the store has written (GET /store/:ws `legal`). */
  legal?: LegalPolicyKey[];
  /** The checkout's order bump (GET /store/:ws `orderBump`); null when none can be offered. */
  orderBump: StorefrontOrderBump | null;
  /** The country the store sells in (GET /store/:ws `general.country`), ISO 3166 alpha-2; null when unset. */
  country?: string | null;
  /** Self delivery (GET /store/:ws `delivery`); absent from older APIs. */
  delivery?: StoreDelivery | null;
  /** A store on holiday (GET /store/:ws `holiday`); null or absent while it is open as usual. Read only with HOLIDAY_MODE_ENABLED. */
  holiday?: StorefrontHoliday | null;
  /** On a store that wears an imported template, how its own pages are drawn (lib/xsStorePages.ts); null or absent otherwise. */
  xsPages?: XsStorePages | null;
  /** The store's own words on its shop pages, by language (lib/storeWords.ts). */
  words?: Record<string, StoreWords>;
  /** Whether shoppers may send reviews now, and the store's own stars (GET /store/:ws `reviews`); absent from older APIs. */
  reviews?: StorefrontMeta["reviews"] | null;
}

/** How a store that delivers itself takes orders (GET /store/:ws `delivery`). */
export interface StoreDelivery {
  /** The only governorate codes the store delivers to; null = everywhere. */
  servedGovernorates?: string[] | null;
  /** Pickup from the store, or null while the store does not offer it. */
  pickup?: { address: string; phone: string; note: string } | null;
  /** The store's delivery areas while it prices by them, else null. Fees are minor units. */
  zones?: StoreDeliveryZone[] | null;
  /** Opening hours while the store uses them, with whether it is open right now; else null. */
  hours?: {
    openNow: boolean;
    reason: "manual" | "hours" | null;
    message: string | null;
    /** Closed by the weekly hours: when it opens next, Cairo time (0 = Sunday); null otherwise or on older servers. */
    nextOpen?: StoreNextOpening | null;
  } | null;
  /** The usual delivery time in minutes, or null. */
  etaMinutes?: number | null;
}

export interface StoreNextOpening {
  weekday: number;
  time: string;
  /** 0 = later today, 1 = tomorrow. */
  inDays: number;
}

export interface StoreDeliveryZone {
  id: string;
  name: string;
  feeAmount: number;
  minOrderAmount: number | null;
  etaMinutes: number | null;
}

export interface StoreContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  intlLocale: string;
  t: Dictionary;
  store: StoreInfo | null;
  money: (amountMinor: number | string | null | undefined, currency?: string) => string;
}

function build(locale: Locale, store: StoreInfo | null): StoreContextValue {
  return {
    locale,
    dir: dirFor(locale),
    intlLocale: intlLocaleFor(locale),
    t: withStoreWords(getDictionary(locale), store?.words?.[locale]),
    store,
    money: (amount, currency) => formatPrice(amount, currency ?? store?.currency ?? "EGP", locale, store?.currencyFormat ?? null),
  };
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Hands the resolved locale and a few store facts to client components. Only
 * serialisable values cross the server→client boundary; the dictionary (which
 * holds functions) is looked up again on this side.
 */
export function StoreContextProvider({
  locale,
  store,
  children,
}: {
  locale: Locale;
  store: StoreInfo;
  children: ReactNode;
}) {
  const value = useMemo(() => build(locale, store), [locale, store]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Outside a store (e.g. a 404 above the store layout) this falls back to Arabic. */
export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  return useMemo(() => ctx ?? build(DEFAULT_LOCALE, null), [ctx]);
}

/**
 * The root layout can't know the store's language, so the store layout renders
 * this to mirror its `lang`/`dir` onto <html> (scrollbars, native form controls,
 * and screen readers read it from there).
 */
export function DocumentLocale({ locale }: { locale: Locale }) {
  useEffect(() => {
    const el = document.documentElement;
    const prevLang = el.lang;
    const prevDir = el.dir;
    el.lang = intlLocaleFor(locale);
    el.dir = dirFor(locale);
    return () => {
      el.lang = prevLang;
      el.dir = prevDir;
    };
  }, [locale]);
  return null;
}
