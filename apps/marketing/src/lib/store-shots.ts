/**
 * The stores the site shows are the template library's own, drawn by the
 * storefront itself (see GALLERY below).
 *
 * Looks 23 (Atelier) and 24 (Cradle) are the library's own designs, so they
 * ask for no credit; every other look is an imported design whose licence
 * asks for one (SHOT_CREDITS).
 *
 * Looks 07 (Fruitables) and 11 (Swanky) are not shown anywhere: the licence
 * of the pictures inside them is unclear (the owner, 2026-10-23).
 */

/** ZIMOS's own templates among the looks shown: no credit. */
export const OWN_LOOKS: readonly string[] = ["23", "24"];

/**
 * The credit each imported look's licence asks for wherever its design is
 * shown, copied from the storefront's XS_CREDITS
 * (apps/storefront/src/lib/xsShell.ts; store-shots.test.ts keeps the two
 * equal), with a link to the licence where it is a Creative Commons one.
 * Written on the credits page (app/[locale]/credits), linked from every
 * page's footer, it covers every imported look on the site. ZIMOS's own
 * looks (OWN_LOOKS) have none.
 */
export const SHOT_CREDITS: Record<string, { name: string; author: string; href: string; licence: string; licenceHref?: string }> = {
  "01": { name: "Coza Store", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "02": { name: "Furni", author: "Untree.co", href: "https://untree.co", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "03": { name: "Kaira", author: "TemplatesJungle", href: "https://templatesjungle.com", licence: "free with attribution" },
  "04": { name: "Ashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "05": { name: "Male Fashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "06": { name: "EShopper", author: "HTML Codex", href: "https://htmlcodex.com", licence: "CC BY 4.0", licenceHref: "https://creativecommons.org/licenses/by/4.0/" },
  "08": { name: "Karma", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "09": { name: "Pillowmart", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "10": { name: "Estore", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "12": { name: "MiniStore", author: "TemplatesJungle", href: "https://templatesjungle.com", licence: "free with attribution" },
  "13": { name: "Watch", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "14": { name: "Famms", author: "html.design", href: "https://html.design", licence: "free with attribution" },
  "15": { name: "Electro", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "16": { name: "Tailstore", author: "Spacema Dev", href: "https://github.com/spacemadev", licence: "MIT" },
  "17": { name: "Tropika", author: "html.design", href: "https://html.design", licence: "free with attribution" },
  "18": { name: "Feane", author: "html.design", href: "https://html.design", licence: "free with attribution" },
  "19": { name: "Tasty", author: "FreeHTML5.co", href: "https://freehtml5.co", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "20": { name: "Restoran", author: "HTML Codex", href: "https://htmlcodex.com", licence: "CC BY 4.0", licenceHref: "https://creativecommons.org/licenses/by/4.0/" },
  "21": { name: "Restaurant", author: "ThemeWagon", href: "https://themewagon.com", licence: "GPL v3" },
  "22": { name: "Automark", author: "Themefisher", href: "https://themefisher.com", licence: "MIT" },
};

/**
 * The stores of the gallery: every template of the platform's library as a
 * whole store, captured from the storefront itself wearing the template with
 * its own demo catalogue — the home page from top to bottom on a 1280px
 * screen and on a 390px phone, in Arabic and in English (public/stores/full),
 * and the top of each as the gallery's card (public/stores/card). Best first:
 * the first six are what the gallery shows before "show every store".
 *
 * A store's kind is its template's category in the platform's own list, with
 * the single-product store among electronics (it sells a watch) and the
 * general one under "other".
 */
export const STORE_KINDS = ["fashion", "home", "food", "electronics", "kids", "other"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

export const GALLERY: readonly { look: string; kind: StoreKind }[] = [
  { look: "23", kind: "fashion" },
  { look: "24", kind: "kids" },
  { look: "13", kind: "electronics" },
  { look: "02", kind: "home" },
  { look: "18", kind: "food" },
  { look: "05", kind: "fashion" },
  { look: "04", kind: "fashion" },
  { look: "15", kind: "electronics" },
  { look: "09", kind: "home" },
  { look: "20", kind: "food" },
  { look: "01", kind: "fashion" },
  { look: "12", kind: "electronics" },
  { look: "17", kind: "food" },
  { look: "10", kind: "fashion" },
  { look: "03", kind: "fashion" },
  { look: "19", kind: "food" },
  { look: "08", kind: "fashion" },
  { look: "14", kind: "fashion" },
  { look: "21", kind: "food" },
  { look: "06", kind: "fashion" },
  { look: "16", kind: "fashion" },
  { look: "22", kind: "other" },
];

/** How many stores the gallery shows before it is asked for all of them. */
export const GALLERY_FIRST = 6;

/** Every look of the gallery, in its order. */
export const GALLERY_LOOKS: readonly string[] = GALLERY.map((store) => store.look);

/**
 * A gallery store's picture: `card` is the top of its home page (720x450 on a
 * computer, 260x520 on a phone), `full` the whole page (1200 and 520 wide).
 */
export function galleryShot(look: string, locale: string, device: "desk" | "phone", size: "card" | "full"): string {
  return `/stores/${size}/look-${look}-${locale === "ar" ? "ar" : "en"}-${device}.webp`;
}

/** The stores the hero's laptop cycles through, one after the other. */
export const HERO_LOOKS = ["23", "13", "02"] as const;

/**
 * The phones beside the hero's laptop: the first on its left, the last on
 * its right. The middle one shows on a phone screen only, where the laptop
 * steps aside and the three stand as a fan.
 */
export const HERO_PHONES = ["24", "23", "18"] as const;

/**
 * The picture in the order's journey (the ad, and the page it opens): the
 * watch store's opening on a computer, an earlier capture kept as it is
 * because the drawing's crop is cut to it (home.css `.zx-ad__media img`).
 */
export const JOURNEY_LOOK = "13";
export const JOURNEY_SHOT = "/stores/look-13-desk.webp";
