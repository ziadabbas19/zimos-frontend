"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckIcon, CopyIcon, ShareIcon, WhatsAppIcon } from "@/components/Icons";
import { ConfirmationHeading, OrderSnapshotSummary } from "@/components/OrderConfirmation";
import { StatusTimeline } from "@/components/StatusTimeline";
import { ThankYouMessage, ThankYouProducts } from "@/components/ThankYouExtras";
import { formOptionsOf } from "@/lib/orderForm";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, container } from "@/components/ui";
import { whatsappNumber } from "@/lib/egypt";
import {
  getOrderSnapshot,
  type OrderSnapshot,
} from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { ThankYouUpsell, CrossSellStrip } from "@/components/offers/StoreOffers";
import { ThankYouDownloads } from "@/components/ThankYouDownloads";
import { ThankYouStoreReview } from "@/components/reviews/ThankYouStoreReview";
import { ManualPaymentStatus } from "@/components/checkout/ManualPayment";
import { GiftCardPaidNote } from "@/components/giftCards/GiftCardPaidNote";
import { GIFT_CARDS_ENABLED } from "@/lib/features";
import { trackPurchaseOnce } from "@/lib/track";
import { useIsClient } from "@/lib/useIsClient";
import { StorePageLoader } from "@/components/StoreLoader";

function Confirmation() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const basePath = useStoreBasePath();
  const { t, money, store } = useStore();

  const [copied, setCopied] = useState(false);

  // Read on this device only once hydrated (localStorage), so SSR and
  // hydration agree.
  const isClient = useIsClient();
  const snapshot = useMemo<OrderSnapshot | null>(
    () => (isClient ? getOrderSnapshot(workspaceId, orderId) : null),
    [isClient, workspaceId, orderId]
  );
  // The store’s shareable address: its own origin on a subdomain, the
  // /store/<workspaceId> path on the shared host.
  const storeUrl = isClient ? `${window.location.origin}${storeHref(basePath, "/")}` : "";
  const canShare = isClient && typeof navigator.share === "function";

  // Purchase, once per order on this device (trackPurchaseOnce remembers it),
  // as soon as the saved order is readable. A device with no snapshot has
  // nothing to value the order with, so it sends nothing rather than a zero.
  // The ref keeps this to one call even when storage is blocked.
  const purchaseTracked = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot || purchaseTracked.current === snapshot.id) return;
    purchaseTracked.current = snapshot.id;
    trackPurchaseOnce(snapshot.id, {
      valueMinor: snapshot.totalAmount,
      currency: snapshot.currency,
      contentIds: snapshot.contentIds ?? snapshot.productIds,
      numItems: snapshot.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }, [snapshot]);

  const orderNumber = snapshot?.orderNumber ?? search.get("number");
  const currency = snapshot?.currency ?? store?.currency;
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const storeName = store?.name ?? "";
  // The merchant's thank-you settings: their message, the back-home button
  // and a few products from a collection of their choosing.
  const thanks = store?.thankYou;
  const shortMessage = formOptionsOf(store?.checkout).thank_you_message;
  const showBackHome = !thanks?.enabled || thanks.show_back_home_button;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: storeName, text: t.thankYou.shareText(storeName), url: storeUrl });
    } catch {
      /* dismissed */
    }
  }

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <div className="mx-auto max-w-2xl">
        <ConfirmationHeading orderNumber={orderNumber} phone={snapshot?.phone} />
        {snapshot?.etaMinutes ? <p className="mt-3 text-center text-sm text-ink-soft">{t.checkout.eta(snapshot.etaMinutes)}</p> : null}
        {shortMessage && <p className="mt-4 text-center text-sm font-medium text-ink">{shortMessage}</p>}
        {thanks && (
          <ThankYouMessage page={thanks} orderNumber={orderNumber} customerName={snapshot?.customerName ?? null} />
        )}

        {/* The store's post-purchase offer (Offers → Post-purchase upsell): one tap adds it to this order. */}
        <ThankYouUpsell workspaceId={workspaceId} orderId={orderId} orderNumber={orderNumber} />

        {/* Paid by InstaPay / a wallet: where to pay, the proof's status, and the form while one may be sent. */}
        <ManualPaymentStatus workspaceId={workspaceId} orderId={orderId} />

        {/* A paid online order's digital products, as soon as the payment is captured. */}
        <ThankYouDownloads workspaceId={workspaceId} orderId={orderId} />

        {/* Notifications about this order on this phone, when the store app is on. */}

        {/* What goes with what they just bought (Offers → Cross-sell, on the thank-you page). */}
        {snapshot && snapshot.productIds.length > 0 && <CrossSellStrip workspaceId={workspaceId} placement="thank_you" productIds={snapshot.productIds} />}

        <section className={`${card} mt-8 p-5 sm:p-6`} aria-labelledby="next-title">
          <h2 id="next-title" className="mb-5 text-lg font-semibold text-ink">
            {t.thankYou.steps}
          </h2>
          <StatusTimeline stage={1} />
        </section>

        {snapshot && (
          <div className="mt-6">
            <OrderSnapshotSummary snapshot={snapshot} currency={currency} />
          </div>
        )}
        {/* What a gift card paid on this order and what is left on delivery; only while gift cards are on (lib/features). */}
        {GIFT_CARDS_ENABLED && <GiftCardPaidNote workspaceId={workspaceId} orderId={orderId} />}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(
                t.thankYou.whatsappMessage(storeName, orderNumber ?? "")
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnPrimary} sm:col-span-2`}
            >
              <WhatsAppIcon />
              {t.thankYou.whatsapp}
            </a>
          )}
          <StoreLink href="/track" className={btnSecondary}>
            {t.thankYou.track}
          </StoreLink>
          {showBackHome && (
            <StoreLink href="/" className={btnSecondary}>
              {t.thankYou.backToStore}
            </StoreLink>
          )}
        </div>

        {/* A short review of the store while it takes reviews, with this order's phone filled in;
            drawn once the saved order is readable, so the phone is there from the start. */}
        {isClient && <ThankYouStoreReview workspaceId={workspaceId} phone={snapshot?.phone ?? ""} />}

        {thanks?.enabled && thanks.show_products_from_collection_id && (
          <ThankYouProducts workspaceId={workspaceId} collectionId={thanks.show_products_from_collection_id} />
        )}

        {storeUrl && (
          <section className="mt-8 text-center" aria-labelledby="share-title">
            <h2 id="share-title" className="text-sm font-semibold text-ink">
              {t.thankYou.share}
            </h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${t.thankYou.shareText(storeName)} ${storeUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                <WhatsAppIcon size={18} />
                {t.thankYou.shareWhatsapp}
              </a>
              <button type="button" onClick={copyLink} className={btnSecondary}>
                {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                <span aria-live="polite">{copied ? t.thankYou.copied : t.thankYou.copyLink}</span>
              </button>
              {canShare && (
                <button type="button" onClick={nativeShare} className={btnSecondary}>
                  <ShareIcon size={18} />
                  {t.thankYou.shareNative}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<StorePageLoader />}>
      <Confirmation />
    </Suspense>
  );
}
