"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ApiError,
  storefrontAcceptUpsell,
  storefrontCrossSell,
  storefrontExitDownsell,
  storefrontOrderUpsell,
  storefrontProductBumps,
  type ApiClient,
  type CrossSellPlacement,
  type StorefrontExitDownsell,
  type StorefrontProduct,
  type StorefrontProductBump,
  type StorefrontUpsell,
  type StorefrontUpsellAccepted,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { markAddSource } from "@/lib/addSource";
import { orderBumpOf, type OrderBumpOffer } from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { CheckIcon } from "../Icons";
import { ProductCard } from "../ProductCard";
import { btnPrimary, btnSecondary, card } from "../ui";
import { OfferVariantPicker, useOfferProduct } from "./OfferVariantPicker";
import { OfferTimer, useOfferCountdown } from "./OfferTimer";
import { trackOfferView, useOfferView } from "@/lib/offerViews";
import { pickText } from "@/lib/i18n";
import { StoreImage } from "@/components/StoreImage";

/*
 * The shopper's side of the offer rules (backend modules/offers): a
 * product's own order bumps, cross-sell suggestions, the thank-you page
 * upsell and the exit popup. Every price here is the server's; the browser
 * names offers by id and the server builds the order lines.
 */

const TEXT = {
  en: {
    crossSell: "Goes well with your order",
    upsellEyebrow: "One more thing before we ship",
    upsellAdd: (price: string) => `Add to my order — ${price}`,
    upsellAdding: "Adding…",
    upsellNo: "No, thanks",
    upsellAdded: (name: string) => `${name} was added to your order.`,
    upsellTotal: (total: string) => `Your new total: ${total}, paid on delivery.`,
    upsellNewOrder: (name: string, number: string) => `${name} is on its way as a new order, #${number}.`,
    upsellPaidCard: (total: string) => `${total} was charged to your saved card.`,
    upsellCod: (total: string) => `${total}, paid on delivery.`,
    upsellDeclined: "Your card was declined, so this order is waiting for payment. Your first order is not affected.",
    upsellFollowOnHint: "It comes as a separate order.",
    upsellClosed: "This offer is no longer available. Your order is unchanged.",
    upsellFailed: "We couldn't add it — your order is unchanged. Try again.",
    exitCode: "Your code",
    exitCopy: "Copy code",
    exitCopied: "Copied",
    exitClose: "Close",
    exitHint: "Enter it at checkout.",
  },
  ar: {
    crossSell: "يناسب طلبك",
    upsellEyebrow: "حاجة كمان قبل الشحن",
    upsellAdd: (price: string) => `أضف لطلبي — ${price}`,
    upsellAdding: "جارٍ الإضافة…",
    upsellNo: "لا، شكرًا",
    upsellAdded: (name: string) => `تمت إضافة ${name} إلى طلبك.`,
    upsellTotal: (total: string) => `الإجمالي الجديد: ${total}، الدفع عند الاستلام.`,
    upsellNewOrder: (name: string, number: string) => `${name} جاي في طلب جديد، رقم ${number}.`,
    upsellPaidCard: (total: string) => `اتخصم ${total} من الكارت المحفوظ.`,
    upsellCod: (total: string) => `${total}، الدفع عند الاستلام.`,
    upsellDeclined: "الكارت اترفض، فالطلب ده مستني الدفع. طلبك الأول مش متأثر.",
    upsellFollowOnHint: "هييجي في طلب منفصل.",
    upsellClosed: "هذا العرض لم يعد متاحًا. طلبك كما هو.",
    upsellFailed: "تعذّرت الإضافة — طلبك كما هو. حاول مرة أخرى.",
    exitCode: "الكود",
    exitCopy: "نسخ الكود",
    exitCopied: "تم النسخ",
    exitClose: "إغلاق",
    exitHint: "اكتبه عند إتمام الطلب.",
  },
};

// ------------------------------------------------------------ order bumps --

export interface ProductBumpsState {
  /** The product's bumps as cards, ticked or not. */
  bumps: OrderBumpOffer[];
  isOn: (offerId: string) => boolean;
  toggle: (offerId: string, on: boolean) => void;
  /** The ticked ones. */
  selected: OrderBumpOffer[];
  /** A bump the server refused: untick everything and load them again. */
  reset: () => void;
}

/**
 * A product's own order bumps. `exclude` is the store-wide bump's offer, which
 * the page already shows. A rule marked "ticked by default" starts ticked.
 */
export function useProductBumps(client: ApiClient, workspaceId: string, productId: string, exclude?: string | null): ProductBumpsState {
  const [rows, setRows] = useState<StorefrontProductBump[]>([]);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    storefrontProductBumps(client, workspaceId, productId)
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        // After a refusal nothing is ticked for the shopper again.
        setOn(version === 0 ? Object.fromEntries(list.filter((b) => b.preChecked).map((b) => [b.offerId, true])) : {});
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, productId, version]);

  // Each bump on screen counts as seen (lib/offerViews).
  useEffect(() => {
    for (const row of rows) if (row.offerId !== exclude) trackOfferView(workspaceId, "bump", row.id);
  }, [rows, workspaceId, exclude]);

  const bumps = useMemo(
    () =>
      rows
        .filter((b) => b.offerId !== exclude)
        .map((b) => orderBumpOf(b, [productId]))
        .filter((b): b is OrderBumpOffer => b !== null),
    [rows, exclude, productId]
  );

  return {
    bumps,
    isOn: (offerId) => Boolean(on[offerId]),
    toggle: (offerId, value) => setOn((current) => ({ ...current, [offerId]: value })),
    selected: bumps.filter((b) => on[b.offerId]),
    reset: () => setVersion((v) => v + 1),
  };
}

export function ProductBumpCards({ state, idPrefix }: { state: ProductBumpsState; idPrefix: string }) {
  if (state.bumps.length === 0) return null;
  return (
    <>
      {state.bumps.map((bump) => (
        <OrderBumpCard
          key={bump.offerId}
          bump={bump}
          checked={state.isOn(bump.offerId)}
          onChange={(value) => state.toggle(bump.offerId, value)}
          idPrefix={`${idPrefix}-${bump.offerId.slice(0, 8)}`}
        />
      ))}
    </>
  );
}

// -------------------------------------------------------------- cross-sell --

/** "Goes well with your order": the merchant's rule, or what real orders show was bought together. */
export function CrossSellStrip({
  workspaceId,
  productIds,
  placement,
}: {
  workspaceId: string;
  productIds: string[];
  placement: CrossSellPlacement;
}) {
  const { locale, store } = useStore();
  const text = pickText(TEXT, locale);
  const key = [...productIds].sort().join(",");
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  // The rule that filled the strip (null: bought together), for its numbers (lib/offerViews).
  const [ruleId, setRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    storefrontCrossSell(createStorefrontApiClient(), workspaceId, key.split(","), placement)
      .then((result) => {
        if (!cancelled) {
          setProducts(result.products);
          setRuleId((result as { ruleId?: string | null }).ruleId ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, key, placement]);

  useOfferView(workspaceId, "cross_sell", products.length > 0 ? ruleId : null);

  if (products.length === 0) return null;
  return (
    <section aria-labelledby={`cross-sell-${placement}`} className="mt-10">
      <h2 id={`cross-sell-${placement}`} className="text-lg font-semibold text-ink">
        {text.crossSell}
      </h2>
      {/* A quick add from here counts as a cross-sell add (lib/addSource.ts). */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4" onClickCapture={() => markAddSource("cross_sell", ruleId)}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={store?.currency ?? "EGP"} locale={locale} from="cross_sell" />
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------ post-purchase upsell --

/**
 * The thank-you page's offer: one tap adds it to the order just placed (cash
 * on delivery, before anyone has confirmed it). Declining hides it; nothing
 * is added without the tap.
 */
export function ThankYouUpsell({
  workspaceId,
  orderId,
  orderNumber,
  onAccepted,
}: {
  workspaceId: string;
  orderId: string;
  orderNumber: string | null;
  onAccepted?: (order: StorefrontUpsellAccepted) => void;
}) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const [offer, setOffer] = useState<StorefrontUpsell | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "declined">("idle");
  const [accepted, setAccepted] = useState<StorefrontUpsellAccepted | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The option the shopper takes it in (OfferVariantPicker), for a product with several.
  const product = useOfferProduct(workspaceId, offer ? (offer.productSlug ?? offer.productId) : null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  // The offer's real countdown from the order (offers/offerCountdown.js).
  const countdown = useOfferCountdown(offer?.expiresAt);
  useOfferView(workspaceId, "upsell", offer?.ruleId);

  useEffect(() => {
    if (!orderNumber) return;
    let cancelled = false;
    storefrontOrderUpsell(createStorefrontApiClient(), workspaceId, orderId, orderNumber)
      .then((result) => {
        if (!cancelled) setOffer(result);
      })
      .catch(() => {
        /* no offer is a fine thank-you page */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, orderId, orderNumber]);

  async function accept() {
    if (!offer || !orderNumber || state === "busy") return;
    setState("busy");
    setError(null);
    try {
      const order = await storefrontAcceptUpsell(createStorefrontApiClient(), workspaceId, orderId, orderNumber, offer.offerId, chosenId ?? undefined);
      setAccepted(order);
      onAccepted?.(order);
    } catch (err) {
      const closed = err instanceof ApiError && (err.code === "UPSELL_CLOSED" || err.code === "UPSELL_INVALID");
      setError(closed ? text.upsellClosed : text.upsellFailed);
      if (closed) setOffer(null);
    } finally {
      setState("idle");
    }
  }

  if (accepted) {
    return (
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-sm" role="status">
        <p className="flex items-center gap-2 font-semibold text-primary">
          <CheckIcon size={18} />
          {accepted.followOn ? text.upsellNewOrder(accepted.added.productName, accepted.orderNumber) : text.upsellAdded(accepted.added.productName)}
        </p>
        <p className="mt-0.5 text-ink-soft">
          {!accepted.followOn
            ? text.upsellTotal(money(accepted.totalAmount, accepted.currency))
            : accepted.payment?.status === "paid"
              ? text.upsellPaidCard(money(accepted.totalAmount, accepted.currency))
              : accepted.payment?.status === "declined"
                ? text.upsellDeclined
                : text.upsellCod(money(accepted.totalAmount, accepted.currency))}
        </p>
      </div>
    );
  }
  if (!offer || state === "declined") {
    return error ? (
      <p role="status" className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
        {error}
      </p>
    ) : null;
  }

  const price = Number(offer.priceAmount);
  const compareAt = offer.compareAtAmount === null ? null : Number(offer.compareAtAmount);
  return (
    <section className={`${card} mt-6 border-2 border-primary/30 p-5 sm:p-6`} aria-labelledby="upsell-title">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{text.upsellEyebrow}</p>
      <div className="mt-3 flex gap-4">
        {offer.imageUrl && (
          <StoreImage src={offer.imageUrl} alt="" width={96} height={96} sizes="96px" className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover" />
        )}
        <div className="min-w-0">
          <h2 id="upsell-title" className="text-lg font-semibold text-ink">
            {offer.title || offer.productName}
          </h2>
          {offer.title && <p className="text-sm text-ink-soft">{offer.productName}</p>}
          {offer.description && <p className="mt-1 text-sm text-ink-soft">{offer.description}</p>}
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-bold text-ink">{money(price, offer.currency)}</span>
            {compareAt && compareAt > price && <span className="text-sm text-ink-soft line-through">{money(compareAt, offer.currency)}</span>}
          </p>
        </div>
      </div>
      <OfferVariantPicker product={product} value={chosenId ?? offer.variantId} onChange={setChosenId} disabled={state === "busy"} />
      <OfferTimer {...countdown} />
      {offer.followOn && <p className="mt-2 text-xs text-ink-soft">{text.upsellFollowOnHint}</p>}
      <p role="alert" className="mt-3 text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <button type="button" className={btnPrimary} disabled={state === "busy" || countdown.ended} onClick={() => void accept()}>
          {state === "busy" ? text.upsellAdding : text.upsellAdd(money(price, offer.currency))}
        </button>
        <button type="button" className={btnSecondary} disabled={state === "busy"} onClick={() => setState("declined")}>
          {text.upsellNo}
        </button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- exit popup --

const SEEN_KEY = (workspaceId: string) => `zimos.exit-offer.${workspaceId}`;

function pageMatches(pages: StorefrontExitDownsell["pages"], pathname: string): boolean {
  if (/\/(checkout|orders|pay|offer|track|f)(\/|$)/.test(pathname)) return false;
  if (pages === "product") return /\/products\/[^/]+/.test(pathname);
  if (pages === "cart") return /\/cart(\/|$)/.test(pathname);
  return true;
}

/**
 * The merchant's exit popup: shown once per visitor, when they are about to
 * leave (the pointer leaves through the top of the window, or the back
 * button on a phone) or after the delay they set. A message and, when there
 * is one, a real coupon of the store — no timer, no pressure.
 */
export function ExitDownsell({ workspaceId }: { workspaceId: string }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const pathname = usePathname() ?? "";
  const [config, setConfig] = useState<StorefrontExitDownsell | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY(workspaceId))) return;
    } catch {
      return;
    }
    let cancelled = false;
    storefrontExitDownsell(createStorefrontApiClient(), workspaceId)
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        /* no popup */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const eligible = config !== null && !open && pageMatches(config.pages, pathname);

  useEffect(() => {
    if (!eligible || !config) return;
    const show = () => {
      try {
        if (localStorage.getItem(SEEN_KEY(workspaceId))) return;
        localStorage.setItem(SEEN_KEY(workspaceId), "1");
      } catch {
        return;
      }
      trackOfferView(workspaceId, "exit_downsell", "popup");
      setOpen(true);
    };
    if (config.trigger === "delay") {
      const timer = window.setTimeout(show, config.delaySeconds * 1000);
      return () => window.clearTimeout(timer);
    }
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };
    // A phone has no pointer to leave with: the first "back" is answered with the offer.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onPop = () => show();
    document.addEventListener("mouseout", onLeave);
    if (coarse) {
      window.history.pushState({ zimosExit: true }, "");
      window.addEventListener("popstate", onPop, { once: true });
    }
    return () => {
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("popstate", onPop);
    };
  }, [eligible, config, workspaceId]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !config) return null;

  async function copy() {
    if (!config?.code) return;
    try {
      await navigator.clipboard.writeText(config.code);
      setCopied(true);
    } catch {
      /* the code is on screen to type */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-offer-title"
        className={`${card} w-full max-w-md p-6 text-center shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="exit-offer-title" className="text-xl font-bold text-ink">
          {config.title || config.message}
        </h2>
        {config.title && config.message && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{config.message}</p>}
        {config.code && (
          <div className="mt-5">
            <p className="text-xs font-medium text-ink-soft">{text.exitCode}</p>
            <p dir="ltr" className="mt-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft px-4 py-3 text-lg font-bold tracking-widest text-primary">
              {config.code}
            </p>
            <p className="mt-2 text-xs text-ink-soft">{text.exitHint}</p>
          </div>
        )}
        <div className="mt-5 grid gap-2">
          {config.code && (
            <button type="button" className={btnPrimary} onClick={() => void copy()}>
              {copied ? <CheckIcon size={18} /> : null}
              <span aria-live="polite">{copied ? text.exitCopied : text.exitCopy}</span>
            </button>
          )}
          <button ref={closeButton} type="button" className={btnSecondary} onClick={() => setOpen(false)}>
            {text.exitClose}
          </button>
        </div>
      </div>
    </div>
  );
}
