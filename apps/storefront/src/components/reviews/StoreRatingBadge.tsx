"use client";

import type { StorefrontMeta, StorefrontRatingSummary } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { pickText, type Locale } from "@/lib/i18n";
import { REVIEW_TEXT, STORE_REVIEWS_PATH } from "./reviewText";

/** The store's own stars (GET /store/:ws `reviews.storeRating`), or null while no counted review exists. */
export function storeRatingOf(store: Pick<StorefrontMeta, "reviews"> | null | undefined): (StorefrontRatingSummary & { average: number }) | null {
  const rating = store?.reviews?.storeRating;
  if (!rating || !(rating.count > 0) || typeof rating.average !== "number") return null;
  return rating as StorefrontRatingSummary & { average: number };
}

/**
 * The store's rating in its footer — stars, the average and how many
 * reviews — linking to the store's reviews page. Nothing while the store has
 * no counted review. The stars take `starClass` (the footer's own colour when
 * it is left out, for a footer with colours of its own).
 */
export function StoreRatingBadge({
  store,
  locale,
  className = "",
  starClass = "",
}: {
  store: Pick<StorefrontMeta, "reviews">;
  locale: Locale;
  className?: string;
  starClass?: string;
}) {
  const rating = storeRatingOf(store);
  if (!rating) return null;
  const text = pickText(REVIEW_TEXT, locale);
  const average = rating.average.toFixed(1);
  const full = Math.max(0, Math.min(5, Math.round(rating.average)));
  return (
    <StoreLink
      href={STORE_REVIEWS_PATH}
      aria-label={text.badgeLabel(average, rating.count)}
      data-store-rating=""
      // A footer may underline its links; stars are not words.
      style={{ textDecoration: "none" }}
      className={`inline-flex min-h-11 items-center gap-1.5 lg:min-h-9 ${className}`.trimEnd()}
    >
      <span aria-hidden dir="ltr" className={`text-base leading-none tracking-tight ${starClass}`.trimEnd()}>
        {"★".repeat(full)}
        <span className="opacity-35">{"★".repeat(5 - full)}</span>
      </span>
      <span aria-hidden dir="ltr" className="font-semibold">
        {average}
      </span>
      <span aria-hidden>{text.count(rating.count)}</span>
    </StoreLink>
  );
}
