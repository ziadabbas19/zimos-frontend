"use client";

import { useEffect, useMemo, useState } from "react";
import { fontCatalogGet } from "@store-builder/api-client";
import { fontAlias, fontFitsRole, fontIndex, fontUses, type FontOption } from "@store-builder/ui/fonts";
import { loadRoleFont } from "@store-builder/ui/font-picker";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStoreFontsOverride } from "@/lib/StoreShellContext";
import { storeFontRules } from "@/lib/storeFonts";

/**
 * The website editor's unsaved store fonts — the header's font as the merchant
 * picks it in the header panel — drawn in the preview frame at once, without
 * a reload: the same rules the layout writes (lib/storeFonts.ts), every part
 * spelled out so a pick just removed is undone too, and the faces registered
 * in the browser under the names the rules use.
 *
 * Renders nothing — and loads nothing — on every page a shopper sees: only
 * the editor's preview bridge sets an override.
 */

let catalog: Promise<Map<string, FontOption>> | null = null;
function loadCatalog(): Promise<Map<string, FontOption>> {
  catalog ??= fontCatalogGet(createStorefrontApiClient())
    .then((body) => fontIndex(Array.isArray(body.fonts) ? body.fonts : []))
    .catch(() => {
      catalog = null;
      return new Map<string, FontOption>();
    });
  return catalog;
}

export function LiveStoreFonts() {
  const fonts = useStoreFontsOverride();
  const [index, setIndex] = useState<Map<string, FontOption> | null>(null);
  const active = fonts !== undefined;

  const rules = useMemo(() => (active ? storeFontRules({ fonts }, { complete: true }) : null), [active, fonts]);

  useEffect(() => {
    if (!active || index) return;
    let live = true;
    void loadCatalog().then((map) => live && setIndex(map));
    return () => {
      live = false;
    };
  }, [active, index]);

  useEffect(() => {
    if (!rules || !index) return;
    for (const { role, id } of fontUses(...rules.pairs)) {
      const font = index.get(id);
      if (font && fontFitsRole(font, role)) void loadRoleFont(font, role, fontAlias(role, id));
    }
  }, [rules, index]);

  if (!rules) return null;
  return <style data-zf-live="">{rules.css}</style>;
}
