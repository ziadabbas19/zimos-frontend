import type { Workspace } from "@store-builder/api-client";
import { normalizeHex } from "@/lib/brandColors";
import type { PreviewTheme, ShellPreview } from "@/lib/previewBridge";
import {
  readFooterLook,
  readHeaderLook,
  sameFooter,
  sameHeader,
  writeFooter,
  writeHeader,
  type FooterLook,
  type HeaderLook,
} from "./storeShell";
import { ORIGINAL_LOOK, readThemeChoice, type ThemeChoice } from "./storeThemes";

/**
 * The store's look as the website editor's "Store look" panel edits it. It is
 * workspace-wide, not per page: the colours live in `themeSettings` beside the
 * keys the Settings page already writes (`primaryColor` / `secondaryColor`,
 * see lib/brandColors.ts), the logo is the workspace's own `logoUrl`.
 *
 * The storefront reads every key here in apps/storefront/src/lib/brandTheme.ts
 * — the option keys below must match THEME_FONTS / THEME_RADII there, and the
 * theme keys STORE_THEMES (see storeThemes.ts).
 *
 * The theme (`storeTheme`) owns the whole look but one thing: the accent the
 * merchant picks for each mode — `primaryColor` in light mode (the key the
 * Settings page has always written) and `primaryColorDark` in dark mode, which
 * stays unset — "same as light mode" — until the merchant picks one, so a
 * store that saved one colour looks exactly as it always did. On the original
 * look the merchant also picks the second colour, font and corners.
 *
 * The header and footer (storeShell.ts) are part of the look too: they live in
 * the same `themeSettings` blob and are saved by the same PATCH, so they share
 * its undo history, its dirty check and its Save.
 */

export type FontKey = "classic" | "modern" | "tajawal" | "system";
export type RadiusKey = "sharp" | "soft" | "round";

/** The panel's own cap on how many rotating lines a merchant can add. */
export const MAX_ANNOUNCEMENT_MESSAGES = 5;

/**
 * The store-wide announcement bar, as this panel edits it. Saved to
 * `themeSettings.header.announcement` in the shape
 * apps/storefront/src/lib/storeAnnouncement.ts's `announcementOf` reads
 * (`text` / `messages` / `href` / `background` / `color`) — see
 * `announcementPatch` below for the exact translation.
 */
export interface StoreAnnouncementLook {
  enabled: boolean;
  /** One or more lines, in rotation order. Never empty while `enabled` survives a save — see `announcementPatch`. */
  messages: string[];
  href: string | null;
  background: string | null;
  color: string | null;
}

export interface StoreLook {
  /** A store theme, or the original look — where font, corners and second colour are the merchant's. */
  storeTheme: ThemeChoice;
  /**
   * The accent in light mode. Null while the store has never saved one — the
   * theme's own default applies.
   */
  primaryColor: string | null;
  /**
   * True while `primaryColor` is one a website template carried over
   * (WebsitePage) and the merchant has not picked a colour since. On a theme
   * such a colour is ignored — the theme keeps its own accent — so read the
   * accent through `accentOf`, never `primaryColor` directly.
   */
  primaryColorFromTemplate: boolean;
  /** The accent in dark mode. Null follows `primaryColor` (or the theme's dark default without one). */
  primaryColorDark: string | null;
  /** Original look only; a theme brings its own. */
  secondaryColor: string | null;
  fontFamily: FontKey;
  cornerRadius: RadiusKey;
  logoUrl: string | null;
  announcement: StoreAnnouncementLook;
  header: HeaderLook;
  footer: FooterLook;
  /** An imported template's shop and product pages (StorePagesBlock.tsx), as saved; absent: the template's own. */
  storePages?: Record<string, unknown>;
  /** An imported template's Template look — faces, corners, words, spacing (TemplateLookBlock.tsx); absent: the template's own. */
  xsTokens?: Record<string, unknown>;
  /** The words on the shop pages, per language (StoreWordsBlock.tsx); absent: the store's own. */
  storeWords?: Record<string, unknown>;
  /**
   * The store's fonts (`themeSettings.fonts`, @store-builder/ui/fonts): Store settings → Fonts
   * writes them, the header panel edits `header` here. Absent: none picked.
   */
  fonts?: Record<string, unknown>;
}

/** Font pairings, each drawn in its own face in the panel. Only fonts the storefront already loads. */
export const FONT_OPTIONS: Array<{ value: FontKey; heading: string; body: string }> = [
  { value: "classic", heading: '"Fraunces", "Tajawal", serif', body: '"Plus Jakarta Sans", "Tajawal", sans-serif' },
  { value: "modern", heading: '"Plus Jakarta Sans", "Tajawal", sans-serif', body: '"Plus Jakarta Sans", "Tajawal", sans-serif' },
  { value: "tajawal", heading: '"Tajawal", sans-serif', body: '"Tajawal", sans-serif' },
  { value: "system", heading: 'ui-sans-serif, system-ui, "Segoe UI", "Tajawal", sans-serif', body: 'ui-sans-serif, system-ui, "Segoe UI", "Tajawal", sans-serif' },
];

/** Corner options with the card radius each one gives, for the panel's swatch. */
export const RADIUS_OPTIONS: Array<{ value: RadiusKey; radius: string }> = [
  { value: "sharp", radius: "0.25rem" },
  { value: "soft", radius: "0.625rem" },
  { value: "round", radius: "1.25rem" },
];

/**
 * Ready-made colour pairs. Starting points only — the merchant can still pick
 * any colour for either. `nile` is the platform default pair.
 */
export const PALETTES: Array<{ key: string; primary: string; secondary: string }> = [
  { key: "nile", primary: "#1F5D5B", secondary: "#E2A33D" },
  { key: "midnight", primary: "#1E40AF", secondary: "#F59E0B" },
  { key: "rose", primary: "#BE123C", secondary: "#F4B400" },
  { key: "forest", primary: "#166534", secondary: "#CA8A04" },
  { key: "violet", primary: "#6D28D9", secondary: "#EC4899" },
  { key: "ocean", primary: "#0E7490", secondary: "#FB923C" },
  { key: "charcoal", primary: "#1F2937", secondary: "#D97706" },
];

/**
 * `themeSettings.primaryColorSource` for a colour a template carried over.
 * Must match TEMPLATE_COLOR_SOURCE in apps/storefront/src/lib/brandTheme.ts.
 */
export const TEMPLATE_COLOR_SOURCE = "template";

/**
 * The light-mode accent the store actually paints with under `theme` (the
 * look's own theme by default): a template's colour counts on the original
 * look only, exactly as the storefront's brandVars reads it.
 */
export function accentOf(look: StoreLook, theme: ThemeChoice = look.storeTheme): string | null {
  return look.primaryColorFromTemplate && theme !== ORIGINAL_LOOK ? null : look.primaryColor;
}

const FONT_KEYS = new Set<string>(FONT_OPTIONS.map((o) => o.value));
const RADIUS_KEYS = new Set<string>(RADIUS_OPTIONS.map((o) => o.value));

export function readStoreLook(workspace: Pick<Workspace, "themeSettings" | "logoUrl"> | null): StoreLook {
  const ts = workspace?.themeSettings ?? {};
  const color = (key: string) => (typeof ts[key] === "string" ? normalizeHex(ts[key] as string) : null);
  const font = typeof ts.fontFamily === "string" && FONT_KEYS.has(ts.fontFamily) ? (ts.fontFamily as FontKey) : "classic";
  const radius =
    typeof ts.cornerRadius === "string" && RADIUS_KEYS.has(ts.cornerRadius) ? (ts.cornerRadius as RadiusKey) : "soft";
  const header = ts.header && typeof ts.header === "object" ? (ts.header as Record<string, unknown>) : {};
  return {
    storeTheme: readThemeChoice(ts.storeTheme),
    primaryColor: color("primaryColor"),
    primaryColorFromTemplate: ts.primaryColorSource === TEMPLATE_COLOR_SOURCE && color("primaryColor") !== null,
    primaryColorDark: color("primaryColorDark"),
    secondaryColor: color("secondaryColor"),
    fontFamily: font,
    cornerRadius: radius,
    logoUrl: workspace?.logoUrl ?? null,
    announcement: readAnnouncement(header.announcement),
    header: readHeaderLook(ts.header),
    footer: readFooterLook(ts.footer),
    ...(ts.storePages && typeof ts.storePages === "object" && !Array.isArray(ts.storePages) ? { storePages: ts.storePages as Record<string, unknown> } : {}),
    ...(ts.xsTokens && typeof ts.xsTokens === "object" && !Array.isArray(ts.xsTokens) ? { xsTokens: ts.xsTokens as Record<string, unknown> } : {}),
    ...(ts.storeWords && typeof ts.storeWords === "object" && !Array.isArray(ts.storeWords) ? { storeWords: ts.storeWords as Record<string, unknown> } : {}),
    ...(ts.fonts && typeof ts.fonts === "object" && !Array.isArray(ts.fonts) ? { fonts: ts.fonts as Record<string, unknown> } : {}),
  };
}

/**
 * Reads a saved `header.announcement` into the panel's editing shape. Mirrors
 * `announcementOf`'s own parsing (an array `messages`, or `text` written as an
 * array, or a single `text`) so a bar saved by a hand-edited workspace, or
 * written some other way, still opens with its lines in place. Missing or
 * malformed input reads as the untouched default: disabled, no messages.
 */
function readAnnouncement(raw: unknown): StoreAnnouncementLook {
  const empty: StoreAnnouncementLook = { enabled: false, messages: [], href: null, background: null, color: null };
  if (!raw || typeof raw !== "object") return empty;
  const a = raw as Record<string, unknown>;

  const rawList = Array.isArray(a.messages) ? a.messages : Array.isArray(a.text) ? a.text : null;
  const fromList = rawList
    ?.filter((m): m is string => typeof m === "string")
    .map((m) => m.trim())
    .filter((m) => m !== "");
  const single = typeof a.text === "string" && a.text.trim() ? [a.text.trim()] : [];
  const messages = fromList && fromList.length > 0 ? fromList : single;

  return {
    // Absent is treated as on, same as `announcementOf` — only an explicit
    // `false` turns it off. A save always writes the key explicitly (see
    // `announcementPatch`), so this only matters for hand-edited data.
    enabled: a.enabled !== false,
    messages,
    href: typeof a.href === "string" && a.href.trim() ? a.href.trim() : null,
    background: typeof a.background === "string" ? normalizeHex(a.background) : null,
    color: typeof a.color === "string" ? normalizeHex(a.color) : null,
  };
}

/**
 * What the preview frame lays over the saved look. Unset colours stay unset.
 *
 * Silent on the announcement bar, header and footer: those travel to the
 * preview separately, as `lookToShellPreview` below.
 */
export function lookToPreview(look: StoreLook): PreviewTheme {
  const accent = accentOf(look);
  return {
    // Always spelled out, so switching back to the original look beats a saved theme.
    storeTheme: look.storeTheme,
    ...(accent ? { primaryColor: accent } : {}),
    ...(look.primaryColorDark ? { primaryColorDark: look.primaryColorDark } : {}),
    ...(look.secondaryColor ? { secondaryColor: look.secondaryColor } : {}),
    fontFamily: look.fontFamily,
    cornerRadius: look.cornerRadius,
    logoUrl: look.logoUrl,
  };
}

/**
 * The PATCH body for a changed look. `themeSettings` is merged, never
 * replaced — it is a shared blob other parts of the product write to too
 * (Settings, the product page countdown, the store language).
 */
export function lookToWorkspacePatch(
  existing: Record<string, unknown> | undefined,
  look: StoreLook
): { logoUrl: string | null; themeSettings: Record<string, unknown> } {
  const themeSettings: Record<string, unknown> = {
    ...(existing ?? {}),
    fontFamily: look.fontFamily,
    cornerRadius: look.cornerRadius,
  };
  if (look.primaryColor) themeSettings.primaryColor = look.primaryColor;
  // Kept only until the merchant picks a colour of their own.
  if (look.primaryColorFromTemplate) themeSettings.primaryColorSource = TEMPLATE_COLOR_SOURCE;
  else delete themeSettings.primaryColorSource;
  if (look.secondaryColor) themeSettings.secondaryColor = look.secondaryColor;
  // Both keys belong to this panel alone: dropping one is how "the original
  // look" and "same as light mode" are saved, leaving no trace of either.
  if (look.storeTheme !== ORIGINAL_LOOK) themeSettings.storeTheme = look.storeTheme;
  else delete themeSettings.storeTheme;
  if (look.primaryColorDark) themeSettings.primaryColorDark = look.primaryColorDark;
  else delete themeSettings.primaryColorDark;

  themeSettings.header = writeHeader(existing?.header, look.header, announcementPatch(look.announcement));
  const footer = writeFooter(existing?.footer, look.footer);
  if (footer) themeSettings.footer = footer;
  else delete themeSettings.footer;
  if (look.storePages) themeSettings.storePages = look.storePages;
  else delete themeSettings.storePages;
  if (look.xsTokens) themeSettings.xsTokens = look.xsTokens;
  else delete themeSettings.xsTokens;
  if (look.storeWords) themeSettings.storeWords = look.storeWords;
  else delete themeSettings.storeWords;
  if (look.fonts && Object.keys(look.fonts).length > 0) themeSettings.fonts = look.fonts;
  else delete themeSettings.fonts;

  return { logoUrl: look.logoUrl, themeSettings };
}

/**
 * The unsaved header, footer and announcement bar as the preview shows them:
 * exactly the `header` / `footer` objects a save would write, so what the
 * merchant sees in the canvas is what the store will get.
 */
export function lookToShellPreview(existing: Record<string, unknown> | undefined, look: StoreLook): ShellPreview {
  const { themeSettings } = lookToWorkspacePatch(existing, look);
  const header = themeSettings.header as Record<string, unknown>;
  const footer = (themeSettings.footer as Record<string, unknown> | undefined) ?? null;
  // The Template look travels with them: the frame lays it over the template's at once (storefront XsTokenStyles).
  return {
    header,
    footer,
    tokens: look.xsTokens ?? null,
    storePages: look.storePages ?? null,
    storeWords: look.storeWords ?? null,
    // The header's font travels with the header; the frame draws it at once (storefront LiveStoreFonts).
    fonts: look.fonts ?? null,
  };
}

/** How long the saved `themeSettings` JSON would be — the API refuses more than THEME_SETTINGS_MAX_CHARS. */
export function themeSettingsSize(existing: Record<string, unknown> | undefined, look: StoreLook): number {
  return JSON.stringify(lookToWorkspacePatch(existing, look).themeSettings).length;
}

/**
 * The saved shape of `header.announcement`, matching exactly what
 * `announcementOf` in apps/storefront/src/lib/storeAnnouncement.ts expects:
 * `text` for the first (or only) message, `messages` added only when there
 * are genuinely two or more, `href`/`background`/`color` left out entirely
 * when unset (so `announcementOf`'s own optional-field reads see them as
 * absent, exactly as if this bar had never been touched).
 *
 * Turning the bar on with every message left blank is not a state a save can
 * represent as "on" — `announcementOf` would have nothing to show — so it is
 * written as `enabled: false` instead of being refused. The panel warns about
 * this before the merchant saves (see StoreLookPanel's blank-messages hint).
 */
function announcementPatch(a: StoreAnnouncementLook): Record<string, unknown> {
  const messages = a.messages.map((m) => m.trim()).filter((m) => m !== "");
  const patch: Record<string, unknown> = { enabled: a.enabled && messages.length > 0 };
  if (messages.length > 0) {
    patch.text = messages[0];
    if (messages.length > 1) patch.messages = messages;
  }
  if (a.href) patch.href = a.href;
  if (a.background) patch.background = a.background;
  if (a.color) patch.color = a.color;
  return patch;
}

function sameAnnouncement(a: StoreAnnouncementLook, b: StoreAnnouncementLook): boolean {
  return (
    a.enabled === b.enabled &&
    a.href === b.href &&
    a.background === b.background &&
    a.color === b.color &&
    a.messages.length === b.messages.length &&
    a.messages.every((m, i) => m === b.messages[i])
  );
}

export function sameLook(a: StoreLook, b: StoreLook): boolean {
  return (
    a.storeTheme === b.storeTheme &&
    a.primaryColor === b.primaryColor &&
    a.primaryColorFromTemplate === b.primaryColorFromTemplate &&
    a.primaryColorDark === b.primaryColorDark &&
    a.secondaryColor === b.secondaryColor &&
    a.fontFamily === b.fontFamily &&
    a.cornerRadius === b.cornerRadius &&
    a.logoUrl === b.logoUrl &&
    sameAnnouncement(a.announcement, b.announcement) &&
    sameHeader(a.header, b.header) &&
    sameFooter(a.footer, b.footer) &&
    JSON.stringify(a.storePages ?? null) === JSON.stringify(b.storePages ?? null) &&
    JSON.stringify(a.storeWords ?? null) === JSON.stringify(b.storeWords ?? null) &&
    sameTokens(a, b)
  );
}

function sameTokens(a: StoreLook, b: StoreLook): boolean {
  return JSON.stringify(a.xsTokens ?? null) === JSON.stringify(b.xsTokens ?? null) && JSON.stringify(a.fonts ?? null) === JSON.stringify(b.fonts ?? null);
}

/** Only the theme, colours, font, corners and logo — what the Store look tab itself edits. */
export function sameAppearance(a: StoreLook, b: StoreLook): boolean {
  return sameLook({ ...a, announcement: b.announcement, header: b.header, footer: b.footer }, b);
}

/** Only the announcement bar, header and footer — what the preview's `shell` carries. */
export function sameShellParts(a: StoreLook, b: StoreLook): boolean {
  return (
    sameAnnouncement(a.announcement, b.announcement) &&
    sameHeader(a.header, b.header) &&
    sameFooter(a.footer, b.footer) &&
    sameTokens(a, b) &&
    JSON.stringify([a.storePages ?? null, a.storeWords ?? null]) === JSON.stringify([b.storePages ?? null, b.storeWords ?? null])
  );
}
