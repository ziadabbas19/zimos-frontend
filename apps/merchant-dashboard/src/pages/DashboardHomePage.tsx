import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardHeader, CardTitle, CardDescription, Spinner } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { fetchOrderStats } from "@/lib/orderStats";
import { formatMoney } from "@/lib/format";

export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();

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
        Welcome back{currentWorkspace ? `, ${currentWorkspace.name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        This is where store-wide metrics (orders, revenue, confirmation queue) will live.
      </p>

      <div className="mt-8">
        {overview.loading ? (
          <div className="flex min-h-[7rem] items-center justify-center text-ink-soft">
            <Spinner className="size-6" />
          </div>
        ) : overview.error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft">Couldn't load your store stats right now.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refresh()}>
              Retry
            </Button>
          </div>
        ) : overview.data && overview.data.stats.totalOrders === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
            No orders yet — once your first order comes in, your stats will show up here.
          </div>
        ) : overview.data ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total orders" value={overview.data.stats.totalOrders} />
              <StatCard
                label="Total revenue"
                value={formatMoney(
                  overview.data.stats.totalRevenue,
                  overview.data.stats.currency
                )}
              />
              <StatCard
                label="Awaiting confirmation"
                value={overview.data.awaitingConfirmation}
                to="/confirmation-queue"
              />
              <StatCard
                label="Unfulfilled"
                value={overview.data.stats.unfulfilledCount}
                to="/orders"
              />
            </div>
            {overview.data.stats.reachedCap && (
              <p className="mt-2 text-xs text-ink-soft">
                Based on the most recent {overview.data.stats.cap} orders
              </p>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Orders", desc: "Track and fulfill customer orders." },
          { title: "Catalog", desc: "Manage products, variants, and offers." },
          { title: "Customers", desc: "See who's buying and manage their details." },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
          </Card>
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
