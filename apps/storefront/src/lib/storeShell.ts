/**
 * The store's header and footer settings, read out of the workspace's
 * `themeSettings` — the same opaque blob the colours, font and announcement
 * bar already live in, written by the website editor's Header and Footer
 * panels (merchant-dashboard .../editor/storeShell.ts). They are store-wide:
 * every page of the store shares one header and one footer.
 *
 *   themeSettings.header = {
 *     announcement: { … },                 // lib/storeAnnouncement.ts
 *     menu?:   [{ label, href }],          // absent → the built-in links
 *     logo?:   { size?: "sm" | "lg", align?: "center" },
 *     show?:   { cart?, language?, theme?, trackOrder? },  // false hides one
 *     sticky?: false,
 *     layout?: "side",                     // absent → the bar across the top
 *   }
 *   themeSettings.footer = {
 *     groups?: [{ title, links: [{ label, href }] }],     // absent → built-in
 *     text?:   string,                                    // absent → tagline
 *     show?:   { brand?, links?, help? },                 // false hides one
 *   }
 *
 * Every key is optional and read defensively, and the editor only ever writes
 * a key that differs from the default. The defaults ARE the shell every store
 * had before these settings existed, so a store that never touched them
 * renders exactly as it always has.
 *
 * Pure — the store layout (server) and the editor preview's bridge (client,
 * showing unsaved settings) read through the same functions.
 */

// Type only: this file has no imports at run time, so node:test reads it as it is (storeShell.test.mjs).
import type { PerDevice } from "./deviceValue";

/** A link as the merchant wrote it. `href` is site-relative or absolute; see `shellHref`. */
export interface ShellLink {
  label: string;
  href: string;
}

export type LogoSize = "sm" | "md" | "lg";
export type LogoAlign = "start" | "center";
/**
 * Where the store's navigation sits on a wide screen: the bar across the top
 * every store has had, or a column beside the page. A phone keeps the bar
 * either way. Whether "side" is honoured at all is lib/storeNav's to say.
 */
export type NavLayout = "top" | "side";

export interface HeaderShell {
  /** The merchant's own menu, or null for the built-in links. */
  menu: ShellLink[] | null;
  logoSize: LogoSize;
  logoAlign: LogoAlign;
  showCart: boolean;
  showLanguage: boolean;
  showTheme: boolean;
  showTrackOrder: boolean;
  sticky: boolean;
  layout: NavLayout;
  /**
   * The bar's own colours on a store that wears an imported template's header
   * (components/xs/XsHeader): `background`, `text`, and the strip's
   * `stripBackground`, `stripText` — each a #rrggbb, absent when not chosen.
   */
  colors?: Record<string, string>;
  /** Its own sizes in pixels on such a store (header: logo, bar, menu, strip; footer: title, text, logo), per screen (lib/deviceValue). */
  sizes?: Record<string, PerDevice<number>>;
  /** A logo picture of its own on such a store (`logo.image`), over the template's. */
  logoImage?: string;
  /** The store's name, in the template's lettering, instead of any logo picture (`logo.name`). */
  logoAsName?: boolean;
  /** Where each part of such a header stands, as saved (`zones`); read and checked by lib/xsLayout. */
  zones?: unknown;
  /** Such a footer's columns and bottom row, as saved; read and checked by lib/xsLayout. */
  columns?: unknown;
  bottom?: unknown;
}

export interface FooterGroup {
  /** Empty: the group is untitled (the built-in group's title is translated). */
  title: string;
  links: ShellLink[];
}

export interface FooterShell {
  /** The merchant's own link groups, or null for the built-in one. */
  groups: FooterGroup[] | null;
  /** A line under the store name; null shows the store's tagline, as before. */
  text: string | null;
  showBrand: boolean;
  showLinks: boolean;
  showHelp: boolean;
  /** The footer's own colours on a store that wears an imported template's footer: `background`, `text`, `heading`. */
  colors?: Record<string, string>;
  /** Its own sizes in pixels on such a store (header: logo, bar, menu, strip; footer: title, text, logo), per screen (lib/deviceValue). */
  sizes?: Record<string, PerDevice<number>>;
  /** A logo picture of its own on such a store (`logo.image`), over the template's. */
  logoImage?: string;
  /** The store's name, in the template's lettering, instead of any logo picture (`logo.name`). */
  logoAsName?: boolean;
  /** Where each part of such a header stands, as saved (`zones`); read and checked by lib/xsLayout. */
  zones?: unknown;
  /** Such a footer's columns and bottom row, as saved; read and checked by lib/xsLayout. */
  columns?: unknown;
  bottom?: unknown;
}

/** Caps applied on read, so a hand-edited blob can't blow the header up. */
export const MAX_MENU_LINKS = 12;
export const MAX_FOOTER_GROUPS = 4;
export const MAX_GROUP_LINKS = 12;
const MAX_LABEL = 60;
const MAX_HREF = 500;
const MAX_TEXT = 400;

export const DEFAULT_HEADER: HeaderShell = {
  menu: null,
  logoSize: "md",
  logoAlign: "start",
  showCart: true,
  showLanguage: true,
  showTheme: true,
  showTrackOrder: true,
  sticky: true,
  layout: "top",
};

export const DEFAULT_FOOTER: FooterShell = {
  groups: null,
  text: null,
  showBrand: true,
  showLinks: true,
  showHelp: true,
};

type Blob = Record<string, unknown>;

function objectOf(value: unknown): Blob | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : null;
}

/** Only an explicit `false` turns a part off; anything else leaves the default. */
function shown(show: Blob | null, key: string): boolean {
  return show?.[key] !== false;
}

function readLinks(raw: unknown, max: number): ShellLink[] {
  if (!Array.isArray(raw)) return [];
  const links: ShellLink[] = [];
  for (const item of raw) {
    const o = objectOf(item);
    if (!o) continue;
    const href = typeof o.href === "string" ? o.href.trim().slice(0, MAX_HREF) : "";
    if (!href) continue;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL) : "";
    links.push({ label, href });
    if (links.length >= max) break;
  }
  return links;
}

/** The #rrggbb values among `keys` of a saved `colors` object; undefined when none is set. */
function readColors(raw: unknown, keys: readonly string[]): Record<string, string> | undefined {
  const saved = objectOf(raw);
  if (!saved) return undefined;
  const colors: Record<string, string> = {};
  for (const key of keys) {
    const value = saved[key];
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) colors[key] = value.toLowerCase();
  }
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/** A picture address a logo may have: the store's own media (http/https) or a path on this storefront. */
function readImage(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value.length > 0 && value.length <= 1000 && /^(https?:\/\/|\/(?!\/))/i.test(value) ? value : undefined;
}

/** The whole numbers within range among a saved `sizes` object, each one value or one per screen; undefined when none is set. */
function readSizes(raw: unknown, ranges: Record<string, readonly [number, number]>): Record<string, PerDevice<number>> | undefined {
  const saved = objectOf(raw);
  if (!saved) return undefined;
  const sizes: Record<string, PerDevice<number>> = {};
  for (const [key, [least, most]] of Object.entries(ranges)) {
    const ok = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= least && value <= most;
    // One value for every screen, or { base, tablet, mobile } (lib/deviceValue).
    const perScreen = objectOf(saved[key]);
    const values: PerDevice<number> = {};
    if (perScreen) {
      for (const device of ["base", "tablet", "mobile"] as const) if (ok(perScreen[device])) values[device] = perScreen[device];
    } else if (ok(saved[key])) values.base = saved[key];
    if (Object.keys(values).length > 0) sizes[key] = values;
  }
  return Object.keys(sizes).length > 0 ? sizes : undefined;
}

export function readHeaderShell(themeSettings: Blob | null | undefined): HeaderShell {
  const header = objectOf(themeSettings?.header);
  if (!header) return DEFAULT_HEADER;
  const logo = objectOf(header.logo);
  const show = objectOf(header.show);
  return {
    menu: Array.isArray(header.menu) ? readLinks(header.menu, MAX_MENU_LINKS) : null,
    logoSize: logo?.size === "sm" || logo?.size === "lg" ? logo.size : "md",
    logoAlign: logo?.align === "center" ? "center" : "start",
    showCart: shown(show, "cart"),
    showLanguage: shown(show, "language"),
    showTheme: shown(show, "theme"),
    showTrackOrder: shown(show, "trackOrder"),
    sticky: header.sticky !== false,
    // Only the one known value moves the navigation; anything else is the top bar.
    layout: header.layout === "side" ? "side" : "top",
    colors: readColors(header.colors, ["background", "text", "stripBackground", "stripText"]),
    sizes: readSizes(header.sizes, { logo: [20, 140], bar: [48, 160], menu: [11, 26], strip: [10, 20] }),
    logoImage: readImage(logo?.image),
    logoAsName: logo?.name === true,
    zones: header.zones,
  };
}

export function readFooterShell(themeSettings: Blob | null | undefined): FooterShell {
  const footer = objectOf(themeSettings?.footer);
  if (!footer) return DEFAULT_FOOTER;
  const show = objectOf(footer.show);
  let groups: FooterGroup[] | null = null;
  if (Array.isArray(footer.groups)) {
    groups = [];
    for (const item of footer.groups) {
      const o = objectOf(item);
      if (!o) continue;
      groups.push({
        title: typeof o.title === "string" ? o.title.trim().slice(0, MAX_LABEL) : "",
        links: readLinks(o.links, MAX_GROUP_LINKS),
      });
      if (groups.length >= MAX_FOOTER_GROUPS) break;
    }
  }
  const text = typeof footer.text === "string" && footer.text.trim() ? footer.text.trim().slice(0, MAX_TEXT) : null;
  return {
    groups,
    text,
    showBrand: shown(show, "brand"),
    showLinks: shown(show, "links"),
    showHelp: shown(show, "help"),
    colors: readColors(footer.colors, ["background", "text", "heading"]),
    sizes: readSizes(footer.sizes, { title: [12, 32], text: [11, 22], logo: [16, 200] }),
    logoImage: readImage(objectOf(footer.logo)?.image),
    logoAsName: objectOf(footer.logo)?.name === true,
    columns: footer.columns,
    bottom: footer.bottom,
  };
}

/**
 * Where a merchant link goes. Site-relative paths stay site-relative (the
 * caller's StoreLink adds the store prefix), absolute http(s)/mailto/tel links
 * are left alone, and anything else — `javascript:` included — is treated as
 * a relative path, so it can never run script.
 */
export function shellHref(raw: string): { href: string; external: boolean } | null {
  const href = raw.trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return { href, external: true };
  if (/^(mailto|tel):/i.test(href)) return { href, external: false };
  if (href.startsWith("#")) return { href, external: false };
  const internal = href.match(/^\/store\/[^/]+(\/.*)?$/);
  if (internal) return { href: internal[1] || "/", external: false };
  if (href.startsWith("//")) return { href: `/${href.replace(/^\/+/, "")}`, external: false };
  return { href: href.startsWith("/") ? href : `/${href}`, external: false };
}

/** A merchant link ready to draw: a label to show and where it goes. */
export interface ResolvedShellLink {
  key: string;
  label: string;
  href: string;
  external: boolean;
}

/**
 * The merchant's links as the header and footer draw them. A link with no
 * usable address is dropped, and so is an unlabelled one that doesn't point at
 * a built-in page — a bare URL is no name to show a shopper.
 */
export function resolveShellLinks(
  links: ShellLink[],
  common: { home: string; cart: string; trackOrder: string }
): ResolvedShellLink[] {
  const out: ResolvedShellLink[] = [];
  links.forEach((link, i) => {
    const target = shellHref(link.href);
    if (!target) return;
    const label = link.label || builtinLinkLabel(target.href, common);
    if (!label) return;
    out.push({ key: `${i}:${target.href}`, label, href: target.href, external: target.external });
  });
  return out;
}

/**
 * The name of a link the merchant left unlabelled, when it points at one of
 * the store's own built-in pages — so "Home" still reads "الرئيسية" when the
 * shopper switches language. Null for anything else.
 */
export function builtinLinkLabel(
  href: string,
  common: { home: string; cart: string; trackOrder: string }
): string | null {
  const bare = href.trim().replace(/#.*$/, "");
  // A query means a filtered view (a collection), not the plain page.
  if (bare.includes("?")) return null;
  const path = bare.replace(/\/+$/, "") || "/";
  if (path === "/") return common.home;
  if (path === "/cart") return common.cart;
  if (path === "/track") return common.trackOrder;
  return null;
}

/**
 * The website editor's unsaved header/footer settings, laid over the saved
 * ones while its preview is open — in exactly the shape they are saved in
 * (`themeSettings.header` / `themeSettings.footer`), so the preview reads them
 * through the very functions the live store uses.
 */
export interface ShellOverride {
  header: Record<string, unknown> | null;
  footer: Record<string, unknown> | null;
  /** The unsaved Template look (`themeSettings.xsTokens`, lib/xsTokens.ts): null is "the template's own"; absent, the saved one. */
  tokens?: Record<string, unknown> | null;
  /** The unsaved shop pages' settings and words (`storePages`, `storeWords`), the same way. */
  storePages?: Record<string, unknown> | null;
  storeWords?: Record<string, unknown> | null;
  /** The unsaved store fonts (`themeSettings.fonts`, lib/storeFonts.ts), the same way. */
  fonts?: Record<string, unknown> | null;
}

/**
 * An override as it arrives from the editor (a form post or a cross-window
 * message). Only the two objects are kept; what is inside them is read as
 * defensively as a saved blob is.
 */
export function readShellOverride(raw: unknown): ShellOverride | null {
  const input = objectOf(raw);
  if (!input) return null;
  return {
    header: objectOf(input.header),
    footer: objectOf(input.footer),
    ...("tokens" in input ? { tokens: objectOf(input.tokens) } : {}),
    ...("storePages" in input ? { storePages: objectOf(input.storePages) } : {}),
    ...("storeWords" in input ? { storeWords: objectOf(input.storeWords) } : {}),
    ...("fonts" in input ? { fonts: objectOf(input.fonts) } : {}),
  };
}
