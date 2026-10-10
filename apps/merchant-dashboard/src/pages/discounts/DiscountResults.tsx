import { useMemo, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import { storeReportDiscounts, type Discount, type StoreReportDiscountRow } from "@store-builder/api-client";
import type { Column } from "@/components/DataTable";
import { SkeletonBar } from "@/components/DataState";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatMinorMoney, formatPercentValue } from "@/lib/format";
import { STORE_REPORTS_ENABLED } from "@/lib/features";
import { useReport } from "@/lib/reportRange";
import { useT, type Messages } from "@/i18n/LocaleContext";
import {
  formatReportDay,
  reportDenied,
  reportRangeRefused,
  StoreReportCsvButton,
  StoreReportRangeBar,
  useStoreReportRange,
  type StoreReportRangeState,
} from "@/pages/analytics/storeReports/storeReportParts";
import { STORE_REPORT_STRINGS } from "@/pages/analytics/storeReports/storeReportStrings";

/**
 * Discount code results (analytics.view): what each code and
 * automatic discount brought in a window of days. The Discounts list gets four
 * columns and its date range; the discount's own dialog gets the same numbers
 * with new against returning customers and the delivered revenue.
 *
 * A teammate who may manage discounts but not read analytics (403) sees the
 * list exactly as it was: no columns, no bar, no panel. The same holds while
 * the store reports switch is off: the report is not asked for at all.
 */

const STRINGS = {
  en: {
    barLabel: "Results for",
    orders: "Orders",
    revenue: "Revenue",
    discountGiven: "Discount given",
    cancelled: "Cancelled %",
    newCustomers: "New customers",
    returningCustomers: "Returning",
    deliveredRevenue: "Delivered revenue",
    averageOrder: "Average order",
    panelTitle: "Results",
    noOrders: "No order used this discount in this period.",
    failed: "The results could not be loaded.",
    retry: "Try again",
  },
  ar: {
    barLabel: "النتائج في",
    orders: "الطلبات",
    revenue: "المبيعات",
    discountGiven: "الخصم الممنوح",
    cancelled: "نسبة الإلغاء",
    newCustomers: "عملاء جدد",
    returningCustomers: "عملاء سابقون",
    deliveredRevenue: "مبيعات تم تسليمها",
    averageOrder: "متوسط الطلب",
    panelTitle: "النتائج",
    noOrders: "لم يستخدم أي طلب هذا الخصم في هذه الفترة.",
    failed: "تعذّر تحميل النتائج.",
    retry: "إعادة المحاولة",
  },
} satisfies Messages;

/**
 * The list's own width, and what it needs once the four result columns join
 * it: just under the page's 1000 px column on a 1366 px screen, so the row's
 * actions stay in view there and the table scrolls inside its card only on
 * something narrower.
 */
const LIST_MIN_WIDTH = "45rem";
const LIST_MIN_WIDTH_WITH_RESULTS = "59rem";

export interface DiscountResults {
  range: StoreReportRangeState;
  /** By discount id. A discount nobody used in the window has no entry. */
  byId: ReadonlyMap<string, StoreReportDiscountRow>;
  currency: string;
  /** The first answer for this window has not arrived yet. */
  pending: boolean;
  /** analytics.view is not part of this role: nothing of the results is shown. */
  denied: boolean;
  error: unknown;
  reload: () => void;
  /** «طلبات», «مبيعات», «خصم مدفوع», «إلغاء» — to spread into the list's columns; empty when denied. */
  columns: Column<Discount>[];
  /** The list table's minimum width with those columns in it. */
  minWidth: string;
}

/** A percentage as the API sends it (33.3) for display. */
const percent = (value: number) => formatPercentValue(value / 100);

/** The report for the window in the address, and the list columns drawn from it. */
export function useDiscountResults(workspaceId: string): DiscountResults {
  const t = useT(STRINGS);
  const range = useStoreReportRange();
  const { data, loading, error, reload } = useReport(
    () => (STORE_REPORTS_ENABLED ? storeReportDiscounts(apiClient, workspaceId, range.days) : Promise.resolve(null)),
    [workspaceId, range.days.from, range.days.to]
  );
  const denied = !STORE_REPORTS_ENABLED || reportDenied(error);
  const pending = loading && !data;
  const currency = data?.currency ?? "EGP";
  const byId = useMemo(() => new Map((data?.discounts ?? []).map((row) => [row.discountId, row])), [data]);

  const columns = useMemo<Column<Discount>[]>(() => {
    if (denied) return [];
    const cell = (show: (row: StoreReportDiscountRow) => ReactNode) => (discount: Discount) => {
      if (pending) return <SkeletonBar className="ms-auto w-10" />;
      const row = byId.get(discount.id);
      return row ? show(row) : "—";
    };
    // A discount with no orders in the window says nothing on a phone card.
    const phoneSkip = (discount: Discount) => !byId.has(discount.id);
    const money = (minor: string) => <span className="whitespace-nowrap">{formatMinorMoney(minor, currency)}</span>;
    // Four more columns in a list that was already full: a little less padding, and whole percents (the dialog keeps the decimal).
    const tight = { align: "end" as const, className: "px-2", headerClassName: "px-2", phoneSkip };
    return [
      { key: "resultOrders", header: t.orders, ...tight, cell: cell((row) => formatCount(row.orders)) },
      { key: "resultRevenue", header: t.revenue, ...tight, cell: cell((row) => <span className="font-medium text-ink">{money(row.revenue)}</span>) },
      { key: "resultGiven", header: t.discountGiven, ...tight, cell: cell((row) => money(row.discountGiven)) },
      { key: "resultCancelled", header: t.cancelled, ...tight, cell: cell((row) => formatPercentValue(row.cancelRate / 100, 0)) },
    ];
  }, [denied, pending, byId, currency, t]);

  return {
    range,
    byId,
    currency,
    pending,
    denied,
    error,
    reload,
    columns,
    minWidth: denied ? LIST_MIN_WIDTH : LIST_MIN_WIDTH_WITH_RESULTS,
  };
}

/** Above the list: the window the result columns cover, and the report as a file. */
export function DiscountResultsBar({ results, hidden = false, bare = false }: { results: DiscountResults; hidden?: boolean; /** Inside the Filters sheet: its group already names it, so no label and no margin. */ bare?: boolean }) {
  const t = useT(STRINGS);
  if (hidden || results.denied) return null;
  const { range } = results;
  const failed = Boolean(results.error) && !reportRangeRefused(results.error);
  return (
    <div className={bare ? "space-y-2" : "mb-4 space-y-2"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
          {!bare && <span className="flex h-11 items-center text-sm text-ink-soft md:h-9">{t.barLabel}</span>}
          <StoreReportRangeBar range={range} refused={reportRangeRefused(results.error)} />
        </div>
        <StoreReportCsvButton
          report="discounts"
          params={range.days}
          fileName={`discount-results-${range.days.from}-${range.days.to}`}
          disabled={range.invalid}
        />
      </div>
      {failed && (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-danger">
          {t.failed}
          <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={results.reload}>
            {t.retry}
          </Button>
        </p>
      )}
    </div>
  );
}

/** "Last 90 days", or the two picked days. */
export function useResultsWindowLabel(range: StoreReportRangeState): string {
  const c = useT(STORE_REPORT_STRINGS);
  if (range.preset !== "custom") return c[range.preset];
  const { from, to } = range.days;
  return from === to ? formatReportDay(from) : `${formatReportDay(from)} – ${formatReportDay(to)}`;
}

/**
 * In the discount's dialog: its numbers for the list's window — orders,
 * revenue, discount given, cancelled share, new against returning customers,
 * what was actually delivered — and the report as a file.
 */
export function DiscountResultsPanel({ results, discount }: { results: DiscountResults; discount: Discount }) {
  const t = useT(STRINGS);
  const windowLabel = useResultsWindowLabel(results.range);
  if (results.denied) return null;
  const row = results.byId.get(discount.id);
  const money = (minor: string) => formatMinorMoney(minor, results.currency);
  const figures: Array<[string, string]> = row
    ? [
        [t.orders, formatCount(row.orders)],
        [t.revenue, money(row.revenue)],
        [t.discountGiven, money(row.discountGiven)],
        [t.cancelled, percent(row.cancelRate)],
        [t.newCustomers, formatCount(row.newCustomers)],
        [t.returningCustomers, formatCount(row.returningCustomers)],
        [t.deliveredRevenue, money(row.deliveredRevenue)],
        [t.averageOrder, money(row.averageOrder)],
      ]
    : [];
  return (
    <section aria-label={t.panelTitle} data-slot="discount-results" className="zimos-offer-results rounded-[1.25rem] bg-paper-sunken/60 p-3.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {t.panelTitle} <span className="font-normal text-ink-soft">· {windowLabel}</span>
        </h3>
        <StoreReportCsvButton
          report="discounts"
          params={results.range.days}
          fileName={`discount-results-${results.range.days.from}-${results.range.days.to}`}
          disabled={results.range.invalid}
        />
      </div>
      {results.pending ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <SkeletonBar className="w-2/3" />
          <SkeletonBar className="w-1/2" />
        </div>
      ) : results.error ? (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-danger">
          {t.failed}
          <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={results.reload}>
            {t.retry}
          </Button>
        </p>
      ) : row ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {figures.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-ink-soft">{label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">{t.noOrders}</p>
      )}
    </section>
  );
}
