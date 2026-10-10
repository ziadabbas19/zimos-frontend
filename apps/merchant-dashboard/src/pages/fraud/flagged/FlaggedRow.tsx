import type { FlaggedOrder } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconBlock, IconCheck, IconCopy, IconOrders, IconPhone, IconWhatsApp } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { FLAGGED_STRINGS, riskTone } from "./flaggedText";

/** The columns of the flagged sheet: who, why, how much, where the call stands, the decision. */
export const FLAGGED_COLUMNS = "grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_max-content_max-content_max-content]";

/** How many reasons a row shows before the rest fold into "+n" (all of them are in Quick Look). */
const FLAGS_SHOWN = 2;

// The accent at the start edge of a flagged row: structure, so it is there with the glass layer off too.
// The wash behind it is material (glass/returns-protection.css, `.zimos-flagged`).
const ACCENT = "zimos-flagged before:pointer-events-none before:absolute before:inset-y-3 before:start-0 before:w-[3px] before:rounded-full before:content-['']";

export interface FlaggedRowProps {
  order: FlaggedOrder;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** This role may clear a flag and block (orders.manage). */
  canDecide: boolean;
  /** «سيبه يعدّي» is on its way to the server for this order. */
  passing: boolean;
  /** Its preview is open. */
  current: boolean;
  onPeek: () => void;
  onPass: () => void;
  onBlock: () => void;
}

/**
 * One flagged order: who, how much, why a rule flagged it, where its
 * confirmation call stands — and ONE decision: «احجب والغي», which asks first.
 * («سيبه يعدّي» is the button of an order that is already cancelled, where
 * there is nothing left to cancel; everywhere else it is in Quick Look and in
 * the menu of the row.) A press anywhere else opens Quick Look; Enter opens
 * the order. A role that cannot decide gets call and WhatsApp in that place.
 */
export function FlaggedRow({ order, compact, canDecide, passing, current, onPeek, onPass, onBlock }: FlaggedRowProps) {
  const t = useT(FLAGGED_STRINGS);
  const labels = useOrderLabels();
  const navigate = useViewNavigate();
  const copy = useCopy();

  const to = `/orders/${order.id}`;
  const name = order.customerName?.trim() || t.noName;
  // Masked for roles without customers.reveal_sensitive (010****665): not a number to dial or copy.
  const phone = dialablePhone(order.phone);
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const tone = riskTone(order);
  const keys = rowKeyProps(onPeek, () => navigate(to));
  const peekLabel = fmt(t.peek, { order: order.orderNumber });
  const menuLabel = fmt(t.menuLabel, { order: order.orderNumber });

  const menu: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconOrders, onSelect: () => navigate(to) }];
  if (phone) {
    menu.push({
      id: "call",
      label: t.menuCall,
      icon: IconPhone,
      separatorBefore: true,
      onSelect: () => {
        window.location.href = orderTelHref(phone);
      },
    });
  }
  if (whatsapp) {
    menu.push({
      id: "whatsapp",
      label: t.menuWhatsapp,
      icon: IconWhatsApp,
      onSelect: () => {
        window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
      },
    });
  }
  if (phone) {
    menu.push({ id: "copy-phone", label: t.menuCopyPhone, icon: IconCopy, separatorBefore: true, onSelect: () => copy(phone, t.copiedPhone) });
  }
  menu.push({
    id: "copy-order",
    label: t.menuCopyOrder,
    icon: IconCopy,
    separatorBefore: !phone,
    onSelect: () => copy(order.orderNumber, t.copiedOrder),
  });
  if (canDecide) {
    menu.push({ id: "pass", label: t.pass, icon: IconCheck, separatorBefore: true, disabled: passing, onSelect: onPass });
    if (!order.cancelled) menu.push({ id: "block", label: t.block, icon: IconBlock, destructive: true, disabled: passing, onSelect: onBlock });
  }

  const decision = !canDecide ? null : order.cancelled ? (
    <RowAction tone="quiet" label={t.pass} icon={IconCheck} busy={passing} onClick={onPass} />
  ) : (
    <RowAction tone="danger" label={t.block} icon={IconBlock} disabled={passing} onClick={onBlock} />
  );

  const status = <StatusBadge value={order.confirmationState} text={labels.confirmation(order.confirmationState)} />;
  const age = (
    <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>
      {formatRelativeTime(order.createdAt)}
    </time>
  );
  const more = order.riskFlags.length - FLAGS_SHOWN;
  const flags = (
    <>
      {order.riskFlags.slice(0, FLAGS_SHOWN).map((flag) => (
        <StatusBadge key={flag} value={flag} tone={tone === "danger" ? "danger" : "warning"} text={labels.riskFlag(flag)} className="max-w-full" />
      ))}
      {more > 0 && <span className="text-xs font-medium text-ink-soft tabular-nums">{fmt(t.moreFlags, { n: more })}</span>}
      {order.cancelled && <StatusBadge value="cancelled" text={t.cancelled} />}
    </>
  );
  const accent = cn(ACCENT, tone === "danger" ? "zimos-flagged-danger before:bg-danger" : "zimos-flagged-warn before:bg-accent");

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={menuLabel}>
          <ListRowCard
            className={accent}
            title={<bdi data-vt-part="title">{name}</bdi>}
            amount={<bdi data-vt-part="amount">{formatMoney(order.totalAmount, order.currency)}</bdi>}
            status={status}
            meta={
              <>
                <bdi dir="ltr">{order.orderNumber}</bdi>
                <span aria-hidden> · </span>
                {age}
              </>
            }
            // With no decision to take, the place of the button goes to calling the customer.
            action={decision ?? (phone ? <ContactActions phone={phone} name={order.customerName} variant="icon" /> : null)}
            footer={flags}
            onOpen={onPeek}
            openLabel={peekLabel}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={menuLabel} className={accent}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          <bdi data-vt-part="title">{name}</bdi>
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
          {/* The number is the way to the order's page; the row itself opens the preview. */}
          <ViewLink
            to={to}
            aria-label={fmt(t.openOrder, { number: order.orderNumber })}
            className="shrink-0 rounded-sm tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <bdi dir="ltr">{order.orderNumber}</bdi>
          </ViewLink>
          <span aria-hidden>·</span>
          <span className="min-w-0 truncate">{age}</span>
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{flags}</div>

      <p className="text-end text-sm font-semibold whitespace-nowrap text-ink tabular-nums">
        <bdi data-vt-part="amount">{formatMoney(order.totalAmount, order.currency)}</bdi>
      </p>

      <div className="flex items-center">{status}</div>

      <div className="flex items-center justify-end gap-2">
        {phone && <ContactActions phone={phone} name={order.customerName} variant="icon" />}
        {decision}
      </div>
    </DeskRow>
  );
}
