import type { EditorLocale } from "../editorLocale";

/**
 * The inspector's own words, in the editor's two languages. Kept beside the
 * inspector instead of in editorLocale.ts (which the whole editor shares and
 * several hands edit at once); read with `inspectorUi(locale)` exactly as
 * `editorUi(locale)` is.
 */

/** A count in the language's own digits («٣», never a stray "3" in Arabic). */
export function inspectorNumber(n: number, locale: EditorLocale): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
  } catch {
    return String(n);
  }
}

export type CountNoun =
  | "picture"
  | "question"
  | "row"
  | "point"
  | "tab"
  | "step"
  | "link"
  | "slide"
  | "card"
  | "video"
  | "category"
  | "need"
  | "change";

const NOUNS_EN: Record<CountNoun, { zero: string; one: string; other: string }> = {
  picture: { zero: "No pictures yet", one: "1 picture", other: "{n} pictures" },
  question: { zero: "No questions yet", one: "1 question", other: "{n} questions" },
  row: { zero: "No rows yet", one: "1 row", other: "{n} rows" },
  point: { zero: "Nothing written yet", one: "1 line", other: "{n} lines" },
  tab: { zero: "No tabs yet", one: "1 tab", other: "{n} tabs" },
  step: { zero: "No steps yet", one: "1 step", other: "{n} steps" },
  link: { zero: "No links yet", one: "1 link", other: "{n} links" },
  slide: { zero: "No slides yet", one: "1 slide", other: "{n} slides" },
  card: { zero: "No cards yet", one: "1 card", other: "{n} cards" },
  video: { zero: "No videos yet", one: "1 video", other: "{n} videos" },
  category: { zero: "No categories yet", one: "1 category", other: "{n} categories" },
  need: { zero: "No needs yet", one: "1 need", other: "{n} needs" },
  change: { zero: "No changes", one: "1 change", other: "{n} changes" },
};

/** Arabic counts: one, two, 3–10, then 11 and up. */
const NOUNS_AR: Record<CountNoun, { zero: string; one: string; two: string; few: string; many: string }> = {
  picture: { zero: "لا توجد صور بعد", one: "صورة واحدة", two: "صورتان", few: "{n} صور", many: "{n} صورة" },
  question: { zero: "لا توجد أسئلة بعد", one: "سؤال واحد", two: "سؤالان", few: "{n} أسئلة", many: "{n} سؤالًا" },
  row: { zero: "لا توجد صفوف بعد", one: "صف واحد", two: "صفان", few: "{n} صفوف", many: "{n} صفًّا" },
  point: { zero: "لم يُكتب شيء بعد", one: "سطر واحد", two: "سطران", few: "{n} أسطر", many: "{n} سطرًا" },
  tab: { zero: "لا توجد تبويبات بعد", one: "تبويب واحد", two: "تبويبان", few: "{n} تبويبات", many: "{n} تبويبًا" },
  step: { zero: "لا توجد خطوات بعد", one: "خطوة واحدة", two: "خطوتان", few: "{n} خطوات", many: "{n} خطوة" },
  link: { zero: "لا توجد روابط بعد", one: "رابط واحد", two: "رابطان", few: "{n} روابط", many: "{n} رابطًا" },
  slide: { zero: "لا توجد شرائح بعد", one: "شريحة واحدة", two: "شريحتان", few: "{n} شرائح", many: "{n} شريحة" },
  card: { zero: "لا توجد بطاقات بعد", one: "بطاقة واحدة", two: "بطاقتان", few: "{n} بطاقات", many: "{n} بطاقة" },
  video: { zero: "لا توجد مقاطع فيديو بعد", one: "مقطع فيديو واحد", two: "مقطعا فيديو", few: "{n} مقاطع فيديو", many: "{n} مقطع فيديو" },
  category: { zero: "لا توجد أقسام بعد", one: "قسم واحد", two: "قسمان", few: "{n} أقسام", many: "{n} قسمًا" },
  need: { zero: "لا توجد احتياجات بعد", one: "احتياج واحد", two: "احتياجان", few: "{n} احتياجات", many: "{n} احتياجًا" },
  change: { zero: "لا توجد تغييرات", one: "تغيير واحد", two: "تغييران", few: "{n} تغييرات", many: "{n} تغييرًا" },
};

/** «٣ صور», "3 pictures", «مفيش صور لسه» — a counted word in the editor's language. */
export function countWord(noun: CountNoun, n: number, locale: EditorLocale): string {
  const shown = inspectorNumber(n, locale);
  if (locale === "ar") {
    const forms = NOUNS_AR[noun];
    const text = n <= 0 ? forms.zero : n === 1 ? forms.one : n === 2 ? forms.two : n <= 10 ? forms.few : forms.many;
    return text.replace("{n}", shown);
  }
  const forms = NOUNS_EN[noun];
  return (n <= 0 ? forms.zero : n === 1 ? forms.one : forms.other).replace("{n}", shown);
}

const UI_EN = {
  // --- the frame ---
  tabsLabel: "What to change",
  content: "Content",
  style: "Style",
  visibility: "Visibility",
  path: "Where this sits",
  backToSection: (name: string) => `Back to the section: ${name}`,
  sectionActions: "Section actions",
  elementActions: "Element actions",
  duplicateElement: "Duplicate this element",
  moveUp: "Move it up",
  moveDown: "Move it down",
  duplicateSection: "Duplicate the section",
  saveSection: "Save to the library",
  deleteSection: "Delete the section",

  // --- a section's content ---
  elementsTitle: "In this section",
  elementsHint: "Tap anything to edit it.",
  row: (n: string) => `Row ${n}`,
  emptyColumn: "Nothing in this column.",
  editElement: (name: string) => `Edit ${name}`,
  markRules: "Has display rules",
  markHidden: "Hidden on a screen",
  markBound: "Shows live store data",
  noFields: "Nothing to write here. Its look is under Style.",

  // --- a section's style ---
  columnsTitle: "Columns",
  rowSpace: (n: string) => `Row ${n}: space between its columns`,

  // --- visibility ---
  savedTitle: "Reuse this section",
  whoSees: "Who sees what",
  whoSeesHint: "The section itself always shows. Rules are set on each thing inside it.",
  showsToAll: "Shows to everyone",
  showOnTitle: "Screens",
  showOnHint: "Turn a screen off and it is left out of the page at that width.",
  showOnLabel: "Shows on",
  screenDesktop: "Computer",
  screenTablet: "Tablet",
  screenMobile: "Phone",
  hiddenOn: (list: string) => `Hidden on: ${list}`,
  hiddenEverywhere: "Hidden on every screen — shoppers won't see it.",
  whenUpright: "Hide when the phone is upright",
  whenSideways: "Hide when the phone is sideways",
  bindTitle: "Live store data",
  joiner: ", ",

  // --- two languages ---
  arabic: "Arabic",
  english: "English",
  languageOf: (label: string) => `${label}: language`,
  inLanguage: (label: string, language: string) => `${label} — ${language}`,
  stillEmpty: (language: string) => `${language} is still empty`,

  // --- small controls ---
  increase: (label: string) => `Increase ${label}`,
  decrease: (label: string) => `Decrease ${label}`,
  colourDefault: "Default",
  colourClear: "Back to the default",
  colourInherits: "Not set here — it follows the default.",

  // --- where a link goes, in words ---
  linkHome: "Your home page",
  linkProducts: "All your products",
  linkCart: "The cart",
  linkCheckout: "Checkout",
  linkTrack: "Order tracking",
  linkBlog: "Your blog",
  linkProduct: (slug: string) => `A product page: ${slug}`,
  linkCollection: "A collection of products",
  linkPopup: (name: string) => `Opens the popup "${name}"`,
  linkAnchor: (name: string) => `Scrolls to "${name}" on this page`,
  linkPage: (path: string) => `A page of your store: ${path}`,
  linkExternal: (host: string) => `Another website: ${host}`,
  linkWhatsApp: "Opens a WhatsApp chat",
  linkPhone: (number: string) => `Calls ${number}`,
  linkEmail: (address: string) => `Writes an email to ${address}`,
  linkUnclear: "Start with / for a page of your store, or https:// for another website.",
  linkQuick: "Quick picks",
  linkQuickHome: "Home",
  linkQuickProducts: "Products",
  linkQuickCart: "Cart",

  // --- lists of cards ---
  itemMoveUp: (name: string) => `Move ${name} up`,
  itemMoveDown: (name: string) => `Move ${name} down`,
  itemRemove: (name: string) => `Remove ${name}`,
  itemAdd: (noun: string) => `Add ${noun.toLowerCase()}`,
  itemUp: "Up",
  itemDown: "Down",
  itemDelete: "Remove",
  itemsFull: (max: string) => `That's the most it takes (${max}).`,
  itemsEmpty: "Nothing here yet.",

  // --- pictures ---
  fromLibrary: "Choose from the library",

  // --- the style page ---
  screensLabel: "Screen",
  ownChanges: (list: string) => `Has its own changes on: ${list}`,
  onlyThisScreen: (screen: string) => `What you change here is for the ${screen.toLowerCase()} only.`,
  groupText: "Text",
  groupBackground: "Background",
  groupBorder: "Border and corners",
  groupShadow: "Shadow and opacity",
  groupSize: "Size",
  groupSpacing: "Spacing",
  groupSpacingHint: "In pixels. Inside is the room around the content; outside is the gap from its neighbours.",
  groupAdvanced: "Advanced",
  groupMotion: "Entrance",
  groupNamed: "Shared style",
  setCount: (n: string) => `${n} set`,
};

export type InspectorUi = typeof UI_EN;

const UI_AR: InspectorUi = {
  tabsLabel: "ما الذي تريد تغييره",
  content: "المحتوى",
  style: "المظهر",
  visibility: "الظهور",
  path: "موضعه في الصفحة",
  backToSection: (name) => `العودة إلى القسم: ${name}`,
  sectionActions: "إجراءات القسم",
  elementActions: "إجراءات العنصر",
  duplicateElement: "تكرار هذا العنصر",
  moveUp: "تحريك للأعلى",
  moveDown: "تحريك للأسفل",
  duplicateSection: "تكرار القسم",
  saveSection: "حفظه في المكتبة",
  deleteSection: "حذف القسم",

  elementsTitle: "داخل هذا القسم",
  elementsHint: "اضغط على أي عنصر لتعديله.",
  row: (n) => `الصف ${n}`,
  emptyColumn: "هذا العمود فارغ.",
  editElement: (name) => `تعديل ${name}`,
  markRules: "له شروط ظهور",
  markHidden: "مخفي على إحدى الشاشات",
  markBound: "يعرض بيانات حيّة من المتجر",
  noFields: "لا شيء يُكتب هنا. مظهره من تبويب «المظهر».",

  columnsTitle: "الأعمدة",
  rowSpace: (n) => `الصف ${n}: المسافة بين أعمدته`,

  savedTitle: "استخدام هذا القسم مرة أخرى",
  whoSees: "من يرى ماذا",
  whoSeesHint: "القسم نفسه يظهر دائمًا. الشروط توضع على كل عنصر داخله على حدة.",
  showsToAll: "يظهر للجميع",
  showOnTitle: "الشاشات",
  showOnHint: "أوقف شاشة فيُزال العنصر من الصفحة على ذلك المقاس.",
  showOnLabel: "يظهر على",
  screenDesktop: "الحاسوب",
  screenTablet: "الجهاز اللوحي",
  screenMobile: "الهاتف",
  hiddenOn: (list) => `مخفي على: ${list}`,
  hiddenEverywhere: "مخفي على كل الشاشات — لن يراه العملاء.",
  whenUpright: "إخفاؤه والهاتف في الوضع الرأسي",
  whenSideways: "إخفاؤه والهاتف في الوضع الأفقي",
  bindTitle: "بيانات حيّة من المتجر",
  joiner: "، ",

  arabic: "العربية",
  english: "English",
  languageOf: (label) => `${label}: اللغة`,
  inLanguage: (label, language) => `${label} — ${language}`,
  stillEmpty: (language) => `${language}: ما زال فارغًا`,

  increase: (label) => `زيادة ${label}`,
  decrease: (label) => `تقليل ${label}`,
  colourDefault: "الافتراضي",
  colourClear: "إعادة الافتراضي",
  colourInherits: "غير محدّد هنا — يتبع الافتراضي.",

  linkHome: "الصفحة الرئيسية",
  linkProducts: "كل المنتجات",
  linkCart: "السلة",
  linkCheckout: "إتمام الطلب",
  linkTrack: "تتبّع الطلب",
  linkBlog: "المدونة",
  linkProduct: (slug) => `صفحة منتج: ${slug}`,
  linkCollection: "مجموعة منتجات",
  linkPopup: (name) => `يفتح النافذة «${name}»`,
  linkAnchor: (name) => `ينتقل إلى «${name}» في الصفحة نفسها`,
  linkPage: (path) => `صفحة في متجرك: ${path}`,
  linkExternal: (host) => `موقع آخر: ${host}`,
  linkWhatsApp: "يفتح محادثة واتساب",
  linkPhone: (number) => `يتصل بالرقم ${number}`,
  linkEmail: (address) => `يكتب رسالة بريد إلى ${address}`,
  linkUnclear: "ابدأ بـ / لصفحة في متجرك، أو بـ https:// لموقع آخر.",
  linkQuick: "اختيارات سريعة",
  linkQuickHome: "الرئيسية",
  linkQuickProducts: "المنتجات",
  linkQuickCart: "السلة",

  itemMoveUp: (name) => `تحريك ${name} للأعلى`,
  itemMoveDown: (name) => `تحريك ${name} للأسفل`,
  itemRemove: (name) => `حذف ${name}`,
  itemAdd: (noun) => `إضافة ${noun}`,
  itemUp: "للأعلى",
  itemDown: "للأسفل",
  itemDelete: "حذف",
  itemsFull: (max) => `هذا أقصى عدد (${max}).`,
  itemsEmpty: "لا يوجد شيء هنا بعد.",

  fromLibrary: "اختيار من المكتبة",

  screensLabel: "الشاشة",
  ownChanges: (list) => `توجد تغييرات خاصة على: ${list}`,
  onlyThisScreen: (screen) => `ما تغيّره هنا يخص شاشة ${screen} فقط.`,
  groupText: "النص",
  groupBackground: "الخلفية",
  groupBorder: "الإطار والزوايا",
  groupShadow: "الظل والشفافية",
  groupSize: "المقاس",
  groupSpacing: "المسافات",
  groupSpacingHint: "بالبكسل. «الداخلية» هي المساحة حول المحتوى، و«الخارجية» هي البعد عمّا يجاوره.",
  groupAdvanced: "متقدّم",
  groupMotion: "حركة الظهور",
  groupNamed: "نمط مشترك",
  setCount: (n) => `${n} محدّد`,
};

export function inspectorUi(locale: EditorLocale): InspectorUi {
  return locale === "ar" ? UI_AR : UI_EN;
}
