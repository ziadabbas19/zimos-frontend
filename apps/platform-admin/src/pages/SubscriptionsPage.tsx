import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableFooter, TableHeader, TableRow, cn } from "@store-builder/ui";
import type { SubscriptionStatus } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, SearchInput } from "@/components/forms";
import { Panel, SortHead, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { PricingBadge, Status } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { AdminSubscriptionRow } from "@/lib/adminApi";
import { formatDate, formatMinorMoney, formatRelative } from "@/lib/format";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Subscriptions",
    description: "Billing state for every workspace.",
    refresh: "Refresh",
    all: "All",
    trialing: "Trialing",
    active: "Active",
    pastDue: "Past due",
    canceled: "Canceled",
    paidOnly: "Paid only",
    search: "Search workspace name or address",
    noneYet: "No workspace has a subscription yet.",
    noMatch: "No subscriptions match these filters.",
    workspace: "Workspace",
    plan: "Plan",
    status: "Status",
    mrr: "MRR",
    next: "Next billing / trial end",
    billing: "Billing",
    unnamed: "Unnamed workspace",
    cancels: "Cancels at period end",
    trialEnds: "Trial ends ",
    total: "Total",
    paidTotal: "Paid total",
    free: "Free",
    discounted: "Discounted",
    readOnly: "Read-only here. A store's plan, period and pricing are set from its workspace page (Activate or change the plan).",
  },
  ar: {
    title: "الاشتراكات",
    description: "حالة الفوترة لكل متجر.",
    refresh: "تحديث",
    all: "الكل",
    trialing: "تجريبي",
    active: "نشط",
    pastDue: "متأخر السداد",
    canceled: "ملغى",
    paidOnly: "المدفوعة فقط",
    search: "ابحث باسم المتجر أو عنوانه",
    noneYet: "لا يوجد متجر لديه اشتراك بعد.",
    noMatch: "لا توجد اشتراكات تطابق هذه التصفية.",
    workspace: "المتجر",
    plan: "الخطة",
    status: "الحالة",
    mrr: "الإيراد الشهري المتكرر",
    next: "الفوترة التالية / نهاية التجربة",
    billing: "الفوترة",
    unnamed: "متجر بلا اسم",
    cancels: "يُلغى في نهاية الفترة",
    trialEnds: "تنتهي التجربة ",
    total: "الإجمالي",
    paidTotal: "إجمالي المدفوع",
    free: "مجاني",
    discounted: "مخفّض",
    readOnly: "للعرض فقط هنا. تُضبط خطة المتجر وفترته وتسعيره من صفحة المتجر (تفعيل الخطة أو تغييرها).",
  },
};

type Filter = "all" | SubscriptionStatus;
type SortKey = "name" | "mrr" | "next";

const FILTERS: Array<[Filter, "all" | "trialing" | "active" | "pastDue" | "canceled"]> = [
  ["all", "all"],
  ["trialing", "trialing"],
  ["active", "active"],
  ["past_due", "pastDue"],
  ["canceled", "canceled"],
];

/** Trials count down to their end date; everything else to the period end. */
function nextDate(s: AdminSubscriptionRow): string {
  return (s.status === "trialing" ? s.trialEndsAt : s.currentPeriodEnd) ?? "";
}

export function SubscriptionsPage() {
  const t = useT(STRINGS);
  const { data, loading, error, refresh } = useAsync(() => adminApi.listSubscriptions(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "mrr", dir: "desc" });
  // Only the subscriptions at the plan price: no free (gift) or discounted ones.
  const [paidOnly, setPaidOnly] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((s) => filter === "all" || s.status === filter)
      .filter((s) => !paidOnly || (s.pricingKind ?? "paid") === "paid")
      .filter(
        (s) =>
          !q ||
          (s.workspaceName ?? "").toLowerCase().includes(q) ||
          (s.workspaceSlug ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sort.key === "name")
          return compareValues(a.workspaceName ?? "", b.workspaceName ?? "", sort.dir);
        // Undated rows sort last in ascending order.
        if (sort.key === "next")
          return compareValues(nextDate(a) || "9999", nextDate(b) || "9999", sort.dir);
        return compareValues(a.mrr, b.mrr, sort.dir);
      });
  }, [rows, filter, query, sort, paidOnly]);

  const options = FILTERS.map(([value, key]) => ({
    value,
    label: t[key],
    count: value === "all" ? rows.length : rows.filter((s) => s.status === value).length,
  }));

  const totalMrr = filtered.reduce((sum, s) => sum + s.mrr, 0);
  // Plans can be priced in different currencies; a single total is only
  // meaningful when every row shares one.
  const currencies = new Set(filtered.map((s) => s.currency));
  const totalCurrency = currencies.size === 1 ? [...currencies][0] : null;

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
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <FilterChips options={options} value={filter} onChange={setFilter} />
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
              {t.paidOnly}
            </label>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder={t.search} />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock
            message={
              rows.length === 0
                ? t.noneYet
                : t.noMatch
            }
          />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label={t.workspace} sortKey="name" sort={sort} onSort={setSort} />
                  <Th>{t.plan}</Th>
                  <Th>{t.status}</Th>
                  <SortHead label={t.mrr} sortKey="mrr" sort={sort} onSort={setSort} className="text-end" />
                  <SortHead label={t.next} sortKey="next" sort={sort} onSort={setSort} />
                  <Th>{t.billing}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const next = nextDate(s);
                  return (
                    <TableRow key={s.id}>
                      <Td>
                        <Link
                          to={`/workspaces/${s.workspaceId}`}
                          className="block font-medium text-ink hover:text-primary"
                        >
                          {s.workspaceName ?? t.unnamed}
                        </Link>
                        {s.workspaceSlug && (
                          <span className="text-xs text-ink-soft">{s.workspaceSlug}</span>
                        )}
                      </Td>
                      <Td>
                        {s.planName ?? "—"}
                        <span className="block text-xs text-ink-soft capitalize">{s.billingCycle}</span>
                      </Td>
                      <Td>
                        <Status value={s.status} />
                        <PricingBadge kind={s.pricingKind} label={s.pricingKind === "free" ? t.free : t.discounted} />
                        {s.cancelAtPeriodEnd && (
                          <span className="mt-1 block text-xs text-ink-soft">{t.cancels}</span>
                        )}
                      </Td>
                      <Td className="tabular text-end">{formatMinorMoney(s.mrr, s.currency)}</Td>
                      <Td>
                        {next ? (
                          <>
                            {formatDate(next)}
                            <span
                              className={cn(
                                "block text-xs",
                                new Date(next).getTime() < Date.now() ? "text-danger" : "text-ink-soft"
                              )}
                            >
                              {s.status === "trialing" ? t.trialEnds : ""}
                              {formatRelative(next)}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </Td>
                      <Td className="text-ink-soft capitalize">{s.externalProvider ?? "—"}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <Td className="font-medium" colSpan={3}>
                    {paidOnly ? t.paidTotal : t.total} ({filtered.length})
                  </Td>
                  <Td className="tabular text-end font-semibold">
                    {totalCurrency ? formatMinorMoney(totalMrr, totalCurrency) : "—"}
                  </Td>
                  <Td colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </Panel>
        )}
      </DataState>
      <p className="mt-4 text-xs text-ink-soft">
        {t.readOnly}
      </p>
    </div>
  );
}
