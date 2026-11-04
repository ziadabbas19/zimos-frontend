import { PreviewBridge } from "./LazyPreviewBridge";
import { THEME_FONT_CSS } from "@/app/themeFonts";
import { brandVars, previewBootScript, type PreviewTheme } from "@/lib/brandTheme";
import type { EditorView } from "@/lib/editorView";

/**
 * The website editor's bridge on one of the store's own pages (lib/editorView):
 * the same as on its preview page — the unsaved theme on first paint, then the
 * bridge, through which a click on the header or footer opens its panel and
 * the editor's later changes reach the page.
 */
export function EditorViewBridge({ view }: { view: EditorView }) {
  const { options, token } = view;
  const themeCss = options.theme ? themeStyle(options.theme) : "";
  const boot = previewBootScript(options.theme ?? null, options.colorMode ?? null);
  return (
    <>
      {boot && <script dangerouslySetInnerHTML={{ __html: boot }} />}
      {themeCss && <style id="zimos-preview-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <style dangerouslySetInnerHTML={{ __html: THEME_FONT_CSS }} />
      <PreviewBridge parentOrigin={options.parentOrigin ?? ""} editable token={token} initialTheme={options.theme} initialShell={options.shell ?? null} />
    </>
  );
}

function themeStyle(theme: PreviewTheme): string {
  const vars = brandVars(theme as Record<string, unknown>, { complete: true });
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}:${value} !important`)
    .join(";");
  return body ? `.brand-theme{${body}}` : "";
}
