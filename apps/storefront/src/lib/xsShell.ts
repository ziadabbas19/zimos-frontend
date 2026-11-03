/**
 * The imported templates ("xs" looks) the storefront draws, by number, each
 * with the attribution its licence requires wherever its design is shown.
 * That line is written under any page that uses one of the look's bands
 * (page-renderer/xs XsCredit) or, on a store that wears the look's whole
 * shell, in its footer (components/xs/XsFooter) — and it stays for as long
 * as the look does.
 *
 * A look designed by Zimos itself owes no one a line: its entry is null, which
 * still makes it a look the storefront knows (xsShellOf, page-renderer/xs).
 */
export type XsCredit = { name: string; author: string; href: string; licence: string };
export const XS_CREDITS: Record<string, XsCredit | null> = {
  "01": { name: "Coza Store", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "02": { name: "Furni", author: "Untree.co", href: "https://untree.co", licence: "CC BY 3.0" },
  "03": { name: "Kaira", author: "TemplatesJungle", href: "https://templatesjungle.com", licence: "free with attribution" },
  "04": { name: "Ashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "05": { name: "Male Fashion", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "06": { name: "EShopper", author: "HTML Codex", href: "https://htmlcodex.com", licence: "CC BY 4.0" },
  "07": { name: "Fruitables", author: "HTML Codex", href: "https://htmlcodex.com", licence: "CC BY 4.0" },
  "08": { name: "Karma", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "09": { name: "Pillowmart", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "10": { name: "Estore", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "11": { name: "Swanky", author: "TemplatesJungle", href: "https://templatesjungle.com", licence: "free with attribution" },
  "12": { name: "MiniStore", author: "TemplatesJungle", href: "https://templatesjungle.com", licence: "free with attribution" },
  "13": { name: "Watch", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "14": { name: "Famms", author: "html.design", href: "https://html.design", licence: "free with attribution" },
  "15": { name: "Electro", author: "Colorlib", href: "https://colorlib.com", licence: "CC BY 3.0" },
  "16": { name: "Tailstore", author: "Spacema Dev", href: "https://github.com/spacemadev", licence: "MIT" },
  "17": { name: "Tropika", author: "html.design", href: "https://html.design", licence: "free with attribution" },
  "18": { name: "Feane", author: "html.design", href: "https://html.design", licence: "free with attribution" },
  "19": { name: "Tasty", author: "FreeHTML5.co", href: "https://freehtml5.co", licence: "CC BY 3.0" },
  "20": { name: "Restoran", author: "HTML Codex", href: "https://htmlcodex.com", licence: "CC BY 4.0" },
  "21": { name: "Restaurant", author: "ThemeWagon", href: "https://themewagon.com", licence: "GPL v3" },
  "22": { name: "Automark", author: "Themefisher", href: "https://themefisher.com", licence: "MIT" },
  // Atelier: Zimos's own, made around the clothing rail.
  "23": null,
  // Cradle: a merchant's own theme brought over from Shopify (mother and baby).
  "24": null,
};

/**
 * Each template's own logo (public/xs/NN/), drawn where the store's name would
 * be while the merchant has set no logo of their own — in the editor's Header
 * or Footer panel (`header.logo.image`, `footer.logo.image`) or, for the
 * header, the store's logo in its settings. `footer` where the template's
 * footer has a logo of its own colour; without it the footer keeps the name.
 * Templates whose logo is lettering have it drawn as an SVG with its face.
 */
export const XS_LOGOS: Record<string, { header: string; footer?: string }> = {
  "01": { header: "/xs/01/logo.png" },
  "02": { header: "/xs/02/logo.svg", footer: "/xs/02/logo-footer.svg" },
  "03": { header: "/xs/03/logo.svg" },
  "04": { header: "/xs/04/logo.png" },
  "05": { header: "/xs/05/logo.png", footer: "/xs/05/logo-footer.png" },
  "06": { header: "/xs/06/logo.svg" },
  "07": { header: "/xs/07/logo.svg" },
  "08": { header: "/xs/08/logo.png" },
  "09": { header: "/xs/09/logo.png" },
  "10": { header: "/xs/10/logo.png", footer: "/xs/10/logo-footer.png" },
  "11": { header: "/xs/11/logo-footer.png", footer: "/xs/11/logo-footer.png" },
  "12": { header: "/xs/12/logo.png" },
  "13": { header: "/xs/13/logo.png" },
  "14": { header: "/xs/14/logo.png" },
  "15": { header: "/xs/15/logo.png", footer: "/xs/15/logo.png" },
  "16": { header: "/xs/16/logo-footer.png", footer: "/xs/16/logo-footer.png" },
  "17": { header: "/xs/17/logo.png" },
  "18": { header: "/xs/18/logo.svg", footer: "/xs/18/logo.svg" },
  "19": { header: "/xs/19/logo.svg", footer: "/xs/19/logo.svg" },
  "20": { header: "/xs/20/logo.svg", footer: "/xs/20/logo.svg" },
  "21": { header: "/xs/21/logo.svg", footer: "/xs/21/logo.svg" },
  "22": { header: "/xs/22/logo.svg", footer: "/xs/22/logo.svg" },
};

/**
 * The links at the end of a template's top strip, as the template has them
 * (only the looks whose template has a strip). A link goes to the store's own
 * page for it; an item with no `href` is the template's plain word (its
 * currency, its language); `social` stands for the store's own social
 * accounts, drawn as the template's row of icons. The line at the strip's
 * start is the store's announcement, which the template's gallery copy sets
 * to the template's own words.
 */
export type XsStripItem = { label: string; href?: string; social?: true };
export const XS_STRIP_LINKS: Record<string, XsStripItem[]> = {
  "01": [{ label: "Help & FAQs", href: "/contact" }, { label: "My Account", href: "/account" }, { label: "EN" }, { label: "USD" }],
  "05": [{ label: "Sign in", href: "/account" }, { label: "FAQs", href: "/contact" }, { label: "USD" }],
  "06": [{ label: "", social: true }],
  "07": [
    { label: "Privacy Policy", href: "/policies/privacy-policy" },
    { label: "Terms of Use", href: "/policies/terms-of-service" },
    { label: "Sales and Refunds", href: "/policies/refund-policy" },
  ],
  "10": [
    { label: "My Account", href: "/account" },
    { label: "Wish List", href: "/account/wishlist" },
    { label: "Shopping Cart", href: "/cart" },
    { label: "Checkout", href: "/checkout" },
  ],
  "15": [{ label: "USD" }, { label: "My Account", href: "/account" }],
};

/**
 * How a look's menu opens on a phone (components/xs/XsPhoneMenu, drawn by
 * app/xs-phone.css), as its template does it:
 *
 *   drop    a list that opens under the bar
 *   start   a sheet from the side the page starts on
 *   end     a sheet from the other side
 *   cover   the whole screen
 */
export type XsPhoneMenuMode = "drop" | "start" | "end" | "cover";
const XS_PHONE_MENUS: Record<string, XsPhoneMenuMode> = {
  "01": "drop",
  "02": "drop",
  "03": "end",
  "04": "start",
  "05": "start",
  "06": "drop",
  "07": "drop",
  "08": "drop",
  "09": "drop",
  "10": "drop",
  "11": "cover",
  "12": "end",
  "13": "start",
  "14": "drop",
  "15": "start",
  "16": "drop",
  "17": "drop",
  "18": "drop",
  "19": "end",
  "20": "drop",
  "21": "drop",
  "22": "drop",
  "23": "start",
  "24": "start",
};
export function xsPhoneMenuOf(look: string): XsPhoneMenuMode {
  return XS_PHONE_MENUS[look] ?? "drop";
}

/**
 * The template whose header, footer and page ground a store wears
 * (components/xs, app/xs-shell.css): `themeSettings.xsLook`. Absent or
 * unknown, the store keeps its own header and footer.
 */
/**
 * Whether the store chose its brand colour itself, rather than still wearing
 * the one a template brought (`primaryColorSource: "template"`): then that
 * colour stands in for a look's accent everywhere (app/xs-shell.css).
 */
export function xsOwnAccent(themeSettings: Record<string, unknown> | null | undefined): boolean {
  const colour = themeSettings?.primaryColor;
  return typeof colour === "string" && colour.trim() !== "" && themeSettings?.primaryColorSource !== "template";
}

export function xsShellOf(themeSettings: Record<string, unknown> | null | undefined): string | null {
  const raw = themeSettings?.xsLook;
  return typeof raw === "string" && Object.hasOwn(XS_CREDITS, raw) ? raw : null;
}
