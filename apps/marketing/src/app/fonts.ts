import { Fraunces, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/**
 * All three families are declared on every route (the locale is only known
 * per-request, below the root layout). Each exposes a CSS variable; the root
 * layout puts every `.variable` class on <html> plus a `lang-*` class, and
 * `globals.css` maps `--font-heading` / `--font-body` to the right pair for
 * the active locale.
 *
 * A browser only downloads a family some text on the page uses, but a
 * preloaded one is downloaded whatever the page. next/font preloads per
 * layout, not per locale, and both locales share the root layout, so only
 * Tajawal — the Arabic pages' only family, Arabic being the default locale —
 * is preloaded. The English pair (about 94 KB) is fetched when an English page
 * asks for it (Fraunces only where a title is set in it: pricing, contact and
 * the policies), and an Arabic page no longer downloads it at all.
 */

// English headings — display serif.
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-fraunces",
  preload: false,
});

// English body.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
  preload: false,
});

// Arabic headings and body (not a variable font — weights are explicit).
// Tajawal has no 600, so `font-semibold` renders at 700; 800 is for the
// landing's headings.
export const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-tajawal",
});

/** Space-separated `.variable` classes for every family. */
export const fontVariables = [
  fraunces.variable,
  plusJakarta.variable,
  tajawal.variable,
].join(" ");
