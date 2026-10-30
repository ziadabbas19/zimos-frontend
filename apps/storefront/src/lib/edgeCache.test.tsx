// @vitest-environment node
import { describe, expect, it } from "vitest";
import { COLOR_MODE_COOKIE } from "./colorModeCookie";
import {
  PRIVATE_CACHE_CONTROL,
  edgeCacheControl,
  edgeCacheValue,
  isPublicStorePath,
  keepsEdgeCache,
  storePathOfRewrite,
  type EdgeCacheInput,
} from "./edgeCache";
import { LOCALE_COOKIE } from "./i18n";
import { STORE_PREVIEW_COOKIE } from "./storePreview";

const PUBLIC = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

const page = (path: string, over: Partial<EdgeCacheInput> = {}) =>
  edgeCacheControl(
    {
      enabled: true,
      method: "GET",
      rewrite: `http://shop.zimos.co/store/shop${path === "/" ? "" : path}`,
      status: 200,
      redirected: false,
      setsCookie: false,
      cookieNames: [],
      headerNames: ["host", "accept", "user-agent", "x-forwarded-host", "x-real-ip"],
      paramNames: [],
      ...over,
    },
    {},
  );

describe("edgeCacheValue", () => {
  it("is public for a minute, stale for five, by default; never kept by the browser", () => {
    expect(edgeCacheValue({})).toBe(PUBLIC);
  });

  it("takes its numbers from the environment, and falls back on anything that is not whole seconds up to a day", () => {
    expect(edgeCacheValue({ STOREFRONT_EDGE_CACHE_S_MAXAGE: "120", STOREFRONT_EDGE_CACHE_SWR: "600" })).toBe(
      "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
    );
    expect(edgeCacheValue({ STOREFRONT_EDGE_CACHE_SWR: "0" })).toBe("public, max-age=0, s-maxage=60");
    for (const bad of ["0", "-5", "1.5", "abc", "", "86401"]) {
      expect(edgeCacheValue({ STOREFRONT_EDGE_CACHE_S_MAXAGE: bad })).toBe(PUBLIC);
    }
  });
});

describe("isPublicStorePath", () => {
  it("knows the public routes and the merchant's own pages", () => {
    for (const path of ["/", "/products", "/products/shirt", "/policies/refund", "/learn", "/learn/a", "/looks/summer", "/blog", "/blog/post", "/store-reviews", "/about", "/help/shipping"]) {
      expect(isPublicStorePath(path), path).toBe(true);
    }
  });

  it("never the pages with a shopper, an order or a preview in them, however they are spelled", () => {
    for (const path of ["/cart", "/checkout", "/pay/o1", "/account", "/account/orders/o1", "/orders/o1", "/track", "/offer/o1", "/downloads/t", "/f/ref", "/f/ref/s1", "/r/t", "/preview/t", "/unsubscribe", "/gift-card", "/compare", "/%63art", "/Cart", "/CHECKOUT/x", "/products/a/b", "/policies", "/%E0%A4%A"]) {
      expect(isPublicStorePath(path), path).toBe(false);
    }
  });
});

describe("storePathOfRewrite", () => {
  it("reads the store-relative path from the proxy's rewrite", () => {
    expect(storePathOfRewrite("http://shop.zimos.co/store/shop")).toBe("/");
    expect(storePathOfRewrite("http://shop.zimos.co/store/shop/products/x?a=1")).toBe("/products/x");
    expect(storePathOfRewrite("http://shop.zimos.co/products/x")).toBeNull();
    expect(storePathOfRewrite(null)).toBeNull();
  });
});

describe("edgeCacheControl", () => {
  it("is off unless switched on", () => {
    expect(page("/", { enabled: false })).toBeNull();
  });

  it("marks an anonymous GET or HEAD of a public page", () => {
    expect(page("/")).toBe(PUBLIC);
    expect(page("/products/shirt")).toBe(PUBLIC);
    expect(page("/about")).toBe(PUBLIC);
    expect(page("/", { method: "HEAD" })).toBe(PUBLIC);
  });

  it("only marks what the proxy rewrote to a store: never a pass-through or another target", () => {
    expect(page("/", { rewrite: null })).toBeNull();
    expect(page("/", { rewrite: "http://shop.zimos.co/products/x" })).toBeNull();
  });

  it("never a POST, a redirect, a non-200 or a response that sets a cookie", () => {
    expect(page("/", { method: "POST" })).toBeNull();
    expect(page("/", { status: 307, redirected: true })).toBeNull();
    expect(page("/", { status: 404 })).toBeNull();
    expect(page("/", { setsCookie: true })).toBeNull();
  });

  it("never for a visitor carrying one of our cookies that change the page, or one we add later", () => {
    for (const cookie of [LOCALE_COOKIE, COLOR_MODE_COOKIE, STORE_PREVIEW_COOKIE, "zimos_session"]) {
      expect(page("/", { cookieNames: ["_ga", cookie] }), cookie).toBeNull();
    }
    // Read only by scripts in the browser (lib/touches, the ad pixels): the page is the same.
    expect(page("/", { cookieNames: ["zimos_touch", "_fbp", "_ga"] })).toBe(PUBLIC);
  });

  it("never for a preview or editor link", () => {
    for (const param of ["storePreview", "paymentsPreview", "zimos-view"]) {
      expect(page("/", { paramNames: ["utm_source", param] }), param).toBeNull();
    }
    expect(page("/", { paramNames: ["utm_source", "collection"] })).toBe(PUBLIC);
  });

  it("never for a request through the Worker, nor one carrying a header only the proxy sets", () => {
    for (const header of ["x-zimos-edge", "x-zimos-host", "x-store-slug", "x-store-ref", "x-zimos-store-preview", "x-zimos-view"]) {
      expect(page("/", { headerNames: ["host", header] }), header).toBeNull();
    }
  });
});

describe("keepsEdgeCache (on the way out)", () => {
  const out = (over: Partial<Parameters<typeof keepsEdgeCache>[0]> = {}) =>
    keepsEdgeCache({
      status: 200,
      contentType: "text/html; charset=utf-8",
      setsCookie: false,
      requestHeaderNames: ["host", "accept"],
      requestUrl: "/store/shop",
      ...over,
    });

  it("keeps a plain 200 HTML page", () => {
    expect(out()).toBe(true);
  });

  it("takes the mark back from a redirect, an error, a cookie, a non-HTML answer and the app's navigations", () => {
    expect(out({ status: 307 })).toBe(false);
    expect(out({ status: 308 })).toBe(false);
    expect(out({ status: 404 })).toBe(false);
    expect(out({ status: 500 })).toBe(false);
    expect(out({ setsCookie: true })).toBe(false);
    expect(out({ contentType: "text/x-component" })).toBe(false);
    expect(out({ contentType: null })).toBe(false);
    expect(out({ requestHeaderNames: ["host", "rsc"] })).toBe(false);
    expect(out({ requestHeaderNames: ["host", "next-router-prefetch"] })).toBe(false);
    expect(out({ requestUrl: "/store/shop?_rsc=abc12" })).toBe(false);
  });

  it("puts back exactly Next's own header for a page rendered per request", () => {
    expect(PRIVATE_CACHE_CONTROL).toBe("private, no-cache, no-store, max-age=0, must-revalidate");
  });
});
