import type { ReactNode } from "react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    empty: "Nothing here yet.",
    loading: "Loading…",
    permission: "You don't have permission to view this. Ask an owner to update your role.",
    retry: "Try again",
  },
  ar: {
    empty: "لا يوجد شيء هنا بعد.",
    loading: "جارٍ التحميل…",
    permission: "ليست لديك صلاحية لعرض هذا. اطلب من المالك تحديث دورك.",
    retry: "حاول مرة أخرى",
  },
} satisfies Messages;

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
  emptyMessage,
  onRetry,
  children,
}: DataStateProps) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();

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
