/**
 * Cart rewards: spend thresholds in the store's cart that unlock a discount or
 * free shipping (backend: src/modules/cartRewards, CART_REWARDS_ENABLED — off,
 * every call here answers 404 and the shipping quote carries no `rewards`).
 *
 * Staff, /workspaces/:workspaceId/cart-rewards (discounts.manage): GET the
 * section, PUT it whole. Storefront: GET /store/:id/cart-rewards (the tiers
 * and trust lines; null while not in force), and the shipping quote's
 * `rewards` — what the cart, the cart page and the checkout show, worked out
 * by the same server function that prices the order.
 *
 * Money is minor units; a percent tier's value is a whole percent (1–100).
 * With GROWTH_REQUIRE_PLAN_FEATURE the plan's `cart_rewards` too: the staff
 * routes answer 403 PLAN_FEATURE_REQUIRED without it.
 *
 * Notable codes: VALIDATION_ERROR (422; a detail per field, e.g.
 * `tiers.1.thresholdAmount` for a threshold that does not rise).
 * All exported names start with `cartRewards` / `CartReward` / `storefront…`.
 */
import type { ApiClient } from "../client";
import type { ShippingQuote } from "../types";

export type CartRewardType = "percent" | "fixed" | "free_shipping";

/** A name in both languages. */
export interface CartRewardText {
  ar: string;
  en: string;
}

export interface CartRewardTierInput {
  thresholdAmount: number;
  type: CartRewardType;
  /** percent: 1–100; fixed: minor units; free_shipping: none. */
  value?: number;
  /** The merchant's own name; empty in a language = the automatic one there. */
  label?: { ar: string | null; en: string | null } | null;
}

export interface CartRewardTier extends CartRewardTierInput {
  /** What the bar calls it when the merchant wrote nothing. */
  autoLabel: CartRewardText;
}

export interface CartRewardTrustItem {
  text: CartRewardText;
  enabled: boolean;
}

export interface CartRewardsSettings {
  enabled: boolean;
  /** A coupon (or automatic discount) and the reward both apply; off, only the bigger one. */
  allowCouponStacking: boolean;
  /** The store's currency, which thresholds and fixed amounts are in. */
  currency: string;
  /** Lowest threshold first. */
  tiers: CartRewardTier[];
  trustItems: CartRewardTrustItem[];
}

export interface CartRewardsSettingsPayload {
  enabled: boolean;
  allowCouponStacking: boolean;
  tiers: CartRewardTierInput[];
  trustItems: CartRewardTrustItem[];
}

/** One tier as the storefront shows it: its name resolved. */
export interface CartRewardMilestone {
  thresholdAmount: number;
  type: CartRewardType;
  value: number | null;
  label: CartRewardText;
  /** Only in a quote. */
  reached?: boolean;
}

/** GET /store/:id/cart-rewards. */
export interface StorefrontCartRewards {
  currency: string;
  allowCouponStacking: boolean;
  tiers: CartRewardMilestone[];
  /** The lines under the checkout button the merchant switched on. */
  trustItems: Array<{ text: CartRewardText }>;
}

/** Why the shopper got what they got. */
export type CartRewardNote = "discount_over_free_shipping" | "reward_over_coupon" | "coupon_over_reward";

export interface CartRewardApplied {
  type: CartRewardType;
  value: number | null;
  thresholdAmount: number;
  label: CartRewardText;
  /** What it saves; the delivery fee for free shipping. */
  amount: number;
  freeShipping: boolean;
}

/** The shipping quote's `rewards`. */
export interface CartRewardsQuote {
  currency: string;
  allowCouponStacking: boolean;
  tiers: Array<CartRewardMilestone & { reached: boolean }>;
  next: (CartRewardMilestone & { index: number; remainingAmount: number }) | null;
  applied: CartRewardApplied | null;
  /** What the reward takes off the items (0 for free shipping). */
  discountAmount: number;
  /** The code (or automatic discount) weighed against the reward. */
  coupon: { code: string | null; automatic: boolean; applied: boolean; amount: number; refused?: string } | null;
  notes: CartRewardNote[];
  /** What the delivery would cost without free shipping; null until the governorate is known. */
  shippingFeeAmount: number | null;
  /** Lines sold below their compare-at price, and bundle or combo savings. */
  compareAtSavings: number;
  /** All the shopper saves on this order. */
  savedAmount: number;
}

export async function cartRewardsGet(client: ApiClient, workspaceId: string): Promise<CartRewardsSettings> {
  return (await client.request<{ cartRewards: CartRewardsSettings }>(`/workspaces/${workspaceId}/cart-rewards`)).cartRewards;
}

export async function cartRewardsSave(client: ApiClient, workspaceId: string, payload: CartRewardsSettingsPayload): Promise<CartRewardsSettings> {
  return (
    await client.request<{ cartRewards: CartRewardsSettings }>(`/workspaces/${workspaceId}/cart-rewards`, { method: "PUT", body: payload })
  ).cartRewards;
}

/** The store's tiers and trust lines; null while cart rewards are off for it. Throws 404 while the platform has them off. */
export async function storefrontCartRewards(client: ApiClient, workspaceId: string): Promise<StorefrontCartRewards | null> {
  return (await client.request<{ cartRewards: StorefrontCartRewards | null }>(`/store/${workspaceId}/cart-rewards`, { auth: false })).cartRewards;
}

/** The quote's `rewards`, or null for a quote without them (feature off, an older server). */
export function storefrontQuoteRewards(quote: ShippingQuote | null | undefined): CartRewardsQuote | null {
  const raw = (quote ?? {}) as { rewards?: CartRewardsQuote | null };
  return raw.rewards ?? null;
}

/** The most tiers a store may list, and the most trust lines. */
export const CART_REWARDS_MAX_TIERS = 6;
export const CART_REWARDS_MAX_TRUST_ITEMS = 4;

/**
 * The server's checks on the settings, for the form to say before saving
 * (the server checks again): a positive threshold, thresholds rising within
 * each kind (the discounts, and free shipping) in the order listed, a whole
 * percent 1–100, a positive fixed amount, at most six tiers, some text on
 * each trust line, and a tier before switching the bar on.
 * Returns field → error key, keyed like the server's details.
 */
export type CartRewardsError = "threshold" | "notRising" | "percent" | "amount" | "tooMany" | "noTiers" | "trustText";

export function cartRewardsValidate(payload: CartRewardsSettingsPayload): Record<string, CartRewardsError> {
  const errors: Record<string, CartRewardsError> = {};
  if (payload.tiers.length > CART_REWARDS_MAX_TIERS) errors.tiers = "tooMany";
  if (payload.enabled && payload.tiers.length === 0) errors.tiers = "noTiers";
  const last: Record<"discount" | "free_shipping", number | null> = { discount: null, free_shipping: null };
  payload.tiers.forEach((tier, i) => {
    const threshold = Number(tier.thresholdAmount);
    if (!Number.isInteger(threshold) || threshold < 1) {
      errors[`tiers.${i}.thresholdAmount`] = "threshold";
    } else {
      const kind = tier.type === "free_shipping" ? "free_shipping" : "discount";
      const before = last[kind];
      if (before !== null && threshold <= before) errors[`tiers.${i}.thresholdAmount`] = "notRising";
      last[kind] = before === null ? threshold : Math.max(before, threshold);
    }
    const value = Number(tier.value);
    if (tier.type === "percent" && (!Number.isInteger(value) || value < 1 || value > 100)) errors[`tiers.${i}.value`] = "percent";
    if (tier.type === "fixed" && (!Number.isInteger(value) || value < 1)) errors[`tiers.${i}.value`] = "amount";
  });
  payload.trustItems.forEach((item, i) => {
    if (!item.text.ar.trim() && !item.text.en.trim()) errors[`trustItems.${i}.text`] = "trustText";
  });
  return errors;
}
