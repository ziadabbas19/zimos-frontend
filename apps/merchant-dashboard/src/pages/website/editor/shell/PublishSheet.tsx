import { useEffect, useMemo, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { websiteRevisionsList, type PublishProblem, type Website, type WebsitePage } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { IconHome, IconPage, IconSpinner } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { pluralOf } from "@/lib/plural";
import { useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";
import { localPublishProblems, pageChange } from "./treeTools";

/**
 * How many pages the live version holds. Only the published-versions list
 * says it; it is asked for when the sheet opens, and if that fails the line
 * about deleted pages is simply left out.
 */
function useLivePageCount(active: boolean, workspaceId: string, website: Website | null): number | null {
  const [known, setKnown] = useState<{ revisionId: string; pages: number } | null>(null);
  const websiteId = website?.id ?? null;
  const revisionId = website?.publishedRevisionId ?? null;
  useEffect(() => {
    if (!active || !websiteId || !revisionId) return undefined;
    let current = true;
    websiteRevisionsList(apiClient, workspaceId, websiteId)
      .then((rows) => {
        if (!current) return;
        const row = rows.find((r) => r.id === revisionId);
        setKnown(row ? { revisionId, pages: row.pageCount } : null);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [active, workspaceId, websiteId, revisionId]);
  return known && known.revisionId === revisionId ? known.pages : null;
}

/**
 * "Publish" opens this instead of publishing at once: it says what will change,
 * what stands in the way, and holds the one button that does it.
 *
 * What will change is read off the pages themselves: the API keeps, beside
 * every draft, a copy of what is live (`publishedData`), so a page is "edited"
 * when the two differ and "new" when it has never been live. Pages deleted
 * since the last publish are counted against the live version's page count.
 * A changed search title is in neither tree, hence the small print.
 *
 * Publish needs the draft stored first; the page does that when the sheet
 * opens (`checking`) and again when the button is pressed.
 */
export function PublishSheet({
  open,
  onOpenChange,
  workspaceId,
  website,
  pages,
  checking,
  publishing,
  error,
  problems,
  lookDirty,
  savingLook,
  onSaveLook,
  onPublish,
  onOpenPage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  website: Website | null;
  pages: WebsitePage[];
  /** The last changes are still being stored. */
  checking: boolean;
  publishing: boolean;
  /** One message when the server refused without a list. */
  error: string | null;
  /** The server's own list (one per offending page), after a refused publish. */
  problems: PublishProblem[];
  lookDirty: boolean;
  savingLook: boolean;
  onSaveLook: () => void;
  onPublish: () => void;
  onOpenPage: (pageId: string) => void;
}) {
  const t = useT(SHELL_STRINGS);
  const livePageCount = useLivePageCount(open, workspaceId, website);

  const local = useMemo(() => (open ? localPublishProblems(pages) : []), [open, pages]);
  const changes = useMemo(
    () => (open ? pages.map((page) => ({ page, change: pageChange(page) })).filter((row) => row.change !== "same") : []),
    [open, pages]
  );
  const firstPublish = !website?.publishedRevisionId;
  const removed =
    livePageCount === null ? 0 : Math.max(0, livePageCount - pages.filter((page) => page.publishedData != null).length);
  const blocked = publishing || checking || local.length > 0 || !website;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!publishing) onOpenChange(next);
      }}
      title={t.publishTitle}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={publishing} onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button type="button" className="rounded-full px-5" disabled={blocked} onClick={onPublish}>
            {publishing ? t.publishing : t.publishNow}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {checking ? (
          <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
            <IconSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
            {t.checking}
          </p>
        ) : firstPublish ? (
          <p className="text-sm leading-6 text-ink">
            {t.publishFirst} <span className="text-ink-soft">({pluralOf(t, "pages", pages.length)})</span>
          </p>
        ) : changes.length === 0 && removed === 0 ? (
          <p className="text-sm leading-6 text-ink">{t.publishNothing}</p>
        ) : (
          <section>
            <h3 className="text-xs font-semibold text-ink-soft">{t.publishWhat}</h3>
            <ul className="mt-2 space-y-1">
              {changes.map(({ page, change }) => {
                const PageIcon = page.pageType === "home" ? IconHome : IconPage;
                return (
                  <li key={page.id} className="flex min-h-11 items-center gap-2.5 rounded-[0.875rem] bg-paper-sunken px-2.5 py-1.5">
                    <PageIcon className="size-4 shrink-0 text-ink-soft" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{page.title}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        <bdi dir="ltr">{page.path}</bdi>
                      </span>
                    </span>
                    <StatusBadge
                      value={change}
                      text={change === "new" ? t.pageNew : t.pageChanged}
                      tone={change === "new" ? "info" : "warning"}
                    />
                  </li>
                );
              })}
            </ul>
            {removed > 0 && <p className="mt-2 text-sm text-ink">{pluralOf(t, "removedPages", removed)}</p>}
          </section>
        )}

        {lookDirty && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.875rem] bg-accent-soft px-3 py-2.5">
            <p className="min-w-0 flex-1 basis-48 text-sm text-ink">{t.lookPending}</p>
            <Button type="button" variant="secondary" size="sm" className="rounded-full px-3" disabled={savingLook} onClick={onSaveLook}>
              {savingLook ? t.lookSaving : t.lookSave}
            </Button>
          </div>
        )}

        {local.length > 0 && (
          <section role="alert" className="rounded-[0.875rem] bg-danger-soft px-3 py-2.5">
            <h3 className="text-sm font-semibold text-danger">{t.problemsTitle}</h3>
            <ul className="mt-1.5 space-y-1.5">
              {local.map((problem) => (
                <li key={problem.page?.id ?? problem.kind} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-ink">
                  <span className="min-w-0 flex-1 basis-48">
                    {problem.page && (
                      <span className="font-medium">
                        {problem.page.title}
                        {": "}
                      </span>
                    )}
                    {problem.kind === "no-home" ? t.problemNoHome : t.problemEmpty}
                  </span>
                  {problem.page && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full px-3"
                      onClick={() => problem.page && onOpenPage(problem.page.id)}
                    >
                      {t.openPage}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {problems.length > 0 && (
          <Alert variant="danger">
            <p className="font-medium">{t.problemsTitle}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {problems.map((problem, i) => (
                <li key={`${problem.pageId ?? problem.field}-${i}`}>
                  {problem.path && (
                    <span className="font-medium">
                      <bdi dir="ltr">{problem.path}</bdi>
                      {": "}
                    </span>
                  )}
                  {problem.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        <p className="text-xs leading-5 text-ink-soft">
          {t.publishAll} {t.publishSeoNote}
        </p>
      </div>
    </Sheet>
  );
}
