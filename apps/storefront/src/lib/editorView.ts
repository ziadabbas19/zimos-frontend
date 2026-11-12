import { cache } from "react";
import { headers } from "next/headers";
import { getPreview, type PreviewOptions } from "./previewStore";

/**
 * The website editor showing one of the store's own pages — the catalogue, a
 * product, the cart, checkout — in its preview frame, in the look the
 * merchant has not saved yet.
 *
 * The preview route (app/store/[workspaceId]/preview/route.ts) keeps the
 * editor's unsaved look under a token and sends the frame to the real page
 * with `?zimos-view=<token>`; the proxy turns that into a request header
 * (shoppers cannot set it themselves, the proxy drops one that arrives), and
 * every read of the store's settings (lib/storeMeta getStoreState) lays the
 * unsaved look over the saved one for that request only. A shopper's request
 * carries no token and is never touched.
 */

export const EDITOR_VIEW_PARAM = "zimos-view";
export const EDITOR_VIEW_HEADER = "x-zimos-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isViewToken(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export interface EditorView {
  token: string;
  options: PreviewOptions;
}

/** The editor's view of this request, when it is one: a live token for this store, from an editor window. */
export const getEditorView = cache(async (workspaceId: string): Promise<EditorView | null> => {
  let token: string | null = null;
  try {
    token = (await headers()).get(EDITOR_VIEW_HEADER);
  } catch {
    return null;
  }
  if (!isViewToken(token)) return null;
  const entry = getPreview(token, workspaceId);
  if (!entry?.options?.parentOrigin || !entry.options.storePath) return null;
  return { token, options: entry.options };
});

/**
 * The store's settings with the editor's unsaved look laid over them: its
 * header and footer, its Template look, its shop pages and their words — the
 * same keys a save would write (dashboard storeLook.ts lookToWorkspacePatch).
 */
export function withEditorLook(themeSettings: Record<string, unknown> | null | undefined, options: PreviewOptions): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(themeSettings ?? {}) };
  const shell = options.shell;
  if (!shell) return next;
  const put = (key: string, value: Record<string, unknown> | null | undefined) => {
    if (value === undefined) return;
    if (value === null) delete next[key];
    else next[key] = value;
  };
  put("header", shell.header);
  put("footer", shell.footer);
  put("xsTokens", shell.tokens);
  put("storePages", shell.storePages);
  put("storeWords", shell.storeWords);
  put("fonts", shell.fonts);
  return next;
}
