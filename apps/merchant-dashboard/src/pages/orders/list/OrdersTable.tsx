import type { NetworkScore } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { useQuickLookRow } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { markViewSource } from "@/lib/viewTransition";
import { useNow } from "@/pages/confirmation/confirmationRoles";
import { NetworkRateBar } from "@/pages/fraud/NetworkRate";
import { OrderColumnCell } from "../components/OrderColumnCell";
import { useColumnLabel, type OrderColumn } from "../components/OrderListFilters";
import { STAGE_TONE } from "../orderLabels";
import { OrderFlag, type OrderRowView } from "./orderRow";

const STRINGS = {
  en: {
    caption: "Orders",
    colCustomer: "Customer",
    colAmount: "Amount",
    colStatus: "Status",
    colPlace: "Place",
    colAge: "Placed",
    colContact: "Call or WhatsApp",
    selectAll: "Select all orders shown",
    selectOrder: "Select order {number}",
    unseen: "Not opened yet",
    phone: "Phone",
    openOrder: "Open order {number}",
    menuLabel: "Actions for order {number}",
    none: "—",
  },
  ar: {
    caption: "الطلبات",
    colCustomer: "العميل",
    colAmount: "المبلغ",
    colStatus: "الحالة",
    colPlace: "المكان",
    colAge: "وقت الطلب",
    colContact: "اتصال أو واتساب",
    selectAll: "تحديد كل الطلبات المعروضة",
    selectOrder: "تحديد الطلب {number}",
    unseen: "لم يُفتح بعد",
    phone: "الهاتف",
    openOrder: "فتح الطلب {number}",
    menuLabel: "إجراءات الطلب {number}",
    none: "—",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

export interface OrdersTableProps {
  rows: readonly OrderRowView[];
  /** The merchant's optional columns, after the fixed ones. */
  columns: readonly OrderColumn[];
  selected: ReadonlySet<string>;
  onToggle: (orderId: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  /** Delivery rates by customer id (useNetworkScores). */
  scores: Record<string, NetworkScore>;
  menuFor: (view: OrderRowView) => ContextMenuItem[];
  /** Quick Look. */
  onPeek: (view: OrderRowView) => void;
  /** The order's own page. */
  onOpen: (view: OrderRowView) => void;
}

/** Things in a row that are pressed for themselves: a press on one is not a press on the row. */
const ROW_CONTROLS = "a, button, input, label, select, textarea, [role='button'], [role='menuitem']";

/** Whether a click that reached the row was meant for the row: inside it, not on one of its controls, not the end of a text selection. */
function isRowPress(target: EventTarget, row: HTMLElement): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return false;
  return (window.getSelection()?.toString() ?? "") === "";
}

/**
 * The orders as one table on a sheet of glass, from md up. Fixed leading
 * columns — who (the name; under it the order number, which opens the order,
 * and the phone), how much, where it stands, where it goes, how long ago —
 * then the merchant's own columns, and call / WhatsApp at the row's end.
 *
 * A row opens Quick Look (a click anywhere on it, or Space while it has
 * focus); Enter on it, or its order number, opens the order's page, the name,
 * amount and status travelling into that page's header. Right-click gives the
 * row's menu. The tick box selects it for the bulk bar; a selected row tints.
 *
 * Material (the row under the pointer, the selected tint, the small chips) is
 * in glass/orders.css; without the glass layer it is a solid raised sheet.
 */
export function OrdersTable({ rows, columns, selected, onToggle, allSelected, onToggleAll, scores, menuFor, onPeek, onOpen }: OrdersTableProps) {
  const t = useT(STRINGS);
  const columnLabel = useColumnLabel();
  // One clock for the whole list, so every row's "3 hours ago" moves together.
  const now = useNow(60_000);
  const someSelected = rows.some((row) => selected.has(row.order.id));
  const head = "px-3 py-3 text-start font-medium whitespace-nowrap";

  return (
    <div
      data-slot="orders-table"
      className="zimos-orders-table overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <table className="zimos-orders-grid w-full min-w-[46rem] text-sm [&>tbody>tr>td]:py-2">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className="w-11 py-1 ps-2 pe-0">
              <label className="flex size-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={allSelected}
                  ref={(box) => {
                    // Some but not all: the box says so with a dash.
                    if (box) box.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleAll}
                  aria-label={t.selectAll}
                />
              </label>
            </th>
            <th scope="col" className={head}>
              {t.colCustomer}
            </th>
            <th scope="col" className={head}>
              {t.colAmount}
            </th>
            <th scope="col" className={head}>
              {t.colStatus}
            </th>
            <th scope="col" className={head}>
              {t.colPlace}
            </th>
            <th scope="col" className={head}>
              {t.colAge}
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 text-start font-medium whitespace-nowrap">
                {columnLabel(column)}
              </th>
            ))}
            <th scope="col" className="px-3 py-3">
              <span className="sr-only">{t.colContact}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((view) => (
            <OrderTableRow
              key={view.order.id}
              view={view}
              columns={columns}
              selected={selected.has(view.order.id)}
              onToggle={onToggle}
              score={scores[view.order.customerId]}
              menu={menuFor(view)}
              onPeek={onPeek}
              onOpen={onOpen}
              now={now}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTableRow({
  view,
  columns,
  selected,
  onToggle,
  score,
  menu,
  onPeek,
  onOpen,
  now,
  t,
}: {
  view: OrderRowView;
  columns: readonly OrderColumn[];
  selected: boolean;
  onToggle: (orderId: string) => void;
  score: NetworkScore | undefined;
  menu: ContextMenuItem[];
  onPeek: (view: OrderRowView) => void;
  onOpen: (view: OrderRowView) => void;
  now: number;
  t: Strings;
}) {
  const { order, to, name, rawPhone, phone, place, money, stageLabel, meta, flags } = view;
  // Space on the focused row peeks; a key pressed on one of its controls is that control's.
  const peekProps = useQuickLookRow(() => onPeek(view));

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { number: order.orderNumber })}>
      <tr
        data-order-row={order.id}
        data-selected={selected ? "" : undefined}
        tabIndex={peekProps.tabIndex}
        onKeyDown={(e) => {
          peekProps.onKeyDown(e);
          // Enter, on the row itself, opens the order's page.
          if (e.key !== "Enter" || e.target !== e.currentTarget || e.defaultPrevented || e.repeat) return;
          e.preventDefault();
          onOpen(view);
        }}
        onClick={(e) => {
          if (!isRowPress(e.target, e.currentTarget)) return;
          // Ctrl / ⌘ + click is "in a new tab", as on a link.
          if (e.metaKey || e.ctrlKey) {
            window.open(to, "_blank", "noopener");
            return;
          }
          onPeek(view);
        }}
        className={cn(
          "zimos-orders-row group/row cursor-pointer border-b border-line outline-none last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
          selected && "bg-primary-soft/50"
        )}
      >
        {/* The start edge of a selected row carries the brand colour; the edge is always there, so nothing shifts when it lights. */}
        <td className="w-11 border-s-[3px] border-s-transparent ps-1.5 pe-0 group-data-[selected]/row:border-s-primary">
          <label className="flex size-11 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-primary"
              checked={selected}
              onChange={() => onToggle(order.id)}
              aria-label={fmt(t.selectOrder, { number: order.orderNumber })}
            />
          </label>
        </td>

        <td className="max-w-72 px-3">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {!meta.isSeen && (
              <span className="zimos-row-dot size-2 shrink-0 rounded-full bg-primary" role="img" aria-label={t.unseen} title={t.unseen} />
            )}
            <span data-vt-part="title" className={cn("min-w-0 truncate text-[15px] leading-6 text-ink", meta.isSeen ? "font-medium" : "font-semibold")}>
              <bdi>{name}</bdi>
            </span>
            {flags.map((flag) => (
              <OrderFlag key={flag.id} flag={flag} />
            ))}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
            <ViewLink
              to={to}
              aria-label={fmt(t.openOrder, { number: order.orderNumber })}
              // The row is the source of the journey into the order's page.
              onClick={(e) => markViewSource(e.currentTarget.closest("tr"))}
              className="zimos-order-number relative shrink-0 rounded-sm font-medium text-ink underline-offset-2 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:before:absolute pointer-coarse:before:-inset-x-2 pointer-coarse:before:-inset-y-3"
            >
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </ViewLink>
            {rawPhone && (
              <>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate tabular-nums">
                  <span className="sr-only">{t.phone}: </span>
                  <bdi dir="ltr">{rawPhone}</bdi>
                </span>
              </>
            )}
          </div>
        </td>

        <td className="px-3 whitespace-nowrap">
          <span data-vt-part="amount" className="inline-block text-[15px] font-semibold text-ink tabular-nums">
            <bdi>{money}</bdi>
          </span>
        </td>

        <td className="px-3">
          {order.stage && stageLabel ? (
            <span data-vt-part="status" className="inline-flex">
              <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={stageLabel} />
            </span>
          ) : (
            <span className="text-ink-soft">{t.none}</span>
          )}
          {/* The customer's delivery rate: only when there is one. */}
          <div className="mt-1 flex flex-wrap items-center gap-1 empty:hidden">{score && <NetworkRateBar score={score} />}</div>
        </td>

        <td className="max-w-44 px-3 text-[13px] leading-5 text-ink-soft">
          <span className="line-clamp-2">{place || t.none}</span>
        </td>

        <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft">
          <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>
            {formatRelative(order.createdAt, now, getIntlLocale())}
          </time>
        </td>

        {columns.map((column) => (
          <OrderColumnCell key={column} column={column} row={view} paymentLabel={view.paymentLabel} now={now} />
        ))}

        <td className="w-px px-3">
          {/* One tap to call or message. A masked number offers neither: there is nothing to dial. */}
          {phone && <ContactActions phone={phone} name={order.contactSnapshot?.fullName} variant="icon" className="justify-end" />}
        </td>
      </tr>
    </ContextMenu>
  );
}
