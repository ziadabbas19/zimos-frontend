import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { storefrontExternalReviews, storefrontProductReviews, storefrontStoreReviews } from "@store-builder/api-client";
import { StoreReviews } from "@/components/reviews/StoreReviews";
import { REVIEW_TEXT, STORE_REVIEWS_PATH } from "@/components/reviews/reviewText";
import { container } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string }>;

/**
 * The store's published reviews and its stars (GET /store/:ws/store-reviews),
 * once per request. Read the same way as a product's
 * (storefrontProductReviews), tolerating missing fields, with the reviews
 * the merchant brought from other sites apart; null when the API does not
 * answer.
 */
const getStoreReviews = cache(async (workspaceId: string) => {
  const client = await createServerStorefrontApiClient();
  try {
    const answer = await storefrontStoreReviews(client, workspaceId);
    return { ...storefrontProductReviews(answer), externalReviews: storefrontExternalReviews(answer) };
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};
  const text = pickText(REVIEW_TEXT, await getStoreLocale(store));
  return { title: text.storeTitle, description: text.storeIntro(store.name), alternates: { canonical: STORE_REVIEWS_PATH } };
}

/**
 * The store's reviews page (`/store-reviews`), linked from the stars in the
 * footer: what customers said about the store, and the form to say it while
 * the store takes reviews. An API without store reviews has no such page.
 */
export default async function StoreReviewsPage({ params }: { params: Params }) {
  const { workspaceId } = await params;
  const [store, found] = await Promise.all([getStoreMeta(workspaceId), getStoreReviews(workspaceId)]);
  if (!store) notFound();
  if (!found && !store.reviews) notFound();
  const text = pickText(REVIEW_TEXT, await getStoreLocale(store));
  // The page's own read first; the store's stars from its details when that read failed.
  const rating = found?.rating ?? store.reviews?.storeRating ?? { average: null, count: 0, distribution: {} };
  const reviews = found?.reviews ?? [];
  const externalReviews = found?.externalReviews ?? [];

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{text.storeTitle}</h1>
        <p className="mt-2 text-sm text-ink-soft">{text.storeIntro(store.name)}</p>
        <StoreReviews workspaceId={workspaceId} rating={rating} reviews={reviews} externalReviews={externalReviews} />
      </div>
    </main>
  );
}
