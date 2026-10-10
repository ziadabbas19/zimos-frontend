"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { CatalogFilter, StorefrontCollection, StorefrontFacets, StorefrontSort } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnSecondary, focusRing, input } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { catalogHref, sortChoices, toggle, toggleOption, type CatalogState } from "@/lib/catalogQuery";
import { useCatalogNavigate } from "./useCatalogNavigate";

/**
 * The listing's filters, in the order the merchant chose in the dashboard
 * (settings.storefront_catalog.filters): the collection tree, a price range,
 * tags and product options. Each change goes straight into the URL, so the
 * page, the counts and the back button all follow it.
 *
 * The same component is the desktop sidebar and the body of the phone's
 * filter sheet (FilterDrawer); `idPrefix` keeps their ids apart.
 *
 * Two additions for the newer filter column (lib/features STORE_SIDEBAR_ENABLED),
 * both absent unless asked for: `sort` puts the sort first, as one more block;
 * `onPick` makes every choice a change to a draft the caller holds (the
 * phone's FilterSheet), so nothing is asked of the server until "Apply".
 */

const groupTitle = "text-sm font-semibold text-ink";
const countBadge = "ms-auto shrink-0 text-xs tabular-nums text-ink-soft";
const checkRow = `flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-ink hover:bg-primary-soft/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`;

type Change = (patch: Partial<CatalogState>) => void;

interface Props {
  state: CatalogState;
  filters: CatalogFilter[];
  facets: StorefrontFacets | undefined;
  collections: StorefrontCollection[];
  idPrefix: string;
  /** The sort as the first block; `current` is the order the list is in now. */
  sort?: { current: StorefrontSort };
  /** Staged: called with the state a choice leads to, instead of going there. */
  onPick?: (next: CatalogState) => void;
  /** Staged: a new value starts the price fields again from `state` (the draft was reset). */
  resetKey?: number;
}

export function CatalogFilters({ state, filters, facets, collections, idPrefix, sort, onPick, resetKey = 0 }: Props) {
  const { go } = useCatalogNavigate();
  if (!facets) return null;
  const staged = onPick !== undefined;
  // Any change but a page turn starts again from page 1, in the URL and in a draft alike.
  const change: Change = (patch) => (onPick ? onPick({ ...state, ...patch, page: 1 }) : go(catalogHref(state, patch)));

  // "options" shows every option not already placed on its own.
  const named = new Set(filters.flatMap((f) => (f.key === "option" ? [f.name] : [])));
  const groups = filters.flatMap((filter, index) => {
    const key = `${filter.key}-${index}`;
    switch (filter.key) {
      case "collections":
        return collections.length > 0
          ? [<CollectionGroup key={key} state={state} facets={facets} collections={collections} onPick={staged ? change : undefined} />]
          : [];
      case "price":
        // Keyed on the applied range, so the inputs follow a change made elsewhere (clear all, back button).
        // A draft is typed into, so there the key only moves when the draft is reset.
        return facets.price.max !== null
          ? [
              <PriceGroup
                key={staged ? `${key}-draft-${resetKey}` : `${key}-${state.min}-${state.max}`}
                state={state}
                facets={facets}
                idPrefix={idPrefix}
                staged={staged}
                onApply={change}
              />,
            ]
          : [];
      case "tags":
        return facets.tags.length > 0 ? [<TagGroup key={key} state={state} facets={facets} onChange={change} />] : [];
      case "options":
        return facets.options
          .filter((o) => !named.has(o.name))
          .map((o) => <OptionGroup key={`${key}-${o.name}`} state={state} option={o} onChange={change} />);
      case "option": {
        const option = facets.options.find((o) => o.name === filter.name);
        return option ? [<OptionGroup key={key} state={state} option={option} onChange={change} />] : [];
      }
      default:
        return [];
    }
  });

  return (
    <div className="space-y-6">
      {sort && <SortGroup state={state} current={sort.current} idPrefix={idPrefix} onChange={change} />}
      {groups}
    </div>
  );
}

/** The sort as a list of choices, for the filter column (the header keeps a select, SortSelect). */
function SortGroup({
  state,
  current,
  idPrefix,
  onChange,
}: {
  state: CatalogState;
  current: StorefrontSort;
  idPrefix: string;
  onChange: Change;
}) {
  const { t } = useStore();
  const sorts = sortChoices(state);
  const value = sorts.includes(current) ? current : sorts[0];
  return (
    <fieldset className="space-y-1">
      <legend className={`${groupTitle} mb-1`}>{t.catalog.sort}</legend>
      {sorts.map((key) => (
        <label key={key} className={checkRow}>
          <input
            type="radio"
            name={`${idPrefix}-sort`}
            className="size-4 shrink-0 accent-[var(--color-primary)]"
            checked={value === key}
            onChange={() => onChange({ sort: key })}
          />
          <span className="min-w-0 truncate">{t.catalog[`sort_${key}`]}</span>
        </label>
      ))}
    </fieldset>
  );
}

function CollectionGroup({
  state,
  facets,
  collections,
  onPick,
}: {
  state: CatalogState;
  facets: StorefrontFacets;
  collections: StorefrontCollection[];
  /** Staged: a collection is a button that changes the draft, not a link. */
  onPick?: Change;
}) {
  const { t } = useStore();
  const headingId = useId();
  const counts = new Map(facets.collections.map((c) => [c.id, c.count]));
  const children = new Map<string | null, StorefrontCollection[]>();
  for (const c of collections) {
    const parent = c.parentId ?? null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(c);
  }
  const selected = state.collection;

  const link = (active: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors ${focusRing} ${
      active ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-primary-soft/50 hover:text-primary"
    }`;

  // One row of the tree: a link that goes there, or (staged) a button that notes the choice.
  const row = (collection: string | null, active: boolean, content: ReactNode) =>
    onPick ? (
      <button
        type="button"
        onClick={() => onPick({ collection })}
        aria-pressed={active}
        className={`${link(active)} w-full cursor-pointer text-start`}
      >
        {content}
      </button>
    ) : (
      <StoreLink
        href={catalogHref(state, { collection })}
        className={link(active)}
        aria-current={active ? "page" : undefined}
        scroll={false}
      >
        {content}
      </StoreLink>
    );

  const render = (parentId: string | null, depth: number) => {
    const list = (children.get(parentId) ?? []).filter(
      (c) => (counts.get(c.id) ?? 0) > 0 || c.slug === selected || c.id === selected
    );
    if (list.length === 0) return null;
    return (
      <ul className={depth > 0 ? "ms-3 border-s border-line ps-2" : "space-y-0.5"}>
        {list.map((c) => {
          const active = c.slug === selected || c.id === selected;
          return (
            <li key={c.id}>
              {row(
                c.slug,
                active,
                <>
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className={countBadge}>{counts.get(c.id) ?? 0}</span>
                </>
              )}
              {depth < 2 && render(c.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <nav aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className={groupTitle}>
        {t.catalog.collections}
      </h2>
      {row(null, !selected, t.catalog.allCollections)}
      {render(null, 0)}
    </nav>
  );
}

function PriceGroup({
  state,
  facets,
  idPrefix,
  staged,
  onApply,
}: {
  state: CatalogState;
  facets: StorefrontFacets;
  idPrefix: string;
  /** Each keystroke goes to the draft and the group has no button of its own: the sheet's "Apply" covers it. */
  staged: boolean;
  onApply: Change;
}) {
  const { t } = useStore();
  const [min, setMin] = useState(state.min === null ? "" : String(state.min));
  const [max, setMax] = useState(state.max === null ? "" : String(state.max));
  const floor = facets.price.min !== null ? Math.floor(facets.price.min / 100) : undefined;
  const ceiling = facets.price.max !== null ? Math.ceil(facets.price.max / 100) : undefined;
  const read = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));

  function submit(e: FormEvent) {
    e.preventDefault();
    // Staged: Enter in a field must not send anything; the values are already in the draft.
    if (staged) return;
    let low = read(min);
    let high = read(max);
    if (low !== null && high !== null && low > high) [low, high] = [high, low];
    onApply({ min: low, max: high });
  }

  function typed(which: "min" | "max", value: string) {
    if (which === "min") setMin(value);
    else setMax(value);
    // The draft keeps what was typed as it stands; the sheet puts a reversed range right when it applies.
    if (staged) onApply({ min: read(which === "min" ? value : min), max: read(which === "max" ? value : max) });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <fieldset className="space-y-2">
        <legend className={groupTitle}>{t.catalog.price}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-ink-soft" htmlFor={`${idPrefix}-min`}>
            {t.catalog.priceFrom}
            <input
              id={`${idPrefix}-min`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              dir="ltr"
              value={min}
              placeholder={floor !== undefined ? String(floor) : undefined}
              onChange={(e) => typed("min", e.target.value)}
              className={`${input} mt-1`}
            />
          </label>
          <label className="block text-xs text-ink-soft" htmlFor={`${idPrefix}-max`}>
            {t.catalog.priceTo}
            <input
              id={`${idPrefix}-max`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              dir="ltr"
              value={max}
              placeholder={ceiling !== undefined ? String(ceiling) : undefined}
              onChange={(e) => typed("max", e.target.value)}
              className={`${input} mt-1`}
            />
          </label>
        </div>
      </fieldset>
      {!staged && (
        <button type="submit" className={`${btnSecondary} w-full`}>
          {t.catalog.apply}
        </button>
      )}
    </form>
  );
}

function TagGroup({
  state,
  facets,
  onChange,
}: {
  state: CatalogState;
  facets: StorefrontFacets;
  onChange: Change;
}) {
  const { t } = useStore();
  return (
    <fieldset className="space-y-1">
      <legend className={`${groupTitle} mb-1`}>{t.catalog.tags}</legend>
      {facets.tags.map((tag) => (
        <label key={tag.value} className={checkRow}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--color-primary)]"
            checked={state.tags.includes(tag.value)}
            onChange={() => onChange({ tags: toggle(state.tags, tag.value) })}
          />
          <span className="min-w-0 truncate">{tag.value}</span>
          <span className={countBadge}>{tag.count}</span>
        </label>
      ))}
    </fieldset>
  );
}

function OptionGroup({
  state,
  option,
  onChange,
}: {
  state: CatalogState;
  option: StorefrontFacets["options"][number];
  onChange: Change;
}) {
  const chosen = state.options[option.name] ?? [];
  return (
    <fieldset className="space-y-1">
      <legend className={`${groupTitle} mb-1`}>{option.name}</legend>
      {option.values.map((v) => (
        <label key={v.value} className={checkRow}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--color-primary)]"
            checked={chosen.includes(v.value)}
            onChange={() => onChange({ options: toggleOption(state.options, option.name, v.value) })}
          />
          <span className="min-w-0 truncate">{v.value}</span>
          <span className={countBadge}>{v.count}</span>
        </label>
      ))}
    </fieldset>
  );
}
