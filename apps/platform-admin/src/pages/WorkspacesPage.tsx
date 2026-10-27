import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, NativeSelect, SearchInput } from "@/components/forms";
import { Panel, SortHead, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { WorkspaceStatus } from "@/components/workspace";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import { formatDate, formatMinorMoney, formatNumber } from "@/lib/format";

const STRINGS = {
  en: {
    title: "Workspaces",
    description: "Every store created on the platform.",
    refresh: "Refresh",
    all: "All",
    active: "Active",
    trialing: "Trialing",
    pastDue: "Past due",
    canceled: "Canceled",
    draft: "Draft — not subscribed",
    none: "No subscription",
    searchPlaceholder: "Store, address, ID or owner",
    filterByPlan: "Filter by plan",
    allPlans: "All plans",
    countOf: "{shown} of {total}",
    emptyAll: "No workspaces have been created yet.",
    emptyFiltered: "No workspaces match these filters.",
    colWorkspace: "Workspace",
    colOwner: "Owner",
    colPlan: "Plan",
    colStatus: "Status",
    colMrr: "MRR",
    colOrders: "Orders",
    colCurrency: "Currency",
    colCreated: "Created",
    footnoteStart: "Orders is a lifetime count. GMV, a 30-day window and location need workspace metrics on",
    footnoteEnd: ", which doesn't return them yet. To find a person across all their stores, use Users.",
  },
  ar: {
    title: "المتاجر",
    description: "جميع المتاجر التي أُنشئت على المنصة.",
    refresh: "تحديث",
    all: "الكل",
    active: "نشط",
    trialing: "تجريبي",
    pastDue: "متأخر السداد",
    canceled: "ملغى",
    draft: "مسودة — بلا اشتراك",
    none: "بلا اشتراك",
    searchPlaceholder: "المتجر أو العنوان أو المعرّف أو المالك",
    filterByPlan: "التصفية حسب الخطة",
    allPlans: "جميع الخطط",
    countOf: "{shown} من {total}",
    emptyAll: "لم يُنشأ أي متجر بعد.",
    emptyFiltered: "لا توجد متاجر تطابق عوامل التصفية هذه.",
    colWorkspace: "المتجر",
    colOwner: "المالك",
    colPlan: "الخطة",
    colStatus: "الحالة",
    colMrr: "الإيراد الشهري",
    colOrders: "الطلبات",
    colCurrency: "العملة",
    colCreated: "تاريخ الإنشاء",
    footnoteStart: "عدد الطلبات إجمالي منذ البداية. إجمالي المبيعات ونافذة الثلاثين يومًا والموقع تحتاج إلى مقاييس المتاجر في",
    footnoteEnd: "، التي لا تُرجعها بعد. للعثور على شخص عبر جميع متاجره، استخدم صفحة المستخدمين.",
  },
} satisfies Messages;

type SortKey = "name" | "createdAt" | "mrr" | "orders";
type StatusFilter = "all" | "none" | "draft" | "trialing" | "active" | "past_due" | "canceled";

function matchesStatus(row: AdminWorkspaceRow, f: StatusFilter) {
  if (f === "all") return true;
  if (f === "draft") return Boolean(row.workspace.draft);
  if (f === "none") return !row.subscription;
  return !row.workspace.draft && row.subscription?.status === f;
}

export function WorkspacesPage() {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listWorkspaceRows(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [planId, setPlanId] = useState("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "createdAt", dir: "desc" });

  const rows = useMemo(() => data ?? [], [data]);

  const planOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(({ subscription }) => {
      if (subscription?.planId) map.set(subscription.planId, subscription.planName ?? subscription.planId);
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => matchesStatus(r, status))
      .filter((r) => planId === "all" || r.subscription?.planId === planId)
      .filter(
        ({ workspace }) =>
          !q ||
          workspace.name.toLowerCase().includes(q) ||
          workspace.slug.toLowerCase().includes(q) ||
          workspace.id.startsWith(q) ||
          Boolean(
            workspace.owner &&
              (workspace.owner.fullName.toLowerCase().includes(q) ||
                workspace.owner.email.toLowerCase().includes(q) ||
                (workspace.owner.username ?? "").includes(q))
          )
      )
      .sort((a, b) => {
        switch (sort.key) {
          case "name":
            return compareValues(a.workspace.name, b.workspace.name, sort.dir);
          case "mrr":
            return compareValues(a.subscription?.mrr ?? 0, b.subscription?.mrr ?? 0, sort.dir);
          case "orders":
            return compareValues(a.workspace.orderCount, b.workspace.orderCount, sort.dir);
          default:
            return compareValues(a.workspace.createdAt, b.workspace.createdAt, sort.dir);
        }
      });
  }, [rows, query, status, planId, sort]);

  const statusOptions: Array<{ value: StatusFilter; label: string; count: number }> = (
    [
      ["all", t.all],
      ["active", t.active],
      ["trialing", t.trialing],
      ["past_due", t.pastDue],
      ["canceled", t.canceled],
      ["draft", t.draft],
      ["none", t.none],
    ] as Array<[StatusFilter, string]>
  ).map(([value, label]) => ({
    value,
    label,
    count: rows.filter((r) => matchesStatus(r, value)).length,
  }));

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {t.refresh}
          </Button>
        }
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3">
          <FilterChips options={statusOptions} value={status} onChange={setStatus} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder={t.searchPlaceholder} />
            <NativeSelect
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="sm:w-44"
              aria-label={t.filterByPlan}
            >
              <option value="all">{t.allPlans}</option>
              {planOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <span className="text-sm text-ink-soft sm:ms-auto">
              {fmt(t.countOf, { shown: filtered.length, total: rows.length })}
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyBlock message={t.emptyAll} />
        ) : filtered.length === 0 ? (
          <EmptyBlock message={t.emptyFiltered} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label={t.colWorkspace} sortKey="name" sort={sort} onSort={setSort} />
                  <Th>{t.colOwner}</Th>
                  <Th>{t.colPlan}</Th>
                  <Th>{t.colStatus}</Th>
                  <SortHead label={t.colMrr} sortKey="mrr" sort={sort} onSort={setSort} className="text-end" />
                  <SortHead label={t.colOrders} sortKey="orders" sort={sort} onSort={setSort} className="text-end" />
                  <Th>{t.colCurrency}</Th>
                  <SortHead label={t.colCreated} sortKey="createdAt" sort={sort} onSort={setSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const { workspace, subscription } = row;
                  return (
                    <TableRow
                      key={workspace.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/workspaces/${workspace.id}`)}
                    >
                      <Td>
                        <Link
                          to={`/workspaces/${workspace.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block font-medium text-ink hover:text-primary"
                        >
                          {workspace.name}
                        </Link>
                        <span className="text-xs text-ink-soft">{workspace.slug}</span>
                      </Td>
                      <Td>
                        {workspace.owner ? (
                          <>
                            <Link
                              to={`/users/${workspace.owner.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block text-ink hover:text-primary"
                            >
                              <bdi>{workspace.owner.fullName}</bdi>
                            </Link>
                            {workspace.owner.username && (
                              <span dir="ltr" className="text-xs text-ink-soft">
                                @{workspace.owner.username}
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {subscription?.planName ?? "—"}
                        {subscription && (
                          <span className="block text-xs text-ink-soft capitalize">
                            {subscription.billingCycle}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <WorkspaceStatus row={row} />
                      </Td>
                      <Td className="tabular text-end">
                        {subscription ? formatMinorMoney(subscription.mrr, subscription.currency) : "—"}
                      </Td>
                      <Td className="tabular text-end">{formatNumber(workspace.orderCount)}</Td>
                      <Td className="text-ink-soft">{workspace.defaultCurrency}</Td>
                      <Td className="text-ink-soft">{formatDate(workspace.createdAt)}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
      <p className="mt-4 text-xs text-ink-soft">
        {t.footnoteStart} <code className="font-mono">GET /admin/workspaces</code>{t.footnoteEnd}
      </p>
    </div>
  );
}
