import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { LOST_ORDER_TABS, lostOrdersStats, type LostOrderStats, type LostOrderTab } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { countOf } from "@/lib/plural";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconChecklist, IconLostOrders, IconRefresh, IconSearch, IconWarning } from "@/components/icons";
import { ChipRow, ListSkeleton, ListToolbar } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { ViewLink } from "@/components/ViewLink";
import { LostOrderCards } from "./LostOrderCards";
import { LostOrderConvertModal } from "./LostOrderConvertModal";
import { LostOrderQuickLook } from "./LostOrderQuickLook";
import { LOST_ORDER_TIMING_ENABLED } from "@/lib/features";
import { LostOrderTimingSheet } from "./LostOrderTiming";
import { LostOrdersBulkBar, LostOrdersSelectHint, useLostOrderProducts, useLostOrderSelection } from "./LostOrdersBulk";
import {
  LostOrdersActiveFilters,
  LostOrdersFilterSheet,
  NO_FILTERS,
  countFilters,
  toLostOrderQuery,
  type LostOrderFilterState,
} from "./LostOrdersFilters";
import { LostOrdersKpis } from "./LostOrdersKpis";
import { LostOrdersTable } from "./LostOrdersTable";
import { LostOrdersTools } from "./LostOrdersTools";
import { useLostOrderLabels } from "./lostOrderLabels";
import { isTab, matchesSearch, useIsPhone, useLast } from "./lostOrderModel";
import { useLostOrderActions } from "./useLostOrderActions";
import { useLostOrdersList } from "./useLostOrdersList";
import { WhatsappSendConfirm } from "./WhatsappSendConfirm";

const STRINGS = {
  en: {
    title: "Lost orders",
    description:
      "Every checkout that did not become an order: left unfinished, refused by a rule, or never verified. Win them back or turn them into orders.",
    searchPlaceholder: "Name, phone or product",
    searchLabel: "Search the lost orders shown",
    searchHint: "Searching what is loaded so far. Load more to look further back.",
    tabsLabel: "Lost orders by review state",
    select: "Select orders",
    selectStop: "Stop selecting",
    show: "Show {count}",
    showMore: "Show {count} and more",
    showNone: "No matches",
    showLoading: "Loading…",
    emptyTitle: "No lost orders",
    emptyDescription: "A checkout that is left unfinished, or refused, shows up here so you can win it back.",
    emptyAction: "See the orders",
    emptyFiltered: "Nothing matches these filters",
    emptyFilteredHint: "Try fewer filters, or another tab.",
    clearFilters: "Clear the filters",
    emptyTab: "Nothing in this tab",
    emptyTabHint: "The other tabs may have lost orders waiting.",
    showAll: "Show all",
    emptySearch: "Nothing shown matches “{q}”",
    emptySearchHint: "The search looks through what is loaded so far.",
    clearSearch: "Clear the search",
    refreshFailed: "Couldn't refresh the list. What you see may be out of date.",
    moreFailed: "Couldn't load more.",
    retry: "Try again",
    removeTitle: "Delete this lost order?",
    removeTitleNamed: "Delete the lost order of {name}?",
    removeDescription: "It disappears from the list and its recovery link stops working. It cannot be brought back.",
    remove: "Delete",
    removing: "Deleting…",
    cancel: "Cancel",
  },
  ar: {
    title: "الطلبات المفقودة",
    description: "كل طلب لم يكتمل: تُرك دون إتمام، أو رُفض بقاعدة، أو لم يُؤكَّد رقمه. استرجعها أو حوّلها إلى طلبات.",
    searchPlaceholder: "اسم أو رقم أو منتج",
    searchLabel: "البحث في الطلبات المفقودة المعروضة",
    searchHint: "البحث يشمل ما تم تحميله فقط. اضغط «عرض المزيد» للبحث في الأقدم.",
    tabsLabel: "الطلبات المفقودة حسب حالة المراجعة",
    select: "تحديد طلبات",
    selectStop: "إنهاء التحديد",
    show: "عرض {count}",
    showMore: "عرض {count} وأكثر",
    showNone: "لا توجد نتائج",
    showLoading: "جارٍ التحميل…",
    emptyTitle: "لا توجد طلبات مفقودة",
    emptyDescription: "أي طلب يُترك دون إتمام أو يُرفض يظهر هنا لتتمكن من استرجاعه.",
    emptyAction: "عرض الطلبات",
    emptyFiltered: "لا توجد نتائج بهذه التصفية",
    emptyFilteredHint: "جرّب فلاتر أقل أو تبويبًا آخر.",
    clearFilters: "مسح الفلاتر",
    emptyTab: "لا شيء في هذا التبويب",
    emptyTabHint: "قد توجد طلبات مفقودة تنتظر في التبويبات الأخرى.",
    showAll: "عرض الكل",
    emptySearch: "لا شيء من المعروض يطابق «{q}»",
    emptySearchHint: "البحث يشمل ما تم تحميله فقط.",
    clearSearch: "مسح البحث",
    refreshFailed: "تعذّر تحديث القائمة. ما تراه قد يكون قديمًا.",
    moreFailed: "تعذّر تحميل المزيد.",
    retry: "إعادة المحاولة",
    removeTitle: "حذف هذا الطلب المفقود؟",
    removeTitleNamed: "حذف الطلب المفقود الخاص بـ {name}؟",
    removeDescription: "سيختفي من القائمة ويتوقف رابط الاسترجاع الخاص به، ولا يمكن استعادته.",
    remove: "حذف",
    removing: "جارٍ الحذف…",
    cancel: "إلغاء",
  },
} satisfies Messages;

// The «حدّد» toggle at the end of the toolbar: the same pill as a chip (glass/list.css styles `.zimos-chip`
// once), round, 44px. Phones only — from md the table always has its column of tick boxes.
const SELECT_TOGGLE =
  "zimos-chip inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full select-none md:hidden " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const TOGGLE_ON = "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]";
const TOGGLE_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

/** Something went wrong beside rows that are still on screen: one line and a way to try again. */
function Notice({ text, retry, onRetry }: { text: string; retry: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-slot="lost-notice"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[1.25rem] bg-danger-soft py-1.5 ps-4 pe-1.5 text-sm text-ink"
    >
      <span className="flex min-w-0 flex-1 basis-48 items-center gap-2 py-1.5">
        <IconWarning className="size-4 shrink-0 text-danger" aria-hidden />
        <span className="min-w-0">{text}</span>
      </span>
      <Button type="button" variant="ghost" className="h-auto min-h-9 gap-1.5 rounded-full px-3.5" onClick={onRetry}>
        <IconRefresh className="size-4" aria-hidden />
        {retry}
      </Button>
    </div>
  );
}

/**
 * /abandoned-carts — "Lost orders": every checkout that did not become an
 * order, with why, and the ways to win it back.
 *
 * The page composes; each zone is its own file. Top to bottom: the header
 * with its «أدوات» menu (refresh, export, the abandon-after setting), this
 * month in three figures, ONE toolbar (search over what is loaded, the
 * Filters sheet), the four tabs (?tab=), the filters in effect, then the
 * list — cards on a phone, a glass table from md. A row opens Quick Look;
 * right-click or a long press opens its menu; ticking rows raises the bulk
 * bar. What a row can do, and the dialogs, are held by useLostOrderActions.
 */
export function LostOrdersPage() {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const workspaceId = useWorkspaceId();
  const isPhone = useIsPhone();

  // The tab is the one thing in the URL: links, the dock and the home page point at it.
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: LostOrderTab = isTab(rawTab) ? rawTab : "all";
  const [filterState, setFilterState] = useState<LostOrderFilterState>(NO_FILTERS);
  const filters = useMemo(() => toLostOrderQuery(tab, filterState), [tab, filterState]);
  const activeCount = countFilters(filterState);

  const list = useLostOrdersList(workspaceId, filters);
  // This calendar month, whatever the filters say. Remembered for the session, so the strip is there at once on the way back.
  const stats = useCachedAsync<LostOrderStats>(
    `lost-orders:stats:${workspaceId}`,
    () => lostOrdersStats(apiClient, workspaceId),
    [workspaceId]
  );
  const refreshStats = () => void stats.refresh({ silent: true });
  const act = useLostOrderActions({ list, refreshStats });

  // The search narrows the rows already loaded (the API has no text search). The field never waits:
  // the list follows a deferred copy of what was typed.
  const [query, setQuery] = useState("");
  const typed = useDeferredValue(query).trim();
  const shown = useMemo(() => (typed ? act.rows.filter((row) => matchesSearch(row, typed)) : act.rows), [act.rows, typed]);

  const selection = useLostOrderSelection(shown);
  // Phones: the cards show their tick boxes only while «حدّد» is on.
  const [selecting, setSelecting] = useState(false);
  const stopSelecting = () => {
    selection.clear();
    setSelecting(false);
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  // The products of the filter are read the first time the sheet opens, not with the page.
  const [filtersSeen, setFiltersSeen] = useState(false);
  const products = useLostOrderProducts(filtersSeen);
  const [timingOpen, setTimingOpen] = useState(false);
  const minutes = list.abandonedAfter ?? stats.data?.abandonedAfterMinutes ?? null;

  function changeTab(next: LostOrderTab) {
    selection.clear();
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "all") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  }
  function changeFilters(next: LostOrderFilterState) {
    selection.clear();
    setFilterState(next);
  }
  function reloadAll() {
    list.reload();
    refreshStats();
  }

  const peekRow = act.peek.id ? (act.rows.find((row) => row.id === act.peek.id) ?? null) : null;
  // The panel keeps its row while it closes, and after the row itself is gone (deleted, converted away).
  const peekShown = useLast(peekRow);
  const convertingRow = act.convertingId ? (act.rows.find((row) => row.id === act.convertingId) ?? null) : null;
  const removingShown = useLast(act.removing);
  const removingName = removingShown?.customerName?.trim() ?? "";

  const applyLabel = list.loading
    ? t.showLoading
    : shown.length === 0
      ? t.showNone
      : fmt(list.hasMore ? t.showMore : t.show, { count: countOf("order", shown.length) });

  // Why the list is empty decides what it says and the one way out it offers.
  let empty: ReactNode;
  if (act.rows.length > 0) {
    empty = (
      <EmptyState
        icon={<IconSearch aria-hidden />}
        title={fmt(t.emptySearch, { q: typed })}
        description={list.hasMore ? t.emptySearchHint : undefined}
        action={
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setQuery("")}>
            {t.clearSearch}
          </Button>
        }
      />
    );
  } else if (activeCount > 0) {
    empty = (
      <EmptyState
        icon={<IconLostOrders aria-hidden />}
        title={t.emptyFiltered}
        description={t.emptyFilteredHint}
        action={
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => changeFilters(NO_FILTERS)}>
            {t.clearFilters}
          </Button>
        }
      />
    );
  } else if (tab !== "all") {
    empty = (
      <EmptyState
        icon={<IconLostOrders aria-hidden />}
        title={t.emptyTab}
        description={t.emptyTabHint}
        action={
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => changeTab("all")}>
            {t.showAll}
          </Button>
        }
      />
    );
  } else {
    empty = (
      <EmptyState
        tone="success"
        icon={<IconLostOrders aria-hidden />}
        title={t.emptyTitle}
        description={t.emptyDescription}
        action={
          <ViewLink
            to="/orders"
            className="inline-flex items-center rounded-full px-5 text-sm font-semibold text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.emptyAction}
          </ViewLink>
        }
      />
    );
  }

  return (
    <div className="max-w-6xl">
      {/* On a phone the title alone says what the page is: the sentence under it waits for a wider screen. */}
      <div className="max-sm:[&_h1+p]:hidden">
        <PageHeader
          title={t.title}
          description={t.description}
          actions={
            <LostOrdersTools
              filters={filters}
              minutes={minutes}
              refreshing={list.refreshing}
              onRefresh={reloadAll}
              onOpenTiming={() => setTimingOpen(true)}
              onSelect={() => setSelecting(true)}
            />
          }
        />
      </div>

      <LostOrdersKpis stats={stats.loading ? null : stats.data} loading={stats.loading} />

      <ListToolbar
        className="mb-3"
        search={{
          value: query,
          onChange: setQuery,
          placeholder: t.searchPlaceholder,
          label: t.searchLabel,
          hint: typed && list.hasMore ? t.searchHint : undefined,
        }}
        filters={{
          count: activeCount,
          onOpen: () => {
            setFiltersSeen(true);
            setFiltersOpen(true);
          },
        }}
      >
        <button
          type="button"
          aria-pressed={selecting}
          aria-label={selecting ? t.selectStop : t.select}
          title={selecting ? t.selectStop : t.select}
          onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          className={cn(SELECT_TOGGLE, selecting ? TOGGLE_ON : TOGGLE_OFF)}
        >
          <IconChecklist className="size-5" aria-hidden />
        </button>
      </ListToolbar>

      {/* Fixed to the foot of the page; written here so Tab reaches it before the rows. */}
      <LostOrdersBulkBar selection={selection} onClear={stopSelecting} onDone={reloadAll} />

      <ChipRow
        className="mb-3"
        items={LOST_ORDER_TABS.map((key) => ({ value: key, label: labels.tab(key) }))}
        value={tab}
        onChange={changeTab}
        label={t.tabsLabel}
        collapseEmpty={false}
      />

      <LostOrdersActiveFilters value={filterState} onChange={changeFilters} products={products} />

      {isPhone && selecting && selection.ids.length === 0 && shown.length > 0 && (
        <LostOrdersSelectHint selection={selection} onDone={stopSelecting} />
      )}

      <div data-slot="lost-list" aria-busy={list.refreshing || undefined}>
        {list.loading ? (
          <ListSkeleton rows={6} variant={isPhone ? "card" : "table"} />
        ) : list.error && act.rows.length === 0 ? (
          // Could not load, or not allowed (403 says who can grant it and offers no retry).
          <DataState loading={false} error={list.error} onRetry={list.reload}>
            {null}
          </DataState>
        ) : (
          <div className="space-y-3">
            {Boolean(list.error) && <Notice text={t.refreshFailed} retry={t.retry} onRetry={list.reload} />}
            {shown.length === 0 ? (
              empty
            ) : isPhone ? (
              <LostOrderCards rows={shown} selection={selection} selecting={selecting} actions={act.actions} />
            ) : (
              <LostOrdersTable rows={shown} selection={selection} actions={act.actions} />
            )}
            {Boolean(list.moreError) && <Notice text={t.moreFailed} retry={t.retry} onRetry={list.loadMore} />}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </div>
        )}
      </div>

      <LostOrdersFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        value={filterState}
        onChange={changeFilters}
        products={products}
        applyLabel={applyLabel}
      />
      {LOST_ORDER_TIMING_ENABLED && <LostOrderTimingSheet open={timingOpen} onOpenChange={setTimingOpen} minutes={minutes} onSaved={reloadAll} />}

      <LostOrderQuickLook
        session={peekShown}
        open={act.peek.open && peekRow !== null}
        onOpenChange={(open) => {
          if (!open) act.closePeek();
        }}
        actions={act.actions}
      />
      <WhatsappSendConfirm
        session={act.asking}
        name={act.asking?.customerName?.trim() ?? ""}
        onCancel={act.cancelAsk}
        onConfirm={act.confirmSend}
      />
      <LostOrderConvertModal
        session={convertingRow}
        revealing={convertingRow ? act.actions.isRevealing(convertingRow.id) : false}
        onReveal={act.actions.reveal}
        onClose={act.cancelConvert}
        onConverted={act.converted}
      />
      <ConfirmDialog
        open={act.removing !== null}
        title={removingName ? fmt(t.removeTitleNamed, { name: removingName }) : t.removeTitle}
        description={t.removeDescription}
        confirmLabel={t.remove}
        busyLabel={t.removing}
        cancelLabel={t.cancel}
        destructive
        onCancel={act.cancelRemove}
        onConfirm={act.confirmRemove}
      />
    </div>
  );
}
