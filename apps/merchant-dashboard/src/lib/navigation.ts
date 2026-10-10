import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  FileDown,
  GraduationCap,
  MousePointerClick,
  Handshake,
  Sparkles,
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bot,
  ClipboardCheck,
  CreditCard,
  Gift,
  Globe,
  History,
  Images,
  LayoutDashboard,
  LineChart,
  LifeBuoy,
  Lightbulb,
  Medal,
  Megaphone,
  MessageCircle,
  Newspaper,
  CircleQuestionMark,
  Package,
  PiggyBank,
  Ruler,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Target,
  Ticket,
  Truck,
  Undo2,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import type { Messages } from "@/i18n/LocaleContext";
import { NO_ANALYTICS_ROLES } from "@/lib/analyticsAccess";
import {
  AI_ENABLED,
  BLOG_ENABLED,
  CUSTOMER_REFERRALS_ENABLED,
  GIFT_CARDS_ENABLED,
  LOYALTY_ENABLED,
  PRODUCT_QUESTIONS_ENABLED,
  SIZE_CHARTS_ENABLED,
  STORE_CREDIT_ENABLED,
  VIP_TIERS_ENABLED,
} from "@/lib/features";

/** Where "Loyalty & rewards" opens: the first of its four programmes that is switched on; null while none is. */
const REWARDS_HOME = LOYALTY_ENABLED
  ? "/loyalty"
  : VIP_TIERS_ENABLED
    ? "/loyalty/vip"
    : CUSTOMER_REFERRALS_ENABLED
      ? "/loyalty/referrals"
      : STORE_CREDIT_ENABLED
        ? "/store-credit"
        : null;

/**
 * System roles without billing.manage (owner '*' and accountant hold it, see
 * the backend's core/security/permissions.js): they don't see Subscription.
 */
const NO_BILLING_ROLES: ReadonlySet<string> = new Set(["workspace_manager", "editor", "order_operator", "confirmation_agent"]);

export type NavKey =
  | "overview"
  | "orders"
  | "confirmationQueue"
  | "fraud"
  | "returns"
  | "abandonedCarts"
  | "catalog"
  | "reviews"
  | "productQuestions"
  | "sizeCharts"
  | "customers"
  | "discounts"
  | "giftCards"
  | "blog"
  | "loyalty"
  | "offers"
  | "shipping"
  | "payments"
  | "website"
  | "funnels"
  | "analytics"
  | "webAnalytics"
  | "attribution"
  | "realtime"
  | "subscription"
  | "settings"
  | "support"
  | "suggestions"
  | "settlements"
  | "inbox"
  | "automations"
  | "marketing"
  | "profit"
  | "ads"
  | "media"
  | "digital"
  | "ai"
  | "affiliates"
  | "subscriptions"
  | "services"
  | "referrals"
  | "shoppableImages"
  | "courses"
  | "storeSettings"
  | "activity";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "orders" | "products" | "customers" | "marketing" | "store" | "analytics" | "money";

/**
 * A count of waiting work shown on a row (lib/workCounts.ts): calls due now,
 * confirmed orders with no courier booked yet, unread messages.
 */
export type NavBadge = "toConfirm" | "toShip" | "unread";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: LucideIcon;
  /**
   * Role keys that don't see this entry: the system roles the backend refuses
   * for the page's API (the page still handles a 403 for any other role).
   * Entries without it are shown to everyone, as before.
   */
  hiddenForRoles?: ReadonlySet<string>;
  /**
   * The entry this one sits under: it is left out of the side menu and its
   * pages light the parent's row. No entry uses it today.
   */
  under?: string;
  /** A count of waiting work shown on the row (see NavBadge). */
  badge?: NavBadge;
}

export interface NavGroup {
  /** Stable id, used to persist the collapsed state. */
  id: string;
  /** Key into NAV_GROUP_LABELS, or null for an unheaded group. */
  labelKey: NavGroupKey | null;
  items: NavItem[];
}

/**
 * Sidebar structure, in the order a merchant thinks about the business: the
 * orders that came in and what each one needs, what is being sold, who bought
 * it, how more people are brought in, the store they land on, the numbers, and
 * the money (getting paid, shipping). Admin and help sit at the bottom.
 *
 * Every entry here must map to a route in App.tsx — the sidebar is not a
 * roadmap. Features the backend does not serve yet stay out until they do.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    labelKey: null,
    items: [{ key: "overview", to: "/", icon: LayoutDashboard }],
  },
  {
    id: "orders",
    labelKey: "orders",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag, badge: "toShip" },
      { key: "confirmationQueue", to: "/confirmation-queue", icon: ClipboardCheck, badge: "toConfirm" },
      { key: "abandonedCarts", to: "/abandoned-carts", icon: ShoppingCart },
      { key: "returns", to: "/returns", icon: Undo2 },
      { key: "fraud", to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    id: "products",
    labelKey: "products",
    items: [
      { key: "catalog", to: "/catalog", icon: Package },
      { key: "reviews", to: "/reviews", icon: Star },
      // Shoppers' questions and size charts, each only while its feature is switched on (lib/features).
      ...(PRODUCT_QUESTIONS_ENABLED ? [{ key: "productQuestions" as const, to: "/questions", icon: CircleQuestionMark }] : []),
      ...(SIZE_CHARTS_ENABLED ? [{ key: "sizeCharts" as const, to: "/size-charts", icon: Ruler }] : []),
      { key: "digital", to: "/digital", icon: FileDown },
      { key: "courses", to: "/courses", icon: GraduationCap },
      { key: "media", to: "/media", icon: Images },
    ],
  },
  {
    id: "customers",
    labelKey: "customers",
    items: [
      { key: "customers", to: "/customers", icon: Users },
      // Points, levels, invites and store credit: one entry, only while one of them is switched on (lib/features).
      ...(REWARDS_HOME ? [{ key: "loyalty" as const, to: REWARDS_HOME, icon: Medal }] : []),
      { key: "inbox", to: "/inbox", icon: MessageCircle, badge: "unread" },
    ],
  },
  {
    id: "marketing",
    labelKey: "marketing",
    items: [
      { key: "marketing", to: "/marketing", icon: Megaphone },
      { key: "offers", to: "/offers", icon: Gift },
      { key: "discounts", to: "/discounts", icon: Tag },
      // Gift cards only while the feature is switched on (lib/features).
      ...(GIFT_CARDS_ENABLED ? [{ key: "giftCards" as const, to: "/gift-cards", icon: Ticket }] : []),
      { key: "automations", to: "/automations", icon: Bot },
      // AI studio only while the AI features are switched on (lib/features).
      ...(AI_ENABLED ? [{ key: "ai" as const, to: "/ai", icon: Sparkles }] : []),
    ],
  },
  {
    id: "store",
    labelKey: "store",
    items: [
      { key: "website", to: "/website", icon: Globe },
      // The store blog only while the feature is switched on (lib/features).
      ...(BLOG_ENABLED ? [{ key: "blog" as const, to: "/blog", icon: Newspaper }] : []),
      { key: "funnels", to: "/funnels", icon: Workflow },
      { key: "shoppableImages", to: "/shoppable-images", icon: MousePointerClick },
      { key: "storeSettings", to: "/store-settings", icon: Store },
    ],
  },
  {
    id: "analytics",
    labelKey: "analytics",
    items: [
      { key: "analytics", to: "/analytics", icon: BarChart3, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "realtime", to: "/analytics/realtime", icon: Activity, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "webAnalytics", to: "/analytics/web", icon: LineChart, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "attribution", to: "/analytics/attribution", icon: Target, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "profit", to: "/profit", icon: PiggyBank, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "ads", to: "/ads", icon: BadgeDollarSign, hiddenForRoles: NO_ANALYTICS_ROLES },
    ],
  },
  {
    id: "money",
    labelKey: "money",
    items: [
      { key: "payments", to: "/payments", icon: Wallet },
      { key: "settlements", to: "/settlements", icon: Banknote },
      { key: "shipping", to: "/shipping", icon: Truck },
    ],
  },
  {
    id: "config",
    labelKey: null,
    items: [
      { key: "subscription", to: "/subscription", icon: CreditCard, hiddenForRoles: NO_BILLING_ROLES },
      { key: "settings", to: "/settings", icon: Settings },
      { key: "activity", to: "/activity", icon: History },
      { key: "services", to: "/services", icon: Handshake },
      { key: "support", to: "/support", icon: LifeBuoy },
      { key: "suggestions", to: "/suggestions", icon: Lightbulb },
    ],
  },
];

/** Groups that start open. The rest start closed and still show the page you are on. */
export const NAV_OPEN_BY_DEFAULT: ReadonlySet<string> = new Set(["main", "orders", "products"]);

/** Whether an entry has a row of its own in the side menu (an entry `under` another does not). */
export function isSidebarItem(item: NavItem): boolean {
  return !item.under;
}

/** The row that lights up for an entry: its own, or the one it sits under. */
export function sidebarHome(item: NavItem | undefined): string | undefined {
  return item ? (item.under ?? item.to) : undefined;
}

/** The group an item sits in — the first crumb of the page's breadcrumb. */
export function findNavGroup(item: NavItem): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.items.includes(item));
}

/** Whether a role sees an entry (see NavItem.hiddenForRoles). */
export function isNavItemVisible(item: NavItem, role: string | null | undefined): boolean {
  return !item.hiddenForRoles?.has(role ?? "");
}

/** Flat list, for anything that iterates items without caring about grouping. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The nav item a pathname belongs to (longest matching prefix), if any. */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    const match =
      item.to === "/"
        ? pathname === "/"
        : pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (match && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}

/** Sidebar / drawer labels. Read with `useT(NAV_LABELS)`. */
export const NAV_LABELS = {
  en: {
    overview: "Home",
    orders: "Orders",
    confirmationQueue: "Confirmation queue",
    fraud: "Fraud protection",
    returns: "Returns",
    abandonedCarts: "Lost orders",
    catalog: "Products",
    reviews: "Reviews",
    productQuestions: "Questions",
    sizeCharts: "Size charts",
    customers: "Customers",
    discounts: "Discounts",
    giftCards: "Gift cards",
    blog: "Blog",
    loyalty: "Loyalty & rewards",
    offers: "Offers",
    shipping: "Shipping & Tax",
    payments: "Payments",
    website: "Website",
    funnels: "Funnels",
    analytics: "Analytics",
    webAnalytics: "Web analytics",
    realtime: "Realtime",
    subscription: "My Plan",
    attribution: "Sales sources",
    activity: "Activity log",
    settings: "Settings",
    support: "Contact support",
    suggestions: "Suggest a feature",
    settlements: "COD settlements",
    inbox: "WhatsApp inbox",
    automations: "Automations",
    marketing: "Marketing",
    profit: "Profit",
    ads: "Ad spend",
    media: "Media library",
    digital: "Digital products",
    ai: "AI studio",
    affiliates: "Affiliates",
    subscriptions: "Subscriptions",
    services: "Services",
    referrals: "Refer & earn",
    shoppableImages: "Shoppable images",
    courses: "Courses",
    storeSettings: "Store settings",
  },
  ar: {
    overview: "الرئيسية",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    fraud: "الحماية من الاحتيال",
    returns: "المرتجعات",
    abandonedCarts: "الطلبات المفقودة",
    catalog: "المنتجات",
    reviews: "التقييمات",
    productQuestions: "الأسئلة",
    sizeCharts: "جداول المقاسات",
    customers: "العملاء",
    discounts: "الخصومات",
    giftCards: "بطاقات الهدايا",
    blog: "المدونة",
    loyalty: "الولاء والمكافآت",
    offers: "العروض",
    shipping: "الشحن والضرائب",
    payments: "المدفوعات",
    website: "الموقع",
    funnels: "مسارات البيع",
    analytics: "النظرة العامة والتقارير",
    webAnalytics: "زيارات الموقع",
    attribution: "مصادر المبيعات",
    realtime: "مباشر الآن",
    subscription: "خطتي",
    activity: "سجل النشاط",
    settings: "الإعدادات",
    support: "تواصل مع الدعم",
    suggestions: "اقترح ميزة",
    settlements: "تحصيل الشحن",
    inbox: "صندوق واتساب",
    automations: "الأتمتة",
    marketing: "التسويق",
    profit: "الأرباح",
    ads: "مصاريف الإعلانات",
    media: "مكتبة الصور",
    digital: "المنتجات الرقمية",
    ai: "استوديو الذكاء الاصطناعي",
    affiliates: "المسوّقون بالعمولة",
    subscriptions: "الاشتراكات",
    services: "الخدمات",
    referrals: "اكسب من الإحالة",
    shoppableImages: "الصور التفاعلية",
    courses: "الكورسات",
    storeSettings: "إعدادات المتجر",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: {
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    marketing: "Marketing",
    store: "Online store",
    analytics: "Analytics",
    money: "Money & shipping",
  },
  ar: {
    orders: "الطلبات",
    products: "المنتجات",
    customers: "العملاء",
    marketing: "التسويق",
    store: "المتجر",
    analytics: "التحليلات",
    money: "الفلوس والشحن",
  },
} satisfies Messages<NavGroupKey>;
