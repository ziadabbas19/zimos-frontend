import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Workflow } from "lucide-react";
import { Button, Card, Spinner, cn } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { fetchOrderStats } from "@/lib/orderStats";
import { isPermissionError } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { AnalyticsPair } from "@/lib/analytics";
import { fetchAnalyticsPair, takePrefetchedAnalyticsSummary } from "@/lib/analyticsPrefetch";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { StoreOverview } from "@/pages/home/StoreOverview";
import { SetupGuideCard } from "@/pages/home/SetupGuideCard";
import { SiteAnalytics } from "@/pages/home/SiteAnalytics";
import { QuickActions } from "@/pages/home/QuickActions";
import { LockedOrdersBanner } from "@/components/OrdersLock";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    welcome: "Welcome back",
    welcomeNamed: "Welcome back, {name}",
    subtitle: "The last 30 days, compared to the 30 before.",
    loadError: "Couldn't load your store stats right now.",
    empty: "No orders yet — once your first order comes in, your stats will show up here.",
    totalOrders: "Total orders",
    totalRevenue: "Total revenue",
    awaitingConfirmation: "Awaiting confirmation",
    awaitingHint: "Call them from the queue",
    unfulfilled: "Unfulfilled",
    basedOnRecent: "Based on the most recent {count} orders",
    grossSales: "Gross sales",
    orders: "Orders",
    collected: "Cash collected",
    vsPrevious: "vs previous 30 days",
    recentTitle: "Recent orders",
    viewAll: "View all",
    noOrders: "No orders yet — the first one shows up here the moment it comes in.",
    quickTitle: "Quick stats",
    confirmationRate: "Confirmation rate",
    deliveryRate: "Delivery rate",
    conversionRate: "Store conversion rate",
    noSessions: "Turns on with the first store visit",
    topProducts: "Top products",
    noProducts: "Nothing sold in the last 30 days.",
    units: "{n} sold",
    funnelsTitle: "Funnels",
    noFunnels: "No funnel sessions in the last 30 days.",
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
    subtitle: "آخر 30 يومًا، مقارنةً بالثلاثين يومًا التي قبلها.",
    loadError: "تعذّر تحميل إحصائيات متجرك الآن.",
    empty: "لا توجد طلبات بعد — ستظهر إحصائياتك هنا بمجرد وصول أول طلب.",
    totalOrders: "إجمالي الطلبات",
    totalRevenue: "إجمالي الإيرادات",
    awaitingConfirmation: "بانتظار التأكيد",
    awaitingHint: "اتصل بهم من قائمة التأكيد",
    unfulfilled: "غير مُنفّذة",
    basedOnRecent: "بناءً على أحدث {count} طلب",
    grossSales: "إجمالي المبيعات",
    orders: "الطلبات",
    collected: "المبالغ المحصَّلة",
    vsPrevious: "مقارنةً بالثلاثين يومًا السابقة",
    recentTitle: "أحدث الطلبات",
    viewAll: "عرض الكل",
    noOrders: "لا توجد طلبات بعد — سيظهر أول طلب هنا لحظة وصوله.",
    quickTitle: "أرقام سريعة",
    confirmationRate: "نسبة التأكيد",
    deliveryRate: "نسبة التسليم",
    conversionRate: "معدل تحويل المتجر",
    noSessions: "يبدأ مع أول زيارة للمتجر",
    topProducts: "المنتجات الأكثر مبيعًا",
    noProducts: "لم يُبَع شيء خلال آخر 30 يومًا.",
    units: "بيع منه {n}",
    funnelsTitle: "مسارات البيع",
    noFunnels: "لا توجد جلسات في مسارات البيع خلال آخر 30 يومًا.",
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

/**
 * The store at a glance. With analytics.view it shows the last 30 days against
 * the 30 before (from /analytics/summary), recent orders, quick rates, top
 * products and funnels. Without it — a role that can't read analytics, or a
 * custom role the server refuses — it falls back to the order roll-up this
 * page always showed. The confirmation queue count comes from the queue itself
 * in both cases.
 */
export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const common = useCommon();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);

  // Null: analytics are not available to this role, so the fallback shows.
  const summary = useAsync<AnalyticsPair | null>(
    () =>
      analyticsAllowed
        ? (takePrefetchedAnalyticsSummary(workspaceId, "30d") ?? fetchAnalyticsPair(workspaceId, "30d")).catch((err) => {
            if (isPermissionError(err)) return null;
            throw err;
          })
        : Promise.resolve(null),
    [workspaceId, analyticsAllowed]
  );
  const analytics = summary.data;
  const withAnalytics = Boolean(analytics);

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
    () => (summary.loading || withAnalytics ? Promise.resolve(null) : fetchOrderStats(workspaceId)),
    [workspaceId, summary.loading, withAnalytics]
  );

  const extra = useAsync(
    () =>
      withAnalytics
        ? apiClient
            .listOrders(workspaceId, { limit: 6 })
            .then((page) => ({ recent: page.orders as Order[] }))
            .catch(() => ({ recent: null }))
        : Promise.resolve(null),
    [workspaceId, withAnalytics]
  );

  const loading = summary.loading || (!withAnalytics && legacy.loading);
  const error = summary.error ?? (!withAnalytics ? legacy.error : null);

  return (
    <div className="min-w-0 max-w-6xl">
      <h1 className="font-display text-2xl font-medium text-ink">
        {currentWorkspace ? fmt(t.welcomeNamed, { name: currentWorkspace.name }) : t.welcome}
      </h1>
      <QuickActions awaiting={queue.data ?? null} />
      {/* Orders whose customer details are hidden until the store renews or tops up. */}
      <LockedOrdersBanner className="mt-6" />

      <div className="mt-8">
        {loading ? (
          <div className="flex min-h-[7rem] items-center justify-center text-ink-soft">
            <Spinner className="size-6" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft">{t.loadError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void summary.refresh();
                void queue.refresh();
                if (!withAnalytics) void legacy.refresh();
              }}
            >
              {common.retry}
            </Button>
          </div>
        ) : analytics ? (
          <AnalyticsOverview
            pair={analytics}
            recent={extra.data?.recent ?? null}
            extraLoading={extra.loading}
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

      {analyticsAllowed && (
        <div className="mt-8">
          <SiteAnalytics />
        </div>
      )}
    </div>
  );
}

function AnalyticsOverview({
  pair,
  recent,
  extraLoading,
}: {
  pair: AnalyticsPair;
  recent: Order[] | null;
  extraLoading: boolean;
}) {
  const t = useT(STRINGS);
  const { current } = pair;
  const currency = current.currency ?? "EGP";
  const money = (v: number | string) => <bdi dir="ltr">{formatMoney(v, currency)}</bdi>;

  return (
    <>
      <SetupGuideCard />
      <div className="mb-8">
        <StoreOverview />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <Panel
            title={t.recentTitle}
            action={
              <Link to="/orders" className="text-sm font-medium text-primary hover:underline">
                {t.viewAll}
              </Link>
            }
          >
            {recent === null ? (
              extraLoading ? (
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
                    <span className="tabular-nums text-sm font-medium text-ink">{money(order.totalAmount)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

      </div>
    </>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-0 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
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
