import { useEffect, useState } from "react";
import { themesList, type CatalogTheme } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import type { EditorLocale } from "../editorLocale";
import { ORIGINAL_LOOK, THEME_SPECS, type ThemeChoice } from "../storeThemes";

/**
 * The platform's theme catalogue (GET /workspaces/:ws/themes), as the theme
 * panel needs it: which themes are offered, what the console named them, and
 * which are paid and not this store's — those cannot be saved (the API answers
 * 402), so the panel shows them locked instead of letting a Save fail.
 *
 * Read once per store while the editor is open and shared by the preset row
 * and the theme gallery. When it cannot be read the panel behaves as it always
 * did: every theme offered, none locked.
 */

type Catalog = Map<string, CatalogTheme>;

const cache = new Map<string, Promise<Catalog | null>>();

function loadCatalog(workspaceId: string): Promise<Catalog | null> {
  let pending = cache.get(workspaceId);
  if (!pending) {
    pending = themesList(apiClient, workspaceId).then(
      ({ themes }) => new Map(themes.map((theme) => [theme.key, theme])),
      () => {
        cache.delete(workspaceId);
        return null;
      }
    );
    cache.set(workspaceId, pending);
  }
  return pending;
}

export interface ThemeCatalog {
  /** Shown in the gallery: in the catalogue and not withdrawn. The original look and the store's own theme always are. */
  offered: (theme: ThemeChoice, current?: ThemeChoice) => boolean;
  /** Paid and not this store's: it cannot be chosen yet. */
  locked: (theme: ThemeChoice) => boolean;
  price: (theme: ThemeChoice) => { amount: number; currency: string } | null;
  name: (theme: ThemeChoice, locale: EditorLocale) => string;
  description: (theme: ThemeChoice, locale: EditorLocale) => string;
}

export function useThemeCatalog(): ThemeCatalog {
  const workspaceId = useWorkspaceId();
  const [state, setState] = useState<{ workspaceId: string; catalog: Catalog | null }>({ workspaceId: "", catalog: null });

  useEffect(() => {
    if (!workspaceId) return;
    let live = true;
    void loadCatalog(workspaceId).then((catalog) => {
      if (live) setState({ workspaceId, catalog });
    });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  const catalog = state.workspaceId === workspaceId ? state.catalog : null;
  const entry = (theme: ThemeChoice) => catalog?.get(theme);
  const lockedPrice = (theme: ThemeChoice) => {
    const e = entry(theme);
    return e?.price && !e.owned ? e.price : null;
  };

  return {
    offered: (theme, current) => {
      if (!catalog || theme === ORIGINAL_LOOK || theme === current) return true;
      const e = entry(theme);
      return !!e && e.isActive !== false;
    },
    locked: (theme) => lockedPrice(theme) !== null,
    price: lockedPrice,
    name: (theme, locale) => entry(theme)?.name[locale] || THEME_SPECS[theme].name[locale],
    description: (theme, locale) => entry(theme)?.description[locale] || THEME_SPECS[theme].description[locale],
  };
}
