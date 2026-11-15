import { Alexandria, IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";

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
 * the Arabic pair — Arabic being the default locale — is preloaded. The
 * English face is fetched when an English page asks for it, and an Arabic
 * page never downloads it.
 *
 * English is one family, titles and text alike: Plus Jakarta Sans, its
 * titles in the heavy weights (the owner's pick, 2026-11-15, from the
 * landing they sent). The serif English titles (Fraunces) are gone.
 */

// English titles and text: one variable file for every weight, 200 to 800.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
  preload: false,
});

// Arabic headings: a geometric display face, one variable file for every
// weight. It carries Latin too, so "ZIMOS" inside an Arabic title matches.
export const alexandria = Alexandria({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-alexandria",
});

// Arabic body (not a variable font — weights are explicit).
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-arabic",
});

/** Space-separated `.variable` classes for every family. */
export const fontVariables = [plusJakarta.variable, alexandria.variable, plexArabic.variable].join(" ");
