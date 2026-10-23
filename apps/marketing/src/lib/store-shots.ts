/**
 * Real captures of the ZIMOS storefront wearing templates from its library
 * (public/stores): the demo store's home page on a 1280px screen — its top
 * 1200px, shrunk to 960x900 — and the same store on a 390px phone, its top
 * 1600px. Taken from the local stack, each template's published site with
 * its shell file applied to the store and the store in English. Below that
 * the demo store's shared catalogue shows the same clothes in every template,
 * so the captures stop there.
 */
const LOOKS = ["13", "08", "11", "07", "04", "10"] as const;

export const STORE_SHOTS: Record<string, { desk: string; phone: string }> = Object.fromEntries(
  LOOKS.map((look) => [look, { desk: `/stores/look-${look}-desk.webp`, phone: `/stores/look-${look}-phone.webp` }]),
);

/**
 * The credit each look's licence asks for wherever its design is shown,
 * copied from the storefront's XS_CREDITS (apps/storefront/src/lib/xsShell.ts;
 * store-shots.test.ts keeps the two equal), with a link to the licence where
 * it has one. Written under the gallery, it covers the hero's looks too.
 */
export const SHOT_CREDITS: Record<string, { name: string; author: string; href: string; licence: string; licenceHref?: string }> = {
  "04": { name: "Ashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "07": { name: "Fruitables", author: "HTML Codex", href: "https://htmlcodex.com", licence: "CC BY 4.0", licenceHref: "https://creativecommons.org/licenses/by/4.0/" },
  "08": { name: "Karma", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "10": { name: "Estore", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
  "11": { name: "Swanky", author: "TemplatesJungle", href: "https://templatesjungle.com", licence: "free with attribution" },
  "13": { name: "Watch", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0", licenceHref: "https://creativecommons.org/licenses/by/3.0/" },
};

/** The stores the hero cycles through, one after the other. */
export const HERO_LOOKS = ["13", "08", "11"] as const;

/** The template gallery, best first. */
export const GALLERY_LOOKS = LOOKS;
