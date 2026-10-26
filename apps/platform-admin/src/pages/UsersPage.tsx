import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminUserStore } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { SearchInput } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { CopyId } from "@/components/CopyId";
import { UserStateBadge } from "@/components/userModeration";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

const STRINGS = {
  en: {
    title: "Users",
    description: "Every account on the platform, and the stores they own or work in.",
    searchPlaceholder: "Name, username, email, ID or store",
    showDeleted: "Show deleted",
    countOne: "{count} user",
    countMany: "{count} users",
    noMatch: "No user matches “{q}”.",
    empty: "No users yet.",
    colUser: "User",
    colEmail: "Email",
    colId: "ID",
    colStores: "Stores",
    colJoined: "Joined",
    noUsername: "no username yet",
    pages: "Pages",
    previous: "Previous",
    next: "Next",
    page: "Page {page}",
  },
  ar: {
    title: "المستخدمون",
    description: "جميع الحسابات على المنصة، والمتاجر التي يملكونها أو يعملون فيها.",
    searchPlaceholder: "الاسم أو اسم المستخدم أو البريد أو المعرّف أو المتجر",
    showDeleted: "إظهار المحذوفين",
    countOne: "مستخدم واحد",
    countMany: "عدد المستخدمين: {count}",
    noMatch: "لا يوجد مستخدم يطابق «{q}».",
    empty: "لا يوجد مستخدمون بعد.",
    colUser: "المستخدم",
    colEmail: "البريد الإلكتروني",
    colId: "المعرّف",
    colStores: "المتاجر",
    colJoined: "تاريخ الانضمام",
    noUsername: "بلا اسم مستخدم بعد",
    pages: "الصفحات",
    previous: "السابق",
    next: "التالي",
    page: "صفحة {page}",
  },
} satisfies Messages;

/** A store chip: its name, the person's role there and the subscription state. */
export function StoreChip({ store }: { store: AdminUserStore }) {
  const phase = store.subscription?.phase;
  const tone =
    phase === "restricted" || phase === "grace"
      ? "border-danger/40 text-danger"
      : phase === "payment_due" || phase === "expiring"
        ? "border-warning/50 text-warning"
        : "border-line text-ink-soft";
  return (
    <Link
      to={`/workspaces/${store.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:border-primary hover:text-primary ${
        store.matched ? "bg-primary-soft" : ""
      } ${tone}`}
      title={`${store.name} (${store.slug}) — ${store.role}${store.subscription ? `, ${store.subscription.status}` : ""}`}
    >
      <span className="truncate font-medium text-ink">{store.name}</span>
      <span>· {store.role}</span>
      {store.subscription && <span>· {store.subscription.status}</span>}
    </Link>
  );
}

/**
 * Every account on the platform, one search box for all of it: name (Arabic
 * spelled any way), username, email, id (whole or its first 8+ characters),
 * or a store's name / address / id — which lists the people behind it. The
 * search, the page and "Show deleted" live in the URL, so a result can be
 * linked to. Deleted accounts are hidden unless "Show deleted" is on.
 */
export function UsersPage() {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const showDeleted = params.get("deleted") === "1";
  const [draft, setDraft] = useState(q);

  // Typing settles for a moment before it becomes a search (and a URL).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.trim() === q) return;
      const next = new URLSearchParams();
      if (draft.trim()) next.set("q", draft.trim());
      if (showDeleted) next.set("deleted", "1");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, q, showDeleted, setParams]);

  const { data, loading, error, refresh } = useAsync(
    () => adminApi.searchUsers({ q, page, limit: PAGE_SIZE, includeDeleted: showDeleted }),
    [q, page, showDeleted]
  );

  const goTo = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  };

  // Back to the first page: the count changes.
  const setShowDeleted = (on: boolean) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (on) next.set("deleted", "1");
    else next.delete("deleted");
    setParams(next);
  };

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={draft}
          onChange={setDraft}
          placeholder={t.searchPlaceholder}
          className="sm:w-96"
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          {t.showDeleted}
        </label>
        {data && (
          <span className="text-sm text-ink-soft sm:ms-auto" aria-live="polite">
            {fmt(data.total === 1 ? t.countOne : t.countMany, { count: data.total })}
          </span>
        )}
      </div>

      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading} error={error} onRetry={() => void refresh()}>
        {data && data.users.length === 0 ? (
          <EmptyBlock message={q ? fmt(t.noMatch, { q }) : t.empty} />
        ) : (
          data && (
            <>
              <Panel flush>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>{t.colUser}</Th>
                      <Th>{t.colEmail}</Th>
                      <Th>{t.colId}</Th>
                      <Th>{t.colStores}</Th>
                      <Th>{t.colJoined}</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u) => (
                      <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(`/users/${u.id}`)}>
                        <Td>
                          <Link
                            to={`/users/${u.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block font-medium text-ink hover:text-primary"
                          >
                            <bdi>{u.fullName}</bdi>
                          </Link>
                          <span dir="ltr" className="text-xs text-ink-soft">
                            {u.username ? `@${u.username}` : t.noUsername}
                          </span>
                          <span className="ms-2">
                            <UserStateBadge status={u.status} deleted={u.deleted} />
                          </span>
                        </Td>
                        <Td className="break-all text-ink-soft">
                          <bdi dir="ltr">{u.email}</bdi>
                        </Td>
                        <Td>
                          <CopyId value={u.id} />
                        </Td>
                        <Td>
                          {u.workspaces.length === 0 ? (
                            <span className="text-xs text-ink-soft">—</span>
                          ) : (
                            <div className="flex max-w-md flex-wrap gap-1">
                              {u.workspaces.map((s) => (
                                <StoreChip key={s.id} store={s} />
                              ))}
                            </div>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-ink-soft">{formatDate(u.createdAt)}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
              {(data.page > 1 || data.hasMore) && (
                <nav aria-label={t.pages} className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => goTo(data.page - 1)}>
                    <ChevronLeft className="rtl:rotate-180" aria-hidden /> {t.previous}
                  </Button>
                  <span className="text-sm text-ink-soft">{fmt(t.page, { page: data.page })}</span>
                  <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => goTo(data.page + 1)}>
                    {t.next} <ChevronRight className="rtl:rotate-180" aria-hidden />
                  </Button>
                </nav>
              )}
            </>
          )
        )}
      </DataState>
    </div>
  );
}
