import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Storefronts are reached two ways:
 *
 *   • the canonical `store.zimos.co/store/<workspaceId>` path — used in local
 *     dev and for direct links — which is served untouched, and
 *   • a merchant's vanity host `<slug>.zimos.co`, where the slug stands in for
 *     the workspace id.
 *
 * This rewrites the vanity host onto the real `/store/<slug>` route *internally*
 * (a rewrite, not a redirect — contrast with marketing's `proxy.ts`), so the
 * merchant's own domain stays in the address bar.
 */

const ROOT_DOMAIN = "zimos.co";
const STOREFRONT_HOST = `store.${ROOT_DOMAIN}`;

/** Dotted-quad IPv4, e.g. `127.0.0.1`. */
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Someone opened the store by its raw id (local testing, canonical deep
  // links) — pass through with no changes.
  if (pathname.startsWith("/store/")) return NextResponse.next();

  // Strip the port; keep IPv6 literals (`[::1]:8080` -> `[::1]`) detectable.
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();

  const isLocalhost = host === "localhost" || host.endsWith(".localhost");
  const isIp = IPV4.test(host) || host.startsWith("[") || host.includes(":");
  if (!host || isLocalhost || isIp || host === STOREFRONT_HOST) {
    return NextResponse.next();
  }

  // `<slug>.zimos.co`: ends with `.zimos.co`, isn't `store.zimos.co` (handled
  // above), and has no further dot in the part before `.zimos.co`.
  const suffix = `.${ROOT_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    if (slug && !slug.includes(".")) {
      const url = request.nextUrl.clone();
      url.pathname = `/store/${slug}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, the favicon, and anything with a file extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
