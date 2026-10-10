import { useEffect, useMemo, useState } from "react";
import { Button } from "@store-builder/ui";
import {
  BLOCKED_ENTRY_SCOPES,
  BLOCKED_ENTRY_TYPES,
  protectionListBlocked,
  protectionRemoveBlocked,
  type BlockedEntry,
  type BlockedEntryList,
  type BlockedEntryScope,
  type BlockedEntryType,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconBlock, IconPlus, IconSearch, IconUpload } from "@/components/icons";
import { ChipRow, FilterChoice, FilterGroup, FilterSheet, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageActionBar } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ActiveFilters, type ActiveFilter } from "@/pages/returns/rowkit/ActiveFilters";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { AddBlockedSheet } from "./blocked/AddBlockedSheet";
import { BLOCKED_COLUMNS, BlockedRow } from "./blocked/BlockedRow";
import { ImportBlockedSheet } from "./blocked/ImportBlockedSheet";
import { BLOCKED_STRINGS, isolate } from "./blocked/blockedText";

type TypeFilter = "all" | BlockedEntryType;

/**
 * Fraud protection → Blocked: the store's blocked_entries. Phones, IPs,
 * emails, devices and name + address pairs, each blocked from ordering, from
 * verification codes or from visiting. Search and ONE Filters sheet (blocked
 * from what); the kinds are the chips, with how many each holds; «ضيف» and
 * «استورد» open in sheets over the list.
 */
export function BlockedEntriesTab() {
  const t = useT(BLOCKED_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();

  const [type, setType] = useState<TypeFilter>("all");
  const [scope, setScope] = useState<BlockedEntryScope | null>(null);
  const [search, setSearch] = useState("");
  // The field never waits; the request does, 300ms after the last keystroke.
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const params = useMemo(
    () => ({ type: type === "all" ? undefined : type, scope: scope ?? undefined, q: q || undefined }),
    [type, scope, q]
  );
  const cachePrefix = `fraud:blocked:${workspaceId}:`;
  // Kept between visits: a list the merchant comes back to shows at once and is read again behind.
  const list = useCachedAsync<BlockedEntryList>(
    `${cachePrefix}${type}:${scope ?? ""}:${q}`,
    () => protectionListBlocked(apiClient, workspaceId, params),
    [workspaceId, params]
  );
  const entries = list.data?.entries ?? [];
  const counts = list.data?.counts;
  const [loadingMore, setLoadingMore] = useState(false);

  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The entry being unblocked stays here while its dialog closes, so the question does not empty on its way out.
  const [removing, setRemoving] = useState<{ entry: BlockedEntry; open: boolean } | null>(null);

  /** After a change to the list: this view is read again, and the other views kept in memory are dropped. */
  function reload() {
    invalidateCached(cachePrefix);
    void list.refresh({ silent: true });
  }

  async function loadMore() {
    const cursor = list.data?.nextCursor;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await protectionListBlocked(apiClient, workspaceId, { ...params, cursor });
      list.setData((prev) => ({ ...next, entries: [...(prev?.entries ?? []), ...next.entries] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmRemove() {
    const entry = removing?.entry;
    if (!entry) return;
    try {
      await protectionRemoveBlocked(apiClient, workspaceId, entry.id);
    } catch (err) {
      // ConfirmDialog shows a thrown Error's message as-is.
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.removed, { value: isolate(entry.label) }));
    setRemoving((current) => (current ? { ...current, open: false } : current));
    reload();
  }

  // While the first answer is on its way a chip holds its place with a dash (null), instead of folding behind «كمان» as an empty one.
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : null;
  const chips: ChipItem<TypeFilter>[] = [
    { value: "all", label: t.all, count: total },
    ...BLOCKED_ENTRY_TYPES.map((key) => ({ value: key, label: t[`type_${key}`], count: counts ? counts[key] : null })),
  ];

  const filtered = type !== "all" || scope !== null || q !== "";
  const scopeChips: ActiveFilter[] = scope
    ? [{ id: "scope", label: fmt(t.scopeChip, { scope: t[`scope_${scope}`] }), onRemove: () => setScope(null) }]
    : [];

  function clearAll() {
    setSearch("");
    setScope(null);
    setType("all");
  }

  const rows = entries.map((entry) => (
    <BlockedRow key={entry.id} entry={entry} compact={compact} onRemove={() => setRemoving({ entry, open: true })} />
  ));

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.search }}
        filters={{ count: scope ? 1 : 0, onOpen: () => setFiltersOpen(true) }}
      >
        <Button variant="outline" className="h-11 gap-2 rounded-full px-3.5 sm:px-4" onClick={() => setImporting(true)}>
          <IconUpload className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{t.importCsv}</span>
        </Button>
        {/* On a phone the one creation action is the bar above the dock (below); from md it closes the toolbar. */}
        <Button className="h-11 gap-2 rounded-full px-4 max-md:hidden" onClick={() => setAdding(true)}>
          <IconPlus className="size-4" aria-hidden />
          {t.add}
        </Button>
      </ListToolbar>

      <ChipRow items={chips} value={type} onChange={setType} label={t.typeFilter} countsLoading={!counts} />
      <ActiveFilters filters={scopeChips} onClearAll={() => setScope(null)} />

      <DataState
        loading={list.loading}
        // A refresh that failed behind rows already on screen leaves them there.
        error={entries.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {entries.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.emptyFiltered}
              action={
                <Button variant="outline" className="rounded-full px-5" onClick={clearAll}>
                  {t.clearAll}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconBlock aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyDescription}
              action={
                <Button className="rounded-full px-5" onClick={() => setAdding(true)}>
                  {t.addLong}
                </Button>
              }
            />
          )
        ) : compact ? (
          <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={BLOCKED_COLUMNS}
            label={t.listLabel}
            head={[
              { label: t.colValue },
              { label: t.colScope },
              { label: t.colReason },
              { label: t.colAdded },
              { label: t.remove, end: true },
            ]}
          >
            {rows}
          </DeskList>
        )}
        <LoadMore hasMore={Boolean(list.data?.nextCursor)} loading={loadingMore} onClick={() => void loadMore()} />
      </DataState>

      <PageActionBar>
        <Button onClick={() => setAdding(true)}>
          <IconPlus className="size-4" aria-hidden />
          {t.addLong}
        </Button>
      </PageActionBar>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={scope ? 1 : 0}
        onReset={() => setScope(null)}
        applyLabel={t.showResults}
      >
        <FilterGroup label={t.scopeFilter}>
          <FilterChoice<BlockedEntryScope>
            label={t.scopeFilter}
            allowClear
            value={scope}
            onChange={setScope}
            options={BLOCKED_ENTRY_SCOPES.map((key) => ({ value: key, label: t[`scope_${key}`] }))}
          />
        </FilterGroup>
      </FilterSheet>

      <AddBlockedSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          reload();
        }}
      />
      <ImportBlockedSheet open={importing} onClose={() => setImporting(false)} onImported={reload} />
      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={removing ? fmt(t.removeTitle, { value: isolate(removing.entry.label) }) : ""}
        description={t.removeDescription}
        confirmLabel={t.remove}
        busyLabel={t.removing}
        cancelLabel={t.cancel}
        onCancel={() => setRemoving((current) => (current ? { ...current, open: false } : current))}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
