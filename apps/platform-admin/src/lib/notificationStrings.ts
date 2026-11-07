import type { ConsoleNotification, NotificationType } from "@/lib/notificationsApi";
import { fmt } from "@/i18n/LocaleContext";

/** The console's notification strings, English and Arabic (MSA, as the merchant dashboard). */
export const NOTIFICATION_STRINGS = {
  en: {
    title: "Notifications",
    description: "What happened on the platform: sign-ups, stores, subscriptions, payments and tickets.",
    bell: "Notifications",
    empty: "No notifications.",
    emptyUnread: "No unread notifications.",
    viewAll: "View all",
    markAllRead: "Mark all read",
    markRead: "Mark read",
    unreadOnly: "Unread only",
    allTypes: "All types",
    loadMore: "Load more",
    settings: "Settings",
    settingsHint: "Choose which notifications you see. Email is saved for later: no email is sent yet.",
    inApp: "In the console",
    email: "Email",
    devices: "Devices",
    save: "Save",
    saved: "Settings saved.",
    unreadCount: "{count} unread",
    type_user_signup: "New sign-up",
    type_workspace_created: "New store",
    type_subscription_activated: "Subscription activated",
    type_subscription_expiring: "Subscription ending soon",
    type_subscription_expired: "Subscription ended",
    type_payment_proof_submitted: "Payment proof sent",
    type_payment_failed: "Payment failed",
    type_support_ticket: "Support ticket",
    type_referral_signup: "Referral sign-up",
    type_user_suspended: "Account suspended",
    type_suggestion: "New suggestion",
    type_wallet_fallback: "Store moved to pay per order",
    type_traffic_cap: "Store over its daily analytics limit",
    type_sms_cap: "Daily SMS cap reached",
    type_referral_code_review: "Referral code waiting for review",
    type_referral_code_decided: "Decision on a referral code",
    type_agent_link_review: "Store agent change waiting for review",
    type_agent_link_decided: "Decision on a store agent change",
    review_code_new: "New code {code} from {actor} is waiting for review",
    review_code_change: "{actor} changed code {code}: it is waiting for review",
    review_link_link: "{actor} asked to link {name} to {agent}",
    review_link_update: "{actor} asked to change {agent}'s link on {name}",
    review_link_end: "{actor} asked to end {agent}'s link on {name}",
    decided_code_approved: "Code {code} was approved",
    decided_code_approved_edited: "Code {code} was approved after {actor} edited it",
    decided_code_rejected: "Code {code} was rejected",
    decided_change_approved: "The change to code {code} was approved",
    decided_change_approved_edited: "The change to code {code} was approved after {actor} edited it",
    decided_change_rejected: "The change to code {code} was rejected. The code goes on as approved",
    decided_link_approved_link: "The request to link {name} to {agent} was approved",
    decided_link_approved_update: "The request to change {agent}'s link on {name} was approved",
    decided_link_approved_end: "The request to end {agent}'s link on {name} was approved",
    decided_link_rejected_link: "The request to link {name} to {agent} was rejected",
    decided_link_rejected_update: "The request to change {agent}'s link on {name} was rejected",
    decided_link_rejected_end: "The request to end {agent}'s link on {name} was rejected",
    reason: "Reason: {reason}",
    someone: "Someone",
    aStore: "a store",
    theAgent: "the agent",
  },
  ar: {
    title: "الإشعارات",
    description: "ما يحدث على المنصة: التسجيلات والمتاجر والاشتراكات والمدفوعات والتذاكر.",
    bell: "الإشعارات",
    empty: "لا توجد إشعارات.",
    emptyUnread: "لا توجد إشعارات غير مقروءة.",
    viewAll: "عرض الكل",
    markAllRead: "تحديد الكل كمقروء",
    markRead: "تحديد كمقروء",
    unreadOnly: "غير المقروءة فقط",
    allTypes: "كل الأنواع",
    loadMore: "عرض المزيد",
    settings: "الإعدادات",
    settingsHint: "اختر الإشعارات التي تظهر لك. خيار البريد يُحفظ فقط: لا يُرسل أي بريد حاليًا.",
    inApp: "في لوحة التحكم",
    email: "البريد",
    devices: "الأجهزة",
    save: "حفظ",
    saved: "تم حفظ الإعدادات.",
    unreadCount: "{count} غير مقروءة",
    type_user_signup: "تسجيل جديد",
    type_workspace_created: "متجر جديد",
    type_subscription_activated: "تفعيل اشتراك",
    type_subscription_expiring: "اشتراك ينتهي قريبًا",
    type_subscription_expired: "انتهاء اشتراك",
    type_payment_proof_submitted: "إرسال إثبات دفع",
    type_payment_failed: "فشل دفع",
    type_support_ticket: "تذكرة دعم",
    type_referral_signup: "تسجيل بإحالة",
    type_user_suspended: "إيقاف حساب",
    type_suggestion: "اقتراح جديد",
    type_wallet_fallback: "متجر انتقل إلى الدفع لكل طلب",
    type_traffic_cap: "متجر تجاوز حده اليومي من بيانات الزيارات",
    type_sms_cap: "بلوغ الحد اليومي للرسائل النصية",
    type_referral_code_review: "كود إحالة بانتظار المراجعة",
    type_referral_code_decided: "قرار بشأن كود إحالة",
    type_agent_link_review: "تعديل وكيل متجر بانتظار المراجعة",
    type_agent_link_decided: "قرار بشأن تعديل وكيل متجر",
    review_code_new: "الكود الجديد {code} من {actor} بانتظار المراجعة",
    review_code_change: "تعديل من {actor} على الكود {code} بانتظار المراجعة",
    review_link_link: "طلب من {actor} لربط {name} بالوكيل {agent}",
    review_link_update: "طلب من {actor} لتعديل ربط الوكيل {agent} في {name}",
    review_link_end: "طلب من {actor} لإنهاء ربط الوكيل {agent} في {name}",
    decided_code_approved: "تمت الموافقة على الكود {code}",
    decided_code_approved_edited: "تمت الموافقة على الكود {code} بعد تعديله من {actor}",
    decided_code_rejected: "رُفض الكود {code}",
    decided_change_approved: "تمت الموافقة على تعديل الكود {code}",
    decided_change_approved_edited: "تمت الموافقة على تعديل الكود {code} بعد تعديله من {actor}",
    decided_change_rejected: "رُفض تعديل الكود {code}، ويستمر الكود بالشروط التي تمت الموافقة عليها",
    decided_link_approved_link: "تمت الموافقة على طلب ربط {name} بالوكيل {agent}",
    decided_link_approved_update: "تمت الموافقة على طلب تعديل ربط الوكيل {agent} في {name}",
    decided_link_approved_end: "تمت الموافقة على طلب إنهاء ربط الوكيل {agent} في {name}",
    decided_link_rejected_link: "رُفض طلب ربط {name} بالوكيل {agent}",
    decided_link_rejected_update: "رُفض طلب تعديل ربط الوكيل {agent} في {name}",
    decided_link_rejected_end: "رُفض طلب إنهاء ربط الوكيل {agent} في {name}",
    reason: "السبب: {reason}",
    someone: "شخص ما",
    aStore: "متجر",
    theAgent: "الوكيل",
  },
};

export type NotificationStrings = (typeof NOTIFICATION_STRINGS)["en"];

export function typeLabel(t: NotificationStrings, type: NotificationType | string): string {
  return (t as Record<string, string>)[`type_${type}`] ?? type;
}

const text = (value: unknown, fallback: string) => (typeof value === "string" && value ? value : fallback);

/**
 * The sentence for a creator's review (referrals/referralReviewNotifications on
 * the API), in the viewer's language, written from the row's data. Null for
 * every other type, which shows its label.
 */
export function reviewTitle(t: NotificationStrings, n: ConsoleNotification): string | null {
  const { data } = n;
  const values = {
    code: text(data.code, ""),
    actor: text(data.actorName, t.someone),
    name: text(data.name, t.aStore),
    agent: text(data.agentName, t.theAgent),
  };
  const say = (key: string) => fmt((t as Record<string, string>)[key] ?? typeLabel(t, n.type), values);
  switch (n.type) {
    case "referral_code_review":
      return say(data.change === "new" ? "review_code_new" : "review_code_change");
    case "referral_code_decided": {
      const what = data.change === "new" ? "code" : "change";
      if (data.decision === "rejected") return say(`decided_${what}_rejected`);
      return say(data.edited ? `decided_${what}_approved_edited` : `decided_${what}_approved`);
    }
    case "agent_link_review":
      return say(`review_link_${text(data.kind, "link")}`);
    case "agent_link_decided":
      return say(`decided_link_${text(data.decision, "approved")}_${text(data.kind, "link")}`);
    default:
      return null;
  }
}

/** The reason a reviewer gave, for the line under a review's sentence. */
export function reviewDetail(t: NotificationStrings, n: ConsoleNotification): string | null {
  return n.body ? fmt(t.reason, { reason: n.body }) : null;
}
