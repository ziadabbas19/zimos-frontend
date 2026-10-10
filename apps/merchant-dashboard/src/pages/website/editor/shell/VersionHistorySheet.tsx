import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { websiteRevisionsList, websiteRevisionsRollback, type WebsiteRevisionRow } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { pluralOf } from "@/lib/plural";
import { useAuth } from "@/context/AuthContext";
import { IconRotateBack } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";

/**
 * "Published versions": every publish keeps a version, and any of them can be
 * put back in front of shoppers.
 *
 * It is exactly what the API offers, said plainly: the list is of PUBLISHED
 * versions (there is no history of drafts), and restoring one changes what
 * shoppers see — it does not change the draft being edited, and it does not
 * bring back the store look, which is not part of a version. The question
 * before a restore says so in those words.
 */
export function VersionHistorySheet({
  open,
  onOpenChange,
  workspaceId,
  websiteId,
  liveRevisionId,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  websiteId: string;
  /** The version shoppers see now. */
  liveRevisionId: string | null;
  /** After a restore went through: what is live changed on the server. */
  onRestored: () => void | Promise<void>;
}) {
  const t = useT(SHELL_STRINGS);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.historyTitle} description={t.historyHint} size="md">
      {open && (
        <VersionList workspaceId={workspaceId} websiteId={websiteId} liveRevisionId={liveRevisionId} onRestored={onRestored} />
      )}
    </Sheet>
  );
}

function VersionList({
  workspaceId,
  websiteId,
  liveRevisionId,
  onRestored,
}: {
  workspaceId: string;
  websiteId: string;
  liveRevisionId: string | null;
  onRestored: () => void | Promise<void>;
}) {
  const t = useT(SHELL_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { user } = useAuth();
  const list = useAsync(() => websiteRevisionsList(apiClient, workspaceId, websiteId), [workspaceId, websiteId]);
  /** The version whose "restore?" question is open. */
  const [askingId, setAskingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The answer names the live version before the site's own reload lands.
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const liveId = restoredId ?? liveRevisionId;

  async function restore(row: WebsiteRevisionRow) {
    setBusyId(row.id);
    setError(null);
    try {
      const result = await websiteRevisionsRollback(apiClient, workspaceId, websiteId, row.id);
      setRestoredId(result.rolledBackTo.id);
      setAskingId(null);
      toast.success(fmt(t.restored, { n: row.revisionNumber }));
      await onRestored();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const rows = list.data ?? [];
  return (
    <DataState
      loading={list.loading}
      error={list.error}
      empty={rows.length === 0}
      emptyMessage={t.historyEmpty}
      onRetry={() => void list.refresh()}
    >
      <ol className="space-y-2">
        {rows.map((row) => {
          const live = row.id === liveId;
          const asking = askingId === row.id;
          const busy = busyId === row.id;
          return (
            <li key={row.id} data-live={live || undefined} className="rounded-[1rem] bg-paper-sunken px-3 py-2.5 ring-1 ring-line ring-inset">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1 basis-44">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
                    {fmt(t.revision, { n: row.revisionNumber })}
                    {live && <StatusBadge value="published" text={t.liveNow} tone="success" />}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                    <span title={formatDateTime(row.createdAt)}>{formatRelativeTime(row.createdAt)}</span>
                    <span aria-hidden> · </span>
                    {formatDateTime(row.createdAt)}
                  </p>
                  <p className="text-xs leading-5 text-ink-soft">
                    {pluralOf(t, "pages", row.pageCount)}
                    <span aria-hidden> · </span>
                    {user && row.publishedByUserId === user.id ? t.byYou : t.byTeam}
                  </p>
                  {row.note && (
                    <p dir="auto" className="mt-1 text-xs leading-5 text-ink">
                      {row.note}
                    </p>
                  )}
                </div>
                {!live && !asking && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3"
                    disabled={busyId !== null}
                    onClick={() => {
                      setError(null);
                      setAskingId(row.id);
                    }}
                  >
                    <IconRotateBack className="size-4" aria-hidden />
                    {t.restore}
                  </Button>
                )}
              </div>

              {asking && (
                <div role="alertdialog" aria-label={fmt(t.restoreTitle, { n: row.revisionNumber })} className="mt-2.5 border-t border-line pt-2.5">
                  <p className="text-sm font-semibold text-ink">{fmt(t.restoreTitle, { n: row.revisionNumber })}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{t.restoreBody}</p>
                  {error && (
                    <Alert variant="danger" className="mt-2">
                      {error}
                    </Alert>
                  )}
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="rounded-full px-4" disabled={busy} onClick={() => setAskingId(null)}>
                      {t.keep}
                    </Button>
                    <Button type="button" variant="secondary" className="rounded-full px-4" disabled={busy} onClick={() => void restore(row)}>
                      {busy ? t.restoring : t.restoreConfirm}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </DataState>
  );
}
