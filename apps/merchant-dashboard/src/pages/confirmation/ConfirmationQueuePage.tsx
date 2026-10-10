import { useState } from "react";
import {
  isInvalidCursorError,
  type AssignConfirmationTasksResult,
  type ConfirmationAssignee,
  type ConfirmationOutcome,
  type ConfirmationQueueSort,
  type ConfirmationQueueTab,
  type ConfirmationTask,
} from "@store-builder/api-client";
import { ChipRow, ListToolbar } from "@/components/list";
import { useToast } from "@/components/Toast";
import { fmt } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { CONFIRMATION_STATION_ENABLED } from "@/lib/features";
import { useListSort } from "@/lib/listSort";
import { countOf, pluralOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { withViewTransition } from "@/lib/viewTransition";
import { refreshWorkCounts } from "@/lib/workCounts";
import type { BulkOutcomeResult } from "./BulkOutcomeDialog";
import { CorrectOutcomeModal } from "./cards/CorrectOutcomeModal";
import { useNow } from "./confirmationRoles";
import { ActiveFilterChips, QueueFilterSheet, useAssignmentLabel, type ActiveFilterChip } from "./QueueFilters";
import { QueueHeader } from "./QueueHeader";
import { QueueList } from "./QueueList";
import {
  PAGE_SIZE,
  QUEUE_SORTS,
  SORT_STORAGE_KEY,
  readStoredView,
  storeView,
  useQueueAbilities,
  type AssignmentFilter,
  type QueueView,
} from "./queueModel";
import { useOutcomeLabels, useQueueStrings } from "./queueStrings";
import { Station } from "./station/Station";

/**
 * The confirmation queue: the calls a cash-on-delivery store makes before it
 * ships. Three tabs (waiting, in progress, done); on the waiting tab a role
 * that takes calls works them one at a time in the calling station
 * (station/Station.tsx), or switches to the list, which is also what every
 * other tab and role sees (QueueList.tsx).
 *
 * This file loads the data and owns what both views share: the counts, the
 * cursor list of the tab, the sort and assignment filter, and what happens to
 * a task after the server answered — put back in place, or taken out with a
 * toast when its result was saved.
 */
export function ConfirmationQueuePage() {
  const workspaceId = useWorkspaceId();
  const t = useQueueStrings();
  const toast = useToast();
  const outcomeLabel = useOutcomeLabels();
  const { userId, canConfirm, canManage } = useQueueAbilities();
  // One clock for the page: waiting funnel orders turn workable, lock countdowns and ages move together.
  const now = useNow(30_000);
  const [tab, setTab] = useState<ConfirmationQueueTab>("pending");
  const [assignment, setAssignment] = useState<AssignmentFilter>("all");
  // "Queue order" is each tab's own order (due callbacks first on Pending),
  // as the queue has always been; the rest sort on the server by the order.
  const [sort, setSort] = useListSort<ConfirmationQueueSort>(SORT_STORAGE_KEY, QUEUE_SORTS, "default");
  const [view, setViewState] = useState<QueueView>(readStoredView);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Results recorded in this visit, in either view: the station's progress and its closing line.
  const [session, setSession] = useState({ done: 0, confirmed: 0 });
  // A result saved a moment ago that a manager chose to correct from its toast.
  const [correcting, setCorrecting] = useState<ConfirmationTask | null>(null);

  // The counts are kept for the session, so the tabs show their figures at once on the way back in.
  const counts = useCachedAsync(
    `confirmation-counts:${workspaceId}`,
    () => apiClient.getConfirmationQueueCounts(workspaceId),
    [workspaceId]
  );
  // Only a manager assigns, so only a manager needs the team.
  const assignees = useAsync(
    () => (canManage ? apiClient.listConfirmationAssignees(workspaceId) : Promise.resolve([] as ConfirmationAssignee[])),
    [workspaceId, canManage]
  );
  const list = useCursorList<ConfirmationTask>(
    async (cursor) => {
      const page = await apiClient.listConfirmationQueue(workspaceId, {
        status: tab,
        cursor,
        limit: PAGE_SIZE,
        sort,
        ...(assignment === "all" ? {} : { assignedTo: assignment }),
      });
      return { items: page.tasks, nextCursor: page.nextCursor };
    },
    [workspaceId, tab, sort, assignment],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  // The list includes the manager. A store with nobody else on it has no one
  // to hand a call to, so it gets no assignment controls at all; a request
  // that failed says nothing about the team, so there they stay.
  const members = assignees.data ?? [];
  const hasOthers = members.some((agent) => agent.id !== userId);
  const team = hasOthers ? members : [];
  const assigning = canManage && (hasOthers || Boolean(assignees.error));
  // An agent keeps the filter for "Assigned to me".
  const showAssignment = !canManage || assigning;
  // Several orders at once. Handing them out needs a team; accepting or cancelling them all is for a role
  // that both takes calls and manages orders (the owner, among the roles the dashboard knows).
  const bulk = { assign: assigning, outcome: canConfirm && canManage };
  const assignmentLabel = useAssignmentLabel(team);

  // The station is for a role that takes calls, on the calls that wait; everyone and everything else gets the list.
  // Behind its switch: with it off the queue is the list for everyone, as it always was.
  const canSwitch = CONFIRMATION_STATION_ENABLED && canConfirm && tab === "pending";
  const stationOn = canSwitch && view === "station";

  function changeView(next: QueueView) {
    storeView(next);
    withViewTransition(() => setViewState(next));
  }

  function refreshCounts() {
    void counts.refresh({ silent: true });
  }

  // A task that changed in place (claimed, released, assigned, corrected) keeps its
  // spot until the next load, so the card an agent is working doesn't jump.
  function replaceTask(updated: ConfirmationTask) {
    list.setItems((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    refreshCounts();
  }

  // A task left the tab (its result was saved, or it was finished elsewhere): the side menu's and the
  // dock's "calls due" follow at once, not on their next minute.
  function dropTask(taskId: string) {
    list.setItems((prev) => prev.filter((task) => task.id !== taskId));
    refreshCounts();
    refreshWorkCounts();
  }

  function bulkAssigned(result: AssignConfirmationTasksResult) {
    const byId = new Map(result.tasks.map((task) => [task.id, task]));
    list.setItems((prev) => prev.map((task) => byId.get(task.id) ?? task));
    refreshCounts();
  }

  // A result was saved, in the station or in the list: the task leaves the tab, the sitting counts it,
  // and a toast says so — with the way to correct it while the order can still take a correction.
  function outcomeSaved(task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) {
    dropTask(task.id);
    setSession((prev) => ({ done: prev.done + 1, confirmed: prev.confirmed + (outcome === "confirmed" ? 1 : 0) }));
    // Arabic has no letter case, so lowercasing is a no-op there.
    const message = fmt(t.toastMarked, { order: task.order.orderNumber, outcome: outcomeLabel[outcome].toLowerCase() });
    if (canManage && saved.status === "done" && saved.correctable) {
      toast.notify("success", message, { action: { label: t.correct, onClick: () => setCorrecting(saved) }, duration: 8000 });
    } else {
      toast.success(message);
    }
  }

  // The list's "Save & next": the next order slides into view with its button focused.
  function resolvedInList(task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) {
    const index = Array.from(document.querySelectorAll<HTMLElement>("[data-task-card]")).findIndex(
      (el) => el.dataset.taskCard === task.id
    );
    outcomeSaved(task, saved, outcome);
    requestAnimationFrame(() => {
      const next = document.querySelectorAll<HTMLElement>("[data-task-card]")[Math.max(0, index)];
      if (!next) return;
      next.scrollIntoView({ behavior: "smooth", block: "start" });
      next.querySelector<HTMLElement>("[data-next-action]")?.focus({ preventScroll: true });
    });
  }

  // "Accept / cancel all selected" ran: the orders whose result was saved leave the tab and count toward the
  // sitting. One left as it was may have changed under us (a teammate took it, it was finished elsewhere),
  // so the tab is read again instead of showing what it used to be.
  function bulkOutcomeDone(result: BulkOutcomeResult) {
    const gone = new Set(result.saved.map(({ task }) => task.id));
    if (gone.size > 0) {
      list.setItems((prev) => prev.filter((task) => !gone.has(task.id)));
      setSession((prev) => ({
        done: prev.done + gone.size,
        confirmed: prev.confirmed + (result.kind === "accept" ? gone.size : 0),
      }));
    }
    if (result.failed.length > 0) list.reload();
    refreshCounts();
    refreshWorkCounts();
  }

  // The header answers "how much is left?".
  const c = counts.data;
  const queueAnswer = !c
    ? null
    : c.pending === 0 && c.inProgressMine === 0
      ? t.answerNone
      : [
          c.pending > 0 ? pluralOf(t, "answer", c.pending) : null,
          c.pendingDue > 0 && c.pendingDue < c.pending ? fmt(t.answerDue, { n: c.pendingDue }) : null,
          c.inProgressMine > 0 ? fmt(t.answerMine, { n: c.inProgressMine }) : null,
        ]
          .filter(Boolean)
          .join(" · ");

  // While the counts are on their way a chip holds the place of its figure; if they cannot be read it has none.
  const figure = (value: number | undefined) => value ?? (counts.loading ? 0 : null);

  const activeChips: ActiveFilterChip[] = [];
  if (showAssignment && assignment !== "all") {
    activeChips.push({ id: "assignment", label: assignmentLabel(assignment), onRemove: () => setAssignment("all") });
  }
  if (sort !== "default") {
    activeChips.push({ id: "sort", label: fmt(t.sortChip, { label: t[`sort_${sort}`] }), onRemove: () => setSort("default") });
  }

  function resetFilters() {
    setAssignment("all");
    if (sort !== "default") setSort("default");
  }

  return (
    <div className="max-w-3xl">
      <QueueHeader description={queueAnswer ?? t.description} view={canSwitch ? view : null} onViewChange={changeView} />

      <div className="flex items-center gap-2">
        <ChipRow<ConfirmationQueueTab>
          label={t.tabsLabel}
          value={tab}
          onChange={setTab}
          // Three fixed tabs: an empty one stays where it is.
          collapseEmpty={false}
          countsLoading={counts.loading}
          // The row scrolls off the start edge of a phone; at its end the Filters button holds its place.
          className="min-w-0 flex-1 max-sm:mx-0 max-sm:-ms-4"
          items={[
            { value: "pending", label: t.tabPending, count: figure(c?.pending), tone: "attention" },
            { value: "in_progress", label: t.tabInProgress, count: figure(c?.inProgress) },
            { value: "done", label: t.tabDone, count: figure(c?.done) },
          ]}
        />
        <ListToolbar className="shrink-0" filters={{ count: activeChips.length, onOpen: () => setFiltersOpen(true) }} />
      </div>

      {/* In the station the Filters button carries the count; the row of chips would push the order down a phone. */}
      {!stationOn && <ActiveFilterChips chips={activeChips} onClear={resetFilters} />}

      <div className="mt-2 sm:mt-4">
        {stationOn ? (
          <Station
            list={list}
            now={now}
            counts={c}
            session={session}
            filtersActive={showAssignment && assignment !== "all"}
            onClearFilters={() => setAssignment("all")}
            onRefresh={() => {
              list.reload();
              refreshCounts();
              refreshWorkCounts();
            }}
            onShowList={() => changeView("list")}
            onChanged={replaceTask}
            onDrop={dropTask}
            onOutcomeSaved={outcomeSaved}
          />
        ) : (
          <QueueList
            // A new tab or a new assignment filter is a new list: the selection starts empty.
            key={`${tab}:${assignment}`}
            list={list}
            tab={tab}
            now={now}
            team={team}
            bulk={bulk}
            onChanged={replaceTask}
            onResolved={resolvedInList}
            onBulkAssigned={bulkAssigned}
            onBulkOutcome={bulkOutcomeDone}
          />
        )}
      </div>

      <QueueFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        sort={sort}
        onSortChange={setSort}
        assignment={assignment}
        onAssignmentChange={setAssignment}
        showAssignment={showAssignment}
        team={canManage ? team : []}
        activeCount={activeChips.length}
        onReset={resetFilters}
        applyLabel={
          list.loading || list.hasMore ? t.showAll : fmt(t.showCount, { count: countOf("order", list.items.length) })
        }
      />

      {correcting && (
        <CorrectOutcomeModal
          task={correcting}
          onClose={() => setCorrecting(null)}
          onCorrected={(updated) => {
            setCorrecting(null);
            replaceTask(updated);
          }}
        />
      )}
    </div>
  );
}
