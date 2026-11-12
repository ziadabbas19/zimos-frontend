import { createContext, useContext, useMemo } from "react";
import { readFontPair, readStoreFonts, type FontLevelPair, type FontPair, type StoreFonts } from "@store-builder/ui/fonts";
import { useWorkspace } from "@/context/WorkspaceContext";

/**
 * What a font field in the website or funnel editor falls back to, so it can
 * say where the face a part shows comes from (components/fonts/FontPairField):
 *
 *   an element  → its section → the page → the store
 *   a section   → the page → the store
 *   the page    → the store
 *   the header, the footer → the store
 *
 * The website editor provides the store's fonts as they stand in its unsaved
 * Store look, and the open page's own font; anywhere else (the funnel step
 * editor, Store settings) it is the store's saved fonts and no page font.
 */
export interface EditorFonts {
  store: StoreFonts;
  /** The open page's own font (tree.font); null without one. */
  page: FontPair | null;
  /** The store wears an imported template: a part with no font shows the template's faces. */
  template: boolean;
}

export const EditorFontsContext = createContext<EditorFonts | null>(null);

/** The editor's fonts, or the store's saved ones outside an editor that provides them. */
export function useEditorFonts(): EditorFonts {
  const provided = useContext(EditorFontsContext);
  const { currentWorkspace } = useWorkspace();
  const themeSettings = currentWorkspace?.themeSettings;
  const saved = useMemo<EditorFonts>(
    () => ({ store: readStoreFonts(themeSettings), page: null, template: typeof themeSettings?.xsLook === "string" }),
    [themeSettings]
  );
  return provided ?? saved;
}

/** The context value for an editor: its store look's fonts (`look.fonts`) and the page's own. */
export function editorFontsValue(themeFonts: unknown, pageFont: unknown, template: boolean): EditorFonts {
  return { store: readStoreFonts({ fonts: themeFonts }), page: readFontPair(pageFont), template };
}

/** The levels a part of a page falls back to, nearest first. */
export function pageLevels(fonts: EditorFonts, section?: unknown): FontLevelPair[] {
  const levels: FontLevelPair[] = [];
  if (section !== undefined) levels.push({ level: "section", pair: readFontPair(section) });
  levels.push({ level: "page", pair: fonts.page });
  levels.push({ level: "store", pair: fonts.store.primary });
  return levels;
}
