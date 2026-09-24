"use client";

import { Suspense, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BoxIcon, CheckIcon } from "@/components/Icons";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, card, container } from "@/components/ui";
import {
  acceptUpsell,
  getOrderSnapshot,
  getUpsellOffer,
  type OrderSnapshot,
} from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { useCatalog } from "@/lib/useCatalog";
import { useIsClient } from "@/lib/useIsClient";

/**
 * Parked: nothing links here and the route (page.tsx) redirects to the
 * thank-you page. The offer is invented on the device (25% off another
 * catalogue product) and accepting it never reaches the order, so it stays out
 * of the checkout flow until the backend can append to a placed order.
 *
 * Post-purchase one-click upsell. The order already exists; both answers
 * continue to the thank-you page. Accepting is recorded on this device and
 * confirmed on the merchant’s call — there is no append-to-order endpoint.
 */
function UpsellOfferView() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { t, money } = useStore();
  const { products, loaded } = useCatalog(workspaceId);
  const basePath = useStoreBasePath();

  const isClient = useIsClient();
  const snapshot = useMemo<OrderSnapshot | null>(
    () => (isClient ? getOrderSnapshot(workspaceId, orderId) : null),
    [isClient, workspaceId, orderId]
  );

  const orderNumber = snapshot?.orderNumber ?? search.get("number");
  const offer = useMemo(
    () => (loaded ? getUpsellOffer(products ?? [], snapshot?.productIds ?? []) : null),
    [loaded, products, snapshot]
  );

  const thankYouHref = storeHref(
    basePath,
    `/orders/${orderId}${orderNumber ? `?${new URLSearchParams({ number: orderNumber }).toString()}` : ""}`
  );

  function accept() {
    if (offer) acceptUpsell(workspaceId, orderId, offer);
    router.push(thankYouHref);
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-12`}>
      <div className="mx-auto max-w-2xl">
        <p
          className="flex items-center justify-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-center text-sm font-medium text-success"
          role="status"
        >
          <CheckIcon size={18} />
          <span>
            {t.thankYou.received}
            {orderNumber && (
              <>
                {" "}
                <span dir="ltr" className="font-semibold">
                  #{orderNumber}
                </span>
              </>
            )}
          </span>
        </p>

        <div className={`${card} mt-6 overflow-hidden`}>
          <div className="bg-primary px-5 py-3 text-center text-sm font-semibold text-on-primary">{t.upsell.eyebrow}</div>

          {!offer ? (
            <p className="px-6 py-16 text-center text-sm text-ink-soft" role="status">
              {t.common.loading}
            </p>
          ) : (
            <div className="p-5 sm:p-8">
              <h1 className="text-center text-2xl font-bold text-ink sm:text-3xl">{t.upsell.title}</h1>
              <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">{t.upsell.subtitle}</p>

              <div className="mt-6 grid items-center gap-6 sm:grid-cols-[14rem_1fr]">
                <div className="mx-auto aspect-square w-full max-w-56 overflow-hidden rounded-2xl border border-line bg-paper">
                  {offer.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.imageUrl} alt="" width={224} height={224} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary/40">
                      <BoxIcon size={64} />
                    </div>
                  )}
                </div>
                <div className="text-center sm:text-start">
                  <h2 className="text-xl font-semibold text-ink">{offer.name}</h2>
                  {offer.description && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink-soft">{offer.description}</p>}
                  <p className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3 sm:justify-start">
                    <span className="text-3xl font-bold text-ink">{money(offer.offerAmount, snapshot?.currency)}</span>
                    <span className="text-lg text-ink-soft line-through">{money(offer.regularAmount, snapshot?.currency)}</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-success">
                    {t.upsell.save(money(offer.regularAmount - offer.offerAmount, snapshot?.currency))}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-2">
                <button type="button" onClick={accept} className={btnPrimaryLg}>
                  {t.upsell.yes}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(thankYouHref)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                >
                  {t.upsell.no}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export function UpsellOfferPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-center text-sm text-ink-soft">…</main>}>
      <UpsellOfferView />
    </Suspense>
  );
}
