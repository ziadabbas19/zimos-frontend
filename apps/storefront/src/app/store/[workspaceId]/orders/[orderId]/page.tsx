"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckIcon, CopyIcon, ShareIcon, WhatsAppIcon } from "@/components/Icons";
import { ConfirmationHeading, OrderSnapshotSummary } from "@/components/OrderConfirmation";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, container } from "@/components/ui";
import { whatsappNumber } from "@/lib/egypt";
import {
  getAcceptedUpsell,
  getOrderSnapshot,
  type AcceptedUpsell,
  type OrderSnapshot,
} from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { useIsClient } from "@/lib/useIsClient";

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
  const upsell = useMemo<AcceptedUpsell | null>(
    () => (isClient ? getAcceptedUpsell(workspaceId, orderId) : null),
    [isClient, workspaceId, orderId]
  );
  // The store’s shareable address: its own origin on a subdomain, the
  // /store/<workspaceId> path on the shared host.
  const storeUrl = isClient ? `${window.location.origin}${storeHref(basePath, "/")}` : "";
  const canShare = isClient && typeof navigator.share === "function";

  const orderNumber = snapshot?.orderNumber ?? search.get("number");
  const currency = snapshot?.currency ?? store?.currency;
  const wa = store?.phone ? whatsappNumber(store.phone) : null;
  const storeName = store?.name ?? "";

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

        {upsell && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-sm" role="status">
            <p className="font-semibold text-primary">
              {t.upsell.accepted(upsell.name)} — {money(upsell.offerAmount, currency)}
            </p>
            <p className="mt-0.5 text-ink-soft">{t.upsell.acceptedHint}</p>
          </div>
        )}

        <section className={`${card} mt-8 p-5 sm:p-6`} aria-labelledby="next-title">
          <h2 id="next-title" className="mb-5 text-lg font-semibold text-ink">
            {t.thankYou.steps}
          </h2>
          <StatusTimeline stage={1} />
        </section>

        {snapshot && (
          <div className="mt-6">
            <OrderSnapshotSummary
              snapshot={snapshot}
              currency={currency}
              footnote={upsell ? t.checkout.finalNote : undefined}
            />
          </div>
        )}

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
          <StoreLink href="/" className={btnSecondary}>
            {t.thankYou.backToStore}
          </StoreLink>
        </div>

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
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-center text-sm text-ink-soft">…</main>}>
      <Confirmation />
    </Suspense>
  );
}
