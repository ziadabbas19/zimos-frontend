/**
 * Store fonts — what the dashboard and the storefront share.
 *
 * The catalog itself is the API's (GET /api/v1/fonts, backend
 * modules/fonts/fontCatalog.js): one list, and the API refuses any font id
 * that is not on it. What is stored is only ever an id:
 *
 *   themeSettings.fonts = { primaryAr, primaryEn,         the whole store
 *                           header:   { ar, en },         store name, menu, announcement bar
 *                           footer:   { ar, en },         the store's footer
 *                           products: { ar, en } }        product pages and product cards
 *   page tree:  data.font, section.settings.font, element.settings.font = { ar, en }
 *   product:    pageSettings.font = { ar, en }            that product's page
 *
 * null or absent anywhere = "use what this part sits in", down to the
 * store's look as it was before fonts could be picked.
 *
 * How a pair is drawn (the storefront):
 *
 *   font-family: "zf-en-<id>", "zf-ar-<id>", <the store's own stack>
 *
 * Each picked face is registered under its own name per role, and only for
 * its role's letters: the English face only for Latin unicode ranges, the
 * Arabic face only for Arabic ones (fontFaceCss). So Latin letters always
 * come from the English pick and Arabic letters from the Arabic pick — even
 * when a face has both alphabets, like Cairo or Rubik — and a script left on
 * "store default" falls through to the store's own stack.
 *
 * Nothing in this file trusts its input: ids are matched against a pattern
 * and looked up in the catalog, family names against another, and the
 * Google stylesheet is rebuilt from the values it is checked to hold.
 */

export type FontScript = "ar" | "latin" | "both";
export type FontCategory = "sans" | "serif" | "display" | "handwriting" | "mono" | "kufi" | "naskh" | "ruqaa";
/** Which letters a pick is for: Arabic text, or English (Latin) text. */
export type FontRole = "ar" | "en";

/** One catalog entry, as GET /api/v1/fonts sends it. */
export interface FontOption {
  id: string;
  family: string;
  script: FontScript;
  category: FontCategory;
  weights: number[];
  /** The range of the family's weight axis, when it has one. */
  variable?: [number, number];
  preview: string;
}

export interface FontPair {
  ar?: string | null;
  en?: string | null;
}

/** A pair with both roles decided: an id, or null for "the store's own". */
export interface ResolvedFontPair {
  ar: string | null;
  en: string | null;
}

export interface StoreFonts {
  primary: ResolvedFontPair;
  header: ResolvedFontPair;
  footer: ResolvedFontPair;
  products: ResolvedFontPair;
}

export const FONT_ROLES: readonly FontRole[] = ["ar", "en"];
export const FONT_CATEGORIES: readonly FontCategory[] = ["sans", "serif", "display", "handwriting", "mono", "kufi", "naskh", "ruqaa"];

const FONT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FAMILY = /^[A-Za-z0-9 ]{1,60}$/;

const objectOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export function isFontId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 60 && FONT_ID.test(value);
}

/** Whether `font` may be picked for `role` text. */
export function fontFitsRole(font: Pick<FontOption, "script">, role: FontRole): boolean {
  return font.script === "both" || font.script === (role === "ar" ? "ar" : "latin");
}

/** A saved pair, each id checked for shape; null when it holds neither. */
export function readFontPair(raw: unknown): ResolvedFontPair | null {
  const pair = objectOf(raw);
  if (!pair) return null;
  const ar = isFontId(pair.ar) ? pair.ar : null;
  const en = isFontId(pair.en) ? pair.en : null;
  return ar || en ? { ar, en } : null;
}

const NONE: ResolvedFontPair = { ar: null, en: null };

/**
 * The first id per role, most specific first:
 * resolveFontPair(element, section, page, store) — the order a part is drawn in.
 */
export function resolveFontPair(...levels: Array<FontPair | null | undefined>): ResolvedFontPair {
  const out: ResolvedFontPair = { ar: null, en: null };
  for (const level of levels) {
    if (!level) continue;
    if (out.ar === null && isFontId(level.ar)) out.ar = level.ar;
    if (out.en === null && isFontId(level.en)) out.en = level.en;
  }
  return out;
}

/** `themeSettings.fonts`, read defensively: anything missing or malformed is "the store's own". */
export function readStoreFonts(themeSettings: Record<string, unknown> | null | undefined): StoreFonts {
  const fonts = objectOf(themeSettings?.fonts);
  if (!fonts) return { primary: NONE, header: NONE, footer: NONE, products: NONE };
  const primary: ResolvedFontPair = {
    ar: isFontId(fonts.primaryAr) ? fonts.primaryAr : null,
    en: isFontId(fonts.primaryEn) ? fonts.primaryEn : null,
  };
  return {
    primary,
    header: readFontPair(fonts.header) ?? NONE,
    footer: readFontPair(fonts.footer) ?? NONE,
    products: readFontPair(fonts.products) ?? NONE,
  };
}

/** The `themeSettings.fonts` value for a StoreFonts, leaving out every "store's own"; null when nothing is picked. */
export function storeFontsValue(fonts: StoreFonts): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  if (fonts.primary.ar) out.primaryAr = fonts.primary.ar;
  if (fonts.primary.en) out.primaryEn = fonts.primary.en;
  const pair = (p: ResolvedFontPair) => (p.ar || p.en ? { ...(p.ar ? { ar: p.ar } : {}), ...(p.en ? { en: p.en } : {}) } : null);
  const header = pair(fonts.header);
  const footer = pair(fonts.footer ?? NONE);
  const products = pair(fonts.products);
  if (header) out.header = header;
  if (footer) out.footer = footer;
  if (products) out.products = products;
  return Object.keys(out).length > 0 ? out : null;
}

export function hasFont(pair: FontPair | null | undefined): boolean {
  return Boolean(pair && (isFontId(pair.ar) || isFontId(pair.en)));
}

export function sameFontPair(a: FontPair | null | undefined, b: FontPair | null | undefined): boolean {
  return (a?.ar ?? null) === (b?.ar ?? null) && (a?.en ?? null) === (b?.en ?? null);
}

/** The name a face is registered under for one role: `zf-ar-cairo`, `zf-en-inter`. */
export function fontAlias(role: FontRole, id: string): string {
  return `zf-${role}-${id}`;
}

/** A catalog keyed by id, with every entry whose id or family isn't safe left out. */
export function fontIndex(fonts: readonly FontOption[] | null | undefined): Map<string, FontOption> {
  const map = new Map<string, FontOption>();
  for (const font of fonts ?? []) {
    if (font && isFontId(font.id) && typeof font.family === "string" && FAMILY.test(font.family)) map.set(font.id, font);
  }
  return map;
}

/** The weights a store page asks for: what the family has between 300 and 800. */
function pageWeights(font: FontOption): string {
  if (font.variable) {
    // Inside the axis, narrowed to 300–800 where the axis is wider.
    let lo = Math.max(font.variable[0], 300);
    let hi = Math.min(font.variable[1], 800);
    if (lo >= hi) [lo, hi] = font.variable;
    return lo >= hi ? "" : `:wght@${lo}..${hi}`;
  }
  const weights = (font.weights ?? []).filter((w) => Number.isInteger(w) && w >= 300 && w <= 800);
  if (weights.length === 0 || (weights.length === 1 && weights[0] === 400)) return "";
  return `:wght@${weights.join(";")}`;
}

const GOOGLE_CSS = "https://fonts.googleapis.com/css2";

/**
 * The Google Fonts stylesheet for one family. A store page asks for the
 * weights it can draw; a picker's preview (`text`) asks for exactly the
 * letters it shows, in the regular weight — a few kilobytes per font.
 */
export function googleFontsCssUrl(font: FontOption, { text }: { text?: string } = {}): string | null {
  if (!FAMILY.test(font.family)) return null;
  const family = font.family.replace(/ /g, "+");
  if (text !== undefined) {
    return `${GOOGLE_CSS}?family=${family}&text=${encodeURIComponent(text)}&display=swap`;
  }
  return `${GOOGLE_CSS}?family=${family}${pageWeights(font)}&display=swap`;
}

/** The subsets each role keeps from Google's stylesheet. */
export const ROLE_SUBSETS: Record<FontRole, readonly string[]> = { ar: ["arabic"], en: ["latin", "latin-ext"] };

/** One face of a Google Fonts stylesheet, every value checked. */
export interface GoogleFace {
  /** The subset Google names above the face ("arabic", "latin"…); null on a `text=` stylesheet. */
  subset: string | null;
  /** A font file on fonts.gstatic.com. */
  src: string;
  /** "400", or a range like "300 800" for a variable face. */
  weight: string;
  style: "normal" | "italic";
  unicodeRange: string | null;
}

const BLOCK = /(?:\/\*\s*([a-z0-9-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
const SRC = /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[A-Za-z0-9/_.?=&%-]+)\)\s*format\(['"]woff2['"]\)/;
const WEIGHT = /font-weight:\s*(\d{3}(?:\s+\d{3})?)\s*;/;
const STYLE = /font-style:\s*(normal|italic)\s*;/;
const RANGE = /unicode-range:\s*([U+0-9A-Fa-f?,\s-]+);/;

/**
 * The faces of a Google Fonts stylesheet. Each value is matched, never
 * copied as text: a woff2 file on fonts.gstatic.com, a numeric weight, a
 * unicode range. A face missing any of them is left out.
 */
export function parseGoogleFontCss(css: string): GoogleFace[] {
  const out: GoogleFace[] = [];
  for (const match of css.matchAll(BLOCK)) {
    const [, subset, body] = match;
    const src = SRC.exec(body)?.[1];
    const weight = WEIGHT.exec(body)?.[1];
    if (!src || !weight) continue;
    out.push({
      subset: subset ?? null,
      src,
      weight,
      style: (STYLE.exec(body)?.[1] as "normal" | "italic" | undefined) ?? "normal",
      unicodeRange: RANGE.exec(body)?.[1]?.trim() ?? null,
    });
  }
  return out;
}

/** A store page's faces: a plain font file, never a `text=` subset. */
const PAGE_FILE = /^https:\/\/fonts\.gstatic\.com\/s\/[A-Za-z0-9/_.-]+\.woff2$/;

/**
 * Google's stylesheet for a family, rebuilt as the faces one role may use:
 * only that role's subsets, under the role's own name (parseGoogleFontCss
 * checks every value), so nothing else in the response can reach the page.
 * Empty when the response holds no usable face.
 */
export function fontFaceCss(googleCss: string, role: FontRole, alias: string): string {
  if (!/^zf-(ar|en)-[a-z0-9-]+$/.test(alias)) return "";
  const keep = ROLE_SUBSETS[role];
  return parseGoogleFontCss(googleCss)
    .filter((face) => face.subset !== null && keep.includes(face.subset) && face.unicodeRange && PAGE_FILE.test(face.src))
    .map(
      (face) =>
        `@font-face{font-family:"${alias}";font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url(${face.src}) format("woff2");unicode-range:${face.unicodeRange}}`
    )
    .join("");
}

/**
 * A `font-family` value for a resolved pair: the English pick, the Arabic
 * pick, then `base` — the store's own stack, which catches every letter the
 * picks don't cover and a script left on "store default". Null when the
 * pair picks nothing (the part keeps what it inherits).
 */
export function fontStack(pair: ResolvedFontPair, base: string): string | null {
  const faces: string[] = [];
  if (pair.en) faces.push(`"${fontAlias("en", pair.en)}"`);
  if (pair.ar) faces.push(`"${fontAlias("ar", pair.ar)}"`);
  return faces.length > 0 ? [...faces, base].join(", ") : null;
}

/** Every (role, id) a set of pairs uses, once each. */
export function fontUses(...pairs: Array<FontPair | null | undefined>): Array<{ role: FontRole; id: string }> {
  const seen = new Set<string>();
  const out: Array<{ role: FontRole; id: string }> = [];
  for (const pair of pairs) {
    for (const role of FONT_ROLES) {
      const id = pair?.[role];
      if (!isFontId(id) || seen.has(`${role}:${id}`)) continue;
      seen.add(`${role}:${id}`);
      out.push({ role, id });
    }
  }
  return out;
}

/**
 * The picked faces alone, each followed by a comma — `"zf-en-inter", "zf-ar-cairo", ` —
 * for a stack that continues with a face only known further down the page:
 * an imported template's band puts its own faces after it (lib/storeFonts.ts
 * in the storefront, `--zf-xs-pick`). Empty when the pair picks nothing.
 */
export function fontPick(pair: ResolvedFontPair): string {
  let out = "";
  if (pair.en) out += `"${fontAlias("en", pair.en)}", `;
  if (pair.ar) out += `"${fontAlias("ar", pair.ar)}", `;
  return out;
}

// --- where a font comes from (the editors' "source" line) ---------------------

/**
 * The parts of a store that can have a font of their own, as the editors
 * name them. A page part sits in its section, its page and the store; a
 * store part (header, footer, products) in the store; one product in the
 * store's product font, then the store.
 */
export type FontLevel = "element" | "section" | "page" | "store" | "header" | "footer" | "products" | "product";

export interface FontLevelPair {
  level: FontLevel;
  pair: FontPair | null | undefined;
}

export interface FontSource {
  level: FontLevel;
  id: string;
}

/**
 * Per script, the nearest level that picks a face — the part's own first,
 * then each level it sits in — or null when none does and the part shows the
 * store's theme (or template) face. The same order the storefront draws in
 * (resolveFontPair).
 */
export function fontSources(levels: FontLevelPair[]): Record<FontRole, FontSource | null> {
  const out: Record<FontRole, FontSource | null> = { ar: null, en: null };
  for (const { level, pair } of levels) {
    for (const role of FONT_ROLES) {
      const id = pair?.[role];
      if (out[role] === null && isFontId(id)) out[role] = { level, id };
    }
  }
  return out;
}

/** The store's own pair (its primary faces) as a level a part can inherit from. */
export function storeLevel(fonts: StoreFonts): FontLevelPair {
  return { level: "store", pair: fonts.primary };
}

/**
 * Element types that draw no words of their own — a picture, a gap, a line, a
 * map, a video, someone else's page — so the editors offer them no font.
 * Every other element type carries text (its words, a label, a price, a
 * field) and takes `settings.font`; the API accepts it on all of them.
 */
export const FONTLESS_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  "image",
  "video",
  "embed",
  "spacer",
  "divider",
  "icon",
  "map",
  "social_icons",
  "html_block",
]);

export function elementTakesFont(type: string): boolean {
  return !FONTLESS_ELEMENT_TYPES.has(type);
}
