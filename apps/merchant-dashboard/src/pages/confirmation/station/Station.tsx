import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Alert } from "@store-builder/ui";
import {
  isApiErrorCode,
  type ConfirmationOutcome,
  type ConfirmationQueueCounts,
  type ConfirmationTask,
} from "@store-builder/api-client";
import { DataState, SkeletonBar } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { fmt, useLocale } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { PAGE_SIZE, isBookedForLater, isStationTask, isWaiting, useQueueAbilities } from "../queueModel";
import type { QueueListSource } from "../QueueList";
import { useQueueStrings } from "../queueStrings";
import { StationCard } from "./StationCard";
import { StationFinished } from "./StationFinished";
import { useStationStrings } from "./stationStrings";

/** How long the card that left stays in the page to slide away: --dur-move plus a frame or two. */
const LEAVE_MS = 360;
/** With this many orders left in hand, the next page of the queue is fetched. */
const FETCH_AHEAD = 3;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Tells the card where it starts on the page (`--station-top`), so on a phone
 * it can end exactly above the dock whatever sits over it — a banner, the
 * install prompt. Read from the layout, not from the painted box: the page's
 * own entrance moves the box for a moment and must not shorten the card.
 */
function useStationTop(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return undefined;
    const measure = () => {
      let top = 0;
      let node: HTMLElement | null = stage;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
      }
      stage.style.setProperty("--station-top", `${Math.round(top)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [ref]);
}

/** The card while the queue (or its next page) is on the way: the same pane, the same blocks. */
function StationSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="zimos-station mx-auto flex w-full max-w-[40rem] flex-col rounded-[1.75rem] bg-paper-raised px-4 pt-3.5 pb-4 shadow-[var(--shadow-raised)] ring-1 ring-line max-sm:h-[calc(100dvh_-_var(--station-top,11.5rem)_-_4.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))] max-sm:min-h-[26rem] sm:px-6 sm:pt-5 sm:pb-6"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex min-h-0 flex-1 flex-col">
        <SkeletonBar className="h-1 w-full" />
        <div className="mt-5 flex items-center justify-between gap-4">
          <SkeletonBar className="h-5 w-2/5" />
          <SkeletonBar className="h-5 w-1/4" />
        </div>
        <SkeletonBar className="mt-3 h-6 w-1/3" />
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBar className="size-9 shrink-0 rounded-[0.625rem]" />
              <SkeletonBar className={i === 0 ? "w-1/2" : "w-2/5"} />
              <SkeletonBar className="ms-auto w-8 shrink-0" />
            </div>
          ))}
        </div>
        <SkeletonBar className="mt-6 h-7 w-1/3" />
        <SkeletonBar className="mt-3 w-3/5" />
        <div className="mt-auto grid grid-cols-6 gap-2 pt-6">
          <SkeletonBar className="col-span-3 h-14" />
          <SkeletonBar className="col-span-3 h-14" />
          <SkeletonBar className="col-span-6 h-14" />
          <SkeletonBar className="col-span-2 h-14 rounded-[1.25rem]" />
          <SkeletonBar className="col-span-2 h-14 rounded-[1.25rem]" />
          <SkeletonBar className="col-span-2 h-14 rounded-[1.25rem]" />
        </div>
      </div>
    </div>
  );
}

/**
 * The calling station: the queue's due orders, ONE at a time. A view over the
 * same list the list view shows — same order, same filters, same handlers —
 * that puts the first workable order on screen and, after a result, slides to
 * the next (fetching the next page of the queue when three are left).
 *
 * "Workable" is what the list's Claim button means (../queueModel.ts,
 * `isStationTask`): due now, nobody else on it, not handed to another agent.
 * An order that was skipped waits until the others are done, then comes round
 * again; one a teammate got to first is left out for the rest of the visit.
 */
export function Station({
  list,
  now,
  counts,
  session,
  filtersActive,
  onClearFilters,
  onRefresh,
  onShowList,
  onChanged,
  onDrop,
  onOutcomeSaved,
}: {
  list: QueueListSource;
  /** The page's clock. */
  now: number;
  counts: ConfirmationQueueCounts | null;
  /** Results recorded in this visit, in either view. */
  session: { done: number; confirmed: number };
  filtersActive: boolean;
  onClearFilters: () => void;
  onRefresh: () => void;
  onShowList: () => void;
  /** A task changed in place (claimed, released). */
  onChanged: (task: ConfirmationTask) => void;
  /** A task no longer belongs in this list (finished elsewhere). */
  onDrop: (taskId: string) => void;
  /** A result was saved: the page takes the task out of the list, counts it and says so. */
  onOutcomeSaved: (task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) => void;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { dir } = useLocale();
  const { userId, canManage } = useQueueAbilities();
  const workspaceId = useWorkspaceId();
  const stageRef = useRef<HTMLDivElement>(null);
  useStationTop(stageRef);

  // The calls the viewer already holds — claimed a moment before the page was reloaded (a phone often
  // reloads it on the way back from the dialer), or from the list. They are not on the waiting tab any
  // more, and they come first: the result of a call just made is recorded on its own order.
  const held = useAsync(
    () =>
      apiClient
        .listConfirmationQueue(workspaceId, { status: "in_progress", mine: true, limit: PAGE_SIZE })
        .then((page) => page.tasks),
    [workspaceId]
  );
  const heldData = held.data;
  const setHeld = held.setData;

  // Skipped: back of the line. Gone: a teammate's now, or finished — not shown again this visit.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  // The order on screen stays on screen: a callback that comes due mid-call must not take its place.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [moves, setMoves] = useState(0);
  const [leaving, setLeaving] = useState<{ task: ConfirmationTask; key: string } | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // One line: the held calls, then the tab in its own order. A task that is in both is the tab's.
  const pool = useMemo(() => {
    const inTab = new Set(list.items.map((task) => task.id));
    return [...(heldData ?? []).filter((task) => !inTab.has(task.id)), ...list.items];
  }, [heldData, list.items]);
  const eligible = useMemo(
    () => pool.filter((task) => !gone.has(task.id) && isStationTask(task, now, userId, canManage)),
    [pool, gone, now, userId, canManage]
  );
  const fresh = useMemo(() => eligible.filter((task) => !skipped.has(task.id)), [eligible, skipped]);
  const everyPageLoaded = !list.hasMore && !list.loadingMore;
  // Only skipped orders are left and there is nothing more to fetch: they come round again.
  const wrapped = fresh.length === 0 && eligible.length > 0 && everyPageLoaded;
  const queue = wrapped ? eligible : fresh;
  const current = (pinnedId ? queue.find((task) => task.id === pinnedId) : undefined) ?? queue[0] ?? null;
  const currentId = current?.id ?? null;
  const cardKey = current ? `${current.id}:${moves}` : "";

  const { loadingMore, hasMore, error, loadMore } = list;
  // The first card waits for both answers, so a held call never arrives to push another order off the screen.
  const loading = list.loading || held.loading;

  // Nothing is pinned while the queue is still arriving: the first order shown is the first of the whole line.
  useEffect(() => {
    if (!loading && currentId !== pinnedId) setPinnedId(currentId);
  }, [loading, currentId, pinnedId]);

  useEffect(() => {
    if (wrapped && skipped.size > 0) setSkipped(new Set());
  }, [wrapped, skipped]);

  // The next page of the queue is asked for while there are still a few orders in hand. A page that
  // failed is not asked for again by itself: the finished state offers the refresh.
  const inHand = fresh.length;
  useEffect(() => {
    if (loading || loadingMore || !hasMore || error) return;
    if (inHand <= FETCH_AHEAD) loadMore();
    // `loadMore` is a new function on every render of the page; the values it reads are the ones listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inHand, loading, loadingMore, hasMore, error]);

  function advance(from: ConfirmationTask) {
    window.clearTimeout(leaveTimer.current);
    if (prefersReducedMotion()) {
      setLeaving(null);
    } else {
      // The same key it had as the current card, so it is the same card that slides away — not a copy.
      setLeaving({ task: from, key: `${from.id}:${moves}` });
      leaveTimer.current = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    }
    setMoves((n) => n + 1);
    setPinnedId(null);
  }

  function handleChanged(updated: ConfirmationTask) {
    const mine = updated.status === "in_progress" && updated.lockedByUserId === userId;
    setHeld((prev) => {
      const others = (prev ?? []).filter((task) => task.id !== updated.id);
      // Claimed here: on the server it has left the waiting tab, so the station keeps hold of it itself —
      // a reload of the tab (a new sort, a refresh) must not take the call off the screen. Let go of, it is
      // the tab's again.
      return mine ? [...others, updated] : others;
    });
    onChanged(updated);
  }

  function forgetHeld(taskId: string) {
    setHeld((prev) => (prev ?? []).filter((task) => task.id !== taskId));
  }

  function handleSaved(task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) {
    advance(task);
    forgetHeld(task.id);
    onOutcomeSaved(task, saved, outcome);
  }

  function handleSkip(task: ConfirmationTask) {
    setSkipped((prev) => new Set(prev).add(task.id));
    advance(task);
  }

  function handleGone(task: ConfirmationTask, message: string, err: unknown) {
    toast.error(message);
    setGone((prev) => new Set(prev).add(task.id));
    advance(task);
    // Finished elsewhere: it is not a pending task any more, in either view.
    if (isApiErrorCode(err, "TASK_ALREADY_DONE")) {
      forgetHeld(task.id);
      onDrop(task.id);
    }
  }

  // The sitting's progress: what was recorded, over that plus what is still due. With the whole queue
  // loaded the station counts its own orders; while pages remain, the store's count of calls due stands in.
  const dueByCount = counts ? counts.pendingDue + counts.inProgressMine : 0;
  const stillDue = list.hasMore ? Math.max(eligible.length, dueByCount) : eligible.length;
  const progress = { done: session.done, total: session.done + stillDue };

  const later = list.items.filter((task) => isBookedForLater(task, now));
  const nearestLaterAt = later.reduce<string | null>((nearest, task) => {
    const at = task.nextRetryAt;
    if (!at) return nearest;
    return nearest === null || new Date(at).getTime() < new Date(nearest).getTime() ? at : nearest;
  }, null);
  const waitingCount = list.items.filter((task) => isWaiting(task, now)).length;
  const othersOnCalls = counts ? Math.max(0, counts.inProgress - counts.inProgressMine) : 0;

  const name = current?.order.contactSnapshot.fullName?.trim() || q.unnamedCustomer;
  const noop = () => undefined;

  // The card on screen, and — for the length of the slide — the one that just left. One keyed list, so the
  // card that leaves is the very card that was there, not a copy of it.
  const showCurrent = !loading && current !== null;
  const cards: Array<{ key: string; task: ConfirmationTask; frozen: boolean }> = [];
  if (leaving) cards.push({ key: leaving.key, task: leaving.task, frozen: true });
  if (showCurrent && current) cards.push({ key: cardKey, task: current, frozen: false });

  let rest: ReactNode = null;
  if (loading) {
    rest = <StationSkeleton label={t.loadingNext} />;
  } else if (current) {
    rest = null;
  } else if (error && list.items.length === 0) {
    rest = (
      <DataState loading={false} error={error} onRetry={list.reload}>
        {null}
      </DataState>
    );
  } else if (loadingMore || (hasMore && !error)) {
    rest = <StationSkeleton label={t.loadingNext} />;
  } else {
    rest = (
      <>
        {Boolean(error) && (
          <Alert variant="danger" className="mx-auto mb-3 max-w-[40rem]">
            {errorMessage(error)}
          </Alert>
        )}
        <StationFinished
          done={session.done}
          confirmed={session.confirmed}
          laterCount={later.length}
          nearestLaterAt={nearestLaterAt}
          waitingCount={waitingCount}
          othersOnCalls={othersOnCalls}
          hasList={list.items.length > 0}
          filtersActive={filtersActive}
          onClearFilters={onClearFilters}
          onRefresh={onRefresh}
          onShowList={onShowList}
        />
      </>
    );
  }

  return (
    <section aria-label={t.stationLabel} className="max-sm:-mb-7">
      {/* A screen reader hears who is next; the eye sees the card slide in. */}
      <p className="sr-only" aria-live="polite">
        {moves > 0 && current ? fmt(t.nextUp, { name }) : ""}
      </p>
      <div
        ref={stageRef}
        data-slot="station-stage"
        // The way the cards travel follows the reading direction: out toward the start edge, in from the end edge.
        style={{ "--station-dir": dir === "rtl" ? -1 : 1 } as CSSProperties}
        // The stage runs 1rem past the column on both sides and clips there: a card in mid-slide never
        // widens the page, and the shadow of the card at rest is not cut.
        className="relative -mx-4 overflow-x-clip px-4"
      >
        {cards.map((card) => (
          // The one that left lies over the stage, out of the flow, while it slides away.
          <div key={card.key} className={card.frozen ? "pointer-events-none absolute start-4 end-4 top-0" : undefined}>
            <StationCard
              task={card.task}
              now={now}
              progress={progress}
              frozen={card.frozen}
              entering={moves > 0}
              onChanged={card.frozen ? noop : handleChanged}
              onSaved={card.frozen ? noop : handleSaved}
              onSkip={card.frozen ? noop : handleSkip}
              onGone={card.frozen ? noop : handleGone}
            />
          </div>
        ))}
        {rest}
      </div>
    </section>
  );
}
