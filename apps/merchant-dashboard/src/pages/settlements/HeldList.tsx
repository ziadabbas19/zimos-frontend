import type { ReactNode } from "react";
import type { StatementHeld, UnsettledCarrier } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import type { QuickLookRowProps } from "@/components/QuickLook";
import { IconCash } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { LATE_DAYS, SETTLEMENT_STRINGS } from "./settlementStrings";

/** What one courier holds: how much, for how many orders, how old — and how many of them can be settled now. */
export interface HeldRow {
  code: string;
  /** Everything the courier still holds (orders sitting in a draft included, when the aging report is readable). */
  due: number;
  orders: number;
  /** Delivered orders not on any settlement yet: what «سجّل تحويل» can take. */
  ready: number;
  /** The amount by days since delivery; null when the aging report is not readable for this role. */
  buckets: { upTo7: number; upTo14: number; over14: number } | null;
  oldest: string | null;
}

/**
 * One list out of the two answers the API gives about the same money: the
 * orders that can be settled (`/settlements/unsettled`, per courier) and the
 * aging of everything a courier holds (`/settlements/held`). A courier in
 * either is a row; the aging columns are filled where the report has them.
 */
export function heldRows(carriers: ReadonlyArray<UnsettledCarrier>, held: StatementHeld | null): HeldRow[] {
  const rows = new Map<string, HeldRow>();
  for (const carrier of held?.carriers ?? []) {
    rows.set(carrier.carrierCode, {
      code: carrier.carrierCode,
      due: carrier.dueAmount,
      orders: carrier.orders,
      ready: 0,
      buckets: carrier.buckets,
      oldest: carrier.oldestDeliveredAt,
    });
  }
  for (const carrier of carriers) {
    const known = rows.get(carrier.carrierCode);
    if (known) known.ready = carrier.orders;
    else rows.set(carrier.carrierCode, { code: carrier.carrierCode, due: carrier.dueAmount, orders: carrier.orders, ready: carrier.orders, buckets: null, oldest: null });
  }
  // The courier holding the most first.
  return [...rows.values()].sort((a, b) => b.due - a.due);
}

/** The held sheet from a wide screen up: the courier, the three ages, the total, the one step. */
const HELD_COLUMNS = "grid-cols-[minmax(0,1.5fr)_max-content_max-content_max-content_max-content_max-content]";

/** Space or Enter on a focused row does what a press on it does. */
function openKeys(open: () => void): QuickLookRowProps {
  return {
    tabIndex: 0,
    onKeyDown(event) {
      if (event.target !== event.currentTarget || event.repeat || event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    },
  };
}

/** A small quiet pill for one age band on a card. */
function BandChip({ label, amount, late = false }: { label: string; amount: string; late?: boolean }) {
  return (
    <span
      data-slot="held-band"
      data-late={late ? "" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        late ? "bg-danger-soft text-danger" : "bg-paper-sunken text-ink-soft"
      )}
    >
      {label}
      <bdi dir="ltr" className="tabular-nums">
        {amount}
      </bdi>
    </span>
  );
}

/**
 * What the couriers hold, courier by courier: a card each on the phone — the
 * courier and the amount on the first line, how late it is and the ONE step
 * («سجّل تحويل») on the second, the three ages as chips — and a sheet of rows
 * from a wide screen, the ages as columns. A press on a row with orders to
 * settle opens the transfer sheet for that courier.
 */
export function HeldList({
  rows,
  currency,
  compact,
  onRecord,
}: {
  rows: ReadonlyArray<HeldRow>;
  currency: string;
  /** Cards (narrow screens) or the sheet of rows. */
  compact: boolean;
  onRecord: (carrierCode: string) => void;
}) {
  const t = useT(SETTLEMENT_STRINGS);
  const money = (minor: number) => formatMoney(minor, currency);
  const band7 = fmt(t.daysBand, { from: 0, to: 7 });
  const band14 = fmt(t.daysBand, { from: 8, to: LATE_DAYS });
  const bandOver = fmt(t.daysOver, { n: LATE_DAYS });

  const items = rows.map((row) => {
    const name = providerName(row.code);
    const canRecord = row.ready > 0;
    const record = canRecord ? () => onRecord(row.code) : undefined;
    const late = row.buckets ? row.buckets.over14 : 0;
    const facts = row.oldest
      ? fmt(t.ordersOldest, { orders: countOf("order", row.orders), date: formatDate(row.oldest) })
      : countOf("order", row.orders);
    const action: ReactNode = record ? (
      <RowAction label={t.record} icon={compact ? undefined : IconCash} onClick={record} />
    ) : (
      <span className="text-xs leading-5 text-ink-soft">{t.inDraft}</span>
    );
    const openLabel = fmt(t.recordFor, { courier: name });

    if (compact) {
      return (
        <li key={row.code}>
          <ListRowCard
            title={<bdi>{name}</bdi>}
            amount={<bdi dir="ltr">{money(row.due)}</bdi>}
            status={
              row.buckets ? (
                late > 0 ? (
                  <StatusBadge value="late" tone="danger" text={fmt(t.lateChip, { amount: money(late), n: LATE_DAYS })} />
                ) : (
                  <StatusBadge value="on_time" tone="success" text={fmt(t.onTime, { n: LATE_DAYS })} />
                )
              ) : undefined
            }
            meta={row.buckets ? undefined : facts}
            action={record ? action : undefined}
            footer={
              <>
                {row.buckets && row.buckets.upTo7 > 0 && <BandChip label={band7} amount={money(row.buckets.upTo7)} />}
                {row.buckets && row.buckets.upTo14 > 0 && <BandChip label={band14} amount={money(row.buckets.upTo14)} />}
                {row.buckets && <span className="text-xs leading-5 text-ink-soft">{facts}</span>}
                {!record && <span className="text-xs leading-5 text-ink-soft">{t.inDraft}</span>}
              </>
            }
            onOpen={record}
            openLabel={record ? openLabel : undefined}
            aria-haspopup={record ? "dialog" : undefined}
          />
        </li>
      );
    }

    const cell = (amount: number | undefined, danger = false) =>
      amount === undefined ? (
        <span className="text-ink-soft">—</span>
      ) : (
        <bdi dir="ltr" className={cn(danger && amount > 0 && "font-semibold text-danger")}>
          {money(amount)}
        </bdi>
      );

    return (
      <DeskRow key={row.code} onOpen={record} openLabel={openLabel} keyProps={record ? openKeys(record) : undefined}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{name}</bdi>
          </p>
          <p className="truncate text-xs leading-5 text-ink-soft">{facts}</p>
        </div>
        <div className="text-end text-sm text-ink tabular-nums">{cell(row.buckets?.upTo7)}</div>
        <div className="text-end text-sm text-ink tabular-nums">{cell(row.buckets?.upTo14)}</div>
        <div className="text-end text-sm text-ink tabular-nums">{cell(row.buckets?.over14, true)}</div>
        <div className="text-end text-[15px] font-semibold text-ink tabular-nums">
          <bdi dir="ltr">{money(row.due)}</bdi>
        </div>
        <div className="flex items-center justify-end">{action}</div>
      </DeskRow>
    );
  });

  if (compact) {
    return (
      <ul aria-label={t.heldLabel} className="flex flex-col gap-2.5">
        {items}
      </ul>
    );
  }
  return (
    <DeskList
      columns={HELD_COLUMNS}
      label={t.heldLabel}
      head={[
        { label: t.colCourier },
        { label: band7, end: true },
        { label: band14, end: true },
        { label: bandOver, end: true },
        { label: t.colTotal, end: true },
        { label: t.colAction, end: true },
      ]}
    >
      {items}
    </DeskList>
  );
}
