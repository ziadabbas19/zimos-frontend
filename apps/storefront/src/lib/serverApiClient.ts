import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "./i18n";
import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";
import { serverApiBase, serverApiFetch } from "./serverApiBase";
import { STORE_PREVIEW_HEADER, isTokenShaped } from "./storePreview";

/** Only something shaped like an IP is forwarded; the API validates it again. */
const IP_LIKE = /^[0-9a-f:.]{2,45}$/i;

/**
 * The storefront API client for server components.
 *
 * Their calls all leave from this server, so the API's rate limiter would see
 * every shopper as one client. With STOREFRONT_PROXY_SECRET set (server-only —
 * never give it a NEXT_PUBLIC_ prefix) each call proves it comes from this
 * storefront and names the shopper's IP, so the API limits shoppers one by one.
 *
 * The shopper IP comes from `x-real-ip`, which Railway's edge sets to the
 * connecting address, overwriting anything the client sent. `x-forwarded-for`
 * is not used: its leftmost entry is whatever the browser put there. Behind a
 * proxy that doesn't overwrite `x-real-ip`, shoppers could pick their own
 * rate-limit key (still capped by the API's ceiling for this server).
 *
 * The calls take the API's private address when INTERNAL_API_BASE_URL is set,
 * the public one otherwise (lib/serverApiBase).
 *
 * Reading request headers makes the calling route dynamic. The store routes
 * already render per request: `revalidate` alone doesn't cache a dynamic
 * segment that has no generateStaticParams.
 */
export async function createServerStorefrontApiClient() {
  const requestHeaders = await headers();
  const secret = process.env.STOREFRONT_PROXY_SECRET?.trim();
  const defaultHeaders: Record<string, string> = {};
  if (secret) {
    defaultHeaders["X-Storefront-Secret"] = secret;
    const shopperIp = requestHeaders.get("x-real-ip")?.trim();
    if (shopperIp && IP_LIKE.test(shopperIp)) defaultHeaders["X-Storefront-Client-IP"] = shopperIp;
  }
  // Staff previewing a store the public can't see yet (lib/storePreview): the
  // proxy passes their token on, and the API checks it.
  const preview = requestHeaders.get(STORE_PREVIEW_HEADER);
  if (isTokenShaped(preview)) defaultHeaders["X-Store-Preview"] = preview;
  // The language the shopper chose: the API answers products and collections
  // in it where the store has them translated (the originals otherwise).
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (locale) defaultHeaders["X-Store-Locale"] = locale;
  return new ApiClient({ baseUrl: serverApiBase(), tokenStorage: createMemoryTokenStorage(), defaultHeaders, fetch: serverApiFetch });
}
