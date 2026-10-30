"use client";

import { useId } from "react";
import type { StorefrontExternalReview } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { card } from "../ui";
import { Stars } from "./ReviewBits";
import { REVIEW_TEXT, type ReviewText } from "./reviewText";

/**
 * Reviews the merchant brought from other sites (Facebook, Google, …): their
 * own block, apart from the shoppers' reviews, each saying where it came from
 * and linking to the original when the merchant gave its address. They are
 * never "verified" and never count in the stars, so nothing here touches
 * RatingSummary. Nothing at all while there are none.
 */

/** Where it came from, as the badge says it. */
export function externalSourceText(review: Pick<StorefrontExternalReview, "source" | "sourceLabel">, text: ReviewText): string {
  switch (review.source) {
    case "facebook":
      return text.fromFacebook;
    case "google":
      return text.fromGoogle;
    case "instagram":
      return text.fromInstagram;
    case "whatsapp":
      return text.fromWhatsapp;
    default: {
      const label = typeof review.sourceLabel === "string" ? review.sourceLabel.trim() : "";
      return label ? text.fromSite(label) : text.fromOther;
    }
  }
}

/** Only a web address opens; anything else the merchant typed is left as plain text. */
const webUrl = (url: unknown): string | null => (typeof url === "string" && /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : null);

/** "YYYY-MM-DD" as that calendar day (not shifted by the time zone), else an ISO time. */
function dayOf(value: string | null | undefined): Date | null {
  if (!value) return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ExternalReviews({
  reviews,
  headingLevel = "h3",
  className = "",
}: {
  reviews: StorefrontExternalReview[] | null | undefined;
  /** The heading's level in the page around it. */
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const { locale, intlLocale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  const uid = useId();
  const list = Array.isArray(reviews) ? reviews : [];
  if (list.length === 0) return null;
  const Heading = headingLevel;
  const date = (review: StorefrontExternalReview) => {
    const d = dayOf(review.reviewedAt) ?? dayOf(review.createdAt);
    return d ? d.toLocaleDateString(intlLocale, { year: "numeric", month: "short", day: "numeric" }) : "";
  };

  return (
    <section aria-labelledby={`${uid}-title`} data-external-reviews="" className={className || undefined}>
      <Heading id={`${uid}-title`} className="text-lg font-semibold text-ink">
        {text.externalTitle}
      </Heading>
      <p className="mt-1 text-sm text-ink-soft">{text.externalHint}</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {list.map((review) => {
          const source = externalSourceText(review, text);
          const url = webUrl(review.url);
          const photos = Array.isArray(review.photos) ? review.photos : [];
          return (
            <li key={review.id} className={`${card} space-y-3 p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    <bdi>{review.authorName || text.anonymous}</bdi>
                  </span>
                  <span data-review-source={review.source} className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs font-medium text-ink-soft">
                    <bdi>{source}</bdi>
                  </span>
                </div>
                <span className="text-xs text-ink-soft">{date(review)}</span>
              </div>
              <Stars rating={review.rating} label={text.stars(review.rating)} />
              {/* Null when the store published the stars alone. */}
              {typeof review.comment === "string" && review.comment.trim() !== "" && (
                <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-ink">
                  {review.comment}
                </p>
              )}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((photo) => (
                    <a key={photo} href={photo} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={text.photoAlt} loading="lazy" className="h-20 w-20 rounded-xl border border-line object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  aria-label={text.seeOriginalLabel(source)}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline lg:min-h-9"
                >
                  {text.seeOriginal}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
