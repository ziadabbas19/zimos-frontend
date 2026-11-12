import type { PageTree } from "@store-builder/api-client";
import { readFontPair, readStoreFonts, resolveFontPair, type ResolvedFontPair } from "@store-builder/ui/fonts";

/**
 * The fonts a page built in the website or funnel editor picked:
 *
 *   tree.font                  the whole page
 *   section.settings.font      one section
 *   element.settings.font      one element
 *
 * each `{ ar, en }` catalog ids (the API checked them), resolved nearest
 * first — the element's, its section's, the page's, the store's — so a
 * script a part leaves on "store default" comes from the level above it
 * (lib/storeFonts.ts draws them). A tree without fonts renders exactly as
 * before: no wrapper, no style, no stylesheet.
 */

/** The fonts a node sits in, nearest first; the store's own pick is always last. */
export type FontLevels = ResolvedFontPair[];

const settingsFont = (settings: unknown): unknown =>
  settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>).font : null;

/** A node's own font, resolved over the levels it sits in; null when it picks none of its own. */
export function ownFont(settings: unknown, levels: FontLevels): ResolvedFontPair | null {
  const own = readFontPair(settingsFont(settings));
  return own ? resolveFontPair(own, ...levels) : null;
}

/**
 * The page's own resolved font (null without one), the levels its sections
 * start from, and every resolved pair the page draws — for its faces.
 */
export function pageFontPairs(
  tree: PageTree | null,
  themeSettings: Record<string, unknown> | null | undefined
): { page: ResolvedFontPair | null; levels: FontLevels; pairs: ResolvedFontPair[] } {
  const store = readStoreFonts(themeSettings).primary;
  const pageOwn = readFontPair((tree as { font?: unknown } | null)?.font);
  const page = pageOwn ? resolveFontPair(pageOwn, store) : null;
  const levels: FontLevels = page ? [page, store] : [store];
  const pairs: ResolvedFontPair[] = page ? [page] : [];
  for (const section of tree?.sections ?? []) {
    const sectionFont = ownFont(section?.settings, levels);
    if (sectionFont) pairs.push(sectionFont);
    const inner = sectionFont ? [sectionFont, ...levels] : levels;
    for (const row of section?.rows ?? []) {
      for (const column of row?.columns ?? []) {
        for (const element of column?.elements ?? []) {
          const elementFont = ownFont(element?.settings, inner);
          if (elementFont) pairs.push(elementFont);
        }
      }
    }
  }
  return { page, levels, pairs };
}
