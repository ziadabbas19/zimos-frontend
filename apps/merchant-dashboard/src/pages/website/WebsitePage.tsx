import { useState } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { Website } from "@store-builder/api-client";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@store-builder/ui";
import {
  IconMoreActions,
  IconRefresh,
  IconStoreSettings,
  IconTheme,
  IconWarning,
  type IconComponent,
} from "@/components/icons";
import { DataState, SkeletonBar } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeleteSiteDialog } from "./gallery/DeleteSiteDialog";
import { OtherSites } from "./gallery/OtherSites";
import { SiteHero } from "./gallery/SiteHero";
import { currentSiteOf, loadSiteFacts, type SiteFacts } from "./gallery/siteFacts";
import { StartSteps } from "./gallery/StartSteps";
import { StoreThemeRow, StoreThemeSheet } from "./gallery/StoreThemeRow";
import { TemplatesGallery } from "./gallery/TemplatesGallery";

const STRINGS = {
  en: {
    title: "Store editor",
    loading: "Loading…",
    sitesError: "We couldn't load your site.",
    retry: "Try again",
    tools: "More",
    settings: "Store settings",
    look: "Store look",
  },
  ar: {
    title: "الموقع",
    loading: "جارٍ التحميل…",
    sitesError: "تعذّر تحميل موقعك.",
    retry: "إعادة المحاولة",
    tools: "المزيد",
    settings: "إعدادات المتجر",
    look: "مظهر المتجر",
  },
} satisfies Messages;

/** What the page keeps of the site's one extra call, with the site it belongs to. */
interface FactsOf {
  siteId: string;
  facts: SiteFacts | null;
}

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const MENU_ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/**
 * «…» in the page header, while the page has no hero. First run keeps the page
 * to its three steps; what the hero offers a store that has a site — its
 * settings, its look — waits here, one tap away, so none of it is
 * lost before the first template is chosen (or while the sites cannot be loaded).
 */
function HeaderTools({ onLook }: { onLook: () => void }) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const navigate = useViewNavigate();
  const rows: Array<{ id: string; label: string; icon: IconComponent; onSelect: () => void }> = [
    { id: "settings", label: t.settings, icon: IconStoreSettings, onSelect: () => navigate("/store-settings") },
    { id: "look", label: t.look, icon: IconTheme, onSelect: onLook },
  ];
  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t.tools}
              title={t.tools}
              className="zimos-site-tool inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink-soft ring-1 ring-line transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:text-ink motion-reduce:transition-none motion-reduce:active:scale-100"
            />
          }
        >
          <IconMoreActions className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto min-w-52 rounded-[1.125rem] p-1.5">
          {rows.map((row) => {
            const RowIcon = row.icon;
            return (
              <DropdownMenuItem key={row.id} onClick={row.onSelect} className={MENU_ITEM}>
                <RowIcon className="size-[18px]" aria-hidden />
                <span className="min-w-0 flex-1">{row.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}

/** The hero while the store's sites are on their way: the same box, so nothing jumps when it arrives. */
function HeroSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden
        data-slot="skeleton-card"
        className="rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5"
      >
        <div className="flex gap-3.5 sm:gap-5">
          <div className="aspect-[3/4] w-24 shrink-0 animate-pulse rounded-2xl bg-paper-sunken motion-reduce:animate-none sm:w-36" />
          <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
            <SkeletonBar className="h-5 w-2/3" />
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="h-9 w-full sm:max-w-sm" />
          </div>
        </div>
        <div className="mt-3.5 flex h-[3.375rem] items-center gap-4 border-t border-line pt-2.5 sm:mt-5">
          <SkeletonBar className="w-20" />
          <SkeletonBar className="w-24" />
          <SkeletonBar className="w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * /website answers one question first: where is my store, and how do I edit
 * it? For a store with a site the first screen is the hero (SiteHero) — its
 * name, whether shoppers see it, its address, a picture of it and the one main
 * button, «عدّل المتجر» — then the store's look as one row, any other sites
 * folded into one row, and the templates as a short grid.
 *
 * A store with no site yet gets only the way in: three steps and the
 * templates. Choosing one makes the site and opens the editor on its
 * "brand it → publish" guide (`?start=1`).
 *
 * The sites and the templates load on their own: a failure of one never
 * hides the other, so a template can always be picked.
 */
export function WebsitePage() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  // Remembered for the session: coming back from the editor shows the page at once and refreshes behind.
  const sites = useCachedAsync<Website[]>(`website:sites:${workspaceId}`, () => apiClient.listWebsites(workspaceId), [workspaceId]);
  const list = sites.data ?? [];
  const current = currentSiteOf(list);
  const currentId = current?.id ?? null;
  // One more call for the current site — its pages, whether it has edits waiting, its home page to draw.
  // Never in the way: the hero stands on the list row until this arrives, and without it if it fails.
  const details = useCachedAsync<FactsOf | null>(
    currentId ? `website:facts:${workspaceId}:${currentId}` : null,
    () =>
      currentId
        ? loadSiteFacts(workspaceId, currentId).then(
            (facts): FactsOf => ({ siteId: currentId, facts }),
            (): FactsOf => ({ siteId: currentId, facts: null })
          )
        : Promise.resolve(null),
    [workspaceId, currentId]
  );
  const facts = details.data && details.data.siteId === currentId ? details.data.facts : null;

  const [pendingDelete, setPendingDelete] = useState<Website | null>(null);
  const [lookOpen, setLookOpen] = useState(false);

  // A remembered list stays on screen through a failed refresh; only a first load that failed has nothing to show.
  const failed = Boolean(sites.error) && sites.data === null;
  const firstRun = !sites.loading && !failed && list.length === 0;
  const others = current ? list.filter((site) => site.id !== current.id) : [];
  // No hero on the page (first run, or the sites could not be loaded): its ways out wait behind «…» in the header.
  const bare = firstRun || failed;

  // Resolving lets the confirmation close. Refetching (rather than filtering locally) also catches sites
  // deleted from another tab.
  async function afterDelete() {
    setPendingDelete(null);
    invalidateCached(`website:sites:${workspaceId}`);
    invalidateCached(`website:facts:${workspaceId}`);
    await sites.refresh({ silent: true });
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.title}
        actions={bare ? <HeaderTools onLook={() => setLookOpen(true)} /> : undefined}
      />

      {failed && isPermissionError(sites.error) ? (
        // Not this role's page: who can open it, and nothing to retry.
        <DataState loading={false} error={sites.error}>
          {null}
        </DataState>
      ) : (
        <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
          {sites.loading ? (
            <HeroSkeleton label={t.loading} />
          ) : failed ? (
            <div
              role="alert"
              data-slot="site-error"
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line"
            >
              <IconWarning className="size-5 shrink-0 text-danger" aria-hidden />
              <p className="min-w-0 flex-1 basis-48 text-sm leading-6 text-ink">
                <span className="font-semibold">{t.sitesError}</span>{" "}
                <span className="text-ink-soft">{errorMessage(sites.error)}</span>
              </p>
              <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => void sites.refresh()}>
                <IconRefresh className="size-4" aria-hidden />
                {t.retry}
              </Button>
            </div>
          ) : current ? (
            <>
              <SiteHero site={current} facts={facts} onDelete={() => setPendingDelete(current)} />
              <StoreThemeRow />
              <OtherSites sites={others} onDelete={setPendingDelete} />
            </>
          ) : (
            <StartSteps />
          )}

          <TemplatesGallery currentSite={current} headingHidden={firstRun} className={firstRun ? undefined : "mt-3"} />
        </div>
      )}

      {bare && <StoreThemeSheet open={lookOpen} onOpenChange={setLookOpen} />}
      <DeleteSiteDialog site={pendingDelete} onClose={() => setPendingDelete(null)} onDeleted={afterDelete} />
    </div>
  );
}
