import type { SettingsTone } from "@/components/settings";
import {
  IconAccount,
  IconClipboard,
  IconDocument,
  IconGift,
  IconGlobe,
  IconHeart,
  IconLanguage,
  IconPage,
  IconPhone,
  IconSearch,
  IconShuffle,
  IconStoreSettings,
  type IconComponent,
} from "@/components/icons";
import type { Messages } from "@/i18n/LocaleContext";
import { CUSTOM_DOMAINS_ENABLED, GIFT_OPTIONS_ENABLED, SHOPPER_ACCOUNTS_ENABLED, URL_REDIRECTS_ENABLED } from "@/lib/features";

/**
 * The sections of Store settings (/store-settings/:tab): what the page lists
 * and what the dashboard's search finds (lib/search/siteIndex.ts) — one list
 * for both, so a new section is found as soon as it is here.
 */
export const ALL_STORE_SETTINGS_TABS = ["general", "store-info", "policies", "checkout-form", "gift-options", "thank-you", "pages", "seo", "redirects", "languages", "domains", "customer-accounts"] as const;
export type StoreSettingsTab = (typeof ALL_STORE_SETTINGS_TABS)[number];
type GroupKey = "basics" | "buying" | "showing" | "access";

// Domains, gift options, redirects and customer accounts only while each is switched on (lib/features); off, its address opens the first section.
const OFF_TABS: ReadonlySet<StoreSettingsTab> = new Set<StoreSettingsTab>([
  ...(CUSTOM_DOMAINS_ENABLED ? [] : (["domains"] as const)),
  ...(GIFT_OPTIONS_ENABLED ? [] : (["gift-options"] as const)),
  ...(URL_REDIRECTS_ENABLED ? [] : (["redirects"] as const)),
  ...(SHOPPER_ACCOUNTS_ENABLED ? [] : (["customer-accounts"] as const)),
]);
export const STORE_SETTINGS_TABS: readonly StoreSettingsTab[] = ALL_STORE_SETTINGS_TABS.filter((tab) => !OFF_TABS.has(tab));

export interface StoreSettingsSectionMeta {
  id: StoreSettingsTab;
  group: GroupKey;
  icon: IconComponent;
  tone: SettingsTone;
  /** What the search also finds the section by, in both languages. */
  keywords: string[];
}

/** The list, in the order it is read. The first one is what a desktop opens when the path names none. */
const ALL_SECTIONS: ReadonlyArray<StoreSettingsSectionMeta> = [
  { id: "general", group: "basics", icon: IconStoreSettings, tone: "gray", keywords: ["favicon", "icon", "country", "أيقونة", "الدولة", "البلد"] },
  { id: "store-info", group: "basics", icon: IconPhone, tone: "green", keywords: ["contact", "email", "phone", "address", "trust", "هاتف", "بريد", "عنوان", "بطاقات الثقة"] },
  { id: "policies", group: "basics", icon: IconDocument, tone: "gray", keywords: ["legal", "refund", "privacy policy", "terms", "shipping policy", "سياسة الشحن", "سياسة الاسترجاع", "سياسة الخصوصية", "الشروط"] },
  { id: "checkout-form", group: "buying", icon: IconClipboard, tone: "blue", keywords: ["checkout", "purchase form", "order form", "fields", "custom field", "نموذج الشراء", "نموذج الطلب", "الحقول"] },
  { id: "gift-options", group: "buying", icon: IconGift, tone: "pink", keywords: ["gift", "wrap", "message", "هدية", "هدايا", "تغليف", "رسالة إهداء"] },
  { id: "thank-you", group: "buying", icon: IconHeart, tone: "red", keywords: ["thank you", "after order", "شكرًا", "بعد الطلب", "رسالة الشكر"] },
  { id: "pages", group: "showing", icon: IconPage, tone: "blue", keywords: ["pages", "header", "footer", "menu", "صفحات", "الترويسة", "التذييل", "القائمة"] },
  { id: "seo", group: "showing", icon: IconSearch, tone: "teal", keywords: ["seo", "google", "search", "meta", "title", "description", "share image", "جوجل", "محركات البحث", "وصف المتجر", "صورة المشاركة"] },
  { id: "redirects", group: "showing", icon: IconShuffle, tone: "orange", keywords: ["redirects", "301", "302", "old link", "csv", "تحويل الروابط", "رابط قديم", "روابط"] },
  { id: "languages", group: "showing", icon: IconLanguage, tone: "purple", keywords: ["languages", "translation", "english", "arabic", "french", "لغات", "ترجمة", "الإنجليزية", "العربية"] },
  { id: "domains", group: "showing", icon: IconGlobe, tone: "blue", keywords: ["domain", "dns", "ssl", "www", "دومين", "نطاق", "شهادة"] },
  { id: "customer-accounts", group: "access", icon: IconAccount, tone: "green", keywords: ["accounts", "sign in", "login", "sms", "otp", "تسجيل الدخول", "كود", "حساب العميل"] },
];
export const STORE_SETTINGS_SECTIONS: ReadonlyArray<StoreSettingsSectionMeta> = ALL_SECTIONS.filter((section) => !OFF_TABS.has(section.id));

/** The page's name, the headings of the list and each section's name. */
export const STORE_SETTINGS_SECTION_STRINGS = {
  en: {
    title: "Store settings",
    group_basics: "Basics",
    group_buying: "Buying",
    group_showing: "Showing up",
    group_access: "Access",
    "checkout-form": "Purchase form",
    "thank-you": "Thank-you page",
    "store-info": "Store information",
    policies: "Policies",
    pages: "Pages",
    general: "General",
    seo: "SEO",
    domains: "Domains",
    languages: "Languages",
    "gift-options": "Gift options",
    redirects: "Redirects",
    "customer-accounts": "Customer accounts",
  },
  ar: {
    title: "إعدادات المتجر",
    group_basics: "الأساسيات",
    group_buying: "الشراء",
    group_showing: "الظهور",
    group_access: "الوصول",
    "checkout-form": "نموذج الشراء",
    "thank-you": "صفحة الشكر",
    "store-info": "بيانات المتجر",
    policies: "السياسات",
    pages: "الصفحات",
    general: "عام",
    seo: "SEO",
    domains: "الدومينات",
    languages: "اللغات",
    "gift-options": "خيارات الهدايا",
    redirects: "تحويل الروابط",
    "customer-accounts": "حسابات العملاء",
  },
} satisfies Messages;

/** One line per section: under its name in the phone list, and under the pane's title. */
export const STORE_SETTINGS_DESCRIPTIONS = {
  en: {
    general: "The store's tab icon and its country.",
    "store-info": "Your phone, email and address, and the trust cards on product pages.",
    policies: "Shipping, refund, privacy and terms — written once, linked everywhere.",
    "checkout-form": "What the shopper fills in to order, and what is required.",
    "gift-options": "“Is this a gift?” at checkout: gift wrap and a message.",
    "thank-you": "What the shopper sees right after placing the order.",
    pages: "Which pages show in the header and footer, and which are open.",
    seo: "How the store looks on Google and when its link is shared.",
    redirects: "Send an old address to a new one so no link breaks.",
    languages: "Offer the store in more languages and translate your content.",
    domains: "Connect your own domain, with its certificate.",
    "customer-accounts": "Let customers sign in with a code to see their orders.",
  },
  ar: {
    general: "أيقونة تبويب المتجر ودولته.",
    "store-info": "هاتفك وبريدك وعنوانك، وبطاقات الثقة في صفحات المنتجات.",
    policies: "الشحن والاسترجاع والخصوصية والشروط — تُكتب مرة واحدة وتظهر في كل مكان.",
    "checkout-form": "ما يملؤه العميل ليطلب، وما هو المطلوب منه.",
    "gift-options": "«هل هذا الطلب هدية؟» عند إتمام الشراء: تغليف ورسالة إهداء.",
    "thank-you": "ما يراه العميل فور تسجيل الطلب.",
    pages: "أي الصفحات تظهر في الترويسة والتذييل، وأيها مفتوح.",
    seo: "كيف يظهر متجرك في Google وعند مشاركة رابطه.",
    redirects: "حوّل الرابط القديم إلى الجديد حتى لا ينقطع أي رابط.",
    languages: "اعرض متجرك بأكثر من لغة وترجم محتواك.",
    domains: "اربط الدومين الخاص بك مع شهادته.",
    "customer-accounts": "اسمح للعميل بالدخول بكود ليرى طلباته.",
  },
} satisfies Messages;

export const storeSettingsPath = (tab: StoreSettingsTab | null) => (tab === null ? "/store-settings" : `/store-settings/${tab}`);
