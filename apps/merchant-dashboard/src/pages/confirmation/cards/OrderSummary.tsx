import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ConfirmationTask } from "@store-builder/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt } from "@/i18n/LocaleContext";
import { formatAddress, formatMoney, formatOptions } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CustomizationList } from "@/pages/orders/components/CustomizationList";
import { OrderTimelineLines } from "@/pages/orders/components/OrderTimelineLines";
import { ManualPaymentProof } from "@/pages/orders/components/ManualPaymentProof";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { useQueueStrings } from "../queueStrings";

/** A card's item list never runs past this many lines; a longer order ends in "+N more". */
const MAX_ITEM_LINES = 4;

/** A small text link whose tap target reaches 44px without making its line taller. */
const TEXT_LINK =
  "relative rounded-sm font-medium underline-offset-4 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The first lines of every card of the list: who and how much, then the order
 * number, how many items, and what the agent must know before reading on
 * (flagged, cancelled, how many times it was tried).
 */
export function OrderHeadline({
  task,
  aside,
  leading,
}: {
  task: ConfirmationTask;
  /** After the order facts: the attempts badge of an open card, the outcome badge of a finished one. */
  aside?: ReactNode;
  /** Before the name, e.g. the bulk tick box. */
  leading?: ReactNode;
}) {
  const t = useQueueStrings();
  const orderLabels = useOrderLabels();
  const { order } = task;
  const riskFlags = order.riskFlags ?? [];

  return (
    <div className="flex items-start gap-2">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 truncate text-base leading-6 font-semibold text-ink">
            <bdi>{order.contactSnapshot.fullName || t.unnamedCustomer}</bdi>
          </p>
          <p className="shrink-0 text-base leading-6 font-semibold whitespace-nowrap text-ink tabular-nums">
            <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-5 text-ink-soft">
          <Link to={`/orders/${order.id}`} className={TEXT_LINK}>
            <bdi dir="ltr">{order.orderNumber}</bdi>
          </Link>
          <span aria-hidden>·</span>
          <span>{countOf("item", order.items.length)}</span>
          {riskFlags.length > 0 && <StatusBadge value="flagged" tone="danger" text={orderLabels.flagged} />}
          {order.cancelledAt && <StatusBadge value="cancelled" text={t.orderCancelled} />}
          {aside}
        </div>
      </div>
    </div>
  );
}

/**
 * What the agent reads back on the call: the number, where the order goes, how
 * many of what in which size or colour, why it was flagged, when it was placed
 * and the customer's answers to the products' own questions. An order paid by
 * InstaPay or a wallet shows the payer's number and screenshot here, with the
 * approve / reject step: it is confirmed only once that payment is approved.
 */
export function OrderFacts({
  task,
  now,
  contactAction,
  onChanged,
}: {
  task: ConfirmationTask;
  /** The page's clock, so every card of the list moves together. */
  now: number;
  /** Beside the phone number: the WhatsApp button of an open card. */
  contactAction?: ReactNode;
  /** Set on an open task: approving / rejecting a manual payment updates the card. */
  onChanged?: (task: ConfirmationTask) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useQueueStrings();
  const orderLabels = useOrderLabels();
  const { order } = task;
  const riskFlags = order.riskFlags ?? [];
  const phone = order.contactSnapshot.phone;
  const itemCount = order.items.length;
  // Over the cap, the last line is the link to the rest instead of an item.
  const shownItems = itemCount > MAX_ITEM_LINES ? order.items.slice(0, MAX_ITEM_LINES - 1) : order.items;
  const hiddenItems = itemCount - shownItems.length;
  const address = formatAddress(order.shippingAddressSnapshot);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-display text-xl leading-7 font-medium text-ink tabular-nums">
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="relative rounded-sm before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <bdi dir="ltr">{phone}</bdi>
            </a>
          ) : (
            <span className="text-base text-ink-soft">{t.noPhone}</span>
          )}
        </p>
        {contactAction}
      </div>
      {order.deliveryMethod === "pickup" ? (
        <p className="text-sm leading-5 font-medium text-ink">{t.pickup}</p>
      ) : (
        address && <p className="line-clamp-2 text-sm leading-5 text-ink-soft">{address}</p>
      )}

      {order.manualPayment && (
        <div className="rounded-[0.875rem] px-3 py-2.5 ring-1 ring-line">
          <ManualPaymentProof
            compact
            workspaceId={workspaceId}
            orderId={order.id}
            payment={order.manualPayment}
            onChanged={(next) =>
              onChanged?.({
                ...task,
                order: { ...order, manualPayment: next, financialState: next.status === "approved" ? "paid" : order.financialState },
              })
            }
          />
        </div>
      )}

      {itemCount > 0 && (
        <ul aria-label={t.itemsHeading} className="space-y-1 text-sm leading-5 text-ink">
          {shownItems.map((item) => {
            const options = formatOptions(item.variantOptionsSnapshot);
            return (
              <li key={item.id} className="flex gap-2">
                <span className="shrink-0 text-ink-soft tabular-nums">{fmt(t.times, { n: item.quantity })}</span>
                <span dir="auto" className="min-w-0">
                  {item.productNameSnapshot}
                  {options && <span className="text-ink-soft"> · {options}</span>}
                </span>
              </li>
            );
          })}
          {hiddenItems > 0 && (
            <li>
              <Link to={`/orders/${order.id}`} className={`${TEXT_LINK} text-ink-soft`}>
                {fmt(t.moreItems, { n: hiddenItems })}
              </Link>
            </li>
          )}
        </ul>
      )}

      {riskFlags.length > 0 && (
        <p className="text-xs leading-5 font-medium text-danger">
          {riskFlags.map((flag) => orderLabels.riskFlag(flag)).join(" · ")}
        </p>
      )}
      <OrderTimelineLines order={order} now={now} />

      {/* The customer's answers to products' custom fields — confirmed on the call too. */}
      {order.items
        .filter((item) => item.customizations && item.customizations.length > 0)
        .map((item) => (
          <div key={item.id} className="space-y-1">
            <p className="text-xs font-medium text-ink-soft">{item.productNameSnapshot}</p>
            <CustomizationList customizations={item.customizations} compact currency={order.currency} />
          </div>
        ))}
    </div>
  );
}
