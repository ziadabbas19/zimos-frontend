import { lineContentId } from "./contentId";
import {
  menuOptionsLabel,
  type MenuOptionsSnapshot,
  parseMoney,
  type FunnelRuntimeMergedOrder,
  type Order,
  type StorefrontOrderBump,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { priceOf } from "./product";

/**
 * ------------------------------------------------------------------------
 * Conversion features built on top of the public storefront API.
 *
 * Everything here is derived from real catalogue data: bundles come from the
 * merchant's own multi-line offers, and the order bump and post-purchase
 * upsell are real products from the same store, added as real cart lines at
 * real prices. When the data to support a feature isn't there, the function
 * returns nothing and the UI drops the feature rather than inventing a
 * placeholder product or discount.
 * ------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Bundles / quantity offers
// ---------------------------------------------------------------------------

export interface BundleTier {
  id: string;
  quantity: number;
  /** Percentage off `quantity × unit`, derived from the offer's own price. */
  discountPct: number;
  offerId: string;
  /** Fixed total for the offer (minor units). */
  totalAmount: number;
  label?: string;
  badge?: string | null;
}

/**
 * Quantity tiers for a product, built from the merchant's offers.
 *
 * A product needs two or more offers to present a ladder; with fewer there is
 * nothing to compare against, so no bundle UI is shown.
 */
export function bundleTiers(product: StorefrontProduct): BundleTier[] {
  if (product.offers.length < 2) return [];
  const unit = priceOf(product) ?? 0;
  return product.offers.map((offer) => {
    const quantity = Math.max(1, offer.lines.reduce((sum, l) => sum + (l.quantity || 0), 0) || 1);
    const total = parseMoney(offer.priceAmount);
    const full = unit * quantity;
    const discountPct = full > total && full > 0 ? Math.round(((full - total) / full) * 100) : 0;
    return {
      id: offer.id,
      quantity,
      discountPct,
      offerId: offer.id,
      totalAmount: total,
      label: offer.name,
      badge: offer.badge,
    };
  });
}

/** Totals for the selected tier, or plain unit × quantity when there is none. */
export function bundlePricing(unitAmount: number, quantity: number, tier: BundleTier | undefined) {
  if (tier) {
    const full = unitAmount * tier.quantity;
    return { full, total: tier.totalAmount, saving: Math.max(0, full - tier.totalAmount) };
  }
  const full = unitAmount * quantity;
  return { full, total: full, saving: 0 };
}

// ---------------------------------------------------------------------------
// Order bump
// ---------------------------------------------------------------------------

export interface OrderBumpOffer {
  offerId: string;
  /** The offer's first line: what a shipping quote and the autosave need. */
  variantId: string;
  productId: string;
  /** The merchant's heading for the card; null uses the default one. */
  heading: string | null;
  name: string;
  /** The offer's own name, when it says more than the product's. */
  detail: string | null;
  description: string | null;
  imageUrl: string | null;
  priceAmount: number;
  compareAtAmount: number | null;
}

/**
 * The bump the merchant set (store.orderBump, or a funnel checkout step's
 * `bump`) as the card shows it — or null when there is none, or when it is a
 * product the shopper is already buying. The server decides what it costs.
 */
export function orderBumpOf(
  bump: StorefrontOrderBump | null | undefined,
  excludeProductIds: string[] = []
): OrderBumpOffer | null {
  if (!bump || excludeProductIds.includes(bump.productId)) return null;
  const price = parseMoney(bump.priceAmount);
  const compareAt = bump.compareAtAmount === null ? null : parseMoney(bump.compareAtAmount);
  return {
    offerId: bump.offerId,
    variantId: bump.variantId,
    productId: bump.productId,
    heading: bump.title,
    name: bump.productName,
    detail: bump.name && bump.name !== bump.productName ? bump.name : null,
    description: bump.description,
    imageUrl: bump.imageUrl,
    priceAmount: price,
    compareAtAmount: compareAt !== null && compareAt > price ? compareAt : null,
  };
}

// ---------------------------------------------------------------------------
// Order snapshots (for thank-you + tracking on this device)
//
// A copy of the order the backend returned, kept so the thank-you and tracking
// pages work for a guest who has no account to look the order up against.
// ---------------------------------------------------------------------------

export interface OrderSnapshot {
  id: string;
  orderNumber: string;
  phone: string;
  /** The name the order was placed under, for the thank-you message. */
  customerName?: string;
  currency: string;
  createdAt: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  /** `combo`: the name of the combo the line was bought in (lib/combos); absent on other lines and older snapshots. */
  items: { name: string; options: string; quantity: number; lineTotal: number; combo?: string }[];
  /** The estimated delivery time the order was placed with, minutes (shipping snapshot). */
  etaMinutes?: number | null;
  productIds: string[];
  /** The pixels' ids for the lines (lib/contentId): the feed's item ids. */
  contentIds?: string[];
}

export function snapshotFromOrder(order: Order, phone: string): OrderSnapshot {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    phone,
    customerName: (order as { contactSnapshot?: { fullName?: string } }).contactSnapshot?.fullName ?? undefined,
    currency: order.currency,
    createdAt: order.createdAt ?? new Date().toISOString(),
    subtotalAmount: parseMoney(order.subtotalAmount),
    discountAmount: parseMoney(order.discountAmount),
    shippingAmount: parseMoney(order.shippingAmount),
    totalAmount: parseMoney(order.totalAmount),
    etaMinutes: (order as { shippingSnapshot?: { etaMinutes?: number | null } }).shippingSnapshot?.etaMinutes ?? null,
    items: (order.items ?? []).map((item) => ({
      name: item.productNameSnapshot,
      // The variant's options, then the menu options it was sold with.
      options: [Object.values(item.variantOptionsSnapshot ?? {}).filter(Boolean).join(" / "), menuOptionsLabel((item as { optionsSnapshot?: MenuOptionsSnapshot | null }).optionsSnapshot)].filter(Boolean).join(" · "),
      quantity: item.quantity,
      lineTotal: parseMoney(item.lineTotalAmount),
      // A product of a combo: the order holds one line per product, each keeping the combo's name.
      ...(item.comboNameSnapshot ? { combo: item.comboNameSnapshot } : {}),
    })),
    productIds: (order.items ?? []).map((i) => i.productId).filter((id): id is string => !!id),
    contentIds: (order.items ?? []).map((i) => lineContentId(i)).filter((id): id is string => !!id),
  };
}

const ordersKey = (workspaceId: string) => `zimos_orders_${workspaceId}`;

/**
 * A funnel offer joined the order after it was placed (the store's
 * funnel_upsell_merge): the saved copy takes its new totals and lines, so the
 * thank-you page shows what the courier will collect.
 */
export function mergeIntoOrderSnapshot(workspaceId: string, merged: FunnelRuntimeMergedOrder) {
  const saved = getOrderSnapshot(workspaceId, merged.id);
  if (!saved) return;
  saveOrderSnapshot(workspaceId, {
    ...saved,
    subtotalAmount: parseMoney(merged.subtotalAmount),
    discountAmount: parseMoney(merged.discountAmount),
    shippingAmount: parseMoney(merged.shippingAmount),
    totalAmount: parseMoney(merged.totalAmount),
    items: merged.items.map((item) => ({
      name: item.productNameSnapshot,
      // The variant's options, then the menu options it was sold with.
      options: [Object.values(item.variantOptionsSnapshot ?? {}).filter(Boolean).join(" / "), menuOptionsLabel((item as { optionsSnapshot?: MenuOptionsSnapshot | null }).optionsSnapshot)].filter(Boolean).join(" · "),
      quantity: item.quantity,
      lineTotal: parseMoney(item.lineTotalAmount),
    })),
    productIds: merged.items.map((i) => i.productId).filter((id): id is string => !!id),
    contentIds: merged.items.map((i) => lineContentId(i as { skuSnapshot?: string | null; variantId?: string | null })).filter((id): id is string => !!id),
  });
}

export function saveOrderSnapshot(workspaceId: string, snapshot: OrderSnapshot) {
  const list = readJson<OrderSnapshot[]>(ordersKey(workspaceId)) ?? [];
  const next = [snapshot, ...list.filter((o) => o.id !== snapshot.id)].slice(0, 20);
  writeJson(ordersKey(workspaceId), next);
}

/** The order this device placed last in this store, if any (newest is kept first). */
export function latestOrderSnapshot(workspaceId: string): OrderSnapshot | null {
  const list = readJson<OrderSnapshot[]>(ordersKey(workspaceId)) ?? [];
  return list[0] ?? null;
}

export function getOrderSnapshot(workspaceId: string, orderId: string): OrderSnapshot | null {
  const list = readJson<OrderSnapshot[]>(ordersKey(workspaceId)) ?? [];
  return list.find((o) => o.id === orderId) ?? null;
}

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — the flow still works, it just won't be remembered */
  }
}
