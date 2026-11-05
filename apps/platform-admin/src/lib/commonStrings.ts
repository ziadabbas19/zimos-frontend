import { getActiveLocale } from "../i18n/activeLocale.ts";

/**
 * The few words shared components use for themselves. Read outside React's
 * context on purpose: these components are also rendered alone, with no
 * <LocaleProvider> around them.
 */
const TEXT = {
  en: { close: "Close", clear: "Clear", confirm: "Confirm", cancel: "Cancel", working: "Working…" },
  ar: { close: "إغلاق", clear: "مسح", confirm: "تأكيد", cancel: "إلغاء", working: "جارٍ التنفيذ…" },
};

export function commonText() {
  return TEXT[getActiveLocale()];
}
