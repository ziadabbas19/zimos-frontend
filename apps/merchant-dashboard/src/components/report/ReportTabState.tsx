import type { ReactNode } from "react";
import { DataState, SkeletonBar, TableSkeleton } from "@/components/DataState";
import { ChartBones, KpiBones } from "./bones";

/**
 * A report tab while it loads, in the tab's own shape: a strip of four stat
 * cards, the chart's card, the table's card — the same boxes at about the same
 * heights, so the page does not jump when the numbers arrive. Bones only: the
 * "loading" announcement is made by whoever draws it (`ReportTabState`, the
 * hub's Suspense fallback).
 */
export function ReportTabSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      <KpiBones count={4} sparkline />
      <div
        data-slot="skeleton-card"
        className="rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line"
      >
        {/* The title line of ReportChartCard (24px), then its body: 220px on a phone, 280px from sm. */}
        <div className="flex h-6 items-center">
          <SkeletonBar className="h-3.5 w-40 max-w-[50%]" />
        </div>
        <div className="mt-3 h-[220px] sm:h-[280px]">
          <ChartBones />
        </div>
      </div>
      <TableSkeleton />
    </div>
  );
}

export interface ReportTabStateProps {
  /** True while the tab's MAIN request has nothing to show yet. */
  loading: boolean;
  /** What that request failed with, if it did. A 403 is "not for this role": a lock, and no retry. */
  error?: unknown;
  onRetry?: () => void;
  /** The tab's parts, drawn once there is data. */
  children: ReactNode;
}

/**
 * The gate around a tab's parts, for its main request:
 *
 * - loading → the tab-shaped skeleton (never the Z loader);
 * - a 403 → the dashboard's no-permission state (DataState's own: a lock, who
 *   to ask, no retry — trying again cannot grant a role);
 * - any other error → DataState's error with «جرّب تاني» when `onRetry` is given;
 * - otherwise the children, as direct children of the tab's column.
 *
 * A SECTION a role may not read is not this component's job: leave that part
 * out (`isPermissionError(error)` from `@/lib/errors`) and show the rest.
 */
export function ReportTabState({ loading, error, onRetry, children }: ReportTabStateProps) {
  return (
    <DataState
      loading={loading}
      error={error ?? null}
      // DataState hands the click event to its retry; a loader's `refresh` must not take it for options.
      onRetry={onRetry ? () => onRetry() : undefined}
      skeleton={<ReportTabSkeleton />}
    >
      {children}
    </DataState>
  );
}
