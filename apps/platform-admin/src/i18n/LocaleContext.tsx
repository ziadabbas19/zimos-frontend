/**
 * Console localisation — Arabic (RTL) and English (LTR), the merchant
 * dashboard's mechanism (apps/merchant-dashboard/src/i18n/LocaleContext.tsx).
 * Pages without strings here stay English.
 *
 * Design: no global dictionary to merge-conflict over. Each page/component
 * declares its own strings next to its code and reads them with `useT`:
 *
 *   const STRINGS = {
 *     en: { title: "Orders", empty: "No orders yet." },
 *     ar: { title: "الطلبات", empty: "لا توجد طلبات بعد." },
 *   } satisfies Messages;
 *   const t = useT(STRINGS);
 *   <h1>{t.title}</h1>
 *
 * The `ar` object must have exactly the same keys as `en` (the type enforces
 * it). Interpolate with `fmt(t.greeting, { name })` for "{name}" placeholders.
 *
 * Switching locale sets <html lang dir>, persists the choice, and every
 * component re-renders with the new strings. Use logical Tailwind classes
 * (ms-/me-/ps-/pe-/start-/end-/text-start/text-end, border-s/border-e) so
 * layouts mirror automatically.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getActiveLocale, setActiveLocale, type Locale } from "./activeLocale.ts";

export { fmt } from "./activeLocale.ts";
export type { Locale };
export type Dir = "ltr" | "rtl";

const STORAGE_KEY = "zimos.console.locale";

export function dirOf(locale: Locale): Dir {
  return locale === "ar" ? "rtl" : "ltr";
}

function readStored(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ar" || v === "en") return v;
  } catch {
    /* private mode */
  }
  return "en";
}

function applyToDocument(locale: Locale) {
  const el = document.documentElement;
  el.lang = locale;
  el.dir = dirOf(locale);
}

export function intlLocaleOf(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : "en-US";
}

/**
 * Module-level mirror of the active locale so plain (non-hook) helpers such as
 * `formatDate` / `formatMoney` in lib/format.ts can format for the right
 * language. Kept in sync by <LocaleProvider> synchronously during render (so
 * the very render that switches language already formats correctly) and again
 * in an effect. It lives in ./activeLocale.ts, where React-free helpers read it.
 */
setActiveLocale(readStored());

export function getLocale(): Locale {
  return getActiveLocale();
}

export function getIntlLocale(): string {
  return intlLocaleOf(getActiveLocale());
}

interface LocaleState {
  locale: Locale;
  dir: Dir;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  /** Intl locale tag for number/date formatting. */
  intlLocale: string;
}

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = readStored();
    setActiveLocale(initial);
    return initial;
  });
  // Sync during render so formatters called by children in this same render
  // pass already see the new locale.
  setActiveLocale(locale);

  useEffect(() => {
    setActiveLocale(locale);
    applyToDocument(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LocaleState>(
    () => ({
      locale,
      dir: dirOf(locale),
      setLocale,
      toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar"),
      intlLocale: intlLocaleOf(locale),
    }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}

/** A per-page message table. `ar` must mirror `en`'s keys. */
export type Messages<K extends string = string> = {
  en: Record<K, string>;
  ar: Record<K, string>;
};

export function useT<K extends string>(messages: { en: Record<K, string>; ar: Record<NoInfer<K>, string> }): Record<K, string> {
  const { locale } = useLocale();
  return messages[locale];
}

