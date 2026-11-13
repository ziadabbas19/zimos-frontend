"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { pop, reducedMotion, useTweenedNumber } from "./motion";
import { nextTier, reached, rewardsFill, sortedTiers, type RewardText, type RewardTier } from "./progress";

/**
 * The cart's rewards card: one line saying what is already applied and how
 * much more the next reward needs, and a bar of milestone dots that fills
 * from the start side (right in Arabic, left in English).
 *
 * Shared by the store's cart (the drawer, the cart page, the checkout) and
 * the dashboard's settings preview, so the merchant sees the very bar their
 * shoppers will. It decides nothing about money: `applied` and `notes` are
 * the server's (the shipping quote's `rewards`); the fill and the dots are
 * placed from the tiers and the subtotal the server priced.
 *
 * Motion is transform and opacity only: the fill is a scaleX from the start
 * edge (~350 ms), a dot pops (~180 ms) the moment it is reached, the amount
 * still to go glides to its new value. Under reduced motion all of it is at
 * once. The bar is a labelled progressbar whose text is the status line;
 * reaching a tier is announced politely.
 */

export type CartRewardsLocale = "ar" | "en";

export type CartRewardsNote = "discount_over_free_shipping" | "reward_over_coupon" | "coupon_over_reward";

const TEXT = {
  en: {
    title: "Your rewards",
    progress: "Rewards progress",
    appliedNext: (applied: string, amount: string, next: string) => `${applied} applied automatically, ${amount} more for ${next}`,
    appliedAll: (applied: string) => `${applied} applied automatically. Every reward unlocked`,
    next: (amount: string, next: string) => `Add ${amount} more for ${next}`,
    allReached: "Every reward unlocked",
    unlocked: (label: string) => `${label} unlocked`,
    notes: {
      discount_over_free_shipping: "Discount applied instead of free shipping, it saves you more",
      reward_over_coupon: "Your code was not applied: this reward saves you more",
      coupon_over_reward: "Your code saves you more, so it is applied instead of the reward",
    } satisfies Record<CartRewardsNote, string>,
    loading: "Loading your rewards",
  },
  ar: {
    title: "مكافآتك",
    progress: "التقدم نحو المكافآت",
    appliedNext: (applied: string, amount: string, next: string) => `${applied} اتطبّق تلقائيًا، ضيف ${amount} كمان وتاخد ${next}`,
    appliedAll: (applied: string) => `${applied} اتطبّق تلقائيًا. خدت كل المكافآت`,
    next: (amount: string, next: string) => `ضيف ${amount} كمان وتاخد ${next}`,
    allReached: "خدت كل المكافآت",
    unlocked: (label: string) => `فتحت ${label}`,
    notes: {
      discount_over_free_shipping: "طبّقنا الخصم بدل الشحن المجاني لأنه بيوفّر لك أكتر",
      reward_over_coupon: "الكود ما اتطبّقش: المكافأة دي بتوفّر لك أكتر",
      coupon_over_reward: "الكود بيوفّر لك أكتر، فاتطبّق بدل المكافأة",
    } satisfies Record<CartRewardsNote, string>,
    loading: "بنحمّل مكافآتك",
  },
};

export interface CartRewardsStatusInput {
  tiers: readonly RewardTier[];
  subtotal: number;
  applied: { label: RewardText } | null;
  locale: CartRewardsLocale;
  formatMoney: (minor: number) => string;
}

/** The one line above the bar, in full (exact amounts): what screen readers hear as the bar's value. */
export function cartRewardsStatus({ tiers, subtotal, applied, locale, formatMoney }: CartRewardsStatusInput, remaining?: number): string {
  const t = TEXT[locale];
  const next = nextTier(tiers, subtotal);
  const appliedLabel = applied ? applied.label[locale] : null;
  if (next) {
    const amount = formatMoney(remaining ?? next.remainingAmount);
    const label = next.tier.label[locale];
    return appliedLabel ? t.appliedNext(appliedLabel, amount, label) : t.next(amount, label);
  }
  return appliedLabel ? t.appliedAll(appliedLabel) : t.allReached;
}

function TierIcon({ type }: { type: RewardTier["type"] }) {
  // Inline and decorative: the label under the dot says what it is.
  if (type === "free_shipping") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100">
        <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
        <circle cx="7" cy="17" r="1.6" />
        <circle cx="17" cy="17" r="1.6" />
      </svg>
    );
  }
  if (type === "percent") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M18 6 6 18" />
        <circle cx="7.5" cy="7.5" r="2" />
        <circle cx="16.5" cy="16.5" r="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12V4h8l9 9-8 8z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </svg>
  );
}

export interface CartRewardsBarProps {
  tiers: readonly RewardTier[];
  /** The subtotal the server priced (after product and offer prices, bundles, combos). */
  subtotal: number;
  /** The reward the server applied (the quote's `rewards.applied`); null for none. */
  applied: { label: RewardText } | null;
  /** The server's notes (the quote's `rewards.notes`). */
  notes?: readonly CartRewardsNote[] | readonly string[];
  locale: CartRewardsLocale;
  /** Minor units → the store's currency in the shopper's locale. */
  formatMoney: (minor: number) => string;
  /** No numbers yet: a skeleton of the same size. */
  loading?: boolean;
  className?: string;
  /** Under the bar, after the notes (the dashboard puts nothing here; the store may). */
  footer?: ReactNode;
}

export function CartRewardsBar({ tiers, subtotal, applied, notes = [], locale, formatMoney, loading = false, className = "", footer }: CartRewardsBarProps) {
  const t = TEXT[locale];
  const list = sortedTiers(tiers);
  const titleId = useId();
  const fill = rewardsFill(list, subtotal);
  const next = nextTier(list, subtotal);

  // The fill grows from empty once the card is on screen, then follows the cart. Empty on the
  // first draw everywhere (the server's too), so a page drawn there and in the browser agree.
  const [shownFill, setShownFill] = useState(0);
  useEffect(() => {
    if (loading) return;
    if (reducedMotion() || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setShownFill(fill);
      return;
    }
    const frame = window.requestAnimationFrame(() => setShownFill(fill));
    return () => window.cancelAnimationFrame(frame);
  }, [fill, loading]);

  const remaining = useTweenedNumber(next ? next.remainingAmount : 0);
  const exact = cartRewardsStatus({ tiers: list, subtotal, applied, locale, formatMoney });
  const shown = cartRewardsStatus({ tiers: list, subtotal, applied, locale, formatMoney }, next ? remaining : undefined);

  // A dot that has just been reached pops, and the tier is announced; nothing on the first draw.
  const dots = useRef<Array<HTMLSpanElement | null>>([]);
  const wasReached = useRef<boolean[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const reachedNow = list.map((tier) => reached(tier, subtotal));
  const reachedKey = reachedNow.map((r) => (r ? 1 : 0)).join("");
  useEffect(() => {
    if (loading) return;
    const before = wasReached.current;
    wasReached.current = reachedNow;
    if (!before || before.length !== reachedNow.length) return;
    const newly = reachedNow.map((r, i) => r && !before[i]).map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
    for (const i of newly) pop(dots.current[i]);
    if (newly.length) setAnnouncement(t.unlocked(list[newly[newly.length - 1]].label[locale]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedKey, loading]);

  if (list.length === 0) return null;

  const knownNotes = (notes as readonly string[]).filter((n): n is CartRewardsNote => n in t.notes);

  return (
    <section aria-labelledby={titleId} className={`rounded-2xl border border-line bg-paper p-3.5 ${className}`}>
      <h3 id={titleId} className="sr-only">
        {t.title}
      </h3>
      {loading ? (
        <div aria-busy="true" aria-label={t.loading} className="space-y-3">
          <span className="block h-4 w-4/5 animate-pulse rounded-md bg-line/70 motion-reduce:animate-none" />
          <span className="block h-2 w-full animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
          <span className="block h-7 w-full animate-pulse rounded-md bg-line/50 motion-reduce:animate-none" />
        </div>
      ) : (
        <>
          <p className="text-sm font-medium leading-snug text-ink" aria-hidden="true">
            {shown}
          </p>

          <div className="relative mt-4 px-3.5 pb-1">
            <div
              role="progressbar"
              aria-label={t.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(fill * 100)}
              aria-valuetext={exact}
              className="relative h-2 overflow-hidden rounded-full bg-line"
            >
              <div
                // The curve is CART_EASE; in a class so reduced motion can take the transition away.
                className="absolute inset-0 origin-left rounded-full bg-success transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform rtl:origin-right motion-reduce:transition-none"
                style={{ transform: `scaleX(${shownFill})` }}
              />
            </div>
            {list.map((tier, i) => {
              const on = reachedNow[i];
              return (
                <span
                  key={`${tier.type}-${tier.thresholdAmount}-${i}`}
                  ref={(el) => {
                    dots.current[i] = el;
                  }}
                  aria-hidden="true"
                  className={`absolute top-1 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-colors duration-200 rtl:translate-x-1/2 motion-reduce:transition-none ${
                    on ? "border-success bg-success text-paper-raised" : "border-line-strong bg-paper-raised text-ink-soft"
                  }`}
                  // The dots sit on the inner track (inside its padding), at equal steps.
                  style={{ insetInlineStart: `calc(0.875rem + (100% - 1.75rem) * ${(i + 1) / list.length})` }}
                >
                  <TierIcon type={tier.type} />
                </span>
              );
            })}
          </div>

          <ol className="mt-4 grid gap-1 text-[11px] leading-tight" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
            {list.map((tier, i) => (
              <li key={`${tier.type}-${tier.thresholdAmount}-${i}`} className={`min-w-0 text-end ${reachedNow[i] ? "text-ink" : "text-ink-soft"}`}>
                <span className="block truncate font-semibold">{tier.label[locale]}</span>
                <span className="block truncate tabular-nums">{formatMoney(tier.thresholdAmount)}</span>
              </li>
            ))}
          </ol>

          {knownNotes.map((note) => (
            <p key={note} className="mt-2.5 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs text-ink">
              {t.notes[note]}
            </p>
          ))}
          {footer}
        </>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
