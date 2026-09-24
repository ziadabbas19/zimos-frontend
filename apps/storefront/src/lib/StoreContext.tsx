"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { CheckoutSettings } from "@store-builder/api-client";
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
  logoUrl: string | null;
  /** Merchant contact number from themeSettings, if saved. */
  phone: string | null;
  /** Which optional checkout fields the merchant shows/requires (GET /store/:ws `checkout`). */
  checkout: CheckoutSettings;
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
    t: getDictionary(locale),
    store,
    money: (amount, currency) => formatPrice(amount, currency ?? store?.currency ?? "EGP", locale),
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
