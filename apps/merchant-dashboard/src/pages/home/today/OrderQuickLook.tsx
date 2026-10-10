import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Order, OrderItem, OrderStage } from "@store-builder/api-client";
import { buttonVariants, cn } from "@store-builder/ui";
import { ContactActions } from "@/components/ContactActions";
import { IconCash, IconConfirm, IconCourier, IconPhone, IconPlace, type Icon } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, getLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatMoney, placeName } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { formatRelativeTime } from "@/lib/relativeTime";
import { isPlainNavigationClick, useViewNavigate } from "@/lib/viewTransition";
import { CONFIRM_ROLES, MANAGE_ROLES } from "@/pages/confirmation/confirmationRoles";
import { OrderLineThumb } from "@/pages/orders/components/OrderLineThumb";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";

const STRINGS = {
  en: {
    placed: "Placed {when}",
    noName: "Customer without a name",
    items: "Items",
    times: "× {n}",
    total: "Total",
    address: "Address",
    noAddress: "No shipping address",
    customer: "Customer",
    phoneHidden: "Part of the number is hidden",
    noPhone: "No phone number",
    nextConfirm: "Confirm the order",
    nextShip: "Book the courier",
    nextFollow: "Follow up with the customer",
  },
  ar: {
    placed: "طُلب {when}",
    noName: "عميل بدون اسم",
    items: "المنتجات",
    times: "× {n}",
    total: "الإجمالي",
    address: "العنوان",
    noAddress: "لا يوجد عنوان شحن",
    customer: "العميل",
    phoneHidden: "جزء من الرقم مخفي",
    noPhone: "لا يوجد رقم هاتف",
    nextConfirm: "تأكيد الطلب",
    nextShip: "حجز المندوب",
    nextFollow: "متابعة العميل",
  },
} satisfies Messages;

/**
 * The customer's number when it is whole. Most roles are sent it masked
 * (010****665): that is not a number to dial, message or copy, so every
 * action on it is offered only when this returns the number.
 */
export function dialablePhone(phone: string | null | undefined): string | null {
  const value = phone?.trim();
  if (!value) return null;
  if (/[*•×xX]/.test(value)) return null;
  return value.replace(/[^\d٠-٩۰-۹]/g, "").length >= 7 ? value : null;
}

/** `tel:` for a number: Arabic-Indic digits folded, spaces and dashes dropped. */
export function orderTelHref(phone: string): string {
  const ascii = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}

/** Where the order goes, for a list row: «القاهرة · مدينة نصر». Empty when there is no address. */
export function orderPlace(order: Order): string {
  const address = order.shippingAddressSnapshot;
  if (!address) return "";
  return [placeName(address.province), placeName(address.city)]
    .filter((part): part is string => Boolean(part))
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(" · ");
}


interface NextStep {
  label: string;
  to: string;
  icon: Icon;
}

/** What happens next to an order, as the one place that does it; null when nothing is waiting on the merchant. */
function nextStepOf(
  stage: OrderStage | undefined,
  orderId: string,
  t: Record<"nextConfirm" | "nextShip" | "nextFollow", string>,
  canConfirm: boolean
): NextStep | null {
  switch (stage) {
    case "pending_confirmation":
    case "needs_follow_up":
      return canConfirm ? { label: t.nextConfirm, to: "/confirmation-queue", icon: IconConfirm } : null;
    case "ready_to_ship":
      // The shipment card, where the courier is booked, is on the page of the order itself.
      return { label: t.nextShip, to: `/orders/${orderId}`, icon: IconCourier };
    case "delivery_failed":
      return { label: t.nextFollow, to: `/orders/${orderId}`, icon: IconPhone };
    default:
      return null;
  }
}

function itemName(item: OrderItem): string {
  return item.offerNameSnapshot || item.productNameSnapshot;
}

function itemOptions(item: OrderItem): string {
  if (!item.variantOptionsSnapshot) return "";
  return Object.values(item.variantOptionsSnapshot).filter(Boolean).join(" · ");
}

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

export interface OrderQuickLookProps {
  /** The order as a list sends it. Null draws nothing (keep the last one while the panel closes). */
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * An order at a glance, without leaving the list it was opened from: what was
 * ordered, what it comes to and how it is paid, where it goes, who to call —
 * and the one thing that happens next, as one button. Everything here is on
 * the row a list already has, so opening it costs no request.
 *
 * Takes an `Order` and nothing else: «آخر الأوردرات» on the home opens it
 * today, and the orders list can open the same panel.
 */
export function OrderQuickLook({ order, open, onOpenChange }: OrderQuickLookProps) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const navigate = useViewNavigate();
  const { currentWorkspace } = useWorkspace();

  if (!order) return null;

  const to = `/orders/${order.id}`;
  const name = order.contactSnapshot?.fullName?.trim() || t.noName;
  const rawPhone = order.contactSnapshot?.phone?.trim() || "";
  const phone = dialablePhone(rawPhone);
  const items = order.items ?? [];
  const pieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const method = labels.paymentMethod(order.paymentMethod);
  const payment = order.paymentProvider ? `${method} · ${providerName(order.paymentProvider)}` : method;
  const address = order.shippingAddressSnapshot;
  const street = address?.addressLine?.trim() || "";
  const town = address
    ? [placeName(address.city), placeName(address.province)]
        .filter((part): part is string => Boolean(part))
        .filter((part, i, all) => all.indexOf(part) === i)
        .join(getLocale() === "ar" ? "، " : ", ")
    : "";
  // The confirmation queue is for the roles that confirm or manage orders (confirmationRoles.ts).
  const role = currentWorkspace?.role ?? "";
  const worksQueue = CONFIRM_ROLES.has(role) || MANAGE_ROLES.has(role);
  const next = nextStepOf(order.stage, order.id, t, worksQueue);
  const NextIcon = next?.icon;

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi dir="ltr">{order.orderNumber}</bdi>}
      subtitle={<bdi>{name}</bdi>}
      status={
        order.stage ? <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={labels.stage(order.stage)} /> : undefined
      }
      to={to}
      actions={
        next && NextIcon ? (
          <Link
            to={next.to}
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 gap-2 rounded-full px-5 sm:min-h-10")}
            onClick={(e) => {
              // A new tab or window belongs to the browser; the preview stays where it is.
              if (!isPlainNavigationClick(e)) return;
              e.preventDefault();
              onOpenChange(false);
              navigate(next.to);
            }}
          >
            {/* A phone, a headset and a van are not directions: never mirrored. */}
            <NextIcon className="size-4" aria-hidden />
            <span className="min-w-0 truncate">{next.label}</span>
          </Link>
        ) : undefined
      }
    >
      <div data-slot="order-peek" className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={order.createdAt}>{fmt(t.placed, { when: formatRelativeTime(order.createdAt) })}</time>
        </p>

        {items.length > 0 && (
          <section>
            <BlockLabel>
              {t.items} · {countOf("piece", pieces)}
            </BlockLabel>
            <ul className="space-y-1">
              {items.map((item) => {
                const options = itemOptions(item);
                return (
                  <li key={item.id} className="flex min-h-12 items-center gap-3">
                    <OrderLineThumb item={item} className="size-11 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-5 font-medium text-ink">
                        <bdi>{itemName(item)}</bdi>
                      </p>
                      <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-ink-soft">
                        <span className="shrink-0 tabular-nums">{fmt(t.times, { n: item.quantity })}</span>
                        {options && (
                          <>
                            <span aria-hidden>·</span>
                            <bdi className="min-w-0 truncate">{options}</bdi>
                          </>
                        )}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm leading-5 font-medium whitespace-nowrap text-ink tabular-nums">
                      <bdi>{formatMoney(item.lineTotalAmount, order.currency)}</bdi>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div role="separator" data-slot="order-peek-rule" className="h-px bg-line" />

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs leading-4 font-medium text-ink-soft">{t.total}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] leading-5 text-ink">
              <IconCash className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <span>{payment}</span>
              {order.paymentMethod !== "cod" && (
                <StatusBadge value={order.financialState} text={labels.financial(order.financialState)} />
              )}
            </p>
          </div>
          <p className="shrink-0 text-[22px] leading-7 font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums">
            <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
          </p>
        </div>

        <div role="separator" data-slot="order-peek-rule" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.address}</BlockLabel>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              data-slot="home-chip"
              data-tone="neutral"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-ink-soft"
            >
              <IconPlace className="size-[18px]" />
            </span>
            {street || town ? (
              <div className="min-w-0 flex-1 self-center">
                {street && (
                  <p className="text-sm leading-5 wrap-anywhere text-ink">
                    <bdi>{street}</bdi>
                  </p>
                )}
                {town && <p className={cn("leading-5", street ? "text-[13px] text-ink-soft" : "text-sm text-ink")}>{town}</p>}
              </div>
            ) : (
              <p className="min-w-0 flex-1 self-center text-sm leading-5 text-ink-soft">{t.noAddress}</p>
            )}
          </div>
        </section>

        <section>
          <BlockLabel>{t.customer}</BlockLabel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {rawPhone ? (
                <p className="text-[15px] leading-6 font-medium text-ink tabular-nums">
                  <bdi dir="ltr">{rawPhone}</bdi>
                </p>
              ) : (
                <p className="text-sm leading-6 text-ink-soft">{t.noPhone}</p>
              )}
              {/* A masked number is shown as it came, and said to be masked: never dressed up as whole. */}
              {rawPhone && !phone && <span className="text-xs leading-5 text-ink-soft">{t.phoneHidden}</span>}
            </div>
            {phone && <ContactActions phone={phone} name={order.contactSnapshot?.fullName} />}
          </div>
        </section>
      </div>
    </QuickLook>
  );
}
