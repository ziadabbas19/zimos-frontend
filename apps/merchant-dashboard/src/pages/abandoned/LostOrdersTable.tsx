import type { MouseEvent } from "react";
import { cn } from "@store-builder/ui";
import type { LostOrder } from "@store-builder/api-client";
import { ContextMenu } from "@/components/ContextMenu";
import { useQuickLookRow } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useViewNavigate } from "@/lib/viewTransition";
import type { LostOrderSelection } from "./LostOrdersBulk";
import { LostOrderAction, RecoveryChip, RowCheck } from "./LostOrderParts";
import { useLostOrderLabels } from "./lostOrderLabels";
import { needsAttention, type LostOrderRowActions } from "./lostOrderModel";

const STRINGS = {
  en: {
    caption: "Lost orders",
    colCustomer: "Customer",
    colValue: "Basket value",
    colStatus: "Recovery and reason",
    colBasket: "Basket",
    colAge: "Last activity",
    colAction: "Action",
    selectAll: "Select all shown",
    select: "Select {name}",
    menu: "Actions for {name}",
    line: "{name} × {qty}",
    more: "+{n} more",
  },
  ar: {
    caption: "الطلبات المفقودة",
    colCustomer: "العميل",
    colValue: "قيمة السلة",
    colStatus: "الاسترجاع والسبب",
    colBasket: "السلة",
    colAge: "آخر نشاط",
    colAction: "إجراء",
    selectAll: "تحديد كل المعروض",
    select: "تحديد {name}",
    menu: "إجراءات {name}",
    line: "{name} × {qty}",
    more: "+{n} أخرى",
  },
} satisfies Messages;

const HEAD = "px-3 text-start font-medium whitespace-nowrap";

/** A press on something in the row that is itself a control (the tick box, the action, a link) is not a press on the row. */
function fromControl(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  // Inside something the row portals (its context menu): not the row's either.
  if (!event.currentTarget.contains(target)) return true;
  const control = target.closest("a, button, input, label, select, [role='button']");
  return control !== null && control !== event.currentTarget;
}

/**
 * The list from md up: one glass sheet (the kit's `.zimos-list-sheet`, the
 * same box ListSkeleton holds room with). Who and the basket's value first;
 * then the recovery chip with the reason in words under it, the basket, how
 * long ago, and the row's ONE action at the end. A row opens Quick Look (a
 * click, or Space on the focused row; Enter goes to the order once the
 * checkout became one). Right-click is the context menu. Rows that are no
 * longer waiting for the merchant are written quieter.
 */
export function LostOrdersTable({
  rows,
  selection,
  actions,
}: {
  rows: readonly LostOrder[];
  selection: LostOrderSelection;
  actions: LostOrderRowActions;
}) {
  const t = useT(STRINGS);
  return (
    <div
      data-slot="lost-table"
      className="zimos-list-sheet overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      {/* relative: the visually hidden caption is positioned against this box, so it is clipped with the table. */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[60rem] table-fixed text-sm">
          <caption className="sr-only">{t.caption}</caption>
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-28" />
            <col className="w-44" />
            <col />
            <col className="w-[7.5rem]" />
            <col className="w-[11.5rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
              <th scope="col" className="ps-2 pe-0 text-start font-medium">
                {/* The tick box keeps its full target; the margins keep the head from growing around it. */}
                <div className="-my-2">
                  <RowCheck
                    checked={selection.allOn}
                    mixed={selection.ids.length > 0}
                    onChange={(on) => (on ? selection.selectAll() : selection.clear())}
                    label={t.selectAll}
                  />
                </div>
              </th>
              <th scope="col" className={HEAD}>
                {t.colCustomer}
              </th>
              <th scope="col" className={cn(HEAD, "text-end")}>
                {t.colValue}
              </th>
              <th scope="col" className={HEAD}>
                {t.colStatus}
              </th>
              <th scope="col" className={HEAD}>
                {t.colBasket}
              </th>
              <th scope="col" className={HEAD}>
                {t.colAge}
              </th>
              <th scope="col" className="ps-3 pe-4 text-end font-medium">
                <span className="sr-only">{t.colAction}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((session) => (
              <Row
                key={session.id}
                session={session}
                selected={selection.has(session.id)}
                onSelected={(on) => selection.toggle(session.id, on)}
                actions={actions}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  session,
  selected,
  onSelected,
  actions,
}: {
  session: LostOrder;
  selected: boolean;
  onSelected: (selected: boolean) => void;
  actions: LostOrderRowActions;
}) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const navigate = useViewNavigate();
  const name = labels.name(session);
  const quiet = !needsAttention(session);
  const why = labels.why(session);
  const stage = labels.stage(session);
  // Under the name: the number — unless the number IS the name (a lost order with no name yet).
  const showPhone = Boolean(session.phone?.trim()) && Boolean(session.customerName?.trim());
  const peekProps = useQuickLookRow(() => actions.peek(session));
  // A row still waiting for the merchant is written at full strength; the others step back.
  const strong = quiet ? "font-medium text-ink-soft" : "font-semibold text-ink";

  return (
    <ContextMenu items={actions.menuFor(session)} label={fmt(t.menu, { name })}>
      <tr
        tabIndex={peekProps.tabIndex}
        data-slot="lost-row"
        data-quiet={quiet ? "" : undefined}
        data-selected={selected ? "" : undefined}
        onClick={(event) => {
          if (fromControl(event)) return;
          // Dragging over the words to copy them ends in a click too: that is not asking to open the row.
          if (window.getSelection()?.toString()) return;
          actions.peek(session);
        }}
        onKeyDown={(event) => {
          // Space peeks (Quick Look's own rule); Enter opens fully — the order, once the checkout became one.
          peekProps.onKeyDown(event);
          if (event.defaultPrevented || event.target !== event.currentTarget || event.key !== "Enter") return;
          event.preventDefault();
          if (session.convertedOrder) navigate(`/orders/${session.convertedOrder.id}`);
          else actions.peek(session);
        }}
        className={cn(
          "cursor-pointer border-b border-line outline-none last:border-0 focus-visible:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
          selected ? "bg-primary-soft" : "hover:bg-paper-sunken"
        )}
      >
        <td className="ps-2 pe-0">
          <RowCheck checked={selected} onChange={onSelected} label={fmt(t.select, { name })} />
        </td>

        <td className="px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("min-w-0 truncate", strong)}>
              <bdi>{name}</bdi>
            </span>
            {session.source === "funnel" && (
              <StatusBadge value="funnel" tone="neutral" text={labels.source("funnel")} className="shrink-0" />
            )}
          </div>
          {showPhone && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
              <bdi dir="ltr" className="shrink-0 tabular-nums">
                {session.phone}
              </bdi>
            </div>
          )}
        </td>

        <td className="px-3 text-end">
          <bdi className={cn("whitespace-nowrap tabular-nums", strong)}>{formatMoney(session.subtotalAmount, session.currency)}</bdi>
        </td>

        <td className="px-3">
          <RecoveryChip status={session.recoveryStatus} />
          {why && (
            <span
              className={cn("mt-1 block truncate text-[13px] leading-5", why.warn ? "font-medium text-accent-dark" : "text-ink-soft")}
              title={stage ? `${why.text} · ${stage}` : why.text}
            >
              {why.text}
              {stage && ` · ${stage}`}
            </span>
          )}
        </td>

        <td className="px-3 text-[13px] leading-5 text-ink-soft">
          {session.items.slice(0, 2).map((item, i) => (
            <div key={`${item.variantId}-${i}`} className="truncate" dir="auto">
              {fmt(t.line, { name: item.productName, qty: item.quantity })}
            </div>
          ))}
          {session.items.length > 2 && <div className="text-xs">{fmt(t.more, { n: session.items.length - 2 })}</div>}
        </td>

        <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft">
          <time dateTime={session.lastActivityAt} title={formatDateTime(session.lastActivityAt)}>
            {labels.ago(session.lastActivityAt)}
          </time>
        </td>

        <td className="ps-3 pe-4">
          <div className="flex justify-end">
            <LostOrderAction session={session} actions={actions} />
          </div>
        </td>
      </tr>
    </ContextMenu>
  );
}
