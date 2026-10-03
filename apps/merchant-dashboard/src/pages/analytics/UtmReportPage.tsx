import { useState, type ReactNode } from "react";
import { Target, X } from "lucide-react";
import { Card, cn } from "@store-builder/ui";
import {
  REPORT_UTM_GROUP_BY,
  reportsGetUtm,
  type ReportUtm,
  type ReportUtmFilterKey,
  type ReportUtmGroupBy,
  type ReportUtmRow,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatCount, formatWindow, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { RangeSwitch } from "@/components/RangeSwitch";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Sales by source",
    description: "Visitors, orders and sales for each UTM tag. Each order counts once, under the visit it was bought on.",
    groupLabel: "Group by",
    group_source: "Source",
    group_medium: "Medium",
    group_campaign: "Campaign",
    group_content: "Content",
    group_term: "Term",
    filtersLabel: "Showing only",
    removeFilter: "Remove filter {name}",
    visitors: "Visitors",
    orders: "Orders",
    sales: "Sales",
    conversionRate: "Conversion rate",
    deliveredSales: "Delivered sales",
    colValue: "Value",
    colVisitors: "Visitors",
    colOrders: "Orders",
    colConversion: "Conversion",
    colSales: "Sales",
    colAov: "Avg order",
    colConfirmed: "Confirmed",
    colDelivered: "Delivered",
    colDeliveredSales: "Delivered sales",
    direct: "Direct (no tag)",
    notTracked: "Not tracked",
    notTrackedHint:
      "Not tracked: orders the store saw no purchase for — entered by hand, taken by phone, or bought with tracking blocked. They are counted so the rows add up to your real sales.",
    drillHint: "Select a value to see what is behind it.",
    drillInto: "Show {name} broken down",
    empty: "No visits or orders in {window}.",
    emptyTitle: "Nothing in this period yet",
    truncated: "Showing the top {n} values by sales.",
    tableLabel: "Sales by {group}",
  },
  ar: {
    title: "المبيعات حسب المصدر",
    description: "الزوار والطلبات والمبيعات لكل وسم UTM. يُحتسب كل طلب مرة واحدة، تحت الزيارة التي تم الشراء فيها.",
    groupLabel: "التجميع حسب",
    group_source: "المصدر",
    group_medium: "الوسيلة",
    group_campaign: "الحملة",
    group_content: "المحتوى",
    group_term: "الكلمة",
    filtersLabel: "يُعرض فقط",
    removeFilter: "إزالة التصفية {name}",
    visitors: "الزوار",
    orders: "الطلبات",
    sales: "المبيعات",
    conversionRate: "معدل التحويل",
    deliveredSales: "مبيعات تم تسليمها",
    colValue: "القيمة",
    colVisitors: "الزوار",
    colOrders: "الطلبات",
    colConversion: "التحويل",
    colSales: "المبيعات",
    colAov: "متوسط الطلب",
    colConfirmed: "مؤكدة",
    colDelivered: "تم تسليمها",
    colDeliveredSales: "مبيعات تم تسليمها",
    direct: "مباشر (بدون وسم)",
    notTracked: "غير متتبَّع",
    notTrackedHint:
      "غير متتبَّع: طلبات لم يسجّل المتجر عملية شراء لها — أُدخلت يدويًا، أو استُلمت بالهاتف، أو تمّت مع حظر التتبع. تُحتسب حتى يساوي مجموع الصفوف مبيعاتك الفعلية.",
    drillHint: "اختر قيمة لترى تفاصيلها.",
    drillInto: "عرض تفاصيل {name}",
    empty: "لا توجد زيارات ولا طلبات في الفترة {window}.",
    emptyTitle: "لا شيء في هذه الفترة بعد",
    truncated: "تُعرض أعلى {n} قيمة حسب المبيعات.",
    tableLabel: "المبيعات حسب {group}",
  },
} satisfies Messages;

// Selecting a value narrows the report to it and groups by the next level down.
const DRILL: Partial<Record<ReportUtmGroupBy, { filter: ReportUtmFilterKey; next: ReportUtmGroupBy }>> = {
  source: { filter: "source", next: "campaign" },
  medium: { filter: "medium", next: "source" },
  campaign: { filter: "campaign", next: "content" },
};

/**
 * Sales by UTM (GET /analytics/utm). The rows always add up to the store's
 * orders and sales: a value, "direct" for a tracked purchase without a tag,
 * and "not tracked" for orders the storefront never saw bought. Values of
 * source, medium and campaign drill down to the next level.
 */
export function UtmReportPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [groupBy, setGroupBy] = useState<ReportUtmGroupBy>("source");
  const [filters, setFilters] = useState<Partial<Record<ReportUtmFilterKey, string>>>({});

  const report = useAsync<ReportUtm>(
    () => reportsGetUtm(apiClient, workspaceId, { ...rangeWindows(range).current, groupBy, ...filters }),
    [workspaceId, range, groupBy, filters.source, filters.medium, filters.campaign]
  );
  const data = report.data;

  const groupLabel = (g: ReportUtmGroupBy) => t[`group_${g}`];
  const filterEntries = Object.entries(filters) as [ReportUtmFilterKey, string][];

  return (
    <div className="min-w-0 max-w-7xl">
      <PageHeader title={t.title} description={t.description} actions={<RangeSwitch value={range} onChange={setRange} compare={false} />} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          label={t.groupLabel}
          tabs={REPORT_UTM_GROUP_BY.map((g) => ({ value: g, label: groupLabel(g) }))}
          value={groupBy}
          onChange={setGroupBy}
        />
        {filterEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft">{t.filtersLabel}</span>
            {filterEntries.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-paper-raised ps-3 pe-1 text-ink"
              >
                {groupLabel(key)}: <bdi dir="auto">{value}</bdi>
                <button
                  type="button"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label={fmt(t.removeFilter, { name: `${groupLabel(key)}: ${value}` })}
                  onClick={() =>
                    setFilters((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                >
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <DataState loading={report.loading && !data} error={data ? null : report.error} onRetry={() => void report.refresh()}>
        {data && (
          <Report
            report={data}
            refreshing={report.loading}
            groupLabel={groupLabel(data.groupBy)}
            onDrill={
              DRILL[data.groupBy]
                ? (value) => {
                    const drill = DRILL[data.groupBy]!;
                    setFilters((prev) => ({ ...prev, [drill.filter]: value }));
                    setGroupBy(drill.next);
                  }
                : null
            }
          />
        )}
      </DataState>
    </div>
  );
}

function Report({
  report,
  refreshing,
  groupLabel,
  onDrill,
}: {
  report: ReportUtm;
  refreshing: boolean;
  groupLabel: string;
  onDrill: ((value: string) => void) | null;
}) {
  const t = useT(STRINGS);
  const money = (v: number) => <bdi dir="ltr">{formatMoney(v, report.currency)}</bdi>;
  const percent = (v: number | null) => <bdi dir="ltr">{formatPercentValue(percentToRatio(v))}</bdi>;
  const count = (v: number) => <bdi dir="ltr">{formatCount(v)}</bdi>;
  const { totals } = report;

  if (report.rows.length === 0) {
    return (
      <EmptyState
        icon={<Target />}
        title={t.emptyTitle}
        description={fmt(t.empty, { window: formatWindow(report.range.from, report.range.to) })}
      />
    );
  }

  const label = (row: ReportUtmRow) => (row.key !== null ? row.key : row.tracked ? t.direct : t.notTracked);
  const hasUntracked = report.rows.some((r) => !r.tracked);

  return (
    <div className={cn("space-y-6 transition-opacity", refreshing && "opacity-60")} aria-busy={refreshing}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Total label={t.visitors} value={count(totals.visitors)} />
        <Total label={t.orders} value={count(totals.orders)} />
        <Total label={t.sales} value={money(totals.sales)} />
        <Total label={t.conversionRate} value={percent(totals.conversionRate)} />
        <Total label={t.deliveredSales} value={money(totals.deliveredSales)} />
      </div>

      <Card className="gap-0 p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">{fmt(t.tableLabel, { group: groupLabel })}</caption>
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {groupLabel}
                </th>
                {[t.colVisitors, t.colOrders, t.colConversion, t.colSales, t.colAov, t.colConfirmed, t.colDelivered, t.colDeliveredSales].map(
                  (col) => (
                    <th key={col} scope="col" className="px-4 py-3 text-end font-medium">
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => {
                const name = label(row);
                const drillable = onDrill !== null && row.key !== null;
                return (
                  <tr key={`${row.tracked}:${row.key ?? ""}`} className="border-b border-line last:border-0">
                    <th scope="row" className="max-w-[16rem] px-4 py-3 text-start font-medium text-ink">
                      {drillable ? (
                        <button
                          type="button"
                          className="max-w-full cursor-pointer truncate text-start text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                          aria-label={fmt(t.drillInto, { name })}
                          onClick={() => onDrill!(row.key!)}
                        >
                          <bdi dir="auto">{name}</bdi>
                        </button>
                      ) : (
                        <span className={cn("block truncate", row.key === null && "text-ink-soft")}>
                          <bdi dir="auto">{name}</bdi>
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-3 text-end tabular-nums">{row.tracked ? count(row.visitors) : "—"}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{count(row.orders)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{percent(row.conversionRate)}</td>
                    <td className="px-4 py-3 text-end tabular-nums font-medium text-ink">{money(row.sales)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{money(row.averageOrderValue)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{count(row.confirmedOrders)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{count(row.deliveredOrders)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{money(row.deliveredSales)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-1 text-xs text-ink-soft">
        {onDrill && <p>{t.drillHint}</p>}
        {hasUntracked && <p>{t.notTrackedHint}</p>}
        {report.truncated && <p>{fmt(t.truncated, { n: report.rows.length })}</p>}
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="h-full gap-0 p-4">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-1 tabular-nums text-xl font-semibold text-ink">{value}</p>
    </Card>
  );
}
