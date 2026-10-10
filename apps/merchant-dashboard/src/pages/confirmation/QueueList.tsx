import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import type {
  AssignConfirmationTasksResult,
  ConfirmationAssignee,
  ConfirmationOutcome,
  ConfirmationQueueTab,
  ConfirmationTask,
} from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCaretRight, IconCelebrate, IconUser, IconUserAdd } from "@/components/icons";
import { BulkBar, ListSkeleton, type BulkAction } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { fmt } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { countOf, pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { BulkOutcomeDialog, type BulkOutcomeKind, type BulkOutcomeResult } from "./BulkOutcomeDialog";
import { DoneCard } from "./cards/DoneCard";
import { OpenCard } from "./cards/OpenCard";
import { WaitingCard } from "./cards/WaitingCard";
import { OUTCOME_ICON, isWaiting } from "./queueModel";
import { useQueueStrings } from "./queueStrings";

/** The part of the page's cursor list this view reads. */
export interface QueueListSource {
  items: ConfirmationTask[];
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/** What the viewer may do to several orders at once; with neither, the cards carry no tick box. */
export interface QueueBulkAbilities {
  /** Hand the selected orders to an agent, or take the assignment off them: a manager with a team. */
  assign: boolean;
  /** Accept or cancel every selected order: a role that both takes calls and manages orders. */
  outcome: boolean;
}

/**
 * The queue as a list: every task of the tab as a card — who and how much
 * first, then what was ordered, then what can be done to it — with the actions
 * on several orders at once in a bar that rises on selection, and "load more"
 * at the end. Selection lives here and starts empty whenever the tab or the
 * assignment filter changes (the page keys this component by them).
 *
 * Letting go of the selection (the bar's close button) only unticks the
 * cards: no request is made and no order leaves the list.
 */
export function QueueList({
  list,
  tab,
  now,
  team,
  bulk,
  onChanged,
  onResolved,
  onBulkAssigned,
  onBulkOutcome,
}: {
  list: QueueListSource;
  tab: ConfirmationQueueTab;
  now: number;
  /** Members a task may be handed to; empty unless the viewer manages a team. */
  team: ConfirmationAssignee[];
  bulk: QueueBulkAbilities;
  onChanged: (task: ConfirmationTask) => void;
  onResolved: (task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) => void;
  /** A bulk assignment went through: the page puts the changed tasks back in the list. */
  onBulkAssigned: (result: AssignConfirmationTasksResult) => void;
  /** "Accept / cancel all selected" ran: the page drops the orders whose result was saved. */
  onBulkOutcome: (result: BulkOutcomeResult) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useQueueStrings();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [outcomeKind, setOutcomeKind] = useState<BulkOutcomeKind | null>(null);

  const selectable = (bulk.assign || bulk.outcome) && tab !== "done";
  // The cards that carry a tick box: open ones the viewer could act on. An order still in its funnel's
  // offers window has no card to tick, so "select all" never counts it either.
  const tickable = useMemo(
    () => list.items.filter((task) => task.status !== "done" && !isWaiting(task, now)),
    [list.items, now]
  );
  // A task that left the list (saved, reloaded) leaves the selection with it.
  const selectedTasks = useMemo(() => tickable.filter((task) => selected.has(task.id)), [tickable, selected]);
  const selectedIds = useMemo(() => selectedTasks.map((task) => task.id), [selectedTasks]);
  const allShownSelected = tickable.length > 0 && selectedIds.length === tickable.length;
  const assignedCount = selectedTasks.filter((task) => task.assignedTo).length;

  function toggle(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  /** Unticks every card. Nothing else: the orders stay where they are and no request is made. */
  function clearSelection() {
    setSelected(new Set());
    setBulkError(null);
  }

  async function assignSelected(userId: string | null) {
    setBulkBusy(true);
    setBulkError(null);
    try {
      const result = await apiClient.assignConfirmationTasks(workspaceId, selectedIds, userId);
      onBulkAssigned(result);
      if (userId) {
        toast.success(
          fmt(t.bulkAssigned, { count: countOf("order", result.tasks.length), name: result.assignedTo?.fullName ?? "" })
        );
      } else {
        // The server answers with every open task it was sent, changed or not: say how many had an assignment to lose.
        toast.success(fmt(t.bulkUnassigned, { count: countOf("order", assignedCount) }));
      }
      const finished = result.skipped.filter((s) => s.code === "TASK_ALREADY_DONE").length;
      if (finished > 0) toast.success(fmt(t.bulkSkipped, { n: finished }));
      setSelected(new Set());
      setAssignOpen(false);
    } catch (err) {
      setBulkError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  function outcomeFinished(result: BulkOutcomeResult) {
    setSelected(new Set());
    onBulkOutcome(result);
  }

  const showBulk = selectable && tickable.length > 0;
  const actions: BulkAction[] = [];
  if (bulk.outcome) {
    actions.push(
      { id: "accept", label: t.bulkAccept, icon: OUTCOME_ICON.confirmed, onSelect: () => setOutcomeKind("accept") },
      {
        id: "cancel",
        label: t.bulkCancel,
        icon: OUTCOME_ICON.rejected,
        destructive: true,
        onSelect: () => setOutcomeKind("cancel"),
      }
    );
  }
  if (bulk.assign) {
    actions.push(
      { id: "assign", label: t.bulkAssign, icon: IconUserAdd, onSelect: () => setAssignOpen(true) },
      {
        id: "unassign",
        label: t.bulkUnassign,
        onSelect: () => void assignSelected(null),
        // Nothing to take off orders nobody was handed: pressing it would change nothing and still say "done".
        disabled: assignedCount === 0,
        disabledReason: t.bulkUnassignNone,
      }
    );
  }

  // Outside the list's own states: it must stay up while the list reloads after a run, and when the tab empties.
  const outcomeDialog = outcomeKind && (
    <BulkOutcomeDialog
      kind={outcomeKind}
      tasks={selectedTasks}
      now={now}
      onClose={() => setOutcomeKind(null)}
      onFinished={outcomeFinished}
    />
  );

  if (tab === "pending" && !list.loading && !list.error && list.items.length === 0) {
    return (
      <>
        <EmptyState
          tone="success"
          icon={<IconCelebrate aria-hidden />}
          title={t.emptyPending}
          description={t.answerNone}
          action={
            <Button variant="outline" asChild className="min-h-11 rounded-full px-5">
              <Link to="/orders">{t.emptyAction}</Link>
            </Button>
          }
        />
        {outcomeDialog}
      </>
    );
  }

  const emptyMessage = tab === "pending" ? t.emptyPending : tab === "in_progress" ? t.emptyInProgress : t.emptyDone;

  return (
    <>
      <DataState
        loading={list.loading}
        error={list.items.length === 0 ? list.error : null}
        empty={list.items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={list.reload}
        skeleton={<ListSkeleton variant="card" rows={4} />}
      >
        {showBulk && (
          <BulkBar
            count={selectedIds.length}
            label={pluralOf(t, "sel", selectedIds.length)}
            onClear={clearSelection}
            busy={bulkBusy}
            actions={actions}
            extra={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {allShownSelected ? (
                  <span>{t.allSelected}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(tickable.map((task) => task.id)))}
                    disabled={bulkBusy}
                    className="relative cursor-pointer rounded-sm font-semibold text-primary-dark underline-offset-4 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {fmt(t.selectAll, { n: tickable.length })}
                  </button>
                )}
                {bulkError && !assignOpen && (
                  <span role="alert" className="font-medium text-danger">
                    {bulkError}
                  </span>
                )}
              </span>
            }
          />
        )}

        <div className="space-y-3">
          {list.items.map((task) =>
            task.status === "done" ? (
              <DoneCard key={task.id} task={task} now={now} onChanged={onChanged} />
            ) : isWaiting(task, now) ? (
              <WaitingCard key={task.id} task={task} now={now} />
            ) : (
              <OpenCard
                key={task.id}
                task={task}
                team={team}
                now={now}
                selected={selectable ? selected.has(task.id) : undefined}
                onToggleSelected={() => toggle(task.id)}
                onChanged={onChanged}
                onResolved={onResolved}
              />
            )
          )}
        </div>
        {/* A page that failed to load after the first one: say so here, the cards above stay. */}
        {list.items.length > 0 && Boolean(list.error) && (
          <Alert variant="danger" className="mt-3">
            {errorMessage(list.error)}
          </Alert>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />

        {showBulk && bulk.assign && (
          <Sheet
            open={assignOpen}
            onOpenChange={(open) => {
              if (!bulkBusy) setAssignOpen(open);
            }}
            size="sm"
            title={fmt(t.bulkAssignTitle, { count: countOf("order", selectedIds.length) })}
            description={t.bulkAssignHint}
          >
            {bulkError && (
              <Alert variant="danger" className="mb-3">
                {bulkError}
              </Alert>
            )}
            <ul aria-label={t.bulkAgent} className="-mx-2 flex flex-col gap-1">
              {team.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void assignSelected(agent.id)}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[0.875rem] px-2 text-start transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:hover:bg-white/8"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark"
                    >
                      <IconUser className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        <bdi>{agent.fullName}</bdi>
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{agent.role.name}</span>
                    </span>
                    <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:rotate-180" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Sheet>
        )}
      </DataState>
      {outcomeDialog}
    </>
  );
}
