/**
 * Real captures of the ZIMOS storefront wearing templates from its library
 * (public/stores): the demo store's home page on a 1280px screen — its top
 * 1200px, shrunk to 960x900 — and the same store on a 390px phone, its top
 * 1600px. Taken from the local stack, each template's published site with
 * its shell file applied to the store and the store in English. Below that
 * the demo store's shared catalogue shows the same clothes in every template,
 * so the captures stop there.
 *
 * Looks 07 (Fruitables) and 11 (Swanky) are not shown anywhere: the licence
 * of the pictures inside them is unclear (the owner, 2026-10-23). Their
 * captures stay in public/stores.
 */
const LOOKS = ["13", "08", "04", "10"] as const;

export const STORE_SHOTS: Record<string, { desk: string; phone: string }> = Object.fromEntries(
  LOOKS.map((look) => [look, { desk: `/stores/look-${look}-desk.webp`, phone: `/stores/look-${look}-phone.webp` }]),
);

/**
 * The credit each look's licence asks for wherever its design is shown,
 * copied from the storefront's XS_CREDITS (apps/storefront/src/lib/xsShell.ts;
 * store-shots.test.ts keeps the two equal), with a link to the licence where
 * it has one. Written under the gallery, it covers every look on the page:
 * the hero, the benefits card and the closing band show gallery looks only.
 */
export const SHOT_CREDITS: Record<string, { name: string; author: string; href: string; licence: string; licenceHref?: string }> = {
  "04": { name: "Ashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "08": { name: "Karma", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "10": { name: "Estore", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "13": { name: "Watch", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
};

/** The stores the hero cycles through, one after the other. */
export const HERO_LOOKS = ["13", "08", "04"] as const;

/** The template gallery, best first. */
export const GALLERY_LOOKS = LOOKS;

/** Three templates fanned out in the benefits' big card, the middle one in front. */
export const FAN_LOOKS = ["04", "10", "08"] as const;

/** Three stores on phones in the closing band, the middle one in front. */
export const END_LOOKS = ["04", "10", "13"] as const;
