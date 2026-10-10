import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { PreviewTheme } from "@/lib/previewBridge";
import { ORIGINAL_LOOK, readThemeChoice } from "../editor/storeThemes";

const HEX = /^#[0-9a-f]{6}$/i;

/** A template's accent when it is a plain six-digit hex, else null. */
export function templateColour(raw: unknown): string | null {
  const colour = typeof raw === "string" ? raw.trim() : "";
  return HEX.test(colour) ? colour : null;
}

/**
 * Has the store a look of its own — a theme, or an accent the merchant chose?
 * Then a template's colour never replaces it (see TemplateSheet's
 * applyTemplateColour).
 */
export function storeHasOwnLook(themeSettings: Record<string, unknown> | undefined): boolean {
  const set = (key: string) => {
    const existing = themeSettings?.[key];
    return typeof existing === "string" && existing.trim() !== "";
  };
  return set("primaryColor") || set("primaryColorDark") || readThemeChoice(themeSettings?.storeTheme) !== ORIGINAL_LOOK;
}

/**
 * The look a template's preview renders in: what applying it would give this
 * store — the template's accent on a store with no look of its own, the
 * store's own look otherwise (null: as saved).
 */
export function useTemplatePreviewTheme(template: Pick<WebsiteTemplateSummary, "primaryColor">): PreviewTheme | null {
  const { currentWorkspace } = useWorkspace();
  const colour = templateColour(template.primaryColor);
  if (!colour || storeHasOwnLook(currentWorkspace?.themeSettings)) return null;
  return { primaryColor: colour };
}
