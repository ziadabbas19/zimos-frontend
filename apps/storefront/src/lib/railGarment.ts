import type { StorefrontProduct } from "@store-builder/api-client";

/**
 * How a product hangs on the clothing rail (the template band `xs_rail`)
 * when it has no photo: which garment to draw, and in what colour. Read from
 * what the merchant already wrote (the name, the product type, the tags and a
 * colour option), never asked for separately. Pure, so the tests run it in Node.
 */

export type GarmentKind = "tee" | "knit" | "hoodie" | "shirt" | "jacket" | "coat";

// Checked in order: a "sweatshirt" is a knit before it is a shirt, a
// "t-shirt" a tee, a "long sleeve tee" a knit. Arabic words have no \b in
// JavaScript's regexes, so they match as they are written.
const KIND_WORDS: Array<[GarmentKind, RegExp]> = [
  ["coat", /\b(coat|overcoat|trench|parka|peacoat)\b|بالطو|معطف/i],
  ["jacket", /\b(jacket|blazer|bomber|windbreaker|gilet)\b|جاكيت|جاكت|بليزر|سترة|جيليه/i],
  ["hoodie", /\b(hoodie|hoody|hooded)\b|هودي|هودى|كابيشون/i],
  ["knit", /\b(sweater|sweatshirt|cardigan|knit|knitwear|pullover|jumper|crewneck|henley|turtleneck|long ?sleeve)\b|بلوفر|كارديجان|سويتر|سويت ?شيرت|تريكو|كم طويل|هاي كول/i],
  ["tee", /\b(t-?shirt|tee|polo|tank)\b|تي ?شيرت|تيشيرت|تيشرت|بولو/i],
  ["shirt", /\b(shirt|oxford|blouse|overshirt)\b|قميص|قمصان|بلوزة|شيميز/i],
];

/** The garment a product reads as; a tee when nothing names one. */
export function garmentKind(text: string): GarmentKind {
  for (const [kind, words] of KIND_WORDS) if (words.test(text)) return kind;
  return "tee";
}

/** The words a product is known by: its name, its type and its tags. */
export function garmentText(product: Pick<StorefrontProduct, "name" | "productType" | "tags">): string {
  return [product.name, product.productType, ...(Array.isArray(product.tags) ? product.tags : [])]
    .filter((part) => typeof part === "string")
    .join(" ");
}

const COLOUR_KEY = /colou?r|لون/i;

// Common colour names, in English and Arabic, as a fabric would read.
const COLOURS: Array<[RegExp, string]> = [
  [/off ?white|cream|ivory|beige|sand|bone|كريمي|بيج|اوف وايت|أوف وايت/i, "#e8dfcc"],
  [/black|أسود|اسود/i, "#1d1f22"],
  [/white|أبيض|ابيض/i, "#f2f0eb"],
  [/navy|كحلي/i, "#22314d"],
  [/sky|light blue|baby blue|لبني|سماوي/i, "#a3d3eb"],
  [/blue|أزرق|ازرق/i, "#3d6fb6"],
  [/burgundy|maroon|wine|نبيتي|عنابي/i, "#6e2333"],
  [/red|أحمر|احمر/i, "#b23a30"],
  [/pink|rose|وردي|بينك|روز/i, "#e7a6b8"],
  [/olive|زيتي|زيتوني/i, "#758151"],
  [/green|أخضر|اخضر/i, "#2f6b45"],
  [/mustard|ochre|مسطردة|خردلي/i, "#de9c31"],
  [/yellow|أصفر|اصفر/i, "#e2bf3a"],
  [/orange|برتقالي/i, "#e07a35"],
  [/camel|tan|كاميل|جملي/i, "#b8895a"],
  [/brown|chocolate|بني/i, "#6b4a33"],
  [/lilac|lavender|ليلكي/i, "#ccb2e0"],
  [/purple|violet|بنفسجي|موف/i, "#7a5a9e"],
  [/khaki|كاكي/i, "#a89a6a"],
  [/grey|gray|heather|رمادي|رصاصي/i, "#9ea3a8"],
];

/** A colour value as CSS: a hex code as written, or a named colour we know; null otherwise. */
export function colourOf(value: string): string | null {
  const v = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  for (const [names, hex] of COLOURS) if (names.test(v)) return hex;
  return null;
}

/** The swatch the merchant picked for the first colour of a colour option (the public product's `options`). */
function swatchOf(options: unknown): string | null {
  for (const option of Array.isArray(options) ? options : []) {
    if (!option || typeof option !== "object") continue;
    const { name, values, swatches } = option as { name?: unknown; values?: unknown; swatches?: unknown };
    if (typeof name !== "string" || !COLOUR_KEY.test(name) || !swatches || typeof swatches !== "object") continue;
    const order = Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : [];
    for (const value of [...order, ...Object.keys(swatches)]) {
      const hex = (swatches as Record<string, unknown>)[value];
      if (typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex)) return hex;
    }
  }
  return null;
}

/**
 * The product's first colour we can paint: the swatch the merchant picked for
 * it, else a variant's colour / لون value read as a colour.
 */
export function garmentColour(product: Pick<StorefrontProduct, "variants"> & { options?: unknown }): string | null {
  const swatch = swatchOf(product.options);
  if (swatch) return swatch;
  for (const variant of Array.isArray(product.variants) ? product.variants : []) {
    for (const [key, value] of Object.entries(variant?.optionValues ?? {})) {
      if (!COLOUR_KEY.test(key) || typeof value !== "string") continue;
      const colour = colourOf(value);
      if (colour) return colour;
    }
  }
  return null;
}

// Fabric shades for products that name no colour, taken in turn so the rail isn't one tone.
const FABRICS = ["#e4dfd3", "#22314d", "#758151", "#b05139", "#a0a5ab", "#1d1f22", "#de9c31", "#a3d3eb"];

export function fabricAt(index: number): string {
  return FABRICS[((index % FABRICS.length) + FABRICS.length) % FABRICS.length] as string;
}

/**
 * The choices a shopper picks from (sizes and the like), colour left out:
 * short facts for the detail view. In the order the merchant set on the
 * product's options when it has them, else as its variants name them.
 */
export function optionDetails(product: Pick<StorefrontProduct, "variants"> & { options?: unknown }, max = 6): string[] {
  const seen: string[] = [];
  for (const option of Array.isArray(product.options) ? product.options : []) {
    if (!option || typeof option !== "object") continue;
    const { name, values } = option as { name?: unknown; values?: unknown };
    if (typeof name !== "string" || COLOUR_KEY.test(name) || !Array.isArray(values)) continue;
    for (const value of values) {
      const v = typeof value === "string" ? value.trim() : "";
      if (v && !seen.includes(v)) seen.push(v);
      if (seen.length >= max) return seen;
    }
  }
  if (seen.length > 0) return seen;
  for (const variant of Array.isArray(product.variants) ? product.variants : []) {
    for (const [key, value] of Object.entries(variant?.optionValues ?? {})) {
      if (COLOUR_KEY.test(key) || typeof value !== "string") continue;
      const v = value.trim();
      if (v && !seen.includes(v)) seen.push(v);
      if (seen.length >= max) return seen;
    }
  }
  return seen;
}

/**
 * A formatted price without a fraction of zeros ("٨٢٠٫٠٠ ج.م." → "٨٢٠ ج.م.",
 * "EGP 820.00" → "EGP 820"), for a hang-tag that has to read at a glance. A
 * price with real piastres keeps them.
 */
export function compactPrice(text: string): string {
  return text.replace(/([0-9٠-٩])[.,٫][0٠]+(?![0-9٠-٩])/g, "$1");
}

/** A choice the shopper makes in the rail's detail view: its values, and a swatch for each colour when the merchant picked one. */
export interface BuyGroup {
  name: string;
  values: string[];
  swatches?: Record<string, string>;
}

/**
 * The choices to pick before adding to the cart, in the order the merchant
 * set on the product's options (with their colour swatches), keeping only
 * the axes and values its variants actually have. Without options, the
 * variants' own values in first-seen order.
 */
export function buyGroups(product: Pick<StorefrontProduct, "variants"> & { options?: unknown }): BuyGroup[] {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const seen = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant?.optionValues ?? {})) {
      if (typeof value !== "string" || !value) continue;
      const values = seen.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      seen.set(name, values);
    }
  }
  const groups: BuyGroup[] = [];
  for (const option of Array.isArray(product.options) ? product.options : []) {
    if (!option || typeof option !== "object") continue;
    const { name, values, swatches } = option as { name?: unknown; values?: unknown; swatches?: unknown };
    const real = typeof name === "string" ? seen.get(name) : undefined;
    if (!real || typeof name !== "string") continue;
    const ordered = [
      ...(Array.isArray(values) ? values.filter((v): v is string => typeof v === "string" && real.includes(v)) : []),
      ...real.filter((v) => !(Array.isArray(values) && values.includes(v))),
    ];
    const colours: Record<string, string> = {};
    if (swatches && typeof swatches === "object") {
      for (const value of ordered) {
        const hex = (swatches as Record<string, unknown>)[value];
        if (typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex)) colours[value] = hex;
      }
    }
    groups.push({ name, values: ordered, ...(Object.keys(colours).length > 0 ? { swatches: colours } : {}) });
    seen.delete(name);
  }
  for (const [name, values] of seen) groups.push({ name, values });
  return groups;
}

/** Whether the merchant tagged the product as new ("new" / "جديد"): it gets a "new" mark on its hang-tag. */
export function isNewProduct(product: Pick<StorefrontProduct, "tags">): boolean {
  return (Array.isArray(product.tags) ? product.tags : []).some((tag) => typeof tag === "string" && /^(new|جديد|nouveau)$/i.test(tag.trim()));
}

/** A description from the catalogue's editor, read as plain words and cut at a word. */
export function plainDescription(raw: string | null | undefined, max = 160): string {
  const text = String(raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
