import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  ORDER_STAGES,
  isInvalidCursorError,
  type Order,
  type OrderPipeline,
  type OrderStage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { STAGE_TONE, useOrderLabels } from "./orderLabels";

const STRINGS = {
  en: {
    title: "Orders",
    description: "Every order, grouped by where it stands right now.",
    tabsLabel: "Filter orders by stage",
    tabAll: "All",
    searchLabel: "Search orders",
    searchPlaceholder: "Order number, name, email or phone",
    searchHint: "Matches the order number, customer name or email, or the full phone number.",
    searchTooShort: "Type at least 2 characters to search.",
    clearSearch: "Clear search",
    from: "From",
    to: "To",
    datesHint: "Dates are matched in UTC — Cairo time is 2–3 hours ahead.",
    rangeInvalid: "The start date is after the end date, so the dates aren't applied.",
    clearFilters: "Clear filters",
    countsFailed: "Couldn't load the tab counts.",
    retry: "Try again",
    colOrder: "Order",
    colCustomer: "Customer",
    colTotal: "Total",
    colStage: "Stage",
    colDate: "Date",
    emptyAll: "No orders yet. Orders from your store will appear here.",
    emptyStage: "No orders under “{stage}” right now.",
    emptyFiltered: "No orders match this search and dates.",
    loadMoreFailed: "Couldn't load more orders.",
    phoneLabel: "Phone",
  },
  ar: {
    title: "الأوردرات",
    description: "كل الأوردرات، مجمّعة حسب حالتها الآن.",
    tabsLabel: "تصفية الأوردرات حسب المرحلة",
    tabAll: "الكل",
    searchLabel: "البحث في الأوردرات",
    searchPlaceholder: "رقم الأوردر أو الاسم أو البريد أو الهاتف",
    searchHint: "يبحث في رقم الأوردر أو اسم العميل أو بريده، أو رقم الهاتف كاملًا.",
    searchTooShort: "اكتب حرفين على الأقل للبحث.",
    clearSearch: "مسح البحث",
    from: "من",
    to: "إلى",
    datesHint: "تتم مطابقة التواريخ بتوقيت UTC — توقيت القاهرة متقدم بساعتين إلى ثلاث.",
    rangeInvalid: "تاريخ البداية بعد تاريخ النهاية، لذلك لم يتم تطبيق التواريخ.",
    clearFilters: "مسح عوامل التصفية",
    countsFailed: "تعذّر تحميل أعداد التبويبات.",
    retry: "حاول مرة أخرى",
    colOrder: "الأوردر",
    colCustomer: "العميل",
    colTotal: "الإجمالي",
    colStage: "المرحلة",
    colDate: "التاريخ",
    emptyAll: "لا توجد أوردرات بعد. ستظهر هنا أوردرات متجرك.",
    emptyStage: "لا توجد أوردرات في «{stage}» حاليًا.",
    emptyFiltered: "لا توجد أوردرات تطابق هذا البحث والتواريخ.",
    loadMoreFailed: "تعذّر تحميل المزيد من الأوردرات.",
    phoneLabel: "الهاتف",
  },
} satisfies Messages;

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN = 2;
const SEARCH_MAX = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `value`, once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

function isStage(value: string | null): value is OrderStage {
  return value !== null && (ORDER_STAGES as readonly string[]).includes(value);
}

/**
 * The list's filters live in the URL (?stage=&q=&from=&to=) so a view can be
 * shared and survives a refresh. Anything malformed in a hand-edited URL is
 * ignored rather than sent.
 */
function useOrderFilters() {
  const [params, setParams] = useSearchParams();
  const rawStage = params.get("stage");
  const stage = isStage(rawStage) ? rawStage : null;
  const rawQ = (params.get("q") ?? "").trim();
  const q = rawQ.length >= SEARCH_MIN ? rawQ.slice(0, SEARCH_MAX) : "";
  const rawFrom = params.get("from") ?? "";
  const rawTo = params.get("to") ?? "";
  const from = DATE_RE.test(rawFrom) ? rawFrom : "";
  const to = DATE_RE.test(rawTo) ? rawTo : "";
  const rangeInvalid = Boolean(from && to && from > to);

  function update(patch: Partial<Record<"stage" | "q" | "from" | "to", string | null>>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }

  return {
    stage,
    q,
    from,
    to,
    rangeInvalid,
    // Dates only reach the API as a valid range.
    query: {
      q: q || undefined,
      from: rangeInvalid ? undefined : from || undefined,
      to: rangeInvalid ? undefined : to || undefined,
    },
    hasSearchFilters: Boolean(q || from || to),
    update,
  };
}

export function OrdersListPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const errorMessage = useErrorMessage();
  const filters = useOrderFilters();
  const { stage, query } = filters;

  const pipeline = useAsync<OrderPipeline>(
    () => apiClient.getOrderPipeline(workspaceId, query),
    [workspaceId, query.q, query.from, query.to]
  );

  const list = useCursorList<Order>(
    (cursor) =>
      apiClient
        .listOrders(workspaceId, { cursor, limit: 50, stage: stage ?? undefined, ...query })
        .then((r) => ({ items: r.orders, nextCursor: r.nextCursor })),
    [workspaceId, stage, query.q, query.from, query.to],
    { isStaleCursor: (err) => isInvalidCursorError(err, "cursor") }
  );

  const emptyMessage = filters.hasSearchFilters
    ? t.emptyFiltered
    : stage
      ? fmt(t.emptyStage, { stage: labels.stage(stage) })
      : t.emptyAll;

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <SearchAndDates filters={filters} />

      <StageTabs
        value={stage}
        onChange={(next) => filters.update({ stage: next })}
        pipeline={pipeline.data}
        countsLoading={pipeline.loading}
      />
      {pipeline.error != null && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
          {t.countsFailed}
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => pipeline.refresh()}>
            {t.retry}
          </Button>
        </p>
      )}

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={list.reload}
      >
        <OrdersTable orders={list.items} />
        {list.error != null && list.items.length > 0 && (
          <Alert variant="danger" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span>
              {t.loadMoreFailed} {errorMessage(list.error)}
            </span>
            <Button size="sm" variant="outline" className="min-h-11" onClick={list.loadMore}>
              {t.retry}
            </Button>
          </Alert>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      {filters.hasSearchFilters && list.items.length === 0 && !list.loading && !list.error && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => filters.update({ q: null, from: null, to: null })}
          >
            {t.clearFilters}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SearchAndDates({ filters }: { filters: ReturnType<typeof useOrderFilters> }) {
  const t = useT(STRINGS);
  const searchId = useId();
  const hintId = useId();
  const fromId = useId();
  const toId = useId();
  const datesHintId = useId();

  // What's typed, ahead of the debounce. The URL only ever holds a query the
  // API accepts (2+ characters), so a single character stays local.
  const [draft, setDraft] = useState(filters.q);
  // Back/forward or a shared link changed the query under us: adopt it,
  // unless it's just what the draft already says.
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    if (draft.trim() !== filters.q) setDraft(filters.q);
  }

  const { update } = filters;
  const debounced = useDebouncedValue(draft.trim(), SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    const next = debounced.length >= SEARCH_MIN ? debounced : "";
    if (next !== filters.q) update({ q: next || null });
    // Only a settled draft should write the URL — not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const tooShort = draft.trim().length > 0 && draft.trim().length < SEARCH_MIN;

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <label htmlFor={searchId} className="sr-only">
          {t.searchLabel}
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
          />
          <Input
            id={searchId}
            type="search"
            value={draft}
            maxLength={SEARCH_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-describedby={hintId}
            className="h-11 ps-9 pe-11"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                update({ q: null });
              }}
              aria-label={t.clearSearch}
              className="absolute end-0 top-0 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <p id={hintId} className={cn("mt-1 text-xs", tooShort ? "text-accent-dark" : "text-ink-soft")} aria-live="polite">
          {tooShort ? t.searchTooShort : t.searchHint}
        </p>
      </div>

      <fieldset className="min-w-0">
        <legend className="sr-only">
          {t.from} / {t.to}
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={fromId} className="text-sm text-ink-soft">
            {t.from}
          </label>
          <Input
            id={fromId}
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => update({ from: e.target.value || null })}
            aria-describedby={datesHintId}
            className="h-11 w-auto"
          />
          <label htmlFor={toId} className="text-sm text-ink-soft">
            {t.to}
          </label>
          <Input
            id={toId}
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => update({ to: e.target.value || null })}
            aria-describedby={datesHintId}
            className="h-11 w-auto"
          />
          {(filters.from || filters.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => update({ from: null, to: null })}
            >
              {t.clearFilters}
            </Button>
          )}
        </div>
        <p id={datesHintId} className="mt-1 text-xs text-ink-soft">
          {t.datesHint}
        </p>
        {filters.rangeInvalid && (
          <p className="mt-1 text-xs font-medium text-danger" role="alert">
            {t.rangeInvalid}
          </p>
        )}
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StageTabs({
  value,
  onChange,
  pipeline,
  countsLoading,
}: {
  value: OrderStage | null;
  onChange: (next: OrderStage | null) => void;
  pipeline: OrderPipeline | null;
  countsLoading: boolean;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // A shared link may open on a tab that's scrolled out of view on a phone.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const tabs: Array<{ key: OrderStage | null; label: string; count: number | undefined }> = [
    { key: null, label: t.tabAll, count: pipeline?.total },
    ...ORDER_STAGES.map((stage) => ({
      key: stage,
      label: labels.stage(stage),
      count: pipeline?.stages[stage],
    })),
  ];

  return (
    <div
      role="group"
      aria-label={t.tabsLabel}
      aria-busy={countsLoading || undefined}
      className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key ?? "all"}
            ref={selected ? selectedRef : undefined}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected
                ? "border-primary/40 bg-primary-soft text-primary-dark dark:text-primary"
                : "border-line bg-paper-raised text-ink-soft hover:text-ink"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
                selected ? "bg-paper-raised text-ink" : "bg-paper text-ink-soft",
                countsLoading && "opacity-50"
              )}
            >
              {tab.count ?? "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrdersTable({ orders }: { orders: Order[] }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();

  const rows = useMemo(
    () =>
      orders.map((order) => ({
        order,
        stageLabel: order.stage ? labels.stage(order.stage) : null,
        flagged: order.riskFlags.length > 0,
      })),
    [orders, labels]
  );

  return (
    <>
      {/* Phones and small tablets: one card per order. */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ order, stageLabel, flagged }) => (
          <li key={order.id}>
            <Link
              to={`/orders/${order.id}`}
              className="block rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">
                  <bdi dir="ltr">{order.orderNumber}</bdi>
                </span>
                <span className="text-sm text-ink">{formatMoney(order.totalAmount, order.currency)}</span>
              </div>
              <div className="mt-1 text-sm text-ink-soft">
                {order.contactSnapshot?.fullName || "—"}
                {order.contactSnapshot?.phone && (
                  <>
                    {" · "}
                    <bdi dir="ltr">{order.contactSnapshot.phone}</bdi>
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {order.stage && stageLabel && (
                  <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={stageLabel} />
                )}
                {flagged && <StatusBadge value="flagged" tone="danger" text={labels.flagged} />}
                <span className="ms-auto text-xs text-ink-soft">{formatDate(order.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet landscape and up: the table. */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t.colOrder}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t.colCustomer}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t.colTotal}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t.colStage}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t.colDate}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, stageLabel, flagged }) => (
              <tr key={order.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                <td className="px-4 py-3">
                  <Link
                    to={`/orders/${order.id}`}
                    className="inline-flex min-h-11 items-center font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <bdi dir="ltr">{order.orderNumber}</bdi>
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  <div className="text-ink">{order.contactSnapshot?.fullName || "—"}</div>
                  {order.contactSnapshot?.phone && (
                    <div className="text-xs">
                      <span className="sr-only">{t.phoneLabel}: </span>
                      <bdi dir="ltr">{order.contactSnapshot.phone}</bdi>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{formatMoney(order.totalAmount, order.currency)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {order.stage && stageLabel && (
                      <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={stageLabel} />
                    )}
                    {flagged && <StatusBadge value="flagged" tone="danger" text={labels.flagged} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{formatDate(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
