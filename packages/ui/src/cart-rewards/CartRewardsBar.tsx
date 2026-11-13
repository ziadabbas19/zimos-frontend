"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FILL_MS, customLookOf, iconColorOn, type BarAppearance, type BarLook, type CartSpeed } from "./appearance";
import { RewardIcon } from "./icons";
import { rewardIconOf } from "./iconNames";
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
 * edge (~350 ms at the cart's "fast" speed, ~500 ms at "normal", none at
 * "none"), a dot pops (~180 ms) the moment it is reached, the amount still to
 * go glides to its new value. Under reduced motion all of it is at once. The
 * bar is a labelled progressbar whose text is the status line; reaching a
 * tier is announced politely.
 *
 * Its look: the store's theme (`appearance` absent or `inherit`: the theme's
 * colour tokens and today's shapes, so a theme change, dark mode included,
 * reaches it on its own), or the merchant's custom look (appearance.ts). Each
 * reward shows its icon (icons.tsx). A reached marker is filled and an
 * unreached one only outlined, so the state never rests on colour alone.
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
  /** How it looks: absent or `inherit`, the store's theme (as it always looked). */
  appearance?: BarAppearance | null;
  /** The store's cart speed (Settings → Cart): how fast the fill glides; "none" moves nothing. */
  speed?: CartSpeed;
}

/** A marker's side in pixels, and its icon's. */
const MARKER_PX = { sm: 22, md: 28, lg: 36 } as const;
const ICON_PX = { sm: 12, md: 14, lg: 18 } as const;

export function CartRewardsBar({ tiers, subtotal, applied, notes = [], locale, formatMoney, loading = false, className = "", footer, appearance = null, speed = "fast" }: CartRewardsBarProps) {
  const t = TEXT[locale];
  const list = sortedTiers(tiers);
  const titleId = useId();
  const fill = rewardsFill(list, subtotal);
  const next = nextTier(list, subtotal);
  // null: the theme's look, drawn exactly as before.
  const look: BarLook | null = customLookOf(appearance);
  const still = speed === "none";

  // The fill grows from empty once the card is on screen, then follows the cart. Empty on the
  // first draw everywhere (the server's too), so a page drawn there and in the browser agree.
  const [shownFill, setShownFill] = useState(0);
  useEffect(() => {
    if (loading) return;
    if (still || reducedMotion() || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setShownFill(fill);
      return;
    }
    const frame = window.requestAnimationFrame(() => setShownFill(fill));
    return () => window.cancelAnimationFrame(frame);
  }, [fill, loading, still]);

  const remaining = useTweenedNumber(next ? next.remainingAmount : 0, still ? 0 : 350);
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
    if (!still && (!look || look.reachedPop)) for (const i of newly) pop(dots.current[i]);
    if (newly.length) setAnnouncement(t.unlocked(list[newly[newly.length - 1]].label[locale]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedKey, loading]);

  if (list.length === 0) return null;

  const knownNotes = (notes as readonly string[]).filter((n): n is CartRewardsNote => n in t.notes);

  // ---- the custom look's parts (each falls back to today's when the store inherits).
  const size = look ? look.markerSize : "md";
  const markers = !look || look.marker !== "none";
  // The track's inner edges, half a marker in from each end (in rem at the default size, as it always was).
  const edge = size === "md" ? "0.875rem" : `${MARKER_PX[size] / 2}px`;
  const edges = size === "md" ? "1.75rem" : `${MARKER_PX[size]}px`;
  const trackHeight = look && look.shape === "thin" ? "h-1" : "h-2";
  const round = look && look.corners === "square" ? "rounded-none" : "rounded-full";
  const segmented = Boolean(look && look.shape === "segmented");
  const trackStyle: CSSProperties | undefined = look?.trackColor ? { backgroundColor: look.trackColor } : undefined;
  const fillStyle = (scale: number): CSSProperties => ({
    transform: `scaleX(${scale})`,
    ...(look?.fillColor ? { backgroundColor: look.fillColor } : {}),
    ...(speed !== "fast" ? { transitionDuration: `${FILL_MS[speed]}ms` } : {}),
  });
  // The curve is CART_EASE; in a class so reduced motion can take the transition away.
  const fillClass = `absolute inset-0 origin-left ${round} ${look?.fillColor ? "" : "bg-success"} transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform rtl:origin-right motion-reduce:transition-none`;
  const markerShape = look && look.marker === "rounded_square" ? (size === "lg" ? "rounded-lg" : "rounded-md") : "rounded-full";
  const markerSize = size === "md" ? "h-7 w-7" : size === "sm" ? "h-[22px] w-[22px]" : "h-9 w-9";
  const markerTop = trackHeight === "h-1" ? "top-0.5" : "top-1";
  const reachedMarker = (on: boolean): { className: string; style?: CSSProperties } => {
    if (on && look?.fillColor) return { className: "", style: { backgroundColor: look.fillColor, borderColor: look.fillColor, color: iconColorOn(look.fillColor) } };
    return { className: on ? "border-success bg-success text-paper-raised" : "border-line-strong bg-paper-raised text-ink-soft" };
  };

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
          {(!look || look.showMessage) && (
            <p className={`text-sm font-medium leading-snug text-ink${look && look.messageAlign === "center" ? " text-center" : ""}`} aria-hidden="true">
              {shown}
            </p>
          )}

          <div
            className={`relative ${!look || look.showMessage ? "mt-4" : "mt-2"} ${size === "md" ? "px-3.5" : size === "sm" ? "px-[11px]" : "px-[18px]"} pb-1`}
            data-bar-shape={look ? look.shape : undefined}
          >
            <div
              role="progressbar"
              aria-label={t.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(fill * 100)}
              aria-valuetext={exact}
              className={segmented ? `relative flex ${trackHeight} gap-[3px]` : `relative ${trackHeight} overflow-hidden ${round} ${look?.trackColor ? "" : "bg-line"}`}
              style={segmented ? undefined : trackStyle}
            >
              {segmented ? (
                // One segment per reward, each filling over the money between its two thresholds.
                list.map((tier, i) => (
                  <span key={`${tier.type}-${tier.thresholdAmount}-${i}`} data-segment="" className={`relative flex-1 overflow-hidden ${round} ${look?.trackColor ? "" : "bg-line"}`} style={trackStyle}>
                    <span className={fillClass} style={fillStyle(Math.min(1, Math.max(0, shownFill * list.length - i)))} />
                  </span>
                ))
              ) : (
                <div className={fillClass} style={fillStyle(shownFill)} />
              )}
            </div>
            {markers &&
              list.map((tier, i) => {
                const on = reachedNow[i];
                const paint = reachedMarker(on);
                return (
                  <span
                    key={`${tier.type}-${tier.thresholdAmount}-${i}`}
                    ref={(el) => {
                      dots.current[i] = el;
                    }}
                    aria-hidden="true"
                    data-reached={on ? "" : undefined}
                    className={`absolute ${markerTop} flex ${markerSize} -translate-x-1/2 -translate-y-1/2 items-center justify-center ${markerShape} border-2 transition-colors duration-200 rtl:translate-x-1/2 motion-reduce:transition-none ${paint.className}`}
                    // The dots sit on the inner track (inside its padding), at equal steps.
                    style={{ insetInlineStart: `calc(${edge} + (100% - ${edges}) * ${(i + 1) / list.length})`, ...paint.style }}
                  >
                    <RewardIcon name={rewardIconOf(tier)} size={ICON_PX[size]} />
                  </span>
                );
              })}
          </div>

          <ol className={`${markers ? "mt-4" : "mt-2.5"} grid gap-1 text-[11px] leading-tight`} style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
            {list.map((tier, i) => (
              <li
                key={`${tier.type}-${tier.thresholdAmount}-${i}`}
                ref={
                  markers
                    ? undefined
                    : (el) => {
                        dots.current[i] = el;
                      }
                }
                data-reached={reachedNow[i] ? "" : undefined}
                className={`min-w-0 text-end ${reachedNow[i] ? "text-ink" : "text-ink-soft"}`}
              >
                {markers ? (
                  <span className="block truncate font-semibold">{tier.label[locale]}</span>
                ) : (
                  // No markers: the icon sits by the name, filled once reached.
                  <span className="flex min-w-0 items-center justify-end gap-1 font-semibold">
                    <RewardIcon name={rewardIconOf(tier)} size={12} filled={reachedNow[i]} className="shrink-0" />
                    <span className="truncate">{tier.label[locale]}</span>
                  </span>
                )}
                {(!look || look.showAmounts) && <span className="block truncate tabular-nums">{formatMoney(tier.thresholdAmount)}</span>}
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
