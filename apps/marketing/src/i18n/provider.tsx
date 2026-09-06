"use client";

import { createContext, useContext } from "react";
import type { Direction, Locale } from "./config";
import type { Dictionary } from "./dictionary";

export interface I18n {
  locale: Locale;
  dir: Direction;
  /** The active locale's dictionary. */
  dict: Dictionary;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  value,
  children,
}: {
  value: I18n;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Read the active locale, direction, and dictionary from a Client Component.
 * Server Components should call `getDictionary(locale)` directly instead.
 */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}
