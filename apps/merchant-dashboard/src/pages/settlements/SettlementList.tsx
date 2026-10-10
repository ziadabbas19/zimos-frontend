import type { SettlementListItem } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconCheck, IconCopy, IconDelete, IconQuickLook } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import type { QuickLookRowProps } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatMoney } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { SETTLEMENT_STRINGS } from "./settlementStrings";

/** The settlements sheet from a wide screen up: the courier, when, where it stands, the three amounts, the one step. */
const SETTLEMENT_COLUMNS =
  "grid-cols-[minmax(0,1.4fr)_max-content_max-content_max-content_max-content_max-content_max-content]";

/** Space or Enter on a focused row opens the settlement, the way a press does. */
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

/**
 * The settlements: a card each on the phone — the courier and the net on the
 * first line, the status, the date and the ONE step of a draft («أكّد») on
 * the second — and a sheet of rows from a wide screen. A press opens the
 * settlement in a panel over the list; the menu of a row (right-click, a long
 * press, Shift+F10) has the same steps and copies the reference.
 */
export function SettlementList({
  rows,
  currency,
  compact,
  openId,
  onOpen,
  onConfirm,
  onDelete,
}: {
  rows: ReadonlyArray<SettlementListItem>;
  /** For rows the server stored before it recorded a currency. */
  currency: string;
  compact: boolean;
  /** The settlement whose panel is open. */
  openId: string | null;
  onOpen: (id: string) => void;
  onConfirm: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT(SETTLEMENT_STRINGS);
  const copy = useCopy();

  const items = rows.map((row) => {
    const name = providerName(row.carrierCode);
    const money = (minor: number) => formatMoney(minor, row.currency ?? currency);
    const draft = row.status === "draft";
    const created = formatDate(row.createdAt);
    const open = () => onOpen(row.id);
    const openLabel = fmt(t.peek, { courier: name, date: created });
    const reference = row.reference;

    const menu: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconQuickLook, onSelect: open }];
    if (draft) {
      menu.push({ id: "confirm", label: t.confirm, icon: IconCheck, separatorBefore: true, onSelect: () => onConfirm(row.id) });
      menu.push({ id: "delete", label: t.delete, icon: IconDelete, destructive: true, onSelect: () => onDelete(row.id) });
    }
    if (reference) {
      menu.push({ id: "copy", label: t.menuCopyRef, icon: IconCopy, separatorBefore: true, onSelect: () => copy(reference, t.copiedRef) });
    }

    const status = <StatusBadge value={row.status} text={draft ? t.status_draft : t.status_confirmed} />;
    const action = draft ? <RowAction label={t.confirmShort} icon={compact ? undefined : IconCheck} onClick={() => onConfirm(row.id)} /> : null;

    if (compact) {
      return (
        <li key={row.id}>
          <ContextMenu items={menu} label={t.menuLabel}>
            <ListRowCard
              title={<bdi>{name}</bdi>}
              amount={<bdi dir="ltr">{money(row.netAmount)}</bdi>}
              status={status}
              meta={
                <>
                  {created}
                  {reference && (
                    <>
                      {" · "}
                      <bdi>{reference}</bdi>
                    </>
                  )}
                </>
              }
              action={action}
              onOpen={open}
              openLabel={openLabel}
              aria-haspopup="dialog"
            />
          </ContextMenu>
        </li>
      );
    }

    return (
      <DeskRow
        key={row.id}
        onOpen={open}
        openLabel={openLabel}
        keyProps={openKeys(open)}
        current={openId === row.id}
        menu={menu}
        menuLabel={t.menuLabel}
      >
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{name}</bdi>
          </p>
          {reference && (
            <p className="truncate text-xs leading-5 text-ink-soft">
              <bdi>{reference}</bdi>
            </p>
          )}
        </div>
        <div className="text-xs whitespace-nowrap text-ink-soft">{created}</div>
        <div className="flex items-center">{status}</div>
        <div className="text-end text-sm text-ink tabular-nums">
          <bdi dir="ltr">{money(row.collectedAmount)}</bdi>
        </div>
        <div className="text-end text-sm text-ink-soft tabular-nums">
          <bdi dir="ltr">{money(row.feesAmount)}</bdi>
        </div>
        <div className="text-end text-[15px] font-semibold text-ink tabular-nums">
          <bdi dir="ltr">{money(row.netAmount)}</bdi>
        </div>
        <div className="flex items-center justify-end">{action}</div>
      </DeskRow>
    );
  });

  if (compact) {
    return (
      <ul aria-label={t.viewSettlements} className="flex flex-col gap-2.5">
        {items}
      </ul>
    );
  }
  return (
    <DeskList
      columns={SETTLEMENT_COLUMNS}
      label={t.viewSettlements}
      head={[
        { label: t.colCourier },
        { label: t.colDate },
        { label: t.colStatus },
        { label: t.colCollected, end: true },
        { label: t.colFees, end: true },
        { label: t.colNet, end: true },
        { label: t.colAction, end: true },
      ]}
    >
      {items}
    </DeskList>
  );
}
