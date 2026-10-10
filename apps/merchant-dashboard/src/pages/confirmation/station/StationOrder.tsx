import type { ConfirmationTask } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconClock, IconPlace } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, getIntlLocale } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney, formatOptions, placeName } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { countOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CustomizationList } from "@/pages/orders/components/CustomizationList";
import { OrderLineThumb } from "@/pages/orders/components/OrderLineThumb";
import { ManualPaymentProof } from "@/pages/orders/components/ManualPaymentProof";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { useChannelLabels } from "../confirmationChannel";
import { dialablePhone, readablePhone } from "../queueModel";
import { useOutcomeLabels, useQueueStrings } from "../queueStrings";
import { CustomerHistory } from "./CustomerHistory";
import { useStationStrings } from "./stationStrings";
import { attemptAgentName, isCustomerLinkAttempt } from "../customerLink";

/** An order that has waited this long for its call is said so in amber. */
const LATE_AFTER_HOURS = 4;

/**
 * The order being called, as the agent reads it: WHO (the name, the number in
 * large left-to-right digits, their history with the store), WHAT (each line
 * with its picture, options and quantity, and the customer's answers to the
 * product's own questions), then HOW MUCH and WHERE (the total with how it is
 * paid, governorate · city and the address, and how long ago it was placed).
 *
 * One column on a phone; from a card 32rem wide the items sit beside the money
 * and the address, so the buttons under them stay on the first screen.
 */
export function StationOrder({
  task,
  now,
  userId,
  inProgress,
  onChanged,
}: {
  task: ConfirmationTask;
  /** The page's clock. */
  now: number;
  userId: string | null;
  /** Someone holds the task (the viewer, in the station): a booked callback is not announced again. */
  inProgress: boolean;
  /** Approving / rejecting a manual payment updates the task. */
  onChanged: (task: ConfirmationTask) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useStationStrings();
  const q = useQueueStrings();
  const labels = useOrderLabels();
  const outcomeLabel = useOutcomeLabels();
  const channelLabel = useChannelLabels();

  const { order } = task;
  const name = order.contactSnapshot.fullName?.trim() || q.unnamedCustomer;
  const rawPhone = order.contactSnapshot.phone?.trim() || "";
  const masked = rawPhone !== "" && dialablePhone(rawPhone) === null;

  // Picked up from the store: said in place of an address.
  const pickup = order.deliveryMethod === "pickup";
  const address = order.shippingAddressSnapshot;
  const place = pickup
    ? q.pickup
    : address
      ? [placeName(address.province), placeName(address.city)]
          .filter((part): part is string => Boolean(part))
          .filter((part, i, all) => all.indexOf(part) === i)
          .join(" · ")
      : "";
  const street = pickup ? "" : address?.addressLine?.trim() || "";
  const late = now - new Date(order.createdAt).getTime() > LATE_AFTER_HOURS * 60 * 60 * 1000;
  const placedWhen = formatRelative(order.createdAt, now, getIntlLocale());

  const lastAttempt = task.attempts[task.attempts.length - 1];
  let callbackLine: string | null = null;
  if (!inProgress && task.nextRetryAt) {
    const due = new Date(task.nextRetryAt).getTime() <= now;
    callbackLine = fmt(due ? q.callbackDue : q.callbackLater, { time: formatDateTime(task.nextRetryAt) });
  }
  const assignedLine = !task.assignedTo
    ? null
    : task.assignedTo.id === userId
      ? t.assignedYou
      : fmt(t.assignedTo, { name: task.assignedTo.fullName });

  return (
    <>
      {/* Who. */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="max-w-full min-w-0 truncate text-[22px] leading-7 font-semibold text-ink">
            <bdi>{name}</bdi>
          </h2>
          {rawPhone ? (
            <p className="shrink-0 text-xl leading-7 font-medium text-ink tabular-nums">
              <bdi dir="ltr">{readablePhone(rawPhone)}</bdi>
            </p>
          ) : (
            <p className="shrink-0 text-sm leading-7 text-ink-soft">{q.noPhone}</p>
          )}
        </div>
        {/* A masked number is shown as it came, and said to be masked: never dressed up as whole. */}
        {masked && <p className="text-xs leading-5 text-ink-soft">{t.phoneHidden}</p>}
        {order.cancelledAt && <StatusBadge value="cancelled" text={q.orderCancelled} className="mt-1.5" />}
        {/* Paid by InstaPay or a wallet: the payer's number and screenshot; confirmed only once approved. */}
        {order.manualPayment && (
          <div className="mt-1.5 rounded-[0.875rem] px-3 py-2.5 ring-1 ring-line">
            <ManualPaymentProof
              compact
              workspaceId={workspaceId}
              orderId={order.id}
              payment={order.manualPayment}
              onChanged={(next) =>
                onChanged({
                  ...task,
                  order: { ...order, manualPayment: next, financialState: next.status === "approved" ? "paid" : order.financialState },
                })
              }
            />
          </div>
        )}
        <CustomerHistory
          // One customer's history must never stand under another's name: a new customer is a new mount.
          key={order.customerId}
          customerId={order.customerId}
          // A cash order counts as the customer's from the moment it is placed; only an unpaid online one does not yet.
          countsThisOrder={order.completedAt !== null}
          riskFlags={order.riskFlags ?? []}
          className="mt-1.5"
        />
        {(assignedLine || callbackLine || lastAttempt) && (
          <div className="mt-1.5 space-y-0.5 text-xs leading-5 text-ink-soft">
            {assignedLine && <p>{assignedLine}</p>}
            {callbackLine && <p className="font-medium text-accent-dark">{callbackLine}</p>}
            {lastAttempt && (
              <p>
                {fmt(q.lastAttempt, {
                  outcome: outcomeLabel[lastAttempt.outcome],
                  agent: attemptAgentName(lastAttempt, q.unknownAgent),
                  time: formatDateTime(lastAttempt.createdAt),
                })}
                {lastAttempt.channel && !isCustomerLinkAttempt(lastAttempt) && <> · {fmt(q.via, { channel: channelLabel[lastAttempt.channel] })}</>}
              </p>
            )}
            {lastAttempt?.notes && (
              <p className="line-clamp-2 text-ink">
                <span className="text-ink-soft">{t.lastNote}: </span>
                <bdi>{lastAttempt.notes}</bdi>
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-2.5 sm:gap-4 @lg:grid-cols-2 @lg:gap-6">
        {/* What. A long order scrolls inside its own list, so the buttons stay where they are. */}
        {/* On a narrow card the money and the place come first: they are what the call confirms, and they must
            not sit under a list that scrolls. Side by side (wide card) the order is as written. */}
        <section aria-label={q.itemsHeading} className="order-2 min-w-0 @lg:order-none">
          <ul
            tabIndex={order.items.length > 3 ? 0 : undefined}
            className="zimos-station-items -me-1 max-h-[8.5rem] space-y-1 overflow-y-auto overscroll-contain pe-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary @lg:max-h-[12.5rem]"
          >
            {order.items.map((item) => {
              const options = formatOptions(item.variantOptionsSnapshot);
              const offer = item.offerNameSnapshot ? fmt(t.offer, { name: item.offerNameSnapshot }) : "";
              const detail = [options, offer].filter(Boolean).join(" · ");
              return (
                <li key={item.id}>
                  <div className="flex min-h-9 items-center gap-2.5">
                    <OrderLineThumb item={item} className="size-9 rounded-[0.625rem]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-5 font-medium text-ink">
                        <bdi>{item.productNameSnapshot}</bdi>
                      </p>
                      {detail && (
                        <p className="truncate text-xs leading-4 text-ink-soft">
                          <bdi>{detail}</bdi>
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm leading-5 font-semibold text-ink tabular-nums">
                      <bdi>{fmt(q.times, { n: item.quantity })}</bdi>
                    </p>
                  </div>
                  {/* The customer's answers to the product's own questions — confirmed on the call too. */}
                  {item.customizations && item.customizations.length > 0 && (
                    <CustomizationList
                      customizations={item.customizations}
                      compact
                      currency={order.currency}
                      className="ms-[2.875rem] mt-1"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* How much, and where — with how long the order has waited at the end of the place line. */}
        <section className="order-1 min-w-0 space-y-1.5 @lg:order-none">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[28px] leading-8 font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums">
              <span className="sr-only">{t.total}: </span>
              <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
            </p>
            <p className="text-[13px] leading-5 text-ink-soft">{labels.paymentMethod(order.paymentMethod)}</p>
          </div>
          <div className="flex items-start gap-2">
            <IconPlace className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <p className={cn("min-w-0 text-sm leading-5", place ? "font-medium text-ink" : "text-ink-soft")}>
                  {place || (street ? "" : t.noAddress)}
                </p>
                <p
                  className={cn(
                    "ms-auto inline-flex shrink-0 items-center gap-1 text-[13px] leading-5",
                    late ? "font-medium text-accent-dark" : "text-ink-soft"
                  )}
                >
                  {late && <IconClock className="size-3.5 shrink-0 self-center" aria-hidden />}
                  <time
                    dateTime={order.createdAt}
                    title={
                      late
                        ? `${fmt(t.placedLate, { when: placedWhen, hours: countOf("hour", LATE_AFTER_HOURS) })} (${formatDateTime(order.createdAt)})`
                        : formatDateTime(order.createdAt)
                    }
                  >
                    {fmt(t.placed, { when: placedWhen })}
                  </time>
                </p>
              </div>
              {street && (
                <p className="line-clamp-2 text-[13px] leading-5 wrap-anywhere text-ink-soft">
                  <bdi>{street}</bdi>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
