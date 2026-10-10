"use client";

import { useId } from "react";
import type { StorefrontSort } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { catalogHref, sortChoices, type CatalogState } from "@/lib/catalogQuery";
import { input } from "@/components/ui";
import { useCatalogNavigate } from "./useCatalogNavigate";

/**
 * How the listing is sorted. "Best match" is offered only while searching and
 * "Featured" (the merchant's own order) only inside a collection, where there
 * is an order to follow. While the new order loads the list dims (pending).
 */
export function SortSelect({ state, current }: { state: CatalogState; current: StorefrontSort }) {
  const { t } = useStore();
  const id = useId();
  const { go, pending } = useCatalogNavigate();
  const sorts = sortChoices(state);
  const value = sorts.includes(current) ? current : sorts[0];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-sm text-ink-soft">
        {t.catalog.sort}
      </label>
      <select
        id={id}
        value={value}
        aria-busy={pending}
        onChange={(e) => go(catalogHref(state, { sort: e.target.value as StorefrontSort }))}
        className={`${input} w-auto min-w-44 cursor-pointer py-2`}
      >
        {sorts.map((key) => (
          <option key={key} value={key}>
            {t.catalog[`sort_${key}`]}
          </option>
        ))}
      </select>
    </div>
  );
}
