"use client";

import type { StorefrontProduct } from "@store-builder/api-client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { XsPicture } from "@/components/xs/XsPicture";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { formatNumber, formatPrice, type Locale } from "@/lib/i18n";
import { compareAtOf, discountPercent, priceOf, productImages } from "@/lib/product";
import dynamic from "next/dynamic";

export interface XsGridTab {
  key: string;
  label: string;
  /** A collection id or slug; empty for "everything". */
  collection: string;
}

export interface XsGridCopy {
  search: string;
  searchPlaceholder: string;
  loadMore: string;
  view: string;
  /** The quick-view panel's own words. */
  open: string;
  close: string;
  prev: string;
  next: string;
  empty: string;
  tabs: string;
}

/**
 * `xs_products` — the store's own products in the template's grid: category
 * tabs across the top, a search that opens under them, and "load more".
 *
 * The first page arrives from the server (so it paints, and is crawled,
 * without JavaScript); choosing a tab, searching or loading more asks the
 * storefront API from here. A call that fails leaves what was showing.
 */
/** The quick-view panel: its code is fetched the first time a shopper opens one. */
const XsQuickView = dynamic(() => import("./XsQuickView").then((m) => m.XsQuickView), { ssr: false });

export function XsProductGrid({
  look,
  workspaceId,
  currency,
  locale,
  heading,
  text = "",
  linkLabel,
  linkHref,
  tabs,
  showSearch,
  showDiscount,
  discountLabel = "",
  layout,
  quickView,
  pageSize,
  initial,
  initialHasMore,
  copy,
}: {
  look: string;
  workspaceId: string;
  currency: string;
  locale: Locale;
  heading: string;
  /** A line under the heading; empty draws none. */
  text?: string;
  /** A link beside the heading ("View all products"); drawn only with both a label and somewhere to go. */
  linkLabel: string;
  linkHref: string | null;
  tabs: XsGridTab[];
  showSearch: boolean;
  showDiscount: boolean;
  /** The badge's wording: "{percent}" and "{amount}" (what it saves, in whole units) are filled in. Empty: "-{percent}%". */
  discountLabel?: string;
  /** "slider": one row the shopper moves along, with arrows; otherwise a grid that wraps. */
  layout: "grid" | "slider";
  /** The label on a card opens the product in a panel on this page; otherwise it is part of the link to the product's page. */
  quickView: boolean;
  pageSize: number;
  initial: StorefrontProduct[];
  initialHasMore: boolean;
  copy: XsGridCopy;
}) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [products, setProducts] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<StorefrontProduct | null>(null);
  const track = useRef<HTMLDivElement>(null);

  /** Moves the slider along by about one screenful, in the direction the arrow points on this page. */
  function slide(step: number) {
    const row = track.current;
    if (!row) return;
    const rtl = getComputedStyle(row).direction === "rtl";
    row.scrollBy({ left: step * (rtl ? -1 : 1) * row.clientWidth * 0.9, behavior: "smooth" });
  }
  // The newest request wins: a slow answer to an earlier tab never lands on a later one.
  const request = useRef(0);
  // The tab whose products are showing (the server sent the opening one's): a tab is fetched only when it changes,
  // so running the effect again for the same tab (React does in development) asks for nothing.
  const shownTab = useRef(0);

  async function load(nextPage: number, collection: string, search: string, append: boolean) {
    const id = ++request.current;
    setLoading(true);
    try {
      const listing = await createStorefrontApiClient().searchStorefrontProducts(workspaceId, {
        ...(collection ? { collection, sort: "position" as const } : { sort: "newest" as const }),
        ...(search ? { search } : {}),
        page: nextPage,
        limit: pageSize,
      });
      if (id !== request.current) return;
      setProducts((current) => (append ? [...current, ...listing.products] : listing.products));
      setHasMore(listing.hasMore);
      setPage(nextPage);
    } catch {
      /* keep what is showing */
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  // A new tab starts again from its first page (the server already sent the opening tab's).
  useEffect(() => {
    if (shownTab.current === tab) return;
    shownTab.current = tab;
    void load(1, tabs[tab]?.collection ?? "", query.trim(), false);
    // `query` is applied on submit, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(1, tabs[tab]?.collection ?? "", query.trim(), false);
  }

  return (
    <div className="xs-products" data-xs-look={look}>
      {heading || text || (linkLabel && linkHref) ? (
        <div className="xs-products__head">
          {heading || text ? (
            <div className="xs-products__intro">
              {heading ? <h2 className="xs-products__heading">{heading}</h2> : null}
              {text ? <p className="xs-products__text">{text}</p> : null}
            </div>
          ) : null}
          {linkLabel && linkHref ? (
            <StoreLink href={linkHref} className="xs-products__all">
              {linkLabel}
            </StoreLink>
          ) : null}
        </div>
      ) : null}

      {(tabs.length > 1 || showSearch) && (
        <div className="xs-products__bar">
          <div className="xs-products__tabs" role="tablist" aria-label={copy.tabs}>
            {tabs.length > 1 &&
              tabs.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={index === tab}
                  className="xs-products__tab"
                  data-active={index === tab ? "" : undefined}
                  onClick={() => setTab(index)}
                >
                  {item.label}
                </button>
              ))}
          </div>
          {showSearch && (
            <button type="button" className="xs-products__tool" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              {copy.search}
            </button>
          )}
        </div>
      )}

      {showSearch && searchOpen && (
        <form className="xs-products__search" role="search" onSubmit={onSearch}>
          <button type="submit" aria-label={copy.search}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.searchPlaceholder} autoFocus />
        </form>
      )}

      {products.length === 0 ? (
        <p className="xs-products__empty">{copy.empty}</p>
      ) : (
        <div className="xs-products__stage">
          {layout === "slider" && products.length > 1 ? (
            <>
              <button type="button" className="xs-products__arrow xs-products__arrow--prev" aria-label={copy.prev} onClick={() => slide(-1)}>
                <span aria-hidden>‹</span>
              </button>
              <button type="button" className="xs-products__arrow xs-products__arrow--next" aria-label={copy.next} onClick={() => slide(1)}>
                <span aria-hidden>›</span>
              </button>
            </>
          ) : null}
        <div ref={track} className="xs-products__grid" data-layout={layout === "slider" ? "slider" : undefined} aria-busy={loading || undefined}>
          {products.map((product) => {
            // The second picture (the back, by the clothing rail's convention): a look
            // that wants it shows it on hover; the rest leave it undrawn, and unfetched.
            const [image, second] = productImages(product);
            const price = priceOf(product);
            const compareAt = compareAtOf(product);
            const percent = price !== undefined ? discountPercent(price, compareAt) : null;
            const href = `/products/${product.slug}`;
            // "Choose {option}": the product's first option by name ("Colour"), else the plain label without it.
            const option = Object.keys(product.variants[0]?.optionValues ?? {})[0] ?? "";
            const view = copy.view.includes("{option}") ? (option ? copy.view.replace("{option}", option) : copy.view.replace(/\s*\{option\}\s*/, " ").trim()) : copy.view;
            return (
              <article key={product.id} className="xs-products__card">
                <div className="xs-products__media">
                  <StoreLink href={href} className="xs-products__shot" tabIndex={-1} aria-hidden>
                    {image ? <XsPicture src={image} alt={product.name} className="xs-products__img" /> : null}
                    {image && second ? <XsPicture src={second} alt="" className="xs-products__img xs-products__img--alt" /> : null}
                    {showDiscount && percent ? (
                      <span className="xs-products__badge">{badgeText(discountLabel, percent, price, compareAt, locale)}</span>
                    ) : null}
                  </StoreLink>
                  {quickView ? (
                    <button type="button" className="xs-products__view" aria-label={`${copy.open}: ${product.name}`} onClick={() => setViewing(product)}>
                      {view}
                    </button>
                  ) : (
                    <StoreLink href={href} className="xs-products__view" tabIndex={-1} aria-hidden>
                      {view}
                    </StoreLink>
                  )}
                </div>
                <div className="xs-products__meta">
                  <StoreLink href={href} className="xs-products__name">
                    {product.name}
                  </StoreLink>
                  <span className="xs-products__price">
                    {compareAt ? <s>{formatPrice(compareAt, currency, locale)}</s> : null}
                    <span>{price !== undefined ? formatPrice(price, currency, locale) : "—"}</span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
        </div>
      )}

      {viewing ? (
        <XsQuickView look={look} product={viewing} currency={currency} locale={locale} showDiscount={showDiscount} labels={{ close: copy.close, open: copy.open }} onClose={() => setViewing(null)} />
      ) : null}

      {hasMore && (
        <div className="xs-products__more">
          <button
            type="button"
            className="xs-products__more-btn"
            disabled={loading}
            onClick={() => void load(page + 1, tabs[tab]?.collection ?? "", query.trim(), true)}
          >
            {copy.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}

/** A discount badge in the band's own words ("{percent}", "{amount}"), "-{percent}%" by default. */
function badgeText(label: string, percent: number, price: number | undefined, compareAt: number | null, locale: Locale): string {
  if (!label.trim()) return `-${percent}%`;
  const amount = price !== undefined && compareAt ? formatNumber(Math.round((compareAt - price) / 100), locale) : "";
  return label.replace("{percent}", formatNumber(percent, locale)).replace("{amount}", amount);
}
