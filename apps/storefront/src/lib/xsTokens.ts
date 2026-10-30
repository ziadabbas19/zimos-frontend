/**
 * The "Template look" of a store that wears an imported template: one place
 * for what every band, the header and the footer share — the heading face,
 * the text face, the buttons' corners, the size of the words and the space
 * between sections. The colour is the store's brand colour (Store look →
 * Brand colour, lib/xsShell xsOwnAccent), which already reaches every band.
 *
 *   themeSettings.xsTokens = {
 *     display: "playfair",  sans: "poppins",   faces from FACES
 *     radius:  0–40,                           the buttons' corners, px
 *     scale:   85–125,                         the words, % of the template's
 *     space:   50–150,                         the space above and below each section, %
 *     readable: true,                           the template's too-light text colours darkened
 *                                               just enough for 4.5:1 (lib/xsReadable.ts)
 *   }
 *
 * Anything left out is the template's own. The values are written as the
 * look's own custom properties (xsTokenCss), at the specificity of the look's
 * token block — after it, so they win over it — and under a band's own look
 * (components/page-renderer/xs/own.tsx), which still wins over them.
 */

export interface XsFace {
  label: string;
  /** The Latin face, then its Arabic partner (app/xs-fonts.css). */
  stack: string;
  /** A look whose stylesheet carries both faces' @font-face rules: linked beside the store's own. */
  via: string;
}

/** Curated pairs, each the Latin face of one of the templates with the Arabic face it was paired with. */
export const FACES: Record<string, XsFace> = {
  poppins: { label: "Poppins · تجوّل", stack: '"XS01 Sans", "XS01 Sans Fallback", "XS Ar Tajawal", sans-serif', via: "01" },
  playfair: { label: "Playfair Display · المسيري", stack: '"XS01 Display", "XS01 Display Fallback", "XS Ar El Messiri", serif', via: "01" },
  inter: { label: "Inter · IBM Plex Arabic", stack: '"Inter", "XS Ar IBM Plex Sans Arabic", sans-serif', via: "02" },
  jost: { label: "Jost · تجوّل", stack: '"Jost", "XS Ar Tajawal", sans-serif', via: "03" },
  marcellus: { label: "Marcellus · أميري", stack: '"Marcellus", "XS Ar Amiri", serif', via: "03" },
  montserrat: { label: "Montserrat · القاهرة", stack: '"Montserrat", "XS Ar Cairo", sans-serif', via: "04" },
  nunito: { label: "Nunito Sans · المراعي", stack: '"Nunito Sans", "XS Ar Almarai", sans-serif', via: "05" },
  opensans: { label: "Open Sans · القاهرة", stack: '"Open Sans", "XS Ar Cairo", sans-serif', via: "07" },
  raleway: { label: "Raleway · ريدكس", stack: '"Raleway", "XS Ar Readex Pro", sans-serif', via: "07" },
  roboto: { label: "Roboto · IBM Plex Arabic", stack: '"Roboto", "XS Ar IBM Plex Sans Arabic", sans-serif', via: "08" },
  rubik: { label: "Rubik · ريدكس", stack: '"Rubik", "XS Ar Readex Pro", sans-serif', via: "09" },
  lato: { label: "Lato · المراعي", stack: '"Lato", "XS Ar Almarai", sans-serif', via: "11" },
  syne: { label: "Syne · ريم كوفي", stack: '"Syne", "XS Ar Reem Kufi", sans-serif', via: "11" },
  cookie: { label: "Cookie · رقعة", stack: '"Cookie", "XS Ar Aref Ruqaa", serif', via: "18" },
  lalezar: { label: "Nunito Sans · لاله‌زار", stack: '"Nunito Sans", "XS Ar Lalezar", sans-serif', via: "20" },
};

import { XS_READABLE } from "./xsReadable";

export interface XsTokens {
  readable?: boolean;
  display?: string;
  sans?: string;
  radius?: number;
  scale?: number;
  space?: number;
}

const objectOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function within(value: unknown, least: number, most: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= least && value <= most ? Math.round(value) : undefined;
}

/** The saved tokens, each checked; empty when nothing was chosen. */
export function readXsTokens(raw: unknown): XsTokens {
  const saved = objectOf(raw);
  if (!saved) return {};
  const face = (value: unknown) => (typeof value === "string" && Object.hasOwn(FACES, value) ? value : undefined);
  const out: XsTokens = {};
  const display = face(saved.display);
  const sans = face(saved.sans);
  const radius = within(saved.radius, 0, 40);
  const scale = within(saved.scale, 85, 125);
  const space = within(saved.space, 50, 150);
  if (display) out.display = display;
  if (sans) out.sans = sans;
  if (radius !== undefined) out.radius = radius;
  if (scale !== undefined && scale !== 100) out.scale = scale;
  if (space !== undefined && space !== 100) out.space = space;
  if (saved.readable === true) out.readable = true;
  return out;
}

/** The looks whose stylesheets carry the chosen faces. */
export function xsTokenLooks(tokens: XsTokens): string[] {
  return [...new Set([tokens.display, tokens.sans].flatMap((key) => (key ? [FACES[key].via] : [])))];
}

/** The buttons and fields a band rounds (the same list as a band's own corners, own.tsx). */
const CORNERED = '.xs-btn,.xs-slider__button,.xs-contact__submit,.xs-products__more-btn,button[type="submit"],input:not([type="checkbox"]):not([type="radio"])';
/** The words: the outermost of each kind, so nothing is enlarged twice. */
const WORDS = "h1,h2,h3,h4,h5,h6,p,li,blockquote,dt,dd";

/** The store's tokens as CSS for the look it wears, or "" when it keeps every one of the template's. */
export function xsTokenCss(tokens: XsTokens, look?: string): string {
  const vars: string[] = [];
  if (tokens.readable && look) for (const [name, shade] of Object.entries(XS_READABLE[look] ?? {})) vars.push(`${name}:${shade}`);
  if (tokens.display) vars.push(`--xs-display:${FACES[tokens.display].stack}`);
  if (tokens.sans) vars.push(`--xs-sans:${FACES[tokens.sans].stack}`);
  if (tokens.radius !== undefined) vars.push(`--xs-btn-radius:${tokens.radius}px`);
  if (tokens.space !== undefined) vars.push(`--xs-space:${tokens.space / 100}`);
  // The wrapper (the store's own pages read the look's tokens there) and every band, header and footer:
  // at the look's own specificity, after it.
  const at = ".brand-theme[data-xs-shell],:where(.brand-theme[data-xs-shell]) [data-xs-look]";
  let css = vars.length > 0 ? `${at}{${vars.join(";")}}` : "";
  // A look that sets a face on an element rather than through its token reads the token here.
  if (tokens.sans) css += `:where(.brand-theme[data-xs-shell]) [data-xs-look]{font-family:var(--xs-sans)}`;
  if (tokens.display) css += `:where(.brand-theme[data-xs-shell]) [data-xs-look] :is(h1,h2){font-family:var(--xs-display)}`;
  if (tokens.radius !== undefined) css += `:where(.brand-theme[data-xs-shell]) [data-xs-look] :is(${CORNERED}){border-radius:${tokens.radius}px!important}`;
  if (tokens.scale !== undefined) {
    css += `:where(.brand-theme[data-xs-shell]) [data-xs-look] :is(${WORDS}):not(:is(${WORDS}) *){zoom:${tokens.scale / 100}}`;
  }
  return css;
}
