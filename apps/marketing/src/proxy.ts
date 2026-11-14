import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

/**
 * Every route lives under `/[locale]/…`. This redirects locale-less requests
 * (`/`, `/pricing`, deep links from elsewhere) to the Arabic page: Arabic is
 * the site's language, whatever language the visitor's browser asks for
 * (the owner, 2026-11-14). English is one click away — the language switch
 * in the header and the footer — and its addresses (`/en/…`) are served as
 * they are, so a visitor who chose English stays in English.
 */

/**
 * Paths that are served as they are: Next's own internals, the route handlers,
 * the metadata files, and anything that names a file.
 *
 * These exclusions live in code rather than in a `config.matcher` so that they
 * read as the plain conditions they are, and stay in step with the storefront's
 * proxy. A matcher is compiled as a path pattern rather than as the regular
 * expression it resembles, so its escaping rules are its own; keeping the list
 * here means a mistake in it shows up as ordinary code, not as a proxy that
 * quietly stops running.
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPassThrough(pathname)) return NextResponse.next();

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}
