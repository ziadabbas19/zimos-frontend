"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { lostOrdersRecover } from "@store-builder/api-client";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, card, container, skeleton } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { saveRecoveryPrefill } from "@/lib/recoveryPrefill";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { StoreLoader } from "@/components/StoreLoader";

const COPY = {
  en: {
    loading: "Bringing your order back…",
    goneTitle: "This link is no longer active",
    goneBody: "The order may already be placed, or the link has expired. You can still browse the store.",
    toStore: "Go to the store",
  },
  ar: {
    loading: "بنرجّعلك طلبك…",
    goneTitle: "الرابط ده مبقاش شغال",
    goneBody: "ممكن يكون الطلب اتسجّل بالفعل، أو الرابط انتهى. تقدر تتصفح المتجر عادي.",
    toStore: "روح للمتجر",
  },
};

/**
 * A recovery link: puts the lost order's products back in the cart, hands the
 * form what the shopper had typed, and opens the checkout — with the
 * automation's coupon when the link carries one (SPEC §6.4).
 */
export default function RecoveryPage() {
  const { workspaceId, token } = useParams<{ workspaceId: string; token: string }>();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { addItem } = useCart();
  const { locale } = useStore();
  const t = locale === "ar" ? COPY.ar : COPY.en;
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const recovery = await lostOrdersRecover(createStorefrontApiClient(), workspaceId, token);
        for (const item of recovery.items) {
          // A product that is gone or sold out is skipped; the rest still come back.
          await addItem(item.variantId, item.offerId ?? undefined, item.quantity).catch(() => {});
        }
        saveRecoveryPrefill(workspaceId, recovery);
        // The automation's coupon rides on the link (?coupon=); it wins over a code the shopper had typed.
        const code = new URLSearchParams(window.location.search).get("coupon")?.trim() || recovery.couponCode;
        const coupon = code ? `?coupon=${encodeURIComponent(code)}` : "";
        router.replace(storeHref(basePath, `/checkout${coupon}`));
      } catch {
        setFailed(true);
      }
    })();
  }, [workspaceId, token, basePath, addItem, router]);

  return (
    <div className={`${container} py-16`}>
      <div className={`${card} mx-auto max-w-md p-6 text-center`}>
        {failed ? (
          <>
            <h1 className="font-display text-xl font-bold text-ink">{t.goneTitle}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t.goneBody}</p>
            <StoreLink href="/" className={`${btnPrimary} mt-6`}>
              {t.toStore}
            </StoreLink>
          </>
        ) : (
          <div aria-busy="true">
            <StoreLoader label={t.loading} className="mx-auto" />
            <span className={`${skeleton} mx-auto mt-4 block h-3 w-40`} />
          </div>
        )}
      </div>
    </div>
  );
}
