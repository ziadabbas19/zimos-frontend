"use client";

import type { ReactNode } from "react";
import type { OrderSnapshot } from "@/lib/commerce";
import { useStore } from "@/lib/StoreContext";
import { CheckIcon } from "./Icons";
import { card } from "./ui";

/**
 * The pieces of the store's thank-you page (orders/[orderId]) that a funnel's
 * thank-you step shows too, so a funnel order is confirmed the same way.
 */

/** The tick, "Thank you", the order number and the confirmation-call notice. */
export function ConfirmationHeading({
  as: Heading = "h1",
  orderNumber,
  phone,
}: {
  /** h2 when the heading sits under a merchant-built page. */
  as?: "h1" | "h2";
  orderNumber: string | null;
  phone?: string | null;
}) {
  const { t } = useStore();

  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckIcon size={32} />
      </span>
      <Heading className="mt-5 font-display text-2xl font-bold text-ink sm:text-3xl">{t.thankYou.title}</Heading>
      {orderNumber && (
        <p className="mt-3 text-sm text-ink-soft">
          {t.thankYou.orderNumber}:{" "}
          <bdi dir="ltr" className="font-bold text-ink">
            #{orderNumber}
          </bdi>
        </p>
      )}
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        {t.thankYou.callNotice}
        {phone && (
          <>
            {" "}
            {t.thankYou.onPhone}{" "}
            <bdi dir="ltr" className="font-semibold text-ink">
              {phone}
            </bdi>
          </>
        )}
      </p>
    </div>
  );
}

/** The order's lines and totals as this device saved them at checkout. */
export function OrderSnapshotSummary({
  snapshot,
  currency,
  headingLevel: Heading = "h2",
  footnote,
}: {
  snapshot: OrderSnapshot;
  currency: string | undefined;
  headingLevel?: "h2" | "h3";
  footnote?: ReactNode;
}) {
  const { t, money } = useStore();
  const titleId = `summary-title-${snapshot.id}`;

  return (
    <section className={`${card} p-5 sm:p-6`} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <Heading id={titleId} className="text-lg font-semibold text-ink">
          {t.thankYou.summary}
        </Heading>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {t.thankYou.payOnDelivery}
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {snapshot.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 text-ink">
              {item.name}
              {item.options && <span className="block text-xs text-ink-soft">{item.options}</span>}
              <span className="text-xs text-ink-soft"> × {item.quantity}</span>
            </span>
            <span className="shrink-0 text-ink">{money(item.lineTotal, currency)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">{t.thankYou.subtotal}</dt>
          <dd className="text-ink">{money(snapshot.subtotalAmount, currency)}</dd>
        </div>
        {snapshot.discountAmount > 0 && (
          <div className="flex justify-between text-success">
            <dt>{t.thankYou.discount}</dt>
            <dd>−{money(snapshot.discountAmount, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">{t.thankYou.shipping}</dt>
          <dd className="text-ink">{money(snapshot.shippingAmount, currency)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
          <dt>{t.thankYou.total}</dt>
          <dd>{money(snapshot.totalAmount, currency)}</dd>
        </div>
      </dl>
      {footnote && <p className="mt-3 text-xs text-ink-soft">{footnote}</p>}
    </section>
  );
}
