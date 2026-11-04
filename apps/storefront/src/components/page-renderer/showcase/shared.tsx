import { ApiError, type StorefrontProduct } from "@store-builder/api-client";
import type { CSSProperties, ReactNode } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { compareAtOf, defaultOfferOf, discountPercent, firstImage, needsProductPage, offerAppliesTo, priceOf } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { type Props, bool, num, resolveHref, safeUrl, str } from "../props";
import { CartButton } from "./CartButton";
import { StoreImage } from "@/components/StoreImage";

/**
 * What the showcase sections share: reading their props, fetching the
 * merchant's real products, and the one product tile several of them draw.
 *
 * Like every other element these treat props as untrusted (props.ts), and a
 * catalogue call that fails renders nothing rather than taking the page down.
 */

/** A text prop in the shopper's language: the `…En` twin on an English store, else the main one. */
export function loc(props: Props, key: string, locale: Locale): string {
  if (locale === "en") {
    const en = str(props, `${key}En`).trim();
    if (en) return en;
  }
  return str(props, key);
}

/** The same choice for a list of short lines. */
export function locList(props: Props, key: string, locale: Locale): string[] {
  const read = (k: string) => {
    const v = props[k];
    return Array.isArray(v) ? v.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
  };
  if (locale === "en") {
    const en = read(`${key}En`);
    if (en.length) return en;
  }
  return read(key);
}

/** A list of objects out of a prop — never trusted to be one. */
export function items(props: Props, key: string, max: number): Props[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is Props => !!item && typeof item === "object" && !Array.isArray(item)).slice(0, max);
}

const TONES = new Set(["plain", "primary", "secondary", "cool"]);

/** The band's ground; "plain" (the page's own surface) for anything else. */
export function toneOf(props: Props): string | undefined {
  const tone = str(props, "tone");
  return TONES.has(tone) && tone !== "plain" ? tone : undefined;
}

/** A custom property a stylesheet rule reads — Tailwind can't build a class from a runtime number. */
export function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(vars)) {
    if (value !== undefined && value !== "") style[name] = String(value);
  }
  return style as CSSProperties;
}

/** A merchant link as a store link, or null when there is nothing usable in it. */
export function linkOf(props: Props, key: string): string | null {
  return resolveHref(str(props, key));
}

export { bool, num, safeUrl, str };
export type { Props };

// --- catalogue ---------------------------------------------------------------

/**
 * The first `limit` products of a collection (by id or slug), in the order the
 * merchant arranged it; the whole catalogue, newest first, when none is named.
 * Null when the call failed — not the same as "none".
 */
export async function collectionProducts(
  workspaceId: string,
  collection: string,
  limit: number
): Promise<StorefrontProduct[] | null> {
  try {
    const client = await createServerStorefrontApiClient();
    const ref = collection.trim();
    const { products } = await client.searchStorefrontProducts(workspaceId, {
      ...(ref ? { collection: ref, sort: "position" as const } : { sort: "newest" as const }),
      limit,
    });
    return products;
  } catch {
    return null;
  }
}

/** One product by id or slug; null when it is gone, unpublished or the call failed. */
export async function productByRef(workspaceId: string, ref: string): Promise<StorefrontProduct | null> {
  const idOrSlug = ref.trim();
  if (!idOrSlug) return null;
  try {
    const client = await createServerStorefrontApiClient();
    return await client.getStorefrontProduct(workspaceId, encodeURIComponent(idOrSlug));
  } catch (err) {
    if (err instanceof ApiError) return null;
    return null;
  }
}

/** Everything a tile needs to know about a product's price. */
export function pricing(product: StorefrontProduct, currency: string, locale: Locale) {
  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  return {
    price,
    compareAt,
    now: price !== undefined ? formatPrice(price, currency, locale) : "—",
    was: compareAt ? formatPrice(compareAt, currency, locale) : null,
    percent: price !== undefined ? discountPercent(price, compareAt) : null,
    saving: price !== undefined && compareAt ? compareAt - price : 0,
  };
}

/**
 * The cart action under a product: one tap for a product with a single
 * in-stock variant and nothing to fill in, otherwise the same-looking link to
 * the product page, where the options are chosen (ProductCard's own rule).
 */
export function ProductAction({
  product,
  label,
  locale,
  className = "zs-atc",
  children,
}: {
  product: StorefrontProduct;
  /** The merchant's own wording; the store dictionary's when empty. */
  label: string;
  locale: Locale;
  className?: string;
  /** Replaces the text — an icon-only button still gets `label` as its name. */
  children?: ReactNode;
}) {
  const t = getDictionary(locale);
  const text = label.trim() || t.product.addToCart;
  const anyInStock = product.variants.some((v) => v.inStock);
  const only = product.variants.length === 1 ? product.variants[0] : undefined;
  const quick = only && only.inStock && !needsProductPage(product) ? only : undefined;
  const offer = quick ? defaultOfferOf(product) : undefined;

  if (quick) {
    return (
      <CartButton
        variantId={quick.id}
        offerId={offer && offerAppliesTo(offer, quick.id) ? offer.id : undefined}
        label={text}
        className={className}
      >
        {children}
      </CartButton>
    );
  }
  if (!anyInStock) {
    return (
      <span className={className} aria-disabled="true">
        {children ?? (product.variants.length === 0 ? t.common.unavailable : t.common.outOfStock)}
      </span>
    );
  }
  return (
    <StoreLink href={`/products/${product.slug}`} className={className} aria-label={children ? text : undefined}>
      {children ?? text}
    </StoreLink>
  );
}

/** A product tile for the sliding bands: picture, discount pill, name, price, cart. */
export function ProductTile({
  product,
  currency,
  locale,
  className,
  cartLabel,
  showDiscount,
  showSoldOut = false,
  fit,
  inert = false,
}: {
  product: StorefrontProduct;
  currency: string;
  locale: Locale;
  className: string;
  cartLabel: string;
  showDiscount: boolean;
  showSoldOut?: boolean;
  fit: string;
  /** A decorative repeat of the tile (the rail's train): out of the tab order. */
  inert?: boolean;
}) {
  const t = getDictionary(locale);
  const image = firstImage(product);
  const { now, was, percent } = pricing(product, currency, locale);
  const href = `/products/${product.slug}`;
  const soldOut = !product.variants.some((v) => v.inStock);

  return (
    <article className={`zs-pcard ${className}`} aria-hidden={inert || undefined} inert={inert || undefined}>
      <StoreLink href={href} className="zs-pcard__media" tabIndex={-1} aria-hidden>
        <div className="zs-pcard__box">
          {showDiscount && percent ? <span className="zs-badge">-{percent}%</span> : null}
          {showSoldOut && soldOut ? <span className="zs-soldout">{t.common.outOfStock}</span> : null}
          {image ? (
            <StoreImage
              src={image}
              alt=""
              width={900}
              height={900}
              sizes="(max-width: 768px) 50vw, 25vw"
              loading="lazy"
              decoding="async"
              draggable={false}
              className="zs-pcard__img"
              data-fit={fit === "cover" ? "cover" : undefined}
            />
          ) : null}
        </div>
      </StoreLink>
      <div className="zs-pcard__meta">
        <h3 className="zs-pcard__title">
          <StoreLink href={href}>{product.name}</StoreLink>
        </h3>
        <div className="zs-pcard__price">
          {was ? <s>{was}</s> : null}
          <span>{now}</span>
        </div>
        <ProductAction product={product} label={cartLabel} locale={locale} />
      </div>
    </article>
  );
}
