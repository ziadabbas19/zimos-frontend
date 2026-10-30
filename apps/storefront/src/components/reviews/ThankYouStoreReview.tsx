"use client";

import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { card } from "../ui";
import { ReviewForm, useReviewsOpen } from "./ReviewForm";
import { REVIEW_TEXT } from "./reviewText";

/**
 * A short review of the store on the thank-you page: stars and a few words,
 * with the phone the order was placed with already filled in, so the review
 * goes with this shopper's orders. Only while the store takes reviews.
 */
export function ThankYouStoreReview({ workspaceId, phone }: { workspaceId: string; phone: string }) {
  const { locale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  const open = useReviewsOpen();
  if (!open) return null;
  return (
    <div className={`${card} mt-8 p-5 sm:p-6`}>
      <ReviewForm workspaceId={workspaceId} defaultPhone={phone} compact title={text.compactTitle} headingLevel="h2" />
    </div>
  );
}
