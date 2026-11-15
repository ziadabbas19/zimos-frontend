import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, BarChart3, Info, Users } from "lucide-react";
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@store-builder/ui";
import type { AnalyticsSummary } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ComparisonLineChart, HBarList, Sparkline } from "@/components/charts";
import { RangeSwitch } from "@/components/RangeSwitch";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import {
  deltaBasisPoints,
  formatAxisDate,
  formatCount,
  formatWindow,
  percentToRatio,
  useAnalyticsSummary,
  type AnalyticsRange,
} from "@/lib/analytics";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Analytics",
    description: "Sales come from your real orders, visits from your store's own tracking. Nothing is estimated.",
    comparedTo: "{current} compared to {previous}",
    thisPeriod: "This period",
    previousPeriod: "Previous period",
    vsPrevious: "vs previous period",
    noComparison: "No previous period to compare",
    grossSales: "Gross sales",
    grossSalesHint: "Value of the orders placed, minus cancelled and rejected ones.",
    orders: "Orders",
    ordersHint: "Orders placed in this period.",
    avgOrderValue: "Average order value",
    avgOrderHint: "Gross sales ÷ orders.",
    ordersDelivered: "Orders delivered",
    ordersDeliveredHint: "Orders that reached the customer.",
    deliveredRevenue: "Delivered sales",
    deliveredRevenueHint: "Value of the orders that reached the customer.",
    collected: "Cash collected",
    collectedHint: "Payments actually recorded against orders.",
    grossProfit: "Gross profit",
    grossProfitHint: "Delivered item revenue minus discounts, product cost and refunds.",
    confirmationRate: "Confirmation rate",
    confirmationHint: "Confirmed ÷ orders you got an answer on.",
    deliveryRate: "Delivery rate",
    deliveryHint: "Delivered ÷ confirmed.",
    returnRate: "Return rate",
    returnHint: "Returned ÷ (delivered + returned).",
    newCustomers: "New customers",
    newCustomersHint: "Customers whose first order was in this period.",
    salesOverTime: "Total sales over time",
    salesOverTimeDesc: "Daily gross sales in {currency}, against the previous period.",
    ordersOverTime: "Orders over time",
    ordersOverTimeDesc: "Orders per day, against the previous period.",
    ordersCount: "{n} orders",
    breakdownTitle: "Sales breakdown",
    breakdownDesc: "Where the money in this period stands.",
    rowGross: "Gross sales",
    rowGrossSub: "All placed orders, minus cancelled and rejected",
    rowDelivered: "Delivered sales",
    rowDeliveredSub: "Orders that reached the customer",
    rowCollected: "Cash collected",
    rowCollectedSub: "Payments recorded",
    rowRefunded: "Refunds",
    rowRefundedSub: "Money given back",
    rowDiscounts: "Discounts",
    rowDiscountsSub: "On delivered orders",
    rowShipping: "Shipping charged",
    rowShippingSub: "On delivered orders",
    journeyTitle: "Order journey",
    journeyDesc: "How far this period's orders got.",
    stepPlaced: "Placed",
    stepConfirmed: "Confirmed",
    stepDelivered: "Delivered",
    stepReturned: "Returned",
    ofPlaced: "{pct} of placed",
    productsTitle: "Top selling products",
    productsDesc: "By units sold in this period.",
    colProduct: "Product",
    colUnits: "Units",
    colSales: "Sales",
    noProducts: "Nothing sold yet in this period",
    noProductsDesc: "Once orders come in, your best sellers are listed here.",
    unnamedProduct: "Unnamed product",
    statusTitle: "Orders by status",
    statusDesc: "This period's orders, by where they are now.",
    statusPending: "Waiting for confirmation",
    statusConfirmed: "Confirmed",
    statusPostponed: "Postponed",
    statusUnreachable: "Couldn't reach them",
    statusRejected: "Rejected",
    statusCancelled: "Cancelled",
    statusDelivered: "Delivered",
    statusReturned: "Returned",
    noActivity: "No orders in this period",
    noActivityDesc: "The charts fill in as soon as orders start coming in.",
    sessions: "Sessions",
    sessionsHint: "Visits to your store and funnels, counted by the store itself.",
    visitors: "Visitors",
    visitorsHint: "Distinct shoppers, counted once per browser tab.",
    conversionRate: "Conversion rate",
    conversionRateHint: "Sessions that placed an order ÷ sessions.",
    sessionsOverTime: "Sessions over time",
    sessionsOverTimeDesc: "Visits per day, against the previous period.",
    sessionsCount: "{n} sessions",
    funnelTitle: "Conversion funnel",
    funnelDesc: "How far this period's visits got.",
    stepSessions: "Sessions",
    stepAddToCart: "Added to cart",
    stepCheckout: "Reached checkout",
    stepOrders: "Placed an order",
    ofSessions: "{pct} of sessions",
    devicesTitle: "Sessions by device",
    devicesDesc: "By the device of each visit.",
    deviceMobile: "Mobile",
    deviceDesktop: "Desktop",
    deviceTablet: "Tablet",
    deviceUnknown: "Unknown",
    sourcesTitle: "Sessions by source",
    sourcesDesc: "From the UTM tags and referrers visits arrived with.",
    colSource: "Source",
    colSessions: "Sessions",
    colOrders: "Orders",
    direct: "Direct / untagged",
    pagesTitle: "Top pages",
    pagesDesc: "Most viewed pages in this period.",
    colPage: "Page",
    colViews: "Views",
    noTraffic: "No visits recorded yet",
    noTrafficDesc: "The store sends a visit the moment someone opens it — sessions, devices and sources appear here then.",
  },
  ar: {
    title: "التحليلات",
    description: "أرقام المبيعات محسوبة من طلباتك الفعلية، والزيارات من تتبّع متجرك نفسه. لا يوجد أي رقم تقديري.",
    comparedTo: "{current} مقارنةً بـ {previous}",
    thisPeriod: "هذه الفترة",
    previousPeriod: "الفترة السابقة",
    vsPrevious: "مقارنةً بالفترة السابقة",
    noComparison: "لا توجد فترة سابقة للمقارنة",
    grossSales: "إجمالي المبيعات",
    grossSalesHint: "قيمة الطلبات المُنشأة، بعد استبعاد الملغاة والمرفوضة.",
    orders: "الطلبات",
    ordersHint: "الطلبات المُنشأة في هذه الفترة.",
    avgOrderValue: "متوسط قيمة الطلب",
    avgOrderHint: "إجمالي المبيعات ÷ عدد الطلبات.",
    ordersDelivered: "الطلبات المُسلَّمة",
    ordersDeliveredHint: "الطلبات التي وصلت إلى العميل.",
    deliveredRevenue: "المبيعات المُسلَّمة",
    deliveredRevenueHint: "قيمة الطلبات التي وصلت إلى العميل.",
    collected: "المبالغ المحصَّلة",
    collectedHint: "المدفوعات المسجَّلة فعلًا على الطلبات.",
    grossProfit: "إجمالي الربح",
    grossProfitHint: "إيراد المنتجات المُسلَّمة بعد خصم الخصومات وتكلفة المنتجات والمبالغ المستردة.",
    confirmationRate: "نسبة التأكيد",
    confirmationHint: "الطلبات المؤكَّدة ÷ الطلبات التي تلقيت ردًّا عليها.",
    deliveryRate: "نسبة التسليم",
    deliveryHint: "المُسلَّمة ÷ المؤكَّدة.",
    returnRate: "نسبة المرتجعات",
    returnHint: "المرتجعة ÷ (المُسلَّمة + المرتجعة).",
    newCustomers: "عملاء جدد",
    newCustomersHint: "العملاء الذين كان أول طلب لهم في هذه الفترة.",
    salesOverTime: "إجمالي المبيعات عبر الزمن",
    salesOverTimeDesc: "المبيعات اليومية بعملة {currency}، مقارنةً بالفترة السابقة.",
    ordersOverTime: "الطلبات عبر الزمن",
    ordersOverTimeDesc: "الطلبات اليومية، مقارنةً بالفترة السابقة.",
    ordersCount: "{n} طلب",
    breakdownTitle: "تفصيل المبيعات",
    breakdownDesc: "أين تقف المبالغ في هذه الفترة.",
    rowGross: "إجمالي المبيعات",
    rowGrossSub: "كل الطلبات المُنشأة، بعد استبعاد الملغاة والمرفوضة",
    rowDelivered: "المبيعات المُسلَّمة",
    rowDeliveredSub: "الطلبات التي وصلت إلى العميل",
    rowCollected: "المبالغ المحصَّلة",
    rowCollectedSub: "المدفوعات المسجَّلة",
    rowRefunded: "المبالغ المستردة",
    rowRefundedSub: "المبالغ التي أُعيدت إلى العملاء",
    rowDiscounts: "الخصومات",
    rowDiscountsSub: "على الطلبات المُسلَّمة",
    rowShipping: "رسوم الشحن المحصَّلة",
    rowShippingSub: "على الطلبات المُسلَّمة",
    journeyTitle: "مسار الطلب",
    journeyDesc: "إلى أين وصلت طلبات هذه الفترة.",
    stepPlaced: "مُنشأة",
    stepConfirmed: "مؤكَّدة",
    stepDelivered: "مُسلَّمة",
    stepReturned: "مرتجعة",
    ofPlaced: "{pct} من الطلبات المُنشأة",
    productsTitle: "المنتجات الأكثر مبيعًا",
    productsDesc: "حسب عدد الوحدات المبيعة في هذه الفترة.",
    colProduct: "المنتج",
    colUnits: "الوحدات",
    colSales: "المبيعات",
    noProducts: "لم يُبَع شيء في هذه الفترة",
    noProductsDesc: "عند وصول الطلبات، ستظهر هنا منتجاتك الأكثر مبيعًا.",
    unnamedProduct: "منتج بلا اسم",
    statusTitle: "الطلبات حسب الحالة",
    statusDesc: "طلبات هذه الفترة حسب حالتها الحالية.",
    statusPending: "بانتظار التأكيد",
    statusConfirmed: "مؤكَّدة",
    statusPostponed: "مؤجَّلة",
    statusUnreachable: "تعذَّر الوصول إلى العميل",
    statusRejected: "مرفوضة",
    statusCancelled: "ملغاة",
    statusDelivered: "مُسلَّمة",
    statusReturned: "مرتجعة",
    noActivity: "لا توجد طلبات في هذه الفترة",
    noActivityDesc: "ستمتلئ الرسوم البيانية بمجرد أن تبدأ الطلبات بالوصول.",
    sessions: "الجلسات",
    sessionsHint: "زيارات متجرك ومسارات البيع، يحسبها المتجر نفسه.",
    visitors: "الزوار",
    visitorsHint: "المتسوقون المختلفون، ويُحسب كل تبويب متصفح مرة واحدة.",
    conversionRate: "معدل التحويل",
    conversionRateHint: "الجلسات التي انتهت بطلب ÷ جميع الجلسات.",
    sessionsOverTime: "الجلسات عبر الزمن",
    sessionsOverTimeDesc: "الجلسات اليومية، مقارنةً بالفترة السابقة.",
    sessionsCount: "{n} جلسة",
    funnelTitle: "قمع التحويل",
    funnelDesc: "إلى أين وصلت جلسات هذه الفترة.",
    stepSessions: "الجلسات",
    stepAddToCart: "أضافوا إلى السلة",
    stepCheckout: "وصلوا إلى الدفع",
    stepOrders: "أتمّوا طلبًا",
    ofSessions: "{pct} من الجلسات",
    devicesTitle: "الجلسات حسب الجهاز",
    devicesDesc: "حسب جهاز كل جلسة.",
    deviceMobile: "الهاتف",
    deviceDesktop: "الكمبيوتر",
    deviceTablet: "الجهاز اللوحي",
    deviceUnknown: "غير معروف",
    sourcesTitle: "الجلسات حسب المصدر",
    sourcesDesc: "من وسوم UTM والمواقع المُحيلة التي وصلت منها الجلسات.",
    colSource: "المصدر",
    colSessions: "الجلسات",
    colOrders: "الطلبات",
    direct: "مباشر / بلا وسم",
    pagesTitle: "الصفحات الأكثر مشاهدة",
    pagesDesc: "الصفحات الأكثر مشاهدة في هذه الفترة.",
    colPage: "الصفحة",
    colViews: "المشاهدات",
    noTraffic: "لم تُسجَّل أي زيارات بعد",
    noTrafficDesc: "يرسل المتجر الزيارة لحظة فتحه — وستظهر هنا الجلسات والأجهزة والمصادر حينها.",
  },
} satisfies Messages;

/** Change vs the previous period: green up, red down, muted dash when no baseline. */
function Delta({ basisPoints, vsLabel }: { basisPoints: number | null; vsLabel: string }) {
  if (basisPoints === null) return <span className="text-xs text-ink-soft">—</span>;
  const up = basisPoints > 0;
  const down = basisPoints < 0;
  return (
    <span className="inline-flex items-center gap-1 text-xs" title={vsLabel}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          up && "text-success",
          down && "text-danger",
          !up && !down && "text-ink-soft"
        )}
      >
        {up && <ArrowUpRight className="size-3.5" aria-hidden />}
        {down && <ArrowDownRight className="size-3.5" aria-hidden />}
        <bdi dir="ltr">{formatPercentValue(Math.abs(basisPoints) / 10000)}</bdi>
      </span>
    </span>
  );
}

/** One metric tile: name with its definition on hover, value, delta, trend. */
function MetricTile({
  label,
  hint,
  value,
  delta,
  vsLabel,
  spark,
  sparkPrevious,
  to,
}: {
  label: string;
  hint: string;
  value: ReactNode;
  delta: number | null;
  vsLabel: string;
  spark?: number[];
  sparkPrevious?: number[] | null;
  to?: string;
}) {
  const body = (
    <Card className={cn("h-full gap-0 p-4", to && "transition-colors hover:ring-primary/40")}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        {/* The definition on hover (native title) and for screen readers. A
            native tooltip keeps the popup library out of the dashboard's
            shared bundle. */}
        <span title={hint} className="inline-flex cursor-help text-ink-soft/70 hover:text-ink">
          <Info className="size-3.5" aria-hidden />
          <span className="sr-only">{hint}</span>
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular-nums truncate text-xl font-semibold tracking-tight text-ink">{value}</p>
          <div className="mt-0.5">
            <Delta basisPoints={delta} vsLabel={vsLabel} />
          </div>
        </div>
        {spark && spark.length > 1 && (
          <div className="w-24 shrink-0" dir="ltr">
            <Sparkline current={spark} previous={sparkPrevious} />
          </div>
        )}
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

/** A titled card in the chart grid. */
function Panel({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 p-4", className)}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="mb-3 text-xs text-ink-soft">{description}</p>}
      {children}
    </Card>
  );
}

/** Legend under a comparison chart: solid = this period, dashed = the one before. */
function Legend({ current, previous }: { current: string; previous: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" />
        {current}
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-line-strong" />
        {previous}
      </span>
    </div>
  );
}

function seriesOf(summary: AnalyticsSummary | null, pick: (d: AnalyticsSummary["series"][number]) => number) {
  return summary ? summary.series.map(pick) : [];
}

export function AnalyticsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const summary = useAnalyticsSummary(workspaceId, range);

  const current = summary.data?.current ?? null;
  const previous = summary.data?.previous ?? null;
  const currency = current?.currency ?? "EGP";
  const money = (value: number) => <bdi dir="ltr">{formatMoney(value, currency)}</bdi>;
  const percent = (value: number | null) => <bdi dir="ltr">{formatPercentValue(percentToRatio(value))}</bdi>;
  const count = (value: number) => <bdi dir="ltr">{formatCount(value)}</bdi>;
  const rateDelta = (now: number | null, before: number | null | undefined) =>
    now === null || before === null || before === undefined ? null : deltaBasisPoints(now, before);

  const hasOrders = Boolean(current && current.orders.placed > 0);
  const traffic = current?.traffic ?? null;
  const previousTraffic = previous?.traffic ?? null;
  const hasTraffic = Boolean(traffic && traffic.sessions > 0);
  const deviceLabel: Record<string, string> = {
    mobile: t.deviceMobile,
    desktop: t.deviceDesktop,
    tablet: t.deviceTablet,
    unknown: t.deviceUnknown,
  };
  const currentWindow = current ? formatWindow(current.range.from, current.range.to) : "";
  const previousWindow = previous ? formatWindow(previous.range.from, previous.range.to) : "";

  const comparePoints = (pick: (d: AnalyticsSummary["series"][number]) => number) =>
    current
      ? current.series.map((day, i) => {
          const before = previous?.series[i];
          return {
            label: formatAxisDate(day.date),
            value: pick(day),
            previous: before ? pick(before) : null,
            previousLabel: before ? formatAxisDate(before.date) : undefined,
          };
        })
      : [];

  return (
    <div className="min-w-0 max-w-7xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<RangeSwitch value={range} onChange={setRange} />}
      />

      <DataState loading={summary.loading && !current} error={summary.error} onRetry={() => summary.refresh()}>
        {current && (
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              {previous
                ? fmt(t.comparedTo, { current: currentWindow, previous: previousWindow })
                : `${currentWindow} · ${t.noComparison}`}
            </p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {traffic && (
                <>
                  <MetricTile
                    label={t.sessions}
                    hint={t.sessionsHint}
                    value={count(traffic.sessions)}
                    delta={deltaBasisPoints(traffic.sessions, previousTraffic?.sessions)}
                    vsLabel={t.vsPrevious}
                    spark={seriesOf(current, (d) => d.sessions ?? 0)}
                    sparkPrevious={seriesOf(previous, (d) => d.sessions ?? 0)}
                  />
                  <MetricTile
                    label={t.conversionRate}
                    hint={t.conversionRateHint}
                    value={percent(traffic.conversionRate)}
                    delta={rateDelta(traffic.conversionRate, previousTraffic?.conversionRate)}
                    vsLabel={t.vsPrevious}
                  />
                </>
              )}
              <MetricTile
                label={t.grossSales}
                hint={t.grossSalesHint}
                value={money(current.revenue.gross)}
                delta={deltaBasisPoints(current.revenue.gross, previous?.revenue.gross)}
                vsLabel={t.vsPrevious}
                spark={seriesOf(current, (d) => d.revenue)}
                sparkPrevious={seriesOf(previous, (d) => d.revenue)}
              />
              <MetricTile
                label={t.orders}
                hint={t.ordersHint}
                value={count(current.orders.placed)}
                delta={deltaBasisPoints(current.orders.placed, previous?.orders.placed)}
                vsLabel={t.vsPrevious}
                spark={seriesOf(current, (d) => d.orders)}
                sparkPrevious={seriesOf(previous, (d) => d.orders)}
                to="/orders"
              />
              <MetricTile
                label={t.avgOrderValue}
                hint={t.avgOrderHint}
                value={money(current.revenue.averageOrderValue)}
                delta={deltaBasisPoints(current.revenue.averageOrderValue, previous?.revenue.averageOrderValue)}
                vsLabel={t.vsPrevious}
              />
              <MetricTile
                label={t.ordersDelivered}
                hint={t.ordersDeliveredHint}
                value={count(current.orders.delivered)}
                delta={deltaBasisPoints(current.orders.delivered, previous?.orders.delivered)}
                vsLabel={t.vsPrevious}
                spark={seriesOf(current, (d) => d.delivered)}
                sparkPrevious={seriesOf(previous, (d) => d.delivered)}
              />
              <MetricTile
                label={t.deliveredRevenue}
                hint={t.deliveredRevenueHint}
                value={money(current.revenue.delivered)}
                delta={deltaBasisPoints(current.revenue.delivered, previous?.revenue.delivered)}
                vsLabel={t.vsPrevious}
              />
              <MetricTile
                label={t.collected}
                hint={t.collectedHint}
                value={money(current.revenue.collected)}
                delta={deltaBasisPoints(current.revenue.collected, previous?.revenue.collected)}
                vsLabel={t.vsPrevious}
              />
              <MetricTile
                label={t.grossProfit}
                hint={t.grossProfitHint}
                value={money(current.profit.grossProfit)}
                delta={deltaBasisPoints(current.profit.grossProfit, previous?.profit.grossProfit)}
                vsLabel={t.vsPrevious}
              />
              <MetricTile
                label={t.confirmationRate}
                hint={t.confirmationHint}
                value={percent(current.rates.confirmation)}
                delta={rateDelta(current.rates.confirmation, previous?.rates.confirmation)}
                vsLabel={t.vsPrevious}
                to="/confirmation-queue"
              />
              <MetricTile
                label={t.deliveryRate}
                hint={t.deliveryHint}
                value={percent(current.rates.delivery)}
                delta={rateDelta(current.rates.delivery, previous?.rates.delivery)}
                vsLabel={t.vsPrevious}
              />
              <MetricTile
                label={t.returnRate}
                hint={t.returnHint}
                value={percent(current.rates.return)}
                delta={rateDelta(current.rates.return, previous?.rates.return)}
                vsLabel={t.vsPrevious}
                to="/returns"
              />
              <MetricTile
                label={t.newCustomers}
                hint={t.newCustomersHint}
                value={count(current.newCustomers)}
                delta={deltaBasisPoints(current.newCustomers, previous?.newCustomers)}
                vsLabel={t.vsPrevious}
                to="/customers"
              />
              {traffic && (
                <MetricTile
                  label={t.visitors}
                  hint={t.visitorsHint}
                  value={count(traffic.visitors)}
                  delta={deltaBasisPoints(traffic.visitors, previousTraffic?.visitors)}
                  vsLabel={t.vsPrevious}
                />
              )}
            </div>

            {traffic &&
              (hasTraffic ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title={t.sessionsOverTime} description={t.sessionsOverTimeDesc}>
                    <div dir="ltr">
                      <ComparisonLineChart
                        summary={t.sessionsOverTimeDesc}
                        points={comparePoints((d) => d.sessions ?? 0)}
                        format={(value) => fmt(t.sessionsCount, { n: formatCount(value) })}
                        formatAxis={(value) => formatCount(Math.round(value))}
                        currentLabel={t.thisPeriod}
                        previousLabel={t.previousPeriod}
                      />
                    </div>
                    <Legend current={currentWindow || t.thisPeriod} previous={previousWindow || t.previousPeriod} />
                  </Panel>

                  <Panel title={t.funnelTitle} description={t.funnelDesc}>
                    <ol className="space-y-3">
                      {[
                        { label: t.stepSessions, value: traffic.sessions },
                        { label: t.stepAddToCart, value: traffic.addToCart },
                        { label: t.stepCheckout, value: traffic.checkouts },
                        { label: t.stepOrders, value: traffic.purchases },
                      ].map((step, i) => {
                        const share = traffic.sessions > 0 ? step.value / traffic.sessions : 0;
                        return (
                          <li key={step.label}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="text-ink">{step.label}</span>
                              <span className="tabular-nums text-ink">
                                <bdi dir="ltr">{formatCount(step.value)}</bdi>
                                {i > 0 && (
                                  <span className="ms-2 text-xs text-ink-soft">
                                    {fmt(t.ofSessions, { pct: formatPercentValue(Math.min(share, 1), 1) })}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
                              <div
                                className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/70")}
                                style={{ width: `${Math.round(Math.min(share, 1) * 100)}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </Panel>

                  <Panel title={t.devicesTitle} description={t.devicesDesc}>
                    <HBarList
                      format={(value) => formatCount(value)}
                      rows={traffic.byDevice.map((d) => ({ label: deviceLabel[d.device] ?? d.device, value: d.sessions }))}
                    />
                  </Panel>

                  <Panel title={t.sourcesTitle} description={t.sourcesDesc}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.colSource}</TableHead>
                          <TableHead className="text-end">{t.colSessions}</TableHead>
                          <TableHead className="text-end">{t.colOrders}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {traffic.bySource.map((s, i) => (
                          <TableRow key={`${s.source}-${s.medium}-${i}`}>
                            <TableCell>
                              <span className="block text-ink" dir="ltr">
                                {s.source === "direct" ? t.direct : s.source}
                              </span>
                              {s.medium && (
                                <span className="block text-xs text-ink-soft" dir="ltr">
                                  {s.medium}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-end">{count(s.sessions)}</TableCell>
                            <TableCell className="tabular-nums text-end">{count(s.orders)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Panel>

                  <Panel title={t.pagesTitle} description={t.pagesDesc} className="lg:col-span-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.colPage}</TableHead>
                          <TableHead className="text-end">{t.colViews}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {traffic.topPages.map((p) => (
                          <TableRow key={p.path}>
                            <TableCell className="max-w-md truncate" dir="ltr">
                              {p.path}
                            </TableCell>
                            <TableCell className="tabular-nums text-end">{count(p.views)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Panel>
                </div>
              ) : (
                <EmptyState icon={<Users />} title={t.noTraffic} description={t.noTrafficDesc} />
              ))}

            {hasOrders ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={t.salesOverTime} description={fmt(t.salesOverTimeDesc, { currency })}>
                  <div dir="ltr">
                    <ComparisonLineChart
                      summary={fmt(t.salesOverTimeDesc, { currency })}
                      points={comparePoints((d) => d.revenue)}
                      format={(value) => formatMoney(value, currency)}
                      formatAxis={(value) => formatCount(Math.round(value / 100))}
                      currentLabel={t.thisPeriod}
                      previousLabel={t.previousPeriod}
                    />
                  </div>
                  <Legend current={currentWindow || t.thisPeriod} previous={previousWindow || t.previousPeriod} />
                </Panel>

                <Panel title={t.breakdownTitle} description={t.breakdownDesc}>
                  <dl className="divide-y divide-line text-sm">
                    {[
                      { label: t.rowGross, sub: t.rowGrossSub, value: current.revenue.gross, strong: true },
                      { label: t.rowDelivered, sub: t.rowDeliveredSub, value: current.revenue.delivered },
                      { label: t.rowCollected, sub: t.rowCollectedSub, value: current.revenue.collected },
                      { label: t.rowRefunded, sub: t.rowRefundedSub, value: current.revenue.refunded, negative: true },
                      { label: t.rowDiscounts, sub: t.rowDiscountsSub, value: current.revenue.discounts, negative: true },
                      { label: t.rowShipping, sub: t.rowShippingSub, value: current.revenue.shippingCharged },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                        <dt>
                          <span className={cn("block text-ink", row.strong && "font-semibold")}>{row.label}</span>
                          <span className="block text-xs text-ink-soft">{row.sub}</span>
                        </dt>
                        <dd className={cn("tabular-nums text-ink", row.strong && "font-semibold")}>
                          <bdi dir="ltr">
                            {row.negative && row.value > 0 ? "−" : ""}
                            {formatMoney(row.value, currency)}
                          </bdi>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Panel>

                <Panel title={t.ordersOverTime} description={t.ordersOverTimeDesc}>
                  <div dir="ltr">
                    <ComparisonLineChart
                      summary={t.ordersOverTimeDesc}
                      points={comparePoints((d) => d.orders)}
                      format={(value) => fmt(t.ordersCount, { n: formatCount(value) })}
                      formatAxis={(value) => formatCount(Math.round(value))}
                      currentLabel={t.thisPeriod}
                      previousLabel={t.previousPeriod}
                    />
                  </div>
                  <Legend current={currentWindow || t.thisPeriod} previous={previousWindow || t.previousPeriod} />
                </Panel>

                <Panel title={t.journeyTitle} description={t.journeyDesc}>
                  <ol className="space-y-3">
                    {[
                      { label: t.stepPlaced, value: current.orders.placed },
                      { label: t.stepConfirmed, value: current.orders.confirmed },
                      { label: t.stepDelivered, value: current.orders.delivered },
                      { label: t.stepReturned, value: current.orders.returned },
                    ].map((step, i) => {
                      const share = current.orders.placed > 0 ? step.value / current.orders.placed : 0;
                      return (
                        <li key={step.label}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-ink">{step.label}</span>
                            <span className="tabular-nums text-ink">
                              <bdi dir="ltr">{formatCount(step.value)}</bdi>
                              {i > 0 && (
                                <span className="ms-2 text-xs text-ink-soft">
                                  {fmt(t.ofPlaced, { pct: formatPercentValue(share, 0) })}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
                            <div
                              className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/70")}
                              style={{ width: `${Math.round(share * 100)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-3 text-xs text-ink-soft">
                    {t.confirmationRate} {percent(current.rates.confirmation)} · {t.deliveryRate}{" "}
                    {percent(current.rates.delivery)} · {t.returnRate} {percent(current.rates.return)}
                  </p>
                </Panel>

                <Panel title={t.productsTitle} description={t.productsDesc}>
                  {current.topProducts.length === 0 ? (
                    <EmptyState icon={<BarChart3 />} title={t.noProducts} description={t.noProductsDesc} />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.colProduct}</TableHead>
                          <TableHead className="text-end">{t.colUnits}</TableHead>
                          <TableHead className="text-end">{t.colSales}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {current.topProducts.map((product, i) => (
                          <TableRow key={product.productId ?? `${product.name}-${i}`}>
                            <TableCell className="max-w-56 truncate" dir="auto">
                              {product.name ?? t.unnamedProduct}
                            </TableCell>
                            <TableCell className="tabular-nums text-end">{count(product.quantity)}</TableCell>
                            <TableCell className="tabular-nums text-end">{money(product.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Panel>

                <Panel title={t.statusTitle} description={t.statusDesc}>
                  <HBarList
                    format={(value) => formatCount(value)}
                    rows={[
                      { label: t.statusPending, value: current.orders.pending },
                      { label: t.statusConfirmed, value: current.orders.confirmed },
                      { label: t.statusPostponed, value: current.orders.postponed },
                      { label: t.statusUnreachable, value: current.orders.unreachable },
                      { label: t.statusRejected, value: current.orders.rejected },
                      { label: t.statusCancelled, value: current.orders.cancelled },
                      { label: t.statusDelivered, value: current.orders.delivered },
                      { label: t.statusReturned, value: current.orders.returned },
                    ]}
                  />
                </Panel>
              </div>
            ) : (
              <EmptyState icon={<BarChart3 />} title={t.noActivity} description={t.noActivityDesc} />
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
