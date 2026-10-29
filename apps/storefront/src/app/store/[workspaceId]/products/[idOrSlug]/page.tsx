import { PixelScope } from "@/components/PixelScope";
import { Suspense } from "react";
import { ProductQuestions } from "@/components/product/ProductQuestions";
import { ProductSpecs } from "@/components/specs/ProductSpecs";
import { PRODUCT_QUESTIONS_ENABLED, PRODUCT_SPECS_ENABLED } from "@/lib/features";
import { decodeSegment } from "@/lib/urlRedirects";
import { redirectIfMoved } from "@/lib/urlRedirectsServer";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  resolveCheckoutForm,
  resolveCheckoutSettings,
  storefrontDesignMeta,
  storefrontProductCombos,
  storefrontProductPage,
} from "@store-builder/api-client";
import { StoreInfoCards } from "@/components/StoreInfoCards";
import { ProductJsonLd } from "@/components/product/ProductJsonLd";
import { canonicalOrigin } from "@/lib/domains";
import { ProductContent } from "@/components/product/ProductContent";
import { ProductCombos } from "@/components/combos/ProductCombos";
import { storefrontExternalReviews, storefrontProductReviews } from "@store-builder/api-client";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ArrowIcon } from "@/components/Icons";
import { Faq } from "@/components/product/Faq";
import { TestedProductGallery } from "@/components/product/TestedProductGallery";
import { ProductLanding } from "@/components/product/ProductLanding";
import { ProductVideos } from "@/components/product/ProductVideos";
import { ProductTabs, type ProductTab } from "@/components/product/ProductTabs";
import { StoreLink } from "@/components/StoreRoute";
import { faqFromCards, shippingRows, storeCards } from "@/lib/storePromises";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { orderBumpOf } from "@/lib/commerce";
import { firstImage } from "@/lib/product";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { PageRenderer } from "@/components/page-renderer";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { XsPageStrip } from "@/components/xs/XsPageStrip";
import { readXsStorePages, storePageAttrs } from "@/lib/xsStorePages";
import { readStoreWords, withStoreWords } from "@/lib/storeWords";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; idOrSlug: string }>;

function seoString(seo: Record<string, unknown> | null, key: string): string | null {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * The canonical URL is built from the product's slug, not from the `idOrSlug`
 * that was asked for: the API answers to either, and only one of them should
 * be the address search engines keep. It stays relative so the store layout's
 * `metadataBase` resolves it onto the store's own subdomain.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, idOrSlug } = await params;
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getStorefrontProduct(workspaceId, idOrSlug),
  ]);
  if (!store || !product) return {};

  const locale = await getStoreLocale(store);
  const title = seoString(product.seo, "title") ?? product.name;
  const description =
    seoString(product.seo, "description") ??
    (product.description
      ? product.description.replace(/\s+/g, " ").slice(0, 160)
      : getDictionary(locale).meta.storeDescription(store.name));
  // The merchant's sharing image and "hide from search engines" (product form → Search engines and sharing).
  const image = seoString(product.seo, "imageUrl") ?? firstImage(product);
  const noindex = (product.seo as Record<string, unknown> | undefined)?.noindex === true;

  return {
    title,
    description,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      siteName: store.name,
      title,
      description,
      url: `/products/${product.slug}`,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { workspaceId, idOrSlug } = await params;

  // Both calls are React-cached, shared with the layout and generateMetadata.
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getStorefrontProduct(workspaceId, idOrSlug),
  ]);
  // A product whose address changed goes on to its new one (Store settings, URL redirects).
  if (store && !product) await redirectIfMoved(workspaceId, `/products/${decodeSegment(idOrSlug)}`);
  if (!store || !product) notFound();

  const locale = await getStoreLocale(store);

  // The product's own landing page (page settings → landing page), built in the
  // page builder with this product as the page's product; the standard page
  // shows when it is not in the published website.
  const landingPath = (product as { landingPagePath?: string | null }).landingPagePath;
  if (landingPath) {
    const client = await createServerStorefrontApiClient();
    const landing = await client.getStorefrontPage(workspaceId, landingPath).catch(() => null);
    if (landing && landing.kind === "page" && (landing.data.page.tree?.sections?.length ?? 0) > 0) {
      return (
        <main className="flex-1">
          <PixelScope productIds={[product.id]} />
          <PageRenderer
            tree={{ ...landing.data.page.tree, productId: product.id } as typeof landing.data.page.tree}
            workspaceId={workspaceId}
            currency={store.currency}
            locale={locale}
            siteStyles={landing.data.site?.globalStyles}
          />
        </main>
      );
    }
  }

  // The dictionary with the store's own words on its shop pages (lib/storeWords).
  const t = withStoreWords(getDictionary(locale), readStoreWords(store.themeSettings, locale));
  // On a store that wears a template: its shop's strip, pictures and tabs (lib/xsStorePages).
  const xsPages = readXsStorePages(store.themeSettings);
  // The merchant's bump — not on its own product's page.
  const bump = orderBumpOf(store.orderBump, [product.id]);
  // The product page's own settings and content, defaults filled in.
  const page = storefrontProductPage(product);
  const ps = page.pageSettings;
  // The combos this product is in (sent only while the server's combos are on): none, no section.
  const combos = storefrontProductCombos(product);
  // With "form above the description" off, the buy box shows the description itself.
  const descriptionInBuyBox = ps.inline_checkout && !ps.checkout_before_description;
  // The store's own shipping / returns / COD cards (lib/storePromises.ts): the
  // only promises this page makes about them.
  const cards = storeCards(store);
  // The product's own questions; else the store-wide ones, answered from the cards.
  const [payQ, arriveQ, returnsQ] = t.product.faqItems.map((item) => item.q);
  const faqItems =
    page.cms.faqs.length > 0
      ? page.cms.faqs.map((item) => ({ q: item.question, a: item.answer }))
      : faqFromCards(cards, { pay: payQ, arrive: arriveQ, returns: returnsQ });

  // Details / shipping & returns / FAQ as tabs under the buy box, each only
  // when there is something true to put in it.
  const shippingItems = shippingRows(cards, locale);
  const tabs: ProductTab[] = [
    ...(product.description && !descriptionInBuyBox
      ? [
          {
            id: "details",
            label: t.shop.details,
            content: (
              <div className="whitespace-pre-line rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
                {product.description}
              </div>
            ),
          },
        ]
      : []),
    ...(shippingItems.length > 0
      ? [
          {
            id: "shipping",
            label: t.shop.shippingReturns,
            content: (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-paper-raised">
                {shippingItems.map((item) => (
                  <li key={item.title} className="px-5 py-4">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.points.map((point, i) => (
                      <p key={i} className="mt-0.5 text-sm text-ink-soft">
                        {point}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(faqItems.length > 0
      ? [
          {
            id: "faq",
            label: t.product.faq,
            content: <Faq title={t.product.faq} items={faqItems} titleHidden />,
          },
        ]
      : []),
  ];

  return (
    // Room at the end for the sticky order bar on a phone, home indicator included.
    <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0" {...storePageAttrs("product", xsPages)}>
      {/* Lets a pixel scoped to this product receive this visit (Marketing → Tracking tools). */}
      <PixelScope productIds={[product.id]} />
      {/* schema.org Product for search engines and Google Merchant. */}
      <ProductJsonLd
        product={product}
        url={`${canonicalOrigin(store)}/products/${product.slug}`}
        currency={store.currency}
        storeName={store.name}
      />
      {/* A landing page without the store's menu: hidden only while this page is shown. */}
      {ps.hide_header && (
        <style
          dangerouslySetInnerHTML={{
            __html: '[data-zimos-shell="header"],[data-zimos-shell="header"]+nav{display:none!important}',
          }}
        />
      )}
      {xsPages && (
        <XsPageStrip
          pages={xsPages}
          label={t.catalog.breadcrumbs}
          crumbs={[{ label: t.common.home, href: "/" }, { label: xsPages.titles.catalog ?? t.catalog.allProducts, href: "/products" }, { label: product.name }]}
        />
      )}
      <div className={`${container} py-6 sm:py-8`}>
        {!xsPages && (
          <StoreLink
            href="/"
            className="zt-pdp-back inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft transition-colors hover:text-primary"
          >
            <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
            {t.product.back}
          </StoreLink>
        )}

        <div className="zt-pdp mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div className="zt-pdp-media md:sticky md:top-24 md:self-start">
            <TestedProductGallery workspaceId={workspaceId} product={product} />
            <ProductVideos product={product} label={product.name} />
          </div>
          <ProductLanding
            workspaceId={workspaceId}
            product={product}
            bump={bump}
            description={descriptionInBuyBox ? product.description : null}
            checkoutSettings={{ ...resolveCheckoutSettings(store.checkout), form: resolveCheckoutForm(store.checkout) } as ReturnType<typeof resolveCheckoutSettings>}
          />
        </div>

        {/* "Buy it as a combo": other products with this one at one price, right under the buy box. */}
        {combos.length > 0 && <ProductCombos combos={combos} />}

        <ProductContent cms={page.cms} locale={locale} />

        {/* The specifications table, only for a product that has any. Read on its own and streamed in:
            the photo and the buy box do not wait for it (PRODUCT_SPECS_ENABLED). */}
        {PRODUCT_SPECS_ENABLED && (
          <Suspense fallback={null}>
            <ProductSpecs workspaceId={workspaceId} product={product} locale={locale} />
          </Suspense>
        )}

        {ps.reviews_enabled && (
          <ProductReviews
            workspaceId={workspaceId}
            productId={product.id}
            {...storefrontProductReviews(product)}
            // Brought from other sites by the merchant: shown apart, never in the stars.
            externalReviews={storefrontExternalReviews(product)}
          />
        )}

        <div className="zt-pdp-more mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <ProductTabs tabs={tabs} />
          <aside className="lg:pt-1">
            {/* The merchant's own shipping / returns / COD cards, when written; nothing invented otherwise. */}
            {resolveCheckoutForm(store.checkout).show_trust_badges && cards.length > 0 && (
              <StoreInfoCards info={storefrontDesignMeta(store).storeInfo!} />
            )}
          </aside>
        </div>

        {/* The questions the store answered, and the form to ask one (PRODUCT_QUESTIONS_ENABLED). */}
        {PRODUCT_QUESTIONS_ENABLED && (
          <Suspense fallback={null}>
            <ProductQuestions workspaceId={workspaceId} productId={product.id} />
          </Suspense>
        )}

        {/* Similar products, unless the page settings hide them. */}
        {!ps.hide_related_products && (
          <RelatedProducts workspaceId={workspaceId} product={product} currency={store.currency} locale={locale} title={xsPages?.related ?? undefined} look={xsPages?.look} />
        )}
      </div>
    </main>
  );
}
