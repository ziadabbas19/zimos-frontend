/**
 * The merchant's store look, read out of the workspace's `themeSettings` and
 * turned into the CSS custom properties the `.brand-theme` wrapper carries.
 *
 * Pure on purpose: the store layout (server) and the editor preview's bridge
 * (client, applying unsaved changes live) both need exactly the same mapping,
 * so it lives here rather than beside the server-only API helpers. It imports
 * only plain JavaScript, so Node's own test runner can load it (brandTheme.test.mjs).
 *
 * Every key is optional and read defensively — themeSettings is an opaque blob
 * the backend stores as-is. Anything missing or malformed is simply left out,
 * so the stylesheet's own defaults (which are light/dark aware) still apply.
 * A store that has saved nothing renders exactly as it always has.
 *
 * Keys, all written by the dashboard:
 *  - `storeTheme` — one of STORE_THEMES. Absent (or unknown) is the original
 *    look, which is what every store had before themes existed. A theme owns
 *    the palette, fonts, corners, buttons, cards, spacing and hero layout
 *    (globals.css, `[data-store-theme]`); the merchant only picks its accent;
 *  - `primaryColor` — `#rrggbb`, the accent (buttons, links, highlights) in
 *    light mode (Settings page and the website editor's "Store look" panel);
 *  - `primaryColorSource` — `"template"` when `primaryColor` was carried over
 *    from a website template rather than picked by the merchant. On a theme
 *    such a colour is ignored, so the theme keeps its own accent; the original
 *    look still uses it. Any colour the merchant saves drops the marker;
 *  - `primaryColorDark` — `#rrggbb`, the accent in dark mode. Absent means the
 *    light-mode colour is used in dark mode too, which is how every store with
 *    a saved colour looked before the two modes could differ;
 *  - `secondaryColor` — `#rrggbb`, badges and small touches (original look only);
 *  - `fontFamily` — one of THEME_FONTS' keys (original look only);
 *  - `cornerRadius` — one of THEME_RADII's keys (original look only).
 */

import { NATIVE_DARK_LOOKS } from "./xsDarkPalette.mjs";

/** Matches the keys the dashboard's Settings page writes into themeSettings. */
const HEX = /^#[0-9a-f]{6}$/i;

function hex(themeSettings: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = themeSettings?.[key];
  return typeof raw === "string" && HEX.test(raw.trim()) ? raw.trim() : null;
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Ink used on brand surfaces too light for white text. Matches --color-ink. */
const ON_LIGHT = "#16211f";
const ON_DARK = "#ffffff";

/**
 * A readable foreground for text sitting on `color`, picked by contrast.
 *
 * The utilities that paint brand surfaces used to hardcode `text-paper-raised`,
 * which is white in light mode and near-black in dark mode. That assumes the
 * brand colour flips with the theme — but it does not: a merchant who saves a
 * deep blue gets near-black text on deep blue in dark mode (measured 1.97:1).
 * Choosing the foreground from the brand colour itself keeps the pair legible
 * whatever hex the merchant picks, in either theme.
 */
export function onColor(color: string): string {
  const l = luminance(color);
  const contrast = (other: number) => {
    const [hi, lo] = l > other ? [l, other] : [other, l];
    return (hi + 0.05) / (lo + 0.05);
  };
  return contrast(luminance(ON_DARK)) >= contrast(luminance(ON_LIGHT)) ? ON_DARK : ON_LIGHT;
}

/**
 * The six store themes. Each is a whole visual system — palette per mode,
 * font pairing, corners, buttons, cards, spacing and its own hero layout —
 * defined in globals.css under `.brand-theme[data-store-theme="…"]`, with the
 * font stacks from app/themeFonts.ts. Named for how they look, never for a
 * kind of shop. Must match STORE_THEMES in the dashboard's storeThemes.ts.
 */
export const STORE_THEMES = ["elegant", "bold", "minimal", "classic", "warm", "glass"] as const;
export type StoreThemeKey = (typeof STORE_THEMES)[number];

/** How a preview asks for the original look explicitly (a saved theme would win otherwise). */
export const ORIGINAL_LOOK = "original";

/** `primaryColorSource` for a colour a website template carried over. Must match the dashboard's storeLook.ts. */
export const TEMPLATE_COLOR_SOURCE = "template";

const THEME_SET = new Set<string>(STORE_THEMES);

/** The store's theme, or null for the original look. */
export function storeThemeOf(themeSettings: Record<string, unknown> | null | undefined): StoreThemeKey | null {
  const raw = themeSettings?.storeTheme;
  return typeof raw === "string" && THEME_SET.has(raw) ? (raw as StoreThemeKey) : null;
}

/**
 * Font pairings the merchant can pick. Only families the root layout already
 * loads (Fraunces, Plus Jakarta Sans, Tajawal) or the platform's own system
 * face, so a choice never costs an extra font download. Tajawal stays in every
 * stack because the Latin faces have no Arabic glyphs.
 *
 * `classic` is the stylesheet's own pairing, spelled out for the preview.
 * The original look only: a theme brings its own pairing.
 */
const SANS = '"Plus Jakarta Sans", "Tajawal", ui-sans-serif, system-ui, sans-serif';
export const THEME_FONTS: Record<string, { display: string; sans: string }> = {
  classic: { display: '"Fraunces", "Tajawal", ui-serif, Georgia, serif', sans: SANS },
  modern: { display: SANS, sans: SANS },
  tajawal: {
    display: '"Tajawal", ui-sans-serif, system-ui, sans-serif',
    sans: '"Tajawal", ui-sans-serif, system-ui, sans-serif',
  },
  system: {
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Tajawal", sans-serif',
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Tajawal", sans-serif',
  },
};

/**
 * Corner rounding. The storefront draws its cards and buttons with Tailwind's
 * `rounded-lg/xl/2xl`, which read `--radius-*`, plus `--radius-card`; moving
 * those four moves the whole store together. `soft` is Tailwind's own scale
 * and the stylesheet's card radius — the look every store had before.
 * The original look only: a theme brings its own scale.
 */
export const THEME_RADII: Record<string, Record<string, string>> = {
  sharp: { "--radius-lg": "0.125rem", "--radius-xl": "0.25rem", "--radius-2xl": "0.25rem", "--radius-card": "0.25rem" },
  soft: { "--radius-lg": "0.5rem", "--radius-xl": "0.75rem", "--radius-2xl": "1rem", "--radius-card": "0.625rem" },
  round: { "--radius-lg": "0.875rem", "--radius-xl": "1.25rem", "--radius-2xl": "1.75rem", "--radius-card": "1.25rem" },
};

function choice(themeSettings: Record<string, unknown> | null | undefined, key: string, table: Record<string, unknown>) {
  const raw = themeSettings?.[key];
  return typeof raw === "string" && Object.hasOwn(table, raw) ? raw : null;
}

/**
 * Every custom property brandVars can write — the preview bridge clears the
 * rest. `--brand-primary` / `--brand-primary-foreground` are no longer
 * written inline (the stylesheet derives them per mode from the two below),
 * but stay listed so a stale inline value can never outlive a preview update.
 */
export const BRAND_VAR_NAMES = [
  "--brand-primary",
  "--brand-primary-foreground",
  "--brand-primary-light-mode",
  "--brand-primary-light-mode-fg",
  "--brand-primary-dark-mode",
  "--brand-primary-dark-mode-fg",
  "--brand-secondary",
  "--brand-secondary-foreground",
  "--font-display",
  "--font-sans",
  ...Object.keys(THEME_RADII.soft),
];

/**
 * The custom properties for a store wrapper. Anything the merchant has not set
 * is left out, so the stylesheet's defaults apply.
 *
 * The accent is written once per mode (`--brand-primary-light-mode` /
 * `-dark-mode`, each with its contrast-picked foreground) and globals.css
 * picks the one for the current mode — an inline value alone can't follow the
 * `.dark` class. A store that saved one colour gets it in both, exactly as
 * before; with no colour at all both stay unset and the default (per theme,
 * per mode) applies.
 *
 * On a theme the secondary colour, font and corners are the theme's own, so
 * none of them is written: an inline value would beat the theme's stylesheet.
 *
 * `complete` (the editor preview only) also spells out the default font and
 * radius of the original look, so an unsaved switch back to the defaults
 * beats whatever the store has saved. Colours are never filled in: their
 * defaults differ between light and dark, and between themes.
 */
export function brandVars(
  themeSettings: Record<string, unknown> | null | undefined,
  { complete = false }: { complete?: boolean } = {}
): Record<string, string> {
  const vars: Record<string, string> = {};
  const onTheme = storeThemeOf(themeSettings) !== null;
  // A template's colour never paints over a theme's own accent.
  const fromTemplate = themeSettings?.primaryColorSource === TEMPLATE_COLOR_SOURCE;
  const light = onTheme && fromTemplate ? null : hex(themeSettings, "primaryColor");
  const dark = hex(themeSettings, "primaryColorDark") ?? light;
  if (light) {
    vars["--brand-primary-light-mode"] = light;
    vars["--brand-primary-light-mode-fg"] = onColor(light);
  }
  if (dark) {
    vars["--brand-primary-dark-mode"] = dark;
    vars["--brand-primary-dark-mode-fg"] = onColor(dark);
  }

  // A theme owns everything below.
  if (onTheme) return vars;

  const secondary = hex(themeSettings, "secondaryColor");
  if (secondary) {
    vars["--brand-secondary"] = secondary;
    vars["--brand-secondary-foreground"] = onColor(secondary);
  }

  const font = choice(themeSettings, "fontFamily", THEME_FONTS) ?? (complete ? "classic" : null);
  if (font) {
    vars["--font-display"] = THEME_FONTS[font].display;
    vars["--font-sans"] = THEME_FONTS[font].sans;
  }

  const radius = choice(themeSettings, "cornerRadius", THEME_RADII) ?? (complete ? "soft" : null);
  if (radius) Object.assign(vars, THEME_RADII[radius]);

  return vars;
}

/**
 * An unsaved store look sent by the editor with a preview. Validated here
 * because it arrives from a form post or a cross-window message — never
 * trusted as-is.
 */
export interface PreviewTheme {
  /** A theme key, or ORIGINAL_LOOK. Undefined leaves the store's saved theme alone. */
  storeTheme?: string;
  primaryColor?: string;
  /** TEMPLATE_COLOR_SOURCE while `primaryColor` is the one a template brought. */
  primaryColorSource?: string;
  primaryColorDark?: string;
  secondaryColor?: string;
  fontFamily?: string;
  cornerRadius?: string;
  /** Undefined leaves the store's saved logo alone; null previews "no logo". */
  logoUrl?: string | null;
}

export function readPreviewTheme(raw: unknown): PreviewTheme | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const theme: PreviewTheme = {};
  const storeTheme = storeThemeOf(input);
  if (storeTheme) theme.storeTheme = storeTheme;
  else if (input.storeTheme === ORIGINAL_LOOK) theme.storeTheme = ORIGINAL_LOOK;
  const primary = hex(input, "primaryColor");
  const primaryDark = hex(input, "primaryColorDark");
  const secondary = hex(input, "secondaryColor");
  if (primary) theme.primaryColor = primary;
  if (primary && input.primaryColorSource === TEMPLATE_COLOR_SOURCE) theme.primaryColorSource = TEMPLATE_COLOR_SOURCE;
  if (primaryDark) theme.primaryColorDark = primaryDark;
  if (secondary) theme.secondaryColor = secondary;
  const font = choice(input, "fontFamily", THEME_FONTS);
  if (font) theme.fontFamily = font;
  const radius = choice(input, "cornerRadius", THEME_RADII);
  if (radius) theme.cornerRadius = radius;
  if (input.logoUrl === null) {
    theme.logoUrl = null;
  } else if (typeof input.logoUrl === "string") {
    try {
      const url = new URL(input.logoUrl);
      if (url.protocol === "https:" || url.protocol === "http:") theme.logoUrl = url.href;
    } catch {
      // Not a URL — leave the saved logo alone.
    }
  }
  return theme;
}

/** Light or dark, as the editor's preview asks for it. */
export type ColorMode = "light" | "dark";

export function readColorMode(raw: unknown): ColorMode | null {
  return raw === "light" || raw === "dark" ? raw : null;
}

/**
 * What the preview's `data-store-theme` should become for an unsaved look:
 * a theme key, null for the original look, or undefined to keep the saved one.
 */
export function previewStoreTheme(theme: PreviewTheme | null): StoreThemeKey | null | undefined {
  if (!theme || theme.storeTheme === undefined) return undefined;
  return theme.storeTheme === ORIGINAL_LOOK ? null : storeThemeOf(theme as Record<string, unknown>);
}

/**
 * A tiny script, run while the preview page is parsed, that puts the unsaved
 * theme and colour mode in place before the first paint — the header and the
 * store wrapper are the layout's, drawn from the saved look, and the preview
 * bridge only takes over once hydrated. Built from validated values only
 * (a theme key, "light"/"dark"), and JSON-encoded besides.
 */
export function previewBootScript(theme: PreviewTheme | null, colorMode: ColorMode | null): string {
  const key = previewStoreTheme(theme);
  if (key === undefined && colorMode === null) return "";
  const vars = key === undefined ? [] : brandVarsToClear(theme);
  return `(function(){try{var w=document.querySelector(".brand-theme");var k=${JSON.stringify(
    key === undefined ? "keep" : key
  )};var m=${JSON.stringify(colorMode)};if(w&&k!=="keep"){if(k)w.setAttribute("data-store-theme",k);else w.removeAttribute("data-store-theme");${JSON.stringify(
    vars
  )}.forEach(function(n){w.style.removeProperty(n)})}if(m){var e=document.documentElement;e.classList.toggle("dark",m==="dark");e.style.colorScheme=m;if(w&&w.hasAttribute("data-xs-shell")&&${JSON.stringify(
    NATIVE_DARK_LOOKS
  )}.indexOf(w.getAttribute("data-xs-shell"))<0){if(m==="dark")w.setAttribute("data-color-mode","dark");else w.removeAttribute("data-color-mode")}}}catch(_){}})();`;
}

/**
 * The saved inline properties an unsaved theme switch has to drop at first
 * paint: on a theme, the saved font and corners of the original look would
 * otherwise beat the theme's own. (The bridge clears everything again once
 * it takes over.)
 */
function brandVarsToClear(theme: PreviewTheme | null): string[] {
  const key = previewStoreTheme(theme);
  if (!key) return [];
  return ["--brand-secondary", "--brand-secondary-foreground", "--font-display", "--font-sans", ...Object.keys(THEME_RADII.soft)];
}
