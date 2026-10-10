import { useId, useState, type FormEvent } from "react";
import { ORDER_SORTS, type OrderRiskCounts } from "@store-builder/api-client";
import { Button, Input, cn } from "@store-builder/ui";
import { IconBookmark, IconDelete } from "@/components/icons";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { useToast } from "@/components/Toast";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { useRiskLevelLabel, type RiskLevel } from "@/pages/fraud/RiskBadge";
import {
  OrderColumnChooser,
  OrderExtraFilterGroups,
  PAGE_SIZES,
  shownOrderColumns,
  useColumnLabel,
  useOrderFilterChips,
  type OrderFilterOptions,
} from "../components/OrderListFilters";
import type { useSavedOrderViews } from "../components/useSavedOrderViews";
import type { ActiveFilterChip } from "./ActiveFilters";
import { DATE_SHORTCUTS, DEFAULT_SORT, shortcutRange, type DateShortcut, type OrdersQuery } from "./useOrdersQuery";

const STRINGS = {
  en: {
    show: "Show {orders}",
    showNone: "No orders match",
    showAll: "Show the orders",
    pair: "{name}: {value}",
    views: "Saved views",
    viewsHint: "A view keeps the stage, search, dates, filters and sort you see now, under a name.",
    saveView: "Save this view",
    viewName: "View name",
    viewNamePlaceholder: "e.g. Cairo, not opened",
    save: "Save",
    cancel: "Cancel",
    deleteView: "Delete “{name}”",
    viewSaved: "The view “{name}” is saved.",
    viewDeleted: "The view “{name}” is deleted.",
    dates: "Date",
    datesHint: "Days follow this device's clock.",
    dateShortcuts: "Date shortcuts",
    today: "Today",
    last: "Last {days}",
    from: "From",
    to: "To",
    fromDay: "From {day}",
    toDay: "Until {day}",
    range: "{from} – {to}",
    rangeInvalid: "The start date is after the end date, so the dates aren't applied.",
    risk: "Risk",
    riskAny: "Any risk",
    withCount: "{label} ({count})",
    sort: "Sort",
    sort_newest: "Newest first",
    sort_oldest: "Oldest first",
    sort_total_desc: "Total: high to low",
    sort_total_asc: "Total: low to high",
    columns: "Table columns",
    columnsNone: "Only the fixed columns",
    pageSize: "Orders per page",
  },
  ar: {
    show: "عرض {orders}",
    showNone: "لا توجد طلبات بعوامل التصفية هذه",
    showAll: "عرض الطلبات",
    pair: "{name}: {value}",
    views: "العروض المحفوظة",
    viewsHint: "يحفظ العرض المرحلة والبحث والتواريخ وعوامل التصفية والترتيب الحالية، باسم تختاره.",
    saveView: "حفظ هذا العرض",
    viewName: "اسم العرض",
    viewNamePlaceholder: "مثلًا: القاهرة، لم تُفتح بعد",
    save: "حفظ",
    cancel: "إلغاء",
    deleteView: "حذف «{name}»",
    viewSaved: "تم حفظ العرض «{name}».",
    viewDeleted: "تم حذف العرض «{name}».",
    dates: "التاريخ",
    datesHint: "الأيام بتوقيت هذا الجهاز.",
    dateShortcuts: "اختصارات التاريخ",
    today: "اليوم",
    last: "آخر {days}",
    from: "من",
    to: "إلى",
    fromDay: "من {day}",
    toDay: "حتى {day}",
    range: "{from} – {to}",
    rangeInvalid: "تاريخ البداية بعد تاريخ النهاية، لذلك لم يتم تطبيق التواريخ.",
    risk: "الخطورة",
    riskAny: "أي خطورة",
    withCount: "{label} ({count})",
    sort: "الترتيب",
    sort_newest: "الأحدث أولًا",
    sort_oldest: "الأقدم أولًا",
    sort_total_desc: "الإجمالي: من الأعلى إلى الأقل",
    sort_total_asc: "الإجمالي: من الأقل إلى الأعلى",
    columns: "أعمدة الجدول",
    columnsNone: "الأعمدة الثابتة فقط",
    pageSize: "عدد الطلبات في الصفحة",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type SavedViews = ReturnType<typeof useSavedOrderViews>;

const FIELD_LABEL = "mb-1.5 block text-xs leading-4 font-medium text-ink-soft";
const RISK_ORDER: readonly RiskLevel[] = ["high", "moderate", "low"];

/** "Today", "Last 7 days", "Last 30 days". */
function shortcutLabel(t: Strings, shortcut: DateShortcut): string {
  if (shortcut === "today") return t.today;
  const back = DATE_SHORTCUTS.find(([key]) => key === shortcut)?.[1] ?? 0;
  return fmt(t.last, { days: countOf("day", back + 1) });
}

/** The shortcut the dates in the URL stand for today, if they are one. */
function activeShortcut(from: string, to: string): DateShortcut | null {
  for (const [key] of DATE_SHORTCUTS) {
    const range = shortcutRange(key);
    if (range.from === from && range.to === to) return key;
  }
  return null;
}

/** "2026-10-06" as "6 October", on this device's calendar like the filter itself. */
function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const at = new Date(year ?? 0, (month ?? 1) - 1, date ?? 1);
  if (Number.isNaN(at.getTime())) return day;
  return at.toLocaleDateString(getIntlLocale(), { day: "numeric", month: "short", year: at.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/**
 * Every filter in effect inside the sheet, as the chips under the toolbar:
 * the dates, the risk level, a sort other than the usual one, and each of the
 * fifteen filters — each with the way to take just that one off.
 */
export function useActiveFilterChips(query: OrdersQuery, options: OrderFilterOptions | null): ActiveFilterChip[] {
  const t = useT(STRINGS);
  const riskLabel = useRiskLevelLabel();
  const extraChips = useOrderFilterChips(query.extra, options);
  const chips: ActiveFilterChip[] = [];

  if (query.from || query.to) {
    const shortcut = activeShortcut(query.from, query.to);
    const value = shortcut
      ? shortcutLabel(t, shortcut)
      : query.from && query.to
        ? fmt(t.range, { from: dayLabel(query.from), to: dayLabel(query.to) })
        : query.from
          ? fmt(t.fromDay, { day: dayLabel(query.from) })
          : fmt(t.toDay, { day: dayLabel(query.to) });
    chips.push({ id: "dates", label: fmt(t.pair, { name: t.dates, value }), onRemove: () => query.patch({ from: null, to: null }) });
  }
  if (query.risk) {
    chips.push({ id: "risk", label: riskLabel(query.risk), onRemove: () => query.setRisk(null) });
  }
  if (query.sort !== DEFAULT_SORT) {
    chips.push({
      id: "sort",
      label: fmt(t.pair, { name: t.sort, value: t[`sort_${query.sort}`] }),
      onRemove: () => query.setSort(DEFAULT_SORT),
    });
  }
  for (const chip of extraChips) {
    chips.push({ id: chip.key, label: chip.label, onRemove: () => query.patch({ [chip.key]: null }) });
  }
  return chips;
}

/**
 * The Filters sheet of the orders list — the ONE place the list is filtered
 * and shaped (the page keeps only the search, the stage chips and the chips of
 * what is in effect). Top to bottom: saved views; date (shortcuts, from / to);
 * risk, with how many orders each level holds; sort; the fifteen filters in
 * five folding groups; and what shapes the list on this device — the table's
 * columns (from md up: a phone has cards) and the page size.
 *
 * Every choice takes effect as it is made — the list behind the sheet is
 * already the answer — so the main button only closes it, saying how many
 * orders are waiting. "Clear all" puts the dates, risk, sort and filters back.
 */
export function OrdersFilterSheet({
  open,
  onOpenChange,
  query,
  options,
  saved,
  riskCounts,
  total,
  desktop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: OrdersQuery;
  /** What the pickers offer; null until it is read. */
  options: OrderFilterOptions | null;
  saved: SavedViews;
  riskCounts: OrderRiskCounts | null;
  /** How many orders the list holds now, once known. */
  total: number | undefined;
  /** The table is on screen: its columns can be chosen. */
  desktop: boolean;
}) {
  const t = useT(STRINGS);
  const riskLabel = useRiskLevelLabel();
  const columnLabel = useColumnLabel();
  const fromId = useId();
  const toId = useId();
  const { prefs } = query;

  const shownColumns = shownOrderColumns(prefs.columns);
  const applyLabel = total === undefined ? t.showAll : total === 0 ? t.showNone : fmt(t.show, { orders: countOf("order", total) });

  return (
    <FilterSheet open={open} onOpenChange={onOpenChange} activeCount={query.activeCount} onReset={query.clearFilters} applyLabel={applyLabel}>
      <SavedViewsGroup query={query} saved={saved} t={t} />

      <FilterGroup label={t.dates} hint={t.datesHint}>
        <FilterChoice
          label={t.dateShortcuts}
          allowClear
          value={activeShortcut(query.from, query.to)}
          onChange={(next) => query.patch(next ? shortcutRange(next) : { from: null, to: null })}
          options={DATE_SHORTCUTS.map(([key]) => ({ value: key, label: shortcutLabel(t, key) }))}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor={fromId} data-slot="filter-hint" className={FIELD_LABEL}>
              {t.from}
            </label>
            <Input
              id={fromId}
              type="date"
              value={query.from}
              max={query.to || undefined}
              onChange={(e) => query.patch({ from: e.target.value || null })}
              className="h-11"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor={toId} data-slot="filter-hint" className={FIELD_LABEL}>
              {t.to}
            </label>
            <Input
              id={toId}
              type="date"
              value={query.to}
              min={query.from || undefined}
              onChange={(e) => query.patch({ to: e.target.value || null })}
              className="h-11"
            />
          </div>
        </div>
        {query.rangeInvalid && (
          <p className="mt-2 text-xs font-medium text-danger" role="alert">
            {t.rangeInvalid}
          </p>
        )}
      </FilterGroup>

      <FilterGroup label={t.risk}>
        <FilterChoice
          label={t.risk}
          value={query.risk ?? "all"}
          onChange={(next) => query.setRisk(next === null || next === "all" ? null : next)}
          options={[
            { value: "all" as const, label: t.riskAny },
            ...RISK_ORDER.map((level) => ({
              value: level,
              label: riskCounts ? fmt(t.withCount, { label: riskLabel(level), count: riskCounts[level] }) : riskLabel(level),
            })),
          ]}
        />
      </FilterGroup>

      <FilterGroup label={t.sort}>
        <FilterChoice
          label={t.sort}
          value={query.sort}
          onChange={(next) => {
            if (next) query.setSort(next);
          }}
          options={ORDER_SORTS.map((key) => ({ value: key, label: t[`sort_${key}`] }))}
        />
      </FilterGroup>

      <OrderExtraFilterGroups filters={query.extra} options={options} onChange={query.patch} />

      {/* Columns shape the table, which a phone does not show. */}
      {desktop && (
        <FilterGroup
          collapsible
          label={t.columns}
          hint={shownColumns.length > 0 ? shownColumns.map(columnLabel).join(getIntlLocale().startsWith("ar") ? "، " : ", ") : t.columnsNone}
        >
          <OrderColumnChooser prefs={prefs} />
        </FilterGroup>
      )}

      <FilterGroup label={t.pageSize}>
        <FilterChoice
          label={t.pageSize}
          value={String(prefs.pageSize)}
          onChange={(next) => {
            if (next) prefs.setPageSize(Number(next));
          }}
          options={PAGE_SIZES.map((size) => ({ value: String(size), label: fmt("{n}", { n: size }) }))}
        />
      </FilterGroup>
    </FilterSheet>
  );
}

/**
 * Saved views, first in the sheet: one chip per view (the one the list is on
 * now is the pressed one — a view is the page's whole query string, so "on it"
 * means exactly equal), "Save this view" with a name field, and a way to delete
 * the view the list is on. Kept per teammate on the server (useSavedOrderViews).
 */
function SavedViewsGroup({ query, saved, t }: { query: OrdersQuery; saved: SavedViews; t: Strings }) {
  const toast = useToast();
  const nameId = useId();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const currentQuery = query.params.toString();
  const current = saved.views.find((view) => view.query === currentQuery) ?? null;

  function save(e: FormEvent) {
    e.preventDefault();
    const chosen = name.trim();
    if (!chosen) return;
    saved.save(chosen, currentQuery);
    setNaming(false);
    toast.success(fmt(t.viewSaved, { name: chosen }));
  }

  function removeCurrent() {
    if (!current) return;
    const { name: gone, query: goneQuery } = current;
    saved.remove(gone);
    // A view is only a name and a query: saving it again brings it back whole.
    toast.undo(fmt(t.viewDeleted, { name: gone }), () => saved.save(gone, goneQuery));
  }

  return (
    <FilterGroup label={t.views} hint={t.viewsHint}>
      {saved.views.length > 0 && (
        <FilterChoice
          label={t.views}
          value={current?.name ?? null}
          onChange={(next) => {
            const view = saved.views.find((v) => v.name === next);
            if (view) query.applyView(view.query);
          }}
          options={saved.views.map((view) => ({ value: view.name, label: view.name }))}
        />
      )}
      {naming ? (
        <form onSubmit={save} className={cn("flex flex-wrap items-end gap-2", saved.views.length > 0 && "mt-3")}>
          <div className="min-w-0 flex-1 basis-48">
            <label htmlFor={nameId} data-slot="filter-hint" className={FIELD_LABEL}>
              {t.viewName}
            </label>
            <Input
              id={nameId}
              value={name}
              maxLength={40}
              autoFocus
              placeholder={t.viewNamePlaceholder}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 rounded-full px-5" disabled={!name.trim()}>
            {t.save}
          </Button>
          <Button type="button" variant="ghost" className="h-11 rounded-full px-4" onClick={() => setNaming(false)}>
            {t.cancel}
          </Button>
        </form>
      ) : (
        <div className={cn("flex flex-wrap gap-2", saved.views.length > 0 && "mt-3")}>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-full px-4"
            onClick={() => {
              setName("");
              setNaming(true);
            }}
          >
            <IconBookmark className="size-4" aria-hidden />
            {t.saveView}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 max-w-full gap-2 rounded-full px-4 text-danger hover:bg-danger-soft hover:text-danger"
              onClick={removeCurrent}
            >
              <IconDelete className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{fmt(t.deleteView, { name: current.name })}</span>
            </Button>
          )}
        </div>
      )}
    </FilterGroup>
  );
}
