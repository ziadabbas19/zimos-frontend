import { intlLocaleOf } from "@/i18n/LocaleContext";
import type { PluralForms } from "@/lib/plural";
import type { EditorLocale } from "../editorLocale";

/**
 * The words of the editor's start side — the section list, its rows and
 * menus, the library of sections and the saved sections — in the editor's
 * language (EditorLocaleContext, the same switch editorUi() reads).
 *
 * Counted words go through the language's plural rules and digits («عنصرين»,
 * «٣ عناصر», «١١ عنصر»), never a bare number glued to a noun.
 */

/** A count in `locale`: the right plural form, the language's own digits. */
function counted(locale: EditorLocale, n: number, forms: PluralForms): string {
  const tag = intlLocaleOf(locale);
  let rule: Intl.LDMLPluralRule = "other";
  try {
    rule = new Intl.PluralRules(tag).select(n);
  } catch {
    /* an engine without PluralRules: the general form */
  }
  return (forms[rule] ?? forms.other).replace("{n}", new Intl.NumberFormat(tag).format(n));
}

/** A bare figure in the language's digits (a position, a rating). */
function figure(locale: EditorLocale, n: number): string {
  return new Intl.NumberFormat(intlLocaleOf(locale)).format(n);
}

const EN = {
  // --- the section list ---
  listTitle: "Page sections",
  showList: "Show the page's sections",
  hideList: "Hide the page's sections",
  elements: (n: number) => counted("en", n, { one: "1 element", other: "{n} elements" }),
  hidden: "Hidden",
  reorder: (label: string) => `Drag to reorder: ${label}`,
  sortableRole: "movable section",
  rowMenu: (label: string) => `Actions for ${label}`,
  moveUp: "Move up",
  moveDown: "Move down",
  addAfter: "Add a section after it",
  duplicate: "Duplicate",
  hide: "Hide",
  show: "Show",
  saveToLibrary: "Save to my library",
  remove: "Delete",
  removeAria: (label: string) => `Delete ${label}`,
  addHere: "Add a section here",
  emptyPage: "This page is empty — add its first section.",
  addSection: "Add a section",
  announcement: "Announcement bar",
  header: "Header",
  footer: "Footer",
  onEveryPage: "On every page",
  announcementOff: "Off",
  outlineOf: (label: string) => `What is inside ${label}`,
  dragHelp: "Press Space to pick the section up, move it with the arrow keys, and press Space again to drop it. Escape cancels.",
  dragPicked: (label: string) => `Picked up ${label}.`,
  dragOver: (label: string, n: number, total: number) => `${label} is now ${figure("en", n)} of ${figure("en", total)}.`,
  dragDropped: (label: string, n: number, total: number) => `${label} dropped at ${figure("en", n)} of ${figure("en", total)}.`,
  dragCancelled: (label: string) => `Cancelled. ${label} is back where it was.`,

  // --- one element in a section's outline ---
  image: "Image",
  noImage: "No image yet",
  images: (n: number) => counted("en", n, { one: "1 image", other: "{n} images" }),
  rows: (n: number) => counted("en", n, { one: "1 row", other: "{n} rows" }),
  items: (n: number) => counted("en", n, { one: "1 item", other: "{n} items" }),
  products: (n: number) => counted("en", n, { one: "1 product", other: "{n} products" }),
  collections: (n: number) => counted("en", n, { one: "1 collection", other: "{n} collections" }),
  links: (n: number) => counted("en", n, { one: "1 link", other: "{n} links" }),
  steps: (n: number) => counted("en", n, { one: "1 step", other: "{n} steps" }),
  tabs: (n: number) => counted("en", n, { one: "1 tab", other: "{n} tabs" }),
  slides: (n: number) => counted("en", n, { one: "1 slide", other: "{n} slides" }),
  needs: (n: number) => counted("en", n, { one: "1 need", other: "{n} needs" }),
  hours: (n: number) => counted("en", n, { one: "1 hour", other: "{n} hours" }),
  stars: (n: number) => `${figure("en", n)}★`,
  pixels: (n: number) => `${figure("en", n)}px`,
  oneProduct: "One product",
  shoppableImage: "Shoppable image",
  nothingLinked: "Nothing linked yet",
  noAddress: "No address yet",
  form: "Form",
  cart: "Cart",
  livingHero: "Living hero",
  product3d: "3D product",
  nothingWritten: "Nothing written yet",

  // --- the library of sections ---
  libraryTitle: "Add a section",
  insertAt: (n: number) => `It becomes section ${figure("en", n)} of the page.`,
  insertEnd: "It goes at the end of the page.",
  search: "Search sections",
  searchPlaceholder: "Search — hero, products, FAQ…",
  kinds: "Kind of section",
  all: "All",
  purposeHero: "Hero",
  purposeProducts: "Products",
  purposeOffers: "Offers",
  purposeTrust: "Trust",
  purposeReviews: "Reviews",
  purposeFaq: "FAQ",
  purposeContent: "Content",
  purposeForm: "Forms",
  purposeFooter: "Footer",
  popular: "Most used",
  results: (n: number) => counted("en", n, { one: "1 result", other: "{n} results" }),
  noResults: "No section matches that.",
  clearSearch: "Clear the search",
  searchEverything: "Search every kind",
  addPreset: (label: string) => `Add ${label}`,

  // --- saved sections ---
  saved: "Saved",
  savedTitle: "Saved sections",
  savedHint: "Sections you saved to use again on any page.",
  savedEmptyTitle: "Nothing saved yet",
  savedEmptyBody: "Open «…» beside any section and choose “Save to my library”. It will wait for you here.",
  savedLoadFailed: "We couldn't load your saved sections.",
  retry: "Try again",
  insertCopy: "Add a copy",
  insertLinked: "Add linked",
  linkedHint: "A linked copy follows the saved section: update it, publish, and every linked copy changes.",
  funnelOnly: "This funnel only",
  removeSaved: "Delete from my library",
  removeSavedAria: (name: string) => `Delete ${name} from my library`,
  removeSavedTitle: (name: string) => `Delete “${name}” from your library?`,
  removeSavedBody: "Sections already on your pages stay as they are. Linked copies stop updating.",
  removeSavedConfirm: "Delete it",
  savedRemoved: "Deleted from your library.",
  cancel: "Cancel",

  // --- saving a section ---
  saveSheetTitle: "Save this section",
  saveSheetHint: "Keep it in your library and add it to any page later.",
  saveName: "Its name in your library",
  saveNamePlaceholder: "e.g. Winter offer",
  saveOnlyThisFunnel: "Only for this funnel",
  save: "Save",
  saving: "Saving…",
  savedDone: "Saved to your library.",
};

export type LeftUi = typeof EN;

const AR: LeftUi = {
  listTitle: "أقسام الصفحة",
  showList: "إظهار أقسام الصفحة",
  hideList: "إخفاء أقسام الصفحة",
  elements: (n) => counted("ar", n, { one: "عنصر واحد", two: "عنصران", few: "{n} عناصر", other: "{n} عنصرًا" }),
  hidden: "مخفي",
  reorder: (label) => `اسحب لإعادة الترتيب: ${label}`,
  sortableRole: "قسم قابل للتحريك",
  rowMenu: (label) => `إجراءات ${label}`,
  moveUp: "تحريك للأعلى",
  moveDown: "تحريك للأسفل",
  addAfter: "إضافة قسم بعده",
  duplicate: "تكرار",
  hide: "إخفاء",
  show: "إظهار",
  saveToLibrary: "حفظ في مكتبتي",
  remove: "حذف",
  removeAria: (label) => `حذف ${label}`,
  addHere: "إضافة قسم هنا",
  emptyPage: "الصفحة فارغة — أضف أول قسم.",
  addSection: "إضافة قسم",
  announcement: "شريط الإعلان",
  header: "الترويسة",
  footer: "التذييل",
  onEveryPage: "في كل الصفحات",
  announcementOff: "متوقف",
  outlineOf: (label) => `محتوى ${label}`,
  dragHelp: "اضغط مفتاح المسافة للإمساك بالقسم، وحرّكه بالأسهم، ثم اضغط المسافة مرة أخرى لإفلاته. مفتاح Esc يلغي.",
  dragPicked: (label) => `أمسكت ${label}.`,
  dragOver: (label, n, total) => `${label} أصبح رقم ${figure("ar", n)} من ${figure("ar", total)}.`,
  dragDropped: (label, n, total) => `وُضع ${label} في الموضع ${figure("ar", n)} من ${figure("ar", total)}.`,
  dragCancelled: (label) => `أُلغي التحريك وعاد ${label} إلى مكانه.`,

  image: "صورة",
  noImage: "لا توجد صورة بعد",
  images: (n) => counted("ar", n, { one: "صورة واحدة", two: "صورتان", few: "{n} صور", other: "{n} صورة" }),
  rows: (n) => counted("ar", n, { one: "صف واحد", two: "صفان", few: "{n} صفوف", other: "{n} صفًّا" }),
  items: (n) => counted("ar", n, { one: "عنصر واحد", two: "عنصران", few: "{n} عناصر", other: "{n} عنصرًا" }),
  products: (n) => counted("ar", n, { one: "منتج واحد", two: "منتجان", few: "{n} منتجات", other: "{n} منتجًا" }),
  collections: (n) => counted("ar", n, { one: "مجموعة واحدة", two: "مجموعتان", few: "{n} مجموعات", other: "{n} مجموعة" }),
  links: (n) => counted("ar", n, { one: "رابط واحد", two: "رابطان", few: "{n} روابط", other: "{n} رابطًا" }),
  steps: (n) => counted("ar", n, { one: "خطوة واحدة", two: "خطوتان", few: "{n} خطوات", other: "{n} خطوة" }),
  tabs: (n) => counted("ar", n, { one: "تبويب واحد", two: "تبويبان", few: "{n} تبويبات", other: "{n} تبويبًا" }),
  slides: (n) => counted("ar", n, { one: "شريحة واحدة", two: "شريحتان", few: "{n} شرائح", other: "{n} شريحة" }),
  needs: (n) => counted("ar", n, { one: "احتياج واحد", two: "احتياجان", few: "{n} احتياجات", other: "{n} احتياجًا" }),
  hours: (n) => counted("ar", n, { one: "ساعة واحدة", two: "ساعتان", few: "{n} ساعات", other: "{n} ساعة" }),
  stars: (n) => `${figure("ar", n)}★`,
  pixels: (n) => `${figure("ar", n)} بكسل`,
  oneProduct: "منتج واحد",
  shoppableImage: "صورة قابلة للتسوق",
  nothingLinked: "لا يوجد رابط بعد",
  noAddress: "لا يوجد عنوان بعد",
  form: "نموذج",
  cart: "السلة",
  livingHero: "واجهة متحركة",
  product3d: "منتج ثلاثي الأبعاد",
  nothingWritten: "لم يُكتب شيء بعد",

  libraryTitle: "إضافة قسم",
  insertAt: (n) => `سيكون القسم رقم ${figure("ar", n)} في الصفحة.`,
  insertEnd: "سيُضاف في آخر الصفحة.",
  search: "ابحث في الأقسام",
  searchPlaceholder: "ابحث — واجهة، منتجات، أسئلة…",
  kinds: "نوع القسم",
  all: "الكل",
  purposeHero: "واجهة",
  purposeProducts: "منتجات",
  purposeOffers: "عروض",
  purposeTrust: "ثقة",
  purposeReviews: "تقييمات",
  purposeFaq: "أسئلة",
  purposeContent: "محتوى",
  purposeForm: "نموذج",
  purposeFooter: "تذييل",
  popular: "الأكثر استخدامًا",
  results: (n) => counted("ar", n, { one: "نتيجة واحدة", two: "نتيجتان", few: "{n} نتائج", other: "{n} نتيجة" }),
  noResults: "لا يوجد قسم بهذا الاسم.",
  clearSearch: "مسح البحث",
  searchEverything: "البحث في كل الأنواع",
  addPreset: (label) => `إضافة ${label}`,

  saved: "محفوظاتي",
  savedTitle: "محفوظاتي",
  savedHint: "أقسام حفظتها لتستخدمها مرة أخرى في أي صفحة.",
  savedEmptyTitle: "لم تحفظ شيئًا بعد",
  savedEmptyBody: "افتح «…» بجانب أي قسم واختر «حفظ في مكتبتي»، وستجده هنا.",
  savedLoadFailed: "تعذّر تحميل أقسامك المحفوظة.",
  retry: "إعادة المحاولة",
  insertCopy: "إضافة نسخة",
  insertLinked: "إضافة مرتبطة",
  linkedHint: "النسخة المرتبطة تتبع القسم المحفوظ: عدّله وانشر فتتغيّر كل النسخ المرتبطة.",
  funnelOnly: "هذا المسار فقط",
  removeSaved: "حذف من مكتبتي",
  removeSavedAria: (name) => `حذف ${name} من مكتبتي`,
  removeSavedTitle: (name) => `حذف «${name}» من مكتبتك؟`,
  removeSavedBody: "الأقسام الموجودة في صفحاتك تبقى كما هي. النسخ المرتبطة لن تُحدَّث بعد ذلك.",
  removeSavedConfirm: "حذف",
  savedRemoved: "حُذف من مكتبتك.",
  cancel: "إلغاء",

  saveSheetTitle: "حفظ هذا القسم",
  saveSheetHint: "احتفظ به في مكتبتك وأضفه إلى أي صفحة لاحقًا.",
  saveName: "اسمه في مكتبتك",
  saveNamePlaceholder: "مثلًا: عرض الشتاء",
  saveOnlyThisFunnel: "لهذا المسار فقط",
  save: "حفظ",
  saving: "جارٍ الحفظ…",
  savedDone: "حُفظ في مكتبتك.",
};

export function leftUi(locale: EditorLocale): LeftUi {
  return locale === "ar" ? AR : EN;
}
