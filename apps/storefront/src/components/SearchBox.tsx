"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import type { StorefrontSuggestions } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { useStoreBasePath } from "./StoreRoute";
import { CrossIcon, SearchIcon } from "./Icons";
import { focusRing, iconBtn } from "./ui";

/**
 * The header's product search: suggestions while the shopper types (GET
 * /store/:id/products/suggest — collections and products, eight at most),
 * and Enter for the full results page (/products?q=…).
 *
 * It follows the ARIA combobox pattern: the input owns a listbox of options;
 * ↑/↓ move through them (the active one is announced through
 * aria-activedescendant, focus never leaves the input), Enter opens the
 * active option or searches, Escape closes the list and then clears the
 * field. Requests wait for a pause in typing (DEBOUNCE_MS) and a newer
 * keystroke cancels an older request, so a fast typist sends few.
 *
 * From `md` the field sits in the header; on a phone a search button opens it
 * as a full-width row under the header.
 */

const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;

interface Option {
  id: string;
  href: string;
  kind: "collection" | "product" | "all";
  label: string;
  price?: string | null;
  imageUrl?: string | null;
}

function useSuggestions(workspaceId: string, query: string) {
  const [data, setData] = useState<StorefrontSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if ([...q].length < MIN_CHARS) {
      const reset = window.setTimeout(() => {
        setData(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      createStorefrontApiClient()
        .suggestStorefrontProducts(workspaceId, q, { signal: controller.signal })
        .then((result) => setData(result))
        .catch(() => {
          if (!controller.signal.aborted) setData(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [workspaceId, query]);
  return { data, loading };
}

/** The field with its suggestions, as wide as what holds it: the header's (SearchBox below) and the side navigation's. */
export function SearchCombobox({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const { t, money } = useStore();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const basePath = useStoreBasePath();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-list`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { data, loading } = useSuggestions(workspaceId, query);

  const q = query.trim();
  const options: Option[] = [];
  if (data && data.query === q) {
    for (const c of data.collections) {
      options.push({ id: `${baseId}-c-${c.id}`, kind: "collection", label: c.name, imageUrl: c.imageUrl, href: `/products?collection=${encodeURIComponent(c.slug)}` });
    }
    for (const p of data.products) {
      options.push({
        id: `${baseId}-p-${p.id}`,
        kind: "product",
        label: p.name,
        imageUrl: p.imageUrl,
        price: p.priceAmount !== null ? money(p.priceAmount, p.currency ?? undefined) : null,
        href: `/products/${encodeURIComponent(p.slug)}`,
      });
    }
  }
  if (q) options.push({ id: `${baseId}-all`, kind: "all", label: t.catalog.seeAll(q), href: `/products?q=${encodeURIComponent(q)}` });
  const expanded = open && [...q].length >= MIN_CHARS && options.length > 0;
  const activeOption = expanded && active >= 0 ? options[active] : undefined;

  function goTo(href: string) {
    setOpen(false);
    setActive(-1);
    onDone?.();
    router.push(storeHref(basePath, href));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (activeOption) goTo(activeOption.href);
    else if (q) goTo(`/products?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!expanded) {
        setOpen(true);
        return;
      }
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        if (current === -1) return step === 1 ? 0 : options.length - 1;
        return (current + step + options.length) % options.length;
      });
    } else if (e.key === "Escape") {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        e.preventDefault();
        setQuery("");
      } else {
        onDone?.();
      }
    } else if (e.key === "Home" || e.key === "End") {
      // The caret keeps these keys; they only move the option while one is active.
      if (activeOption) {
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : options.length - 1);
      }
    }
  }

  const collections = options.filter((o) => o.kind === "collection");
  const products = options.filter((o) => o.kind === "product");
  const indexOf = (option: Option) => options.indexOf(option);

  const row = (option: Option) => (
    <li
      key={option.id}
      id={option.id}
      role="option"
      aria-selected={option === activeOption}
      // mousedown, not click: the input must keep focus until we navigate.
      onMouseDown={(e) => {
        e.preventDefault();
        goTo(option.href);
      }}
      onMouseMove={() => setActive(indexOf(option))}
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${
        option === activeOption ? "bg-primary-soft text-primary" : "text-ink"
      }`}
    >
      {option.kind !== "all" &&
        (option.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={option.imageUrl} alt="" className="size-9 shrink-0 rounded-md border border-line object-cover" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper text-ink-soft" aria-hidden>
            <SearchIcon size={14} />
          </span>
        ))}
      <span className={`min-w-0 flex-1 truncate ${option.kind === "all" ? "font-medium" : ""}`}>{option.label}</span>
      {option.price && <span className="shrink-0 text-xs font-semibold text-ink-soft">{option.price}</span>}
    </li>
  );

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={`${baseId}-input`} className="sr-only">
        {t.catalog.search}
      </label>
      <div className="zt-input flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-paper-raised ps-3 pe-1 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <SearchIcon size={18} className="shrink-0 text-ink-soft" aria-hidden />
        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={activeOption?.id}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={query}
          placeholder={t.catalog.searchPlaceholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden"
        />
        <button type="submit" className={`${iconBtn} size-9 border-0`} aria-label={t.catalog.searchSubmit}>
          <SearchIcon size={16} aria-hidden />
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {expanded && !loading ? t.catalog.suggestionsCount(collections.length + products.length) : ""}
      </p>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={t.catalog.suggestions}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-paper-raised p-2 shadow-xl"
      >
        {collections.length > 0 && (
          <li role="presentation">
            <p id={`${baseId}-gc`} className="px-2 pb-1 pt-1 text-xs font-semibold text-ink-soft">
              {t.catalog.suggestedCollections}
            </p>
            <ul role="group" aria-labelledby={`${baseId}-gc`}>
              {collections.map(row)}
            </ul>
          </li>
        )}
        {products.length > 0 && (
          <li role="presentation">
            <p id={`${baseId}-gp`} className="px-2 pb-1 pt-2 text-xs font-semibold text-ink-soft">
              {t.catalog.suggestedProducts}
            </p>
            <ul role="group" aria-labelledby={`${baseId}-gp`}>
              {products.map(row)}
            </ul>
          </li>
        )}
        {data && data.query === q && collections.length + products.length === 0 && (
          <li role="presentation" className="px-2 py-2 text-sm text-ink-soft">
            {t.catalog.noSuggestions}
          </li>
        )}
        <li role="presentation" className="mt-1 border-t border-line pt-1">
          <ul role="group">{options.filter((o) => o.kind === "all").map(row)}</ul>
        </li>
      </ul>
    </form>
  );
}

export function SearchBox() {
  const { t } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="zt-search-inline hidden w-56 md:block lg:w-72">
        <SearchCombobox />
      </div>
      <div className="zt-search-toggle md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t.catalog.closeSearch : t.catalog.openSearch}
          className={`${iconBtn} ${focusRing}`}
        >
          {open ? <CrossIcon /> : <SearchIcon />}
        </button>
        {open && (
          <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-paper-raised px-4 py-3 shadow-md">
            <SearchCombobox autoFocus onDone={() => setOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
}
