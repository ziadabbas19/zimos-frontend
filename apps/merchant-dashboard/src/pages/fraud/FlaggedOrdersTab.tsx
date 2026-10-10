import { useState } from "react";
import { isInvalidCursorError, protectionBlockAndCancel, type FlaggedOrder } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconShield } from "@/components/icons";
import { ListSkeleton } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { refreshWorkCounts } from "@/lib/workCounts";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";
import { FlaggedQuickLook } from "./flagged/FlaggedQuickLook";
import { FLAGGED_COLUMNS, FlaggedRow } from "./flagged/FlaggedRow";
import { FLAGGED_STRINGS } from "./flagged/flaggedText";

type Scope = "open" | "all";

/**
 * System role keys carrying orders.manage, which clearing a flag needs
 * (Backend core/security/permissions.js SYSTEM_ROLES; owner holds "*").
 * The dashboard sees only the role key, so a custom role with the permission
 * doesn't get the button; one without it that slips through gets the 403 toast.
 */
const CLEAR_FLAG_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

/**
 * Fraud protection → Flagged: the orders a rule flagged, the ones still
 * waiting on their call first. A row opens Quick Look; its ONE button is
 * «احجب والغي», which asks before it cancels and blocks. «سيبه يعدّي» clears
 * the flag and nothing else.
 */
export function FlaggedOrdersTab() {
  const t = useT(FLAGGED_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const { currentWorkspace } = useWorkspace();
  const canClear = CLEAR_FLAG_ROLES.has(currentWorkspace?.role ?? "");
  const manualCancel = useManualCancelPrompt();

  const [scope, setScope] = useState<Scope>("open");
  const list = useCursorList<FlaggedOrder>(
    async (cursor) => {
      const page = await apiClient.listFlaggedOrders(workspaceId, {
        before: cursor,
        includeResolved: scope === "all",
      });
      return { items: page.orders, nextCursor: page.nextCursor };
    },
    [workspaceId, scope],
    // The cursor is an order id; once that order's flag is cleared it drops
    // out of the query and the server rejects it on "before".
    { isStaleCursor: (err) => isInvalidCursorError(err, "before") }
  );

  // The order being looked at and the one being blocked. Each stays here while its sheet closes,
  // so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ order: FlaggedOrder; open: boolean } | null>(null);
  const [blocking, setBlocking] = useState<{ order: FlaggedOrder; open: boolean } | null>(null);
  const [passing, setPassing] = useState<Record<string, true>>({});

  /** A decided order leaves the list, and its preview with it. */
  function leave(orderId: string) {
    list.setItems((prev) => prev.filter((o) => o.id !== orderId));
    setPeek((current) => (current && current.order.id === orderId ? { ...current, open: false } : current));
  }

  async function pass(order: FlaggedOrder) {
    setPassing((prev) => ({ ...prev, [order.id]: true }));
    try {
      await apiClient.approveFlaggedOrder(workspaceId, order.id);
      toast.success(fmt(t.passed, { order: order.orderNumber }));
      leave(order.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPassing((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  }

  /** Blocking asks first. Quick Look steps aside for the question: two sheets are never stacked. */
  function askBlock(order: FlaggedOrder) {
    setPeek((current) => (current ? { ...current, open: false } : current));
    setBlocking({ order, open: true });
  }
  const closeBlock = () => setBlocking((current) => (current ? { ...current, open: false } : current));

  /**
   * POST /fraud/flagged-orders/:id/block — the same request as before. Its
   * contract already names `acknowledgeManualCancel`: it is sent only on the
   * second try, after the merchant said they cancelled the booking by hand.
   */
  async function sendBlock(order: FlaggedOrder, acknowledged: boolean) {
    if (acknowledged) await protectionBlockAndCancel(apiClient, workspaceId, order.id, { acknowledgeManualCancel: true });
    else await protectionBlockAndCancel(apiClient, workspaceId, order.id);
    toast.success(fmt(t.blocked, { order: order.orderNumber }));
    // A cancelled order leaves the calls that are due.
    refreshWorkCounts();
    leave(order.id);
  }

  /** Throws a translated Error: ConfirmDialog and the manual-cancel dialog show a thrown message as it is. */
  async function confirmBlock() {
    const order = blocking?.order;
    if (!order) return;
    try {
      await sendBlock(order, false);
      closeBlock();
    } catch (err) {
      // A courier without a cancel API (409 CARRIER_MANUAL_CANCEL_REQUIRED): nothing changed yet. The
      // merchant cancels the booking in the courier's dashboard, says so, and the same request goes again.
      const offered = manualCancel.offer(err, async () => {
        try {
          await sendBlock(order, true);
        } catch (retryErr) {
          throw new Error(errorMessage(retryErr));
        }
      });
      if (offered) {
        closeBlock();
        return;
      }
      throw new Error(errorMessage(err));
    }
  }

  const rows = list.items.map((order) => (
    <FlaggedRow
      key={order.id}
      order={order}
      compact={compact}
      canDecide={canClear}
      passing={passing[order.id] === true}
      current={peek?.open === true && peek.order.id === order.id}
      onPeek={() => setPeek({ order, open: true })}
      onPass={() => void pass(order)}
      onBlock={() => askBlock(order)}
    />
  ));

  // The preview follows the list: it shows the row as the list holds it now.
  const peeked = peek ? (list.items.find((o) => o.id === peek.order.id) ?? peek.order) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex">
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          label={t.scopeLabel}
          options={[
            { value: "open", label: t.scopeOpen },
            { value: "all", label: t.scopeAll },
          ]}
        />
      </div>

      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {list.items.length === 0 ? (
          scope === "open" ? (
            <EmptyState icon={<IconShield aria-hidden />} tone="success" title={t.emptyOpen} description={t.emptyOpenHow} />
          ) : (
            <EmptyState icon={<IconShield aria-hidden />} title={t.emptyAll} />
          )
        ) : compact ? (
          <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={FLAGGED_COLUMNS}
            label={t.listLabel}
            head={[
              { label: t.colCustomer },
              { label: t.colReasons },
              { label: t.colTotal, end: true },
              { label: t.colStatus },
              { label: t.colAction, end: true },
            ]}
          >
            {rows}
          </DeskList>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <FlaggedQuickLook
        order={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        canDecide={canClear}
        passing={peeked ? passing[peeked.id] === true : false}
        onPass={() => {
          if (peeked) void pass(peeked);
        }}
        onBlock={() => {
          if (peeked) askBlock(peeked);
        }}
      />

      <ConfirmDialog
        open={Boolean(blocking?.open)}
        title={blocking ? fmt(t.blockTitle, { order: blocking.order.orderNumber }) : ""}
        description={t.blockDescription}
        confirmLabel={t.block}
        busyLabel={t.blocking}
        cancelLabel={t.keep}
        destructive
        onCancel={closeBlock}
        onConfirm={confirmBlock}
      />
      {manualCancel.dialog}
    </div>
  );
}
