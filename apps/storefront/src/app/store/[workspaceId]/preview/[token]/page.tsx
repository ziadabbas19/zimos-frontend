import { XsDarkStyles } from "@/components/xs/XsLookStyles";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageRenderer } from "@/components/page-renderer";
import { PreviewBridge } from "@/components/preview/PreviewBridge";
import { THEME_FONT_CSS } from "@/app/themeFonts";
import { brandVars, previewBootScript, type PreviewTheme } from "@/lib/brandTheme";
import { getPreview } from "@/lib/previewStore";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/**
 * A draft page tree posted by the dashboard (see ../route.ts), rendered with
 * exactly the components a published page uses — the store layout supplies the
 * header, footer, brand colours and language, and the commerce blocks pull the
 * live catalogue. Only reachable through the random token the dashboard
 * minted, and only briefly.
 */
export default async function StorePreviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; token: string }>;
}) {
  // The same URL shows a new tree after every post, so never prerender or
  // reuse a render.
  await connection();
  const { workspaceId, token } = await params;

  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();

  const entry = getPreview(token, workspaceId);
  if (!entry) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-ink" dir="rtl">
            انتهت صلاحية المعاينة. حدّثها من لوحة التحكم.
          </p>
          <p className="text-sm text-ink-soft">This preview has expired. Refresh it from the dashboard.</p>
        </div>
      </main>
    );
  }

  const empty = (entry.tree.sections?.length ?? 0) === 0;
  const locale = await getStoreLocale(store);
  // The website editor's extras: its unsaved store look, and the click-to-select
  // canvas. A plain preview has neither and renders as it always has.
  const options = entry.options;
  const editable = Boolean(options?.editable && options.parentOrigin);
  const themeCss = options?.theme ? themeStyle(options.theme) : "";
  const boot = previewBootScript(options?.theme ?? null, options?.colorMode ?? null);

  return (
    <main className="flex-1">
      {/* First paint in the unsaved look; the bridge takes over once hydrated.
          The script puts the unsaved theme on the store wrapper and the asked-for
          colour mode on <html> while the page is still being parsed. */}
      {boot && <script dangerouslySetInnerHTML={{ __html: boot }} />}
      {themeCss && <style id="zimos-preview-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
      {/* Every theme's font stacks, so the editor can switch theme without a reload. */}
      <style dangerouslySetInnerHTML={{ __html: THEME_FONT_CSS }} />
      {/* The editor's light / dark switch works on any template, whatever shoppers are offered. */}
      <XsDarkStyles />
      {empty ? (
        <div className="px-6 py-16 text-center text-sm text-ink-soft">
          <p>
            <span dir="rtl">الصفحة دي لسه فاضية.</span> · This page is empty.
          </p>
          {editable && (
            <button
              type="button"
              data-zimos-insert="0"
              className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 border-dashed border-line px-5 text-sm font-medium text-ink hover:border-primary hover:text-primary"
            >
              + <span dir="rtl" className="mx-1">ضيف قسم</span> · Add a section
            </button>
          )}
        </div>
      ) : (
        <PageRenderer
          tree={entry.tree}
          workspaceId={workspaceId}
          currency={store.currency}
          locale={locale}
          editable={editable}
        />
      )}
      {options?.parentOrigin && (
        <PreviewBridge
          parentOrigin={options.parentOrigin}
          editable={editable}
          token={token}
          initialTheme={options.theme}
          initialShell={options.shell ?? null}
        />
      )}
    </main>
  );
}

/**
 * The unsaved look as a stylesheet rule. Every value comes out of brandVars,
 * which only ever emits a validated hex or one of its own fixed strings.
 */
function themeStyle(theme: PreviewTheme): string {
  const vars = brandVars(theme as Record<string, unknown>, { complete: true });
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}:${value} !important`)
    .join(";");
  return body ? `.brand-theme{${body}}` : "";
}
