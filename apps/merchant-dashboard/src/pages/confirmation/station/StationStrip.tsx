import type { ConfirmationTask } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconTimer } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { fmt } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import type { LockState } from "../queueModel";
import { useQueueStrings } from "../queueStrings";
import { useStationStrings } from "./stationStrings";

export interface StationProgress {
  /** Results recorded in this sitting. */
  done: number;
  /** That, plus the calls still due. */
  total: number;
}

/** A small bead on the strip. Its tint and ink come from glass/confirm.css (`data-tone`). */
const BEAD =
  "zimos-station-chip inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs leading-none font-medium whitespace-nowrap";

/**
 * The line across the top of the station card: the sitting so far («٣ من ١٢»
 * and a thin bar that grows by transform alone), this order's number as the
 * way to its page, which attempt this is, and — while the viewer holds the
 * claim — how many minutes of it are left (amber in the last three).
 */
export function StationStrip({
  task,
  lock,
  progress,
}: {
  task: ConfirmationTask;
  lock: LockState;
  progress: StationProgress;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  const { order } = task;
  const ratio = progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;
  const claimLive = lock.mine && !lock.expired;
  const lockSoon = claimLive && lock.minutesLeft <= 3;
  const lockSentence = fmt(lockSoon ? q.lockSoon : q.yourClaim, { left: countOf("minute", lock.minutesLeft) });

  return (
    <div className="flex shrink-0 items-center gap-2">
      <p className="shrink-0 text-xs leading-6 font-medium text-ink-soft tabular-nums">
        <bdi>{fmt(t.progress, { done: progress.done, total: progress.total })}</bdi>
      </p>
      <div
        role="progressbar"
        aria-label={fmt(t.progressLabel, { done: progress.done, total: progress.total })}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        className="zimos-station-progress h-1 min-w-6 flex-1 overflow-hidden rounded-full bg-paper-sunken"
      >
        {/* Full width, scaled from the start edge: the bar grows without anything changing size. */}
        <span
          className="zimos-station-progress-fill block h-full w-full rounded-full bg-primary transition-transform duration-[var(--dur-move)] ease-[var(--ease-out)] [transform-origin:0_50%] motion-reduce:transition-none rtl:[transform-origin:100%_50%]"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <ViewLink
        to={`/orders/${order.id}`}
        aria-label={fmt(t.openOrderNumber, { order: order.orderNumber })}
        className="relative shrink-0 rounded-sm text-xs leading-6 font-medium text-ink-soft underline-offset-4 before:absolute before:-inset-x-2 before:-inset-y-2.5 before:content-[''] hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <bdi dir="ltr">{order.orderNumber}</bdi>
      </ViewLink>
      {task.attemptCount > 0 && (
        <span data-tone="warn" className={cn(BEAD, "bg-accent-soft text-accent-dark")}>
          {fmt(t.attempt, { n: task.attemptCount + 1 })}
        </span>
      )}
      {claimLive && (
        <span
          role={lockSoon ? "status" : undefined}
          title={lockSentence}
          data-tone={lockSoon ? "warn" : "neutral"}
          className={cn(BEAD, "tabular-nums", lockSoon ? "bg-accent-soft text-accent-dark" : "bg-paper-sunken text-ink-soft")}
        >
          <IconTimer className="size-3.5" aria-hidden />
          <span aria-hidden>{fmt(t.lockShort, { n: lock.minutesLeft })}</span>
          <span className="sr-only">{lockSentence}</span>
        </span>
      )}
    </div>
  );
}
