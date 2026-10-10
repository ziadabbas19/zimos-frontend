"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { CatalogFilter, StorefrontCollection, StorefrontFacets } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { NO_FILTERS, activeFilterCount, catalogHref, sameListing, type CatalogState } from "@/lib/catalogQuery";
import { CrossIcon } from "@/components/Icons";
import { backdrop, bottomSheet, btnPrimary, btnSecondary, iconBtn, modalLayer } from "@/components/ui";
import { CatalogFilters } from "./CatalogFilters";
import { useCatalogNavigate } from "./useCatalogNavigate";

/**
 * The filters on a phone, the newer way (lib/features STORE_SIDEBAR_ENABLED;
 * FilterDrawer is the one a store has without it): a "Filter (n)" button
 * that raises a sheet from the bottom edge. What the shopper ticks inside is
 * a draft: the list behind does not move, and nothing is asked of the server,
 * until "Apply", which sends every choice in one go and starts the list again
 * from its first page. Closing the sheet any other way (the cross, the
 * backdrop, Escape) drops the draft.
 *
 * The counts beside each choice are the server's for the list as it stands,
 * so they do not follow the draft; the list itself is always the server's.
 * Hidden from `lg`, where the column beside the grid shows instead.
 */
export function FilterSheet({
  state,
  filters,
  facets,
  collections,
}: {
  state: CatalogState;
  filters: CatalogFilter[];
  facets: StorefrontFacets | undefined;
  collections: StorefrontCollection[];
}) {
  const { t } = useStore();
  const { go, pending } = useCatalogNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(state);
  // Moves when the draft is replaced from outside the fields (opened, cleared), so the typed prices follow it.
  const [resetKey, setResetKey] = useState(0);
  const dialogRef = useDialog<HTMLDivElement>({ open, onClose: () => setOpen(false) });
  const { present, shown } = useSheetPresence(open);
  const chosen = activeFilterCount(draft);

  function show() {
    // Always from what the list shows now, never from a draft left behind.
    setDraft(state);
    setResetKey((k) => k + 1);
    setOpen(true);
  }

  function clear() {
    setDraft({ ...draft, ...NO_FILTERS, page: 1 });
    setResetKey((k) => k + 1);
  }

  function apply() {
    // A range typed the wrong way round is read the right way round, as the column's own "Apply" does.
    const reversed = draft.min !== null && draft.max !== null && draft.min > draft.max;
    const next = reversed ? { ...draft, min: draft.max, max: draft.min } : draft;
    setOpen(false);
    // Nothing changed: the shopper stays where they were, page and all.
    if (sameListing(next, state)) return;
    go(catalogHref(next));
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={show}
        aria-expanded={open}
        aria-controls="store-filter-sheet"
        aria-busy={pending}
        className={btnSecondary}
      >
        {t.catalog.filterCount(activeFilterCount(state))}
      </button>
      {present &&
        createPortal(
          <div className={modalLayer}>
            <div className={backdrop(shown)} aria-hidden onClick={() => setOpen(false)} />
            <div
              ref={dialogRef}
              id="store-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-filter-title"
              aria-hidden={!open}
              inert={!open}
              data-filter-sheet="bottom"
              className={bottomSheet(shown)}
            >
              <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 pt-1 pb-3">
                <div className="min-w-0">
                  <h2 id="store-filter-title" className="font-display text-lg font-bold text-ink">
                    {t.catalog.filters}
                  </h2>
                  <p className="text-xs text-ink-soft" aria-live="polite">
                    {t.catalog.filtersChosen(chosen)}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close} className={iconBtn}>
                  <CrossIcon />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                <CatalogFilters
                  state={draft}
                  filters={filters}
                  facets={facets}
                  collections={collections}
                  idPrefix="sheet"
                  onPick={setDraft}
                  resetKey={resetKey}
                />
              </div>
              <div className="flex items-center gap-3 border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {chosen > 0 && (
                  <button type="button" onClick={clear} className={btnSecondary}>
                    {t.catalog.clearAll}
                  </button>
                )}
                <button type="button" onClick={apply} className={`${btnPrimary} flex-1 py-3.5 text-base`}>
                  {t.catalog.apply}
                </button>
              </div>
            </div>
          </div>,
          document.querySelector<HTMLElement>(".brand-theme") ?? document.body
        )}
    </div>
  );
}
