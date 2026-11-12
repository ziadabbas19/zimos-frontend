import type { CSSProperties } from "react";
import { fontPick, fontStack, readStoreFonts, resolveFontPair, type FontPair, type ResolvedFontPair, type StoreFonts } from "@store-builder/ui/fonts";

/**
 * How the fonts a merchant picked are put on the page (the shared rules are
 * in @store-builder/ui/fonts; the faces come from lib/storeFonts.server.ts).
 *
 * Every override is the same four declarations — the store's two type
 * tokens, the text's own family, and the picks alone for imported bands:
 *
 *   --font-sans:    "zf-en-…", "zf-ar-…", var(--zf-base-sans)
 *   --font-display: "zf-en-…", "zf-ar-…", var(--zf-base-display)
 *   font-family:    var(--font-sans)
 *   --zf-xs-pick:   "zf-en-…", "zf-ar-…",
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
 *   the store's footer font → the store                       (data-zf-part="footer")
 *   the store's product font → the store                      (data-zf-part="product")
 * An element or section with its own font is marked `data-zf-node`, and the
 * store-wide product rule steps aside inside it: the nearer pick wins.
 *
 * An imported template's band, header and footer (`data-xs-look`, a store
 * that wears a template: `data-xs-shell`) set their words in the look's own
 * `--xs-sans` / `--xs-display`, declared on the band itself. So there the
 * picks are put in front of the look's faces one level down (xsFontRules):
 * the look's faces are copied on the band (`--zf-xs-*`), and every child of
 * the band reads `--xs-sans: <the picks>, <the look's faces>`. A script left
 * on default keeps the template's face, as before.
 */

const BASE_SANS = "var(--zf-base-sans)";
const BASE_DISPLAY = "var(--zf-base-display)";
const NO_PICK = "--zf-xs-pick:initial";

/** The declarations for one resolved pair; null when it picks nothing. */
function declarations(pair: ResolvedFontPair): string[] | null {
  const sans = fontStack(pair, BASE_SANS);
  const display = fontStack(pair, BASE_DISPLAY);
  if (!sans || !display) return null;
  return [`--font-sans:${sans}`, `--font-display:${display}`, "font-family:var(--font-sans)", `--zf-xs-pick:${fontPick(pair)}`];
}

/** The same declarations as an inline style, for one element, section, page or product. */
export function fontStyle(pair: ResolvedFontPair): CSSProperties | undefined {
  const sans = fontStack(pair, BASE_SANS);
  const display = fontStack(pair, BASE_DISPLAY);
  if (!sans || !display) return undefined;
  return { "--font-sans": sans, "--font-display": display, fontFamily: "var(--font-sans)", "--zf-xs-pick": fontPick(pair) } as CSSProperties;
}

/** The store's own stacks, for a part that picks nothing (the editor's live preview only). */
const BASE = [`--font-sans:${BASE_SANS}`, `--font-display:${BASE_DISPLAY}`, "font-family:var(--font-sans)", NO_PICK];

/**
 * The imported bands' half (see above), for every band of the store
 * (`store`: the store, its header or its footer picked a font) or only for
 * the bands inside a section or element that has one (`node`). Each band
 * keeps a copy of its look's faces, its children put the picks in front of
 * them — never on the same element, so no custom property reads itself —
 * and the band's direct children take the face again (they would otherwise
 * inherit the band's own, resolved before the picks): at no specificity, so
 * a look that sets a face on a part of its own still wins there.
 */
export function xsFontRules(scope: "store" | "node"): string {
  const band = scope === "store" ? ".brand-theme [data-xs-look]" : ".brand-theme [data-zf-node] [data-xs-look]";
  const capture = scope === "store" ? `.brand-theme[data-xs-shell],${band}` : band;
  const inside = scope === "store" ? `.brand-theme[data-xs-shell]>:not([data-xs-look]),${band}>:not([data-xs-look])` : `${band}>:not([data-xs-look])`;
  return (
    `${capture}{--zf-xs-sans:var(--xs-sans);--zf-xs-display:var(--xs-display,var(--xs-sans))}` +
    `${inside}{--xs-sans:var(--zf-xs-pick,) var(--zf-xs-sans);--xs-display:var(--zf-xs-pick,) var(--zf-xs-display)}` +
    `:where(${band})>:not([data-xs-look]){font-family:var(--xs-sans)}`
  );
}

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
  const footer = resolveFontPair(fonts.footer, fonts.primary);
  const products = resolveFontPair(fonts.products, fonts.primary);
  const own = (pair: ResolvedFontPair) => Boolean(pair.ar || pair.en);
  let css = "";
  const primary = declarations(fonts.primary) ?? (complete ? BASE : null);
  if (primary) {
    // The picks alone on the wrapper itself, for the imported bands anywhere in the store.
    css += `.brand-theme{${primary[3]}}`;
    // The tokens on the wrapper's children, never the wrapper: there `--zf-base-*` is read from the very tokens this sets.
    css += `.brand-theme:not([data-xs-shell])>*{${primary.join(";")}}`;
  }
  // The header and the footer: the store's own (a box around them), or a template's (its <header>/<footer>, a band).
  for (const [part, pair, picked] of [
    ["header", header, own(fonts.header)],
    ["footer", footer, own(fonts.footer)],
  ] as const) {
    if (!picked && !complete) continue;
    const decl = declarations(pair) ?? BASE;
    css += `.brand-theme [data-zf-part="${part}"]:not([data-xs-look]){${decl.join(";")}}`;
    css += `.brand-theme [data-zf-part="${part}"][data-xs-look]{${decl[3]}}`;
  }
  const product = own(fonts.products) || complete ? (declarations(products) ?? BASE) : null;
  if (product) css += `.brand-theme [data-zf-part="product"]:not([data-zf-node] *){${product.join(";")}}`;
  if (css) css += xsFontRules("store");
  return { css, pairs: [fonts.primary, header, footer, products], fonts };
}

/** A product page's pair: the product's own font, then the store's product font, then the store's. */
export function productFontPair(themeSettings: Record<string, unknown> | null | undefined, productFont: FontPair | null | undefined): ResolvedFontPair {
  const fonts = readStoreFonts(themeSettings);
  return resolveFontPair(productFont, fonts.products, fonts.primary);
}
