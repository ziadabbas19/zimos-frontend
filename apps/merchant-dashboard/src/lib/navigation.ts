import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  Package,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  Undo2,
  Users,
  Workflow,
} from "lucide-react";
import type { Messages } from "@/i18n/LocaleContext";

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
  | "website"
  | "funnels"
  | "settings";

/** Group headings. Separate from NavKey so a group and an item may share a name. */
export type NavGroupKey = "sell" | "catalog" | "grow" | "storefront";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
  icon: LucideIcon;
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
    id: "storefront",
    labelKey: "storefront",
    items: [{ key: "website", to: "/website", icon: Globe }],
  },
  {
    id: "config",
    labelKey: null,
    items: [{ key: "settings", to: "/settings", icon: Settings }],
  },
];

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
    website: "Website",
    funnels: "Funnels",
    settings: "Settings",
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
    website: "الموقع",
    funnels: "مسارات البيع",
    settings: "الإعدادات",
  },
} satisfies Messages<NavKey>;

/** Group headings. Read with `useT(NAV_GROUP_LABELS)`. */
export const NAV_GROUP_LABELS = {
  en: {
    sell: "Sell",
    catalog: "Catalog",
    grow: "Grow",
    storefront: "Storefront",
  },
  ar: {
    sell: "البيع",
    catalog: "الكتالوج",
    grow: "النمو",
    storefront: "واجهة المتجر",
  },
} satisfies Messages<NavGroupKey>;
