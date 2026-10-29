"use client";

import { useState } from "react";
import type { StorefrontRatingSummary, StorefrontReview } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { btnSecondary, card } from "../ui";
import { RatingSummary, ReviewCards } from "./ReviewBits";
import { ReviewForm, useReviewLinkToken, useReviewsOpen } from "./ReviewForm";
import { REVIEW_TEXT } from "./reviewText";

/**
 * The store reviews page's body: the store's stars, its published reviews,
 * and — while the store takes reviews — the form to review the store.
 */
export function StoreReviews({
  workspaceId,
  rating,
  reviews,
}: {
  workspaceId: string;
  rating: StorefrontRatingSummary;
  reviews: StorefrontReview[];
}) {
  const { locale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  const open = useReviewsOpen();
  // A review request may link here too: the review is then tied to that order.
  const orderToken = useReviewLinkToken();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);
  const formShown = open && (sent || (chosen ?? Boolean(orderToken)));
  const hasStars = rating.count > 0 && rating.average !== null;

  return (
    <div className="mt-6 space-y-6">
      {open && !formShown && (
        <button type="button" onClick={() => setChosen(true)} className={btnSecondary}>
          {text.writeStore}
        </button>
      )}
      {formShown && (
        <ReviewForm
          workspaceId={workspaceId}
          orderToken={orderToken || undefined}
          headingLevel="h2"
          onSent={() => setSent(true)}
          onCancel={() => setChosen(false)}
        />
      )}

      {hasStars && <RatingSummary rating={rating} />}

      {reviews.length > 0 ? (
        <ReviewCards reviews={reviews} />
      ) : (
        !hasStars && (
          <p className={`${card} p-5 text-sm text-ink-soft`}>
            {text.storeNone}
            {open && ` ${text.storeBeFirst}`}
          </p>
        )
      )}
    </div>
  );
}
