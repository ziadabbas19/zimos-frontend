"use client";

import type { CartRewardsQuote } from "@store-builder/api-client";
import { useTweenedNumber } from "@store-builder/ui/cart-rewards";
import { pickText } from "@/lib/i18n";
import { rewardsLocale } from "@/lib/cartRewards";
import { useStore } from "@/lib/StoreContext";

/**
 * The cart rewards' rows in an order summary (the drawer, the cart page, the
 * checkout) and the "you saved" banner — all from the quote's `rewards`,
 * which the server worked out the same way it charges the order.
 */

const TEXT = {
  en: {
    reward: (label: string) => `Reward: ${label}`,
    automatic: "Automatic discount",
    saved: (amount: string) => `You saved ${amount} on this order`,
  },
  ar: {
    reward: (label: string) => `مكافأة: ${label}`,
    automatic: "خصم تلقائي",
    saved: (amount: string) => `وفّرت ${amount} في الطلب ده`,
  },
};

/** The reward's row ("Reward: 5% off  −EGP 75"); a free-shipping reward shows in the shipping row instead. */
export function RewardDiscountRow({ rewards, currency }: { rewards: CartRewardsQuote | null; currency?: string }) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const amount = useTweenedNumber(rewards && rewards.applied && !rewards.applied.freeShipping ? rewards.discountAmount : 0);
  if (!rewards || !rewards.applied || rewards.applied.freeShipping || rewards.discountAmount <= 0) return null;
  return (
    <div className="flex justify-between gap-3 text-success">
      <dt className="min-w-0">{text.reward(rewards.applied.label[rewardsLocale(locale)])}</dt>
      <dd className="shrink-0 font-semibold tabular-nums">−{money(amount, currency)}</dd>
    </div>
  );
}

/** The store's automatic discount, as the quote says the order gets it (none when the reward replaced it). */
export function AutomaticDiscountRow({ amount, currency }: { amount: number; currency?: string }) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const shown = useTweenedNumber(amount);
  if (amount <= 0) return null;
  return (
    <div className="flex justify-between gap-3 text-success">
      <dt>{text.automatic}</dt>
      <dd className="shrink-0 font-semibold tabular-nums">−{money(shown, currency)}</dd>
    </div>
  );
}

/** "You saved EGP X on this order": compare-at prices, bundles, the reward and the code; only when there is something saved. */
export function SavedBanner({ rewards, currency, className = "" }: { rewards: CartRewardsQuote | null; currency?: string; className?: string }) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const target = rewards ? rewards.savedAmount : 0;
  const amount = useTweenedNumber(target);
  if (target <= 0) return null;
  return (
    <p className={`flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-semibold text-success ${className}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        <path d="M3 12V4h8l9 9-8 8z" />
        <circle cx="7.5" cy="7.5" r="1.4" />
      </svg>
      <span className="tabular-nums">{text.saved(money(amount, currency))}</span>
    </p>
  );
}
