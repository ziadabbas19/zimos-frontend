import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import type { Discount } from "@store-builder/api-client";
import { IconMoreActions } from "@/components/icons";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ListRowCard } from "@/components/list";
import { formatCount } from "@/lib/analytics";
import { formatMinorMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import type { DiscountResults } from "@/pages/discounts/DiscountResults";
import { DISCOUNT_STRINGS, STATUS_LABEL, TYPE_LABEL, dateRangeLabel, displayStatus, type DiscountStrings } from "./discountModel";
// «اشترِ 2 واحصل على 1 مجانًا» for a buy-X-get-Y discount, the usual value otherwise.
import { DiscountValueLabel } from "./BuyXGetYFields";

interface ListProps {
  rows: readonly Discount[];
  results: DiscountResults;
  /** The row's menu: the same items on right-click / long-press and behind «…». */
  menuFor: (discount: Discount) => ContextMenuItem[];
  /** Opens the discount's sheet (its form, its results, its actions). */
  onOpen: (discount: Discount) => void;
}

/** Things in a row that are pressed for themselves: a press on one is not a press on the row. */
const ROW_CONTROLS = "a, button, input, label, select, textarea, [role='button'], [role='menuitem']";

function isRowPress(target: EventTarget, row: HTMLElement): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return false;
  return (window.getSelection()?.toString() ?? "") === "";
}

const name = (discount: Discount, t: DiscountStrings) => discount.code ?? t.automatic;

/** «٣ من ١٠ استخدام» / «٣ استخدام». */
function usesLabel(discount: Discount, t: DiscountStrings): string {
  return discount.usageLimit != null
    ? fmt(t.usesOf, { used: formatCount(discount.usageCount), limit: formatCount(discount.usageLimit) })
    : fmt(t.uses, { used: formatCount(discount.usageCount) });
}

/** A menu line: 36px with a mouse, 44px under a finger. */
const MENU_ITEM = "min-h-9 cursor-pointer gap-3 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";

/** «…» at the end of a table row: the row's menu for a pointer that does not right-click. */
function RowMenu({ items, label }: { items: ContextMenuItem[]; label: string }) {
  const { dir } = useLocale();
  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              title={label}
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-ink/8 aria-expanded:text-ink motion-reduce:transition-none pointer-coarse:size-11"
            />
          }
        >
          <IconMoreActions className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-auto min-w-52 rounded-[1.125rem] p-1.5">
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  className={MENU_ITEM}
                >
                  {ItemIcon && <ItemIcon className="size-[18px]" aria-hidden />}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}

/**
 * The discounts as one table on a sheet of glass, from md up: the code (and
 * under it the kind of discount), its value, where it stands, how often it was
 * used, its dates — then, for a role that reads analytics, what it brought in
 * the results window — and at the row's end the ONE action (copy the code) and
 * «…» for the rest.
 *
 * A row opens the discount's sheet (a click anywhere on it, Enter or Space
 * while it has focus). Right-click gives the same menu as «…».
 *
 * Material (the row under the pointer) is in glass/offers.css; without the
 * glass layer it is a solid raised sheet.
 */
export function DiscountsTable({ rows, results, menuFor, onOpen }: ListProps) {
  const t = useT(DISCOUNT_STRINGS);
  const head = "px-3 py-3 text-start font-medium whitespace-nowrap";

  return (
    <div
      data-slot="offers-table"
      className="zimos-offers-table overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <table className="w-full text-sm [&>tbody>tr>td]:py-2" style={{ minWidth: results.minWidth }}>
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className={cn(head, "ps-5")}>
              {t.code}
            </th>
            <th scope="col" className={head}>
              {t.value}
            </th>
            <th scope="col" className={head}>
              {t.status}
            </th>
            <th scope="col" className={head}>
              {t.usage}
            </th>
            <th scope="col" className={head}>
              {t.dates}
            </th>
            {results.columns.map((column) => (
              <th key={column.key} scope="col" className={cn("py-3 font-medium whitespace-nowrap", column.align === "end" ? "text-end" : "text-start", column.headerClassName)}>
                {column.header}
              </th>
            ))}
            <th scope="col" className="px-3 py-3">
              <span className="sr-only">{t.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((discount, index) => {
            const status = displayStatus(discount);
            const menu = menuFor(discount);
            return (
              <ContextMenu key={discount.id} items={menu} label={fmt(t.menuLabel, { code: name(discount, t) })}>
                <tr
                  tabIndex={0}
                  aria-haspopup="dialog"
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onOpen(discount);
                  }}
                  onClick={(e) => {
                    if (isRowPress(e.target, e.currentTarget)) onOpen(discount);
                  }}
                  className="zimos-offers-row h-14 cursor-pointer border-b border-line outline-none last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <td className="max-w-64 ps-5 pe-3">
                    <div className="truncate text-[15px] leading-6 font-semibold text-ink">
                      {discount.code ? <bdi dir="ltr">{discount.code}</bdi> : <span className="font-medium text-ink-soft">{t.automatic}</span>}
                    </div>
                    <div className="truncate text-xs leading-5 text-ink-soft">{t[TYPE_LABEL[discount.type]]}</div>
                  </td>
                  <td className="px-3 text-[15px] font-semibold whitespace-nowrap text-ink tabular-nums">
                    <bdi><DiscountValueLabel discount={discount} /></bdi>
                  </td>
                  <td className="px-3">
                    <StatusBadge value={status} text={t[STATUS_LABEL[status]]} />
                  </td>
                  <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
                    {formatCount(discount.usageCount)}
                    {discount.usageLimit != null ? ` / ${formatCount(discount.usageLimit)}` : ""}
                  </td>
                  <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft">{dateRangeLabel(discount, t)}</td>
                  {results.columns.map((column) => (
                    <td key={column.key} className={cn("text-[13px] text-ink-soft tabular-nums", column.align === "end" ? "text-end" : "text-start", column.className)}>
                      {column.cell(discount, index)}
                    </td>
                  ))}
                  <td className="w-px px-3">
                    <div className="flex items-center justify-end gap-1">
                      {discount.code && <CopyButton value={discount.code} label={t.copyCode} iconOnly className="size-9" />}
                      <RowMenu items={menu} label={fmt(t.moreActions, { code: name(discount, t) })} />
                    </div>
                  </td>
                </tr>
              </ContextMenu>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The same discounts as cards, on a phone: the code and its value on the first
 * line; the status chip, how often it was used and the ONE action — copy the
 * code — on the second; under them, what it brought in the results window when
 * it brought anything. A tap opens the discount's sheet, where the rest of its
 * actions are; a long press gives the menu.
 */
export function DiscountCards({ rows, results, menuFor, onOpen }: ListProps) {
  const t = useT(DISCOUNT_STRINGS);
  return (
    <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
      {rows.map((discount) => {
        const status = displayStatus(discount);
        const brought = results.denied || results.pending ? undefined : results.byId.get(discount.id);
        return (
          <ContextMenu key={discount.id} items={menuFor(discount)} label={fmt(t.menuLabel, { code: name(discount, t) })}>
            <li>
              <ListRowCard
                title={discount.code ? <bdi dir="ltr">{discount.code}</bdi> : <span className="font-medium text-ink-soft">{t.automatic}</span>}
                amount={<bdi><DiscountValueLabel discount={discount} /></bdi>}
                status={<StatusBadge value={status} text={t[STATUS_LABEL[status]]} />}
                meta={<span className="tabular-nums">{usesLabel(discount, t)}</span>}
                action={
                  discount.code ? (
                    <CopyButton
                      value={discount.code}
                      label={t.copyCode}
                      labelClassName="sr-only"
                      className="zimos-offer-copy size-11 justify-center gap-0 bg-paper-sunken px-0 py-0 text-ink"
                    />
                  ) : undefined
                }
                footer={
                  <span className="text-xs leading-5 text-ink-soft">
                    {t[TYPE_LABEL[discount.type]]}
                    {(discount.startsAt || discount.endsAt) && <> · {dateRangeLabel(discount, t)}</>}
                    {brought && (
                      <span className="font-medium text-ink tabular-nums">
                        {" · "}
                        <bdi>
                          {fmt(t.resultsLine, {
                            orders: countOf("order", brought.orders),
                            revenue: formatMinorMoney(brought.revenue, results.currency),
                          })}
                        </bdi>
                      </span>
                    )}
                  </span>
                }
                onOpen={() => onOpen(discount)}
                aria-haspopup="dialog"
              />
            </li>
          </ContextMenu>
        );
      })}
    </ul>
  );
}
