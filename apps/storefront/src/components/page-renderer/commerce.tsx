import { ApiError, type StorefrontProduct } from "@store-builder/api-client";
import { AddToCartButton } from "@/components/AddToCartButton";
import { BoxIcon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary } from "@/components/ui";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { compareAtOf, defaultOfferOf, firstImage, offerAppliesTo, priceOf } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { CartSummary } from "./CartSummary";
import type { PageRendererFunnel } from "./PageRenderer";
import { COLUMN_CLASS, type Props, bool, num, resolveHref, str } from "./props";

/** The funnel step's actions as a store link, or null outside a funnel. */
function funnelHref(funnel: PageRendererFunnel | undefined): string | null {
  return funnel ? resolveHref(funnel.nextHref) : null;
}

/**
 * The four commerce element types. Each is an async server component that
 * fetches from the public storefront API, so what a shopper sees is the
 * merchant's real catalogue — never sample data.
 *
 * A failed catalogue call renders nothing rather than taking the whole page
 * down: one misconfigured block should not 500 a live storefront.
 *
 * In funnel mode (PageRenderer's `funnel` prop) the product blocks send the
 * shopper to the funnel step's actions instead of the product page — a funnel
 * is one path, and a link out of it is a shopper lost.
 */

async function listProducts(workspaceId: string, limit: number): Promise<StorefrontProduct[]> {
  try {
    const client = await createServerStorefrontApiClient();
    const { products } = await client.listStorefrontProducts(workspaceId, { limit });
    return products;
  } catch {
    return [];
  }
}

function BlockTitle({ children }: { children: string }) {
  if (!children.trim()) return null;
  return <h2 className="mb-5 text-2xl font-bold text-ink">{children}</h2>;
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
  locale,
  funnel,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
  locale: Locale;
  funnel?: PageRendererFunnel;
}) {
  const limit = num(props, "limit", 8, 1, 48);
  const columns = num(props, "columns", 4, 1, 6);
  const products = await listProducts(workspaceId, limit);
  if (products.length === 0) return null;
  const next = funnelHref(funnel);

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className={`grid gap-3 sm:gap-5 ${COLUMN_CLASS[columns]}`}>
        {products.map((product) =>
          next ? (
            <FunnelProductTile key={product.id} product={product} href={next} currency={currency} locale={locale} />
          ) : (
            <ProductCard key={product.id} product={product} currency={currency} locale={locale} />
          )
        )}
      </div>
    </div>
  );
}

/**
 * A product in a funnel's grid: the same look as ProductCard, but the whole
 * tile is one link to the step's actions — no product page, nothing that
 * leaves the path. Kept apart so the card shoppers see everywhere else is
 * untouched by funnel work.
 */
function FunnelProductTile({
  product,
  href,
  currency,
  locale,
}: {
  product: StorefrontProduct;
  href: string;
  currency: string;
  locale: Locale;
}) {
  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const image = firstImage(product);

  return (
    <StoreLink
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-[border-color,box-shadow] hover:border-primary hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="relative block aspect-square overflow-hidden bg-paper">
        {image ? (
          // Merchant media are arbitrary remote URLs (no next/image allowlist).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={48} />
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink sm:text-base">{product.name}</span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-ink">
            {price !== undefined ? formatPrice(price, currency, locale) : "—"}
          </span>
          {compareAt && (
            <span className="text-sm text-ink-soft line-through">{formatPrice(compareAt, currency, locale)}</span>
          )}
        </span>
      </span>
    </StoreLink>
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
  locale,
  funnel,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
  locale: Locale;
  funnel?: PageRendererFunnel;
}) {
  const t = getDictionary(locale);
  const productId = str(props, "productId").trim();
  const client = await createServerStorefrontApiClient();

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
  const compareAt = compareAtOf(product);
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const offer = defaultOfferOf(product);
  const image = firstImage(product);
  const next = funnelHref(funnel);
  const href = next ?? `/products/${product.slug}`;
  // "Order now" jumps to the product page's order form; in a funnel the
  // step's own actions are the order form, so it is the same link twice.
  const orderHref = next ?? `${href}#order-form`;

  return (
    <div>
      <BlockTitle>{str(props, "title")}</BlockTitle>
      <div className="grid gap-6 rounded-2xl border border-line bg-paper-raised p-5 sm:grid-cols-2 sm:p-6">
        <div className="aspect-square overflow-hidden rounded-2xl bg-paper">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={600} height={600} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <BoxIcon size={56} />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <h3 className="text-xl font-bold text-ink">{product.name}</h3>
          {bool(props, "showPrice", true) && price !== undefined && (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold text-ink">{formatPrice(price, currency, locale)}</span>
              {compareAt && (
                <span className="text-base text-ink-soft line-through">{formatPrice(compareAt, currency, locale)}</span>
              )}
            </p>
          )}
          {product.description && (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>
          )}
          <div className="mt-auto space-y-3 pt-5">
            <StoreLink href={orderHref} className={`${btnPrimary} w-full`}>
              {t.product.orderNow}
            </StoreLink>
            {/* Add-to-cart leads to the cart, off the funnel's path. */}
            {bool(props, "showBuyButton", true) && !next ? (
              <AddToCartButton
                variant="secondary"
                variantId={variant?.id}
                offerId={offer && offerAppliesTo(offer, variant?.id) ? offer.id : undefined}
                disabled={!variant?.inStock}
              />
            ) : null}
            <StoreLink
              href={href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
            >
              {t.renderer.viewDetails}
            </StoreLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * `collection_list`. Each card links to the store home filtered by that
 * collection (`?collection=<id>`), which the home catalogue honours through the
 * public products endpoint's `collectionId` filter.
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
    const client = await createServerStorefrontApiClient();
    collections = await client.listStorefrontCollections(workspaceId);
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
          <StoreLink
            key={collection.id}
            href={`/?collection=${encodeURIComponent(collection.id)}#products`}
            className="block rounded-2xl border border-line bg-paper-raised p-5 transition-colors hover:border-primary"
          >
            <h3 className="font-semibold text-ink">{collection.name}</h3>
            {collection.description && (
              <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{collection.description}</p>
            )}
          </StoreLink>
        ))}
      </div>
    </div>
  );
}

/** `cart` — a live count plus a link into the real cart page. */
export function CartElement({ props }: { props: Props }) {
  return <CartSummary title={str(props, "title")} />;
}
