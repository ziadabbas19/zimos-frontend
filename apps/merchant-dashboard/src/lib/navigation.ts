import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Download,
  Footprints,
  GraduationCap,
  MousePointerClick,
  Handshake,
  Sparkles,
  Activity,
  CircleDollarSign,
  BarChart3,
  Bot,
  PhoneCall,
  CreditCard,
  Gift,
  Globe,
  History,
  Images,
  House,
  LineChart,
  LifeBuoy,
  Lightbulb,
  Medal,
  Megaphone,
  MessageCircleMore,
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
  Route,
} from "lucide-react";
import type { Permission } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";
import { hasAnyPermission } from "@/lib/permissions";
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
  VISITORS_ENABLED,
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
  | "visitors"
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
export type NavBadge = "toConfirm" | "toShip" | "unread" | "reviews";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: LucideIcon;
  /**
   * The permissions the page's own API asks for (its route's requirePermission,
   * or one of a requireAnyPermission list, in the backend): the entry shows
   * only to a role holding one of them (lib/permissions, on the permissions
   * the store list sent). Entries without it are shown to everyone.
   */
  requires?: readonly Permission[];
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
    items: [{ key: "overview", to: "/", icon: House }],
  },
  {
    id: "orders",
    labelKey: "orders",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag, badge: "toShip", requires: ["orders.view"] },
      { key: "confirmationQueue", to: "/confirmation-queue", icon: PhoneCall, badge: "toConfirm", requires: ["orders.confirm", "orders.manage"] },
      { key: "abandonedCarts", to: "/abandoned-carts", icon: ShoppingCart, requires: ["orders.view"] },
      { key: "returns", to: "/returns", icon: Undo2, requires: ["orders.view"] },
      { key: "fraud", to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    id: "products",
    labelKey: "products",
    items: [
      { key: "catalog", to: "/catalog", icon: Package, requires: ["products.view"] },
      { key: "reviews", to: "/reviews", icon: Star, badge: "reviews", requires: ["products.manage"] },
      // Shoppers' questions and size charts, each only while its feature is switched on (lib/features).
      ...(PRODUCT_QUESTIONS_ENABLED ? [{ key: "productQuestions" as const, to: "/questions", icon: CircleQuestionMark, requires: ["products.view"] as Permission[] }] : []),
      ...(SIZE_CHARTS_ENABLED ? [{ key: "sizeCharts" as const, to: "/size-charts", icon: Ruler, requires: ["products.view"] as Permission[] }] : []),
      { key: "digital", to: "/digital", icon: Download, requires: ["products.view"] },
      { key: "courses", to: "/courses", icon: GraduationCap, requires: ["products.view"] },
      { key: "media", to: "/media", icon: Images, requires: ["products.manage"] },
    ],
  },
  {
    id: "customers",
    labelKey: "customers",
    items: [
      { key: "customers", to: "/customers", icon: Users, requires: ["customers.view"] },
      // Points, levels, invites and store credit: one entry, only while one of them is switched on (lib/features).
      ...(REWARDS_HOME ? [{ key: "loyalty" as const, to: REWARDS_HOME, icon: Medal, requires: ["customers.view"] as Permission[] }] : []),
      { key: "inbox", to: "/inbox", icon: MessageCircleMore, badge: "unread", requires: ["orders.confirm"] },
    ],
  },
  {
    id: "marketing",
    labelKey: "marketing",
    items: [
      { key: "marketing", to: "/marketing", icon: Megaphone, requires: ["workspace.manage"] },
      { key: "offers", to: "/offers", icon: Gift, requires: ["products.view"] },
      { key: "discounts", to: "/discounts", icon: Tag, requires: ["discounts.manage"] },
      // Gift cards only while the feature is switched on (lib/features).
      ...(GIFT_CARDS_ENABLED ? [{ key: "giftCards" as const, to: "/gift-cards", icon: Ticket, requires: ["discounts.manage"] as Permission[] }] : []),
      { key: "automations", to: "/automations", icon: Bot, requires: ["automations.manage"] },
      // AI studio only while the AI features are switched on (lib/features).
      ...(AI_ENABLED ? [{ key: "ai" as const, to: "/ai", icon: Sparkles, requires: ["products.manage", "website.edit", "funnels.manage", "orders.confirm"] as Permission[] }] : []),
    ],
  },
  {
    id: "store",
    labelKey: "store",
    items: [
      { key: "website", to: "/website", icon: Globe, requires: ["website.edit"] },
      // The store blog only while the feature is switched on (lib/features).
      ...(BLOG_ENABLED ? [{ key: "blog" as const, to: "/blog", icon: Newspaper, requires: ["website.edit"] as Permission[] }] : []),
      { key: "funnels", to: "/funnels", icon: Route, requires: ["funnels.manage"] },
      { key: "shoppableImages", to: "/shoppable-images", icon: MousePointerClick, requires: ["products.view"] },
      { key: "storeSettings", to: "/store-settings", icon: Store, requires: ["website.edit"] },
    ],
  },
  {
    id: "analytics",
    labelKey: "analytics",
    items: [
      { key: "analytics", to: "/analytics", icon: BarChart3, requires: ["analytics.view"] },
      { key: "realtime", to: "/analytics/realtime", icon: Activity, requires: ["analytics.view"] },
      { key: "webAnalytics", to: "/analytics/web", icon: LineChart, requires: ["analytics.view"] },
      // The store's visitors, only while the feature is switched on (lib/features).
      ...(VISITORS_ENABLED
        ? [{ key: "visitors" as const, to: "/analytics/visitors", icon: Footprints, requires: ["analytics.view"] as Permission[] }]
        : []),
      { key: "attribution", to: "/analytics/attribution", icon: Target, requires: ["analytics.view"] },
      { key: "profit", to: "/profit", icon: PiggyBank, requires: ["financial_reports.view"] },
      { key: "ads", to: "/ads", icon: CircleDollarSign, requires: ["financial_reports.view"] },
    ],
  },
  {
    id: "money",
    labelKey: "money",
    items: [
      { key: "payments", to: "/payments", icon: Wallet, requires: ["workspace.manage"] },
      { key: "settlements", to: "/settlements", icon: Banknote, requires: ["financial_reports.view"] },
      { key: "shipping", to: "/shipping", icon: Truck, requires: ["shipping.manage", "tax.manage"] },
    ],
  },
  {
    id: "config",
    labelKey: null,
    items: [
      { key: "subscription", to: "/subscription", icon: CreditCard, requires: ["billing.manage"] },
      { key: "settings", to: "/settings", icon: Settings },
      { key: "activity", to: "/activity", icon: History, requires: ["audit_log.view"] },
      { key: "services", to: "/services", icon: Handshake },
      { key: "support", to: "/support", icon: LifeBuoy, requires: ["workspace.manage"] },
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

/**
 * Whether a member sees an entry: their role's permissions (Workspace.permissions)
 * hold one the page's API asks for (NavItem.requires). Unknown permissions
 * show it (lib/permissions).
 */
export function isNavItemVisible(item: NavItem, permissions: readonly string[] | null | undefined): boolean {
  return hasAnyPermission(permissions, item.requires);
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
    visitors: "Visitors",
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
    visitors: "الزوار",
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
