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
 * storefront's light look (apps/storefront globals.css): the fill is the
 * store's accent (--color-primary; this is the default one, a store's own
 * primaryColor is passed in where known), the track --color-line. The server
 * checks against the same.
 */
export const THEME_COLORS = { fill: "#1f5d5b", track: "#dcdace" } as const;
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
export function contrastProblems(look: BarLook, themeFill: string = THEME_COLORS.fill): ContrastProblem[] {
  const out: ContrastProblem[] = [];
  const fill = look.fillColor ?? themeFill;
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
 * whichever is the smaller step) that reaches 3:1 against `against` — every
 * one of them when it is a list.
 */
export function nearestPassing(color: string, against: string | readonly string[]): string {
  const all = typeof against === "string" ? [against] : against;
  const passes = (c: string) => all.every((other) => contrastRatio(c, other) >= MIN_CONTRAST);
  if (passes(color)) return color;
  const [h, s, l] = toHsl(color);
  for (let step = 1; step <= 100; step++) {
    for (const next of [l - step / 100, l + step / 100]) {
      if (next < 0 || next > 1) continue;
      const candidate = fromHsl(h, s, next);
      if (passes(candidate)) return candidate;
    }
  }
  // Nothing in between reads on all of them: whichever of black and white does best on the first.
  return iconColorOn(all[0]);
}

/**
 * The store's accent as the rewards bar fills with it (the store's style):
 * itself when it reaches 3:1 against the track and the card it sits on, else
 * the nearest shade of it that does (darker on a light page, lighter on a
 * dark one). The colours are the ones the page actually draws, so a theme, a
 * template or dark mode is taken as it is.
 */
export const readableAccent = (accent: string, against: readonly string[]): string => nearestPassing(accent, against.filter((c) => HEX.test(c)));

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const gamma = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function fromOklab(L: number, a: number, b: number): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex(gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
}

/**
 * A colour as getComputedStyle gives it (#hex, rgb()/rgba(), color(srgb …),
 * oklab(), oklch()) as #rrggbb; null for anything else, or a see-through one.
 */
export function parseCssColor(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase();
  if (HEX.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const parts = (inside: string) => inside.split(/[\s,/]+/).filter(Boolean);
  const num = (x: string, scale = 1) => (x.endsWith("%") ? (parseFloat(x) / 100) * scale : parseFloat(x));
  let m = /^rgba?\((.*)\)$/.exec(v);
  if (m) {
    const [r, g, b, alpha] = parts(m[1]);
    if (alpha !== undefined && num(alpha) === 0) return null;
    const out = [r, g, b].map((x) => num(x, 255));
    return out.every(Number.isFinite) ? toHex(out[0], out[1], out[2]) : null;
  }
  m = /^color\(srgb (.*)\)$/.exec(v);
  if (m) {
    const [r, g, b, alpha] = parts(m[1]);
    if (alpha !== undefined && num(alpha) === 0) return null;
    const out = [r, g, b].map((x) => num(x) * 255);
    return out.every(Number.isFinite) ? toHex(out[0], out[1], out[2]) : null;
  }
  m = /^oklab\((.*)\)$/.exec(v);
  if (m) {
    const [L, a, b] = parts(m[1]);
    const out = [num(L), num(a, 0.4), num(b, 0.4)];
    return out.every(Number.isFinite) ? fromOklab(out[0], out[1], out[2]) : null;
  }
  m = /^oklch\((.*)\)$/.exec(v);
  if (m) {
    const [L, C, H] = parts(m[1]);
    const h = (parseFloat(H) * Math.PI) / 180;
    const c = num(C, 0.4);
    const l = num(L);
    return [l, c, h].every(Number.isFinite) ? fromOklab(l, c * Math.cos(h), c * Math.sin(h)) : null;
  }
  return null;
}

/**
 * "Auto-fix": the look with the merchant's own colour nudged until every pair
 * passes (the fill when it is theirs, else the track). Unchanged when nothing fails.
 */
export function autoFixLook(look: BarLook, themeFill: string = THEME_COLORS.fill): BarLook {
  if (contrastProblems(look, themeFill).length === 0) return look;
  if (look.fillColor) return { ...look, fillColor: nearestPassing(look.fillColor, look.trackColor ?? THEME_COLORS.track) };
  if (look.trackColor) return { ...look, trackColor: nearestPassing(look.trackColor, themeFill) };
  return look;
}
