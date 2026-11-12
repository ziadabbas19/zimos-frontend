import { useEffect, useState } from "react";
import { fontCatalogGet, type FontCatalogEntry } from "@store-builder/api-client";
import { apiClient } from "./apiClient";

/**
 * The store font catalog (GET /fonts), read once per session and shared by
 * every picker: Store settings → Fonts, the website and funnel editors, the
 * product page. Null while it loads; an empty list if it can't be read (the
 * pickers then offer "store default" only, and say they are loading no more).
 */

let cached: FontCatalogEntry[] | null = null;
let pending: Promise<FontCatalogEntry[]> | null = null;

export function loadFontCatalog(): Promise<FontCatalogEntry[]> {
  if (cached) return Promise.resolve(cached);
  pending ??= fontCatalogGet(apiClient)
    .then((catalog) => {
      cached = Array.isArray(catalog.fonts) ? catalog.fonts : [];
      return cached;
    })
    .catch(() => {
      // Asked again by the next picker that opens.
      pending = null;
      return [];
    });
  return pending;
}

export function useFontCatalog(): FontCatalogEntry[] | null {
  const [fonts, setFonts] = useState<FontCatalogEntry[] | null>(cached);
  useEffect(() => {
    if (cached) return;
    let live = true;
    void loadFontCatalog().then((list) => live && setFonts(list));
    return () => {
      live = false;
    };
  }, []);
  return fonts;
}

/** Tests only: forget the session's catalog. */
export function resetFontCatalogForTests(): void {
  cached = null;
  pending = null;
}
