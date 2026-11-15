import type { PlanFeatureKey } from "@store-builder/api-client";
import { NAV_GROUPS, findNavGroup, findNavItem, isNavItemVisible, isSidebarItem, type NavGroup, type NavItem } from "./navigation";
import type { WorkCounts } from "./workCounts";

/**
 * The dashboard's places: the groups of the side menu (lib/navigation.ts
 * NAV_GROUPS), in their order, without the last one (My Plan, Settings,
 * support), which stays at the foot of the side menu. Each has a tile in its
 * own colour with a white iPhone glyph (components/shell/PlaceTile.tsx): the
 * same tile in the dock under the page and beside the place's name in the
 * side menu, so a place is found by its colour before its name is read.
 */
export type PlaceId = "main" | "orders" | "products" | "customers" | "marketing" | "store" | "analytics" | "money";

/** The group that is not a place: it sits under the side menu's list. */
export const FOOT_GROUP_ID = "config";

/**
 * Each place's colour: the main page in the ZIMOS blue, the rest in calm
 * iPhone app colours, a different hue each. The glyph on them is white and
 * decorative (the tile's link carries the name).
 */
export const PLACE_COLOR: Record<PlaceId, string> = {
  main: "#165dff",
  orders: "#d96a00",
  products: "#b07a00",
  customers: "#5856d6",
  marketing: "#e0245e",
  store: "#a245d6",
  analytics: "#0e8f9c",
  money: "#1e9e4a",
};

export interface Place {
  id: PlaceId;
  group: NavGroup;
  /** The pages of the place this member may open, in their order. */
  items: NavItem[];
  /** Where the place's tile goes: its first page. */
  to: string;
}

/**
 * The places this member has, each with the pages they may open (their role,
 * the plan, this deploy). A place left without a page is left out.
 */
export function placesFor(permissions: readonly string[] | null | undefined, planGated?: (feature: PlanFeatureKey) => boolean): Place[] {
  return NAV_GROUPS.filter((group) => group.id !== FOOT_GROUP_ID).flatMap((group) => {
    const items = group.items.filter((item) => isSidebarItem(item) && isNavItemVisible(item, permissions) && !(item.plan && planGated?.(item.plan)));
    return items.length > 0 ? [{ id: group.id as PlaceId, group, items, to: items[0].to }] : [];
  });
}

/** The place a page belongs to, or null for one of the foot's pages (or one outside the menu). */
export function placeOf(pathname: string): PlaceId | null {
  const item = findNavItem(pathname);
  const group = item ? findNavGroup(item) : undefined;
  return group && group.id !== FOOT_GROUP_ID ? (group.id as PlaceId) : null;
}

/** The waiting work a place shows on its tile, most urgent first: calls due, then messages, reviews, orders to ship. */
const BADGE_ORDER: Array<keyof WorkCounts> = ["toConfirm", "unread", "reviews", "toShip"];

/** The count a place's tile carries: its most urgent queue with work in it, or null. */
export function placeBadge(place: Place, counts: WorkCounts): { kind: keyof WorkCounts; count: number } | null {
  const kinds = new Set(place.items.map((item) => item.badge).filter(Boolean));
  for (const kind of BADGE_ORDER) {
    const count = counts[kind];
    if (kinds.has(kind) && count) return { kind, count };
  }
  return null;
}
