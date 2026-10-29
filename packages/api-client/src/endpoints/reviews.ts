/**
 * Product and store reviews (backend: src/modules/reviews).
 *
 * Staff, under /workspaces/:workspaceId/reviews (products.manage):
 *   the list with each reviewer and whether they bought, the counts by status
 *   (the sidebar's "waiting" badge), approve (with the text or the stars
 *   alone), hide, delete. A customer's phone and e-mail come only to someone
 *   with customers.view.
 *
 * Storefront, no auth: sending a product or store review (closed unless the
 * server's REVIEWS_PUBLIC_SUBMISSION_ENABLED; `store.reviews.open` says so),
 * and the store's published reviews with its stars. Every review waits for
 * the merchant; the stars count published reviews from delivered orders only.
 *
 * All exported names here start with `reviews` / `Review` or `storefront…Review`.
 *
 * Notable codes: ALREADY_REVIEWED (409, the same phone or device already
 * reviewed this product / the store), INVALID_PHONE (422), INVALID_PHOTOS
 * (422, a photo expired or was uploaded by another visitor), TOO_MANY_PHOTOS
 * (422), TOO_MANY_REQUESTS (429).
 */
import type { ApiClient } from "../client";
import type { Review, ReviewListParams, ReviewStatus } from "../types";
import type { ManualReviewPayload, StorefrontExternalReview, StorefrontRatingSummary, StorefrontReview } from "./catalog";

// ------------------------------------------------------------------ staff --

/** approve = publish with the text and photos; approve_stars = the stars alone; hide (reject is the older name). */
export type ReviewAction = "approve" | "approve_stars" | "hide" | "reject";

export type ReviewCounts = Record<ReviewStatus, number>;

export interface ReviewsPage {
  reviews: Review[];
  /** Reviews matching the filter (all of them when no limit was asked). */
  total: number;
  counts: ReviewCounts;
}

export async function reviewsListPage(client: ApiClient, workspaceId: string, params: ReviewListParams = {}): Promise<ReviewsPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  const qs = query.toString();
  const res = await client.request<Partial<ReviewsPage>>(`/workspaces/${workspaceId}/reviews${qs ? `?${qs}` : ""}`);
  return {
    reviews: res.reviews ?? [],
    total: res.total ?? (res.reviews ?? []).length,
    counts: { pending: 0, approved: 0, rejected: 0, ...res.counts },
  };
}

/** How many reviews wait, are published, are hidden. */
export async function reviewsSummary(client: ApiClient, workspaceId: string): Promise<ReviewCounts> {
  const { counts } = await client.request<{ counts: ReviewCounts }>(`/workspaces/${workspaceId}/reviews/summary`);
  return counts;
}

export async function reviewsModerate(client: ApiClient, workspaceId: string, reviewId: string, action: ReviewAction): Promise<Review> {
  const { review } = await client.request<{ review: Review }>(`/workspaces/${workspaceId}/reviews/${reviewId}`, {
    method: "PATCH",
    body: { action },
  });
  return review;
}

/**
 * Edits a review the merchant added (by hand, imported or from another site);
 * giving a hand-added one a source makes it external. 409 REVIEW_NOT_EDITABLE
 * for a shopper's own review.
 */
export async function reviewsUpdateContent(
  client: ApiClient,
  workspaceId: string,
  reviewId: string,
  payload: Partial<Omit<ManualReviewPayload, "status">>
): Promise<Review> {
  const { review } = await client.request<{ review: Review }>(`/workspaces/${workspaceId}/reviews/${reviewId}/content`, {
    method: "PATCH",
    body: payload,
  });
  return review;
}

/** Deletes any review (a shopper's photos with it). */
export async function reviewsDelete(client: ApiClient, workspaceId: string, reviewId: string): Promise<void> {
  await client.request(`/workspaces/${workspaceId}/reviews/${reviewId}`, { method: "DELETE" });
}

// ------------------------------------------------------------- storefront --

/** What the storefront knows about reviews from the store itself (`store.reviews`). */
export interface StorefrontReviewsInfo {
  /** Shoppers may send reviews now. */
  open: boolean;
  storeRating: StorefrontRatingSummary;
}

export interface StorefrontReviewInput {
  rating: number;
  /** Required unless `orderToken` names the order. */
  phone?: string;
  name?: string;
  comment?: string;
  /** Uploaded first (uploadCustomerPhoto) by the same visitor; at most 4. */
  photoUploadIds?: string[];
  /** An order's signed link (`?review=` in the store's review request), linking the review to that order. */
  orderToken?: string;
  /** The storefront's device id, for "one review per device". */
  deviceId?: string;
}

export interface StorefrontReviewReceipt {
  received: boolean;
  status: "pending";
  id: string;
}

const visitorHeader = (visitorId?: string) => (visitorId ? { headers: { "X-Visitor-Id": visitorId } } : {});

/** A shopper's product review. It waits for the merchant. */
export async function storefrontSendProductReview(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  input: StorefrontReviewInput,
  visitorId?: string
): Promise<StorefrontReviewReceipt> {
  const { review } = await client.request<{ review: StorefrontReviewReceipt }>(`/store/${workspaceId}/products/${productId}/reviews`, {
    method: "POST",
    body: input,
    auth: false,
    ...visitorHeader(visitorId),
  });
  return review;
}

/** A shopper's review of the whole store. It waits for the merchant. */
export async function storefrontSendStoreReview(
  client: ApiClient,
  workspaceId: string,
  input: StorefrontReviewInput,
  visitorId?: string
): Promise<StorefrontReviewReceipt> {
  const { review } = await client.request<{ review: StorefrontReviewReceipt }>(`/store/${workspaceId}/store-reviews`, {
    method: "POST",
    body: input,
    auth: false,
    ...visitorHeader(visitorId),
  });
  return review;
}

/** The store's stars, its latest published store reviews, and those brought from other sites (apart). */
export async function storefrontStoreReviews(
  client: ApiClient,
  workspaceId: string
): Promise<{ rating: StorefrontRatingSummary; reviews: StorefrontReview[]; externalReviews: StorefrontExternalReview[] }> {
  const answer = await client.request<{ rating: StorefrontRatingSummary; reviews: StorefrontReview[]; externalReviews?: StorefrontExternalReview[] }>(
    `/store/${workspaceId}/store-reviews`,
    { auth: false }
  );
  return { ...answer, externalReviews: answer.externalReviews ?? [] };
}
