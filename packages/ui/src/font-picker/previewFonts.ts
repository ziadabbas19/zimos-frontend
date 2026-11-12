import { ROLE_SUBSETS, googleFontsCssUrl, parseGoogleFontCss, type FontOption, type FontRole } from "../fonts";

/**
 * Drawing catalog fonts inside a dashboard — never all of them at once.
 *
 * Each face is registered with the FontFace API under a name of its own
 * (`zfp-…` for a picker row, `zfs-…` for a sample), so the dashboard's own
 * type — which uses some of the same families, Tajawal among them — is
 * never touched, and no stylesheet is added to the page.
 *
 *  - A picker row asks Google for its family with `text=` set to exactly the
 *    letters the row shows: a few kilobytes, fetched only once the row
 *    scrolls into view or is pointed at.
 *  - A sample (Store settings → Fonts) registers the family's faces for one
 *    role's letters, like the storefront does; the browser downloads a file
 *    only when the sample's text needs it.
 *
 * Anything that fails — no network, no FontFace (tests) — leaves the text in
 * the dashboard's own face; nothing is retried until the page reloads.
 */

const loads = new Map<string, Promise<boolean>>();

const canLoad = () => typeof document !== "undefined" && typeof FontFace !== "undefined" && typeof fetch !== "undefined" && Boolean(document.fonts);

async function register(url: string, family: string, keep: (subset: string | null) => boolean, eager: boolean): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) return false;
  const faces = parseGoogleFontCss(await res.text()).filter((face) => keep(face.subset));
  if (faces.length === 0) return false;
  const added = faces.map((face) => {
    const descriptors: FontFaceDescriptors = { style: face.style, weight: face.weight, display: "swap" };
    if (face.unicodeRange) descriptors.unicodeRange = face.unicodeRange;
    const fontFace = new FontFace(family, `url(${face.src}) format("woff2")`, descriptors);
    // `add` is FontFaceSet's set-like half, which some TypeScript DOM libraries leave out.
    (document.fonts as unknown as { add(face: FontFace): void }).add(fontFace);
    return fontFace;
  });
  if (eager) await Promise.all(added.map((f) => f.load()));
  return true;
}

function once(key: string, run: () => Promise<boolean>): Promise<boolean> {
  let pending = loads.get(key);
  if (!pending) {
    pending = canLoad() ? run().catch(() => false) : Promise.resolve(false);
    loads.set(key, pending);
  }
  return pending;
}

/** The family a picker row draws `font` in. */
export function previewFamily(id: string): string {
  return `zfp-${id}`;
}

/** The letters a picker row shows for `font`: its name and its sample. */
export function previewText(font: FontOption): string {
  return `${font.family} ${font.preview}`;
}

/** Loads the few letters a picker row shows; resolves true once they can be drawn. */
export function loadPreviewFont(font: FontOption): Promise<boolean> {
  const url = googleFontsCssUrl(font, { text: previewText(font) });
  return once(`p:${font.id}`, () => (url ? register(url, previewFamily(font.id), () => true, true) : Promise.resolve(false)));
}

/** The family a sample draws one role's letters in. */
export function sampleFamily(role: FontRole, id: string): string {
  return `zfs-${role}-${id}`;
}

/**
 * Registers `font` for one role's letters under `family`, the way a store
 * page uses it: the browser downloads a file only when text needs it.
 */
export function loadRoleFont(font: FontOption, role: FontRole, family: string): Promise<boolean> {
  const url = googleFontsCssUrl(font);
  const keep = ROLE_SUBSETS[role];
  return once(`r:${family}:${font.id}`, () =>
    url ? register(url, family, (subset) => subset !== null && keep.includes(subset), false) : Promise.resolve(false)
  );
}

/** Registers `font` for one role's letters as a sample's face (sampleFamily). */
export function loadSampleFont(font: FontOption, role: FontRole): Promise<boolean> {
  return loadRoleFont(font, role, sampleFamily(role, font.id));
}

/** A sample's `font-family`: the English pick, the Arabic pick, then the dashboard's own face. */
export function sampleStack(pair: { ar: string | null; en: string | null }, fallback = "system-ui, sans-serif"): string {
  const faces: string[] = [];
  if (pair.en) faces.push(`"${sampleFamily("en", pair.en)}"`);
  if (pair.ar) faces.push(`"${sampleFamily("ar", pair.ar)}"`);
  return [...faces, fallback].join(", ");
}
