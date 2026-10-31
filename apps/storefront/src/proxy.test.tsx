// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function request(host: string, path = "/") {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");
const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("proxy with merchant domains off (the default)", () => {
  it("routes a store subdomain, a platform host and an unknown host as before, with no lookup", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const store = await proxy(request("shop.zimos.co", "/products/x"));
    expect(new URL(rewriteOf(store)!).pathname).toBe("/store/shop/products/x");

    const platform = await proxy(request("zimos.co"));
    expect(platform.status).toBe(307);
    expect(platform.headers.get("location")).toBe("https://zimos.co/");

    const unknown = await proxy(request("shop.example.com"));
    expect(isNext(unknown)).toBe(true);
    expect(rewriteOf(unknown)).toBeNull();

    // Off means off: the store files are left to the app as before.
    const robots = await proxy(request("shop.example.com", "/robots.txt"));
    expect(isNext(robots)).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes the editor's view token from the address, never from a header a visitor sends", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const token = "5a11fedd-23bc-48a4-b0bf-a543d90f1b45";
    const viewed = await proxy(request("localhost:3000", `/store/8a890c19-3e54-4ed1-8dca-74e98b638f9b/cart?zimos-view=${token}`));
    expect(viewed.headers.get("x-middleware-request-x-zimos-view")).toBe(token);
    const plain = await proxy(new NextRequest("http://localhost:3000/store/8a890c19-3e54-4ed1-8dca-74e98b638f9b/cart", { headers: { host: "localhost:3000", "x-zimos-view": token } }));
    expect(plain.headers.get("x-middleware-request-x-zimos-view")).toBeNull();
    const junk = await proxy(request("localhost:3000", "/store/8a890c19-3e54-4ed1-8dca-74e98b638f9b/cart?zimos-view=../x"));
    expect(junk.headers.get("x-middleware-request-x-zimos-view")).toBeNull();
  });

  it("stays off for any value but exactly \"true\"", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "1");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(isNext(await proxy(request("other.example.com")))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("proxy with merchant domains on", () => {
  it("falls back to the platform routing when the lookup fails", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await proxy(request("failing.example.com"));
    expect(isNext(res)).toBe(true);
    expect(res.status).toBe(200);
  });

  it("gives up on a lookup after 1.5 seconds and falls back", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const pending = proxy(request("slow.example.com"));
    await vi.advanceTimersByTimeAsync(1500);
    const res = await pending;
    expect(isNext(res)).toBe(true);
  });

  it("never looks up the platform's own hosts", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(new URL(rewriteOf(await proxy(request("shop.zimos.co", "/cart")))!).pathname).toBe("/store/shop/cart");
    expect((await proxy(request("zimos.co"))).status).toBe(307);
    expect((await proxy(request("www.zimos.co"))).status).toBe(307);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("routes a connected merchant domain to its store", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ store: { slug: "shop", homeFunnel: null, primaryHost: null } }), { status: 200 })),
    );
    const res = await proxy(request("mine.example.com", "/products/x"));
    expect(new URL(rewriteOf(res)!).pathname).toBe("/store/shop/products/x");
  });
});

describe("behind the Cloudflare Worker (X-Forwarded-Host + X-Zimos-Edge)", () => {
  const SECRET = "edge-secret-for-tests-0123456789abcdef";
  const ORIGIN = "storefront-production.up.railway.app";
  const resolved = (body: object) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ store: body }), { status: 200 }));
  function viaWorker(visitor: string, path = "/", edge: string | null = SECRET) {
    const headers: Record<string, string> = { host: ORIGIN, "x-forwarded-host": visitor, "x-forwarded-proto": "https" };
    if (edge !== null) headers["x-zimos-edge"] = edge;
    return new NextRequest(`https://${ORIGIN}${path}`, { headers });
  }
  const lookedUp = (fetchSpy: ReturnType<typeof vi.fn>) => new URL(String(fetchSpy.mock.calls[0][0])).searchParams.get("host");

  it("serves the visitor's merchant domain when the secret matches", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const fetchSpy = resolved({ slug: "shop", homeFunnel: null, primaryHost: null });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(viaWorker("www.example.com", "/products/x"));
    expect(lookedUp(fetchSpy)).toBe("www.example.com");
    expect(new URL(rewriteOf(res)!).pathname).toBe("/store/shop/products/x");
  });

  it("ignores X-Forwarded-Host with a wrong, missing or unset secret", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    // One spy for every attempt: lib/customDomains caches a host's answer,
    // so only the first lookup of the origin host reaches fetch.
    const fetchSpy = resolved({ slug: "shop", homeFunnel: null, primaryHost: null });
    vi.stubGlobal("fetch", fetchSpy);
    for (const edge of [`${SECRET}x`, SECRET.slice(0, -1), "", null]) {
      await proxy(viaWorker("www.example.com", "/", edge));
    }
    // No secret configured: never trusted, whatever the request sends.
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", "");
    await proxy(viaWorker("www.example.com", "/", ""));
    const hosts = fetchSpy.mock.calls.map((call) => new URL(String(call[0])).searchParams.get("host"));
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.every((h) => h === ORIGIN)).toBe(true);
  });

  it("never reads X-Forwarded-Host while merchant domains are off", async () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(viaWorker("shop.zimos.co", "/cart"));
    expect(isNext(res)).toBe(true);
    expect(rewriteOf(res)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a redirect keeps the visitor on their own host, never the Railway one", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolved({ slug: "shop", homeFunnel: null, primaryHost: null }));
    const res = await proxy(viaWorker("www.example.com", "/store/shop/products/x?ref=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://www.example.com/products/x?ref=1");
  });

  it("does not pass the secret on to the app", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolved({ slug: "shop", homeFunnel: null, primaryHost: null }));
    const res = await proxy(viaWorker("www.example.com", "/"));
    expect(res.headers.get("x-middleware-request-x-zimos-edge")).toBeNull();
    expect(res.headers.get("x-middleware-override-headers") ?? "").not.toContain("x-zimos-edge");
  });

  it("passes the shopper's IP from the Worker as x-real-ip, only with the secret", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolved({ slug: "shop", homeFunnel: null, primaryHost: null }));
    const proven = viaWorker("www.example.com", "/");
    proven.headers.set("x-zimos-client-ip", "203.0.113.7");
    expect((await proxy(proven)).headers.get("x-middleware-request-x-real-ip")).toBe("203.0.113.7");

    const forged = viaWorker("www.example.com", "/", "wrong");
    forged.headers.set("x-zimos-client-ip", "203.0.113.7");
    expect((await proxy(forged)).headers.get("x-middleware-request-x-real-ip")).not.toBe("203.0.113.7");
  });
});

describe("proxy: CDN caching of public store pages (STOREFRONT_EDGE_CACHE_ENABLED)", () => {
  const PUBLIC = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  const cacheOf = async (req: NextRequest) => (await proxy(req)).headers.get("cache-control");
  const on = () => vi.stubEnv("STOREFRONT_EDGE_CACHE_ENABLED", "true");

  it("leaves every response exactly as before while off (the default), whatever else is set", async () => {
    // The flag's earlier name no longer switches anything on.
    vi.stubEnv("STOREFRONT_EDGE_CACHE", "true");
    vi.stubEnv("STOREFRONT_EDGE_CACHE_ENABLED", "1");
    for (const path of ["/", "/products/x", "/about", "/cart", "/pay/o1"]) {
      const res = await proxy(request("shop.zimos.co", path));
      expect(res.headers.get("cache-control"), path).toBeNull();
    }
    expect(new URL(rewriteOf(await proxy(request("shop.zimos.co", "/")))!).pathname).toBe("/store/shop");
  });

  it("marks an anonymous GET of a public page public, from the environment's numbers", async () => {
    on();
    for (const path of ["/", "/products", "/products/shirt", "/policies/refund", "/about"]) {
      expect(await cacheOf(request("shop.zimos.co", path)), path).toBe(PUBLIC);
    }
    vi.stubEnv("STOREFRONT_EDGE_CACHE_S_MAXAGE", "30");
    vi.stubEnv("STOREFRONT_EDGE_CACHE_SWR", "120");
    expect(await cacheOf(request("shop.zimos.co", "/"))).toBe("public, max-age=0, s-maxage=30, stale-while-revalidate=120");
  });

  it("keeps the same page private for a visitor with a cookie that changes it (language, light/dark, preview)", async () => {
    on();
    for (const cookie of ["zimos_store_locale=en", "zimos_store_color_mode=dark", "zimos_store_preview=5a11fedd-23bc-48a4-b0bf-a543d90f1b45"]) {
      const req = new NextRequest("http://shop.zimos.co/products/x", { headers: { host: "shop.zimos.co", cookie } });
      expect(await cacheOf(req), cookie).toBeNull();
    }
    // Cookies only scripts read leave the page as it is.
    const touched = new NextRequest("http://shop.zimos.co/products/x", { headers: { host: "shop.zimos.co", cookie: "zimos_touch=x; _fbp=y" } });
    expect(await cacheOf(touched)).toBe(PUBLIC);
  });

  it("keeps a response that sets a cookie private (a preview link keeps its token in one)", async () => {
    on();
    const res = await proxy(request("shop.zimos.co", "/?storePreview=staffpreview0001.signature0001"));
    expect(res.headers.get("set-cookie")).toContain("zimos_store_preview=");
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("never marks a redirect", async () => {
    on();
    const internal = await proxy(request("shop.zimos.co", "/store/shop/products/x"));
    expect(internal.status).toBe(307);
    expect(internal.headers.get("cache-control")).toBeNull();
    const platform = await proxy(request("zimos.co"));
    expect(platform.status).toBe(307);
    expect(platform.headers.get("cache-control")).toBeNull();
  });

  it("never marks payment, cart, checkout, account, orders or tracking", async () => {
    on();
    for (const path of ["/pay/o1", "/cart", "/checkout", "/account", "/account/orders/o1", "/orders/o1", "/track", "/offer/o1"]) {
      expect(await cacheOf(request("shop.zimos.co", path)), path).toBeNull();
    }
  });

  it("never marks a preview: the editor's frame, the funnel preview, a preview page", async () => {
    on();
    expect(await cacheOf(request("shop.zimos.co", "/?zimos-view=5a11fedd-23bc-48a4-b0bf-a543d90f1b45"))).toBeNull();
    expect(await cacheOf(request("shop.zimos.co", "/products/x?paymentsPreview=5a11fedd-23bc-48a4-b0bf-a543d90f1b45"))).toBeNull();
    expect(await cacheOf(request("shop.zimos.co", "/preview/5a11fedd-23bc-48a4-b0bf-a543d90f1b45"))).toBeNull();
    expect(await cacheOf(request("shop.zimos.co", "/f/ref"))).toBeNull();
  });

  it("never marks a POST, the internal path served as is, or a host with no store", async () => {
    on();
    expect(await cacheOf(new NextRequest("http://shop.zimos.co/", { method: "POST", headers: { host: "shop.zimos.co" } }))).toBeNull();
    expect(await cacheOf(request("localhost:3000", "/store/shop/products/x"))).toBeNull();
    expect(await cacheOf(request("shop.example.com", "/"))).toBeNull();
  });

  it("never marks a request carrying a header only the proxy sets", async () => {
    on();
    for (const header of ["x-store-slug", "x-store-ref", "x-zimos-store-preview", "x-zimos-view"]) {
      const req = new NextRequest("http://shop.zimos.co/", { headers: { host: "shop.zimos.co", [header]: "other" } });
      expect(await cacheOf(req), header).toBeNull();
    }
  });

  it("never marks a merchant domain reached through the Worker (the CDN would key it on our Railway host)", async () => {
    on();
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", "edge-secret-for-tests-0123456789abcdef");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ store: { slug: "shop", homeFunnel: null, primaryHost: null } }), { status: 200 })));
    const req = new NextRequest("https://storefront-production.up.railway.app/products/x", {
      headers: {
        host: "storefront-production.up.railway.app",
        "x-zimos-host": "www.example.com",
        "x-zimos-edge": "edge-secret-for-tests-0123456789abcdef",
      },
    });
    const res = await proxy(req);
    expect(new URL(rewriteOf(res)!).pathname).toBe("/store/shop/products/x");
    expect(res.headers.get("cache-control")).toBeNull();
  });
});


describe("proxy: merchant domains kept by the Worker (STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS)", () => {
  const PUBLIC = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  const SECRET = "edge-secret-for-tests-0123456789abcdef";
  const ORIGIN = "storefront-production.up.railway.app";
  // GET /store/resolve-host, by host. Hosts of their own: lib/customDomains remembers answers for a minute.
  const STORES: Record<string, object> = {
    "www.kept-a.com": { slug: "kept-a", homeFunnel: null, primaryHost: "www.kept-a.com" },
    "www.kept-b.com": { slug: "kept-b", homeFunnel: null, primaryHost: "www.kept-b.com" },
    "shop.kept-a.com": { slug: "kept-a", homeFunnel: null, primaryHost: "www.kept-a.com" },
    "www.kept-c.com": { slug: "kept-c", homeFunnel: null, primaryHost: null },
    "www.kept-funnel.com": { slug: "kept-funnel", homeFunnel: { ref: "launch" }, primaryHost: "www.kept-funnel.com" },
  };
  const resolver = () =>
    vi.fn(async (url: string) => {
      const store = STORES[new URL(url).searchParams.get("host") ?? ""];
      return store ? new Response(JSON.stringify({ store }), { status: 200 }) : new Response("{}", { status: 404 });
    });
  function viaWorker(host: string, path = "/", { keeps = true, edge = SECRET, cookie = "" }: { keeps?: boolean; edge?: string | null; cookie?: string } = {}) {
    const headers: Record<string, string> = { host: ORIGIN, "x-zimos-host": host, "x-forwarded-host": ORIGIN, "x-forwarded-proto": "https", "x-zimos-client-ip": "203.0.113.7" };
    if (edge !== null) headers["x-zimos-edge"] = edge;
    if (keeps) headers["x-zimos-edge-cache"] = "1";
    if (cookie) headers.cookie = cookie;
    return new NextRequest(`https://${ORIGIN}${path}`, { headers });
  }
  const on = (custom = "true") => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubEnv("STOREFRONT_EDGE_CACHE_ENABLED", "true");
    if (custom !== "") vi.stubEnv("STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS", custom);
    vi.stubGlobal("fetch", resolver());
  };
  const storeOf = (res: Response) => new URL(rewriteOf(res)!).pathname;

  it("flag off (unset, false, anything but \"true\"): every response exactly as before", async () => {
    for (const custom of ["", "false", "1", "TRUE"]) {
      on(custom);
      for (const [host, path] of [["www.kept-a.com", "/"], ["www.kept-a.com", "/products/x"], ["www.kept-b.com", "/about"]]) {
        for (const keeps of [true, false]) {
          const res = await proxy(viaWorker(host, path, { keeps }));
          expect(res.headers.get("cache-control"), `${custom} ${host}${path}`).toBeNull();
          expect(storeOf(res)).toBe(`/store/${host === "www.kept-a.com" ? "kept-a" : "kept-b"}${path === "/" ? "" : path}`);
        }
      }
      // The store's subdomain, as before.
      expect((await proxy(request("kept-a.zimos.co", "/products/x"))).headers.get("cache-control")).toBe(PUBLIC);
      vi.unstubAllEnvs();
    }
  });

  it("marks a public page on the store's primary domain when the Worker keeps it", async () => {
    on();
    for (const path of ["/", "/products", "/products/x", "/policies/refund", "/about"]) {
      const res = await proxy(viaWorker("www.kept-a.com", path));
      expect(res.headers.get("cache-control"), path).toBe(PUBLIC);
      expect(storeOf(res)).toBe(`/store/kept-a${path === "/" ? "" : path}`);
    }
  });

  it("two stores on two domains: each page is its own store's, marked for its own host only", async () => {
    on();
    const a = await proxy(viaWorker("www.kept-a.com", "/products/x"));
    const b = await proxy(viaWorker("www.kept-b.com", "/products/x"));
    expect(storeOf(a)).toBe("/store/kept-a/products/x");
    expect(storeOf(b)).toBe("/store/kept-b/products/x");
    expect(a.headers.get("x-middleware-request-x-store-slug")).toBe("kept-a");
    expect(b.headers.get("x-middleware-request-x-store-slug")).toBe("kept-b");
    expect(a.headers.get("cache-control")).toBe(PUBLIC);
    expect(b.headers.get("cache-control")).toBe(PUBLIC);
  });

  it("never without the Worker's promise to keep it under the visitor's URL (an older Worker, or EDGE_CACHE_ENABLED off)", async () => {
    on();
    const res = await proxy(viaWorker("www.kept-a.com", "/products/x", { keeps: false }));
    expect(storeOf(res)).toBe("/store/kept-a/products/x");
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("never without the Worker's secret, whatever else the request says", async () => {
    on();
    for (const edge of [null, "", "wrong", `${SECRET}x`]) {
      const res = await proxy(viaWorker("www.kept-a.com", "/products/x", { edge }));
      expect(res.headers.get("cache-control"), String(edge)).toBeNull();
    }
  });

  it("never on a host that is not the store's primary domain", async () => {
    on();
    // Another of the store's domains: sent on to the primary one, never marked.
    const other = await proxy(viaWorker("shop.kept-a.com", "/products/x"));
    expect(other.status).toBe(307);
    expect(other.headers.get("location")).toBe("https://www.kept-a.com/products/x");
    expect(other.headers.get("cache-control")).toBeNull();
    // A store with no primary domain (or one set not to redirect): served, not kept.
    const served = await proxy(viaWorker("www.kept-c.com", "/products/x"));
    expect(storeOf(served)).toBe("/store/kept-c/products/x");
    expect(served.headers.get("cache-control")).toBeNull();
    // An unknown host: the platform's routing, nothing to keep.
    expect((await proxy(viaWorker("www.unknown-kept.com", "/"))).headers.get("cache-control")).toBeNull();
  });

  it("never for a visitor with a cookie that changes the page; zimos_touch leaves it the same", async () => {
    on();
    for (const cookie of ["zimos_store_locale=en", "zimos_store_color_mode=dark", "zimos_store_preview=5a11fedd-23bc-48a4-b0bf-a543d90f1b45"]) {
      expect((await proxy(viaWorker("www.kept-a.com", "/products/x", { cookie }))).headers.get("cache-control"), cookie).toBeNull();
    }
    expect((await proxy(viaWorker("www.kept-a.com", "/products/x", { cookie: "zimos_touch=x; _fbp=y" }))).headers.get("cache-control")).toBe(PUBLIC);
  });

  it("never /pay, /cart, checkout, account, orders, tracking or a funnel", async () => {
    on();
    for (const path of ["/pay/o1", "/pay", "/cart", "/checkout", "/account", "/account/orders/o1", "/orders/o1", "/track", "/offer/o1", "/f/ref"]) {
      const res = await proxy(viaWorker("www.kept-a.com", path));
      expect(storeOf(res), path).toBe(`/store/kept-a${path}`);
      expect(res.headers.get("cache-control"), path).toBeNull();
    }
    // The domain's home funnel opens on its root: a funnel, never kept.
    const home = await proxy(viaWorker("www.kept-funnel.com", "/"));
    expect(storeOf(home)).toBe("/store/kept-funnel/f/launch");
    expect(home.headers.get("cache-control")).toBeNull();
  });

  it("never another store's page reached by its internal path on this store's domain", async () => {
    on();
    const res = await proxy(viaWorker("www.kept-a.com", "/store/kept-b/products/x"));
    expect(isNext(res)).toBe(true);
    expect(rewriteOf(res)).toBeNull();
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("never a preview link (its token goes in a cookie), a POST or the internal path", async () => {
    on();
    const preview = await proxy(viaWorker("www.kept-a.com", "/?storePreview=staffpreview0001.signature0001"));
    expect(preview.headers.get("cache-control")).toBeNull();
    const post = new NextRequest(`https://${ORIGIN}/products/x`, { method: "POST", headers: Object.fromEntries(viaWorker("www.kept-a.com").headers) });
    expect((await proxy(post)).headers.get("cache-control")).toBeNull();
    const internal = await proxy(viaWorker("www.kept-a.com", "/store/kept-a/products/x"));
    expect(internal.status).toBe(307);
    expect(internal.headers.get("cache-control")).toBeNull();
  });

  it("never with STOREFRONT_EDGE_CACHE_ENABLED off, whatever the new flag says", async () => {
    on();
    vi.stubEnv("STOREFRONT_EDGE_CACHE_ENABLED", "false");
    expect((await proxy(viaWorker("www.kept-a.com", "/products/x"))).headers.get("cache-control")).toBeNull();
  });

  it("the Worker's promise never reaches the app, and a store's subdomain carrying it is not marked", async () => {
    on();
    const res = await proxy(viaWorker("www.kept-a.com", "/"));
    expect(res.headers.get("x-middleware-request-x-zimos-edge-cache")).toBeNull();
    expect(res.headers.get("x-middleware-override-headers") ?? "").not.toContain("x-zimos-edge-cache");
    const forged = new NextRequest("http://kept-a.zimos.co/", { headers: { host: "kept-a.zimos.co", "x-zimos-edge-cache": "1" } });
    expect((await proxy(forged)).headers.get("cache-control")).toBeNull();
  });
});
