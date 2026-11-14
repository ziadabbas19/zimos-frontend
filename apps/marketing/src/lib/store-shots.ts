/**
 * Real captures of the ZIMOS storefront wearing templates from its library
 * (public/stores): the demo store's home page on a 1280px screen — its top
 * 1200px, shrunk to 960x900 — and the same store on a 390px phone, its top
 * 1600px. Taken from the local stack, each template's published site with
 * its shell file applied to the store and the store in English. Below that
 * the demo store's shared catalogue shows the same clothes in every template,
 * so the captures stop there.
 *
 * Look 23 (Atelier) is ZIMOS's own design, so it asks for no credit, and it
 * is the one store shown in Arabic: its two captures are the template
 * library's own pictures of it (apps/storefront/public/template-art, 1280x800
 * shrunk to 960x600), one per language. It has no phone capture.
 *
 * Looks 07 (Fruitables) and 11 (Swanky) are not shown anywhere: the licence
 * of the pictures inside them is unclear (the owner, 2026-10-23). Their
 * captures stay in public/stores.
 */
const IMPORTED = ["13", "08", "04", "10"] as const;

/** ZIMOS's own templates among the looks shown: no credit, a capture in each language. */
export const OWN_LOOKS: readonly string[] = ["23"];

const LOOKS = ["23", ...IMPORTED] as const;

export interface StoreShot {
  desk: string;
  /** The same page in Arabic, where there is one. */
  deskAr?: string;
  /** Imported looks only. */
  phone?: string;
}

export const STORE_SHOTS: Record<string, StoreShot> = {
  ...Object.fromEntries(
    IMPORTED.map((look) => [look, { desk: `/stores/look-${look}-desk.webp`, phone: `/stores/look-${look}-phone.webp` }]),
  ),
  "23": { desk: "/stores/look-23-desk.webp", deskAr: "/stores/look-23-desk-ar.webp" },
};

/** A look's computer capture in the page's language, the English one when it has no other. */
export function deskShot(look: string, locale: string): string {
  const shot = STORE_SHOTS[look];
  return (locale === "ar" && shot.deskAr) || shot.desk;
}

/**
 * The credit each look's licence asks for wherever its design is shown,
 * copied from the storefront's XS_CREDITS (apps/storefront/src/lib/xsShell.ts;
 * store-shots.test.ts keeps the two equal), with a link to the licence where
 * it has one. Written on the credits page (app/[locale]/credits), linked from
 * every page's footer, it covers every imported look on the site: the hero
 * and the order's journey show gallery looks only. ZIMOS's own looks
 * (OWN_LOOKS) have none.
 */
export const SHOT_CREDITS: Record<string, { name: string; author: string; href: string; licence: string; licenceHref?: string }> = {
  "04": { name: "Ashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "08": { name: "Karma", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "10": { name: "Estore", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "13": { name: "Watch", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
};

/** The stores the hero's computer frame cycles through, one after the other. */
export const HERO_LOOKS = ["23", "13", "08"] as const;

/**
 * The phones beside the hero's laptop: the first on its left, the last on
 * its right. The middle one shows on a phone screen only, where the laptop
 * steps aside and the three stand as a fan.
 */
export const HERO_PHONES = ["04", "13", "08"] as const;

/** The store gallery, best first. */
export const GALLERY_LOOKS = LOOKS;

/** The store whose picture stands in the order's journey (the ad, and the page it opens). */
export const JOURNEY_LOOK = "13";
