import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Order } from "@store-builder/api-client";
import { Alert, Button } from "@store-builder/ui";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconOrders, IconPlus, IconRefresh, IconSearch, IconShare } from "@/components/icons";
import { BulkBar, ListSkeleton } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { pluralOf } from "@/lib/plural";
import { storeUrl } from "@/lib/storeAddress";
import { markViewSource, useViewNavigate } from "@/lib/viewTransition";
import { OrderQuickLook } from "@/pages/home/today/OrderQuickLook";
import { shownOrderColumns, useOrderFilterOptions } from "./components/OrderListFilters";
import { OrdersHeaderTools } from "./components/OrdersHeaderTools";
import { useSavedOrderViews } from "./components/useSavedOrderViews";
import { ActiveFilters } from "./list/ActiveFilters";
import { OrderCards } from "./list/OrderCards";
import { copyText, orderRowElement, useOrderRowViews, type OrderRowView } from "./list/orderRow";
import { OrdersFilterSheet, useActiveFilterChips } from "./list/OrdersFilterSheet";
import { OrdersStageChips } from "./list/OrdersStageChips";
import { OrdersTable } from "./list/OrdersTable";
import { OrdersToolbar } from "./list/OrdersToolbar";
import { useIsDesktop } from "./list/useIsDesktop";
import { useNetworkScores } from "./list/useNetworkScores";
import { useOrderBulk } from "./list/useOrderBulk";
import { useOrderMenu } from "./list/useOrderMenu";
import { useOrdersData } from "./list/useOrdersData";
import { useOrdersQuery } from "./list/useOrdersQuery";
import { useSelectMatching } from "./list/useSelectMatching";
import { useOrderLabels } from "./orderLabels";

const STRINGS = {
  en: {
    title: "Orders",
    createOrder: "New order",
    selected_one: "1 order selected",
    selected_other: "{n} orders selected",
    countsFailed: "Couldn't load the stage counts.",
    retry: "Try again",
    refreshFailed: "Couldn't refresh the list, so this is what was loaded last.",
    loadMoreFailed: "Couldn't load more orders.",
    emptyAllTitle: "No orders yet",
    emptyAllBody: "The moment a customer orders from your store, the order shows up here — and on your home screen. Share your store's link to get the first one.",
    emptyShare: "Share your store link",
    emptyCreate: "Create an order by hand",
    linkCopied: "Your store's link is copied. Send it to your customers.",
    copyFailed: "We couldn't copy that. Try again.",
    emptyFilteredTitle: "No orders match this search and these filters",
    emptyFilteredInStage: "Nothing under “{stage}” matches this search and these filters",
    emptyFilteredBody: "Try another word, or take off one of the filters in effect.",
    clearFilters: "Clear search and filters",
    emptyStageTitle: "No orders under “{stage}” right now",
    emptyStageBody: "An order shows up here the moment it reaches this stage.",
    showAll: "See all orders",
    emptyUnknownBody: "Refresh the list and look again.",
    refresh: "Refresh",
  },
  ar: {
    title: "الطلبات",
    createOrder: "طلب جديد",
    selected_one: "طلب واحد محدد",
    selected_two: "طلبان محددان",
    selected_few: "{n} طلبات محددة",
    selected_other: "{n} طلبًا محددًا",
    countsFailed: "تعذّر تحميل أعداد المراحل.",
    retry: "حاول مرة أخرى",
    refreshFailed: "تعذّر تحديث القائمة، وهذا آخر ما تم تحميله.",
    loadMoreFailed: "تعذّر تحميل المزيد من الطلبات.",
    emptyAllTitle: "لا توجد طلبات بعد",
    emptyAllBody: "عندما يطلب عميل من متجرك يظهر طلبه هنا وفي الصفحة الرئيسية. شارك رابط متجرك لتستقبل أول طلب.",
    emptyShare: "مشاركة رابط المتجر",
    emptyCreate: "إنشاء طلب يدويًا",
    linkCopied: "تم نسخ رابط متجرك. أرسله إلى عملائك.",
    copyFailed: "تعذّر النسخ. حاول مرة أخرى.",
    emptyFilteredTitle: "لا توجد طلبات تطابق البحث وعوامل التصفية",
    emptyFilteredInStage: "لا توجد في «{stage}» طلبات تطابق البحث وعوامل التصفية",
    emptyFilteredBody: "جرّب كلمة أخرى، أو أزل أحد عوامل التصفية المفعّلة.",
    clearFilters: "مسح البحث وعوامل التصفية",
    emptyStageTitle: "لا توجد طلبات في «{stage}» الآن",
    emptyStageBody: "يظهر الطلب هنا فور وصوله إلى هذه المرحلة.",
    showAll: "عرض كل الطلبات",
    emptyUnknownBody: "حدّث القائمة وحاول مرة أخرى.",
    refresh: "تحديث",
  },
} satisfies Messages;

/**
 * The orders list — "Orders".
 *
 * Top to bottom: the header (title, the "Tools" menu, "New order"), ONE
 * toolbar (search and the Filters button), the stage chips with their counts,
 * the chips of the filters in effect (only while any is), then the orders: a
 * table on a sheet of glass from md up, cards on a phone. Everything else that
 * filters or shapes the list lives in the Filters sheet (list/OrdersFilterSheet).
 *
 * A row opens Quick Look; Enter on it, or its order number, opens the order.
 * Ticking rows raises the bulk bar. The list is all in the URL (see
 * list/useOrdersQuery.ts), is kept between visits and refreshes behind
 * (list/useOrdersData.ts).
 *
 * It does not look at the path: the create-order sheet at /orders/new draws
 * this same page underneath itself, for whatever query the URL carries.
 */
export function OrdersListPage() {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const errorMessage = useErrorMessage();
  const toast = useToast();
  const location = useLocation();
  const navigate = useViewNavigate();
  const { currentWorkspace } = useWorkspace();
  const desktop = useIsDesktop();

  const query = useOrdersQuery();
  const data = useOrdersData(query);
  const { stage } = query;
  const { rows } = data;

  const views = useOrderRowViews(rows);
  const scores = useNetworkScores(rows);
  const shownIds = useMemo(() => rows.map((order) => order.id), [rows]);

  // ---- selection: orders ticked for a bulk action; a different list starts a fresh one ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [query.selectionKey]);
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shownIds));
  const clearSelection = () => setSelected(new Set());
  const selectedIds = useMemo(() => [...selected], [selected]);

  // ---- the Filters sheet ----
  const [filtersOpen, setFiltersOpen] = useState(false);
  // What the pickers offer is read the first time the sheet opens — or at once, when the link
  // already filters by a product or a funnel whose name the chip has to say.
  const [optionsWanted, setOptionsWanted] = useState(false);
  const options = useOrderFilterOptions(optionsWanted || Boolean(query.extra.values.productId || query.extra.values.funnelId));
  // Read with the page, so the sheet opens with its views already in place.
  const saved = useSavedOrderViews();
  const chips = useActiveFilterChips(query, options);

  // ---- Quick Look: the order being looked at stays here while the panel closes ----
  const [peek, setPeek] = useState<{ order: Order; open: boolean } | null>(null);
  // The preview follows the list: a refresh that changes the order shows in the open panel too.
  const peeked = peek ? (rows.find((order) => order.id === peek.order.id) ?? peek.order) : null;

  // The row is marked as the source before leaving (and when it is peeked at, for "Open in full"):
  // its name, amount and status then travel into the order page's header.
  const peekOrder = (view: OrderRowView) => {
    markViewSource(orderRowElement(view.order.id));
    setPeek({ order: view.order, open: true });
  };
  const openOrder = (view: OrderRowView) => {
    markViewSource(orderRowElement(view.order.id));
    navigate(view.to);
  };
  const setPeekOpen = (open: boolean) => {
    setPeek((current) => (current ? { ...current, open } : current));
    if (open) return;
    // Closed without going to the order: the row is no longer the source of anything. ("Open in full" closes
    // the panel and navigates in the same breath — <html data-vt> is then already set, and the mark stays
    // until that transition ends and clears it itself.)
    window.setTimeout(() => {
      if (!("vt" in document.documentElement.dataset)) markViewSource(null);
    }, 0);
  };

  // ---- bulk actions, and the same actions for one order from its row's menu ----
  const bulk = useOrderBulk({ rows, onChanged: data.afterChange, onClearSelection: clearSelection });
  const menuFor = useOrderMenu({
    onOpen: openOrder,
    onChangeStatus: (view) => bulk.open("set_status", [view.order.id], { selection: false, orderNumber: view.order.orderNumber }),
    onArchive: (view) => void bulk.archiveOne(view.order),
  });
  const selectMore = useSelectMatching({
    params: query.listParams,
    shownIds,
    selected,
    hasMore: data.hasMore,
    total: data.total,
    onSelect: (ids) => setSelected(new Set(ids)),
  });

  // ---- what to say when there is nothing to list ----
  const storeLink = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;
  // Nothing to list, and not because it is still on its way. A list that was empty last time says so at
  // once, from memory, while it is read again.
  const empty = rows.length === 0 && !data.showSkeleton;
  const searched = Boolean(query.q || query.from || query.to) || query.extra.active.length > 0 || Boolean(query.risk);
  // A store with no orders at all (not a filter that matched none): guide, don't just say "empty".
  const noOrdersAtAll = empty && !stage && !searched && data.pipeline?.total === 0;

  async function shareStore() {
    if (!storeLink) return;
    // A phone's own share sheet (WhatsApp, Messenger…) where the browser has one; the clipboard elsewhere.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: currentWorkspace?.name, url: storeLink });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copyText(storeLink)) toast.success(t.linkCopied);
    else toast.error(t.copyFailed);
  }

  const pill = "min-h-11 rounded-full px-5";
  const newOrder = (
    <Button asChild className={pill}>
      {/* The query rides along: under the create-order sheet the list stays the one the merchant was on.
          `from` tells that sheet where closing should go back to (ManualOrderPage.tsx). */}
      <Link to={{ pathname: "/orders/new", search: location.search }} state={{ from: location.pathname }}>
        <IconPlus className="size-4" aria-hidden />
        {t.createOrder}
      </Link>
    </Button>
  );

  let body: ReactNode;
  if (data.showSkeleton) {
    // Cards on a phone, the table's sheet from md up: the shape of what is coming.
    body = <ListSkeleton rows={8} />;
  } else if (data.error != null && (rows.length === 0 || isPermissionError(data.error))) {
    body = (
      <DataState loading={false} error={data.error} onRetry={data.reload}>
        {null}
      </DataState>
    );
  } else if (noOrdersAtAll) {
    body = (
      <EmptyState
        icon={<IconOrders aria-hidden />}
        title={t.emptyAllTitle}
        description={t.emptyAllBody}
        action={
          storeLink ? (
            <Button className={pill} onClick={() => void shareStore()}>
              <IconShare className="size-4" aria-hidden />
              {t.emptyShare}
            </Button>
          ) : (
            <Button asChild className={pill}>
              <Link to="/orders/new">{t.emptyCreate}</Link>
            </Button>
          )
        }
      />
    );
  } else if (empty && searched) {
    body = (
      <EmptyState
        icon={<IconSearch aria-hidden />}
        title={stage ? fmt(t.emptyFilteredInStage, { stage: labels.stage(stage) }) : t.emptyFilteredTitle}
        description={t.emptyFilteredBody}
        action={
          <Button variant="outline" className={pill} onClick={query.clearSearchAndFilters}>
            {t.clearFilters}
          </Button>
        }
      />
    );
  } else if (empty && stage) {
    body = (
      <EmptyState
        icon={<IconOrders aria-hidden />}
        title={fmt(t.emptyStageTitle, { stage: labels.stage(stage) })}
        description={t.emptyStageBody}
        action={
          <Button variant="outline" className={pill} onClick={() => query.setStage(null)}>
            {t.showAll}
          </Button>
        }
      />
    );
  } else if (empty) {
    // No filter, and the counts did not say "none" (they failed, or are out of step): offer to read again.
    body = (
      <EmptyState
        icon={<IconOrders aria-hidden />}
        title={t.emptyAllTitle}
        description={t.emptyUnknownBody}
        action={
          <Button variant="outline" className={pill} onClick={data.reload}>
            <IconRefresh className="size-4" aria-hidden />
            {t.refresh}
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {data.error != null && (
          <Alert variant="danger" className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span>{t.refreshFailed}</span>
            <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={data.reload}>
              {t.retry}
            </Button>
          </Alert>
        )}
        {desktop ? (
          <OrdersTable
            rows={views}
            columns={shownOrderColumns(query.prefs.columns)}
            selected={selected}
            onToggle={toggleSelected}
            allSelected={allSelected}
            onToggleAll={toggleAll}
            scores={scores}
            menuFor={menuFor}
            onPeek={peekOrder}
            onOpen={openOrder}
          />
        ) : (
          <OrderCards rows={views} selected={selected} onToggle={toggleSelected} scores={scores} menuFor={menuFor} onPeek={peekOrder} onOpen={openOrder} />
        )}
        {data.loadMoreError != null && (
          <Alert variant="danger" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span>
              {t.loadMoreFailed} {errorMessage(data.loadMoreError)}
            </span>
            <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={data.loadMore}>
              {t.retry}
            </Button>
          </Alert>
        )}
        <LoadMore hasMore={data.hasMore} loading={data.loadingMore} onClick={data.loadMore} />
      </>
    );
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        actions={
          <OrdersHeaderTools
            onRefresh={data.reload}
            refreshing={data.refreshing}
            onImported={data.afterChange}
            exportFilters={{ ...query.fullQuery, stage: stage ?? undefined, sort: query.sort }}
          />
        }
        // The page's one creation action: in the header from md up, in the bar above the dock on a phone.
        primaryAction={newOrder}
      />

      <div className="flex flex-col gap-3">
        <OrdersToolbar
          q={query.q}
          onSearch={(next) => query.patch({ q: next })}
          filterCount={query.activeCount}
          onOpenFilters={() => {
            setOptionsWanted(true);
            setFiltersOpen(true);
          }}
        />

        {/* The stage: what a merchant switches most. */}
        <OrdersStageChips value={stage} onChange={query.setStage} pipeline={data.pipeline} countsLoading={data.countsLoading} />

        <ActiveFilters chips={chips} onClearAll={query.clearFilters} />

        {data.countsError != null && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
            {t.countsFailed}
            <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={data.retryCounts}>
              {t.retry}
            </Button>
          </p>
        )}

        {/* Fixed to the foot of the page; written here so Tab reaches it before the rows. */}
        <BulkBar
          count={selectedIds.length}
          label={pluralOf(t, "selected", selectedIds.length)}
          onClear={clearSelection}
          actions={bulk.barActions(selectedIds)}
          maxInline={desktop ? 4 : 2}
          extra={selectMore}
          busy={bulk.busy}
        />

        <div aria-busy={data.refreshing || undefined} className="min-w-0">
          {body}
        </div>
      </div>

      <OrdersFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        query={query}
        options={options}
        saved={saved}
        riskCounts={data.riskCounts}
        total={data.total}
        desktop={desktop}
      />

      <OrderQuickLook
        order={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={setPeekOpen}
      />

      {/* Outside the list's own states: a result dialog must survive the list reloading. */}
      {bulk.dialogs}
    </div>
  );
}
