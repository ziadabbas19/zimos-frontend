import { headers } from "next/headers";
import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

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
 * Reading request headers makes the calling route dynamic. The store routes
 * already render per request: `revalidate` alone doesn't cache a dynamic
 * segment that has no generateStaticParams.
 */
export async function createServerStorefrontApiClient() {
  const requestHeaders = await headers();
  console.log("[TEMP DEBUG headers]", JSON.stringify({
    "x-real-ip": requestHeaders.get("x-real-ip"),
    "x-forwarded-for": requestHeaders.get("x-forwarded-for"),
    "cf-connecting-ip": requestHeaders.get("cf-connecting-ip"),
  }));
  const secret = process.env.STOREFRONT_PROXY_SECRET?.trim();
  const defaultHeaders: Record<string, string> = {};
  if (secret) {
    defaultHeaders["X-Storefront-Secret"] = secret;
    const shopperIp = requestHeaders.get("x-real-ip")?.trim();
    if (shopperIp && IP_LIKE.test(shopperIp)) defaultHeaders["X-Storefront-Client-IP"] = shopperIp;
  }
  return new ApiClient({ baseUrl, tokenStorage: createMemoryTokenStorage(), defaultHeaders });
}
