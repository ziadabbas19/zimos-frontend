"use client";

import { useState } from "react";
import { type StorefrontExternalReview, type StorefrontRatingSummary, type StorefrontReview } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { ExternalReviews } from "../reviews/ExternalReviews";
import { RatingSummary, ReviewCards } from "../reviews/ReviewBits";
import { ReviewForm, useReviewLinkToken, useReviewsOpen } from "../reviews/ReviewForm";
import { REVIEW_TEXT } from "../reviews/reviewText";
import { btnSecondary } from "../ui";

/**
 * Reviews on the product page (SPEC §7.7): the average and how the stars
 * split, the published reviews with their photos, and — while the store takes
 * reviews (`store.reviews.open`) — the form. Anyone may send stars and a few
 * words; the stars count only reviews from delivered orders, and every review
 * waits for the merchant, so nothing here is ever invented or shown
 * unmoderated.
 *
 * The store's review request links here as `?review=<token>#reviews`: the
 * form then opens by itself and the review is tied to that order.
 *
 * Reviews the merchant brought from other sites follow in their own block
 * (ExternalReviews): never verified, never in the stars.
 */

export function ProductReviews({
  workspaceId,
  productId,
  rating,
  reviews,
  externalReviews = [],
  formOnly = false,
}: {
  workspaceId: string;
  productId: string;
  rating: StorefrontRatingSummary;
  reviews: StorefrontReview[];
  /** Brought from other sites (storefrontExternalReviews): shown apart, after the shoppers' reviews. */
  externalReviews?: StorefrontExternalReview[];
  /** The builder's review_form element: the form alone, and nothing while the store takes no reviews. */
  formOnly?: boolean;
}) {
  const { locale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  const open = useReviewsOpen();
  const orderToken = useReviewLinkToken();
  // Opened by the button, or by the store's review link; null until the shopper chooses.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);
  const formShown = open && (sent || (chosen ?? Boolean(orderToken)));

  if (formOnly) {
    if (!open) return null;
    return <ReviewForm workspaceId={workspaceId} productId={productId} orderToken={orderToken || undefined} />;
  }

  const hasStars = rating.count > 0 && rating.average !== null;

  return (
    <section id="reviews" aria-labelledby="product-reviews-title" className="mt-12 scroll-mt-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="product-reviews-title" className="text-xl font-semibold text-ink">
          {text.title}
        </h2>
        {open && !formShown && (
          <button type="button" onClick={() => setChosen(true)} className={btnSecondary}>
            {text.write}
          </button>
        )}
      </div>

      {formShown && (
        <div className="mt-4">
          <ReviewForm
            workspaceId={workspaceId}
            productId={productId}
            orderToken={orderToken || undefined}
            onSent={() => setSent(true)}
            onCancel={() => setChosen(false)}
          />
        </div>
      )}

      {hasStars ? (
        <div className="mt-4">
          <RatingSummary rating={rating} />
        </div>
      ) : (
        reviews.length === 0 &&
        // With reviews from other sites below, not "no reviews yet": only the invitation, while open.
        (externalReviews.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            {text.none}
            {open && ` ${text.beFirst}`}
          </p>
        ) : (
          open && <p className="mt-4 text-sm text-ink-soft">{text.beFirst}</p>
        ))
      )}

      {reviews.length > 0 && (
        <div className="mt-4">
          <ReviewCards reviews={reviews} />
        </div>
      )}

      <ExternalReviews reviews={externalReviews} className="mt-8" />
    </section>
  );
}
