import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { statementGetHeld, type SettlementLinePayload, type SettlementListItem, type SettlementStatus } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCash, IconCourier, IconDocument, IconPlus, IconReceipt, IconRefresh, IconUpload, IconWallet } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ChipRow, ListSkeleton, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { ReportKpiStrip } from "@/components/report";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAddressValue } from "@/pages/analytics/storeReports/storeReportParts";
import { HeaderMenu } from "@/pages/profit/HeaderMenu";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { HeldList, heldRows } from "./HeldList";
import { ReconcileSheet } from "./ReconcileSheet";
import { SettlementList } from "./SettlementList";
import { SettlementSheet } from "./SettlementSheet";
import { SETTLEMENT_STRINGS, settlementErrorText } from "./settlementStrings";
import { StatementImportSheet } from "./StatementTools";

type View = "held" | "settlements";
type StatusChip = "all" | SettlementStatus;
const PAGE_SIZE = 50;

/**
 * Courier settlements (/settlements): what the couriers hold and what reached
 * the merchant.
 *
 * Four figures, then ONE of two lists (`?tab=`): the money held, courier by
 * courier with its age — the row's step is «سجّل تحويل», a sheet that ticks
 * the orders the courier paid for and saves a draft — and the settlements,
 * by status (`?status=`), each opening in a panel over the list where a draft
 * is confirmed or deleted. The courier's own statement file is imported from
 * the header's menu. Every call is the page's old one.
 */
export function SettlementsPage() {
  const t = useT(SETTLEMENT_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const phone = useIsPhone();
  const compact = useIsCompact();
  const [params, setParams] = useSearchParams();

  function write(key: string, value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }
  const statusParam = params.get("status");
  const [view, setView] = useAddressValue<View>(params.get("tab") === "settlements" ? "settlements" : "held", (next) =>
    write("tab", next, "held")
  );
  const [status, setStatus] = useAddressValue<StatusChip>(
    statusParam === "draft" || statusParam === "confirmed" ? statusParam : "all",
    (next) => write("status", next, "all")
  );

  const summary = useCachedAsync(workspaceId ? `settlements:summary:${workspaceId}` : null, () => apiClient.getSettlementSummary(workspaceId), [
    workspaceId,
  ]);
  const unsettled = useCachedAsync(
    workspaceId ? `settlements:unsettled:${workspaceId}` : null,
    () => apiClient.listUnsettledOrders(workspaceId),
    [workspaceId]
  );
  // The aging report needs its own right: without it the list still shows what can be settled.
  const held = useCachedAsync(workspaceId ? `settlements:held:${workspaceId}` : null, () => statementGetHeld(apiClient, workspaceId), [workspaceId]);
  const listKey = `${workspaceId}:${status}`;
  const settlements = useCachedAsync(
    workspaceId ? `settlements:list:${listKey}` : null,
    () => apiClient.listSettlements(workspaceId, { limit: PAGE_SIZE, status: status === "all" ? undefined : status }),
    [workspaceId, status]
  );
  // Pages after the first, for the list they belong to.
  const [more, setMore] = useState<{ key: string; rows: SettlementListItem[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // The settlement in the panel. It stays here while the panel closes, so the panel does not empty on its way out.
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null);
  const [pending, setPending] = useState<{ kind: "confirm" | "delete"; id: string } | null>(null);
  const [reconcile, setReconcile] = useState<{ carrier: string | null; open: boolean }>({ carrier: null, open: false });
  const [importing, setImporting] = useState(false);

  const sheetId = sheet?.id ?? null;
  const detail = useAsync(() => (sheetId ? apiClient.getSettlement(workspaceId, sheetId) : Promise.resolve(null)), [workspaceId, sheetId]);
  // While another settlement loads, the one before it is not shown under its name.
  const shownDetail = detail.data && detail.data.id === sheetId ? detail.data : null;

  const orders = unsettled.data?.orders ?? [];
  const carriers = unsettled.data?.carriers ?? [];
  const currency = held.data?.currency ?? orders[0]?.currency ?? currentWorkspace?.defaultCurrency ?? "EGP";
  const money = (minor: number) => formatMoney(minor, currency);

  const extra = more && more.key === listKey ? more : null;
  // A row of the list before stays only if it belongs under this chip: nothing is shown under the wrong status.
  const firstPage = (settlements.data?.settlements ?? []).filter((row) => status === "all" || row.status === status);
  const list = extra ? [...firstPage, ...extra.rows] : firstPage;
  const cursor = extra ? extra.cursor : (settlements.data?.nextCursor ?? null);

  function refreshAll() {
    setMore(null);
    void summary.refresh({ silent: true });
    void unsettled.refresh({ silent: true });
    void held.refresh({ silent: true });
    void settlements.refresh({ silent: true });
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiClient.listSettlements(workspaceId, {
        limit: PAGE_SIZE,
        status: status === "all" ? undefined : status,
        before: cursor,
      });
      setMore({ key: listKey, rows: [...(extra?.rows ?? []), ...page.settlements], cursor: page.nextCursor });
    } catch (err) {
      toast.error(settlementErrorText(err, t));
    } finally {
      setLoadingMore(false);
    }
  }

  const openSettlement = (id: string) => setSheet({ id, open: true });
  const closeSheet = () => setSheet((current) => (current ? { ...current, open: false } : current));

  async function createDraft(carrierCode: string, lines: SettlementLinePayload[]) {
    // A group of the store's own courier settles under their id too.
    const courierId = carriers.find((c) => c.carrierCode === carrierCode)?.courierId ?? null;
    const created = await apiClient.createSettlement(workspaceId, { carrierCode, ...(courierId ? { courierId } : {}), lines });
    toast.success(t.draftCreated);
    setReconcile((current) => ({ ...current, open: false }));
    refreshAll();
    openSettlement(created.id);
  }

  const s = summary.data;
  const rows = heldRows(carriers, held.data);
  const summaryRow = sheetId ? (list.find((row) => row.id === sheetId) ?? null) : null;

  const chips: ChipItem<StatusChip>[] = [
    { value: "all", label: t.chipAll },
    { value: "draft", label: t.chipDraft, count: s ? s.draftSettlements : null, tone: "attention" },
    { value: "confirmed", label: t.chipConfirmed },
  ];

  const recordButton = (
    <Button type="button" className="h-11 gap-2 rounded-full px-5" onClick={() => setReconcile({ carrier: null, open: true })}>
      <IconPlus className="size-4" aria-hidden />
      {t.record}
    </Button>
  );

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={
          phone
            ? undefined
            : s
              ? s.dueFromCouriers > 0
                ? fmt(t.answerDue, { amount: money(s.dueFromCouriers), orders: countOf("order", s.unsettledOrders) })
                : t.answerClear
              : t.description
        }
        actions={
          <HeaderMenu
            label={t.tools}
            items={[
              { id: "import", label: t.importStatement, hint: t.importHint, icon: IconUpload, onSelect: () => setImporting(true) },
              { id: "refresh", label: t.refresh, hint: t.refreshHint, icon: IconRefresh, onSelect: refreshAll, separatorBefore: true },
            ]}
          />
        }
        primaryAction={recordButton}
      />

      <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
        {summary.loading && !s ? (
          <ReportKpiStrip loading count={4} sparkline={false} />
        ) : s ? (
          <ReportKpiStrip sparkline={false}>
            <KpiCard
              label={t.kpiDue}
              value={money(s.dueFromCouriers)}
              hint={s.unsettledOrders > 0 ? fmt(t.kpiDueHint, { orders: countOf("order", s.unsettledOrders) }) : t.kpiDueNone}
              icon={<IconWallet />}
            />
            <KpiCard label={t.kpiReceived} value={money(s.received)} hint={t.kpiReceivedHint} icon={<IconCash />} />
            <KpiCard label={t.kpiFees} value={money(s.courierFees)} hint={t.kpiFeesHint} icon={<IconReceipt />} />
            <KpiCard
              label={t.kpiDrafts}
              value={formatCount(s.draftSettlements)}
              hint={s.draftSettlements > 0 ? t.kpiDraftsHint : t.kpiDraftsNone}
              icon={<IconDocument />}
              to={s.draftSettlements > 0 ? "/settlements?tab=settlements&status=draft" : undefined}
            />
          </ReportKpiStrip>
        ) : null}

        <Segmented
          value={view}
          onChange={setView}
          label={t.viewLabel}
          className="w-full sm:w-auto sm:self-start"
          options={[
            { value: "held", label: t.viewHeld, count: s && s.unsettledOrders > 0 ? s.unsettledOrders : undefined },
            { value: "settlements", label: t.viewSettlements, count: s && s.draftSettlements > 0 ? s.draftSettlements : undefined },
          ]}
        />

        {view === "held" ? (
          <DataState
            loading={unsettled.loading && !unsettled.data}
            error={unsettled.data ? null : unsettled.error}
            onRetry={() => void unsettled.refresh()}
            skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={3} />}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={<IconCourier aria-hidden />}
                tone="success"
                title={t.noUnsettled}
                description={t.noUnsettledDesc}
                action={
                  <Button asChild variant="outline" className="min-h-11 rounded-full px-5">
                    <ViewLink to="/orders">{t.seeOrders}</ViewLink>
                  </Button>
                }
              />
            ) : (
              <HeldList rows={rows} currency={currency} compact={compact} onRecord={(carrier) => setReconcile({ carrier, open: true })} />
            )}
          </DataState>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <ChipRow items={chips} value={status} onChange={setStatus} label={t.chipsLabel} collapseEmpty={false} />
            <DataState
              loading={settlements.loading && list.length === 0}
              error={list.length === 0 ? settlements.error : null}
              onRetry={() => void settlements.refresh()}
              skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
            >
              {list.length === 0 ? (
                <EmptyState
                  icon={<IconDocument aria-hidden />}
                  title={status === "draft" ? t.noDrafts : status === "confirmed" ? t.noConfirmed : t.noSettlements}
                  description={t.noSettlementsDesc}
                  action={
                    status === "all" ? (
                      carriers.length > 0 ? (
                        recordButton
                      ) : undefined
                    ) : (
                      <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setStatus("all")}>
                        {t.showAll}
                      </Button>
                    )
                  }
                />
              ) : (
                <>
                  <SettlementList
                    rows={list}
                    currency={currency}
                    compact={compact}
                    openId={sheet?.open && !pending ? sheet.id : null}
                    onOpen={openSettlement}
                    onConfirm={(id) => setPending({ kind: "confirm", id })}
                    onDelete={(id) => setPending({ kind: "delete", id })}
                  />
                  <LoadMore hasMore={Boolean(cursor)} loading={loadingMore} onClick={() => void loadMore()} />
                </>
              )}
            </DataState>
          </div>
        )}
      </div>

      {/* The panel steps aside for a question: two sheets are never stacked. */}
      <SettlementSheet
        open={Boolean(sheet?.open) && pending === null}
        onClose={closeSheet}
        summary={summaryRow}
        detail={shownDetail}
        loading={detail.loading}
        error={detail.error}
        onRetry={() => void detail.refresh()}
        currency={currency}
        onConfirm={() => {
          if (sheetId) setPending({ kind: "confirm", id: sheetId });
        }}
        onDelete={() => {
          if (sheetId) setPending({ kind: "delete", id: sheetId });
        }}
      />

      <ReconcileSheet
        open={reconcile.open}
        onClose={() => setReconcile((current) => ({ ...current, open: false }))}
        carriers={carriers}
        orders={orders}
        initialCarrier={reconcile.carrier}
        onCreate={createDraft}
      />

      <StatementImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        workspaceId={workspaceId}
        carriers={carriers.map((carrier) => carrier.carrierCode)}
        onCreated={(id) => {
          setImporting(false);
          refreshAll();
          openSettlement(id);
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "confirm"}
        title={t.confirmTitle}
        description={t.confirmDesc}
        confirmLabel={t.confirm}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await apiClient.confirmSettlement(workspaceId, pending.id);
          } catch (err) {
            // Thrown so ConfirmDialog shows it inline and stays open.
            throw new Error(settlementErrorText(err, t));
          }
          toast.success(t.confirmed);
          setPending(null);
          void detail.refresh({ silent: true });
          refreshAll();
        }}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        title={t.deleteTitle}
        description={t.deleteDesc}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await apiClient.deleteSettlement(workspaceId, pending.id);
          } catch (err) {
            throw new Error(settlementErrorText(err, t));
          }
          toast.success(t.deleted);
          if (sheet?.id === pending.id) closeSheet();
          setPending(null);
          refreshAll();
        }}
      />
    </div>
  );
}
