import { fontAlias, fontFaceCss, fontIndex, googleFontsCssUrl, type FontOption, type FontRole } from "@store-builder/ui/fonts";
import { serverApiBase, serverApiFetch } from "./serverApiBase";

/**
 * The faces a store page draws its picked fonts in (lib/storeFonts.ts).
 *
 * Why Google Fonts and not next/font: a store's fonts are its merchant's
 * pick, known only per request, and next/font needs every family at build
 * time — self-hosting the whole catalog would put ~100 families in every
 * build for the handful one store uses. So the server asks Google for the
 * stylesheet of each family a page uses, once per process (kept for a day),
 * and writes the faces into the page itself (components/fonts/StoreFontFaces):
 *
 *  - no stylesheet request for the shopper and nothing to block the first
 *    paint on; the font files come from fonts.gstatic.com (preconnected),
 *    shared with every other site that uses the same family;
 *  - only the faces the page names, each limited to its role's letters
 *    (Arabic or Latin, see fontFaceCss), with `font-display: swap`; a browser
 *    downloads a file only when text on screen needs it;
 *  - nothing depends on the host the store was reached on, so custom domains
 *    and `<slug>.zimos.co` render the same.
 *
 * Both lookups fail soft: no catalog or no stylesheet means no face, and the
 * part is drawn in the store's own stack (the stack always ends in it).
 */

const CATALOG_TTL_MS = 60 * 60 * 1000;
const FACES_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_AFTER_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;
const MAX_FACES = 400;

// Google answers woff2 (the smallest files, with unicode ranges) to a current browser only.
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

type Cached<T> = { at: number; ttl: number; value: T };

let catalog: Cached<Map<string, FontOption>> | null = null;
let catalogLoad: Promise<Map<string, FontOption>> | null = null;

async function loadCatalog(): Promise<Map<string, FontOption>> {
  try {
    const res = await serverApiFetch(`${serverApiBase()}/fonts`, { headers: { Accept: "application/json" } }, { timeoutMs: FETCH_TIMEOUT_MS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { fonts?: FontOption[] };
    const index = fontIndex(Array.isArray(body.fonts) ? body.fonts : []);
    catalog = { at: Date.now(), ttl: CATALOG_TTL_MS, value: index };
    return index;
  } catch (err) {
    console.warn(`[fonts] The font catalog could not be read (${err instanceof Error ? err.message : "error"}); picked fonts fall back to the store's own until it can.`);
    // Keep whatever was there; try again in a minute.
    catalog = { at: Date.now(), ttl: RETRY_AFTER_MS, value: catalog?.value ?? new Map() };
    return catalog.value;
  }
}

/** The catalog by id; an empty map while the API can't be read. */
export async function getFontIndex(): Promise<Map<string, FontOption>> {
  if (catalog && Date.now() - catalog.at < catalog.ttl) return catalog.value;
  catalogLoad ??= loadCatalog().finally(() => {
    catalogLoad = null;
  });
  return catalogLoad;
}

const faces = new Map<string, Cached<string>>();
const facesLoad = new Map<string, Promise<string>>();

async function loadFaces(font: FontOption, role: FontRole, key: string): Promise<string> {
  const url = googleFontsCssUrl(font);
  let css = "";
  let ttl = RETRY_AFTER_MS;
  if (url) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, Accept: "text/css" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      css = fontFaceCss(await res.text(), role, fontAlias(role, font.id));
      if (css) ttl = FACES_TTL_MS;
    } catch (err) {
      console.warn(`[fonts] ${font.family} could not be loaded (${err instanceof Error ? err.message : "error"}).`);
    }
  }
  if (faces.size >= MAX_FACES) faces.delete(faces.keys().next().value as string);
  faces.set(key, { at: Date.now(), ttl, value: css });
  return css;
}

/** The @font-face rules for one picked font in one role; "" when they can't be had right now. */
export async function getFontFaces(font: FontOption, role: FontRole): Promise<string> {
  const key = `${role}:${font.id}:${font.variable ? font.variable.join("-") : font.weights.join(",")}`;
  const hit = faces.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  let pending = facesLoad.get(key);
  if (!pending) {
    pending = loadFaces(font, role, key).finally(() => facesLoad.delete(key));
    facesLoad.set(key, pending);
  }
  return pending;
}
