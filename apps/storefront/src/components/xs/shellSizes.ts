import { DEVICE_MEDIA, type PerDevice } from "@/lib/deviceValue";

/**
 * A template header's and footer's own sizes (the editor's Header and Footer
 * panels, and the logo's corner on the canvas → themeSettings.header.sizes /
 * footer.sizes), each one value for every screen or one per screen
 * (lib/deviceValue). Drawn as a small stylesheet beside the header or footer:
 * a computer's rules, then a tablet's and a phone's inside their media
 * queries. Every value is a whole number lib/storeShell.ts has already
 * clamped; nothing a merchant typed reaches the CSS as text.
 *
 * `[data-zimos-shell]` lifts each rule level with a look's own rule for the
 * same part; being later in the page, it wins.
 */

type Rule = (px: number) => string;

const HEADER: Record<string, Rule> = {
  logo: (v) =>
    `.xs-header[data-zimos-shell]{--xs-logo-h:${v}px}` +
    `.xs-header[data-zimos-shell] .xs-header__logo{height:${v}px!important}` +
    `.xs-header[data-zimos-shell] .xs-header__logo-img{width:auto;max-width:none;height:100%}` +
    `.xs-header[data-zimos-shell] .xs-header__logo-name{font-size:${Math.round(v * 0.6)}px!important}`,
  menu: (v) => `.xs-header[data-zimos-shell] .xs-header__link{font-size:${v}px!important}`,
  strip: (v) => `.xs-header[data-zimos-shell] .xs-header__strip{font-size:${v}px!important}`,
  // The looks that lay their header over the first band read the bar's height to make room for it.
  bar: (v) =>
    `.xs-header[data-zimos-shell]{--xs-own-bar-h:${v}px}` +
    `@media (min-width:992px){.xs-header[data-zimos-shell]:not([data-scrolled]) .xs-header__bar{height:${v}px!important}}`,
};

const FOOTER: Record<string, Rule> = {
  title: (v) => `.xs-footer[data-zimos-shell] .xs-footer__title{font-size:${v}px!important}`,
  text: (v) =>
    `.xs-footer[data-zimos-shell],.xs-footer[data-zimos-shell] :is(p,li,a,.xs-footer__text,.xs-footer__link){font-size:${v}px!important}`,
  logo: (v) =>
    `.xs-footer[data-zimos-shell] .xs-footer__logo{height:${v}px!important;max-height:none!important;width:auto!important;max-width:none!important}` +
    // The store's name standing in for the logo: set at the same height.
    `.xs-footer[data-zimos-shell] .xs-footer__name{font-size:${Math.round(v * 0.6)}px!important;line-height:${v}px}`,
};

function sheet(rules: Record<string, Rule>, sizes: Record<string, PerDevice<number>> | undefined): string {
  if (!sizes) return "";
  let base = "";
  let tablet = "";
  let mobile = "";
  for (const [key, rule] of Object.entries(rules)) {
    const values = sizes[key];
    if (!values) continue;
    if (values.base !== undefined) base += rule(values.base);
    if (values.tablet !== undefined) tablet += rule(values.tablet);
    if (values.mobile !== undefined) mobile += rule(values.mobile);
  }
  return base + (tablet ? `@media ${DEVICE_MEDIA.tablet}{${tablet}}` : "") + (mobile ? `@media ${DEVICE_MEDIA.mobile}{${mobile}}` : "");
}

/**
 * The footer's column widths, per screen: each column's share of the row in
 * parts (1–4; one part where it names none), as the grid's columns. Nothing
 * when no column names a width — the look's own grid stands. The pages and
 * policies column stands for as many columns as it draws.
 */
export function footerWidthCss(columns: Array<{ type: string; width?: unknown }>, pageColumns: number): string {
  const share = (raw: unknown, device: "base" | "tablet" | "mobile"): number | undefined => {
    const ok = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 4;
    if (ok(raw)) return device === "base" ? raw : undefined;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const v = (raw as Record<string, unknown>)[device];
      return ok(v) ? v : undefined;
    }
    return undefined;
  };
  let css = "";
  for (const device of ["base", "tablet", "mobile"] as const) {
    if (!columns.some((col) => share(col.width, device) !== undefined)) continue;
    const tracks = columns.flatMap((col) => {
      const n = col.type === "pages" ? pageColumns : 1;
      return Array.from({ length: n }, () => `minmax(0,${share(col.width, device) ?? 1}fr)`);
    });
    if (tracks.length === 0) continue;
    const rule = `.xs-footer[data-zimos-shell] .xs-footer__grid{grid-template-columns:${tracks.join(" ")}!important}`;
    // A width is layout: each screen's grid holds on that screen only, so a phone keeps the look's stacking unless it names its own.
    const media = device === "base" ? "(min-width: 1024px)" : device === "tablet" ? "(min-width: 640px) and (max-width: 1023px)" : DEVICE_MEDIA.mobile;
    css += `@media ${media}{${rule}}`;
  }
  return css;
}

export const headerSizeCss = (sizes: Record<string, PerDevice<number>> | undefined) => sheet(HEADER, sizes);
export const footerSizeCss = (sizes: Record<string, PerDevice<number>> | undefined) => sheet(FOOTER, sizes);
