import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

/**
 * Every route lives under `/[locale]/…`. This redirects locale-less requests
 * (`/`, `/pricing`, deep links from elsewhere) to a locale-prefixed URL,
 * preferring the visitor's `Accept-Language` and falling back to Arabic.
 */

function pickLocale(request: NextRequest): string {
  const header = request.headers.get("accept-language");
  if (header) {
    for (const part of header.split(",")) {
      const tag = part.split(";")[0]?.trim().toLowerCase();
      if (!tag) continue;
      const base = tag.split("-")[0];
      const match = locales.find((locale) => locale === base);
      if (match) return match;
    }
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = pickLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, the metadata files, and anything with a file
  // extension (favicon, images, …).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.).*)"],
};
