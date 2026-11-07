import { dashboardGetMobileNav } from "@store-builder/api-client";
import type { Locale } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { NAV_ITEMS } from "@/lib/navigation";
import { createRowStore } from "@/lib/shortcutRows";
import { SHORTCUT_CATALOG, shortcutsOf, withSearch, type ShortcutAccess, type ShortcutEntry } from "@/pages/home/shortcutCatalog";

/**
 * The phone's bottom bar (components/MobileTabBar.tsx): the slots before
 * "More", as this member arranged them in this store (backend
 * dashboard/homeShortcuts.js MOBILE_NAV, memberships.mobile_nav). Its slots are
 * Home and the Home shortcuts' catalogue, under the same rules (role, plan,
 * this deploy's switches); kept for the session like the Home row
 * (lib/shortcutRows), seeded by the bootstrap.
 */
const store = createRowStore((workspaceId) => dashboardGetMobileNav(apiClient, workspaceId), "mobileNav");

export const seedMobileNav = store.seed;
export const readMobileNav = store.read;
export const forgetMobileNav = store.forget;
export const useMobileNav = store.useRow;

/** At most this many slots before "More": each keeps room for its label on a phone. */
export const MAX_DOCK_SLOTS = 4;

/** The bar of a member who never arranged it: the one it always was. */
export const DEFAULT_DOCK_IDS = ["home", "orders", "confirmation_queue", "products"] as const;

const overview = NAV_ITEMS.find((item) => item.key === "overview");

/** Home, the first slot of the default bar. */
const HOME_ENTRY: ShortcutEntry = withSearch({
  id: "home",
  to: "/",
  icon: overview!.icon,
  title: { en: "Today", ar: "اليوم" },
  category: "more",
});

/** Every slot this build offers: Home, then the Home shortcuts' catalogue. */
export const DOCK_CATALOG: readonly ShortcutEntry[] = [HOME_ENTRY, ...SHORTCUT_CATALOG];

/** The bar's own short words for the slots it always had; any other slot says its catalogue title. */
const DOCK_LABELS: Record<Locale, Partial<Record<string, string>>> = {
  en: { home: "Today", orders: "Orders", confirmation_queue: "Confirm", products: "Products" },
  ar: { home: "اليوم", orders: "الطلبات", confirmation_queue: "التأكيد", products: "المنتجات" },
};

export function dockLabel(entry: ShortcutEntry, locale: Locale): string {
  return DOCK_LABELS[locale][entry.id] ?? entry.title[locale];
}

/** The slots of `ids` this member may open, in that order, four at most. Home is everyone's. */
export function dockEntriesOf(ids: readonly string[], access: ShortcutAccess): ShortcutEntry[] {
  const available = access.available ? [...access.available, "home"] : access.available;
  return shortcutsOf(ids, { ...access, available }, DOCK_CATALOG).slice(0, MAX_DOCK_SLOTS);
}
