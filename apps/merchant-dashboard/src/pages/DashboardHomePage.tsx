import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardHeader, CardTitle, CardDescription, Spinner } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { fetchOrderStats } from "@/lib/orderStats";
import { formatMoney } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    welcome: "Welcome back",
    welcomeNamed: "Welcome back, {name}",
    loadError: "Couldn't load your store stats right now.",
    empty: "No orders yet — once your first order comes in, your stats will show up here.",
    totalOrders: "Total orders",
    totalRevenue: "Total revenue",
    awaitingConfirmation: "Awaiting confirmation",
    unfulfilled: "Unfulfilled",
    basedOnRecent: "Based on the most recent {count} orders",
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
    loadError: "تعذّر تحميل إحصائيات متجرك الآن.",
    empty: "لا توجد طلبات بعد — ستظهر إحصائياتك هنا بمجرد وصول أول طلب.",
    totalOrders: "إجمالي الطلبات",
    totalRevenue: "إجمالي الإيرادات",
    awaitingConfirmation: "بانتظار التأكيد",
    unfulfilled: "غير مُنفّذة",
    basedOnRecent: "بناءً على أحدث {count} طلب",
    ordersTitle: "الطلبات",
    ordersDesc: "تابع طلبات العملاء ونفّذها.",
    catalogTitle: "الكتالوج",
    catalogDesc: "أدِر المنتجات والأنواع والعروض.",
    customersTitle: "العملاء",
    customersDesc: "اعرف من يشتري وأدِر بياناته.",
  },
} satisfies Messages;

export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const common = useCommon();

  const overview = useAsync(
    () =>
      Promise.all([
        fetchOrderStats(workspaceId),
        apiClient.listConfirmationQueue(workspaceId, { status: "queued", limit: 200 }),
      ]).then(([stats, queued]) => ({ stats, awaitingConfirmation: queued.length })),
    [workspaceId]
  );

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium text-ink">
        {currentWorkspace ? fmt(t.welcomeNamed, { name: currentWorkspace.name }) : t.welcome}
      </h1>

      <div className="mt-8">
        {overview.loading ? (
          <div className="flex min-h-[7rem] items-center justify-center text-ink-soft">
            <Spinner className="size-6" />
          </div>
        ) : overview.error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft">{t.loadError}</p>
            <Button size="sm" variant="outline" onClick={() => overview.refresh()}>
              {common.retry}
            </Button>
          </div>
        ) : overview.data && overview.data.stats.totalOrders === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
            {t.empty}
          </div>
        ) : overview.data ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label={t.totalOrders} value={overview.data.stats.totalOrders} />
              <StatCard
                label={t.totalRevenue}
                value={formatMoney(
                  overview.data.stats.totalRevenue,
                  overview.data.stats.currency
                )}
              />
              <StatCard
                label={t.awaitingConfirmation}
                value={overview.data.awaitingConfirmation}
                to="/confirmation-queue"
              />
              <StatCard
                label={t.unfulfilled}
                value={overview.data.stats.unfulfilledCount}
                to="/orders"
              />
            </div>
            {overview.data.stats.reachedCap && (
              <p className="mt-2 text-xs text-ink-soft">
                {fmt(t.basedOnRecent, { count: overview.data.stats.cap })}
              </p>
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

function StatCard({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
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
