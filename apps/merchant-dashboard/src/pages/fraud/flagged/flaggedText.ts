import type { FlaggedOrder } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/** Every word of the Flagged tab: the tab, its rows and its Quick Look read it through `useT(FLAGGED_STRINGS)`. */
export const FLAGGED_STRINGS = {
  en: {
    scopeLabel: "Which flagged orders to show",
    scopeOpen: "Awaiting a call",
    scopeAll: "All flagged",
    listLabel: "Flagged orders",
    emptyOpen: "No flagged orders are waiting on a call",
    emptyOpenHow: "An order lands here when one of your rules flags it for review.",
    emptyAll: "No orders have been flagged.",
    noName: "Customer without a name",
    reasons: "Why it was flagged",
    cancelled: "Cancelled",
    pass: "Let it through",
    passed: "Flag cleared on {order}. It carries on as a normal order.",
    passHint: "Letting it through only clears the flag: the order carries on as normal. This does not confirm or ship it.",
    block: "Block and cancel",
    blockTitle: "Block and cancel {order}?",
    blockDescription: "The order is cancelled, its phone number is blocked from ordering, and its internet address is blocked from ordering and from seeing your store.",
    blocking: "Blocking…",
    keep: "Keep the order",
    blocked: "{order} was cancelled and its customer blocked.",
    peek: "Preview order {order}",
    menuLabel: "Actions for order {order}",
    menuOpen: "Open the order",
    menuCall: "Call",
    menuWhatsapp: "WhatsApp",
    menuCopyPhone: "Copy the number",
    menuCopyOrder: "Copy the order number",
    copiedPhone: "The customer's number is copied",
    copiedOrder: "The order number is copied",
    openOrder: "Open order {number}",
    colCustomer: "Customer",
    colReasons: "Why it was flagged",
    colTotal: "Total",
    colStatus: "The call",
    colAction: "Decision",
    placed: "Placed {when}",
    total: "Total",
    customer: "Customer",
    noPhone: "No phone number",
    phoneHidden: "Part of the number is hidden. The order's page has the whole number.",
    queueLink: "Open the confirmation queue",
    moreFlags: "+{n}",
  },
  ar: {
    scopeLabel: "أي الطلبات المشتبه بها تظهر",
    scopeOpen: "تنتظر مكالمة",
    scopeAll: "كل المشتبه بها",
    listLabel: "الطلبات المشتبه بها",
    emptyOpen: "لا توجد طلبات مشتبه بها تنتظر مكالمة",
    emptyOpenHow: "يصل الطلب إلى هنا عندما تعلّمه إحدى قواعدك للمراجعة.",
    emptyAll: "لم يُميَّز أي طلب كمشتبه به.",
    noName: "عميل بدون اسم",
    reasons: "سبب الاشتباه",
    cancelled: "ملغي",
    pass: "السماح بمروره",
    passed: "أُزيلت العلامة عن {order}، وسيُكمل كطلب عادي.",
    passHint: "«السماح بمروره» يزيل العلامة فقط: يُكمل الطلب بشكل عادي، ولا يُؤكَّد ولا يُشحن من هنا.",
    block: "حظر وإلغاء",
    blockTitle: "حظر وإلغاء {order}؟",
    blockDescription: "يُلغى الأوردر، ويُحظر رقم الهاتف من الطلب، ويُحظر عنوان الإنترنت من الطلب ومن رؤية متجرك.",
    blocking: "جارٍ الحظر…",
    keep: "إبقاء الطلب",
    blocked: "تم إلغاء {order} وحظر العميل.",
    peek: "معاينة الطلب {order}",
    menuLabel: "إجراءات الطلب {order}",
    menuOpen: "فتح الطلب",
    menuCall: "اتصال",
    menuWhatsapp: "واتساب",
    menuCopyPhone: "نسخ الرقم",
    menuCopyOrder: "نسخ رقم الطلب",
    copiedPhone: "تم نسخ رقم العميل",
    copiedOrder: "تم نسخ رقم الطلب",
    openOrder: "فتح الطلب {number}",
    colCustomer: "العميل",
    colReasons: "سبب التعليم",
    colTotal: "الإجمالي",
    colStatus: "المكالمة",
    colAction: "القرار",
    placed: "طُلب {when}",
    total: "الإجمالي",
    customer: "العميل",
    noPhone: "لا يوجد رقم هاتف",
    phoneHidden: "جزء من الرقم مخفي. الرقم كامل في صفحة الطلب.",
    queueLink: "فتح قائمة التأكيد",
    moreFlags: "+{n}",
  },
} satisfies Messages;

// The flags that mean "this one has a record": a blocked customer, a high risk level, a customer
// who keeps refusing. Three flags or more on one order count the same.
const HEAVY_FLAGS: ReadonlySet<string> = new Set(["blacklisted_customer", "high_risk", "high_rejection_customer"]);

/**
 * How strongly a flagged row is tinted (glass/returns-protection.css): red for
 * a heavy flag or a pile of them, amber otherwise. A tint only — the reasons
 * themselves are written on the row, so nothing depends on the colour.
 */
export function riskTone(order: FlaggedOrder): "danger" | "warning" {
  return order.riskFlags.length >= 3 || order.riskFlags.some((flag) => HEAVY_FLAGS.has(flag)) ? "danger" : "warning";
}
