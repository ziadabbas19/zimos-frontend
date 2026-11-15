import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { reportsGetSales, type ReportsKpiKey, type ReportsSales, type ReportsSeriesPoint } from "@store-builder/api-client";
import { ComparisonLineChart } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatMinorMoney } from "@/lib/format";
import { formatBucket, formatCompactMoney, useReport, type ReportRange } from "@/lib/reportRange";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { changePercent, FunnelChart, formatRate, KpiGrid, OrdersHeatmap, SplitBar, type KpiCell } from "./parts";

const STRINGS = {
  en: {
    totalSales: "Total sales",
    orders: "Orders",
    averageOrderValue: "Average order value",
    sessions: "Sessions",
    conversionRate: "Conversion rate",
    deliveredSales: "Delivered sales",
    deliveredHint: "the money that actually comes in",
    overTime: "{metric} over time",
    thisPeriod: "This period",
    comparison: "Comparison",
    breakdown: "Total sales breakdown",
    breakdownHint: "How the total is built up.",
    grossSales: "Gross sales",
    discounts: "Discounts",
    refunds: "Refunds",
    netSales: "Net sales",
    shipping: "Shipping charged",
    funnel: "Conversion funnel",
    funnelHint: "Sessions that reached each step.",
    step_sessions: "Sessions",
    step_product: "Viewed a product",
    step_cart: "Added to cart",
    step_checkout: "Reached checkout",
    step_purchase: "Ordered",
    kept: "kept from the step before:",
    channels: "Sales by channel",
    channelsHint: "Where the sessions that bought came from.",
    channel: "Channel",
    sales: "Sales",
    conversion: "Conversion",
    direct: "Direct",
    devices: "Sessions by device",
    payments: "Sales by payment method",
    customers: "New and returning customers",
    newCustomers: "New customers",
    returningCustomers: "Returning customers",
    lost: "Lost orders",
    lostHint: "Checkouts that were started and left.",
    abandoned: "Abandoned checkouts",
    abandonedValue: "Value left behind",
    recovered: "Recovered",
    recoveryRate: "Recovery rate",
    openLost: "Open lost orders",
    heatmap: "When orders come in",
    heatmapHint: "By weekday and hour, in the store's time. Darker is busier.",
    days: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
    noRows: "No sessions in this period yet.",
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Wallet",
    valu: "valU installments",
    kiosk: "Kiosk (Aman / Masary)",
    bank_transfer: "Bank transfer",
    mobile: "Mobile",
    desktop: "Desktop",
    tablet: "Tablet",
    unknown: "Unknown",
  },
  ar: {
    totalSales: "إجمالي المبيعات",
    orders: "الطلبات",
    averageOrderValue: "متوسط قيمة الطلب",
    sessions: "الزيارات",
    conversionRate: "معدل التحويل",
    deliveredSales: "المبيعات المُسلَّمة",
    deliveredHint: "الفلوس اللي بتدخل فعلًا",
    overTime: "{metric} على مدار الفترة",
    thisPeriod: "هذه الفترة",
    comparison: "المقارنة",
    breakdown: "تفصيل إجمالي المبيعات",
    breakdownHint: "الإجمالي متكوّن من إيه.",
    grossSales: "المبيعات قبل الخصم",
    discounts: "الخصومات",
    refunds: "المبالغ المستردة",
    netSales: "صافي المبيعات",
    shipping: "رسوم الشحن",
    funnel: "مسار التحويل",
    funnelHint: "الزيارات التي وصلت لكل خطوة.",
    step_sessions: "الزيارات",
    step_product: "شاهدوا منتجًا",
    step_cart: "أضافوا للسلة",
    step_checkout: "وصلوا لإتمام الطلب",
    step_purchase: "طلبوا",
    kept: "استمر من الخطوة السابقة:",
    channels: "المبيعات حسب القناة",
    channelsHint: "من أين جاءت الزيارات التي اشترت.",
    channel: "القناة",
    sales: "المبيعات",
    conversion: "التحويل",
    direct: "مباشر",
    devices: "الزيارات حسب الجهاز",
    payments: "المبيعات حسب طريقة الدفع",
    customers: "العملاء الجدد والعائدون",
    newCustomers: "عملاء جدد",
    returningCustomers: "عملاء عائدون",
    lost: "الطلبات المفقودة",
    lostHint: "طلبات بدأها العميل ولم يكملها.",
    abandoned: "طلبات غير مكتملة",
    abandonedValue: "قيمة ما تُرك",
    recovered: "تم استرجاعها",
    recoveryRate: "معدل الاسترجاع",
    openLost: "افتح الطلبات المفقودة",
    heatmap: "متى تأتي الطلبات",
    heatmapHint: "حسب اليوم والساعة بتوقيت المتجر. الأغمق أكثر ازدحامًا.",
    days: "الأحد,الإثنين,الثلاثاء,الأربعاء,الخميس,الجمعة,السبت",
    noRows: "لا توجد زيارات في هذه الفترة بعد.",
    cod: "الدفع عند الاستلام",
    card: "بطاقة",
    wallet: "محفظة",
    valu: "تقسيط valU",
    kiosk: "الدفع في الكشك (أمان / مصاري)",
    bank_transfer: "تحويل بنكي",
    mobile: "موبايل",
    desktop: "كمبيوتر",
    tablet: "تابلت",
    unknown: "غير معروف",
  },
} satisfies Messages;

type ChartMetric = "totalSales" | "orders" | "averageOrderValue" | "sessions" | "conversionRate" | "deliveredSales";

const SERIES_FIELD: Record<ChartMetric, keyof ReportsSeriesPoint> = {
  totalSales: "sales",
  orders: "orders",
  averageOrderValue: "averageOrderValue",
  sessions: "sessions",
  conversionRate: "conversionRate",
  deliveredSales: "deliveredSales",
};
const MONEY_METRICS = new Set<ChartMetric>(["totalSales", "averageOrderValue", "deliveredSales"]);
const METRICS: ChartMetric[] = ["totalSales", "orders", "averageOrderValue", "sessions", "conversionRate", "deliveredSales"];
const TONES = ["bg-primary", "bg-accent", "bg-success", "bg-primary-dark"];

type ChannelRow = ReportsSales["channels"][number];

export function OverviewTab({ workspaceId, range }: { workspaceId: string; range: ReportRange }) {
  const t = useT(STRINGS);
  const [metric, setMetric] = useState<ChartMetric>("totalSales");
  const { data, loading, error, reload } = useReport(
    () => reportsGetSales(apiClient, workspaceId, { from: range.from, to: range.to, compare: range.compare }),
    [workspaceId, range.from, range.to, range.compare]
  );

  const view = useMemo(() => {
    if (!data) return null;
    const money = (minor: number | null) => formatMinorMoney(minor ?? 0, data.currency);
    const display = (key: ChartMetric, value: number | null) =>
      MONEY_METRICS.has(key) ? money(value) : key === "conversionRate" ? formatRate(value) : formatCount(value);
    const numbers = (rows: ReportsSeriesPoint[] | null, key: ChartMetric) =>
      rows ? rows.map((row) => Number(row[SERIES_FIELD[key]] ?? 0)) : null;
    const cells: KpiCell[] = METRICS.map((key) => {
      const kpi = data.kpis[key as ReportsKpiKey];
      return {
        key,
        label: t[key],
        value: <bdi dir="ltr">{display(key, kpi.value)}</bdi>,
        change: changePercent(kpi.value, kpi.previous),
        hint: key === "deliveredSales" ? t.deliveredHint : undefined,
        spark: numbers(data.series, key) ?? [],
        sparkPrevious: numbers(data.previousSeries, key),
      };
    });
    const points = data.series.map((row, index) => {
      const before = data.previousSeries?.[index];
      return {
        label: formatBucket(row.bucket, data.unit),
        value: Number(row[SERIES_FIELD[metric]] ?? 0),
        previous: before ? Number(before[SERIES_FIELD[metric]] ?? 0) : null,
        previousLabel: before ? formatBucket(before.bucket, data.unit) : undefined,
      };
    });
    return { money, display, cells, points };
  }, [data, metric, t]);

  const channelColumns: Column<ChannelRow>[] = [
    {
      key: "channel",
      header: t.channel,
      cell: (row) => (
        <span className="font-medium text-ink">
          {row.source === "direct" ? t.direct : row.source}
          {row.medium && <span className="ms-1.5 text-xs font-normal text-ink-soft">{row.medium}</span>}
        </span>
      ),
    },
    { key: "sessions", header: t.sessions, align: "end", cell: (row) => formatCount(row.sessions) },
    { key: "orders", header: t.orders, align: "end", cell: (row) => formatCount(row.orders) },
    { key: "conversion", header: t.conversion, align: "end", cell: (row) => formatRate(row.conversionRate) },
    {
      key: "sales",
      header: t.sales,
      align: "end",
      cell: (row) => <span className="font-medium text-ink">{view?.money(row.sales)}</span>,
    },
  ];

  const label = (key: string) => (key in t ? t[key as keyof typeof t] : key);

  return (
    <DataState loading={loading && !data} error={error} onRetry={reload}>
      {data && view && (
        <div className="space-y-5">
          <KpiGrid cells={view.cells} selected={metric} onSelect={(key) => setMetric(key as ChartMetric)} />

          <Section title={t.overTime.replace("{metric}", t[metric])}>
            <ComparisonLineChart
              points={view.points}
              format={(value) => view.display(metric, value)}
              formatAxis={(value) =>
                MONEY_METRICS.has(metric)
                  ? formatCompactMoney(value)
                  : metric === "conversionRate"
                    ? `${value.toFixed(1)}%`
                    : formatCount(Math.round(value))
              }
              height={260}
              summary={t.overTime.replace("{metric}", t[metric])}
              currentLabel={t.thisPeriod}
              previousLabel={t.comparison}
            />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={t.breakdown} description={t.breakdownHint}>
              <dl className="divide-y divide-line text-sm">
                {(
                  [
                    ["grossSales", 1],
                    ["discounts", -1],
                    ["refunds", -1],
                    ["netSales", 1],
                    ["shipping", 1],
                    ["totalSales", 1],
                  ] as const
                ).map(([key, sign]) => {
                  const kpi = data.kpis[key];
                  const strong = key === "netSales" || key === "totalSales";
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 py-2.5">
                      <dt className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{t[key]}</dt>
                      <dd className={strong ? "font-semibold text-ink tabular-nums" : "text-ink tabular-nums"}>
                        <bdi dir="ltr">
                          {sign < 0 && (kpi.value ?? 0) > 0 ? "−" : ""}
                          {view.money(kpi.value)}
                        </bdi>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Section>

            <Section title={t.funnel} description={t.funnelHint}>
              <FunnelChart
                steps={data.funnel}
                keptLabel={t.kept}
                labels={{
                  sessions: t.step_sessions,
                  product: t.step_product,
                  cart: t.step_cart,
                  checkout: t.step_checkout,
                  purchase: t.step_purchase,
                }}
              />
            </Section>
          </div>

          <Section title={t.channels} description={t.channelsHint} flush>
            <DataTable
              phoneCards={false}
              columns={channelColumns}
              rows={data.channels}
              rowKey={(row) => `${row.source}/${row.medium ?? ""}`}
              minWidth="36rem"
              empty={<p className="px-4 pb-4 text-sm text-ink-soft">{t.noRows}</p>}
            />
          </Section>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title={t.devices}>
              <SplitBar
                parts={data.devices.map((row, i) => ({
                  label: label(row.device),
                  value: row.sessions,
                  display: formatCount(row.sessions),
                  className: TONES[i % TONES.length],
                }))}
              />
            </Section>
            <Section title={t.payments}>
              <SplitBar
                parts={data.paymentMethods.map((row, i) => ({
                  label: label(row.method),
                  value: row.sales,
                  display: view.money(row.sales),
                  className: TONES[i % TONES.length],
                }))}
              />
            </Section>
            <Section title={t.customers}>
              <SplitBar
                parts={[
                  {
                    label: t.newCustomers,
                    value: data.kpis.newCustomerSales.value ?? 0,
                    display: view.money(data.kpis.newCustomerSales.value),
                    className: "bg-primary",
                  },
                  {
                    label: t.returningCustomers,
                    value: data.kpis.returningCustomerSales.value ?? 0,
                    display: view.money(data.kpis.returningCustomerSales.value),
                    className: "bg-accent",
                  },
                ]}
              />
            </Section>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title={t.heatmap} description={t.heatmapHint} className="lg:col-span-2">
              <OrdersHeatmap cells={data.heatmap} dayLabels={t.days.split(",")} summary={t.heatmap} />
            </Section>
            <Section
              title={t.lost}
              description={t.lostHint}
              actions={
                <Link to="/abandoned-carts" className="text-sm font-medium text-primary hover:underline">
                  {t.openLost}
                </Link>
              }
            >
              <dl className="divide-y divide-line text-sm">
                {(
                  [
                    [t.abandoned, formatCount(data.kpis.abandonedCheckouts.value)],
                    [t.abandonedValue, view.money(data.kpis.abandonedValue.value)],
                    [t.recovered, formatCount(data.kpis.recoveredCheckouts.value)],
                    [t.recoveryRate, formatRate(data.kpis.recoveryRate.value)],
                  ] as const
                ).map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-ink-soft">{name}</dt>
                    <dd className="font-medium text-ink tabular-nums">
                      <bdi dir="ltr">{value}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>
        </div>
      )}
    </DataState>
  );
}
