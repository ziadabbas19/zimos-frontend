import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  MARKETING_URL,
  STORE_SLUG_HEADER,
  hostnameOf,
  isRootDomainHost,
  storeSlugFromHost,
} from "@/lib/domains";
import {
  PAYMENTS_PREVIEW_PARAM,
  STORE_PREVIEW_COOKIE,
  STORE_PREVIEW_HEADER,
  STORE_PREVIEW_PARAM,
  isTokenShaped,
  storePreviewCookieOptions,
} from "@/lib/storePreview";
import { resolveCustomHost, type ResolvedHost } from "@/lib/customDomains";
import { STORE_REF_HEADER } from "@/lib/documentLocale";
import { EDITOR_VIEW_HEADER, EDITOR_VIEW_PARAM, isViewToken } from "@/lib/editorView";
import { EDGE_CLIENT_IP_HEADER, EDGE_HOST_HEADER, EDGE_SECRET_HEADER, visitorHost, type VisitorHost } from "@/lib/edgeHost";
import { withEdgeCache } from "@/lib/edgeCache";

/**
 * Merchant-owned domains (`shop.example.com`) are off unless the server's
 * CUSTOM_DOMAINS_ENABLED is exactly "true". Off, the routing below runs as it
 * always has and nothing of the custom-domain path executes — no lookup, no
 * store metadata rewrite. On, a lookup that fails or takes longer than
 * RESOLVE_TIMEOUT_MS falls back to that same routing, so a host is never
 * answered with an error because the API was slow or down.
 *
 * On, a merchant domain arrives through the Cloudflare Worker with the
 * visitor's host in X-Zimos-Host (X-Forwarded-Host from an older Worker),
 * trusted only with the Worker's secret (lib/edgeHost). Off, neither header is
 * read.
 */
export async function proxy(request: NextRequest) {
  return withEdgeCache(request, await route(request));
}

async function route(request: NextRequest) {
  if (process.env.CUSTOM_DOMAINS_ENABLED !== "true") return platformProxy(request);
  const visitor = visitorHost(request.headers);
  try {
    return await customDomainProxy(request, visitor);
  } catch {
    return platformProxy(request, visitor);
  }
}

/** The website editor's view token (lib/editorView): from the address, never from a header a visitor sent. */
function passEditorView(headers: Headers, request: NextRequest) {
  headers.delete(EDITOR_VIEW_HEADER);
  const token = request.nextUrl.searchParams.get(EDITOR_VIEW_PARAM);
  if (isViewToken(token)) headers.set(EDITOR_VIEW_HEADER, token);
}

/**
 * The Worker's own headers never reach the app; behind it, the shopper's IP
 * it sent replaces x-real-ip (Cloudflare's address there).
 */
function passEdgeHeaders(headers: Headers, visitor: VisitorHost) {
  headers.delete(EDGE_SECRET_HEADER);
  headers.delete(EDGE_HOST_HEADER);
  headers.delete(EDGE_CLIENT_IP_HEADER);
  if (visitor.forwarded && visitor.clientIp) headers.set("x-real-ip", visitor.clientIp);
}

/**
 * A redirect target on the visitor's own host. Behind the Worker,
 * request.nextUrl carries our Railway host, which the visitor must never be
 * sent to; the Worker serves https only.
 */
function publicUrl(request: NextRequest, visitor: VisitorHost) {
  const url = request.nextUrl.clone();
  if (visitor.forwarded && visitor.host) {
    url.protocol = "https:";
    url.host = visitor.host;
  }
  return url;
}

const RESOLVE_TIMEOUT_MS = 1500;

/**
 * Which store a merchant domain belongs to, or null. The platform's own hosts
 * (`zimos.co`, `*.zimos.co`) are never looked up; an error or a lookup slower
 * than RESOLVE_TIMEOUT_MS is null too.
 */
async function resolveWithin(host: string | null): Promise<ResolvedHost | null> {
  if (isRootDomainHost(host)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolveCustomHost(host),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Paths that are served as they are, whatever the host: Next's own internals,
 * the route handlers, the metadata files, and anything that names a file.
 *
 * This is a check in code rather than a `config.matcher` because a matcher is
 * compiled as a path pattern, not as the plain regular expression it looks
 * like, and the difference is silent — the proxy simply stops running on most
 * of the paths it was meant to cover.
 */
function isPassThrough(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    // A file extension on the last segment: `/logo.png`, `/fonts/x.woff2`.
    /\.[^./]+$/.test(pathname)
  );
}

/**
 * Turns the host into the route.
 *
 * A shopper only ever sees `<slug>.zimos.co/products/xyz`, while the app's
 * routes live under `/store/<workspaceId>/products/xyz`. This maps one onto the
 * other with an internal rewrite — not a redirect, unlike marketing's proxy —
 * so the merchant's own subdomain is what stays in the address bar. The slug
 * goes through as the workspace id because the storefront API accepts either.
 *
 * Three kinds of host reach this app:
 *
 *   • a store — `<slug>.zimos.co`, or `<slug>.localhost:3000` in development;
 *   • the root domain with no store in it (`zimos.co`, `www.zimos.co`,
 *     `store.zimos.co`), which has nothing of its own to show and so goes to
 *     the marketing site;
 *   • anything else — plain `localhost`, an IP, the platform's own health
 *     checks — left alone so development and deploys keep working.
 */
function platformProxy(request: NextRequest, visitor: VisitorHost = { host: request.headers.get("host"), forwarded: false, clientIp: null }) {
  const { pathname } = request.nextUrl;
  if (isPassThrough(pathname)) return NextResponse.next();

  // A staff preview token (lib/storePreview): from the link that opened the
  // store, else from this browser's cookie. Server components send it to the
  // API as X-Store-Preview; a token that came in the link is kept in the cookie.
  const linked = request.nextUrl.searchParams.get(STORE_PREVIEW_PARAM) ?? request.nextUrl.searchParams.get(PAYMENTS_PREVIEW_PARAM);
  const fromLink = isTokenShaped(linked) ? linked : null;
  const stored = request.cookies.get(STORE_PREVIEW_COOKIE)?.value;
  const preview = fromLink ?? (isTokenShaped(stored) ? stored : null);
  const headers = new Headers(request.headers);
  headers.delete(STORE_PREVIEW_HEADER);
  passEdgeHeaders(headers, visitor);
  passEditorView(headers, request);
  if (preview) headers.set(STORE_PREVIEW_HEADER, preview);
  const secure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https";
  const keep = (response: NextResponse) => {
    if (fromLink) response.cookies.set(STORE_PREVIEW_COOKIE, fromLink, storePreviewCookieOptions(secure));
    return response;
  };
  const next = () => keep(NextResponse.next({ request: { headers } }));

  const host = visitor.host;
  const slug = storeSlugFromHost(host);

  // The internal shape, reached directly: deep links that predate subdomains,
  // the dashboard's preview route, and local development.
  const isInternalPath = pathname === "/store" || pathname.startsWith("/store/");

  if (slug) {
    if (isInternalPath) {
      // The store's own subdomain asked for the internal path. Serving it would
      // leave `/store/<slug>` in the address bar of a store that has a domain
      // of its own, so send the shopper to the same page's public URL instead.
      const prefix = `/store/${slug}`;
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const url = publicUrl(request, visitor);
        url.pathname = pathname.slice(prefix.length) || "/";
        return keep(NextResponse.redirect(url));
      }
      // Another workspace's path on this store's host — not ours to rewrite.
      return next();
    }

    const url = request.nextUrl.clone();
    url.pathname = `/store/${slug}${pathname === "/" ? "" : pathname}`;
    headers.set(STORE_SLUG_HEADER, slug);
    return keep(NextResponse.rewrite(url, { request: { headers } }));
  }

  if (isInternalPath) return next();

  // No store in the host, and this app has no front page of its own to show.
  // Temporary, not permanent: a browser caches a permanent redirect for the
  // life of the profile, which would outlive any change of mind here.
  if (isRootDomainHost(host)) return NextResponse.redirect(MARKETING_URL, 307);

  return next();
}

/** Metadata files every store answers for itself, from its own settings. */
const STORE_FILES = new Set(["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);

/**
 * The routing with merchant domains switched on: platformProxy's, plus a
 * fourth kind of host — a merchant's own domain connected to a store
 * (lib/customDomains asks the API which store). Its root can open a funnel
 * instead of the store home (the domain's "home funnel"), and a visit on a
 * non-primary merchant domain moves to the store's primary one.
 */
async function customDomainProxy(request: NextRequest, visitor: VisitorHost) {
  const { pathname } = request.nextUrl;
  const host = visitor.host;
  const platformSlug = storeSlugFromHost(host);

  // On a store's own host these are the store's (app/store/[workspaceId]/…).
  if (STORE_FILES.has(pathname)) {
    const slug = platformSlug ?? (await resolveWithin(host))?.slug;
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/store/${slug}${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }
  // Assets and route handlers never cost a lookup.
  if (isPassThrough(pathname)) return NextResponse.next();
  const custom = platformSlug ? null : await resolveWithin(host);
  // Not a merchant domain: exactly the platform's routing.
  if (!custom) return platformProxy(request, visitor);

  // A merchant domain. Same preview handling as platformProxy.
  const linked = request.nextUrl.searchParams.get(STORE_PREVIEW_PARAM) ?? request.nextUrl.searchParams.get(PAYMENTS_PREVIEW_PARAM);
  const fromLink = isTokenShaped(linked) ? linked : null;
  const stored = request.cookies.get(STORE_PREVIEW_COOKIE)?.value;
  const preview = fromLink ?? (isTokenShaped(stored) ? stored : null);
  const headers = new Headers(request.headers);
  headers.delete(STORE_PREVIEW_HEADER);
  headers.delete(STORE_REF_HEADER);
  passEdgeHeaders(headers, visitor);
  passEditorView(headers, request);
  if (preview) headers.set(STORE_PREVIEW_HEADER, preview);
  const secure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https";
  const keep = (response: NextResponse) => {
    if (fromLink) response.cookies.set(STORE_PREVIEW_COOKIE, fromLink, storePreviewCookieOptions(secure));
    return response;
  };

  const isInternalPath = pathname === "/store" || pathname.startsWith("/store/");
  if (isInternalPath) {
    const prefix = `/store/${custom.slug}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const url = publicUrl(request, visitor);
      url.pathname = pathname.slice(prefix.length) || "/";
      return keep(NextResponse.redirect(url));
    }
    return keep(NextResponse.next({ request: { headers } }));
  }

  // The store's primary domain is its one address: a page load on another of
  // its domains moves there, same path and query. Not for a staff preview or a
  // payment page (a gateway may return to the host it was given). Temporary
  // (307): the merchant may change or remove the primary domain later.
  const method = request.method.toUpperCase();
  if (!preview && (method === "GET" || method === "HEAD") && !/^\/pay(\/|$)/.test(pathname)) {
    if (custom.primaryHost && custom.primaryHost !== hostnameOf(host)) {
      return NextResponse.redirect(new URL(`https://${custom.primaryHost}${pathname}${request.nextUrl.search}`), 307);
    }
  }

  const url = request.nextUrl.clone();
  url.pathname =
    pathname === "/" && custom.homeFunnelRef
      ? `/store/${custom.slug}/f/${encodeURIComponent(custom.homeFunnelRef)}`
      : `/store/${custom.slug}${pathname === "/" ? "" : pathname}`;
  headers.set(STORE_SLUG_HEADER, custom.slug);
  headers.set(STORE_REF_HEADER, custom.slug);
  return keep(NextResponse.rewrite(url, { request: { headers } }));
}
