"use client";

import { useEffect, useState } from "react";
import {
  storefrontCouponPreview,
  type ApiClient,
  type FreeShippingProgress,
  type StorefrontCouponPreview,
  type StorefrontQuoteExtras,
} from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { pickText } from "@/lib/i18n";
import { couponRefusalMessage } from "@/lib/couponRefusals";

/*
 * The shopper's side of coupons and order rules (SPEC §10.5–10.6): a
 * `?coupon=CODE` link is remembered and applied at checkout, the automatic
 * discount and the store's minimum order are shown from the server's quote,
 * and the free-shipping hint gets its progress bar. Every amount is the
 * server's.
 */

const TEXT = {
  en: {
    automatic: "Discount",
    coupon: (code: string) => `Coupon ${code}`,
    couponInvalid: (code: string) => `Coupon ${code} doesn't apply to this order.`,
    minimum: (min: string, left: string) => `The minimum order is ${min}. Add ${left} more to order.`,
    freeShippingProgress: "Progress to free shipping",
  },
  ar: {
    automatic: "خصم",
    coupon: (code: string) => `كوبون ${code}`,
    couponInvalid: (code: string) => `الكوبون ${code} لا ينطبق على هذا الطلب.`,
    minimum: (min: string, left: string) => `الحد الأدنى للطلب ${min}. أضف ${left} لإتمام الطلب.`,
    freeShippingProgress: "التقدم نحو الشحن المجاني",
  },
};

const KEY = (workspaceId: string) => `zimos.coupon.${workspaceId}`;
const CODE = /^[A-Za-z0-9_-]{1,100}$/;

export function readStoredCoupon(workspaceId: string): string {
  try {
    const code = localStorage.getItem(KEY(workspaceId)) ?? "";
    return CODE.test(code) ? code : "";
  } catch {
    return "";
  }
}

export function clearStoredCoupon(workspaceId: string) {
  try {
    localStorage.removeItem(KEY(workspaceId));
  } catch {
    /* nothing stored */
  }
}

/** Remembers the code of a `?coupon=CODE` link, on any page of the store. Renders nothing. */
export function CouponFromLink({ workspaceId }: { workspaceId: string }) {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("coupon")?.trim().toUpperCase();
    if (!code || !CODE.test(code)) return;
    try {
      localStorage.setItem(KEY(workspaceId), code);
    } catch {
      /* private mode: the shopper can still type it */
    }
  }, [workspaceId]);
  return null;
}

/** The remembered coupon, read once the page is in the browser ("" until then, and when there is none). */
export function useStoredCoupon(workspaceId: string): string {
  const [code, setCode] = useState("");
  useEffect(() => {
    // After CouponFromLink's own effect on a first landing with ?coupon=.
    const timer = window.setTimeout(() => setCode(readStoredCoupon(workspaceId)), 0);
    return () => window.clearTimeout(timer);
  }, [workspaceId]);
  return code;
}

/**
 * What the remembered coupon takes off these lines, from the server. Null
 * while there is no code or no answer yet; `valid: false` when the code does
 * not apply — the caller then leaves it off the order instead of failing it.
 */
export function useCouponPreview(
  client: ApiClient,
  workspaceId: string,
  code: string,
  lines: { variantId: string; offerId?: string; quantity: number }[],
  /** In a funnel's checkout: its funnel-limited codes apply. */
  funnelId?: string
): StorefrontCouponPreview | null {
  const items = lines.filter((l) => l.quantity > 0).map((l) => ({ variantId: l.variantId, ...(l.offerId ? { offerId: l.offerId } : {}), quantity: l.quantity }));
  const key = code && items.length > 0 ? JSON.stringify([code, items]) : "";
  const [state, setState] = useState<{ key: string; preview: StorefrontCouponPreview } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const [couponCode, couponItems] = JSON.parse(key) as [string, typeof items];
      // A product A/B test prices the lines for this visitor (lib/productTest).
      storefrontCouponPreview(client, workspaceId, couponCode, couponItems, { visitorId: getVisitorId(workspaceId), funnelId })
        .then((preview) => {
          if (!cancelled) setState({ key, preview });
        })
        .catch(() => {
          /* no preview: the code is simply not sent */
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, client, workspaceId, funnelId]);

  return key && state && state.key === key ? state.preview : null;
}

/** What comes off the total: the coupon when one applies, else the store's automatic discount. */
export function discountOff(extras: StorefrontQuoteExtras, coupon: StorefrontCouponPreview | null): number {
  if (coupon?.valid) return coupon.amount;
  return extras.automaticDiscount?.amount ?? 0;
}

/** The discount row(s) of an order summary `<dl>`. */
export function DiscountRows({
  extras,
  coupon,
  currency,
}: {
  extras: StorefrontQuoteExtras;
  coupon: StorefrontCouponPreview | null;
  currency?: string;
}) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  if (coupon?.valid) {
    return (
      <div className="flex justify-between gap-3 text-success">
        <dt>{text.coupon(coupon.code)}</dt>
        <dd className="shrink-0">{coupon.amount > 0 ? `−${money(coupon.amount, currency)}` : "✓"}</dd>
      </div>
    );
  }
  return (
    <>
      {coupon && !coupon.valid && (
        <div className="text-xs text-ink-soft">
          <dt className="sr-only">{text.coupon(coupon.code)}</dt>
          {/* Why, when the server said (lib/couponRefusals); the generic line for a reason this store does not know. */}
          <dd>
            {couponRefusalMessage(coupon.reason, coupon.details, { locale, money: (n) => money(n, currency) }) ?? text.couponInvalid(coupon.code)}
          </dd>
        </div>
      )}
      {extras.automaticDiscount && (
        <div className="flex justify-between gap-3 text-success">
          <dt>{text.automatic}</dt>
          <dd className="shrink-0">−{money(extras.automaticDiscount.amount, currency)}</dd>
        </div>
      )}
    </>
  );
}

/** Says how much more to add when the order is below the store's minimum. */
export function MinimumOrderNotice({ extras, currency, className = "" }: { extras: StorefrontQuoteExtras; currency?: string; className?: string }) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const minimum = extras.minimumOrder;
  if (!minimum || minimum.met) return null;
  return (
    <p role="status" className={`rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger ${className}`}>
      {text.minimum(money(minimum.amount, currency), money(minimum.remainingAmount, currency))}
    </p>
  );
}

/** The bar under "you're X away from free shipping". */
export function FreeShippingBar({ progress }: { progress: FreeShippingProgress | null }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  if (!progress || progress.thresholdAmount <= 0) return null;
  const done = progress.qualified ? 100 : Math.max(4, Math.min(100, Math.round(((progress.thresholdAmount - progress.remainingAmount) / progress.thresholdAmount) * 100)));
  return (
    <span
      role="progressbar"
      aria-label={text.freeShippingProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={done}
      className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-raised"
    >
      <span className="block h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${done}%` }} />
    </span>
  );
}
