import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import type { Discount, DiscountType } from "@store-builder/api-client";
import { IconArchive, IconCopy, IconEdit, IconLink, IconPause, IconPlay, IconPlus, IconSearch, IconTag } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { ActiveFilters, type ActiveFilterChip } from "@/pages/orders/list/ActiveFilters";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";
import { OffersHub } from "@/pages/offers/hub/OffersHub";
import { DiscountFormSheet } from "@/pages/offers/hub/DiscountFormSheet";
import { DiscountCards, DiscountsTable } from "@/pages/offers/hub/DiscountsList";
import { DiscountsFilterSheet, type DiscountKind } from "@/pages/offers/hub/DiscountsFilterSheet";
import {
  DISCOUNT_STRINGS,
  DISCOUNT_TYPES,
  DISPLAY_STATUSES,
  STATUS_LABEL,
  TYPE_LABEL,
  copyText,
  displayStatus,
  type DisplayStatus,
} from "@/pages/offers/hub/discountModel";
import { matchesFolded } from "@/pages/offers/hub/foldText";
import { BulkCodesButton } from "./BulkCodesDialog";
import { CouponLinkDialog } from "./CouponLinkDialog";
import { useDiscountResults, useResultsWindowLabel } from "./DiscountResults";

type StatusFilter = "all" | DisplayStatus;

const isStatus = (value: string | null): value is DisplayStatus => DISPLAY_STATUSES.some((status) => status === value);
const isType = (value: string | null): value is DiscountType => DISCOUNT_TYPES.some((type) => type === value);
const isKind = (value: string | null): value is DiscountKind => value === "code" || value === "automatic";

/**
 * The discount codes tab of «العروض والخصومات» (/discounts): codes and
 * automatic discounts as one list — search, ONE Filters sheet, the statuses as
 * chips with their counts, a table from md up and cards on a phone. A row
 * opens the discount in a sheet (form, live preview, its results and actions).
 *
 * The data and the calls are the ones this page always made: `listDiscounts`,
 * `setDiscountStatus`, `deleteDiscount` (which archives), and the results of
 * each discount for the window in the address (`?range=` / `?from=&to=`). The
 * status, type and kind filters live in the address too (`?status=`, `?type=`,
 * `?kind=`), so a filtered list can be linked and survives Back.
 */
export function DiscountsPage() {
  const t = useT(DISCOUNT_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const desktop = useIsDesktop();
  // Shown at once from the session's memory on a return, refreshed behind.
  const list = useCachedAsync(`discounts:${workspaceId}`, () => apiClient.listDiscounts(workspaceId), [workspaceId]);
  // What each discount brought in a window of days: four columns, their date range, and the sheet's panel.
  const results = useDiscountResults(workspaceId);
  const windowLabel = useResultsWindowLabel(results.range);

  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const typeParam = params.get("type");
  const kindParam = params.get("kind");
  const status: StatusFilter = isStatus(statusParam) ? statusParam : "all";
  const type = isType(typeParam) ? typeParam : null;
  const kind = isKind(kindParam) ? kindParam : null;
  const [q, setQ] = useState("");

  function setParam(name: "status" | "type" | "kind", value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true }
    );
  }
  function clearFilters() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("type");
        next.delete("kind");
        return next;
      },
      { replace: true }
    );
  }

  // The id, not the object: the sheet then follows the list when the discount changes under it.
  const [formTarget, setFormTarget] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<Discount | null>(null);
  const [sharing, setSharing] = useState<Discount | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const reload = () => list.refresh({ silent: true });
  const discounts = useMemo(() => list.data ?? [], [list.data]);
  const editing = formTarget && formTarget !== "new" ? (discounts.find((d) => d.id === formTarget) ?? null) : null;

  // Everything but the status: what the chips count.
  const matching = useMemo(
    () =>
      discounts.filter((d) => {
        if (type && d.type !== type) return false;
        if (kind && (kind === "code") !== Boolean(d.code)) return false;
        return q.trim() === "" || matchesFolded(`${d.code ?? t.automatic} ${t[TYPE_LABEL[d.type]]}`, q);
      }),
    [discounts, type, kind, q, t]
  );
  const rows = useMemo(() => (status === "all" ? matching : matching.filter((d) => displayStatus(d) === status)), [matching, status]);

  const chipItems: ChipItem<StatusFilter>[] = [
    { value: "all", label: t.all, count: matching.length },
    ...DISPLAY_STATUSES.map((value) => ({
      value,
      label: t[STATUS_LABEL[value]],
      count: matching.filter((d) => displayStatus(d) === value).length,
      tone: value === "active" ? ("success" as const) : ("default" as const),
    })),
  ];

  const filterChips: ActiveFilterChip[] = [];
  if (type) filterChips.push({ id: "type", label: fmt(t.chipType, { name: t[TYPE_LABEL[type]] }), onRemove: () => setParam("type", null) });
  if (kind)
    filterChips.push({
      id: "kind",
      label: fmt(t.chipKind, { name: kind === "code" ? t.kind_code : t.kind_automatic }),
      onRemove: () => setParam("kind", null),
    });

  async function toggleStatus(d: Discount) {
    const next = d.status === "active" ? "disabled" : "active";
    try {
      await apiClient.setDiscountStatus(workspaceId, d.id, next);
      void reload();
      // Reversible, so it answers with Undo: the same call, back to what it was.
      toast.undo(next === "active" ? t.enabledToast : t.disabledToast, async () => {
        await apiClient.setDiscountStatus(workspaceId, d.id, d.status);
        void reload();
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function archive(d: Discount) {
    await apiClient.deleteDiscount(workspaceId, d.id);
    toast.success(d.code ? fmt(t.archivedCodeToast, { code: d.code }) : t.archivedToast);
    setDeleting(null);
    setFormTarget(null);
    void reload();
  }

  async function copyCode(d: Discount) {
    if (!d.code) return;
    if (await copyText(d.code)) toast.success(fmt(t.copied, { code: d.code }));
    else toast.error(t.copyFailed);
  }

  function menuFor(d: Discount): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "open", label: t.open, icon: IconEdit, onSelect: () => setFormTarget(d.id) }];
    if (d.code) items.push({ id: "copy", label: t.copyCode, icon: IconCopy, onSelect: () => void copyCode(d) });
    if (d.code && d.status !== "archived") items.push({ id: "share", label: t.shareLink, icon: IconLink, onSelect: () => setSharing(d) });
    if (d.status !== "archived") {
      items.push({
        id: "toggle",
        label: d.status === "active" ? t.disable : t.enable,
        icon: d.status === "active" ? IconPause : IconPlay,
        onSelect: () => void toggleStatus(d),
        separatorBefore: true,
      });
      items.push({ id: "archive", label: t.archive, icon: IconArchive, onSelect: () => setDeleting(d), destructive: true });
    }
    return items;
  }

  const createButton = (
    <Button className="min-h-11 rounded-full px-5 md:min-h-9" onClick={() => setFormTarget("new")}>
      <IconPlus className="size-4" aria-hidden />
      {t.create}
    </Button>
  );

  const sharingStatus = sharing ? displayStatus(sharing) : null;

  let body: ReactNode;
  if (list.loading) {
    body = <ListSkeleton rows={5} />;
  } else if (list.error != null && list.data === null) {
    body = (
      <DataState loading={false} error={list.error} onRetry={() => void list.refresh()}>
        {null}
      </DataState>
    );
  } else if (discounts.length === 0) {
    body = (
      <EmptyState
        icon={<IconTag aria-hidden />}
        title={t.emptyTitle}
        description={t.emptyHint}
        action={
          <Button className="min-h-11 rounded-full px-5" onClick={() => setFormTarget("new")}>
            {t.createFirst}
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={<IconSearch aria-hidden />}
        title={t.noMatchTitle}
        description={t.noMatchHint}
        action={
          <Button
            variant="outline"
            className="min-h-11 rounded-full px-5"
            onClick={() => {
              setQ("");
              setParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("status");
                  next.delete("type");
                  next.delete("kind");
                  return next;
                },
                { replace: true }
              );
            }}
          >
            {t.clearFilters}
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {list.error != null && (
          <Alert variant="danger" className="mb-3">
            {getErrorMessage(list.error)}
          </Alert>
        )}
        {desktop ? (
          <DiscountsTable rows={rows} results={results} menuFor={menuFor} onOpen={(d) => setFormTarget(d.id)} />
        ) : (
          <DiscountCards rows={rows} results={results} menuFor={menuFor} onOpen={(d) => setFormTarget(d.id)} />
        )}
        {/* Which days the result figures cover, and the way to change them (the Filters sheet). */}
        {!results.denied && (
          <p className="mt-3 flex flex-wrap items-center gap-x-1 px-1 text-xs leading-5 text-ink-soft">
            <span>{fmt(t.resultsFor, { window: windowLabel })}</span>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative cursor-pointer rounded-sm font-semibold text-primary underline-offset-2 before:absolute before:-inset-x-2 before:-inset-y-3 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.changeWindow}
            </button>
            {Boolean(results.error) && !results.pending && (
              <span role="alert" className="basis-full font-medium text-danger">
                {getErrorMessage(results.error)}
              </span>
            )}
          </p>
        )}
      </>
    );
  }

  return (
    <OffersHub tab="discounts" actions={<BulkCodesButton onGenerated={() => void reload()} />} primaryAction={createButton}>
      <div className="flex flex-col gap-3">
        {(list.loading || discounts.length > 0) && (
          <>
            <ListToolbar
              search={{ value: q, onChange: setQ, placeholder: t.searchPlaceholder, label: t.searchLabel }}
              filters={{ count: filterChips.length, onOpen: () => setFiltersOpen(true) }}
            />
            <ChipRow items={chipItems} value={status} onChange={(next) => setParam("status", next === "all" ? null : next)} label={t.statusLabel} countsLoading={list.loading} />
            <ActiveFilters chips={filterChips} onClearAll={clearFilters} />
          </>
        )}
        <div aria-busy={list.stale || undefined} className="min-w-0">
          {body}
        </div>
      </div>

      <DiscountsFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        type={type}
        onType={(next) => setParam("type", next)}
        kind={kind}
        onKind={(next) => setParam("kind", next)}
        onReset={clearFilters}
        shownCount={rows.length}
        results={results}
        hasDiscounts={discounts.length > 0}
      />

      <DiscountFormSheet
        // A discount that left the list while its sheet was open (archived elsewhere) closes it.
        target={formTarget === "new" ? "new" : editing}
        results={results}
        onClose={() => setFormTarget(null)}
        onSaved={() => {
          setFormTarget(null);
          void reload();
        }}
        onToggle={(d) => void toggleStatus(d)}
        onArchive={archive}
      />

      {/* From a row's menu; the sheet of a discount has its own copies of these two. */}
      <CouponLinkDialog
        discount={sharing}
        statusText={sharing && sharingStatus !== "active" && sharingStatus ? t[STATUS_LABEL[sharingStatus]] : null}
        onClose={() => setSharing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.code ? fmt(t.archiveTitleCode, { code: deleting.code }) : t.archiveTitle}
        description={t.archiveDescription}
        confirmLabel={t.archiveConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => (deleting ? archive(deleting) : undefined)}
      />
    </OffersHub>
  );
}
