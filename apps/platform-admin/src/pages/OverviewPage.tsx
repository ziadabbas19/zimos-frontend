import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Globe,
  Hourglass,
  Info,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn, ZLoader } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { BarChart, ChartAxis, LineAreaChart } from "@/components/charts";
import type { ChartPoint } from "@/components/charts";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { WorkspaceStatus } from "@/components/workspace";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { OverviewKpi, OverviewMoneyKpi, OverviewReport, OverviewSeries } from "@/lib/adminApi";
import {
  formatChartLabel,
  formatDateTime,
  formatMinorMoney,
  formatMinorMoneyCompact,
  formatNumber,
  formatRate,
  formatRelative,
} from "@/lib/format";

const STRINGS = {
  en: {
    title: "Overview",
    description: "Platform-wide state across every workspace.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    notAvailable: "Not available",
    unavailable: "Unavailable",
    derivedTitle: "Platform metrics aren’t available — showing what can be worked out from the workspace list.",
    derivedAnswered: "answered:",
    derivedCountedFrom: "Subscription counts, MRR and signups are counted here from",
    and: "and",
    derivedRest:
      "Anything needing order, shipment or invoice totals across workspaces is marked unavailable rather than shown as zero — no endpoint exposes those yet.",
    activeWorkspaces: "Active workspaces",
    activeWorkspacesHint: "Subscription active",
    trialing: "Trialing",
    trialingHint: "Currently in free trial",
    pastDue: "Past due",
    pastDueHint: "Failed renewal payment",
    mrr: "MRR",
    mrrHint: "Monthly run rate, paying plans only",
    gmv: "GMV processed",
    gmvHint: "Last 30 days, all stores",
    ordersToday: "Orders today",
    ordersTodayHint: "Across all stores, UTC day",
    deliveryRate: "Delivery rate",
    deliveryRateHint: "Delivered share of finished shipments, 30 days",
    signupsPerDay: "Signups per day",
    last30Total: "Last 30 days · {total} total",
    signupsValue: "{count} signups",
    mrrTrend: "MRR trend",
    last12Months: "Last 12 months",
    ordersPerDay: "Orders per day",
    ordersValue: "{count} orders",
    needsAttention: "Needs attention",
    itemOne: "{count} item",
    itemMany: "{count} items",
    attentionEmptyDerived: "No overdue payments. Return rates and domain checks need the metrics endpoint.",
    attentionEmpty: "Nothing needs attention right now.",
    recentSignups: "Recent signups",
    viewAll: "View all",
    noWorkspaces: "No workspaces yet.",
    colWorkspace: "Workspace",
    colAddress: "Address",
    colPlan: "Plan",
    colStatus: "Status",
    colCreated: "Created",
    figuresAsOf:
      "Figures as of {time}. Daily and monthly buckets are UTC calendar days, so the newest column closes at 00:00 UTC rather than local midnight.",
  },
  ar: {
    title: "نظرة عامة",
    description: "حالة المنصة عبر جميع المتاجر.",
    refresh: "تحديث",
    refreshing: "جارٍ التحديث…",
    notAvailable: "غير متاح",
    unavailable: "غير متاح",
    derivedTitle: "مقاييس المنصة غير متاحة — يُعرض ما يمكن استنتاجه من قائمة المتاجر.",
    derivedAnswered: "أجاب:",
    derivedCountedFrom: "تُحسب هنا أعداد الاشتراكات والإيراد الشهري المتكرر والتسجيلات من",
    and: "و",
    derivedRest:
      "كل ما يحتاج إلى إجماليات الطلبات أو الشحنات أو الفواتير عبر المتاجر يُعلَّم بأنه غير متاح بدلًا من عرضه صفرًا — لا توجد نقطة اتصال توفّرها بعد.",
    activeWorkspaces: "المتاجر النشطة",
    activeWorkspacesHint: "اشتراك نشط",
    trialing: "في الفترة التجريبية",
    trialingHint: "في الفترة التجريبية المجانية حاليًا",
    pastDue: "متأخرة السداد",
    pastDueHint: "فشل دفع التجديد",
    mrr: "الإيراد الشهري المتكرر",
    mrrHint: "المعدل الشهري، للخطط المدفوعة فقط",
    gmv: "إجمالي المبيعات المعالجة",
    gmvHint: "آخر 30 يومًا، جميع المتاجر",
    ordersToday: "طلبات اليوم",
    ordersTodayHint: "عبر جميع المتاجر، يوم بتوقيت UTC",
    deliveryRate: "نسبة التسليم",
    deliveryRateHint: "نسبة المُسلَّم من الشحنات المنتهية، 30 يومًا",
    signupsPerDay: "التسجيلات يوميًا",
    last30Total: "آخر 30 يومًا · الإجمالي {total}",
    signupsValue: "{count} تسجيل",
    mrrTrend: "اتجاه الإيراد الشهري المتكرر",
    last12Months: "آخر 12 شهرًا",
    ordersPerDay: "الطلبات يوميًا",
    ordersValue: "{count} طلب",
    needsAttention: "تحتاج إلى متابعة",
    itemOne: "عنصر واحد",
    itemMany: "عدد العناصر: {count}",
    attentionEmptyDerived: "لا توجد مدفوعات متأخرة. نسب المرتجعات وفحوص النطاقات تحتاج إلى نقطة اتصال المقاييس.",
    attentionEmpty: "لا شيء يحتاج إلى متابعة الآن.",
    recentSignups: "أحدث التسجيلات",
    viewAll: "عرض الكل",
    noWorkspaces: "لا توجد متاجر بعد.",
    colWorkspace: "المتجر",
    colAddress: "العنوان",
    colPlan: "الخطة",
    colStatus: "الحالة",
    colCreated: "تاريخ الإنشاء",
    figuresAsOf:
      "الأرقام حتى {time}. الفترات اليومية والشهرية أيام تقويمية بتوقيت UTC، لذا يُغلق أحدث عمود عند 00:00 UTC وليس عند منتصف الليل المحلي.",
  },
} satisfies Messages;

const ATTENTION_ICON: Record<string, typeof CreditCard> = {
  past_due: CreditCard,
  high_rto: ShieldAlert,
  carrier_error: Truck,
  unverified_domain: Globe,
};

/**
 * An unmeasured metric, rendered so it cannot be mistaken for a zero.
 *
 * Deliberately not a dash: at a glance a small grey "Not available" reads as
 * an absence, where "—" reads as "nothing happened" and a bare 0 reads as a
 * measurement. The three are different claims and the tile has to pick one.
 */
function Unavailable() {
  const t = useT(STRINGS);
  return <span className="text-base font-normal text-ink-soft">{t.notAvailable}</span>;
}

function kpiValue(kpi: OverviewKpi, format: (value: number) => string) {
  return kpi.value === null ? <Unavailable /> : format(kpi.value);
}

/**
 * A money tile. A zero total carries no currency — there is nothing to
 * denominate and zero is the same figure in every one — so it renders as a
 * plain number rather than asserting a currency that was never measured.
 */
function moneyValue(kpi: OverviewMoneyKpi) {
  if (kpi.value === null) return <Unavailable />;
  if (kpi.currency === null) return formatNumber(kpi.value);
  return formatMinorMoneyCompact(kpi.value, kpi.currency);
}

function moneyHint(kpi: OverviewMoneyKpi, whenKnown: string): string {
  if (kpi.unavailable) return kpi.unavailable;
  if (kpi.value === null || kpi.currency === null) return whenKnown;
  // The tile shows a compact figure; the hint carries the exact one.
  return `${formatMinorMoney(kpi.value, kpi.currency)} · ${whenKnown}`;
}

/**
 * Ends a server-supplied message with a full stop so it does not run into the
 * sentence after it. Server errors arrive punctuated inconsistently ("Route not
 * found" vs "Not found."), and the banner reads as one run-on either way.
 */
function sentence(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

/** ISO bucket keys are only formatted for display here, never in the data layer. */
function displayPoints(series: OverviewSeries): ChartPoint[] | null {
  if (series.points === null) return null;
  return series.points.map((p) => ({ label: formatChartLabel(p.label), value: p.value }));
}

function ChartPanel({
  title,
  series,
  total,
  children,
}: {
  title: string;
  series: OverviewSeries;
  /** Description shown when the series exists. */
  total: (points: ChartPoint[]) => string;
  children: (points: ChartPoint[]) => React.ReactNode;
}) {
  const t = useT(STRINGS);
  const points = displayPoints(series);
  if (points === null) {
    return (
      <Panel title={title} description={t.unavailable}>
        <p className="text-sm text-ink-soft">{series.unavailable}</p>
      </Panel>
    );
  }
  return (
    <Panel title={title} description={total(points)}>
      {children(points)}
      <ChartAxis points={points} />
    </Panel>
  );
}

export function OverviewPage() {
  const t = useT(STRINGS);
  const { data, loading, error, refresh } = useAsync(() => adminApi.loadOverview(), []);
  const [refreshing, setRefreshing] = useState(false);
  const busy = loading || refreshing;

  // A refresh keeps the current figures on screen instead of collapsing the
  // whole dashboard to the Z loader, but `useAsync` leaves `loading` false during
  // a silent refresh — so the button needs its own busy state or it looks
  // inert and invites a second click.
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={busy}>
            {busy ? <ZLoader size="sm" /> : <RefreshCw />} {busy ? t.refreshing : t.refresh}
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && <OverviewBody data={data} />}
      </DataState>
    </div>
  );
}

function OverviewBody({ data }: { data: OverviewReport }) {
  const t = useT(STRINGS);
  const { kpis } = data;
  const signups = displayPoints(data.signupsPerDay);
  const signupsTotal = signups?.reduce((sum, p) => sum + p.value, 0) ?? 0;

  return (
    <div className="space-y-6">
      {data.source === "derived" && (
        <Alert variant="info">
          <Info aria-hidden />
          <span className="font-medium">{t.derivedTitle}</span>
          <span className="text-ink-soft">
            <Mono>GET /admin/metrics/overview</Mono> {t.derivedAnswered}{" "}
            <span className="text-ink">{sentence(data.endpointError ?? "")}</span> {t.derivedCountedFrom}{" "}
            <Mono>GET /admin/workspaces</Mono> {t.and} <Mono>GET /admin/subscriptions</Mono>. {t.derivedRest}
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t.activeWorkspaces}
          value={kpiValue(kpis.activeWorkspaces, formatNumber)}
          icon={<Building2 />}
          to="/workspaces"
          hint={kpis.activeWorkspaces.unavailable ?? t.activeWorkspacesHint}
        />
        <KpiCard
          label={t.trialing}
          value={kpiValue(kpis.trialing, formatNumber)}
          icon={<Hourglass />}
          to="/subscriptions"
          hint={kpis.trialing.unavailable ?? t.trialingHint}
        />
        <KpiCard
          label={t.pastDue}
          value={kpiValue(kpis.pastDue, formatNumber)}
          icon={<TriangleAlert />}
          to="/subscriptions"
          hint={kpis.pastDue.unavailable ?? t.pastDueHint}
        />
        <KpiCard
          label={t.mrr}
          value={moneyValue(kpis.mrr)}
          icon={<CircleDollarSign />}
          hint={moneyHint(kpis.mrr, t.mrrHint)}
        />
        <KpiCard
          label={t.gmv}
          value={moneyValue(kpis.gmv30d)}
          icon={<Wallet />}
          hint={moneyHint(kpis.gmv30d, t.gmvHint)}
        />
        <KpiCard
          label={t.ordersToday}
          value={kpiValue(kpis.ordersToday, formatNumber)}
          icon={<ShoppingCart />}
          hint={kpis.ordersToday.unavailable ?? t.ordersTodayHint}
        />
        <KpiCard
          label={t.deliveryRate}
          value={kpiValue(kpis.deliveryRate, formatRate)}
          icon={<Truck />}
          hint={kpis.deliveryRate.unavailable ?? t.deliveryRateHint}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel
          title={t.signupsPerDay}
          series={data.signupsPerDay}
          total={() => fmt(t.last30Total, { total: formatNumber(signupsTotal) })}
        >
          {(points) => (
            <BarChart
              points={points}
              height={140}
              color="var(--color-primary)"
              format={(v) => fmt(t.signupsValue, { count: v })}
            />
          )}
        </ChartPanel>

        <ChartPanel title={t.mrrTrend} series={data.mrrTrend} total={() => t.last12Months}>
          {(points) => (
            <LineAreaChart
              points={points}
              height={140}
              format={(v) =>
                kpis.mrr.currency ? formatMinorMoney(v, kpis.mrr.currency) : formatNumber(v)
              }
            />
          )}
        </ChartPanel>

        <ChartPanel
          title={t.ordersPerDay}
          series={data.ordersPerDay}
          total={(points) => fmt(t.last30Total, { total: formatNumber(points.reduce((s, p) => s + p.value, 0)) })}
        >
          {(points) => (
            <BarChart
              points={points}
              height={140}
              color="var(--color-accent)"
              format={(v) => fmt(t.ordersValue, { count: formatNumber(v) })}
            />
          )}
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-2"
          title={t.needsAttention}
          description={fmt(data.attention.length === 1 ? t.itemOne : t.itemMany, { count: data.attention.length })}
          flush
        >
          {data.attention.length === 0 ? (
            <div className="p-4">
              <EmptyBlock
                message={
                  data.source === "derived" ? t.attentionEmptyDerived : t.attentionEmpty
                }
              />
            </div>
          ) : (
            <ul className="scroll-thin max-h-[26rem] divide-y divide-line overflow-y-auto">
              {data.attention.map((item) => {
                // A kind this build predates still gets a row and a neutral
                // icon — the queue must not hide what it cannot name.
                const Icon = ATTENTION_ICON[item.kind] ?? TriangleAlert;
                const body = (
                  <>
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        item.severity === "danger" && "bg-danger-soft text-danger",
                        item.severity === "warning" && "bg-accent-soft text-accent-dark",
                        item.severity === "info" && "bg-primary-soft text-primary-dark dark:text-primary"
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{item.detail}</span>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.to ? (
                      <Link
                        to={item.to}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary-soft/60"
                      >
                        {body}
                        <ChevronRight
                          className="mt-2 size-4 shrink-0 text-ink-soft rtl:rotate-180"
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      // No workspace to open — a link to nowhere would be worse
                      // than a plain row.
                      <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          className="xl:col-span-3"
          title={t.recentSignups}
          actions={
            <Link to="/workspaces" className="text-sm font-medium text-primary hover:underline">
              {t.viewAll}
            </Link>
          }
          flush
        >
          {data.recentSignups.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message={t.noWorkspaces} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.colWorkspace}</Th>
                  <Th>{t.colAddress}</Th>
                  <Th>{t.colPlan}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th className="text-end">{t.colCreated}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSignups.map((row) => (
                  <TableRow key={row.workspace.id}>
                    <Td>
                      <Link
                        to={`/workspaces/${row.workspace.id}`}
                        className="font-medium text-ink hover:text-primary"
                      >
                        {row.workspace.name}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{row.workspace.slug}</Td>
                    <Td>{row.workspace.plan}</Td>
                    <Td>
                      <WorkspaceStatus row={row} />
                    </Td>
                    <Td className="text-end text-ink-soft">
                      {formatRelative(row.workspace.createdAt)}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      <p className="text-xs text-ink-soft">{fmt(t.figuresAsOf, { time: formatDateTime(data.generatedAt) })}</p>
    </div>
  );
}
