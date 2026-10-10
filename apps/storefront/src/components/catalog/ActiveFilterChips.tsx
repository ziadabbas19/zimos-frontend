import type { StorefrontCollection } from "@store-builder/api-client";
import { CrossIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { focusRing } from "@/components/ui";
import { NO_FILTERS, activeFilterChips, catalogHref, type CatalogState, type FilterChip } from "@/lib/catalogQuery";
import type { Dictionary } from "@/lib/i18n";

/**
 * The filters in use, over the grid: one chip each, and each chip is a link
 * to the same list without that one filter (lib/catalogQuery activeFilterChips),
 * so taking a filter off is a page like any other, with Back to undo it.
 * "Clear all" at the end keeps the search and the sort. Nothing renders while
 * no filter is set.
 *
 * Part of the newer filter column (lib/features STORE_SIDEBAR_ENABLED); the
 * products page draws it only then.
 */
export function ActiveFilterChips({
  t,
  state,
  collections,
  collectionName,
}: {
  t: Dictionary;
  state: CatalogState;
  /** The store's collections, to name the chosen one. */
  collections: Array<Pick<StorefrontCollection, "id" | "slug" | "name">>;
  /** The chosen collection's name as the listing gave it, when it did. */
  collectionName?: string | null;
}) {
  const chips = activeFilterChips(state);
  if (chips.length === 0) return null;

  const label = (chip: FilterChip): string => {
    switch (chip.kind) {
      case "collection":
        return (
          collectionName ||
          collections.find((c) => c.slug === chip.value || c.id === chip.value)?.name ||
          chip.value
        );
      case "price":
        return t.catalog.priceChip(state.min, state.max);
      case "option":
        return t.catalog.optionChip(chip.name ?? "", chip.value);
      default:
        return chip.value;
    }
  };

  return (
    <ul aria-label={t.catalog.activeFilters} data-filter-chips="" className="mb-5 flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const text = label(chip);
        return (
          <li key={chip.key}>
            <StoreLink
              href={chip.href}
              scroll={false}
              aria-label={t.catalog.removeFilter(text)}
              className={`zt-chip inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-line bg-paper-raised ps-3.5 pe-2.5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary ${focusRing}`}
            >
              <span className="min-w-0 truncate">{text}</span>
              <CrossIcon size={14} className="shrink-0 text-ink-soft" aria-hidden />
            </StoreLink>
          </li>
        );
      })}
      <li>
        <StoreLink
          href={catalogHref(state, NO_FILTERS)}
          scroll={false}
          className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}
        >
          {t.catalog.clearAll}
        </StoreLink>
      </li>
    </ul>
  );
}
