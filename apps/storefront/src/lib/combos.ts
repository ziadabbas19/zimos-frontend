import {
  comboUnitTotal,
  parseMoney,
  type CartLine,
  type ComboSelection,
  type StorefrontCombo,
  type StorefrontProduct,
  type StorefrontVariant,
} from "@store-builder/api-client";
import { lineImage } from "./variantImage";
import type { QuoteLine } from "./useShippingQuote";

/**
 * Combos on the storefront: different products sold together at one price
 * (api-client endpoints/combos.ts). The server sends `product.combos` only
 * while combos are on, prices every combo again in the cart and at checkout,
 * and turns a combo into its products in the order. Everything priced here is
 * for display.
 */

type ComboItem = StorefrontCombo["items"][number];

/** The variant the shopper picked, by the id of each component that lets them choose. */
export type ComboPicks = Record<string, string>;

const httpUrl = (value: unknown): string | null =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : null;

/** The combo's own picture, else its products' pictures (up to `max`) to show side by side. */
export function comboImages(combo: StorefrontCombo, max = 3): string[] {
  const own = httpUrl(combo.imageUrl);
  if (own) return [own];
  const urls: string[] = [];
  for (const item of combo.items) {
    const url = httpUrl(item.product?.imageUrl);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls.slice(0, max);
}

/** Nothing picked, except a component with one variant in stock: there is nothing to choose there. */
export function initialComboPicks(combo: StorefrontCombo): ComboPicks {
  const picks: ComboPicks = {};
  for (const item of combo.items) {
    if (item.pickVariant && item.variants.length === 1 && item.variants[0].inStock) picks[item.id] = item.variants[0].id;
  }
  return picks;
}

/** A component's variant: its own when the merchant fixed it, else the one picked (none yet: undefined). */
function chosenVariant(item: ComboItem, picks: ComboPicks): StorefrontVariant | undefined {
  if (!item.pickVariant) return item.variants[0];
  const id = picks[item.id];
  return id ? item.variants.find((v) => v.id === id) : undefined;
}

/**
 * One combo's price for these picks: the server's own until the shopper picks
 * something, then the same rule over the picked variants (a component not
 * picked yet at its first in-stock variant, as the server prices the card).
 */
export function comboPriceFor(combo: StorefrontCombo, picks: ComboPicks): { full: number; total: number; saving: number } {
  if (!combo.items.some((item) => item.pickVariant && picks[item.id])) return combo.price;
  let full = 0;
  for (const item of combo.items) {
    const variant = chosenVariant(item, picks) ?? item.variants.find((v) => v.inStock);
    if (variant) full += parseMoney(variant.priceAmount) * item.quantity;
  }
  const total = comboUnitTotal(combo.pricingMode, combo.priceValue, full);
  return { full, total, saving: Math.max(0, full - total) };
}

/** What the cart is sent for these picks; null while a component still waits for its pick. */
export function comboSelectionOf(combo: StorefrontCombo, picks: ComboPicks): ComboSelection | null {
  const selection: ComboSelection = [];
  for (const item of combo.items) {
    if (!item.pickVariant) continue;
    const id = picks[item.id];
    if (!id || !item.variants.some((v) => v.id === id)) return null;
    selection.push({ itemId: item.id, variantId: id });
  }
  return selection;
}

/** Sold out: the server says it cannot be bought, or a product or a picked variant has no stock. */
export function comboSoldOut(combo: StorefrontCombo, picks: ComboPicks): boolean {
  if (!combo.available) return true;
  return combo.items.some((item) => {
    if (!item.product) return true;
    const variant = chosenVariant(item, picks);
    if (!item.pickVariant) return !variant || !variant.inStock;
    return variant ? !variant.inStock : !item.variants.some((v) => v.inStock);
  });
}

/** The option names a component's variants differ by ("Size", "اللون"), for its chooser's prompt. */
export function comboOptionNames(item: ComboItem): string[] {
  const names: string[] = [];
  for (const variant of item.variants) {
    for (const name of Object.keys(variant.optionValues ?? {})) if (!names.includes(name)) names.push(name);
  }
  return names;
}

// --- cart lines -----------------------------------------------------------------

/** A cart line that holds a whole combo. */
export function isComboLine(line: Pick<CartLine, "comboId">): boolean {
  return Boolean(line.comboId);
}

/** A combo the server can no longer sell: it counts nothing, and the checkout would refuse the cart. */
export function isUnavailableLine(line: Pick<CartLine, "unavailable">): boolean {
  return line.unavailable === true;
}

/** What a combo line would cost bought apart, when that is more than the line: shown struck through. */
export function comboLineFullTotal(line: Pick<CartLine, "comboId" | "fullUnitPrice" | "quantity" | "lineTotal">): number | null {
  if (!line.comboId || line.fullUnitPrice == null) return null;
  const full = parseMoney(line.fullUnitPrice) * line.quantity;
  return full > line.lineTotal ? full : null;
}

/** A combo line's pictures: its products' (up to two, side by side), from the catalogue. */
export function comboLineImages(line: CartLine, byVariant: Map<string, StorefrontProduct>): string[] {
  const variantIds = line.combo?.items.map((item) => item.variantId) ?? [line.variantId];
  const urls: string[] = [];
  for (const id of variantIds) {
    const product = byVariant.get(id);
    const url = product ? lineImage(product, id) : null;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls.slice(0, 2);
}

/**
 * The cart's lines as the shipping quote takes them: a combo by its id and
 * picks (never its first product), a combo that can no longer be bought left
 * out (it counts nothing and the server would refuse it).
 */
export function cartQuoteLines(items: CartLine[]): QuoteLine[] {
  return items
    .filter((line) => !isUnavailableLine(line))
    .map((line) =>
      line.comboId
        ? { comboId: line.comboId, comboSelection: line.comboSelection ?? [], quantity: line.quantity }
        : { variantId: line.variantId, offerId: line.offerId, quantity: line.quantity }
    );
}

/**
 * The products a cart holds, by id: a combo line counts every product in it.
 * For what is offered beside the cart (the order bump, cross-sells).
 */
export function cartProductIds(items: CartLine[], byVariant: Map<string, StorefrontProduct>): string[] {
  const ids: string[] = [];
  for (const line of items) {
    const lineIds = line.combo ? line.combo.items.map((item) => item.productId) : [byVariant.get(line.variantId)?.id];
    for (const id of lineIds) if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
