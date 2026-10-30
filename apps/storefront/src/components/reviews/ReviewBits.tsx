"use client";

import type { StorefrontRatingSummary, StorefrontReview } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { card } from "../ui";
import { REVIEW_TEXT } from "./reviewText";

/**
 * How reviews are shown, for a product and for the store alike: the stars,
 * the average with how the stars split, and the published reviews. Only what
 * the server published is drawn: the text when it was published with it, the
 * photos, and "verified" only when the reviewer's order was delivered.
 */

export function Stars({ rating, label, size = "text-base" }: { rating: number; label: string; size?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span role="img" aria-label={label} dir="ltr" className={`${size} leading-none tracking-tight text-primary`}>
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(5 - full)}</span>
    </span>
  );
}

/** The average, its stars and the 5→1 bars; nothing while no counted review exists. */
export function RatingSummary({ rating }: { rating: StorefrontRatingSummary }) {
  const { locale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  if (rating.count <= 0 || rating.average === null) return null;
  return (
    <div className={`${card} grid gap-5 p-5 sm:grid-cols-[12rem_1fr] sm:items-center`}>
      <div className="text-center">
        <p className="text-4xl font-bold text-ink" dir="ltr">
          {rating.average.toFixed(1)}
        </p>
        <Stars rating={rating.average} label={text.stars(Number(rating.average.toFixed(1)))} size="text-xl" />
        <p className="mt-1 text-sm text-ink-soft">{text.basedOn(rating.count)}</p>
      </div>
      <ul className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = rating.distribution[String(n)] ?? 0;
          const pct = rating.count ? Math.round((count / rating.count) * 100) : 0;
          return (
            <li key={n} className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="w-8 shrink-0 tabular-nums" dir="ltr">
                {n} ★
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 shrink-0 text-end tabular-nums">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The published reviews as cards. */
export function ReviewCards({ reviews }: { reviews: StorefrontReview[] }) {
  const { locale, intlLocale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  if (reviews.length === 0) return null;
  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(intlLocale, { year: "numeric", month: "short", day: "numeric" });
  };
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {reviews.map((review) => (
        <li key={review.id} className={`${card} space-y-3 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">
                <bdi>{review.authorName || text.anonymous}</bdi>
              </span>
              {review.verified && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">✓ {text.verified}</span>
              )}
            </div>
            <span className="text-xs text-ink-soft">{date(review.createdAt)}</span>
          </div>
          <Stars rating={review.rating} label={text.stars(review.rating)} />
          {/* Null when the store published the stars alone. */}
          {review.comment !== null && review.comment.trim() !== "" && (
            <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-ink">
              {review.comment}
            </p>
          )}
          {review.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {review.photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={text.photoAlt} loading="lazy" className="h-20 w-20 rounded-xl border border-line object-cover" />
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
