import type { FontCategory } from "../fonts";

/**
 * The picker's words. Each app keeps its own language (its LocaleContext) and
 * passes it in as `locale`, so nothing here reads a context of one app.
 */
export type FontPickerLocale = "en" | "ar";

export interface FontPickerStrings {
  storeDefault: string;
  /** "Store default (Cairo)" */
  storeDefaultNamed: string;
  useDefault: string;
  search: string;
  searchLabel: string;
  categories: string;
  allCategories: string;
  scripts: string;
  scriptAll: string;
  scriptOnlyAr: string;
  scriptOnlyEn: string;
  scriptBoth: string;
  /** "{n} fonts" */
  count: string;
  none: string;
  loading: string;
  choose: string;
  category: Record<FontCategory, string>;
}

export const FONT_PICKER_STRINGS: Record<FontPickerLocale, FontPickerStrings> = {
  en: {
    storeDefault: "Store default",
    storeDefaultNamed: "Store default ({name})",
    useDefault: "Use store default",
    search: "Search fonts",
    searchLabel: "Search fonts by name",
    categories: "Style",
    allCategories: "All",
    scripts: "Letters",
    scriptAll: "All",
    scriptOnlyAr: "Arabic only",
    scriptOnlyEn: "English only",
    scriptBoth: "Arabic + English",
    count: "{n} fonts",
    none: "No font matches. Try another name or style.",
    loading: "Loading fonts…",
    choose: "Choose a font",
    category: {
      sans: "Sans",
      serif: "Serif",
      display: "Display",
      handwriting: "Handwriting",
      mono: "Mono",
      kufi: "Kufi",
      naskh: "Naskh",
      ruqaa: "Ruqaa",
    },
  },
  ar: {
    storeDefault: "خط المتجر الافتراضي",
    storeDefaultNamed: "خط المتجر الافتراضي ({name})",
    useDefault: "استخدام خط المتجر الافتراضي",
    search: "ابحث عن خط",
    searchLabel: "ابحث عن خط بالاسم",
    categories: "النوع",
    allCategories: "الكل",
    scripts: "الحروف",
    scriptAll: "الكل",
    scriptOnlyAr: "عربي فقط",
    scriptOnlyEn: "إنجليزي فقط",
    scriptBoth: "عربي + إنجليزي",
    count: "{n} خط",
    none: "لا يوجد خط مطابق. جرّب اسمًا أو نوعًا آخر.",
    loading: "جارٍ تحميل الخطوط…",
    choose: "اختر خطًا",
    category: {
      sans: "بدون زوائد",
      serif: "بزوائد",
      display: "للعناوين",
      handwriting: "يدوي",
      mono: "ثابت العرض",
      kufi: "كوفي",
      naskh: "نسخ",
      ruqaa: "رقعة",
    },
  },
};

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}
