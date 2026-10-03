import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ClipboardCheck,
  DollarSign,
  Package,
  Percent,
  ShoppingCart,
  Users,
  Workflow,
} from "lucide-react";
import { Button, Card, CardHeader, CardTitle, CardDescription, Spinner, cn } from "@store-builder/ui";
import { reportsGetOverview, type Order, type ReportMetric, type ReportOverview } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { fetchOrderStats } from "@/lib/orderStats";
import { isPermissionError } from "@/lib/errors";
import { formatDateTime, formatMoney, formatPercentValue } from "@/lib/format";
import {
  deltaBasisPoints,
  formatAxisDate,
  formatCount,
  formatWindow,
  percentToRatio,
  rangeWindows,
  type AnalyticsRange,
} from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { RangeSwitch } from "@/components/RangeSwitch";
import { ComparisonLineChart } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    welcome: "Welcome back",
    welcomeNamed: "Welcome back, {name}",
    comparedWith: "{current}, compared with {previous}.",
    updatedAt: "Updated {time}",
    updating: "Updating…",
    loadError: "Couldn't load your store's numbers right now.",
    empty: "No orders yet — once your first order comes in, your stats will show up here.",
    emptyPeriodTitle: "Nothing in this period yet",
    emptyPeriodBody: "No orders and no store visits in this period, or in the one before it. Your numbers show up here as soon as they come in.",
    totalOrders: "Total orders",
    totalRevenue: "Total revenue",
    awaitingConfirmation: "Awaiting confirmation",
    awaitingHint: "Call them from the queue",
    unfulfilled: "Unfulfilled",
    basedOnRecent: "Based on the most recent {count} orders",
    sales: "Sales",
    orders: "Orders",
    averageOrderValue: "Average order value",
    conversionRate: "Conversion rate",
    noSessions: "Starts with the first store visit",
    vsPrevious: "vs previous period",
    moreTitle: "More numbers",
    moreDesc: "The same period, and the one before it.",
    collected: "Cash collected",
    cancelledOrders: "Cancelled orders",
    confirmationRate: "Confirmation rate",
    deliveryRate: "Delivery rate",
    sessions: "Store visits",
    newCustomers: "New customers",
    returningCustomers: "Returning customers",
    before: "Before:",
    salesChart: "Sales per day",
    salesChartDesc: "Sales of orders not cancelled, this period against the one before it.",
    thisPeriod: "This period",
    previousPeriod: "Previous period",
    bySource: "Sales by source",
    recentTitle: "Recent orders",
    viewAll: "View all",
    noOrders: "No orders yet — the first one shows up here the moment it comes in.",
    topProducts: "Top products",
    noProducts: "Nothing sold in this period.",
    units: "{n} sold",
    funnelsTitle: "Funnels",
    noFunnels: "No funnel sessions in this period.",
    funnelSessions: "{n} sessions",
    channelStore: "Store",
    channelFunnel: "Funnel",
    ordersTitle: "Orders",
    ordersDesc: "Track and fulfill customer orders.",
    catalogTitle: "Catalog",
    catalogDesc: "Manage products, variants, and offers.",
    customersTitle: "Customers",
    customersDesc: "See who's buying and manage their details.",
  },
  ar: {
    welcome: "مرحبًا بعودتك",
    welcomeNamed: "مرحبًا بعودتك، {name}",
    comparedWith: "{current}، مقارنةً بـ {previous}.",
    updatedAt: "آخر تحديث {time}",
    updating: "جارٍ التحديث…",
    loadError: "تعذّر تحميل أرقام متجرك الآن.",
    empty: "لا توجد طلبات بعد — ستظهر إحصائياتك هنا بمجرد وصول أول طلب.",
    emptyPeriodTitle: "لا شيء في هذه الفترة بعد",
    emptyPeriodBody: "لا توجد طلبات ولا زيارات للمتجر في هذه الفترة ولا في الفترة التي قبلها. ستظهر أرقامك هنا فور وصولها.",
    totalOrders: "إجمالي الطلبات",
    totalRevenue: "إجمالي الإيرادات",
    awaitingConfirmation: "بانتظار التأكيد",
    awaitingHint: "اتصل بهم من قائمة التأكيد",
    unfulfilled: "غير مُنفّذة",
    basedOnRecent: "بناءً على أحدث {count} طلب",
    sales: "المبيعات",
    orders: "الطلبات",
    averageOrderValue: "متوسط قيمة الطلب",
    conversionRate: "معدل التحويل",
    noSessions: "يبدأ مع أول زيارة للمتجر",
    vsPrevious: "مقارنةً بالفترة السابقة",
    moreTitle: "أرقام أخرى",
    moreDesc: "الفترة نفسها، والفترة التي قبلها.",
    collected: "المبالغ المحصَّلة",
    cancelledOrders: "الطلبات الملغاة",
    confirmationRate: "نسبة التأكيد",
    deliveryRate: "نسبة التسليم",
    sessions: "زيارات المتجر",
    newCustomers: "عملاء جدد",
    returningCustomers: "عملاء عائدون",
    before: "قبلها:",
    salesChart: "المبيعات اليومية",
    salesChartDesc: "مبيعات الطلبات غير الملغاة في هذه الفترة مقارنةً بالفترة التي قبلها.",
    thisPeriod: "هذه الفترة",
    previousPeriod: "الفترة السابقة",
    bySource: "المبيعات حسب المصدر",
    recentTitle: "أحدث الطلبات",
    viewAll: "عرض الكل",
    noOrders: "لا توجد طلبات بعد — سيظهر أول طلب هنا لحظة وصوله.",
    topProducts: "المنتجات الأكثر مبيعًا",
    noProducts: "لم يُبَع شيء في هذه الفترة.",
    units: "بيع منه {n}",
    funnelsTitle: "مسارات البيع",
    noFunnels: "لا توجد جلسات في مسارات البيع في هذه الفترة.",
    funnelSessions: "{n} جلسة",
    channelStore: "المتجر",
    channelFunnel: "مسار بيع",
    ordersTitle: "الطلبات",
    ordersDesc: "تابع طلبات العملاء ونفّذها.",
    catalogTitle: "الكتالوج",
    catalogDesc: "أدِر المنتجات والأنواع والعروض.",
    customersTitle: "العملاء",
    customersDesc: "اعرف من يشتري وأدِر بياناته.",
  },
} satisfies Messages;

// Icon chips, from the dashboard's own tokens.
const TONES = {
  primary: "bg-primary-soft text-primary-dark dark:text-primary",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent-dark dark:text-accent",
  neutral: "bg-paper text-ink",
} as const;

/** True when neither window holds a single order or visit. */
function isEmptyOverview(overview: ReportOverview): boolean {
  const { orders, sessions } = overview.metrics;
  return !orders.value && !orders.previous && !sessions.value && !sessions.previous;
}

/**
 * The store at a glance, for a window against the one just before it — one
 * request (GET /analytics/overview) answers every number. With analytics.view
 * it shows the range switch, the main numbers with their change, the daily
 * sales against the period before, and the lists. Without it — a role that
 * can't read analytics, or a custom role the server refuses — it falls back
 * to the order roll-up this page always showed. The confirmation queue count
 * comes from the queue itself in both cases.
 */
export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const common = useCommon();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);
  const [range, setRange] = useState<AnalyticsRange>("30d");

  // Null: analytics are not available to this role, so the fallback shows.
  const overview = useAsync<ReportOverview | null>(
    () =>
      analyticsAllowed
        ? reportsGetOverview(apiClient, workspaceId, rangeWindows(range).current).catch((err) => {
            if (isPermissionError(err)) return null;
            throw err;
          })
        : Promise.resolve(null),
    [workspaceId, analyticsAllowed, range]
  );
  const data = overview.data;
  const withAnalytics = Boolean(data);
  // The first answer decides between the two layouts; a later range switch
  // keeps the numbers on screen while the next ones load.
  const firstLoad = overview.loading && !data;

  // Awaiting = not finished yet: waiting for a call, or someone on it.
  const queue = useAsync(
    () =>
      apiClient
        .getConfirmationQueueCounts(workspaceId)
        .then((counts) => counts.pending + counts.inProgress)
        .catch(() => null),
    [workspaceId]
  );

  // Only once analytics are known to be unavailable: this walks the order list.
  const legacy = useAsync(
    () => (firstLoad || withAnalytics ? Promise.resolve(null) : fetchOrderStats(workspaceId)),
    [workspaceId, firstLoad, withAnalytics]
  );

  const recent = useAsync(
    () =>
      withAnalytics
        ? apiClient
            .listOrders(workspaceId, { limit: 6 })
            .then((page) => page.orders as Order[])
            .catch(() => null)
        : Promise.resolve(null),
    [workspaceId, withAnalytics]
  );

  const funnels = useAsync(
    () =>
      withAnalytics ? apiClient.getFunnelAnalytics(workspaceId, rangeWindows(range).current).catch(() => null) : Promise.resolve(null),
    [workspaceId, withAnalytics, range]
  );

  const loading = firstLoad || (!withAnalytics && !overview.error && legacy.loading);
  const error = data ? null : (overview.error ?? (!withAnalytics ? legacy.error : null));

  return (
    <div className="min-w-0 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium text-ink">
            {currentWorkspace ? fmt(t.welcomeNamed, { name: currentWorkspace.name }) : t.welcome}
          </h1>
          {data && data.previousRange && (
            <p className="mt-1 text-sm text-ink-soft">
              {fmt(t.comparedWith, {
                current: formatWindow(data.range.from, data.range.to),
                previous: formatWindow(data.previousRange.from, data.previousRange.to),
              })}
            </p>
          )}
        </div>
        {withAnalytics && <RangeSwitch value={range} onChange={setRange} />}
      </div>

      <div className="mt-8">
        {loading ? (
          <div role="status" className="flex min-h-[7rem] items-center justify-center text-ink-soft">
            <Spinner className="size-6" />
            <span className="sr-only">{common.loading}</span>
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="text-sm text-ink-soft">{t.loadError}</p>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void overview.refresh();
                void queue.refresh();
                if (!withAnalytics) void legacy.refresh();
              }}
            >
              {common.retry}
            </Button>
          </div>
        ) : data ? (
          <Overview
            overview={data}
            refreshing={overview.loading}
            awaiting={queue.data ?? null}
            recent={recent.data ?? null}
            recentLoading={recent.loading}
            funnels={funnels.data ?? null}
          />
        ) : legacy.data && legacy.data.totalOrders === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
            {t.empty}
          </div>
        ) : legacy.data ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LegacyStatCard label={t.totalOrders} value={legacy.data.totalOrders} />
              <LegacyStatCard label={t.totalRevenue} value={formatMoney(legacy.data.totalRevenue, legacy.data.currency)} />
              <LegacyStatCard label={t.awaitingConfirmation} value={queue.data ?? "—"} to="/confirmation-queue" />
              <LegacyStatCard label={t.unfulfilled} value={legacy.data.unfulfilledCount} to="/orders" />
            </div>
            {legacy.data.reachedCap && (
              <p className="mt-2 text-xs text-ink-soft">{fmt(t.basedOnRecent, { count: legacy.data.cap })}</p>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: t.ordersTitle, desc: t.ordersDesc, to: "/orders" },
          { title: t.catalogTitle, desc: t.catalogDesc, to: "/catalog" },
          { title: t.customersTitle, desc: t.customersDesc, to: "/customers" },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="block">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Overview({
  overview,
  refreshing,
  awaiting,
  recent,
  recentLoading,
  funnels,
}: {
  overview: ReportOverview;
  refreshing: boolean;
  awaiting: number | null;
  recent: Order[] | null;
  recentLoading: boolean;
  funnels: Awaited<ReturnType<typeof apiClient.getFunnelAnalytics>> | null;
}) {
  const t = useT(STRINGS);
  const { metrics, currency } = overview;
  const money = (v: number | null) => <bdi dir="ltr">{formatMoney(v ?? 0, currency)}</bdi>;
  const moneyText = (v: number | null) => formatMoney(v ?? 0, currency);
  const percentText = (v: number | null) => formatPercentValue(percentToRatio(v));
  const delta = (m: ReportMetric) => deltaBasisPoints(m.value, m.previous);
  const hasSessions = (metrics.sessions.value ?? 0) > 0;
  const updated = new Date(overview.generatedAt);

  if (isEmptyOverview(overview)) {
    return (
      <EmptyState icon={<BarChart3 />} title={t.emptyPeriodTitle} description={t.emptyPeriodBody} />
    );
  }

  const points = overview.series.map((day, i) => {
    const before = overview.previousSeries?.[i];
    return {
      label: formatAxisDate(day.date),
      value: day.sales,
      previous: before ? before.sales : null,
      previousLabel: before ? formatAxisDate(before.date) : undefined,
    };
  });

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign />}
          tone="primary"
          label={t.sales}
          value={money(metrics.sales.value)}
          delta={delta(metrics.sales)}
          vsLabel={t.vsPrevious}
          to="/analytics"
        />
        <StatCard
          icon={<ShoppingCart />}
          tone="neutral"
          label={t.orders}
          value={<bdi dir="ltr">{formatCount(metrics.orders.value)}</bdi>}
          delta={delta(metrics.orders)}
          vsLabel={t.vsPrevious}
          to="/orders"
        />
        <StatCard
          icon={<Package />}
          tone="success"
          label={t.averageOrderValue}
          value={money(metrics.averageOrderValue.value)}
          delta={delta(metrics.averageOrderValue)}
          vsLabel={t.vsPrevious}
        />
        <StatCard
          icon={<Percent />}
          tone="accent"
          label={t.conversionRate}
          value={<bdi dir="ltr">{hasSessions ? percentText(metrics.conversionRate.value) : "—"}</bdi>}
          delta={hasSessions ? delta(metrics.conversionRate) : null}
          vsLabel={t.vsPrevious}
          hint={hasSessions ? undefined : t.noSessions}
          to="/analytics/utm"
        />
      </div>

      <p className="mb-6 text-xs text-ink-soft" aria-live="polite">
        {refreshing ? t.updating : fmt(t.updatedAt, { time: formatDateTime(updated.toISOString()) })}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel
            title={t.salesChart}
            description={t.salesChartDesc}
            action={
              <Link to="/analytics/utm" className="text-sm font-medium text-primary hover:underline">
                {t.bySource}
              </Link>
            }
          >
            <div dir="ltr">
              <ComparisonLineChart
                summary={t.salesChartDesc}
                points={points}
                format={moneyText}
                formatAxis={(v) => formatCount(Math.round(v / 100))}
                currentLabel={t.thisPeriod}
                previousLabel={t.previousPeriod}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" />
                {t.thisPeriod}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-line-strong" />
                {t.previousPeriod}
              </span>
            </div>
          </Panel>

          <Panel title={t.moreTitle} description={t.moreDesc}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <MoreNumber label={t.collected} value={moneyText(metrics.collected.value)} before={metrics.collected.previous === null ? null : moneyText(metrics.collected.previous)} />
              <MoreNumber label={t.cancelledOrders} value={formatCount(metrics.cancelledOrders.value)} before={metrics.cancelledOrders.previous === null ? null : formatCount(metrics.cancelledOrders.previous)} />
              <MoreNumber label={t.confirmationRate} value={percentText(metrics.confirmationRate.value)} before={metrics.confirmationRate.previous === null ? null : percentText(metrics.confirmationRate.previous)} />
              <MoreNumber label={t.deliveryRate} value={percentText(metrics.deliveryRate.value)} before={metrics.deliveryRate.previous === null ? null : percentText(metrics.deliveryRate.previous)} />
              <MoreNumber label={t.sessions} value={formatCount(metrics.sessions.value)} before={metrics.sessions.previous === null ? null : formatCount(metrics.sessions.previous)} />
              <MoreNumber label={t.newCustomers} value={formatCount(metrics.newCustomers.value)} before={metrics.newCustomers.previous === null ? null : formatCount(metrics.newCustomers.previous)} />
              <MoreNumber label={t.returningCustomers} value={formatCount(metrics.returningCustomers.value)} before={metrics.returningCustomers.previous === null ? null : formatCount(metrics.returningCustomers.previous)} />
            </dl>
          </Panel>

          <Panel
            title={t.recentTitle}
            action={
              <Link to="/orders" className="text-sm font-medium text-primary hover:underline">
                {t.viewAll}
              </Link>
            }
          >
            {recent === null ? (
              recentLoading ? (
                <div className="flex h-24 items-center justify-center text-ink-soft">
                  <Spinner className="size-5" />
                </div>
              ) : (
                <p className="text-sm text-ink-soft">—</p>
              )
            ) : recent.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noOrders}</p>
            ) : (
              <div className="space-y-1">
                {recent.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-paper"
                  >
                    <div className={cn("rounded-lg p-2 [&>svg]:size-4", order.funnelId ? TONES.accent : TONES.primary)}>
                      {order.funnelId ? <Workflow aria-hidden /> : <ShoppingCart aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        <bdi dir="ltr">{order.orderNumber}</bdi>
                        <span className="ms-2 font-normal text-ink-soft" dir="auto">
                          {order.contactSnapshot?.fullName || "—"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        {order.funnelId ? t.channelFunnel : t.channelStore} · {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <StatusBadge value={order.confirmationState} />
                    <span className="tabular-nums text-sm font-medium text-ink">
                      <bdi dir="ltr">{formatMoney(order.totalAmount, currency)}</bdi>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <StatCard
            icon={<ClipboardCheck />}
            tone="accent"
            label={t.awaitingConfirmation}
            value={<bdi dir="ltr">{awaiting === null ? "—" : formatCount(awaiting)}</bdi>}
            hint={t.awaitingHint}
            to="/confirmation-queue"
          />

          <Panel title={t.topProducts}>
            {overview.topProducts.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noProducts}</p>
            ) : (
              <div className="space-y-3">
                {overview.topProducts.map((p, i) => (
                  <div key={p.productId ?? `${p.name}-${i}`} className="flex items-center justify-between gap-3 py-1">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
                      <Package className="size-4 shrink-0" aria-hidden />
                      <span className="truncate" dir="auto">
                        {p.name || "—"}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block tabular-nums text-sm font-medium text-ink">{money(p.sales)}</span>
                      <span className="block text-xs text-ink-soft">{fmt(t.units, { n: formatCount(p.quantity) })}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {funnels && (
            <Panel
              title={t.funnelsTitle}
              action={
                <Link to="/funnels" className="text-sm font-medium text-primary hover:underline">
                  {t.viewAll}
                </Link>
              }
            >
              {funnels.totals.sessions === 0 ? (
                <p className="text-sm text-ink-soft">{t.noFunnels}</p>
              ) : (
                <div className="space-y-3">
                  {funnels.funnels
                    .filter((f) => f.sessions > 0)
                    .slice(0, 4)
                    .map((f) => (
                      <Link
                        key={f.id}
                        to={`/analytics/funnels/${f.id}`}
                        className="flex items-center justify-between gap-3 py-1 hover:text-primary"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
                          <Users className="size-4 shrink-0" aria-hidden />
                          <span className="truncate" dir="auto">
                            {f.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block tabular-nums text-sm font-medium text-ink">{money(Number(f.revenue))}</span>
                          <span className="block text-xs text-ink-soft">
                            {fmt(t.funnelSessions, { n: formatCount(f.sessions) })} ·{" "}
                            <bdi dir="ltr">{formatPercentValue(percentToRatio(f.conversionRate))}</bdi>
                          </span>
                        </span>
                      </Link>
                    ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function MoreNumber({ label, value, before }: { label: string; value: string; before: string | null }) {
  const t = useT(STRINGS);
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular-nums text-base font-semibold text-ink">
          <bdi dir="ltr">{value}</bdi>
        </span>
        {before !== null && (
          <span className="text-xs text-ink-soft">
            {t.before} <bdi dir="ltr">{before}</bdi>
          </span>
        )}
      </dd>
    </div>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  delta,
  vsLabel,
  hint,
  to,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: ReactNode;
  delta?: number | null;
  vsLabel?: string;
  hint?: string;
  to?: string;
}) {
  const up = delta !== null && delta !== undefined && delta > 0;
  const down = delta !== null && delta !== undefined && delta < 0;
  const body = (
    <Card className={cn("h-full gap-0 p-5", to && "transition-colors hover:border-primary/40")}>
      <div className="mb-3 flex items-center justify-between">
        <div className={cn("rounded-lg p-2 [&>svg]:size-5", TONES[tone])} aria-hidden>
          {icon}
        </div>
        {up && <ArrowUpRight className="size-4 text-success" aria-hidden />}
        {down && <ArrowDownRight className="size-4 text-danger" aria-hidden />}
      </div>
      <p className="mb-1 text-xs font-medium tracking-wide text-ink-soft uppercase rtl:tracking-normal">{label}</p>
      <p className="tabular-nums font-display text-2xl font-medium text-ink">{value}</p>
      {delta !== undefined && delta !== null ? (
        <p className={cn("mt-1 text-sm", up ? "text-success" : down ? "text-danger" : "text-ink-soft")}>
          <bdi dir="ltr">{(up ? "+" : down ? "−" : "") + formatPercentValue(Math.abs(delta) / 10000)}</bdi> {vsLabel}
        </p>
      ) : hint ? (
        <p className="mt-1 text-sm text-ink-soft">{hint}</p>
      ) : null}
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function LegacyStatCard({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
  const card = (
    <Card className={to ? "h-full p-4 transition-colors hover:border-primary/40" : "h-full p-4"}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-ink">{value}</p>
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
