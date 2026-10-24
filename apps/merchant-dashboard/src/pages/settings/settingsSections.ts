import type { SettingsTone } from "@/components/settings";
import {
  IconAccount,
  IconBell,
  IconCard,
  IconClock,
  IconEmail,
  IconFilter,
  IconGift,
  IconHoliday,
  IconKey,
  IconMessage,
  IconShield,
  IconStore,
  IconTeam,
  IconTheme,
  IconWhatsApp,
  type IconComponent,
} from "@/components/icons";
import type { Messages } from "@/i18n/LocaleContext";
import { HOLIDAY_MODE_ENABLED } from "@/lib/features";
import { BILLING_ROLES } from "@/pages/subscription/billingText";

/**
 * The sections of Settings (/settings?tab=<id>): what the page lists and what
 * the dashboard's search finds (lib/search/siteIndex.ts) — one list for both,
 * so a new section is found as soon as it is here.
 */
export const SETTINGS_SECTION_STRINGS = {
  en: {
    // The headings of the list.
    g_store: "The store",
    g_orders: "Orders",
    g_messages: "Messages",
    g_team: "Team",
    g_billing: "Plan",
    g_account: "My account",
    g_developers: "For developers",
    // Each section: its name in the list, and one line of what it is for.
    s_identity: "Store identity",
    d_identity: "Name, logo, tagline and colours",
    s_account_settings: "Time zone and invoices",
    d_account_settings: "The store's clock, the contact email and the business on invoices",
    s_catalog: "Product listing",
    d_catalog: "Filters and sorting on the store's product pages",
    s_order_bump: "Offer with the order",
    d_order_bump: "One add-on offer shown above the order button",
    s_holiday: "Holiday mode",
    d_holiday: "Pause orders, or take them and ship later",
    s_whatsapp_message: "WhatsApp message",
    d_whatsapp_message: "What the confirmation message says",
    s_whatsapp: "WhatsApp connection",
    d_whatsapp: "Your WhatsApp Business number, for the inbox and automations",
    s_order_emails: "Order emails",
    d_order_emails: "The emails customers get, and who they are from",
    s_members: "Members and invites",
    d_members: "Who can sign in to this store, and inviting more",
    s_billing: "Plan and billing",
    d_billing: "Your plan, what is due and this month's usage",
    s_profile: "Profile",
    d_profile: "Your name, username, email and phone",
    s_appearance: "Language and look",
    d_appearance: "Arabic or English, light or dark, glass",
    s_notifications: "Notifications",
    d_notifications: "What you are told about, and where",
    s_security: "Security",
    d_security: "Two-step sign-in, password and signed-in devices",
    // The same section while two-step sign-in is switched off.
    d_security_basic: "Password and signed-in devices",
    s_developers: "API keys and webhooks",
    d_developers: "Connect other systems to this store",
  },
  ar: {
    g_store: "المتجر",
    g_orders: "الطلبات",
    g_messages: "الرسائل",
    g_team: "الفريق",
    g_billing: "الخطة",
    g_account: "حسابي",
    g_developers: "للمطوّرين",
    s_identity: "هوية المتجر",
    d_identity: "الاسم والشعار وجملة التعريف والألوان",
    s_account_settings: "التوقيت والفواتير",
    d_account_settings: "توقيت المتجر وبريد التواصل وبيانات النشاط على الفواتير",
    s_catalog: "عرض المنتجات",
    d_catalog: "الفلاتر والترتيب في صفحات المنتجات بالمتجر",
    s_order_bump: "عرض مع الطلب",
    d_order_bump: "عرض إضافي واحد يظهر فوق زر الطلب",
    s_holiday: "وضع الإجازة",
    d_holiday: "أوقف الطلبات، أو اقبلها واشحنها لاحقًا",
    s_whatsapp_message: "رسالة واتساب",
    d_whatsapp_message: "نص رسالة تأكيد الطلب",
    s_whatsapp: "ربط واتساب",
    d_whatsapp: "رقم واتساب للأعمال الخاص بك، للرسائل والأتمتة",
    s_order_emails: "بريد الطلبات",
    d_order_emails: "الرسائل التي تصل العميل، وباسم مَن تُرسل",
    s_members: "الأعضاء والدعوات",
    d_members: "مَن يستطيع دخول هذا المتجر، ودعوة آخرين",
    s_billing: "الخطة والفوترة",
    d_billing: "خطتك، والمبلغ المستحق، واستهلاك الشهر",
    s_profile: "الملف الشخصي",
    d_profile: "اسمك واسم المستخدم والبريد الإلكتروني والهاتف",
    s_appearance: "اللغة والشكل",
    d_appearance: "عربي أو إنجليزي، فاتح أو داكن، الزجاج",
    s_notifications: "الإشعارات",
    d_notifications: "ما الذي يصلك، وأين",
    s_security: "الأمان",
    d_security: "الدخول بخطوتين وكلمة المرور والأجهزة المسجَّل دخولها",
    d_security_basic: "كلمة المرور والأجهزة المسجَّل دخولها",
    s_developers: "مفاتيح API والـ webhooks",
    d_developers: "اربط أنظمة أخرى بهذا المتجر",
  },
} satisfies Messages;

/**
 * Every section of the page, in the order of the list. The id is what `?tab=`
 * carries. `key` is the id as it is spelled in the string keys (s_<key>,
 * d_<key>), `group` the heading it sits under, `words` what the search also
 * finds it by. `when` reads the build switch the section needs (read on each
 * call, as the page always did); `onlyForRoles` the roles it is listed for
 * (the others have nothing in it).
 */
export const SETTINGS_SECTIONS = [
  { id: "identity", key: "identity", group: "store", icon: IconStore, tone: "blue", words: ["store identity", "store profile", "name", "logo", "tagline", "colours", "colors", "brand", "هوية", "الاسم", "الشعار", "اللوجو", "ألوان"] },
  { id: "account-settings", key: "account_settings", group: "store", icon: IconClock, tone: "gray", words: ["account settings", "time zone", "timezone", "invoice", "legal", "contact email", "country", "التوقيت", "فاتورة", "الفواتير", "البلد", "العملة"] },
  { id: "catalog", key: "catalog", group: "store", icon: IconFilter, tone: "purple", words: ["catalog", "listing", "filters", "sort", "products", "الكتالوج", "فلاتر", "ترتيب", "المنتجات"] },
  { id: "order-bump", key: "order_bump", group: "store", icon: IconGift, tone: "pink", words: ["order bump", "add-on", "upsell", "offer", "checkout", "عرض", "إضافي", "الدفع"] },
  { id: "holiday", key: "holiday", group: "orders", icon: IconHoliday, tone: "orange", words: ["holiday", "vacation", "pause", "away", "إجازة", "أجازة", "إيقاف"], when: () => HOLIDAY_MODE_ENABLED },
  { id: "whatsapp-message", key: "whatsapp_message", group: "messages", icon: IconMessage, tone: "green", words: ["whatsapp message", "template", "confirmation", "رسالة", "واتساب", "تأكيد", "قالب"] },
  { id: "whatsapp", key: "whatsapp", group: "messages", icon: IconWhatsApp, tone: "green", words: ["whatsapp", "cloud api", "meta", "connect", "واتساب", "ربط", "ميتا"] },
  { id: "order-emails", key: "order_emails", group: "messages", icon: IconEmail, tone: "blue", words: ["emails", "sender", "reply-to", "إيميل", "إيميلات", "بريد", "المرسل"] },
  { id: "members", key: "members", group: "team", icon: IconTeam, tone: "blue", words: ["team", "members", "invite", "roles", "الفريق", "أعضاء", "دعوة", "دور", "صلاحيات"] },
  { id: "billing", key: "billing", group: "billing", icon: IconCard, tone: "green", words: ["plan", "billing", "subscription", "pay", "usage", "referral code", "الخطة", "الفوترة", "الفواتير", "اشتراك", "دفع", "استهلاك"], onlyForRoles: BILLING_ROLES },
  { id: "profile", key: "profile", group: "account", icon: IconAccount, tone: "blue", words: ["profile", "account", "name", "username", "email", "phone", "اسمي", "اسم المستخدم", "البريد", "الهاتف", "حسابي"] },
  { id: "appearance", key: "appearance", group: "account", icon: IconTheme, tone: "purple", words: ["language", "theme", "dark", "light", "black", "oled", "tone", "glass", "glow", "appearance", "look", "اللغة", "عربي", "إنجليزي", "داكن", "غامق", "فاتح", "أسود", "درجة", "زجاج", "توهج", "المظهر", "الشكل"] },
  { id: "notifications", key: "notifications", group: "account", icon: IconBell, tone: "red", words: ["notifications", "sound", "summary reports", "email", "إشعارات", "تنبيهات", "صوت", "تقارير"] },
  { id: "security", key: "security", group: "account", icon: IconShield, tone: "green", words: ["security", "two-step", "2fa", "two factor", "password", "backup codes", "sign out", "devices", "sessions", "الأمان", "خطوتين", "كلمة المرور", "رموز احتياطية", "تسجيل الخروج", "الأجهزة", "الجلسات"] },
  { id: "developers", key: "developers", group: "developers", icon: IconKey, tone: "gray", words: ["api", "api keys", "webhooks", "developers", "مفاتيح", "ويب هوك", "المطورين"] },
] as const satisfies ReadonlyArray<{
  id: string;
  key: string;
  group: string;
  icon: IconComponent;
  tone: SettingsTone;
  words: readonly string[];
  when?: () => boolean;
  onlyForRoles?: ReadonlySet<string>;
}>;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SettingsSectionId = SettingsSection["id"];

/** Whether a section is listed: its switch is on, and the role is one it is for. */
export function isSettingsSectionShown(section: SettingsSection, role: string | null | undefined): boolean {
  if ("when" in section && !section.when()) return false;
  if ("onlyForRoles" in section && !section.onlyForRoles.has(role ?? "")) return false;
  return true;
}
