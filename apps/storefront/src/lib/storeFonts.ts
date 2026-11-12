import type { CSSProperties } from "react";
import { fontStack, readStoreFonts, resolveFontPair, type FontPair, type ResolvedFontPair, type StoreFonts } from "@store-builder/ui/fonts";

/**
 * How the fonts a merchant picked are put on the page (the shared rules are
 * in @store-builder/ui/fonts; the faces come from lib/storeFonts.server.ts).
 *
 * Every override is the same three declarations — the store's two type
 * tokens and the text's own family:
 *
 *   --font-sans:    "zf-en-…", "zf-ar-…", var(--zf-base-sans)
 *   --font-display: "zf-en-…", "zf-ar-…", var(--zf-base-display)
 *   font-family:    var(--font-sans)
 *
 * `--zf-base-*` (globals.css) are the store's own stacks — its theme's, or
 * the original look's — captured on the store wrapper, so a script left on
 * "store default" and every letter a pick has no glyph for fall through to
 * exactly what the store drew before. Headings and anything else that reads
 * the tokens follow the override too.
 *
 * Where each pair lands, most specific first (resolveFontPair):
 *   an element  → its section → its page → the store       (PageRenderer)
 *   a product's own font → the store's product font → the store (product page)
 *   the store's header font → the store                       (data-zf-part="header")
 *   the store's product font → the store                      (data-zf-part="product")
 * An element or section with its own font is marked `data-zf-node`, and the
 * store-wide product rule steps aside inside it: the nearer pick wins.
 *
 * A store that wears an imported template (data-xs-shell) keeps its template's
 * faces (Store look → Template look) on the template's own bands, header and
 * footer: they read the look's `--xs-sans`, not these tokens.
 */

const BASE_SANS = "var(--zf-base-sans)";
const BASE_DISPLAY = "var(--zf-base-display)";

/** The declarations for one resolved pair; null when it picks nothing. */
function declarations(pair: ResolvedFontPair): string[] | null {
  const sans = fontStack(pair, BASE_SANS);
  const display = fontStack(pair, BASE_DISPLAY);
  if (!sans || !display) return null;
  return [`--font-sans:${sans}`, `--font-display:${display}`, "font-family:var(--font-sans)"];
}

/** The same declarations as an inline style, for one element, section, page or product. */
export function fontStyle(pair: ResolvedFontPair): CSSProperties | undefined {
  const sans = fontStack(pair, BASE_SANS);
  const display = fontStack(pair, BASE_DISPLAY);
  if (!sans || !display) return undefined;
  return { "--font-sans": sans, "--font-display": display, fontFamily: "var(--font-sans)" } as CSSProperties;
}

/** The store's own stacks, for a part that picks nothing (the editor's live preview only). */
const BASE = [`--font-sans:${BASE_SANS}`, `--font-display:${BASE_DISPLAY}`, "font-family:var(--font-sans)"];

/**
 * What the store layout needs: the store's fonts as rules, and every pair they
 * name (for the faces). `complete` (the editor's live preview, components/fonts/
 * LiveStoreFonts) writes every part, a part that picks nothing as the store's
 * own stacks, so it also undoes a saved pick the merchant has just removed.
 */
export function storeFontRules(
  themeSettings: Record<string, unknown> | null | undefined,
  { complete = false }: { complete?: boolean } = {}
): { css: string; pairs: ResolvedFontPair[]; fonts: StoreFonts } {
  const fonts = readStoreFonts(themeSettings);
  const header = resolveFontPair(fonts.header, fonts.primary);
  const products = resolveFontPair(fonts.products, fonts.primary);
  let css = "";
  const primary = declarations(fonts.primary) ?? (complete ? BASE : null);
  // On the wrapper's children, never the wrapper: there `--zf-base-*` is read from the very tokens this sets.
  if (primary) css += `.brand-theme:not([data-xs-shell])>*{${primary.join(";")}}`;
  const head = fonts.header.ar || fonts.header.en || complete ? (declarations(header) ?? BASE) : null;
  if (head) css += `.brand-theme [data-zf-part="header"]{${head.join(";")}}`;
  const product = fonts.products.ar || fonts.products.en || complete ? (declarations(products) ?? BASE) : null;
  if (product) css += `.brand-theme [data-zf-part="product"]:not([data-zf-node] *){${product.join(";")}}`;
  return { css, pairs: [fonts.primary, header, products], fonts };
}

/** A product page's pair: the product's own font, then the store's product font, then the store's. */
export function productFontPair(themeSettings: Record<string, unknown> | null | undefined, productFont: FontPair | null | undefined): ResolvedFontPair {
  const fonts = readStoreFonts(themeSettings);
  return resolveFontPair(productFont, fonts.products, fonts.primary);
}
