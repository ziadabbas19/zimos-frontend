import { parseMoney, type StorefrontProductDetail } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { formatPrice, type Locale } from "@/lib/i18n";
import { needsProductPage, variantUnitPrice } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import type { PriceTag } from "./builderMoreClient";
import { CartActionButton } from "./lazy";
import { BUTTON_CLASS } from "./elements";
import { type Props, num, resolveHref, safeUrl, str } from "./props";

/**
 * Item 93's builder pieces (SPEC §9.3; backend pages/builderExtras.js):
 * the masonry grid, the button that adds the product to the cart or buys it
 * now, and the per-variant prices the price element switches between.
 */

async function productFor(workspaceId: string, productId: string): Promise<StorefrontProductDetail | null> {
  try {
    const client = await createServerStorefrontApiClient();
    let ref = productId;
    if (!ref) {
      const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
      ref = products[0]?.id ?? "";
    }
    return ref ? await client.getStorefrontProduct(workspaceId, ref) : null;
  } catch {
    return null;
  }
}

const MASONRY_COLUMNS: Record<number, string> = {
  2: "columns-2",
  3: "columns-2 md:columns-3",
  4: "columns-2 md:columns-3 lg:columns-4",
  5: "columns-2 md:columns-3 lg:columns-5",
};

/** Pictures of their own heights in columns; each may carry a caption and a link. */
export function MasonryGridElement({ props }: { props: Props }) {
  const items = (Array.isArray(props.items) ? props.items : [])
    .map((raw) => (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}))
    .map((item) => ({
      image: safeUrl(typeof item.image === "string" ? item.image : ""),
      caption: typeof item.caption === "string" ? item.caption.trim() : "",
      href: resolveHref(typeof item.href === "string" ? item.href : ""),
    }))
    .filter((item): item is { image: string; caption: string; href: string | null } => !!item.image);
  if (items.length === 0) return null;
  const title = str(props, "title");
  const columns = num(props, "columns", 3, 2, 5);
  return (
    <div>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <ul className={`${MASONRY_COLUMNS[columns] ?? MASONRY_COLUMNS[3]} gap-3`}>
        {items.map((item, i) => {
          const figure = (
            <figure className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.caption} loading="lazy" className="block h-auto w-full" />
              {item.caption && <figcaption className="px-3 py-2 text-sm text-ink-soft">{item.caption}</figcaption>}
            </figure>
          );
          return (
            <li key={i} className="mb-3 break-inside-avoid">
              {item.href ? (
                <StoreLink href={item.href} className="block transition-opacity hover:opacity-90">
                  {figure}
                </StoreLink>
              ) : (
                figure
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A button whose `action` is add_to_cart or buy_now; null for any other button. */
export function productAction(props: Props): "add_to_cart" | "buy_now" | null {
  const action = str(props, "action");
  return action === "add_to_cart" || action === "buy_now" ? action : null;
}

/** "Add to cart" / "Buy now" for the button's product (the page's product when it names none). */
export async function ProductActionElement({
  props,
  workspaceId,
  editable,
}: {
  props: Props;
  workspaceId: string;
  editable: boolean;
}) {
  const label = str(props, "label");
  const mode = productAction(props);
  if (!label.trim() || !mode) return null;
  const product = await productFor(workspaceId, str(props, "productId"));
  if (!product || product.variants.length === 0) return null;
  const variant = str(props, "variant", "primary");
  return (
    <CartActionButton
      productId={product.id}
      variants={product.variants.map((v) => ({ id: v.id, inStock: v.inStock }))}
      variantId={str(props, "variantId")}
      productHref={needsProductPage(product) ? `/products/${product.slug}` : null}
      mode={mode}
      label={label}
      className={BUTTON_CLASS[variant] ?? BUTTON_CLASS.primary}
      editable={editable}
    />
  );
}

/** Each variant's price as the price element shows it, so the pick can switch it without a round trip. */
export function variantPriceTags(product: StorefrontProductDetail, currency: string, locale: Locale): Record<string, PriceTag> {
  const out: Record<string, PriceTag> = {};
  for (const v of product.variants) {
    const amount = variantUnitPrice(product, v);
    const compare = v.compareAtAmount === null ? 0 : parseMoney(v.compareAtAmount);
    out[v.id] = {
      amount,
      price: formatPrice(amount, currency, locale),
      compareAt: compare > amount ? formatPrice(compare, currency, locale) : null,
    };
  }
  return out;
}
