import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveCheckoutSettings, type StorefrontProduct } from "@store-builder/api-client";
import { ArrowIcon } from "@/components/Icons";
import { Faq } from "@/components/product/Faq";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductLanding } from "@/components/product/ProductLanding";
import { StoreLink } from "@/components/StoreRoute";
import { TrustStrip } from "@/components/TrustStrip";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { getOrderBump } from "@/lib/commerce";
import { firstImage, productImages } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";

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
  const image = firstImage(product);

  return {
    title,
    description,
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

function countdownHoursFrom(themeSettings: Record<string, unknown>): number | null {
  const raw = themeSettings?.productCountdownHours;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 720) : null;
}

export default async function ProductPage({ params }: { params: Params }) {
  const { workspaceId, idOrSlug } = await params;

  // Both calls are React-cached, shared with the layout and generateMetadata.
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getStorefrontProduct(workspaceId, idOrSlug),
  ]);
  if (!store || !product) notFound();

  const client = await createServerStorefrontApiClient();
  const catalogue = await client
    .listStorefrontProducts(workspaceId, { limit: 24 })
    .then((r) => r.products)
    .catch((): StorefrontProduct[] => []);

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const bump = getOrderBump(catalogue, [product.id]);

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className={`${container} py-6 sm:py-8`}>
        <StoreLink
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft transition-colors hover:text-primary"
        >
          <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
          {t.product.back}
        </StoreLink>

        <div className="mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div className="md:sticky md:top-24 md:self-start">
            <ProductGallery images={productImages(product)} name={product.name} />
          </div>
          <ProductLanding
            workspaceId={workspaceId}
            product={product}
            bump={bump}
            countdownHours={countdownHoursFrom(store.themeSettings)}
            checkoutSettings={resolveCheckoutSettings(store.checkout)}
          />
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-10">
            {product.description && (
              <section aria-labelledby="desc-title">
                <h2 id="desc-title" className="font-display text-xl font-semibold text-ink">
                  {t.product.description}
                </h2>
                <div className="mt-4 whitespace-pre-line rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
                  {product.description}
                </div>
              </section>
            )}
            <Faq title={t.product.faq} items={t.product.faqItems} />
          </div>
          <aside className="lg:pt-11">
            <TrustStrip t={t} inAside />
          </aside>
        </div>
      </div>
    </main>
  );
}
