import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ApiError,
  DEFAULT_CATALOG_SETTINGS,
  type StorefrontListing,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { ActiveFilterChips } from "@/components/catalog/ActiveFilterChips";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { FilterDrawer } from "@/components/catalog/FilterDrawer";
import { FilterSheet } from "@/components/catalog/FilterSheet";
import { SortSelect } from "@/components/catalog/SortSelect";
import { SpecFilteredResults } from "@/components/specs/SpecFilteredResults";
import { PRODUCT_SPECS_ENABLED, STORE_SIDEBAR_ENABLED } from "@/lib/features";
import { ChevronIcon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { StoreImage } from "@/components/StoreImage";
import { StoreLink } from "@/components/StoreRoute";
import { btnSecondary, container, focusRing } from "@/components/ui";
import { activeFilterCount, catalogHref, readCatalogState, toListingParams, type CatalogState } from "@/lib/catalogQuery";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreCollections, getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string }>;
type Query = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 24;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Query }): Promise<Metadata> {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};
  const t = getDictionary(await getStoreLocale(store));
  const state = readCatalogState(query);
  if (state.q) {
    // A results page is the shopper's own query, not a page to index.
    return { title: t.catalog.searchTitle(state.q), robots: { index: false, follow: true } };
  }
  if (state.collection) {
    const collections = await getStoreCollections(workspaceId);
    const found = collections.find((c) => c.slug === state.collection || c.id === state.collection);
    if (found) {
      // The category's own SEO (dashboard → Categories → Search engines and sharing), same keys as a product's.
      const seo = (found.seo ?? {}) as Record<string, unknown>;
      const seoText = (key: string) => (typeof seo[key] === "string" && (seo[key] as string).trim() ? (seo[key] as string).trim() : undefined);
      const title = seoText("title") ?? found.name;
      const description = seoText("description") ?? (found.description || undefined);
      const image = seoText("imageUrl") ?? found.imageUrl ?? undefined;
      const url = `/products?collection=${encodeURIComponent(found.slug)}`;
      return {
        title,
        description,
        ...(seo.noindex === true ? { robots: { index: false, follow: true } } : {}),
        alternates: { canonical: url },
        openGraph: { type: "website", siteName: store.name, title, description, url, ...(image ? { images: [{ url: image, alt: found.name }] } : {}) },
        twitter: { card: image ? "summary_large_image" : "summary", title, description },
      };
    }
  }
  return { title: t.catalog.allProducts, alternates: { canonical: "/products" } };
}

/**
 * Every published product, one collection's, or a search's results — the
 * page the templates' "Shop now" buttons, the collection chips and the header
 * search all lead to. Its state is its URL (lib/catalogQuery.ts): search,
 * collection, tags, price, options, sort and page. The sidebar and its
 * filters are the merchant's choice (settings.storefront_catalog, read as
 * store.catalog); on a phone they open as a sheet.
 *
 * With lib/features STORE_SIDEBAR_ENABLED the same sidebar is "refined": the
 * filters in use show as chips over the grid, the sort moves into the column
 * from `lg`, and the phone's sheet rises from the bottom and waits for
 * "Apply". Every list is still the API's own answer for the URL.
 *
 * Collections live here as `?collection=<slug>` rather than on a route of
 * their own: "products" is a path the website editor already reserves, while
 * a new "/collections" route would shadow any page a merchant built there.
 */
export default async function ProductsPage({ params, searchParams }: { params: Params; searchParams: Query }) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const catalog = store.catalog ?? DEFAULT_CATALOG_SETTINGS;
  const state = readCatalogState(query);
  const client = await createServerStorefrontApiClient();

  let listing: StorefrontListing;
  try {
    listing = await client.searchStorefrontProducts(workspaceId, {
      ...toListingParams(state, catalog.default_sort),
      limit: PAGE_SIZE,
      facets: catalog.sidebar_enabled,
    });
  } catch (err) {
    // A collection that no longer exists.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const collections = catalog.sidebar_enabled ? await getStoreCollections(workspaceId) : [];
  const filterCount = activeFilterCount(state);
  const sidebar = catalog.sidebar_enabled && listing.facets !== undefined;
  const refined = STORE_SIDEBAR_ENABLED && sidebar;
  const title = state.q ? t.catalog.searchTitle(state.q) : (listing.collection?.name ?? t.catalog.allProducts);
  const clearHref = catalogHref(state, { collection: null, tags: [], min: null, max: null, options: {} });

  // The list as it always was: what the page shows unless a specification filter is ticked.
  const results = (
    <>
      {state.q ? (
        <SearchResults t={t} state={state} listing={listing} currency={store.currency} locale={locale} />
      ) : listing.products.length === 0 ? (
        <EmptyState message={filterCount > 0 ? t.catalog.empty : t.home.empty}>
          {filterCount > 0 && (
            <StoreLink href={clearHref} scroll={false} className={btnSecondary}>
              {t.catalog.clearFilters}
            </StoreLink>
          )}
        </EmptyState>
      ) : (
        <ProductGrid products={listing.products} currency={store.currency} locale={locale} />
      )}

      <Pagination t={t} state={state} listing={listing} />
    </>
  );

  const filters = sidebar ? (
    <CatalogFilters
      state={state}
      filters={catalog.filters}
      facets={listing.facets}
      collections={collections}
      idPrefix="side"
      sort={refined ? { current: listing.sort } : undefined}
    />
  ) : null;

  return (
    <main className="flex-1">
      <div className={`${container} py-8 sm:py-10`}>
        <Breadcrumbs t={t} listing={listing} searching={Boolean(state.q)} />

        <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {listing.collection?.imageUrl && (
              <StoreImage
                src={listing.collection.imageUrl}
                alt=""
                width={72}
                height={72}
                sizes="72px"
                className="size-16 shrink-0 rounded-2xl border border-line object-cover sm:size-18"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
              {listing.collection?.description && (
                <p className="mt-1 max-w-2xl text-sm text-ink-soft">{listing.collection.description}</p>
              )}
              <p className="mt-1 text-sm text-ink-soft" aria-live="polite">
                {t.catalog.count(listing.total)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {refined ? (
              <FilterSheet state={state} filters={catalog.filters} facets={listing.facets} collections={collections} />
            ) : sidebar && (
              <FilterDrawer count={filterCount} total={listing.total}>
                {/* The sheet's own copy: separate ids from the sidebar's. */}
                <CatalogFilters
                  state={state}
                  filters={catalog.filters}
                  facets={listing.facets}
                  collections={collections}
                  idPrefix="sheet"
                />
                {filterCount > 0 && (
                  <StoreLink href={clearHref} scroll={false} className={`${btnSecondary} mt-6 w-full`}>
                    {t.catalog.clearFilters}
                  </StoreLink>
                )}
              </FilterDrawer>
            )}
            {refined ? (
              // From `lg` the sort is a block of the column beside the grid.
              <div className="lg:hidden">
                <SortSelect state={state} current={listing.sort} />
              </div>
            ) : (
              <SortSelect state={state} current={listing.sort} />
            )}
          </div>
        </header>

        <div className={sidebar ? "mt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10" : "mt-8"}>
          {sidebar && (
            <aside aria-label={t.catalog.filters} className="hidden lg:block">
              {refined && (
                <div className="mb-4 flex min-h-11 items-center justify-between gap-3 border-b border-line pb-2">
                  <p className="font-display text-base font-bold text-ink">{t.catalog.filters}</p>
                  {filterCount > 0 && (
                    <StoreLink
                      href={clearHref}
                      scroll={false}
                      className={`inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}
                    >
                      {t.catalog.clearAll}
                    </StoreLink>
                  )}
                </div>
              )}
              {filters}
              {!refined && filterCount > 0 && (
                <StoreLink href={clearHref} scroll={false} className={`${btnSecondary} mt-6 w-full`}>
                  {t.catalog.clearFilters}
                </StoreLink>
              )}
            </aside>
          )}

          <div className="min-w-0">
            {refined && (
              <ActiveFilterChips t={t} state={state} collections={collections} collectionName={listing.collection?.name} />
            )}
            {/* Specification filters (lib/features): once a value is ticked, its matches stand in for the results. */}
            {PRODUCT_SPECS_ENABLED ? (
              <SpecFilteredResults
                key={listing.collection?.id ?? "all"}
                workspaceId={workspaceId}
                collectionId={listing.collection?.id ?? null}
                currency={store.currency}
                locale={locale}
                disabled={Boolean(state.q)}
              >
                {results}
              </SpecFilteredResults>
            ) : (
              results
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ProductGrid({ products, currency, locale }: { products: StorefrontProduct[]; currency: string; locale: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
      {/* The first row is on screen as the page opens (two columns on a phone):
          those photos load at once, the rest as they scroll near. */}
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} currency={currency} locale={locale} priority={i < 2} />
      ))}
    </div>
  );
}

function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-16 text-center">
      <p className="text-sm text-ink-soft">{message}</p>
      {children}
    </div>
  );
}

/** The matches, then — on the first page — products close to them that did not match. */
function SearchResults({
  t,
  state,
  listing,
  currency,
  locale,
}: {
  t: Dictionary;
  state: CatalogState;
  listing: StorefrontListing;
  currency: string;
  locale: Locale;
}) {
  const related = listing.related ?? [];
  return (
    <div className="space-y-12">
      <section aria-labelledby="search-results-title">
        <h2 id="search-results-title" className="mb-4 font-display text-xl font-bold text-ink">
          {t.catalog.results}
        </h2>
        {listing.products.length === 0 ? (
          <EmptyState message={t.catalog.noResults(state.q)}>
            <p className="max-w-md text-sm text-ink-soft">{t.catalog.noResultsHint}</p>
          </EmptyState>
        ) : (
          <ProductGrid products={listing.products} currency={currency} locale={locale} />
        )}
      </section>
      {related.length > 0 && (
        <section aria-labelledby="search-related-title">
          <h2 id="search-related-title" className="mb-4 font-display text-xl font-bold text-ink">
            {t.catalog.related}
          </h2>
          <ProductGrid products={related} currency={currency} locale={locale} />
        </section>
      )}
    </div>
  );
}

/** Home › All products › the collection's parents › the collection (or the search). */
function Breadcrumbs({ t, listing, searching }: { t: Dictionary; listing: StorefrontListing; searching: boolean }) {
  const crumbs: Array<{ label: string; href?: string }> = [{ label: t.common.home, href: "/" }];
  const trail = listing.breadcrumbs ?? [];
  if (trail.length > 0 || searching) crumbs.push({ label: t.catalog.allProducts, href: "/products" });
  else crumbs.push({ label: t.catalog.allProducts });
  trail.forEach((c, i) =>
    crumbs.push({ label: c.name, href: i < trail.length - 1 ? `/products?collection=${encodeURIComponent(c.slug)}` : undefined })
  );
  return (
    <nav aria-label={t.catalog.breadcrumbs}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronIcon size={14} className="shrink-0 -rotate-90 rtl:rotate-90" aria-hidden />}
            {crumb.href ? (
              <StoreLink href={crumb.href} className={`inline-flex min-h-11 items-center rounded-md px-1 hover:text-primary ${focusRing}`}>
                {crumb.label}
              </StoreLink>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 items-center px-1 font-medium text-ink">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Previous / numbered / next, the current page and two either side. */
function Pagination({ t, state, listing }: { t: Dictionary; state: CatalogState; listing: StorefrontListing }) {
  const pages = Math.max(1, Math.ceil(listing.total / listing.pageSize));
  if (pages <= 1) return null;
  const current = Math.min(listing.page, pages);
  const shown = [...new Set([1, current - 2, current - 1, current, current + 1, current + 2, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);
  const cell = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors ${focusRing}`;

  return (
    <nav aria-label={t.catalog.pagination} className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {current > 1 && (
          <li>
            <StoreLink href={catalogHref(state, { page: current - 1 })} rel="prev" className={`${cell} border-line bg-paper-raised text-ink hover:border-primary hover:text-primary`}>
              <ChevronIcon size={16} className="rotate-90 rtl:-rotate-90" aria-hidden />
              <span className="sr-only">{t.catalog.previous}</span>
            </StoreLink>
          </li>
        )}
        {shown.map((page, i) => (
          <li key={page} className="flex items-center gap-2">
            {i > 0 && page - shown[i - 1] > 1 && <span aria-hidden className="text-ink-soft">…</span>}
            {page === current ? (
              <span aria-current="page" className={`${cell} border-primary bg-primary text-on-primary`}>
                <span className="sr-only">{t.catalog.page(page)}</span>
                <span aria-hidden>{page}</span>
              </span>
            ) : (
              <StoreLink
                href={catalogHref(state, { page })}
                aria-label={t.catalog.page(page)}
                className={`${cell} border-line bg-paper-raised text-ink hover:border-primary hover:text-primary`}
              >
                {page}
              </StoreLink>
            )}
          </li>
        ))}
        {current < pages && (
          <li>
            <StoreLink href={catalogHref(state, { page: current + 1 })} rel="next" className={`${cell} border-line bg-paper-raised text-ink hover:border-primary hover:text-primary`}>
              <span className="sr-only">{t.catalog.next}</span>
              <ChevronIcon size={16} className="-rotate-90 rtl:rotate-90" aria-hidden />
            </StoreLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
