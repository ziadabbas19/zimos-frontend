import Link from "next/link";
import { ApiError, formatMoney, type StorefrontProduct } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { CartSummary } from "./CartSummary";
import { COLUMN_CLASS, type Props, bool, num, str } from "./props";

/**
 * The four commerce element types. Each is an async server component that
 * fetches from the public storefront API, so what a shopper sees is the
 * merchant's real catalogue — never sample data.
 *
 * A failed catalogue call renders nothing rather than taking the whole page
 * down: one misconfigured block should not 500 a live storefront.
 */

function priceOf(product: StorefrontProduct): number | undefined {
  const defaultOffer = product.offers.find((o) => o.isDefault) ?? product.offers[0];
  return defaultOffer?.priceAmount ?? product.variants[0]?.priceAmount;
}

async function listProducts(workspaceId: string, limit: number): Promise<StorefrontProduct[]> {
  try {
    const { products } = await createStorefrontApiClient().listStorefrontProducts(workspaceId, {
      limit,
    });
    return products;
  } catch {
    return [];
  }
}

function BlockTitle({ children }: { children: string }) {
  if (!children.trim()) return null;
  return <h2 className="mb-4 font-display text-2xl font-medium text-ink">{children}</h2>;
}

/**
 * `product_list`.
 *
 * `source` ("newest" | "featured" | "best_selling") is stored by the editor but
 * cannot be honoured yet: the public products endpoint takes only
 * collection/tag/search/limit and always orders by id (see
 * storefrontService.listProducts). All three therefore render the same
 * catalogue order — the alternative, silently mislabelling an arbitrary list as
 * "best selling", would be worse. Wire this up when the API grows a sort param.
 */
export async function ProductListElement({
  props,
  workspaceId,
  currency,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
}) {
  const limit = num(props, "limit", 8, 1, 48);
  const columns = num(props, "columns", 4, 1, 6);
  const products = await listProducts(workspaceId, limit);
  if (products.length === 0) return null;

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className={`grid gap-5 ${COLUMN_CLASS[columns]}`}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            workspaceId={workspaceId}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * `product_card` — one product, spotlit. `productId` may be a product id or a
 * slug (the API accepts either); when it's empty the editor's own hint says the
 * newest product is used, which here means the first the catalogue returns.
 */
export async function ProductCardElement({
  props,
  workspaceId,
  currency,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
}) {
  const productId = str(props, "productId").trim();
  const client = createStorefrontApiClient();

  let product: StorefrontProduct | null = null;
  try {
    product = productId
      ? await client.getStorefrontProduct(workspaceId, productId)
      : ((await listProducts(workspaceId, 1))[0] ?? null);
  } catch (err) {
    // A deleted or unpublished product is a 404 — drop the block, don't crash.
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  if (!product) return null;

  const price = priceOf(product);
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const defaultOffer = product.offers.find((o) => o.isDefault) ?? product.offers[0];

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className="grid gap-6 rounded-[var(--radius-card)] border border-line bg-paper-raised p-5 sm:grid-cols-2">
        <div className="aspect-square rounded-[var(--radius-card)] bg-primary-soft" />
        <div className="flex flex-col">
          <h3 className="font-display text-xl font-medium text-ink">{product.name}</h3>
          {bool(props, "showPrice", true) && price !== undefined && (
            <p className="mt-2 text-lg text-primary-dark">{formatMoney(price, currency)}</p>
          )}
          {product.description && (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-soft">
              {product.description}
            </p>
          )}
          <div className="mt-auto">
            {bool(props, "showBuyButton", true) ? (
              <AddToCartButton
                variantId={variant?.id}
                offerId={defaultOffer?.id}
                disabled={!variant?.inStock}
              />
            ) : null}
            <Link
              href={`/store/${workspaceId}/products/${product.slug}`}
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              View details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * `collection_list`.
 *
 * The cards are not links: this storefront has no per-collection route yet
 * (only `/`, `/products/:idOrSlug`, `/cart`, `/checkout`, `/orders/:id`), so
 * every card would land on a 404. They stay informational until a collection
 * page exists.
 */
export async function CollectionListElement({
  props,
  workspaceId,
}: {
  props: Props;
  workspaceId: string;
}) {
  const limit = num(props, "limit", 6, 1, 24);
  const columns = num(props, "columns", 3, 1, 6);

  let collections;
  try {
    collections = await createStorefrontApiClient().listStorefrontCollections(workspaceId);
  } catch {
    return null;
  }
  const shown = collections.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className={`grid gap-4 ${COLUMN_CLASS[columns]}`}>
        {shown.map((collection) => (
          <div
            key={collection.id}
            className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4"
          >
            <h3 className="font-medium text-ink">{collection.name}</h3>
            {collection.description && (
              <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{collection.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** `cart` — a live count plus a link into the real cart page. */
export function CartElement({ props, workspaceId }: { props: Props; workspaceId: string }) {
  return <CartSummary title={str(props, "title", "Your cart")} workspaceId={workspaceId} />;
}
