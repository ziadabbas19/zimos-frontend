import type { Messages } from "@/i18n/LocaleContext";

/**
 * The words of a funnel step's page editor that are its own: the slim step
 * bar, the phone's bottom bar, the empty page and the hint about the offer's
 * product. Everything the editor shares with the store editor (the inspector,
 * the library, the section list, undo / redo, the device switch) keeps the
 * store editor's words.
 */
export const STEP_PAGE_STRINGS = {
  en: {
    bar: "This step's page",
    backToMap: "Map",
    backToMapHint: "Back to the funnel map",
    previousStep: "Previous step: {name}",
    nextStep: "Next step: {name}",
    firstStep: "This is the first step",
    lastStep: "This is the last step",
    stepPicker: "Switch step: {name}",
    menuPageSettings: "Page settings (name, SEO, scripts)",
    dockSettings: "Settings",
    idleTitle: "Edit where you look",
    idleHint: "Tap anything on the page to edit it. Changes are saved with the funnel.",
    emptyTitle: "This page is empty",
    emptyBody: "A step needs something on its page before the funnel can be published.",
    startReady: "Start with a ready page",
    readyApplied: "Ready page added — make it yours.",
    productHint: "This step's offer is on “{product}”. Product blocks with no product picked show your newest product.",
    productUse: "Show “{product}”",
    productBar: "This step's product",
  },
  ar: {
    bar: "صفحة هذه الخطوة",
    backToMap: "الخريطة",
    backToMapHint: "العودة إلى خريطة مسار البيع",
    previousStep: "الخطوة السابقة: {name}",
    nextStep: "الخطوة التالية: {name}",
    firstStep: "هذه أول خطوة",
    lastStep: "هذه آخر خطوة",
    stepPicker: "تغيير الخطوة: {name}",
    menuPageSettings: "إعدادات الصفحة (الاسم، SEO، الأكواد)",
    dockSettings: "الإعدادات",
    idleTitle: "عدّل وأنت ترى النتيجة",
    idleHint: "اضغط على أي عنصر في الصفحة لتعديله. تُحفظ التعديلات مع مسار البيع.",
    emptyTitle: "هذه الصفحة فارغة",
    emptyBody: "يجب أن تحتوي صفحة الخطوة على محتوى قبل نشر مسار البيع.",
    startReady: "ابدأ بصفحة جاهزة",
    readyApplied: "أُضيفت صفحة جاهزة — عدّلها كما تشاء.",
    productHint: "عرض هذه الخطوة على «{product}». بلوكات المنتج التي لم تختر لها منتجًا تعرض أحدث منتجاتك.",
    productUse: "اعرض «{product}»",
    productBar: "منتج هذه الخطوة",
  },
} satisfies Messages;
