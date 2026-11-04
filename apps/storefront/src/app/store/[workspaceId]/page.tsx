import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { StorefrontCollection } from "@store-builder/api-client";
import { LatestPosts } from "@/components/blog/LatestPosts";
import { ArrowIcon } from "@/components/Icons";
import { PageRenderer } from "@/components/page-renderer";
import { ProductCard } from "@/components/ProductCard";
import { StoreImage } from "@/components/StoreImage";
import { StoreLink } from "@/components/StoreRoute";
import { TrustStrip } from "@/components/TrustStrip";
import { storeCards } from "@/lib/storePromises";
import { btnPrimary, btnSecondary, container } from "@/components/ui";
import { CARD_FIELDS } from "@/lib/cardFields";
import { BLOG_ENABLED } from "@/lib/features";
import { getDictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { storeHref } from "@/lib/storeHref";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";
import { getStoreBasePath } from "@/lib/storeRoute";

export const revalidate = 60;

/**
 * The store's own address is its subdomain, whichever host actually served
 * this request — the layout's `metadataBase` turns this into that absolute URL.
 */
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * The store's front page.
 *
 * If the merchant has published a website, its home page ("/") is what a
 * shopper gets, rendered from the published page tree.
 *
 * If they haven't — no site built yet, or built but never published — the
 * catalogue below stands in (hero from store meta, trust strip, collection
 * chips, product grid). That fallback is deliberate: a workspace with products
 * but no published site is the normal state during onboarding, and showing a
 * blank page or an error there would make a working store look broken. The
 * public pages API can't distinguish "no published site" from "no such page",
 * but publishing *requires* a page at "/", so any 404 here means there is no
 * live site to render.
 */
export default async function StoreHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ collection?: string | string[] }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const client = await createServerStorefrontApiClient();

  // getStoreMeta is React-cached, so this shares the layout's single fetch.
  const [store, published, basePath] = await Promise.all([
    getStoreMeta(workspaceId),
    client.getStorefrontPage(workspaceId, "/"),
    getStoreBasePath(workspaceId),
  ]);

  if (!store) notFound();

  if (published.kind === "redirect") {
    redirect(storeHref(basePath, published.to));
  }

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);

  const tree = published.kind === "page" ? published.data.page.tree : null;
  if ((tree?.sections?.length ?? 0) > 0) {
    return (
      <main className="flex-1">
          <PageRenderer
            tree={tree}
            workspaceId={workspaceId}
            currency={store.currency}
            locale={locale}
            siteStyles={published.kind === "page" ? published.data.site?.globalStyles : undefined}
          />
      </main>
    );
  }

  const activeCollection = typeof query.collection === "string" ? query.collection : undefined;
  const [productList, collections] = await Promise.all([
    client.listStorefrontProducts(workspaceId, { limit: 24, collectionId: activeCollection, ...CARD_FIELDS }),
    client.listStorefrontCollections(workspaceId).catch((): StorefrontCollection[] => []),
  ]);

  const chip = (active: boolean) =>
    `zt-chip inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-on-primary"
        : "border-line bg-paper-raised text-ink-soft hover:border-primary hover:text-primary"
    }`;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b border-line bg-paper-raised">
        <div className={`${container} flex flex-col items-center py-12 text-center sm:py-16`}>
          {store.logoUrl && (
            <StoreImage
              src={store.logoUrl}
              alt=""
              width={72}
              height={72}
              sizes="72px"
              className="mb-5 h-18 w-18 rounded-2xl border border-line object-contain"
            />
          )}
          <p className="text-sm font-medium text-primary">{t.home.welcome}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-5xl">{store.name}</h1>
          {store.tagline && (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              {store.tagline}
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#products" className={btnPrimary}>
              {t.home.heroCta}
              <ArrowIcon size={18} className="rtl:rotate-180" />
            </a>
            <StoreLink href="/track" className={btnSecondary}>
              {t.common.trackOrder}
            </StoreLink>
          </div>
        </div>
      </section>

      {/* The store's own shipping / returns / COD cards, when it wrote them (lib/storePromises.ts). */}
      {storeCards(store).length > 0 && (
        <div className={`${container} py-8`}>
          <TrustStrip cards={storeCards(store)} locale={locale} />
        </div>
      )}

      <section
        id="products"
        aria-labelledby="products-title"
        className={`${container} scroll-mt-24 pb-16`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="products-title" className="font-display text-2xl font-bold text-ink">
            {t.home.shopAll}
          </h2>
        </div>

        {collections.length > 0 && (
          <nav aria-label={t.home.collections} className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2 pb-1">
              <li>
                <StoreLink
                  href="/#products"
                  className={chip(!activeCollection)}
                  aria-current={!activeCollection ? "page" : undefined}
                >
                  {t.home.allCollections}
                </StoreLink>
              </li>
              {collections.map((c) => (
                <li key={c.id}>
                  <StoreLink
                    href={`/?collection=${encodeURIComponent(c.id)}#products`}
                    className={chip(activeCollection === c.id)}
                    aria-current={activeCollection === c.id ? "page" : undefined}
                  >
                    {c.name}
                  </StoreLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {productList.products.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-line bg-paper-raised py-16 text-center text-sm text-ink-soft">
            {activeCollection ? t.home.emptyCollection : t.home.empty}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {productList.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={store.currency}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>

      {/* The three newest blog posts, when the store has any; only while the blog is switched on (lib/features). */}
      {BLOG_ENABLED && <LatestPosts workspaceId={workspaceId} t={t} locale={locale} />}
    </main>
  );
}
