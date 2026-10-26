import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Alert, Button, ListSkeleton as SharedListSkeleton, Spinner, type ListSkeletonProps } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { getErrorMessage, isPermissionError } from "@/lib/errors";

const STRINGS = {
  en: { loading: "Loading…" },
  ar: { loading: "جارٍ التحميل…" },
} satisfies Messages;

interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  /** Shown while loading in place of the spinner: placeholders in the shape of the content (a list: ListSkeleton). */
  skeleton?: ReactNode;
  children: ReactNode;
}

/**
 * Standard loading / error / empty wrapper for a data region, in the merchant
 * dashboard's shapes (its components/DataState.tsx and EmptyState.tsx): the
 * spinner in the middle of the region, the error as an alert with a way to
 * try again, and "nothing here" as a pane with an icon tile.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
  emptyAction,
  onRetry,
  skeleton,
  children,
}: DataStateProps) {
  if (loading && skeleton) return <>{skeleton}</>;

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[30vh] items-center justify-center text-ink-soft">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    const permission = isPermissionError(error);
    return (
      <Alert variant="danger" className="flex flex-col gap-3">
        <span>
          {permission
            ? "Your admin role doesn't have permission to view this."
            : getErrorMessage(error)}
        </span>
        {onRetry && !permission && (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry} className="min-h-11">
              Try again
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (empty) {
    return <EmptyBlock message={emptyMessage} action={emptyAction} />;
  }

  return <>{children}</>;
}

/**
 * A table while its first page loads: the dashboard's one list skeleton
 * (@store-builder/ui), its rows as tall as the real ones, announced in the
 * console's language.
 */
export function ListSkeleton(props: Omit<ListSkeletonProps, "label">) {
  const t = useT(STRINGS);
  return <SharedListSkeleton {...props} label={t.loading} />;
}

export function EmptyBlock({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary [&>svg]:size-6">
        <Inbox aria-hidden />
      </div>
      <p className="max-w-md text-base font-semibold text-ink">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
