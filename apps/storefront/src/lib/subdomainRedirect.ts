import { NextResponse, type NextRequest } from "next/server";
import { primaryHostForPlatformHost } from "./customDomains";
import { ROOT_DOMAIN, hostnameOf, isRootDomainHost, storeSlugFromHost } from "./domains";
import { EDITOR_VIEW_PARAM } from "./editorView";
import { PAYMENTS_PREVIEW_PARAM, STORE_PREVIEW_COOKIE, STORE_PREVIEW_PARAM } from "./storePreview";

/**
 * A store's platform subdomain (`naree.zimos.co`) sends a page load on to the
 * store's own domain (`www.elmamoun.store`) once that domain is connected:
 * the store's primary domain, verified, with its certificate issued and not
 * suspended — what GET /store/resolve-host answers as `primaryHost` for a
 * platform subdomain (the API's domains/primaryHost.js). A domain still
 * pending, failed, without a certificate or removed answers none, and the
 * store opens on its subdomain as before.
 *
 * Off unless STORE_SUBDOMAIN_REDIRECT_ENABLED is exactly "true". The proxy
 * asks only with merchant domains on (CUSTOM_DOMAINS_ENABLED): off, this app
 * could not serve the domain it would send the shopper to.
 *
 * Temporary (307), same path and query: the merchant may disconnect the
 * domain later, and a browser keeps a permanent redirect for good. Sent with
 * `Cache-Control: no-store`, so neither Cloudflare nor the browser keeps it:
 * once the API's answer changes (remembered here for a minute,
 * lib/customDomains), the next page load follows it.
 *
 * Stays on the subdomain: anything but a page load (assets, route handlers,
 * the app's own fetches, form posts), payment pages, the staff previews (the
 * editor's and funnels' frames, preview links and cookie), and a store opened
 * from the dashboard or the console.
 */

const LOOKUP_TIMEOUT_MS = 1500;

/** The dashboard and the console: a store opened from either stays on its subdomain. */
const PLATFORM_APP_HOSTS = new Set(["app", "admin", "console"].map((label) => `${label}.${ROOT_DOMAIN}`));

const HOST_SHAPE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Paths served on the subdomain whatever the store's domain. */
function keepsPath(pathname: string): boolean {
  return (
    // A payment gateway returns the shopper to the host it was given.
    /^\/pay(\/|$)/.test(pathname) ||
    // The internal shape (the previews' posts, deep links from before
    // subdomains) and the editor's preview page.
    /^\/(store|preview)(\/|$)/.test(pathname) ||
    /^\/(_next|api|webhooks?|\.well-known)(\/|$)/.test(pathname) ||
    // Anything that names a file: `/logo.png`, `/robots.txt`, `/manifest.webmanifest`.
    /\.[^./]+$/.test(pathname)
  );
}

/**
 * A top-level page load: GET or HEAD, and, from a browser, a document opened
 * in the tab itself — not a frame (the dashboard's previews) nor a script's
 * fetch (the app router's own navigations, whose RSC headers Next takes off
 * before the proxy). A client that sends no fetch metadata (a crawler) counts.
 */
function isPageLoad(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const headers = request.headers;
  const dest = headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return false;
  const mode = headers.get("sec-fetch-mode");
  if (mode && mode !== "navigate") return false;
  return (
    !headers.has("rsc") &&
    !headers.has("next-router-prefetch") &&
    !headers.has("next-url") &&
    !headers.has("x-nextjs-data") &&
    !request.nextUrl.searchParams.has("_rsc")
  );
}

/** A staff preview (lib/storePreview) or the editor's view (lib/editorView), by link or by this browser's cookie. */
function isPreview(request: NextRequest): boolean {
  const params = request.nextUrl.searchParams;
  return (
    params.has(STORE_PREVIEW_PARAM) ||
    params.has(PAYMENTS_PREVIEW_PARAM) ||
    params.has(EDITOR_VIEW_PARAM) ||
    request.cookies.has(STORE_PREVIEW_COOKIE)
  );
}

/**
 * Opened from the dashboard or the console. Their store links send no
 * Referer (rel="noreferrer"), so a navigation from another zimos.co host
 * without one counts too; one that says where it came from counts only when
 * that is the dashboard or the console.
 */
function fromPlatformApp(headers: Headers): boolean {
  const referer = headers.get("referer");
  if (referer) {
    try {
      return PLATFORM_APP_HOSTS.has(new URL(referer).hostname.toLowerCase());
    } catch {
      return false;
    }
  }
  return headers.get("sec-fetch-site") === "same-site";
}

/** The store's connected domain, or null; null too on an error or after LOOKUP_TIMEOUT_MS. */
async function primaryWithin(hostname: string): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      primaryHostForPlatformHost(hostname),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The redirect to the store's connected domain, or null to serve the request here. */
export async function subdomainRedirect(request: NextRequest, host: string | null): Promise<NextResponse | null> {
  if (process.env.STORE_SUBDOMAIN_REDIRECT_ENABLED !== "true") return null;
  const hostname = hostnameOf(host);
  // Only a store's platform subdomain: a merchant domain, the one sent to included, never moves here.
  if (!isRootDomainHost(hostname) || !storeSlugFromHost(hostname)) return null;
  if (!isPageLoad(request) || keepsPath(request.nextUrl.pathname) || isPreview(request) || fromPlatformApp(request.headers)) {
    return null;
  }

  const primary = await primaryWithin(hostname);
  // Never onto one of the platform's own hosts, this one included: no loop.
  if (!primary || !HOST_SHAPE.test(primary) || isRootDomainHost(primary)) return null;

  // Set on a URL with the host fixed, so a path like `//elsewhere.com` stays a path.
  const target = new URL(`https://${primary}`);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
