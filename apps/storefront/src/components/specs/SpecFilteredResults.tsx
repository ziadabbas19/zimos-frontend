"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  storefrontSpecFilters,
  storefrontSpecProducts,
  type StorefrontProduct,
  type StorefrontSpecFilter,
} from "@store-builder/api-client";
import { ProductCard } from "@/components/ProductCard";
import { btnSecondary, focusRing, skeleton } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText, type Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { SPEC_TEXT, specName, specValue } from "./specText";
import { StoreButtonLoader } from "@/components/StoreLoader";

/**
 * The product listing's specification filters. Around
 * the listing's own results: when the store has filterable specifications (in
 * this collection), a panel of them — each value a checkbox with how many
 * products have it — and, once something is ticked, the matching products in
 * place of the listing below (GET /specs/products: any of one specification's
 * values, and every specification chosen). Nothing is added to a store that
 * has no filterable specification.
 *
 * The choice rides in the URL as `?spec=<keyId>:<value>` so a filtered page
 * can be reloaded or shared; it is written with the History API, so ticking a
 * box does not ask the server for the page again.
 */

const PARAM = "spec";
const PAGE_SIZE = 24;

type Chosen = Array<{ keyId: string; value: string }>;

function readChosen(params: URLSearchParams): Chosen {
  return params
    .getAll(PARAM)
    .map((raw) => ({ keyId: raw.slice(0, raw.indexOf(":")), value: raw.slice(raw.indexOf(":") + 1) }))
    .filter((f) => /^[0-9a-f-]{36}$/i.test(f.keyId) && f.value !== "");
}

export function SpecFilteredResults({
  workspaceId,
  collectionId,
  currency,
  locale,
  disabled = false,
  children,
}: {
  workspaceId: string;
  /** The collection the listing is showing, when it is one. */
  collectionId: string | null;
  currency: string;
  locale: Locale;
  /** A search's results: the specification filters cannot be combined with a query, so they stay out. */
  disabled?: boolean;
  /** The listing's own results and pagination. */
  children: ReactNode;
}) {
  const text = pickText(SPEC_TEXT, locale);
  const uid = useId();
  const { intlLocale } = useStore();
  // Our client reads the shopper's language itself; a new one when the language changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => createStorefrontApiClient(), [locale]);
  const count = (n: number) => new Intl.NumberFormat(intlLocale).format(n);

  const [filters, setFilters] = useState<StorefrontSpecFilter[]>([]);
  const [chosen, setChosen] = useState<Chosen>([]);
  const [open, setOpen] = useState(false);
  // The address decides: read once the page is there (so the server's HTML and the first render
  // agree), and again whenever it changes — a sort or a page link leaves the filters behind.
  const urlKey = (useSearchParams()?.getAll(PARAM) ?? []).join("|");
  useEffect(() => {
    if (disabled) return;
    const fromUrl = readChosen(new URLSearchParams(window.location.search));
    setChosen(fromUrl);
    if (fromUrl.length > 0) setOpen(true);
  }, [disabled, urlKey]);
  const chosenKey = chosen.map((f) => `${f.keyId}:${f.value}`).sort().join("|");
  const [results, setResults] = useState<{ key: string; products: StorefrontProduct[]; total: number; page: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (disabled) return;
    let alive = true;
    storefrontSpecFilters(client, workspaceId, collectionId)
      .then((list) => {
        if (alive) setFilters(list);
      })
      .catch(() => {
        /* no panel: the listing is as it was */
      });
    return () => {
      alive = false;
    };
  }, [client, workspaceId, collectionId, disabled]);

  useEffect(() => {
    if (disabled || chosen.length === 0) return;
    let alive = true;
    setFailed(false);
    storefrontSpecProducts(client, workspaceId, { filters: chosen, collectionId, page: 1, limit: PAGE_SIZE })
      .then((page) => {
        if (alive) setResults({ key: chosenKey, products: page.products, total: page.total, page: 1 });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
    // `chosenKey` stands for `chosen`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, workspaceId, collectionId, chosenKey, disabled]);

  function apply(next: Chosen) {
    setChosen(next);
    // The URL follows, without a trip to the server.
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAM);
    for (const f of next) url.searchParams.append(PARAM, `${f.keyId}:${f.value}`);
    // `null`, as the Next.js router expects of a native history call: it then keeps useSearchParams in step.
    window.history.replaceState(null, "", url);
  }

  function toggle(keyId: string, value: string, on: boolean) {
    apply(on ? [...chosen, { keyId, value }] : chosen.filter((f) => !(f.keyId === keyId && f.value === value)));
  }

  async function more() {
    if (!results || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await storefrontSpecProducts(client, workspaceId, { filters: chosen, collectionId, page: results.page + 1, limit: PAGE_SIZE });
      setResults((prev) =>
        prev && prev.key === chosenKey
          ? { ...prev, page: page.page, total: page.total, products: [...prev.products, ...page.products.filter((p) => !prev.products.some((q) => q.id === p.id))] }
          : prev
      );
    } catch {
      /* the button stays: the shopper can try again */
    } finally {
      setLoadingMore(false);
    }
  }

  if (disabled || (filters.length === 0 && chosen.length === 0)) return <>{children}</>;

  const active = chosen.length > 0;
  const current = results && results.key === chosenKey ? results : null;
  const isOn = (keyId: string, value: string) => chosen.some((f) => f.keyId === keyId && f.value === value);

  return (
    <>
      {filters.length > 0 && (
        <details className="group mb-6 rounded-2xl border border-line bg-paper-raised" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden ${focusRing}`}>
            <span>
              {text.filterTitle}
              {active && <span className="ms-2 text-xs font-normal text-ink-soft">{text.filterCount(count(chosen.length))}</span>}
            </span>
            <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="grid gap-5 border-t border-line px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {filters.map((filter) => (
              <fieldset key={filter.id}>
                <legend className="mb-1 text-sm font-semibold text-ink">
                  <bdi>{specName(filter.name, locale)}</bdi>
                </legend>
                {filter.values.map((option) => {
                  const id = `${uid}-${filter.id}-${option.value}`;
                  return (
                    <label key={option.value} htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                      <input
                        id={id}
                        type="checkbox"
                        checked={isOn(filter.id, option.value)}
                        onChange={(e) => toggle(filter.id, option.value, e.target.checked)}
                        className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
                      />
                      <span className="min-w-0 flex-1">
                        <bdi>{specValue(option.value, filter.unit)}</bdi>
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft tabular-nums">{count(option.products)}</span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        </details>
      )}

      {!active ? (
        children
      ) : (
        <section aria-labelledby={`${uid}-results`} aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${uid}-results`} className="font-display text-xl font-bold text-ink">
              {text.resultsTitle}
              {current && <span className="ms-2 text-sm font-normal text-ink-soft">{text.resultsCount(count(current.total))}</span>}
            </h2>
            <button type="button" onClick={() => apply([])} className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-medium text-primary hover:underline ${focusRing}`}>
              {text.clearFilters}
            </button>
          </div>

          {failed ? (
            <p role="alert" className="rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-12 text-center text-sm text-ink-soft">
              {text.filterFailed}
            </p>
          ) : !current ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3" role="status" aria-busy="true" aria-label={text.loadingMore}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`${skeleton} block aspect-[3/4]`} />
              ))}
            </div>
          ) : current.products.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-16 text-center text-sm text-ink-soft">{text.noMatches}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                {current.products.map((product) => (
                  <ProductCard key={product.id} product={product} currency={currency} locale={locale} />
                ))}
              </div>
              {current.products.length < current.total && (
                <div className="mt-6 flex justify-center">
                  <button type="button" disabled={loadingMore} onClick={() => void more()} className={btnSecondary}>
                    {loadingMore ? <StoreButtonLoader label={text.loadingMore}>{text.more}</StoreButtonLoader> : text.more}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
