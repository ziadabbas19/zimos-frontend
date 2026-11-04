import type { StorefrontProductDetail } from "@store-builder/api-client";
import { ProductCard } from "@/components/ProductCard";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { CARD_FIELDS } from "@/lib/cardFields";
import { getDictionary, type Locale } from "@/lib/i18n";
import { XsShopGrid } from "@/components/xs/XsShopGrid";

const SHOWN = 4;

/**
 * "Similar products" under a product (SPEC §7.3; page settings →
 * hide_related_products hides it): other products from its first collection,
 * else the store's newest. Nothing when there is nothing else to show.
 */
export async function RelatedProducts({
  workspaceId,
  product,
  currency,
  locale,
  title,
  look,
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  currency: string;
  locale: Locale;
  /** The heading, when the store wrote its own (lib/xsStorePages related). */
  title?: string;
  /** On a store that wears a template: drawn as its product grid (components/xs/XsShopGrid). */
  look?: string;
}) {
  const client = await createServerStorefrontApiClient();
  const collectionId = ((product as { collectionIds?: string[] }).collectionIds ?? [])[0];
  const others = async (params: { collectionId?: string }) =>
    // A template's grid opens a quick view with the description.
    (await client.listStorefrontProducts(workspaceId, { ...params, limit: SHOWN + 1, ...(look ? {} : CARD_FIELDS) }).catch(() => ({ products: [] }))).products.filter(
      (p) => p.id !== product.id
    );
  let products = collectionId ? await others({ collectionId }) : [];
  if (products.length === 0) products = await others({});
  if (products.length === 0) return null;

  const t = getDictionary(locale);
  if (look) {
    return (
      <section aria-label={title ?? t.catalog.related} className="zt-related mt-12">
        <XsShopGrid look={look} workspaceId={workspaceId} products={products.slice(0, SHOWN)} heading={title ?? t.catalog.related} currency={currency} locale={locale} />
      </section>
    );
  }
  return (
    <section aria-labelledby="related-products" className="zt-related mt-12">
      <h2 id="related-products" className="zt-related-title text-lg font-semibold text-ink">
        {title ?? t.catalog.related}
      </h2>
      <div className="zt-related-grid mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.slice(0, SHOWN).map((p) => (
          <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
        ))}
      </div>
    </section>
  );
}
