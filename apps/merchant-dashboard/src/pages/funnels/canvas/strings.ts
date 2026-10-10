import { fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";
import type { UiEdgeCondition } from "../funnelAdapter";

/**
 * The flow map's own words (toolbar, cards, arrows, split-test chip, the
 * empty map). The sentences the editor's tests pin — the offer line, the
 * empty page, the problem count — stay in FunnelEditorPage.strings.ts.
 */
export const MAP_STRINGS = {
  en: {
    // toolbar
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    zoomNow: "Zoom {pct}",
    fit: "Fit to screen",
    tidy: "Tidy the map",
    tidyHint: "Line the steps up in flow order, yes above no.",
    period: "Numbers for",
    legend: "What the lines mean",
    legendYes: "Accepted the offer",
    legendNo: "Refused the offer",
    legendOrder: "Placed the order",
    legendNext: "Next step",
    legendButton: "A button on the page",
    mapHelp: "Arrow keys move between steps. Enter opens the page. Plus and minus zoom, 0 fits the map.",
    // card
    entry: "Start",
    openPage: "Open page",
    openPageOf: "Open the page of {name}",
    addAfter: "Add a step after {name}",
    insertHere: "Add a step between {from} and {to}",
    pickType: "Add which step?",
    close: "Close",
    stepActions: "Step actions",
    menuOpen: "Open the page",
    menuAdd: "Add the next step",
    menuDelete: "Delete the step",
    // numbers
    visits: "visits",
    orders: "orders",
    signups: "sign-ups",
    reach: "reached",
    noVisits: "No visits yet",
    statsOf: "{visits} visits, {reach} of visitors reached this step",
    arrived: "{pct} of the visitors of {from} reached {to}",
    left: "{pct} left",
    // split test
    abRunning: "A/B test",
    abPaused: "Test paused",
    abDone: "Winner live",
    abOpen: "A/B test on {name}",
    abShare: "{pct} of visitors",
    abVisits: "Visits",
    abOrders: "Orders",
    abRate: "Conversion",
    abLeader: "Leading",
    abWinner: "Winner",
    abOriginal: "Original",
    abLoading: "Loading the numbers…",
    abNoNumbers: "The numbers are in “Tests and settings”.",
    abManage: "Pause it, pick the winner or change the shares from “Tests and settings”.",
    abPausedNote: "Paused: visitors see the original page.",
    abDoneNote: "Finished: every visitor sees the winner's page until the test is deleted.",
    // empty map
    emptyTitle: "Start the funnel from a template",
    emptyBody: "Pick the path closest to how you sell. Every step and page can be changed afterwards, and nothing is saved until you press Save.",
    emptyPrimary: "Start with one product, cash on delivery",
    emptyOthers: "Or pick another path",
    emptyBest: "Best to start with",
    orBlank: "Or add the steps one by one from “Add step”.",
  },
  ar: {
    zoomOut: "تصغير",
    zoomIn: "تكبير",
    zoomNow: "التكبير {pct}",
    fit: "ملاءمة الشاشة",
    tidy: "ترتيب الخريطة",
    tidyHint: "يرتّب الخطوات بترتيب مسار البيع، ويضع «وافق» فوق «رفض».",
    period: "الأرقام عن",
    legend: "معنى الخطوط",
    legendYes: "وافق على العرض",
    legendNo: "رفض العرض",
    legendOrder: "أتمّ الطلب",
    legendNext: "الخطوة التالية",
    legendButton: "زر في الصفحة",
    mapHelp: "الأسهم تنقلك بين الخطوات. Enter يفتح الصفحة. زائد وناقص للتكبير، و0 لملاءمة الشاشة.",
    entry: "البداية",
    openPage: "فتح الصفحة",
    openPageOf: "فتح صفحة {name}",
    addAfter: "إضافة خطوة بعد {name}",
    insertHere: "إضافة خطوة بين {from} و{to}",
    pickType: "أي خطوة تريد إضافتها؟",
    close: "إغلاق",
    stepActions: "إجراءات الخطوة",
    menuOpen: "فتح الصفحة",
    menuAdd: "إضافة الخطوة التالية",
    menuDelete: "حذف الخطوة",
    visits: "زيارة",
    orders: "طلب",
    signups: "اشتراك",
    reach: "وصلوا",
    noVisits: "لا توجد زيارات بعد",
    statsOf: "{visits} زيارة، و{reach} من الزوار وصلوا إلى هذه الخطوة",
    arrived: "{pct} من زوار «{from}» وصلوا إلى «{to}»",
    left: "{pct} غادروا",
    abRunning: "اختبار A/B",
    abPaused: "الاختبار متوقف",
    abDone: "النسخة الفائزة تعمل",
    abOpen: "اختبار A/B على {name}",
    abShare: "{pct} من الزوار",
    abVisits: "زيارات",
    abOrders: "طلبات",
    abRate: "التحويل",
    abLeader: "متقدّمة",
    abWinner: "الفائزة",
    abOriginal: "الأصلية",
    abLoading: "جارٍ جلب الأرقام…",
    abNoNumbers: "الأرقام موجودة في «الاختبارات والإعدادات».",
    abManage: "أوقفه أو اختر الفائزة أو غيّر النسب من «الاختبارات والإعدادات».",
    abPausedNote: "متوقف: يرى الزوار الصفحة الأصلية.",
    abDoneNote: "انتهى: يرى كل الزوار الصفحة الفائزة إلى أن تحذف الاختبار.",
    emptyTitle: "ابدأ مسار البيع من قالب",
    emptyBody: "اختر أقرب مسار لطريقة بيعك. يمكنك تغيير أي خطوة أو صفحة لاحقًا، ولا يُحفظ شيء حتى تضغط حفظ.",
    emptyPrimary: "ابدأ بمنتج واحد والدفع عند الاستلام",
    emptyOthers: "أو اختر مسارًا آخر",
    emptyBest: "الأنسب للبداية",
    orBlank: "أو أضف الخطوات واحدة تلو الأخرى من «إضافة خطوة».",
  },
} satisfies Messages;

/** The short word an arrow carries, per condition. */
export const ARROW_LABELS: Record<Locale, Record<UiEdgeCondition, string>> = {
  en: { always: "Next", completed_checkout: "Ordered", accepted_offer: "Yes", declined_offer: "No", clicked_through: "Button" },
  ar: { always: "بعدها", completed_checkout: "طلب", accepted_offer: "وافق", declined_offer: "رفض", clicked_through: "زر" },
};

/** A count in the language's digits. */
export const num = (n: number) => fmt("{n}", { n });

/** 0.684 -> "68%" in the language's digits; "—" when there is nothing to divide. */
export const pct = (ratio: number | null | undefined) => formatPercentValue(ratio, 0);
