import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, X } from "lucide-react";
import { Button } from "@store-builder/ui";
import {
  ordersReportExportCsv,
  ordersReportGet,
  ordersReportOrders,
  type OrderStage,
  type OrdersReportGroup,
  type OrdersReportKpiKey,
  type OrdersReportOrder,
  type OrdersReportTableParams,
  type PaymentMethod,
} from "@store-builder/api-client";
import { ComparisonLineChart } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatCount, formatWindow } from "@/lib/analytics";
import { formatDateTime, formatMinorMoney, placeName } from "@/lib/format";
import { formatBucket, formatCompactMoney, useReport, useReportRange } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";
import { changePercent, formatRate, KpiGrid, type KpiCell } from "../reports/parts";
import { CsvButton, FilterRow, RangeBar, ReportSkeleton } from "./reportKit";

const STRINGS = {
  en: {
    title: "Orders report",
    description: "How many orders came in, what they brought and how they ended — {window}.",
    back: "Analytics",
    orders: "Orders",
    revenue: "Revenue",
    averageOrderValue: "Average order",
    cancellationRate: "Cancellation rate",
    returnRate: "Return rate",
    deliveryRate: "Delivery rate",
    revenueHint: "cancelled and unpaid orders left out",
    ratesHint: "of the orders that left with a courier",
    trend: "Orders and revenue by day",
    trendHint: "This period against the comparison period.",
    metric: "Show",
    thisPeriod: "This period",
    comparison: "Comparison",
    byStatus: "By status",
    byStatusHint: "The same stages as the Orders page. Pick one to list its orders below.",
    byPayment: "By payment method",
    byGovernorate: "By governorate",
    byCarrier: "By courier",
    noGovernorate: "No governorate",
    notShipped: "Not shipped yet",
    filterHint: "Pick a row to list its orders below.",
    ordersOf: "{orders} orders · {revenue}",
    delivered: "{rate} delivered",
    table: "The orders behind the numbers",
    tableHint: "Newest first. Archived and test orders are left out, as on the Orders page.",
    filteredBy: "Showing: {filter}",
    clearFilter: "Show all orders",
    order: "Order",
    placed: "Placed",
    status: "Status",
    customer: "Customer",
    hidden: "Hidden",
    governorate: "Governorate",
    payment: "Payment",
    courier: "Courier",
    items: "Items",
    total: "Total",
    notInRevenue: "not in revenue",
    noOrdersTitle: "No orders in these dates",
    noOrdersBody: "Pick a wider range, or come back once orders come in.",
    noRows: "No orders match this filter.",
    openOrders: "Open the Orders page",
  },
  ar: {
    title: "تقرير الطلبات",
    description: "كم طلبًا وصلك، وكم جلب، وكيف انتهى — {window}.",
    back: "التحليلات",
    orders: "الطلبات",
    revenue: "الإيرادات",
    averageOrderValue: "متوسط الطلب",
    cancellationRate: "نسبة الإلغاء",
    returnRate: "نسبة المرتجع",
    deliveryRate: "نسبة التسليم",
    revenueHint: "بدون الملغاة وغير المدفوعة",
    ratesHint: "من الطلبات التي خرجت مع شركة الشحن",
    trend: "الطلبات والإيرادات يومًا بيوم",
    trendHint: "هذه الفترة مقابل فترة المقارنة.",
    metric: "اعرض",
    thisPeriod: "هذه الفترة",
    comparison: "المقارنة",
    byStatus: "حسب الحالة",
    byStatusHint: "نفس مراحل صفحة الطلبات. اختر واحدة لعرض طلباتها بالأسفل.",
    byPayment: "حسب طريقة الدفع",
    byGovernorate: "حسب المحافظة",
    byCarrier: "حسب شركة الشحن",
    noGovernorate: "بدون محافظة",
    notShipped: "لم تُشحن بعد",
    filterHint: "اختر صفًا لعرض طلباته بالأسفل.",
    ordersOf: "{orders} طلب · {revenue}",
    delivered: "{rate} تم تسليمها",
    table: "الطلبات وراء الأرقام",
    tableHint: "الأحدث أولًا. الطلبات المؤرشفة والتجريبية غير محسوبة، مثل صفحة الطلبات.",
    filteredBy: "المعروض: {filter}",
    clearFilter: "اعرض كل الطلبات",
    order: "الطلب",
    placed: "التاريخ",
    status: "الحالة",
    customer: "العميل",
    hidden: "مخفي",
    governorate: "المحافظة",
    payment: "الدفع",
    courier: "الشحن",
    items: "القطع",
    total: "الإجمالي",
    notInRevenue: "خارج الإيرادات",
    noOrdersTitle: "لا توجد طلبات في هذه التواريخ",
    noOrdersBody: "اختر فترة أطول، أو ارجع بعد ما تصلك طلبات.",
    noRows: "لا توجد طلبات بهذا الاختيار.",
    openOrders: "افتح صفحة الطلبات",
  },
} satisfies Messages;

const KPIS: OrdersReportKpiKey[] = ["orders", "revenue", "averageOrderValue", "cancellationRate", "returnRate", "deliveryRate"];
const RATE_KPIS = new Set<OrdersReportKpiKey>(["cancellationRate", "returnRate", "deliveryRate"]);
const MONEY_KPIS = new Set<OrdersReportKpiKey>(["revenue", "averageOrderValue"]);
type TrendMetric = "orders" | "revenue";

/** What the table is narrowed to: one breakdown row. `""` = the "none" row. */
type Filter =
  | { kind: "status"; value: OrderStage }
  | { kind: "governorate"; value: string }
  | { kind: "paymentMethod"; value: string }
  | { kind: "carrier"; value: string };

function filterParams(filter: Filter | null): OrdersReportTableParams {
  if (!filter) return {};
  return { [filter.kind]: filter.value } as OrdersReportTableParams;
}

/** /analytics/orders — ORDER_PRODUCT_REPORTS_ENABLED. */
export function OrdersReportPage() {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const navigate = useNavigate();
  const { range, setPreset, setDays, setCompare } = useReportRange();
  const [metric, setMetric] = useState<TrendMetric>("orders");
  const [filter, setFilter] = useState<Filter | null>(null);

  const report = useReport(
    () => ordersReportGet(apiClient, workspaceId, { from: range.from, to: range.to, compare: range.compare }),
    [workspaceId, range.from, range.to, range.compare]
  );
  const data = report.data;

  // The table: its own pages, from the first again when the range or the filter changes.
  const [rows, setRows] = useState<OrdersReportOrder[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<unknown>(null);
  const loadPage = useCallback(
    async (next: string | null) => {
      setTableLoading(true);
      setTableError(null);
      try {
        const page = await ordersReportOrders(apiClient, workspaceId, { from: range.from, to: range.to, ...filterParams(filter), cursor: next ?? undefined });
        setRows((prev) => (next ? [...prev, ...page.orders] : page.orders));
        setCursor(page.nextCursor);
      } catch (err) {
        setTableError(err);
      } finally {
        setTableLoading(false);
      }
    },
    [workspaceId, range.from, range.to, filter]
  );
  useEffect(() => {
    setRows([]);
    void loadPage(null);
  }, [loadPage]);

  const money = useCallback((minor: number | null | undefined) => formatMinorMoney(minor ?? 0, data?.currency ?? "EGP"), [data?.currency]);
  const display = useCallback(
    (key: OrdersReportKpiKey, value: number | null) => (RATE_KPIS.has(key) ? formatRate(value) : MONEY_KPIS.has(key) ? money(value) : formatCount(value)),
    [money]
  );

  const view = useMemo(() => {
    if (!data) return null;
    const ordersSeries = data.series.map((p) => p.orders);
    const revenueSeries = data.series.map((p) => p.revenue);
    const cells: KpiCell[] = KPIS.map((key) => {
      const kpi = data.kpis[key];
      return {
        key,
        label: t[key],
        value: <bdi dir="ltr">{display(key, kpi.value)}</bdi>,
        change: changePercent(kpi.value, kpi.previous),
        inverted: key === "cancellationRate" || key === "returnRate",
        hint: key === "revenue" ? t.revenueHint : key === "returnRate" || key === "deliveryRate" ? t.ratesHint : undefined,
        spark: key === "orders" ? ordersSeries : key === "revenue" ? revenueSeries : undefined,
        sparkPrevious: key === "orders" ? data.previousSeries?.map((p) => p.orders) ?? null : key === "revenue" ? data.previousSeries?.map((p) => p.revenue) ?? null : null,
      };
    });
    const points = data.series.map((p, i) => {
      const before = data.previousSeries?.[i];
      return {
        label: formatBucket(p.bucket, data.unit),
        value: p[metric],
        previous: before ? before[metric] : null,
        previousLabel: before ? formatBucket(before.bucket, data.unit) : undefined,
      };
    });
    return { cells, points };
  }, [data, display, metric, t]);

  const groupName = (kind: Filter["kind"], name: string | null) => {
    if (kind === "governorate") return name ? placeName(name) : t.noGovernorate;
    if (kind === "carrier") return name ? name : t.notShipped;
    if (kind === "paymentMethod") return labels.paymentMethod(name as PaymentMethod);
    return labels.stage(name as OrderStage);
  };
  const filterLabel = filter ? groupName(filter.kind, filter.value || null) : "";
  const toggle = (next: Filter) =>
    setFilter((prev) => (prev && prev.kind === next.kind && prev.value === next.value ? null : next));
  const isActive = (kind: Filter["kind"], value: string) => Boolean(filter && filter.kind === kind && filter.value === value);

  const groupList = (kind: "governorate" | "paymentMethod" | "carrier", groups: OrdersReportGroup[]) => {
    const top = Math.max(1, ...groups.map((g) => g.orders));
    if (groups.length === 0) return <p className="text-sm text-ink-soft">{t.noRows}</p>;
    return (
      <ul className="space-y-1">
        {groups.map((g) => (
          <FilterRow
            key={g.name ?? "none"}
            active={isActive(kind, g.name ?? "")}
            onClick={() => toggle({ kind, value: g.name ?? "" })}
            label={groupName(kind, g.name)}
            value={<bdi dir="ltr">{formatCount(g.orders)}</bdi>}
            share={g.orders / top}
            caption={
              <>
                <bdi dir="ltr">{money(g.revenue)}</bdi>
                {g.shipped > 0 && <> · {fmt(t.delivered, { rate: formatRate(g.deliveryRate) })}</>}
              </>
            }
          />
        ))}
      </ul>
    );
  };

  const columns: Column<OrdersReportOrder>[] = [
    {
      key: "order",
      header: t.order,
      cell: (o) => (
        <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
          <bdi dir="ltr">#{o.orderNumber}</bdi>
        </Link>
      ),
    },
    { key: "placed", header: t.placed, cell: (o) => <span className="whitespace-nowrap text-ink-soft">{formatDateTime(o.createdAt)}</span> },
    { key: "status", header: t.status, cell: (o) => <StatusBadge value={o.status} tone={STAGE_TONE[o.status]} text={labels.stage(o.status)} /> },
    ...(rows.some((o) => o.customerName !== undefined)
      ? [
          {
            key: "customer",
            header: t.customer,
            cell: (o: OrdersReportOrder) => (o.contactLocked ? <span className="text-ink-soft">{t.hidden}</span> : <span dir="auto">{o.customerName ?? "—"}</span>),
          },
        ]
      : []),
    { key: "governorate", header: t.governorate, phoneSkip: (o) => !o.governorate, cell: (o) => (o.governorate ? placeName(o.governorate) : "—") },
    { key: "payment", header: t.payment, cell: (o) => labels.paymentMethod(o.paymentMethod as PaymentMethod) },
    { key: "courier", header: t.courier, phoneSkip: (o) => !o.carrier, cell: (o) => <span className="capitalize">{o.carrier ?? "—"}</span> },
    { key: "items", header: t.items, align: "end", cell: (o) => formatCount(o.items) },
    {
      key: "total",
      header: t.total,
      align: "end",
      cell: (o) => (
        <span className="whitespace-nowrap">
          <bdi dir="ltr" className={o.countsAsRevenue ? "font-medium text-ink" : "text-ink-soft line-through"}>
            {money(o.total)}
          </bdi>
          {!o.countsAsRevenue && <span className="sr-only"> ({t.notInRevenue})</span>}
        </span>
      ),
    },
  ];

  const empty = data && data.kpis.orders.value === 0 && (data.kpis.orders.previous ?? 0) === 0;

  return (
    <div className="min-w-0">
      <PageHeader
        title={t.title}
        description={fmt(t.description, { window: formatWindow(range.from, range.to) })}
        back={{ to: "/analytics", label: t.back }}
        actions={
          <CsvButton
            load={() => ordersReportExportCsv(apiClient, workspaceId, { from: range.from, to: range.to, ...filterParams(filter) })}
            filename={`zimos-orders-${range.fromDay}-${range.toDay}.csv`}
            onError={toast.error}
          />
        }
      />
      <RangeBar range={range} onPreset={setPreset} onDays={setDays} onCompare={setCompare} />

      <DataState loading={report.loading && !data} error={report.error} onRetry={report.reload} skeleton={<ReportSkeleton />}>
        {data && view && empty && (
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={t.noOrdersTitle}
            description={t.noOrdersBody}
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/orders">{t.openOrders}</Link>
              </Button>
            }
          />
        )}
        {data && view && !empty && (
          <div className="space-y-5" aria-busy={report.loading || undefined}>
            <KpiGrid
              cells={view.cells}
              selected={metric}
              onSelect={(key) => (key === "orders" || key === "revenue" ? setMetric(key) : undefined)}
            />

            <Section
              title={t.trend}
              description={t.trendHint}
              actions={
                <Segmented
                  label={t.metric}
                  size="sm"
                  value={metric}
                  onChange={(v) => setMetric(v)}
                  options={[
                    { value: "orders", label: t.orders },
                    { value: "revenue", label: t.revenue },
                  ]}
                />
              }
            >
              <ComparisonLineChart
                points={view.points}
                format={(v) => (metric === "revenue" ? money(v) : formatCount(v))}
                formatAxis={(v) => (metric === "revenue" ? formatCompactMoney(v) : formatCount(Math.round(v)))}
                height={260}
                summary={t.trend}
                currentLabel={t.thisPeriod}
                previousLabel={t.comparison}
              />
            </Section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title={t.byStatus} description={t.byStatusHint}>
                <ul className="space-y-1">
                  {data.byStatus.map((s) => (
                    <FilterRow
                      key={s.status}
                      active={isActive("status", s.status)}
                      onClick={() => toggle({ kind: "status", value: s.status })}
                      label={labels.stage(s.status)}
                      value={<bdi dir="ltr">{formatCount(s.orders)}</bdi>}
                      share={data.kpis.orders.value ? s.orders / data.kpis.orders.value : 0}
                    />
                  ))}
                </ul>
              </Section>
              <div className="grid gap-5">
                <Section title={t.byPayment} description={t.filterHint}>
                  {groupList("paymentMethod", data.byPaymentMethod)}
                </Section>
                <Section title={t.byCarrier} description={t.filterHint}>
                  {groupList("carrier", data.byCarrier)}
                </Section>
              </div>
            </div>

            <Section title={t.byGovernorate} description={t.filterHint}>
              <div className="max-h-[28rem] overflow-y-auto pe-1">
                {groupList("governorate", data.byGovernorate)}
              </div>
            </Section>

            <Section
              title={t.table}
              description={t.tableHint}
              flush
              actions={
                filter ? (
                  <Button variant="outline" size="sm" onClick={() => setFilter(null)} aria-label={t.clearFilter}>
                    <span className="max-w-[12rem] truncate">{fmt(t.filteredBy, { filter: filterLabel })}</span>
                    <X className="size-4" aria-hidden />
                  </Button>
                ) : undefined
              }
            >
              <div className="px-4 pb-4">
                {tableError ? (
                  <DataState loading={false} error={tableError} onRetry={() => void loadPage(null)}>
                    {null}
                  </DataState>
                ) : (
                  <>
                    <DataTable
                      columns={columns}
                      rows={rows}
                      rowKey={(o) => o.id}
                      onRowClick={(o) => navigate(`/orders/${o.id}`)}
                      loading={tableLoading}
                      minWidth="56rem"
                      empty={<p className="py-6 text-center text-sm text-ink-soft">{t.noRows}</p>}
                    />
                    <LoadMore hasMore={Boolean(cursor)} loading={tableLoading} onClick={() => void loadPage(cursor)} />
                  </>
                )}
              </div>
            </Section>
          </div>
        )}
      </DataState>
      {/* The page's numbers are said for screen readers when they change. */}
      <p className="sr-only" aria-live="polite">
        {data && !report.loading ? `${t.orders}: ${formatCount(data.kpis.orders.value)}. ${t.revenue}: ${money(data.kpis.revenue.value)}.` : ""}
      </p>
    </div>
  );
}
