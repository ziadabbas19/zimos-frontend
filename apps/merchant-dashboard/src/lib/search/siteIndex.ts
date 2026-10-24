import type { PlanFeatureKey } from "@store-builder/api-client";
import {
  IconAccount,
  IconBlock,
  IconBlog,
  IconBoxes,
  IconChart,
  IconCheck,
  IconClock,
  IconCode,
  IconContacts,
  IconCourier,
  IconCrown,
  IconDevices,
  IconDocument,
  IconDoor,
  IconEmail,
  IconField,
  IconFilter,
  IconGift,
  IconGlobe,
  IconHourglass,
  IconImage,
  IconInvoice,
  IconKey,
  IconLanguage,
  IconLayers,
  IconLink,
  IconLock,
  IconMap,
  IconMoon,
  IconMoreReports,
  IconOrders,
  IconPeople,
  IconPhone,
  IconPlug,
  IconProductAdd,
  IconReceipt,
  IconReports,
  IconRobot,
  IconRss,
  IconRuler,
  IconSearch,
  IconSend,
  IconShield,
  IconShipping,
  IconShuffle,
  IconSparkle,
  IconStore,
  IconStyle,
  IconTag,
  IconTrendUp,
  IconUser,
  IconUserAdd,
  IconVerified,
  IconWallet,
  IconWhatsApp,
  type IconComponent,
} from "@/components/icons";
import {
  AI_ENABLED,
  BLOG_ENABLED,
  CUSTOMER_REFERRALS_ENABLED,
  CUSTOM_DOMAINS_ENABLED,
  EMAIL_SUPPRESSIONS_ENABLED,
  LOYALTY_ENABLED,
  PRODUCT_SPECS_ENABLED,
  SIZE_CHARTS_ENABLED,
  STORE_CREDIT_ENABLED,
  STORE_REPORTS_ENABLED,
  TWO_FACTOR_ENABLED,
  VIP_TIERS_ENABLED,
  VISITORS_ENABLED,
} from "@/lib/features";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_ITEMS, NAV_LABELS, findNavItem, type NavKey } from "@/lib/navigation";
import { STORE_REPORT_ROUTES, STORE_REPORT_STRINGS, STORE_REPORTS_INDEX, storeReportPath } from "@/pages/analytics/storeReports/storeReportStrings";
import { VISITORS_STRINGS } from "@/pages/analytics/visitors/visitorsStrings";
import { BLOG_WORDS } from "@/pages/blog/blogStrings";
import { SUPPRESSION_STRINGS } from "@/pages/customers/suppressions/suppressionStrings";
import { REFERRAL_STRINGS } from "@/pages/customerReferrals/referralStrings";
import { LOYALTY_STRINGS } from "@/pages/loyalty/loyaltyStrings";
import { PAYMENT_ROLES, PAYMENT_SECTIONS, PAYMENT_SECTION_STRINGS } from "@/pages/payments/paymentSections";
import { SPEC_STRINGS } from "@/pages/productSpecs/specStrings";
import { COSTS_STRINGS } from "@/pages/profit/costsModel";
import { SETTINGS_SECTIONS, SETTINGS_SECTION_STRINGS } from "@/pages/settings/settingsSections";
import { SETTLEMENT_STRINGS } from "@/pages/settlements/settlementStrings";
import { SHIPPING_ICONS, SHIPPING_KEYWORDS, SHIPPING_SECTION_STRINGS, SHIPPING_TABS } from "@/pages/shipping/ShippingTabs";
import { STORE_CREDIT_STRINGS } from "@/pages/storeCredit/storeCreditStrings";
import { STORE_SETTINGS_DESCRIPTIONS, STORE_SETTINGS_SECTIONS, STORE_SETTINGS_SECTION_STRINGS, storeSettingsPath } from "@/pages/storeDesign/storeSettingsSections";
import { SUBSCRIPTION_STRINGS } from "@/pages/subscription/subscriptionStrings";
import { VIP_STRINGS } from "@/pages/vipTiers/vipTierStrings";
import { SEARCH_ENTRY_STRINGS, SEARCH_UI_STRINGS, type SearchEntryText } from "./searchStrings";
import { matchScore, type Searchable } from "./match";

/**
 * Every place in the dashboard the search can open, in one list: the pages of
 * the side menu, the pages reached from them, their tabs, the sections of the
 * settings-like pages, single settings inside those sections, and a few
 * actions. Spotlight (components/CommandPalette.tsx) searches all of it; the
 * search of a settings list (components/settings/SettingsLayout.tsx) searches
 * its own page's part.
 *
 * Most of it is read from where the dashboard already defines it, so it
 * cannot drift:
 *   - the side menu (lib/navigation.ts NAV_GROUPS): a new menu entry is found
 *     at once, under its menu heading;
 *   - each settings page's own section list (settingsSections.ts,
 *     storeSettingsSections.ts, ShippingTabs.tsx, paymentSections.ts) and the
 *     store reports' list.
 * The rest is declared below, one line each: a page reached from another
 * page, a tab kept in the address (`?tab=`), a single setting (with the
 * `data-search-anchor` it is marked by on its page), an action.
 *
 * lib/search/siteIndex.test.ts fails for a route of App.tsx that is neither
 * here nor in ROUTES_NOT_IN_SEARCH, for an entry whose address has no route
 * or whose anchor is on no page.
 */

export type SearchScope = "settings" | "store-settings" | "shipping" | "payments";
export type SearchKind = "page" | "section" | "tab" | "setting" | "action";

export interface Bilingual {
  en: string;
  ar: string;
}

/** A plan feature an entry needs. */
export interface SearchPlanRule {
  feature: PlanFeatureKey;
  /**
   * Locked whenever the store lacks the key (a benefit, like hiding the
   * branding). Without it, locked only while the gate refuses (enforced).
   */
  benefit?: boolean;
}

interface EntryDef {
  /** Stable: kept in the recent list. */
  id: string;
  kind: SearchKind;
  title: Bilingual;
  description?: Bilingual;
  /** Other words it is found by, in both languages. */
  keywords?: readonly string[];
  /** The address it opens, with its query (`?tab=`). */
  to: string;
  /** The block brought into view and marked once the page is drawn: its `data-search-anchor`. */
  anchor?: string;
  icon: IconComponent;
  /** The entry it sits under (its breadcrumb). Its role rules apply to this one too. */
  parent?: string;
  /** Roles that don't see it (as a menu entry's hiddenForRoles). */
  hiddenForRoles?: ReadonlySet<string>;
  /** The only roles that see it. */
  onlyForRoles?: ReadonlySet<string>;
  plan?: SearchPlanRule;
  /** The settings list it belongs to, and the section of that list it opens. */
  scope?: SearchScope;
  section?: string;
  /** A build switch it needs (lib/features); off, it is not in the index. */
  when?: boolean;
}

export interface SearchEntry extends Omit<EntryDef, "keywords" | "when"> {
  keywords: readonly string[];
  /** The heading it is listed under: its side-menu group (or its page, for a page without one). */
  heading: Bilingual;
  /** The places it sits in, outermost first. */
  trail: Bilingual[];
  searchable: Searchable;
}

function both<K extends string>(messages: { en: Record<K, string>; ar: Record<K, string> }, key: K): Bilingual {
  return { en: messages.en[key], ar: messages.ar[key] };
}

const text = (key: SearchEntryText) => both(SEARCH_ENTRY_STRINGS, key);

export const pageId = (to: string) => `page:${to}`;

/** Words each menu page is also found by. A page without a line here is found by its name. */
const PAGE_WORDS: Partial<Record<NavKey, readonly string[]>> = {
  overview: ["home", "dashboard", "start", "لوحة التحكم", "البداية"],
  orders: ["sales", "order list", "أوردرات", "مبيعات"],
  confirmationQueue: ["confirm", "calls", "call center", "تأكيد", "مكالمات", "كول سنتر"],
  abandonedCarts: ["abandoned carts", "abandoned checkout", "سلات متروكة", "طلبات ناقصة"],
  returns: ["refund", "exchange", "مرتجع", "استرجاع", "استبدال"],
  fraud: ["block", "blacklist", "fake orders", "احتيال", "حظر", "بلاك ليست"],
  catalog: ["catalog", "inventory", "stock", "مخزون", "كتالوج"],
  reviews: ["ratings", "مراجعات", "آراء"],
  productQuestions: ["q&a", "استفسارات"],
  sizeCharts: ["sizes", "مقاسات"],
  digital: ["downloads", "files", "تحميل", "ملفات"],
  courses: ["lessons", "students", "دروس", "طلاب"],
  media: ["images", "photos", "uploads", "صور", "ميديا"],
  customers: ["contacts", "clients", "جهات الاتصال", "زبائن"],
  loyalty: ["points", "rewards", "vip", "store credit", "نقاط", "مكافآت", "رصيد"],
  inbox: ["whatsapp", "chat", "messages", "واتساب", "محادثات", "رسائل"],
  marketing: ["campaigns", "email", "sms", "حملات"],
  offers: ["upsell", "bundles", "باقات"],
  discounts: ["coupons", "promo code", "voucher", "كوبون", "كود خصم"],
  giftCards: ["vouchers", "قسائم"],
  automations: ["workflows", "auto messages", "رسائل تلقائية"],
  ai: ["artificial intelligence", "generate", "ذكاء اصطناعي"],
  website: ["theme", "design", "editor", "home page", "التصميم", "الثيم", "المحرر"],
  blog: ["articles", "posts", "مقالات"],
  funnels: ["landing pages", "sales funnel", "صفحات هبوط", "فانل"],
  shoppableImages: ["lookbook", "tagged photos"],
  analytics: ["reports", "statistics", "تقارير", "إحصائيات"],
  realtime: ["live", "now", "مباشر", "الآن"],
  webAnalytics: ["traffic", "visits", "page views", "زيارات", "ترافيك"],
  visitors: ["sessions", "جلسات"],
  attribution: ["sources", "utm", "campaigns", "مصادر", "الحملات"],
  profit: ["margin", "costs", "تكاليف", "هامش"],
  ads: ["ad spend", "facebook ads", "tiktok ads", "إعلانات", "ميزانية"],
  payments: ["gateway", "instapay", "cash on delivery", "دفع", "بوابة"],
  settlements: ["cod", "cash collection", "couriers money", "تسويات", "فلوس الشحن"],
  shipping: ["delivery", "tax", "couriers", "توصيل", "ضرائب"],
  subscription: ["plan", "billing", "upgrade", "invoices", "اشتراك", "ترقية", "فواتير"],
  settings: ["preferences", "account", "تفضيلات"],
  activity: ["audit log", "history", "سجل"],
  support: ["help", "ticket", "contact", "مساعدة", "تذكرة"],
  suggestions: ["feature request", "feedback", "اقتراح", "ميزة جديدة"],
};

/** A menu page whose content the plan holds back (the server refuses its data without the key). */
const PAGE_PLAN: Partial<Record<NavKey, SearchPlanRule>> = {
  webAnalytics: { feature: "advanced_analytics" },
};

/** The heading of each menu page: its group's name, or its own for a page in a group without one. */
const MENU_HEADING = new Map<string, Bilingual>();

const MENU: EntryDef[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => {
    const title = both(NAV_LABELS, item.key);
    MENU_HEADING.set(pageId(item.to), group.labelKey ? both(NAV_GROUP_LABELS, group.labelKey) : title);
    return {
      id: pageId(item.to),
      kind: "page" as const,
      title,
      keywords: PAGE_WORDS[item.key],
      to: item.to,
      icon: item.icon,
      hiddenForRoles: item.hiddenForRoles,
      plan: PAGE_PLAN[item.key],
    };
  })
);

const SETTINGS: EntryDef[] = SETTINGS_SECTIONS.map((section) => ({
  id: `settings:${section.id}`,
  kind: "section",
  title: both(SETTINGS_SECTION_STRINGS, `s_${section.key}`),
  // Security is always listed; two-step sign-in is its part behind a switch.
  description: both(SETTINGS_SECTION_STRINGS, section.id === "security" && !TWO_FACTOR_ENABLED ? "d_security_basic" : `d_${section.key}`),
  keywords: section.words,
  to: `/settings?tab=${section.id}`,
  icon: section.icon,
  parent: pageId("/settings"),
  onlyForRoles: "onlyForRoles" in section ? section.onlyForRoles : undefined,
  scope: "settings",
  section: section.id,
  when: "when" in section ? section.when() : undefined,
}));

const STORE_SETTINGS: EntryDef[] = STORE_SETTINGS_SECTIONS.map((section) => ({
  id: `store-settings:${section.id}`,
  kind: "section",
  title: both(STORE_SETTINGS_SECTION_STRINGS, section.id),
  description: both(STORE_SETTINGS_DESCRIPTIONS, section.id),
  keywords: section.keywords,
  to: storeSettingsPath(section.id),
  icon: section.icon,
  parent: pageId("/store-settings"),
  scope: "store-settings",
  section: section.id,
}));

const SHIPPING: EntryDef[] = SHIPPING_TABS.map((id) => ({
  id: `shipping:${id}`,
  kind: "section",
  title: both(SHIPPING_SECTION_STRINGS, id),
  description: both(SHIPPING_SECTION_STRINGS, `${id}Hint`),
  keywords: SHIPPING_KEYWORDS[id],
  to: `/shipping?tab=${id}`,
  icon: SHIPPING_ICONS[id],
  parent: pageId("/shipping"),
  scope: "shipping",
  section: id,
}));

const PAYMENTS: EntryDef[] = PAYMENT_SECTIONS.map((section) => ({
  id: `payments:${section.id}`,
  kind: "section",
  title: both(PAYMENT_SECTION_STRINGS, section.label),
  description: both(PAYMENT_SECTION_STRINGS, section.hint),
  keywords: section.keywords,
  to: `/payments?tab=${section.id}`,
  icon: section.icon,
  parent: pageId("/payments"),
  // Other roles get one line on the page: there is nothing in its sections for them.
  onlyForRoles: PAYMENT_ROLES,
  scope: "payments",
  section: section.id,
}));

const STORE_REPORTS: EntryDef[] = [
  { id: pageId(STORE_REPORTS_INDEX), kind: "page", title: both(STORE_REPORT_STRINGS, "moreReports"), description: both(STORE_REPORT_STRINGS, "moreReportsHint"), to: STORE_REPORTS_INDEX, icon: IconMoreReports, parent: pageId("/analytics"), when: STORE_REPORTS_ENABLED },
  ...STORE_REPORT_ROUTES.map((report) => ({
    id: pageId(storeReportPath(report.slug)),
    kind: "page" as const,
    title: both(STORE_REPORT_STRINGS, report.key),
    description: both(STORE_REPORT_STRINGS, `${report.key}Hint`),
    to: storeReportPath(report.slug),
    icon: IconReports,
    parent: pageId(STORE_REPORTS_INDEX),
    when: STORE_REPORTS_ENABLED,
  })),
];

/** The menu row of Loyalty & rewards: the programme pages sit under it. */
const REWARDS = NAV_ITEMS.find((item) => item.key === "loyalty");

/** A single setting inside a section, named by `key`: opens its section and marks its block. */
function setting(
  key: SearchEntryText,
  def: Omit<EntryDef, "id" | "kind" | "title" | "parent" | "to"> & { anchor: string; scope: SearchScope; section: string }
): EntryDef {
  // Store settings keep the section in the path; the other lists in `?tab=`.
  const to = def.scope === "store-settings" ? `/store-settings/${def.section}` : `/${def.scope}?tab=${def.section}`;
  return { ...def, id: `setting:${key}`, kind: "setting", title: text(key), parent: `${def.scope}:${def.section}`, to };
}

/**
 * What the side menu and the settings lists don't hold, one line each. A
 * page reached from another page names that page as `parent`; a tab is the
 * page's address with its `?tab=`; a setting names its section and the
 * `data-search-anchor` its block carries.
 */
const DECLARED: EntryDef[] = [
  // Actions.
  { id: "action:new-product", kind: "action", title: text("newProduct"), keywords: ["add product", "create product", "إضافة منتج"], to: "/catalog/new", icon: IconProductAdd },
  { id: "action:new-order", kind: "action", title: text("newOrder"), keywords: ["new order", "manual order", "add order", "طلب جديد", "أوردر يدوي"], to: "/orders/new", icon: IconOrders },
  { id: "action:new-discount", kind: "action", title: text("newDiscount"), keywords: ["coupon", "promo code", "كوبون", "كود خصم"], to: "/discounts", icon: IconTag },
  { id: "action:new-blog-post", kind: "action", title: text("newBlogPost"), keywords: ["write article", "مقالة"], to: "/blog/new", icon: IconBlog, when: BLOG_ENABLED },
  { id: "action:new-size-chart", kind: "action", title: text("newSizeChart"), keywords: ["sizes", "مقاسات"], to: "/size-charts/new", icon: IconRuler, when: SIZE_CHARTS_ENABLED },

  // Pages reached from another page.
  { id: pageId("/orders/board"), kind: "page", title: text("orderBoard"), keywords: ["kanban", "board", "لوحة"], to: "/orders/board", icon: IconLayers, parent: pageId("/orders") },
  { id: pageId("/catalog/collections"), kind: "page", title: text("collections"), keywords: ["categories", "collection", "أقسام", "تصنيفات"], to: "/catalog/collections", icon: IconBoxes, parent: pageId("/catalog") },
  { id: pageId("/catalog/specifications"), kind: "page", title: both(SPEC_STRINGS, "title"), keywords: ["specs", "attributes", "مواصفات"], to: "/catalog/specifications", icon: IconField, parent: pageId("/catalog"), when: PRODUCT_SPECS_ENABLED },
  { id: pageId("/form-submissions"), kind: "page", title: text("formSubmissions"), keywords: ["forms", "contact form", "leads", "نماذج", "رسائل"], to: "/form-submissions", icon: IconDocument, parent: pageId("/customers") },
  { id: pageId("/blog/categories"), kind: "page", title: both(BLOG_WORDS, "categories"), keywords: ["blog categories", "تصنيفات المدونة"], to: "/blog/categories", icon: IconBlog, parent: pageId("/blog"), when: BLOG_ENABLED },
  { id: pageId("/offers/bundles"), kind: "page", title: text("bundles"), keywords: ["bundle", "باقة"], to: "/offers/bundles", icon: IconGift, parent: pageId("/offers") },
  { id: pageId("/offers/order-bumps"), kind: "page", title: text("bumps"), keywords: ["order bump", "add-on", "إضافة"], to: "/offers/order-bumps", icon: IconGift, parent: pageId("/offers") },
  { id: pageId("/offers/upsells"), kind: "page", title: text("upsells"), keywords: ["upsell", "one click", "بعد الشراء"], to: "/offers/upsells", icon: IconTrendUp, parent: pageId("/offers") },
  { id: pageId("/offers/cross-sell"), kind: "page", title: text("crossSell"), keywords: ["related products", "frequently bought together", "منتجات مرتبطة"], to: "/offers/cross-sell", icon: IconShuffle, parent: pageId("/offers") },
  { id: pageId("/offers/exit-popup"), kind: "page", title: text("exitPopup"), keywords: ["exit intent", "popup", "بوب أب"], to: "/offers/exit-popup", icon: IconDoor, parent: pageId("/offers") },
  { id: pageId("/offers/social-proof"), kind: "page", title: text("socialProof"), keywords: ["social proof", "recent sales popup", "إثبات اجتماعي"], to: "/offers/social-proof", icon: IconSend, parent: pageId("/offers") },
  { id: pageId("/offers/order-rules"), kind: "page", title: text("orderRules"), keywords: ["minimum order", "free shipping", "شحن مجاني", "حد أدنى"], to: "/offers/order-rules", icon: IconCourier, parent: pageId("/offers") },
  { id: pageId("/offers/newsletter"), kind: "page", title: text("newsletter"), keywords: ["subscribe", "email list", "نشرة بريدية"], to: "/offers/newsletter", icon: IconEmail, parent: pageId("/offers") },
  { id: pageId("/offers/referrals"), kind: "page", title: text("referralLinks"), keywords: ["referral", "affiliate link", "إحالة"], to: "/offers/referrals", icon: IconLink, parent: pageId("/offers") },
  { id: pageId("/offers/feed"), kind: "page", title: text("productFeed"), keywords: ["facebook catalog", "google merchant", "xml", "feed", "كتالوج فيسبوك"], to: "/offers/feed", icon: IconRss, parent: pageId("/offers") },
  { id: pageId("/analytics/summary"), kind: "page", title: text("analyticsSummary"), keywords: ["summary", "ملخص"], to: "/analytics/summary", icon: IconChart, parent: pageId("/analytics") },
  { id: pageId("/profit/costs"), kind: "page", title: both(COSTS_STRINGS, "title"), keywords: ["product cost", "fees", "تكلفة المنتج", "مصاريف"], to: "/profit/costs", icon: IconReceipt, parent: pageId("/profit") },
  { id: pageId("/inbox/bot"), kind: "page", title: text("waBot"), keywords: ["auto reply", "chatbot", "رد تلقائي"], to: "/inbox/bot", icon: IconRobot, parent: pageId("/inbox"), when: AI_ENABLED },
  ...(REWARDS
    ? [
        { id: "rewards:points", kind: "page" as const, title: both(LOYALTY_STRINGS, "title"), keywords: ["points", "نقاط"], to: "/loyalty", icon: IconCrown, parent: pageId(REWARDS.to), when: LOYALTY_ENABLED },
        { id: "rewards:vip", kind: "page" as const, title: both(VIP_STRINGS, "title"), keywords: ["vip", "tiers", "levels", "مستويات"], to: "/loyalty/vip", icon: IconCrown, parent: pageId(REWARDS.to), when: VIP_TIERS_ENABLED },
        { id: "rewards:referrals", kind: "page" as const, title: both(REFERRAL_STRINGS, "title"), keywords: ["refer a friend", "invite friends", "ادعُ صديق"], to: "/loyalty/referrals", icon: IconUserAdd, parent: pageId(REWARDS.to), when: CUSTOMER_REFERRALS_ENABLED },
        { id: "rewards:credit", kind: "page" as const, title: both(STORE_CREDIT_STRINGS, "title"), keywords: ["store credit", "wallet", "رصيد", "محفظة"], to: "/store-credit", icon: IconWallet, parent: pageId(REWARDS.to), when: STORE_CREDIT_ENABLED },
      ]
    : []),

  // Tabs kept in the address.
  { id: "tab:/subscription?tab=plans", kind: "tab", title: both(SUBSCRIPTION_STRINGS, "plansTab"), keywords: ["upgrade", "change plan", "pricing", "ترقية", "تغيير الخطة", "الأسعار"], to: "/subscription?tab=plans", icon: IconCrown, parent: pageId("/subscription") },
  { id: "tab:/subscription?tab=usage", kind: "tab", title: both(SUBSCRIPTION_STRINGS, "usageTab"), keywords: ["limits", "quota", "الحدود", "الاستهلاك"], to: "/subscription?tab=usage", icon: IconHourglass, parent: pageId("/subscription") },
  { id: "tab:/subscription?tab=invoices", kind: "tab", title: both(SUBSCRIPTION_STRINGS, "invoicesTab"), keywords: ["invoice", "pay", "receipt", "فاتورة", "دفع", "إيصال"], to: "/subscription?tab=invoices", icon: IconInvoice, parent: pageId("/subscription") },
  { id: "tab:/customers?tab=segments", kind: "tab", title: text("segments"), keywords: ["contact segments", "audience", "شرائح جهات الاتصال", "جمهور"], to: "/customers?tab=segments", icon: IconContacts, parent: pageId("/customers") },
  { id: "tab:/customers?tab=suppressed", kind: "tab", title: both(SUPPRESSION_STRINGS, "tab"), keywords: ["unsubscribed", "bounced", "إلغاء الاشتراك"], to: "/customers?tab=suppressed", icon: IconBlock, parent: pageId("/customers"), when: EMAIL_SUPPRESSIONS_ENABLED },
  { id: "tab:/customers?tab=groups", kind: "tab", title: text("customerGroups"), keywords: ["rfm", "champions", "loyal customers", "أفضل العملاء"], to: "/customers?tab=groups", icon: IconPeople, parent: pageId("/customers"), when: STORE_REPORTS_ENABLED },
  { id: "tab:/fraud?tab=rules", kind: "tab", title: text("fraudRules"), keywords: ["fraud rules", "قواعد الاحتيال"], to: "/fraud?tab=rules", icon: IconShield, parent: pageId("/fraud") },
  { id: "tab:/fraud?tab=flagged", kind: "tab", title: text("fraudFlagged"), keywords: ["suspicious orders", "طلبات مشبوهة"], to: "/fraud?tab=flagged", icon: IconShield, parent: pageId("/fraud") },
  { id: "tab:/fraud?tab=blocklist", kind: "tab", title: text("fraudBlocked"), keywords: ["blocklist", "blacklist", "blocked phones", "بلاك ليست", "أرقام محظورة"], to: "/fraud?tab=blocklist", icon: IconBlock, parent: pageId("/fraud") },
  { id: "tab:/fraud?tab=stats", kind: "tab", title: text("fraudStats"), keywords: ["fraud statistics", "إحصائيات الاحتيال"], to: "/fraud?tab=stats", icon: IconChart, parent: pageId("/fraud") },
  { id: "tab:/analytics?tab=products", kind: "tab", title: text("reportProducts"), keywords: ["best sellers", "top products", "الأكثر مبيعًا"], to: "/analytics?tab=products", icon: IconReports, parent: pageId("/analytics") },
  { id: "tab:/analytics?tab=delivery", kind: "tab", title: text("reportDelivery"), keywords: ["delivery rate", "returned orders", "نسبة التسليم"], to: "/analytics?tab=delivery", icon: IconShipping, parent: pageId("/analytics") },
  { id: "tab:/analytics?tab=customers", kind: "tab", title: text("reportCustomers"), keywords: ["repeat customers", "العملاء المتكررين"], to: "/analytics?tab=customers", icon: IconPeople, parent: pageId("/analytics") },
  { id: "tab:/analytics/visitors?tab=visits", kind: "tab", title: both(VISITORS_STRINGS, "tabVisits"), keywords: ["sessions", "جلسات"], to: "/analytics/visitors?tab=visits", icon: IconUser, parent: pageId("/analytics/visitors"), plan: { feature: "visitor_insights" }, when: VISITORS_ENABLED },
  { id: "tab:/analytics/visitors?tab=campaigns", kind: "tab", title: both(VISITORS_STRINGS, "tabCampaigns"), keywords: ["utm", "ads campaigns", "حملات إعلانية"], to: "/analytics/visitors?tab=campaigns", icon: IconSparkle, parent: pageId("/analytics/visitors"), plan: { feature: "visitor_insights" }, when: VISITORS_ENABLED },
  { id: "tab:/analytics/visitors?tab=outcomes", kind: "tab", title: both(VISITORS_STRINGS, "tabOutcomes"), keywords: ["governorates", "cities", "محافظات"], to: "/analytics/visitors?tab=outcomes", icon: IconMap, parent: pageId("/analytics/visitors"), plan: { feature: "visitor_insights" }, when: VISITORS_ENABLED },
  { id: "tab:/abandoned-carts?tab=under_review", kind: "tab", title: text("lostUnderReview"), keywords: ["review", "مراجعة"], to: "/abandoned-carts?tab=under_review", icon: IconHourglass, parent: pageId("/abandoned-carts") },
  { id: "tab:/abandoned-carts?tab=completed", kind: "tab", title: text("lostReviewed"), keywords: ["done", "reviewed", "تمت المراجعة"], to: "/abandoned-carts?tab=completed", icon: IconCheck, parent: pageId("/abandoned-carts") },
  { id: "tab:/abandoned-carts?tab=recovered", kind: "tab", title: text("lostWonBack"), keywords: ["recovered", "مسترجعة"], to: "/abandoned-carts?tab=recovered", icon: IconVerified, parent: pageId("/abandoned-carts") },
  { id: "tab:/settlements?tab=held", kind: "tab", title: both(SETTLEMENT_STRINGS, "viewHeld"), keywords: ["unsettled", "held by couriers", "لم تُسوَّ"], to: "/settlements?tab=held", icon: IconCourier, parent: pageId("/settlements") },
  { id: "tab:/settlements?tab=settlements", kind: "tab", title: both(SETTLEMENT_STRINGS, "viewSettlements"), keywords: ["statements", "payouts", "كشوف"], to: "/settlements?tab=settlements", icon: IconReceipt, parent: pageId("/settlements") },

  // Single settings: Settings.
  setting("storeName", { keywords: ["name", "rename", "اسم", "تغيير الاسم"], icon: IconStore, scope: "settings", section: "identity", anchor: "store-name" }),
  setting("storeLogo", { keywords: ["logo", "لوجو", "شعار"], icon: IconImage, scope: "settings", section: "identity", anchor: "store-logo" }),
  setting("storeColours", { keywords: ["primary color", "secondary color", "brand colors", "اللون الأساسي", "اللون الثانوي"], icon: IconStyle, scope: "settings", section: "identity", anchor: "brand-colours" }),
  setting("timezone", { keywords: ["timezone", "clock", "التوقيت", "الساعة"], icon: IconClock, scope: "settings", section: "account-settings", anchor: "timezone" }),
  setting("contactEmail", { keywords: ["contact form", "إيميل التواصل"], icon: IconEmail, scope: "settings", section: "account-settings", anchor: "contact-email" }),
  setting("invoiceDetails", { keywords: ["legal name", "company", "invoice address", "الاسم القانوني", "الشركة", "فاتورة"], icon: IconInvoice, scope: "settings", section: "account-settings", anchor: "invoice-details" }),
  setting("whatsappToken", { keywords: ["token", "access token", "phone number id", "waba", "app secret", "meta", "توكن", "مفتاح واتساب"], icon: IconWhatsApp, scope: "settings", section: "whatsapp", anchor: "whatsapp-token" }),
  setting("whatsappWebhook", { keywords: ["webhook", "verify token", "callback url", "ويب هوك", "رمز التحقق"], icon: IconPlug, scope: "settings", section: "whatsapp", anchor: "whatsapp-webhook" }),
  setting("inviteMember", { keywords: ["invite", "add member", "staff", "employee", "إضافة عضو", "موظف"], icon: IconUserAdd, scope: "settings", section: "members", anchor: "invite-member", plan: { feature: "staff_accounts" } }),
  setting("username", { keywords: ["handle", "يوزرنيم"], icon: IconAccount, scope: "settings", section: "profile", anchor: "username" }),
  setting("accountEmail", { keywords: ["email", "change email", "إيميل", "تغيير البريد"], icon: IconEmail, scope: "settings", section: "profile", anchor: "account-email" }),
  setting("accountPhone", { keywords: ["phone", "mobile", "change phone", "موبايل", "رقم التليفون"], icon: IconPhone, scope: "settings", section: "profile", anchor: "account-phone" }),
  setting("language", { keywords: ["arabic", "english", "عربي", "إنجليزي"], icon: IconLanguage, scope: "settings", section: "appearance", anchor: "language" }),
  setting("darkMode", { keywords: ["dark", "light", "black", "theme", "night", "داكن", "فاتح", "ليلي", "المظهر"], icon: IconMoon, scope: "settings", section: "appearance", anchor: "dark-mode" }),
  setting("glass", { keywords: ["blur", "transparency", "زجاج", "شفافية"], icon: IconSparkle, scope: "settings", section: "appearance", anchor: "glass" }),
  setting("summaryReports", { keywords: ["daily report", "weekly report", "تقرير يومي", "تقرير أسبوعي"], icon: IconReports, scope: "settings", section: "notifications", anchor: "summary-reports", when: STORE_REPORTS_ENABLED }),
  setting("twoStep", { keywords: ["2fa", "two factor", "authenticator", "otp", "backup codes", "التحقق بخطوتين", "رموز احتياطية"], icon: IconLock, scope: "settings", section: "security", anchor: "two-step", when: TWO_FACTOR_ENABLED }),
  setting("password", { keywords: ["change password", "reset password", "باسورد", "تغيير كلمة المرور"], icon: IconKey, scope: "settings", section: "security", anchor: "password" }),
  setting("devices", { keywords: ["sessions", "devices", "logout", "sign out", "الأجهزة", "الجلسات"], icon: IconDevices, scope: "settings", section: "security", anchor: "devices" }),
  setting("apiKeys", { keywords: ["api key", "integration", "مفتاح", "ربط"], icon: IconKey, scope: "settings", section: "developers", anchor: "api-keys" }),
  setting("webhooks", { keywords: ["webhook", "endpoint", "events", "ويب هوك"], icon: IconCode, scope: "settings", section: "developers", anchor: "webhooks" }),

  // Single settings: Store settings.
  setting("favicon", { keywords: ["favicon", "tab icon", "أيقونة"], icon: IconImage, scope: "store-settings", section: "general", anchor: "store-identity" }),
  setting("storeCountry", { keywords: ["country", "الدولة", "البلد"], icon: IconGlobe, scope: "store-settings", section: "general", anchor: "store-identity" }),
  setting("socialLinks", { keywords: ["facebook", "instagram", "tiktok", "social", "فيسبوك", "انستجرام", "تيك توك", "سوشيال"], icon: IconLink, scope: "store-settings", section: "general", anchor: "social-links" }),
  setting("whatsappButton", { keywords: ["whatsapp", "chat button", "واتساب", "زر"], icon: IconWhatsApp, scope: "store-settings", section: "general", anchor: "whatsapp-button" }),
  setting("hideBranding", { keywords: ["powered by", "branding", "white label", "remove logo", "زيموس"], icon: IconStore, scope: "store-settings", section: "general", anchor: "remove-branding", plan: { feature: "remove_branding", benefit: true } }),
  setting("storeContact", { keywords: ["contact", "phone", "address", "هاتف", "عنوان"], icon: IconPhone, scope: "store-settings", section: "store-info", anchor: "store-contact" }),
  setting("trustCards", { keywords: ["trust", "guarantee", "ضمان", "ثقة"], icon: IconShield, scope: "store-settings", section: "store-info", anchor: "trust-cards" }),
  setting("seoMeta", { keywords: ["meta title", "meta description", "google", "seo", "جوجل"], icon: IconSearch, scope: "store-settings", section: "seo", anchor: "seo-meta" }),
  setting("connectDomain", { keywords: ["domain", "dns", "custom domain", "دومين", "نطاق"], icon: IconGlobe, scope: "store-settings", section: "domains", anchor: "connect-domain", plan: { feature: "custom_domain" }, when: CUSTOM_DOMAINS_ENABLED }),
  setting("checkoutFields", { keywords: ["custom field", "required field", "address field", "حقل", "إجباري"], icon: IconFilter, scope: "store-settings", section: "checkout-form", anchor: "checkout-fields" }),

  // Single settings: Shipping.
  setting("shippingPrices", { keywords: ["shipping fee", "delivery price", "مصاريف الشحن", "سعر التوصيل"], icon: IconShipping, scope: "shipping", section: "rates", anchor: "shipping-prices" }),
  setting("deliveryZones", { keywords: ["governorate", "zone", "area", "cairo", "محافظة", "القاهرة", "منطقة"], icon: IconMap, scope: "shipping", section: "rates", anchor: "delivery-zones" }),
  setting("couriers", { keywords: ["courier", "delivery man", "driver", "مندوب", "مناديب", "طيار"], icon: IconCourier, scope: "shipping", section: "rates", anchor: "own-couriers" }),
  setting("storeHours", { keywords: ["working hours", "opening hours", "delivery time", "ساعات العمل", "مواعيد"], icon: IconClock, scope: "shipping", section: "rates", anchor: "store-hours" }),
];

/**
 * Routes of App.tsx the search does not offer, and why. A new route is
 * either reachable from the index above or listed here (siteIndex.test.ts).
 * Routes with a parameter (`:id`) are records, found by the record search.
 */
export const ROUTES_NOT_IN_SEARCH: ReadonlyMap<string, string> = new Map([
  ["/login", "signed out"],
  ["/register", "signed out"],
  ["/auth/callback", "signed out"],
  ["/forgot-password", "signed out"],
  ["/reset-password", "signed out"],
  ["/verify-email", "signed out"],
  ["/choose-username", "before the dashboard"],
  ["/choose-plan", "before the dashboard"],
  ["/workspaces", "the store switcher"],
]);

const ALL_DEFS: EntryDef[] = [...MENU, ...SETTINGS, ...STORE_SETTINGS, ...SHIPPING, ...PAYMENTS, ...STORE_REPORTS, ...DECLARED];

const ACTIONS_HEADING = both(SEARCH_UI_STRINGS, "actions");

function build(defs: readonly EntryDef[]): SearchEntry[] {
  const live = defs.filter((def) => def.when !== false);
  // Ids are unique (siteIndex.test.ts); the map is only for walking up to the parents.
  const byId = new Map(live.map((def) => [def.id, def]));
  return live.map((def) => {
    const trail: Bilingual[] = [];
    let root = def;
    for (let up = def.parent ? byId.get(def.parent) : undefined; up; up = up.parent ? byId.get(up.parent) : undefined) {
      trail.unshift(up.title);
      root = up;
    }
    const heading = def.kind === "action" ? ACTIONS_HEADING : (MENU_HEADING.get(root.id) ?? root.title);
    const keywords = def.keywords ?? [];
    return {
      id: def.id,
      kind: def.kind,
      title: def.title,
      description: def.description,
      to: def.to,
      anchor: def.anchor,
      icon: def.icon,
      parent: def.parent,
      hiddenForRoles: def.hiddenForRoles,
      onlyForRoles: def.onlyForRoles,
      plan: def.plan,
      scope: def.scope,
      section: def.section,
      keywords,
      heading,
      trail,
      searchable: {
        titles: [def.title.en, def.title.ar],
        keywords,
        details: def.description ? [def.description.en, def.description.ar] : [],
        trail: trail.flatMap((place) => [place.en, place.ar]),
      },
    };
  });
}

/** Everything the search can open, for this build's switches. */
export const SEARCH_INDEX: readonly SearchEntry[] = build(ALL_DEFS);

const BY_ID = new Map(SEARCH_INDEX.map((entry) => [entry.id, entry]));

export function findEntry(id: string): SearchEntry | undefined {
  return BY_ID.get(id);
}

/** Whether a role sees an entry: neither it nor a place it sits in is hidden from the role. */
export function isEntryShown(entry: SearchEntry, role: string | null | undefined): boolean {
  const key = role ?? "";
  for (let at: SearchEntry | undefined = entry; at; at = at.parent ? BY_ID.get(at.parent) : undefined) {
    if (at.hiddenForRoles?.has(key)) return false;
    if (at.onlyForRoles && !at.onlyForRoles.has(key)) return false;
  }
  return true;
}

/** The sections and single settings of one settings list. */
export function entriesInScope(scope: SearchScope): SearchEntry[] {
  return SEARCH_INDEX.filter((entry) => entry.scope === scope);
}

const KIND_ORDER: Record<SearchKind, number> = { page: 0, section: 1, tab: 2, setting: 3, action: 4 };

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

/** The entries `query` finds, closest first (on a tie: pages before sections, tabs, settings, actions). */
export function searchEntries(query: string, entries: readonly SearchEntry[]): SearchHit[] {
  const hits: Array<SearchHit & { at: number }> = [];
  entries.forEach((entry, at) => {
    const score = matchScore(query, entry.searchable);
    if (score > 0) hits.push({ entry, score, at });
  });
  hits.sort((a, b) => b.score - a.score || KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] || a.at - b.at);
  return hits.map(({ entry, score }) => ({ entry, score }));
}

/**
 * The entry an address is: the one with the same path whose query the
 * address carries (the most specific), else the menu page it belongs to.
 * Single settings are never an address of their own.
 */
export function entryForLocation(pathname: string, search: string): SearchEntry | undefined {
  const params = new URLSearchParams(search);
  let best: SearchEntry | undefined;
  let bestParams = -1;
  for (const entry of SEARCH_INDEX) {
    if (entry.kind === "setting" || entry.kind === "action") continue;
    const [path, query = ""] = entry.to.split("?");
    if (path !== pathname) continue;
    const wanted = [...new URLSearchParams(query)];
    if (!wanted.every(([key, value]) => params.get(key) === value)) continue;
    if (wanted.length > bestParams) {
      best = entry;
      bestParams = wanted.length;
    }
  }
  if (best) return best;
  // Deeper than any entry (an order, a product): the menu page it is under.
  const item = findNavItem(pathname);
  return item ? BY_ID.get(pageId(item.to)) : undefined;
}
