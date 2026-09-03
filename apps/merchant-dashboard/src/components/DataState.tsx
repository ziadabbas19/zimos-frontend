import type { ReactNode } from "react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { getErrorMessage, isPermissionError } from "@/lib/errors";

interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Standard loading / error / empty wrapper for a data region. Uses the shared
 * Spinner + Alert; permission (403) errors get their own copy.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
  onRetry,
  children,
}: DataStateProps) {
  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-ink-soft">
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
            ? "You don't have permission to view this. Ask an owner to update your role."
            : getErrorMessage(error)}
        </span>
        {onRetry && !permission && (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (empty) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
