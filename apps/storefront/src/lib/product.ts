import type {
  StorefrontOffer,
  StorefrontProduct,
  StorefrontVariant,
} from "@store-builder/api-client";
import { parseMoney } from "@store-builder/api-client";

/**
 * Pure helpers over the public product shapes. Safe on server and client.
 */

/**
 * `media` is typed `unknown` on the storefront API; in practice it's the
 * catalogue's ProductMedia[] (`{ url, path, mimeType, size }`). Read it
 * defensively and keep only absolute http(s) URLs — the storefront runs on a
 * different origin from the API, so host-relative paths wouldn't resolve.
 */
export function productImages(product: Pick<StorefrontProduct, "media">): string[] {
  const media = product.media;
  const list: unknown[] = Array.isArray(media)
    ? media
    : media && typeof media === "object" && Array.isArray((media as { images?: unknown }).images)
      ? ((media as { images: unknown[] }).images)
      : [];

  const urls: string[] = [];
  for (const entry of list) {
    let candidate: unknown = entry;
    if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      const mime = typeof o.mimeType === "string" ? o.mimeType : "";
      if (mime && !mime.startsWith("image/")) continue;
      candidate = o.url ?? o.src;
    }
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate.trim())) {
      urls.push(candidate.trim());
    }
  }
  return urls;
}

export function firstImage(product: Pick<StorefrontProduct, "media">): string | null {
  return productImages(product)[0] ?? null;
}

export function defaultOfferOf(product: StorefrontProduct): StorefrontOffer | undefined {
  return product.offers.find((o) => o.isDefault) ?? product.offers[0];
}

/**
 * Something to fill in or pick before it goes into the cart — custom fields or
 * menu options — so a one-tap add sends the shopper to the product page instead.
 */
export function needsProductPage(product: Pick<StorefrontProduct, "customFields" | "optionGroups" | "hasOptionGroups">): boolean {
  return Boolean(
    (product.customFields && product.customFields.length > 0) ||
      product.hasOptionGroups ||
      (product.optionGroups && product.optionGroups.length > 0)
  );
}

/** An offer with no lines is product-wide; otherwise it must name the variant. */
export function offerAppliesTo(offer: StorefrontOffer, variantId: string | undefined): boolean {
  if (!variantId) return true;
  return offer.lines.length === 0 || offer.lines.some((l) => l.variantId === variantId);
}

/** Headline price — the default offer when there is one, else the first variant. */
export function priceOf(product: StorefrontProduct): number | undefined {
  const offer = defaultOfferOf(product);
  if (offer) return parseMoney(offer.priceAmount);
  const v = product.variants[0];
  return v ? parseMoney(v.priceAmount) : undefined;
}

/** Struck-through price, only when it's genuinely higher than the price shown. */
export function compareAtOf(product: StorefrontProduct): number | null {
  const price = priceOf(product);
  const candidates = product.variants
    .map((v) => (v.compareAtAmount === null ? 0 : parseMoney(v.compareAtAmount)))
    .filter((n) => n > 0);
  const compare = candidates.length ? Math.max(...candidates) : 0;
  return price !== undefined && compare > price ? compare : null;
}

export function variantUnitPrice(
  product: StorefrontProduct,
  variant: StorefrontVariant | undefined
): number {
  const offer = defaultOfferOf(product);
  if (offer && offerAppliesTo(offer, variant?.id) && product.variants.length <= 1) {
    return parseMoney(offer.priceAmount);
  }
  if (variant) return parseMoney(variant.priceAmount);
  return priceOf(product) ?? 0;
}

export interface ProductOptionGroup {
  name: string;
  values: string[];
}

/** Option axes derived from the variants' optionValues, in first-seen order. */
export function optionGroups(variants: StorefrontVariant[]): ProductOptionGroup[] {
  const groups = new Map<string, string[]>();
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.optionValues ?? {})) {
      if (!value) continue;
      const values = groups.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      groups.set(name, values);
    }
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => ({ name, values }));
}

export function findVariant(
  variants: StorefrontVariant[],
  selection: Record<string, string>
): StorefrontVariant | undefined {
  return variants.find((v) =>
    Object.entries(selection).every(([name, value]) => v.optionValues?.[name] === value)
  );
}

export function variantLabel(variant: { optionValues?: Record<string, string> | null } | null | undefined): string {
  if (!variant) return "";
  return Object.values(variant.optionValues ?? {}).filter(Boolean).join(" / ");
}

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
