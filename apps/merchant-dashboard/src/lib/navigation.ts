import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  CreditCard,
  Gem,
  Globe,
  LayoutDashboard,
  LineChart,
  LifeBuoy,
  Package,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Target,
  Truck,
  Undo2,
  Users,
  Workflow,
} from "lucide-react";
import type { Messages } from "@/i18n/LocaleContext";
import { NO_ANALYTICS_ROLES } from "@/lib/analyticsAccess";

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
  | "customers"
  | "discounts"
  | "shipping"
  | "payments"
  | "website"
  | "funnels"
  | "analytics"
  | "webAnalytics"
  | "realtime"
  | "utmReport"
  | "subscription"
  | "settings"
  | "support";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "sell" | "catalog" | "grow" | "reports" | "storefront";

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
}

export interface NavGroup {
  /** Stable id, used to persist the collapsed state. */
  id: string;
  /** Key into NAV_GROUP_LABELS, or null for an unheaded group. */
  labelKey: NavGroupKey | null;
  items: NavItem[];
}

/**
 * Sidebar structure. Order mirrors a merchant's day: what came in, what to
 * confirm, what slipped away or looks suspicious, then getting it delivered
 * (and back); then the catalog behind it, growth tooling, and the storefront
 * and its settings.
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
    id: "sell",
    labelKey: "sell",
    items: [
      { key: "orders", to: "/orders", icon: ShoppingBag },
      { key: "confirmationQueue", to: "/confirmation-queue", icon: ClipboardCheck },
      { key: "abandonedCarts", to: "/abandoned-carts", icon: ShoppingCart },
      { key: "fraud", to: "/fraud", icon: ShieldAlert },
      { key: "shipping", to: "/shipping", icon: Truck },
      { key: "payments", to: "/payments", icon: CreditCard },
      { key: "returns", to: "/returns", icon: Undo2 },
    ],
  },
  {
    id: "catalog",
    labelKey: "catalog",
    items: [
      { key: "catalog", to: "/catalog", icon: Package },
      { key: "reviews", to: "/reviews", icon: Star },
      { key: "customers", to: "/customers", icon: Users },
    ],
  },
  {
    id: "grow",
    labelKey: "grow",
    items: [
      { key: "funnels", to: "/funnels", icon: Workflow },
      { key: "discounts", to: "/discounts", icon: Tag },
    ],
  },
  {
    id: "reports",
    labelKey: "reports",
    items: [
      { key: "analytics", to: "/analytics", icon: BarChart3, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "webAnalytics", to: "/analytics/web", icon: LineChart, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "realtime", to: "/analytics/realtime", icon: Activity, hiddenForRoles: NO_ANALYTICS_ROLES },
      { key: "utmReport", to: "/analytics/utm", icon: Target, hiddenForRoles: NO_ANALYTICS_ROLES },
    ],
  },
  {
    id: "storefront",
    labelKey: "storefront",
    items: [{ key: "website", to: "/website", icon: Globe }],
  },
  {
    id: "config",
    labelKey: null,
    items: [
      { key: "subscription", to: "/subscription", icon: Gem, hiddenForRoles: NO_BILLING_ROLES },
      { key: "settings", to: "/settings", icon: Settings },
      { key: "support", to: "/support", icon: LifeBuoy },
    ],
  },
];

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
    overview: "Overview",
    orders: "Orders",
    confirmationQueue: "Confirmation queue",
    fraud: "Fraud protection",
    returns: "Returns",
    abandonedCarts: "Abandoned carts",
    catalog: "Catalog",
    reviews: "Reviews",
    customers: "Customers",
    discounts: "Discounts",
    shipping: "Shipping & Tax",
    payments: "Payments",
    website: "Website",
    funnels: "Funnels",
    analytics: "Analytics",
    webAnalytics: "Web analytics",
    realtime: "Realtime",
    utmReport: "Sales by source",
    subscription: "Subscription",
    settings: "Settings",
    support: "Contact support",
  },
  ar: {
    overview: "نظرة عامة",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    fraud: "الحماية من الاحتيال",
    returns: "المرتجعات",
    abandonedCarts: "السلات المتروكة",
    catalog: "الكتالوج",
    reviews: "التقييمات",
    customers: "العملاء",
    discounts: "الخصومات",
    shipping: "الشحن والضرائب",
    payments: "المدفوعات",
    website: "الموقع",
    funnels: "مسارات البيع",
    analytics: "التحليلات",
    webAnalytics: "زيارات الموقع",
    realtime: "مباشر الآن",
    utmReport: "المبيعات حسب المصدر",
    subscription: "الاشتراك",
    settings: "الإعدادات",
    support: "تواصل مع الدعم",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: {
    sell: "Sell",
    catalog: "Catalog",
    grow: "Grow",
    reports: "Reports",
    storefront: "Storefront",
  },
  ar: {
    sell: "البيع",
    catalog: "الكتالوج",
    grow: "النمو",
    reports: "التقارير",
    storefront: "واجهة المتجر",
  },
} satisfies Messages<NavGroupKey>;
