import {
  Fraunces,
  IBM_Plex_Sans_Arabic,
  Noto_Kufi_Arabic,
  Plus_Jakarta_Sans,
} from "next/font/google";

/**
 * All four families are loaded on every route (the locale is only known
 * per-request, below the root layout). Each exposes a CSS variable; the root
 * layout puts every `.variable` class on <html> plus a `lang-*` class, and
 * `globals.css` maps `--font-heading` / `--font-body` to the right pair for
 * the active locale.
 */

// English headings — display serif.
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-fraunces",
});

// English body.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

// Arabic headings.
export const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-noto-kufi",
});

// Arabic body (not a variable font — weights are explicit).
export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-arabic",
});

/** Space-separated `.variable` classes for every family. */
export const fontVariables = [
  fraunces.variable,
  plusJakarta.variable,
  notoKufiArabic.variable,
  ibmPlexSansArabic.variable,
].join(" ");
