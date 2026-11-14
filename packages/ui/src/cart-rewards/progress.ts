/**
 * Where a cart stands on the rewards bar — display only. What a reward is
 * worth and which one the shopper gets is the server's (the shipping quote's
 * `rewards`); this only places the fill and the dots, and says how far the
 * next tier is, from the store's tiers and the subtotal the server priced.
 */

export type RewardKind = "percent" | "fixed" | "free_shipping";

export interface RewardText {
  ar: string;
  en: string;
}

export interface RewardTier {
  thresholdAmount: number;
  type: RewardKind;
  value: number | null;
  label: RewardText;
  /** The icon on its marker (icons.tsx); absent or unknown: by its kind. */
  icon?: string | null;
}

/** Lowest threshold first; tiers on the same threshold keep their order. */
export function sortedTiers<T extends { thresholdAmount: number }>(tiers: readonly T[]): T[] {
  return tiers
    .map((tier, index) => ({ tier, index }))
    .sort((a, b) => a.tier.thresholdAmount - b.tier.thresholdAmount || a.index - b.index)
    .map(({ tier }) => tier);
}

export const reached = (tier: { thresholdAmount: number }, subtotal: number) => subtotal >= tier.thresholdAmount;

/**
 * How full the bar is, 0–1. The dots sit at equal steps (the n-th of n tiers
 * at the end), and the fill moves through each step in proportion to the
 * money between its two thresholds — so a far last tier does not squeeze the
 * first ones into a corner.
 */
export function rewardsFill(tiers: readonly RewardTier[], subtotal: number): number {
  const list = sortedTiers(tiers);
  const n = list.length;
  if (n === 0) return 0;
  const amount = Math.max(0, Number(subtotal) || 0);
  for (let k = 0; k < n; k++) {
    const to = list[k].thresholdAmount;
    if (amount >= to) continue;
    const from = k === 0 ? 0 : list[k - 1].thresholdAmount;
    const part = to > from ? (amount - from) / (to - from) : 1;
    return Math.min(1, Math.max(0, (k + part) / n));
  }
  return 1;
}

/** The next tier to reach and how much more it needs, or null once every tier is reached. */
export function nextTier(tiers: readonly RewardTier[], subtotal: number): { tier: RewardTier; index: number; remainingAmount: number } | null {
  const list = sortedTiers(tiers);
  const index = list.findIndex((tier) => !reached(tier, subtotal));
  if (index === -1) return null;
  return { tier: list[index], index, remainingAmount: Math.max(0, list[index].thresholdAmount - Math.max(0, Number(subtotal) || 0)) };
}

/**
 * For the dashboard's preview only, where there is no quote: the reached tier
 * that takes the most off a cart of `subtotal` (a percent of it, or the fixed
 * amount), else a reached free-shipping tier. The real choice — free shipping
 * against the actual fee, against a code — is the server's.
 */
export function previewApplied(tiers: readonly RewardTier[], subtotal: number): RewardTier | null {
  const hit = sortedTiers(tiers).filter((tier) => reached(tier, subtotal));
  let best: { tier: RewardTier; amount: number } | null = null;
  for (const tier of hit) {
    if (tier.type === "free_shipping") continue;
    const amount = tier.type === "percent" ? Math.round((subtotal * Number(tier.value)) / 100) : Math.min(subtotal, Number(tier.value));
    if (!best || amount >= best.amount) best = { tier, amount };
  }
  return best ? best.tier : (hit.filter((tier) => tier.type === "free_shipping").pop() ?? null);
}
