/**
 * Dashboard localisation — Arabic (RTL) and English (LTR).
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

export type Locale = "en" | "ar";
export type Dir = "ltr" | "rtl";

const STORAGE_KEY = "zimos.locale";

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
 * in an effect.
 */
let activeLocale: Locale = readStored();

export function getLocale(): Locale {
  return activeLocale;
}

export function getIntlLocale(): string {
  return intlLocaleOf(activeLocale);
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
    activeLocale = initial;
    return initial;
  });
  // Sync during render so formatters called by children in this same render
  // pass already see the new locale.
  activeLocale = locale;

  useEffect(() => {
    activeLocale = locale;
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

/** "Hello {name}" + { name: "Sara" } -> "Hello Sara" */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
}

/** Shared strings used across many screens. */
export const COMMON = {
  en: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    add: "Add",
    close: "Close",
    back: "Back",
    search: "Search",
    filter: "Filter",
    all: "All",
    status: "Status",
    actions: "Actions",
    loading: "Loading…",
    retry: "Try again",
    exportCsv: "Export CSV",
    demoData: "Demo data",
    active: "Active",
    paused: "Paused",
    enabled: "Enabled",
    disabled: "Disabled",
    yes: "Yes",
    no: "No",
    today: "Today",
    last7: "Last 7 days",
    last30: "Last 30 days",
    last90: "Last 90 days",
    viewAll: "View all",
    learnMore: "Learn more",
    copy: "Copy",
    copied: "Copied",
    signOut: "Sign out",
  },
  ar: {
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    create: "إنشاء",
    add: "إضافة",
    close: "إغلاق",
    back: "رجوع",
    search: "بحث",
    filter: "تصفية",
    all: "الكل",
    status: "الحالة",
    actions: "إجراءات",
    loading: "جارٍ التحميل…",
    retry: "حاول مرة أخرى",
    exportCsv: "تصدير CSV",
    demoData: "بيانات تجريبية",
    active: "نشط",
    paused: "متوقف",
    enabled: "مفعّل",
    disabled: "معطّل",
    yes: "نعم",
    no: "لا",
    today: "اليوم",
    last7: "آخر 7 أيام",
    last30: "آخر 30 يوم",
    last90: "آخر 90 يوم",
    viewAll: "عرض الكل",
    learnMore: "اعرف أكثر",
    copy: "نسخ",
    copied: "تم النسخ",
    signOut: "تسجيل الخروج",
  },
} satisfies Messages;

export function useCommon() {
  return useT(COMMON);
}
