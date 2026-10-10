import type { ReactNode } from "react";
import type { FlaggedOrder } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { IconBlock, IconCheck, IconConfirm, IconWarning } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { FLAGGED_STRINGS, riskTone } from "./flaggedText";

/** In the footer of the preview a pill is as tall as the "open" link beside it: 40px with a mouse (44px under a finger, as everywhere). */
const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

export interface FlaggedQuickLookProps {
  /** The order being looked at. Null draws nothing (keep the last one while the panel closes). */
  order: FlaggedOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** This role may clear a flag and block (orders.manage). */
  canDecide: boolean;
  /** «سيبه يعدّي» is on its way to the server for this order. */
  passing: boolean;
  onPass: () => void;
  onBlock: () => void;
}

/**
 * A flagged order at a glance: every reason a rule flagged it for, what it
 * comes to, who to call — and both decisions in the footer, «سيبه يعدّي» and
 * «احجب والغي» (which asks first). The same orders wait in the confirmation
 * queue; a link goes there.
 */
export function FlaggedQuickLook({ order, open, onOpenChange, canDecide, passing, onPass, onBlock }: FlaggedQuickLookProps) {
  const t = useT(FLAGGED_STRINGS);
  const labels = useOrderLabels();
  if (!order) return null;

  const name = order.customerName?.trim() || t.noName;
  const rawPhone = order.phone?.trim() || "";
  const phone = dialablePhone(rawPhone);
  const tone = riskTone(order);

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi dir="ltr">{order.orderNumber}</bdi>}
      subtitle={<bdi>{name}</bdi>}
      status={<StatusBadge value={order.confirmationState} text={labels.confirmation(order.confirmationState)} />}
      to={`/orders/${order.id}`}
      openLabel={t.menuOpen}
      actions={
        canDecide ? (
          <>
            {!order.cancelled && <RowAction className={FOOTER_PILL} tone="danger" label={t.block} icon={IconBlock} disabled={passing} onClick={onBlock} />}
            <RowAction className={FOOTER_PILL} label={t.pass} icon={IconCheck} busy={passing} onClick={onPass} />
          </>
        ) : undefined
      }
    >
      <div data-slot="flagged-peek" className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>
            {fmt(t.placed, { when: formatRelativeTime(order.createdAt) })}
          </time>
          <span aria-hidden>·</span>
          <span>{formatDate(order.createdAt)}</span>
          {order.cancelled && <StatusBadge value="cancelled" text={t.cancelled} />}
        </p>

        {order.riskFlags.length > 0 && (
          <section>
            <BlockLabel>{t.reasons}</BlockLabel>
            <ul data-slot="flagged-reasons" data-tone={tone} className="space-y-1.5">
              {order.riskFlags.map((flag) => (
                <li
                  key={flag}
                  className={
                    tone === "danger"
                      ? "flex min-h-11 items-center gap-2.5 rounded-2xl bg-danger-soft px-3 py-2 text-sm leading-5 font-medium text-danger"
                      : "flex min-h-11 items-center gap-2.5 rounded-2xl bg-accent-soft px-3 py-2 text-sm leading-5 font-medium text-accent-dark"
                  }
                >
                  <IconWarning className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">{labels.riskFlag(flag)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-end justify-between gap-3">
          <p className="text-xs leading-4 font-medium text-ink-soft">{t.total}</p>
          <p className="shrink-0 text-[22px] leading-7 font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums">
            <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
          </p>
        </div>

        <div role="separator" data-slot="flagged-peek-rule" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.customer}</BlockLabel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-6 font-medium text-ink">
                <bdi>{name}</bdi>
              </p>
              {rawPhone ? (
                <p className="text-sm leading-5 text-ink-soft tabular-nums">
                  <bdi dir="ltr">{rawPhone}</bdi>
                </p>
              ) : (
                <p className="text-sm leading-5 text-ink-soft">{t.noPhone}</p>
              )}
            </div>
            {phone && <ContactActions phone={phone} name={order.customerName} />}
          </div>
          {/* A masked number is shown as it came, and said to be masked: never dressed up as whole. */}
          {rawPhone && !phone && <p className="mt-1.5 text-xs leading-5 text-ink-soft">{t.phoneHidden}</p>}
        </section>

        <div className="space-y-1">
          {canDecide && <p className="text-[13px] leading-5 text-ink-soft">{t.passHint}</p>}
          <ViewLink
            to="/confirmation-queue"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {/* A phone is not a direction: never mirrored. */}
            <IconConfirm className="size-4 shrink-0" aria-hidden />
            {t.queueLink}
          </ViewLink>
        </div>
      </div>
    </QuickLook>
  );
}
