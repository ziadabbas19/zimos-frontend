/**
 * The store font catalog (backend src/modules/fonts).
 *
 * Public, GET /fonts → FontCatalog. Cacheable for an hour; `version` changes
 * whenever the list does.
 *
 * Where a picked font is saved — always a catalog `id`, never a family name,
 * and the API answers 422 for an id that isn't in the catalog or doesn't fit
 * the script it was picked for (an English face for Arabic text, or the
 * reverse):
 *
 *   PATCH /workspaces/:ws  themeSettings.fonts = StoreFontsValue
 *   page trees             data.font, section.settings.font, element.settings.font = FontPair
 *   products               pageSettings.font = FontPair
 *
 * null or absent anywhere = "the store default" for that part.
 *
 * How they are drawn and resolved: @store-builder/ui/fonts.
 */
import type { ApiClient } from "../client";

export type FontCatalogScript = "ar" | "latin" | "both";
export type FontCatalogCategory = "sans" | "serif" | "display" | "handwriting" | "mono" | "kufi" | "naskh" | "ruqaa";

export interface FontCatalogEntry {
  id: string;
  /** The Google Fonts family. */
  family: string;
  /** "ar" an Arabic face, "latin" a Latin face, "both" either. */
  script: FontCatalogScript;
  category: FontCatalogCategory;
  /** The family's fixed weights. */
  weights: number[];
  /** The range of its weight axis, when it has one. */
  variable?: [number, number];
  /** What a picker writes in this face. */
  preview: string;
}

export interface FontCatalog {
  version: string;
  scripts: FontCatalogScript[];
  categories: FontCatalogCategory[];
  fonts: FontCatalogEntry[];
}

/** A part's own fonts: the Arabic and the English face, each a catalog id or null. */
export interface FontPair {
  ar?: string | null;
  en?: string | null;
}

/** `themeSettings.fonts`: every key optional. */
export interface StoreFontsValue {
  primaryAr?: string | null;
  primaryEn?: string | null;
  /** The store name, the menu and the announcement bar. */
  header?: FontPair | null;
  /** Product pages and product cards. */
  products?: FontPair | null;
}

export function fontCatalogGet(client: ApiClient): Promise<FontCatalog> {
  return client.request<FontCatalog>("/fonts", { auth: false });
}
