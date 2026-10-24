import { NextResponse, type NextRequest } from "next/server";
import type { PageTree } from "@store-builder/api-client";
import { readColorMode, readPreviewTheme, type PreviewTheme } from "@/lib/brandTheme";
import { previewOwner, putPreview, type PreviewOptions } from "@/lib/previewStore";
import { readShellOverride, type ShellOverride } from "@/lib/storeShell";
import { STORE_PREVIEW_COOKIE, storePreviewCookieOptions } from "@/lib/storePreview";
import { EDITOR_VIEW_PARAM } from "@/lib/editorView";
import { serverApiBase, serverApiFetch } from "@/lib/serverApiBase";

/**
 * Receives a draft page tree from the dashboard's live preview (a form post
 * targeted at an iframe), keeps it briefly and redirects the frame to the page
 * that renders it with the real storefront components.
 *
 * Only staff get to put content on a store's domain this way: the posted
 * access token must be accepted by the API for this workspace, where listing
 * websites needs WEBSITE_EDIT and listing funnels FUNNELS_MANAGE. The token is
 * used for that one check and never stored. The calls take the API's
 * private address when INTERNAL_API_BASE_URL is set (lib/serverApiBase).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Trees are a few KB; the backend caps them at 10 000 nodes.
const MAX_TREE_CHARS = 1_000_000;
// Same ~5KB ceiling the API puts on a saved themeSettings blob.
const MAX_THEME_CHARS = 5_000;
// The header and footer live in that same blob, so the same ceiling, with room
// for the unsaved edit the merchant hasn't trimmed yet.
const MAX_SHELL_CHARS = 10_000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** A bare notice shown inside the preview frame. The storefront speaks Arabic, the dashboard may not. */
function notice(status: number, arabic: string, english: string) {
  const body = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Preview</title></head><body style="margin:0;padding:3rem 1.5rem;font-family:system-ui,sans-serif;text-align:center;color:#3c4a46"><p>${escapeHtml(arabic)}</p><p dir="ltr" style="font-size:.875rem">${escapeHtml(english)}</p></body></html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** An exact `scheme://host[:port]` origin, or null. */
function readOrigin(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin === value ? value : null;
  } catch {
    return null;
  }
}

/**
 * One of the store's own pages the editor asks to see (lib/editorView.ts):
 * the catalogue, a product, the cart or checkout. "/product" is the store's
 * first product, whichever it is.
 */
function readStorePath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  return /^\/(products(\/[A-Za-z0-9._~%-]{1,200})?|product|cart|checkout)$/.test(value) ? value : null;
}

/** The store's first product, for the editor's "a product" view; the catalogue when it has none. */
async function firstProductPath(workspaceId: string): Promise<string> {
  try {
    const res = await serverApiFetch(`${serverApiBase()}/store/${workspaceId}/products?limit=1`, { cache: "no-store" });
    const body = (await res.json()) as { data?: { products?: Array<{ slug?: string }> }; products?: Array<{ slug?: string }> };
    const slug = (body.data?.products ?? body.products ?? [])[0]?.slug;
    return slug ? `/products/${encodeURIComponent(slug)}` : "/products";
  } catch {
    return "/products";
  }
}

/**
 * The website editor's extras (see PreviewOptions). All optional — a post
 * without them is a plain preview, exactly as before. A malformed theme or
 * shell is dropped rather than refused: the page still previews, in the saved
 * look.
 */
function readOptions(form: FormData): PreviewOptions | undefined {
  const editable = form.get("edit") === "1";
  const parentOrigin = readOrigin(form.get("parentOrigin"));
  const rawTheme = String(form.get("theme") ?? "");
  let theme: PreviewTheme | null = null;
  if (rawTheme && rawTheme.length <= MAX_THEME_CHARS) {
    try {
      theme = readPreviewTheme(JSON.parse(rawTheme));
    } catch {
      theme = null;
    }
  }
  const rawShell = String(form.get("shell") ?? "");
  let shell: ShellOverride | null = null;
  if (rawShell && rawShell.length <= MAX_SHELL_CHARS) {
    try {
      shell = readShellOverride(JSON.parse(rawShell));
    } catch {
      shell = null;
    }
  }
  const colorMode = readColorMode(form.get("colorMode"));
  const storePath = readStorePath(form.get("path"));
  if (!editable && !parentOrigin && !theme && !shell && !colorMode) return undefined;
  return { editable: editable && parentOrigin !== null, parentOrigin, theme, shell, colorMode, storePath };
}

/**
 * A staff preview token for the store (POST /workspaces/:id/store-preview-token),
 * so the preview page can read a store the public can't see yet — a draft.
 * Null if the API won't give one; the preview of a live store needs none.
 */
async function storePreviewToken(workspaceId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await serverApiFetch(`${serverApiBase()}/workspaces/${workspaceId}/store-preview-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: unknown };
    return typeof body.token === "string" ? body.token : null;
  } catch {
    return null;
  }
}

async function canEditWorkspace(workspaceId: string, accessToken: string): Promise<boolean> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  for (const resource of ["websites", "funnels"]) {
    const res = await serverApiFetch(`${serverApiBase()}/workspaces/${workspaceId}/${resource}`, {
      headers,
      cache: "no-store",
    });
    if (res.ok) return true;
    // An invalid or expired session fails the same way for both.
    if (res.status === 401) return false;
  }
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const invalid = () => notice(400, "طلب معاينة غير صالح.", "Invalid preview request.");
  if (!UUID_RE.test(workspaceId)) return invalid();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return invalid();
  }
  const token = String(form.get("token") ?? "");
  const accessToken = String(form.get("accessToken") ?? "");
  const rawTree = String(form.get("tree") ?? "");
  if (!UUID_RE.test(token) || !accessToken || !rawTree) return invalid();
  if (rawTree.length > MAX_TREE_CHARS) {
    return notice(413, "الصفحة أكبر من إنها تتعرض في المعاينة.", "This page is too large to preview.");
  }

  let tree: PageTree;
  try {
    const parsed: unknown = JSON.parse(rawTree);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as PageTree).sections)) {
      return invalid();
    }
    tree = parsed as PageTree;
  } catch {
    return invalid();
  }

  const owner = previewOwner(token);
  if (owner && owner !== workspaceId) return invalid();

  if (!(await canEditWorkspace(workspaceId, accessToken))) {
    return notice(
      403,
      "مقدرناش نتأكد من الجلسة. حدّث المعاينة من لوحة التحكم.",
      "Your session couldn't be verified. Refresh the preview from the dashboard."
    );
  }

  const options = readOptions(form);
  putPreview(token, workspaceId, tree, options);
  const viewToken = await storePreviewToken(workspaceId, accessToken);
  // The editor showing one of the store's own pages: that page, in the unsaved look (lib/editorView).
  const storePath = options?.parentOrigin && options.storePath ? (options.storePath === "/product" ? await firstProductPath(workspaceId) : options.storePath) : null;
  // 303 so the frame follows with a GET, whatever method brought it here.
  // Relative, not resolved against request.url: behind the host's proxy that
  // is the internal origin (https://localhost:8080), which the browser can't reach.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: storePath ? `/store/${workspaceId}${storePath}?${EDITOR_VIEW_PARAM}=${token}` : `/store/${workspaceId}/preview/${token}` },
  });
  if (viewToken) {
    const secure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https";
    response.cookies.set(STORE_PREVIEW_COOKIE, viewToken, storePreviewCookieOptions(secure));
  }
  return response;
}
