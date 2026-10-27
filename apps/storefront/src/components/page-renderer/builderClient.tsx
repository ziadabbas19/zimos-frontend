"use client";

import { useId, useMemo, useState } from "react";
import { OrderSnapshotSummary } from "@/components/OrderConfirmation";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnPrimaryLg } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { latestOrderSnapshot } from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { StoreLoader } from "@/components/StoreLoader";

/**
 * The interactive halves of the SPEC §9.3 builder elements. Each is a small
 * client component fed plain props by the server renderer (builderElements.tsx).
 */

/** `tabs`: titles in a row, one panel shown at a time. */
export function TabsBlock({ title, items }: { title: string; items: Array<{ q: string; a: string }> }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const current = items[Math.min(active, items.length - 1)];
  return (
    <div>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel`}
            onClick={() => setActive(i)}
            className={`-mb-px min-h-11 cursor-pointer border-b-2 px-4 text-sm font-medium transition-colors ${
              i === active ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {item.q}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${Math.min(active, items.length - 1)}`}
        className="whitespace-pre-line pt-4 text-sm leading-relaxed text-ink-soft sm:text-base"
      >
        {current.a}
      </div>
    </div>
  );
}

/**
 * `checkout_summary`: the shopper's real cart — lines, subtotal — and the way
 * to the checkout, where the discount code and the shipping fee are worked
 * out by the server. Nothing is priced here.
 */
export function CheckoutSummaryBlock({ title, buttonLabel }: { title: string; buttonLabel: string }) {
  const { cart, isLoading } = useCart();
  const { t, money } = useStore();
  const items = cart?.items ?? [];

  return (
    <div className="zt-card rounded-2xl border border-line bg-paper-raised p-5">
      <h3 className="text-lg font-semibold text-ink">{title || t.checkout.summary}</h3>
      {isLoading ? (
        <StoreLoader size="sm" label={t.renderer.cartLoading} className="mt-3" />
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{t.renderer.cartEmpty}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {items.map((line) => (
              <li key={line.id} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-soft">
                  {t.cart.item} × {line.quantity}
                </span>
                <span className="shrink-0 font-medium text-ink">{money(line.lineTotal, cart?.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
            <span>{t.checkout.subtotal}</span>
            <span>{money(cart?.subtotal ?? 0, cart?.currency)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{t.checkout.finalNote}</p>
          <StoreLink href="/checkout" className={`${btnPrimary} mt-4 w-full`}>
            {buttonLabel || t.cart.checkout}
          </StoreLink>
        </>
      )}
    </div>
  );
}

/**
 * `order_summary`: the order this device placed last, as it was saved at
 * checkout — for a thank-you page built in the editor. Renders nothing on a
 * device that has not ordered.
 */
export function OrderSummaryBlock({ workspaceId, title }: { workspaceId: string; title: string }) {
  const isClient = useIsClient();
  const { store } = useStore();
  const snapshot = useMemo(() => (isClient ? latestOrderSnapshot(workspaceId) : null), [isClient, workspaceId]);
  if (!snapshot) return null;
  return (
    <div>
      {title.trim() && <h3 className="mb-3 text-xl font-semibold text-ink">{title}</h3>}
      <OrderSnapshotSummary snapshot={snapshot} currency={snapshot.currency ?? store?.currency} headingLevel="h3" />
    </div>
  );
}

/**
 * `upsell_accept_button` / `upsell_decline_link`: the page's own buttons for a
 * funnel offer. They carry no logic — the funnel step (FunnelStep.tsx) listens
 * for clicks on `data-funnel-action` and reports the outcome, exactly as its
 * built-in buttons do. Outside a funnel there is no offer to answer, so the
 * server renderer does not draw them.
 */
export function FunnelActionButton({ action, label }: { action: "accepted_offer" | "declined_offer"; label: string }) {
  return action === "accepted_offer" ? (
    <button type="button" data-funnel-action={action} className={btnPrimaryLg}>
      {label}
    </button>
  ) : (
    <button
      type="button"
      data-funnel-action={action}
      className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
    >
      {label}
    </button>
  );
}
