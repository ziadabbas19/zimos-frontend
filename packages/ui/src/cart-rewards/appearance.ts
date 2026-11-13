/**
 * The rewards bar's look (Offers → Cart rewards → Bar appearance): the
 * store's theme (`inherit`, today's look) or the merchant's own (`custom`).
 * The server checks the same rules (backend cartRewards/barAppearance.js);
 * this side says them before saving and offers to fix a failing colour.
 */

export type CartSpeed = "fast" | "normal" | "none";

export interface BarLook {
  shape: "thin" | "thick" | "segmented";
  corners: "rounded" | "square";
  /** #rrggbb, or null for the theme's. */
  fillColor: string | null;
  trackColor: string | null;
  marker: "circle" | "rounded_square" | "none";
  markerSize: "sm" | "md" | "lg";
  showAmounts: boolean;
  reachedPop: boolean;
  showMessage: boolean;
  messageAlign: "start" | "center";
}

/** What the bar is drawn with: the theme's (null/inherit) or a custom look. */
export type BarAppearance = { mode: "inherit" } | ({ mode: "custom" } & BarLook);

/** Today's look: what "Customize" starts from, and what `inherit` draws. */
export const INHERITED_LOOK: BarLook = {
  shape: "thick",
  corners: "rounded",
  fillColor: null,
  trackColor: null,
  marker: "circle",
  markerSize: "md",
  showAmounts: true,
  reachedPop: true,
  showMessage: true,
  messageAlign: "start",
};

/** The custom look to draw, or null to draw the theme's (today's bar). */
export function customLookOf(appearance: BarAppearance | null | undefined): BarLook | null {
  if (!appearance || appearance.mode !== "custom") return null;
  const { mode: _mode, ...look } = appearance;
  return { ...INHERITED_LOOK, ...look };
}

/** How long the fill glides at each cart speed (the sheet's own slide is endpoints/cartSheet). */
export const FILL_MS: Record<CartSpeed, number> = { fast: 350, normal: 500, none: 0 };

// --- colour --------------------------------------------------------------------

export const HEX = /^#[0-9a-fA-F]{6}$/;

/*
 * The theme's colours a "match the store theme" side stands for, in the
 * storefront's light look (apps/storefront globals.css: --color-success and
 * --color-line). The server checks against the same two.
 */
export const THEME_COLORS = { fill: "#357150", track: "#dcdace" } as const;
export const MIN_CONTRAST = 3;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const n = parseInt(color.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** The WCAG contrast ratio of two #rrggbb colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `background`: a reached marker's icon. */
export function iconColorOn(background: string): string {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}

export interface ContrastProblem {
  /** The look's field the merchant should change. */
  field: "fillColor" | "trackColor";
  pair: "fill_track" | "icon_fill";
  colors: [string, string];
  ratio: number;
}

/**
 * The custom look's pairs under 3:1, as the server finds them: the fill
 * against the track (when either is the merchant's), and a reached marker's
 * icon against its fill (black or white, so it always passes).
 */
export function contrastProblems(look: BarLook): ContrastProblem[] {
  const out: ContrastProblem[] = [];
  const fill = look.fillColor ?? THEME_COLORS.fill;
  const track = look.trackColor ?? THEME_COLORS.track;
  if (look.fillColor || look.trackColor) {
    const ratio = contrastRatio(fill, track);
    if (ratio < MIN_CONTRAST) out.push({ field: look.fillColor ? "fillColor" : "trackColor", pair: "fill_track", colors: [fill, track], ratio: Math.floor(ratio * 100) / 100 });
  }
  if (look.fillColor && look.marker !== "none") {
    const ratio = contrastRatio(iconColorOn(look.fillColor), look.fillColor);
    if (ratio < MIN_CONTRAST) out.push({ field: "fillColor", pair: "icon_fill", colors: [iconColorOn(look.fillColor), look.fillColor], ratio: Math.floor(ratio * 100) / 100 });
  }
  return out;
}

function toHsl(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  let r = l;
  let g = l;
  let b = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const part = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * The nearest colour to `color` (same hue and saturation, lighter or darker,
 * whichever is the smaller step) that reaches 3:1 against `against`.
 */
export function nearestPassing(color: string, against: string): string {
  if (contrastRatio(color, against) >= MIN_CONTRAST) return color;
  const [h, s, l] = toHsl(color);
  for (let step = 1; step <= 100; step++) {
    for (const next of [l - step / 100, l + step / 100]) {
      if (next < 0 || next > 1) continue;
      const candidate = fromHsl(h, s, next);
      if (contrastRatio(candidate, against) >= MIN_CONTRAST) return candidate;
    }
  }
  return iconColorOn(against);
}

/**
 * "Auto-fix": the look with the merchant's own colour nudged until every pair
 * passes (the fill when it is theirs, else the track). Unchanged when nothing fails.
 */
export function autoFixLook(look: BarLook): BarLook {
  if (contrastProblems(look).length === 0) return look;
  if (look.fillColor) return { ...look, fillColor: nearestPassing(look.fillColor, look.trackColor ?? THEME_COLORS.track) };
  if (look.trackColor) return { ...look, trackColor: nearestPassing(look.trackColor, THEME_COLORS.fill) };
  return look;
}
