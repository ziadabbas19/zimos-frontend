"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError, shopperOrder, shopperReorder, type ShopperOrder, type ShopperReorderLine } from "@store-builder/api-client";
import { ArrowIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { TrackOrderDownloads } from "@/components/TrackOrderDownloads";
import { TrackOrderNotes } from "@/components/TrackOrderNotes";
import { TrackOrderProgress } from "@/components/TrackOrderProgress";
import { btnPrimary, btnSecondary, card, skeleton } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { usePaymentMethodText } from "@/lib/paymentMethodText";
import { addressSummary } from "@/lib/shopperAddress";
import { isShopperSignedOutError, shopperErrorMessage } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { Notice, useAccount } from "./AccountShell";
import { StageBadge } from "./AccountOrders";
import { RepeatIcon } from "./accountIcons";
import { ShopperReturns } from "@/components/returns/ShopperReturns";
import { SHOPPER_RETURNS_ENABLED } from "@/lib/features";

type Reorder =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; added: ShopperReorderLine[]; missing: ShopperReorderLine[] }
  | { status: "error"; message: string };

/**
 * One order in the shopper's account (`/account/orders/:orderId`): the
 * tracking page's timeline and blocks (TrackOrderProgress, downloads,
 * notes), the items and totals, where it goes and
 * how it is paid — and «اطلب تاني»: the lines that can still be bought go
 * into the cart (the store's CartProvider, at today's prices) and the cart
 * opens; the rest are listed as «مبقاش متاح» with the reason.
 *
 * The actions row (`data-account-order-actions`) is where more order
 * actions belong (returns).
 */
export function AccountOrder() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const { t, money, intlLocale, locale } = useStore();
  const a = t.account;
  const { api } = useAccount();
  const cart = useCart();
  const { afterAdd, onCartLinkClick } = useCartSheet(cart.openDrawer);
  const payText = usePaymentMethodText();
  const [order, setOrder] = useState<ShopperOrder | null>(null);
  const [failure, setFailure] = useState<"missing" | "error" | null>(null);
  const [nonce, setNonce] = useState(0);
  const [reorder, setReorder] = useState<Reorder>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    api
      .call((client, storeId, token) => shopperOrder(client, storeId, token, orderId))
      .then((found) => {
        if (!cancelled) setOrder(found);
      })
      .catch((err) => {
        if (cancelled || isShopperSignedOutError(err)) return;
        setFailure(err instanceof ApiError && (err.status === 404 || err.status === 422) ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [api, orderId, nonce]);

  async function orderAgain() {
    if (reorder.status === "working") return;
    setReorder({ status: "working" });
    try {
      const lines = await api.call((client, storeId, token) => shopperReorder(client, storeId, token, orderId));
      const added: ShopperReorderLine[] = [];
      const missing: ShopperReorderLine[] = [];
      // One at a time: each add answers with the whole cart.
      for (const line of lines) {
        if (!line.available || !line.variantId || line.quantity < 1) {
          missing.push(line);
          continue;
        }
        try {
          await cart.addItem(line.variantId, undefined, line.quantity);
          added.push(line);
        } catch {
          // Sold out or withdrawn between the check and the add.
          missing.push({ ...line, available: false, reason: line.reason === "low_stock" ? "out_of_stock" : line.reason ?? "unavailable" });
        }
      }
      setReorder({ status: "done", added, missing });
      if (added.length > 0) afterAdd();
    } catch (err) {
      if (!isShopperSignedOutError(err)) setReorder({ status: "error", message: shopperErrorMessage(err, a) });
    }
  }

  const back = (
    <StoreLink
      href="/account"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary"
    >
      <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
      {a.backToOrders}
    </StoreLink>
  );

  if (failure) {
    return (
      <div>
        {back}
        <div className="mt-3">
          {failure === "missing" ? (
            <Notice title={a.notFound} />
          ) : (
            <Notice
              tone="danger"
              title={a.loadFailed}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setFailure(null);
                    setNonce((n) => n + 1);
                  }}
                  className={btnPrimary}
                >
                  {a.retry}
                </button>
              }
            />
          )}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div aria-hidden>
        {back}
        <div className="mt-3 space-y-3">
          <div className={`${skeleton} h-8 w-56`} />
          <div className={`${skeleton} h-72 w-full`} />
          <div className={`${skeleton} h-40 w-full`} />
        </div>
      </div>
    );
  }

  const currency = order.currency;
  // The copy-a-tracking-link button belongs to the public tracking page, not to the account.
  const progress = { ...order, trackingToken: undefined };
  const paidBy =
    order.paymentMethod === "cod"
      ? t.trust.cod
      : order.paymentMethod === "card"
        ? t.payment.card
        : order.paymentMethod === "wallet"
          ? t.payment.wallet
          : order.paymentMethod === "valu"
            ? payText.valu
            : order.paymentMethod === "kiosk"
              ? payText.kiosk
              : null;
  const address = order.shippingAddress;
  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      {back}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
          {a.order}{" "}
          <bdi dir="ltr" className="tabular-nums">
            {order.orderNumber}
          </bdi>
        </h2>
        <StageBadge stage={order.stage} />
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {a.orderedOn} {date.format(new Date(order.createdAt))}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-order-status">
            <h3 id="account-order-status" className="mb-5 text-lg font-semibold text-ink">
              {t.track.status}
            </h3>
            <TrackOrderProgress result={progress} />
            <TrackOrderDownloads result={order} />
            <TrackOrderNotes result={order} />
          </section>

          <section className={`${card} p-5 sm:p-6`}>
            <div data-account-order-actions className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                id="account-order-again"
                onClick={() => void orderAgain()}
                disabled={reorder.status === "working"}
                className={`${btnPrimary} w-full sm:w-auto`}
              >
                <RepeatIcon size={18} />
                {reorder.status === "working" ? a.reordering : a.orderAgain}
              </button>
            </div>
            <div aria-live="polite" className="empty:hidden">
              {reorder.status === "error" && (
                <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{reorder.message}</p>
              )}
              {reorder.status === "done" && (
                <div className="mt-4 space-y-3">
                  {reorder.added.length > 0 ? (
                    <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
                      <p className="font-medium">{a.reorderAdded(reorder.added.length)}</p>
                      {reorder.added
                        .filter((line) => line.reason === "low_stock")
                        .map((line, i) => (
                          <p key={i} className="mt-1">
                            {line.name}: {a.reasonLowStock(line.quantity)}
                          </p>
                        ))}
                      {/* The cart sheet when the merchant has the cart icon open it, else the cart page (lib/cartSheet). */}
                      <StoreLink href="/cart" onClick={onCartLinkClick} className={`${btnSecondary} mt-3`}>
                        {t.shop.viewCart}
                      </StoreLink>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{a.reorderNothing}</p>
                  )}
                  {reorder.missing.length > 0 && (
                    <div className="rounded-xl border border-line px-4 py-3">
                      <p className="text-sm font-semibold text-ink">{a.noLongerAvailable}</p>
                      <ul className="mt-2 space-y-1.5">
                        {reorder.missing.map((line, i) => (
                          <li key={i} className="flex justify-between gap-3 text-sm">
                            <span className="min-w-0 text-ink">{line.name}</span>
                            <span className="shrink-0 text-ink-soft">
                              {line.reason === "out_of_stock" ? a.reasonOutOfStock : a.reasonUnavailable}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* «ارجع منتجات» for this order, as on the tracking page (lib/features). */}
            {SHOPPER_RETURNS_ENABLED && api.token && orderId && <ShopperReturns orderId={orderId} shopperToken={api.token} workspaceId={workspaceId} />}
          </section>
        </div>

        <aside className="space-y-5 lg:self-start">
          <section className={`${card} p-5`} aria-labelledby="account-order-items">
            <h3 id="account-order-items" className="text-base font-semibold text-ink">
              {t.track.items}
            </h3>
            <ul className="mt-3 space-y-3">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink">
                    {item.productNameSnapshot}
                    <span className="text-xs text-ink-soft"> × {item.quantity}</span>
                  </span>
                  <span className="shrink-0 text-ink">{money(item.lineTotalAmount, currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.track.subtotal}</dt>
                <dd className="text-ink">{money(order.subtotalAmount, currency)}</dd>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>{t.track.discount}</dt>
                  <dd>−{money(order.discountAmount, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.track.shipping}</dt>
                <dd className="text-ink">{money(order.shippingAmount, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
                <dt>{t.track.total}</dt>
                <dd>{money(order.totalAmount, currency)}</dd>
              </div>
            </dl>
          </section>

          {(address || paidBy) && (
            <section className={`${card} space-y-4 p-5`}>
              {address && (
                <div>
                  <h3 className="text-sm font-semibold text-ink">{a.deliverTo}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{addressSummary(address, locale)}</p>
                </div>
              )}
              {paidBy && (
                <div>
                  <h3 className="text-sm font-semibold text-ink">{a.payment}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{paidBy}</p>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
