import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { apiErrorCode } from "@store-builder/api-client";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    empty: "Nothing here yet.",
    loading: "Loading…",
    permission: "You don't have permission to view this. Ask an owner to update your role.",
    retry: "Try again",
    seePlans: "See the plans",
  },
  ar: {
    empty: "لا يوجد شيء هنا بعد.",
    loading: "جارٍ التحميل…",
    permission: "ليست لديك صلاحية لعرض هذا. اطلب من المالك تحديث دورك.",
    retry: "حاول مرة أخرى",
    seePlans: "عرض الخطط",
  },
} satisfies Messages;

interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  /** Shown while loading in place of the spinner: placeholders in the shape of the content. */
  skeleton?: ReactNode;
  children: ReactNode;
}

// Five rows of different widths: a list, not a block.
const TABLE_ROWS = [
  ["w-2/5", "w-1/4", "w-14"],
  ["w-1/3", "w-1/5", "w-12"],
  ["w-1/2", "w-1/4", "w-16"],
  ["w-1/3", "w-1/6", "w-14"],
  ["w-2/5", "w-1/5", "w-12"],
];

/** A header line and five rows, for a page whose body is a list. */
export function TableSkeleton() {
  return (
    <div data-slot="skeleton-card" className="rounded-[var(--radius-card)] border border-line bg-card p-5">
      <div className="flex items-center gap-4 border-b border-line pb-3">
        <SkeletonBar className="h-2.5 w-1/4" />
        <SkeletonBar className="h-2.5 w-1/5" />
        <SkeletonBar className="ms-auto h-2.5 w-1/6" />
      </div>
      {TABLE_ROWS.map(([first, second, last], i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line py-3.5 last:border-0 last:pb-0">
          <SkeletonBar className={first} />
          <SkeletonBar className={second} />
          <SkeletonBar className={cn("ms-auto", last)} />
        </div>
      ))}
    </div>
  );
}

/** One grey bar of a loading placeholder; size it with `h-*` / `w-*`. */
export function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("relative h-3 animate-pulse overflow-hidden rounded-full bg-paper-sunken motion-reduce:animate-none", className)} />;
}

const SKELETON_CARD = "rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line";

// Line widths, in order, so a long card doesn't end in a block of equal lines.
const CARD_LINES = ["w-11/12", "w-4/5", "w-3/5", "w-5/6", "w-2/3", "w-3/4", "w-1/2"] as const;

/** A title line and a few lines of text (three by default). */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div data-slot="skeleton-card" className={cn(SKELETON_CARD, className)}>
      <SkeletonBar className="h-4 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar key={i} className={cn(i === 0 ? "mt-4" : "mt-3", CARD_LINES[i % CARD_LINES.length])} />
      ))}
    </div>
  );
}

const STATE_INK = {
  danger: "text-danger",
  attention: "text-accent-dark",
  neutral: "text-ink-soft",
} as const;

interface StateMessageProps {
  /** A 40px icon; its colour follows `tone`. */
  icon: ReactNode;
  /** What happened, in a few words. */
  title: string;
  /** Why, or what to do about it. */
  description?: string;
  /** The one way out (a 44px pill). Leave it out when there is none. */
  action?: ReactNode;
  tone?: keyof typeof STATE_INK;
  role?: "alert" | "status";
  className?: string;
}

/**
 * The pane a data region becomes when it has something to say instead of
 * content: nothing here yet, could not load. The icon, what happened, the
 * reason in words, the way out.
 */
export function StateMessage({ icon, title, description, action, tone = "neutral", role, className }: StateMessageProps) {
  return (
    <div
      role={role}
      data-slot="data-state"
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-card)] bg-paper-raised px-6 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-line",
        className
      )}
    >
      <span
        data-slot="state-icon"
        data-tone={tone}
        className={cn("relative isolate mb-4 flex size-10 shrink-0 items-center justify-center [&_svg]:size-10", STATE_INK[tone])}
      >
        {icon}
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && (
        <p data-slot="state-description" className="mt-1.5 max-w-md text-sm leading-6 text-ink-soft">
          {description}
        </p>
      )}
      {action && <div className="mt-5 [&_a]:min-h-11 [&_button]:min-h-11">{action}</div>}
    </div>
  );
}

/**
 * Standard loading / error / empty wrapper for a data region. Uses the shared
 * Spinner + Alert; permission (403) errors get their own copy.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage,
  onRetry,
  skeleton,
  children,
}: DataStateProps) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();

  if (loading && skeleton) return <>{skeleton}</>;

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[30vh] items-center justify-center text-ink-soft"
      >
        <Spinner className="size-6" role="presentation" aria-hidden="true" aria-label={undefined} />
        <span className="sr-only">{t.loading}</span>
      </div>
    );
  }

  // The store's plan lacks this feature (PLAN_FEATURE_ENFORCEMENT): an
  // upgrade prompt, not a permission problem and nothing to retry.
  if (error && apiErrorCode(error) === "PLAN_FEATURE_REQUIRED") {
    return (
      <Alert variant="info" className="flex flex-col gap-3">
        <span>{errorMessage(error)}</span>
        <div>
          <Button asChild size="sm" className="min-h-11">
            <Link to="/subscription">{t.seePlans}</Link>
          </Button>
        </div>
      </Alert>
    );
  }

  if (error) {
    const permission = isPermissionError(error);
    return (
      <Alert variant="danger" className="flex flex-col gap-3">
        <span>{permission ? t.permission : errorMessage(error)}</span>
        {onRetry && !permission && (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry} className="min-h-11">
              {t.retry}
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (empty) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
        {emptyMessage ?? t.empty}
      </div>
    );
  }

  return <>{children}</>;
}
