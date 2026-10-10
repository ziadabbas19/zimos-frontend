import { plural } from "@/lib/plural";
import { editorUi, type EditorLocale, type EditorUi } from "../editorLocale";

/**
 * The words of the theme panel and of the header / footer / announcement
 * panels, on top of the editor's own locale layer (editorLocale.ts):
 *
 *  - `themeUi(locale)` — everything these panels say that the editor did not
 *    say before (presets, font pairs, the link-target picker…);
 *  - `lookUi(locale)` — the editor's own strings (`editorUi`), as they are.
 *
 * Both follow the editor's language (EditorLocaleContext), like every other
 * piece of the editor.
 */

const EN = {
  presets: "Ready styles",
  presetsHint: "One tap sets the theme, colours, font and corners together. Change anything after.",
  presetUse: (name: string) => `Use the ${name} style`,
  presetApplied: (name: string) => `${name} style applied.`,
  presetUndo: "Undo",
  presetsPrev: "Previous styles",
  presetsNext: "More styles",

  brandColor: "Brand colour",
  useColor: (hex: string) => `Use ${hex}`,
  colorPicker: (label: string) => `${label} colour picker`,
  colorCode: (label: string) => `${label}: colour code`,
  colorInvalid: "Enter a colour code like",
  colorSwatches: (label: string) => `Ready colours — ${label}`,

  fontPair: "Font pair",
  fontPairHint: "Headings and text across your whole store.",
  fontOverTheme: "Store font",
  fontThemeOwn: "Theme font",
  fontPairName: (heading: string, body: string) => `${heading} + ${body}`,
  fontsMore: "More fonts",
  fontsLess: "Fewer fonts",

  cornersFromTheme: (theme: string) => `Corners and button shape come with the ${theme} theme.`,
  themeBlockHint: "Sets the shape of buttons and cards, the spacing and the top of the page.",
  themePaid: "Paid",
  themePaidNote: "Paid themes can't be bought yet — they will be soon.",
  shellTitle: "On every page",

  linkTargetTitle: "Where does this link go?",
  linkTargetEmpty: "Choose where it goes",
  back: "Back",
  searchList: "Search",
  noMatches: "Nothing matches.",
  done: "Done",
  retry: "Try again",
  submenuKept: (n: number) =>
    `Has a dropdown of ${plural(n, { one: "1 link", other: "{n} links" })} — kept as it is.`,
  groupLinks: (n: number) => plural(n, { one: "1 link", other: "{n} links" }),
};

export type ThemeUi = typeof EN;

const AR: ThemeUi = {
  presets: "أنماط جاهزة",
  presetsHint: "ضغطة واحدة تضبط الثيم والألوان والخط والحواف معًا، ويمكنك تغيير أي شيء بعدها.",
  presetUse: (name) => `استخدام نمط ${name}`,
  presetApplied: (name) => `طُبّق نمط ${name}.`,
  presetUndo: "تراجع",
  presetsPrev: "الأنماط السابقة",
  presetsNext: "أنماط أخرى",

  brandColor: "لون العلامة",
  useColor: (hex) => `استخدام ${hex}`,
  colorPicker: (label) => `${label}: اختيار لون`,
  colorCode: (label) => `${label}: رمز اللون`,
  colorInvalid: "اكتب رمز لون مثل",
  colorSwatches: (label) => `ألوان جاهزة — ${label}`,

  fontPair: "الخطوط",
  fontPairHint: "خط العناوين وخط النصوص في متجرك كله.",
  fontOverTheme: "خط المتجر",
  fontThemeOwn: "خط الثيم",
  fontPairName: (heading, body) => `${heading} + ${body}`,
  fontsMore: "خطوط أخرى",
  fontsLess: "خطوط أقل",

  cornersFromTheme: (theme) => `الحواف وشكل الأزرار يأتيان مع ثيم ${theme}.`,
  themeBlockHint: "يحدد شكل الأزرار والبطاقات والمسافات وأعلى الصفحة.",
  themePaid: "مدفوع",
  themePaidNote: "الثيمات المدفوعة غير متاحة للشراء بعد، وستتاح قريبًا.",
  shellTitle: "ثابت في كل الصفحات",

  linkTargetTitle: "إلى أين يؤدي هذا الرابط؟",
  linkTargetEmpty: "اختر وجهة الرابط",
  back: "رجوع",
  searchList: "بحث",
  noMatches: "لا توجد نتائج بهذا الاسم.",
  done: "تم",
  retry: "إعادة المحاولة",
  submenuKept: (n) =>
    `تتفرّع منه قائمة فيها ${plural(n, { one: "رابط واحد", two: "رابطان", few: "{n} روابط", other: "{n} رابطًا" })}، وستبقى كما هي.`,
  groupLinks: (n) => plural(n, { one: "رابط واحد", two: "رابطان", few: "{n} روابط", other: "{n} رابطًا" }),
};

export function themeUi(locale: EditorLocale): ThemeUi {
  return locale === "ar" ? AR : EN;
}

/** `editorUi` for the theme and shell panels: the same keys and the same wording as the rest of the editor. */
export function lookUi(locale: EditorLocale): EditorUi {
  return editorUi(locale);
}
