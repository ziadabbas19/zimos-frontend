import { PackagePlus, Plus, type LucideIcon } from "lucide-react";
import type { Permission, PlanFeatureKey } from "@store-builder/api-client";
import type { Locale, Messages } from "@/i18n/LocaleContext";
import { hasAnyPermission } from "@/lib/permissions";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_ITEMS, NAV_LABELS, findNavItem, type NavGroupKey, type NavKey } from "@/lib/navigation";
import type { Searchable } from "@/lib/search/match";

/**
 * What a member can put on the Home page's shortcuts row.
 *
 * The id is what the server stores (memberships.home_shortcuts), so it never
 * changes; the server's own list (backend dashboard/homeShortcuts.js) names the
 * same ids and refuses any other, and shortcutCatalog.test.ts keeps the two in
 * step. A page takes its path, icon, permissions and switch from its side menu
 * entry (lib/navigation), so a page the menu does not have today (its feature
 * switched off) is not offered here either, and an entry opens to exactly the
 * roles the menu's row opens to.
 */

export type ShortcutId =
  | "new_order"
  | "orders"
  | "confirmation_queue"
  | "lost_orders"
  | "returns"
  | "fraud"
  | "add_product"
  | "products"
  | "reviews"
  | "questions"
  | "size_charts"
  | "digital_products"
  | "courses"
  | "media"
  | "customers"
  | "loyalty"
  | "inbox"
  | "marketing"
  | "offers"
  | "discounts"
  | "gift_cards"
  | "automations"
  | "ai_studio"
  | "website"
  | "blog"
  | "funnels"
  | "shoppable_images"
  | "store_settings"
  | "analytics"
  | "realtime"
  | "web_analytics"
  | "visitors"
  | "attribution"
  | "profit"
  | "ad_spend"
  | "payments"
  | "settlements"
  | "shipping"
  | "subscription"
  | "settings"
  | "activity"
  | "services"
  | "support"
  | "suggestions"
  // The phone bar's Home slot (lib/mobileNav); never offered on the Home row.
  | "home";

/** A count of waiting work on the shortcut: `awaiting` is the one Home reads itself, the others the side menu's. */
export type ShortcutBadge = "awaiting" | "reviews" | "unread";

/** The side menu's groups, and "more" for what sits under no heading there. */
export type ShortcutCategory = NavGroupKey | "more";

export interface ShortcutEntry {
  id: ShortcutId;
  to: string;
  icon: LucideIcon;
  title: Record<Locale, string>;
  category: ShortcutCategory;
  /** The role must hold one of these (lib/permissions). None: any member. */
  requires?: readonly Permission[];
  /** Out while the store's plan lacks it and the server refuses it. */
  plan?: PlanFeatureKey;
  badge?: ShortcutBadge;
  /** Drawn as the row's main action. */
  primary?: boolean;
  /** What the editor's search looks through. */
  search: Searchable;
}

/** The row's own words where they differ from the side menu's. */
const OWN_TITLES = {
  en: {
    new_order: "New order",
    add_product: "Add product",
    confirmation_queue: "Confirm orders",
    orders: "All orders",
    website: "Edit website",
  },
  ar: {
    new_order: "طلب جديد",
    add_product: "إضافة منتج",
    confirmation_queue: "تأكيد الطلبات",
    orders: "كل الطلبات",
    website: "تعديل الموقع",
  },
} satisfies Messages<"new_order" | "add_product" | "confirmation_queue" | "orders" | "website">;

export const SHORTCUT_CATEGORY_LABELS = {
  en: { ...NAV_GROUP_LABELS.en, more: "More" },
  ar: { ...NAV_GROUP_LABELS.ar, more: "المزيد" },
} satisfies Messages<ShortcutCategory>;

interface PageDef {
  id: ShortcutId;
  nav: NavKey;
  plan?: PlanFeatureKey;
  badge?: ShortcutBadge;
}

/** Each entry beside its side menu row, in the menu's order. `plan`: the server refuses the page's data without it (backend analyticsRoutes `advanced`). */
const PAGES: PageDef[] = [
  { id: "orders", nav: "orders" },
  { id: "confirmation_queue", nav: "confirmationQueue", badge: "awaiting" },
  { id: "lost_orders", nav: "abandonedCarts" },
  { id: "returns", nav: "returns" },
  { id: "fraud", nav: "fraud" },
  { id: "products", nav: "catalog" },
  { id: "reviews", nav: "reviews", badge: "reviews" },
  { id: "questions", nav: "productQuestions" },
  { id: "size_charts", nav: "sizeCharts" },
  { id: "digital_products", nav: "digital" },
  { id: "courses", nav: "courses" },
  { id: "media", nav: "media" },
  { id: "customers", nav: "customers" },
  { id: "loyalty", nav: "loyalty" },
  { id: "inbox", nav: "inbox", badge: "unread" },
  { id: "marketing", nav: "marketing" },
  { id: "offers", nav: "offers" },
  { id: "discounts", nav: "discounts" },
  { id: "gift_cards", nav: "giftCards" },
  { id: "automations", nav: "automations" },
  { id: "ai_studio", nav: "ai" },
  { id: "website", nav: "website" },
  { id: "blog", nav: "blog" },
  { id: "funnels", nav: "funnels" },
  { id: "shoppable_images", nav: "shoppableImages" },
  { id: "store_settings", nav: "storeSettings" },
  { id: "analytics", nav: "analytics" },
  { id: "realtime", nav: "realtime", plan: "advanced_analytics" },
  { id: "web_analytics", nav: "webAnalytics", plan: "advanced_analytics" },
  { id: "visitors", nav: "visitors", plan: "advanced_analytics" },
  { id: "attribution", nav: "attribution" },
  { id: "profit", nav: "profit" },
  { id: "ad_spend", nav: "ads" },
  { id: "payments", nav: "payments" },
  { id: "settlements", nav: "settlements" },
  { id: "shipping", nav: "shipping" },
  { id: "subscription", nav: "subscription" },
  { id: "settings", nav: "settings" },
  { id: "activity", nav: "activity" },
  { id: "services", nav: "services" },
  { id: "support", nav: "support" },
  { id: "suggestions", nav: "suggestions" },
];

function ownTitle(id: ShortcutId, locale: Locale): string | undefined {
  return (OWN_TITLES[locale] as Partial<Record<ShortcutId, string>>)[id];
}

/** The side menu group of the page `to` opens, or "more" for what sits under no heading there. */
function categoryOf(to: string): ShortcutCategory {
  const item = findNavItem(to);
  const group = item && NAV_GROUPS.find((candidate) => candidate.items.includes(item));
  return group?.labelKey ?? "more";
}

export function withSearch(entry: Omit<ShortcutEntry, "search">): ShortcutEntry {
  return { ...entry, search: { titles: [entry.title.en, entry.title.ar], trail: [SHORTCUT_CATEGORY_LABELS.en[entry.category], SHORTCUT_CATEGORY_LABELS.ar[entry.category]] } };
}

function page({ id, nav, plan, badge }: PageDef): ShortcutEntry | null {
  const item = NAV_ITEMS.find((candidate) => candidate.key === nav);
  if (!item) return null;
  return withSearch({
    id,
    to: item.to,
    icon: item.icon,
    title: { en: ownTitle(id, "en") ?? NAV_LABELS.en[nav], ar: ownTitle(id, "ar") ?? NAV_LABELS.ar[nav] },
    category: categoryOf(item.to),
    requires: item.requires,
    plan: plan ?? item.plan,
    badge,
  });
}

/** An action opens to whoever may open the page it sits under, as the row always did. */
function action(id: "new_order" | "add_product", to: string, icon: LucideIcon, primary = false): ShortcutEntry {
  return withSearch({
    id,
    to,
    icon,
    title: { en: OWN_TITLES.en[id], ar: OWN_TITLES.ar[id] },
    category: categoryOf(to),
    requires: findNavItem(to)?.requires,
    primary,
  });
}

/** Every shortcut this build offers. */
export const SHORTCUT_CATALOG: readonly ShortcutEntry[] = [
  action("new_order", "/orders/new", Plus, true),
  action("add_product", "/catalog/new", PackagePlus),
  ...PAGES.map(page).filter((entry): entry is ShortcutEntry => entry !== null),
];

const BY_ID = new Map<string, ShortcutEntry>(SHORTCUT_CATALOG.map((entry) => [entry.id, entry]));

/** The row of a member who never arranged it: the row Home always had, in its order. */
export const DEFAULT_SHORTCUT_IDS: readonly ShortcutId[] = [
  "new_order",
  "add_product",
  "confirmation_queue",
  "orders",
  "lost_orders",
  "discounts",
  "website",
  "store_settings",
];

/** The categories in the menu's order, without those nothing in `entries` sits in. */
export function categoriesOf(entries: readonly ShortcutEntry[]): ShortcutCategory[] {
  const order: ShortcutCategory[] = [...NAV_GROUPS.flatMap((group) => (group.labelKey ? [group.labelKey] : [])), "more"];
  return order.filter((category) => entries.some((entry) => entry.category === category));
}

export interface ShortcutAccess {
  /** The role's permissions (Workspace.permissions). Unknown: none is held back, as everywhere (lib/permissions). */
  permissions?: readonly string[] | null;
  /** The server's list for this member (HomeShortcuts.available): its word on role, plan and switches. */
  available?: readonly string[] | null;
  /** The plan refuses this key (lib/usePlanFeatures). */
  gated?: (feature: PlanFeatureKey) => boolean;
}

export function shortcutAllowed(entry: ShortcutEntry, { permissions, available, gated }: ShortcutAccess): boolean {
  if (!hasAnyPermission(permissions, entry.requires)) return false;
  if (available && !available.includes(entry.id)) return false;
  return !(entry.plan && gated?.(entry.plan));
}

/** The entries of `ids` this member may open, in that order, each once. An id `catalog` does not know is left out. */
export function shortcutsOf(ids: readonly string[], access: ShortcutAccess, catalog: readonly ShortcutEntry[] = SHORTCUT_CATALOG): ShortcutEntry[] {
  const byId = catalog === SHORTCUT_CATALOG ? BY_ID : new Map<string, ShortcutEntry>(catalog.map((entry) => [entry.id, entry]));
  return [...new Set(ids)].flatMap((id) => {
    const entry = byId.get(id);
    return entry && shortcutAllowed(entry, access) ? [entry] : [];
  });
}
