// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

/**
 * The redirect from a store's platform subdomain to its connected domain
 * (lib/subdomainRedirect), through the proxy as a request meets it. Each test
 * uses a host of its own: lib/customDomains remembers an answer for a minute.
 */

const OWN_DOMAIN = "www.elmamoun.store";
const TOKEN = "abcdefghijklmnop.qrstuvwxyz0123";
const VIEW_TOKEN = "5a11fedd-23bc-48a4-b0bf-a543d90f1b45";

/** A browser opening a page in its tab, unless `headers` says otherwise. */
function pageLoad(host: string, path = "/", headers: Record<string, string> = {}, method = "GET") {
  return new NextRequest(`https://${host}${path}`, {
    method,
    headers: { host, "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "none", ...headers },
  });
}

/** GET /store/resolve-host answering a store with this primary host. */
function resolving(slug: string, primaryHost: string | null) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ store: { slug, homeFunnel: null, primaryHost } }), { status: 200 }));
}

const lookedUp = (fetchSpy: ReturnType<typeof vi.fn>) => new URL(String(fetchSpy.mock.calls[0][0])).searchParams.get("host");
const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");
const servedAt = (res: Response) => new URL(rewriteOf(res)!).pathname;
/** Served on the host it came to: not sent to the store's own domain (a redirect within the subdomain is the proxy's own). */
const stays = async (req: NextRequest) => expect((await proxy(req)).headers.get("location") ?? "").not.toContain(OWN_DOMAIN);

function switchedOn() {
  vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
  vi.stubEnv("STORE_SUBDOMAIN_REDIRECT_ENABLED", "true");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("subdomain → the store's own domain: off", () => {
  it("is off by default: the store opens on its subdomain, with no lookup", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    const fetchSpy = resolving("off1", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(pageLoad("off1.zimos.co", "/products/x"));
    expect(res.status).toBe(200);
    expect(servedAt(res)).toBe("/store/off1/products/x");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stays off for any value but exactly \"true\"", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("STORE_SUBDOMAIN_REDIRECT_ENABLED", "1");
    const fetchSpy = resolving("off2", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    expect(servedAt(await proxy(pageLoad("off2.zimos.co")))).toBe("/store/off2");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never runs while merchant domains are off: the domain could not be served", async () => {
    vi.stubEnv("STORE_SUBDOMAIN_REDIRECT_ENABLED", "true");
    const fetchSpy = resolving("off3", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    expect(servedAt(await proxy(pageLoad("off3.zimos.co")))).toBe("/store/off3");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("subdomain → the store's own domain: on", () => {
  it("sends a page load to the connected domain: 307, same path and query, never cached", async () => {
    switchedOn();
    const fetchSpy = resolving("naree", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(pageLoad("naree.zimos.co", "/products/%D9%82%D9%85%D9%8A%D8%B5?color=red&size=m&utm_source=ig"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`https://${OWN_DOMAIN}/products/%D9%82%D9%85%D9%8A%D8%B5?color=red&size=m&utm_source=ig`);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(lookedUp(fetchSpy)).toBe("naree.zimos.co");

    // The home page and a HEAD too.
    expect((await proxy(pageLoad("naree.zimos.co", "/"))).headers.get("location")).toBe(`https://${OWN_DOMAIN}/`);
    expect((await proxy(pageLoad("naree.zimos.co", "/cart", {}, "HEAD"))).status).toBe(307);
    // One lookup, remembered.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps no-store with the CDN cache on (STOREFRONT_EDGE_CACHE)", async () => {
    switchedOn();
    vi.stubEnv("STOREFRONT_EDGE_CACHE", "true");
    vi.stubGlobal("fetch", resolving("cached", OWN_DOMAIN));
    const res = await proxy(pageLoad("cached.zimos.co", "/products"));
    expect(res.status).toBe(307);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves a store without a domain on its subdomain", async () => {
    switchedOn();
    const fetchSpy = resolving("nodomain", null);
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(pageLoad("nodomain.zimos.co", "/products/x"));
    expect(res.status).toBe(200);
    expect(servedAt(res)).toBe("/store/nodomain/products/x");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("serves the subdomain while the domain is pending, failed or without a certificate (the API names no primary host)", async () => {
    switchedOn();
    // primaryHost.js answers a primary domain only once it is verified, has its
    // certificate and is not suspended; before that, none.
    vi.stubGlobal("fetch", resolving("pending", null));
    expect(servedAt(await proxy(pageLoad("pending.zimos.co", "/")))).toBe("/store/pending");
  });

  it("serves the subdomain when the lookup fails, or takes longer than 1.5 seconds", async () => {
    switchedOn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(servedAt(await proxy(pageLoad("apidown.zimos.co")))).toBe("/store/apidown");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    expect(servedAt(await proxy(pageLoad("unknown.zimos.co")))).toBe("/store/unknown");

    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const pending = proxy(pageLoad("slowapi.zimos.co"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(servedAt(await pending)).toBe("/store/slowapi");
  });

  it("keeps payment pages on the subdomain: a gateway returns to the host it was given", async () => {
    switchedOn();
    const fetchSpy = resolving("paying", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    expect(servedAt(await proxy(pageLoad("paying.zimos.co", "/pay")))).toBe("/store/paying/pay");
    expect(servedAt(await proxy(pageLoad("paying.zimos.co", "/pay/8a890c19-3e54-4ed1-8dca-74e98b638f9b?status=paid")))).toBe(
      "/store/paying/pay/8a890c19-3e54-4ed1-8dca-74e98b638f9b",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    // `/payments` is not a payment page.
    expect((await proxy(pageLoad("paying.zimos.co", "/payments"))).status).toBe(307);
  });

  it("keeps every preview on the subdomain: the editor's and funnels' frames, preview links and cookie", async () => {
    switchedOn();
    const fetchSpy = resolving("previewed", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    const host = "previewed.zimos.co";

    // A frame: the website editor and the funnel editor show the store in one.
    await stays(pageLoad(host, "/products", { "sec-fetch-dest": "iframe" }));
    await stays(pageLoad(host, "/f/summer", { "sec-fetch-dest": "iframe" }));
    // The editor's post into the frame and the page it is sent to.
    await stays(pageLoad(host, "/store/previewed/preview", { "sec-fetch-dest": "iframe" }, "POST"));
    await stays(pageLoad(host, `/preview/${VIEW_TOKEN}`));
    await stays(pageLoad(host, `/cart?zimos-view=${VIEW_TOKEN}`));
    // Staff preview links (a draft store, the payments page's test checkout), and the cookie they leave.
    await stays(pageLoad(host, `/?storePreview=${TOKEN}`));
    await stays(pageLoad(host, `/?paymentsPreview=${TOKEN}`));
    await stays(pageLoad(host, "/products", { cookie: `zimos_store_preview=${TOKEN}` }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a store opened from the dashboard or the console on its subdomain", async () => {
    switchedOn();
    const fetchSpy = resolving("fromstaff", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    const host = "fromstaff.zimos.co";
    // Their links send no Referer (rel="noreferrer"): another zimos.co host says so in Sec-Fetch-Site.
    expect((await proxy(pageLoad(host, "/", { "sec-fetch-site": "same-site" }))).status).toBe(200);
    expect((await proxy(pageLoad(host, "/", { "sec-fetch-site": "same-site", referer: "https://app.zimos.co/settings" }))).status).toBe(200);
    expect((await proxy(pageLoad(host, "/", { "sec-fetch-site": "same-site", referer: "https://console.zimos.co/stores" }))).status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Any other site, the marketing site included, is a shopper's visit.
    expect((await proxy(pageLoad(host, "/", { "sec-fetch-site": "cross-site", referer: "https://www.google.com/" }))).status).toBe(307);
    expect((await proxy(pageLoad(host, "/", { "sec-fetch-site": "same-site", referer: "https://zimos.co/" }))).status).toBe(307);
    // A link inside the store itself.
    expect((await proxy(pageLoad(host, "/cart", { "sec-fetch-site": "same-origin", referer: `https://${host}/` }))).status).toBe(307);
  });

  it("moves only page loads: assets, route handlers, the app's own fetches and form posts stay", async () => {
    switchedOn();
    const fetchSpy = resolving("assets", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    const host = "assets.zimos.co";

    await stays(pageLoad(host, "/_next/static/chunks/app.js"));
    await stays(pageLoad(host, "/api/health"));
    await stays(pageLoad(host, "/webhooks/paymob"));
    await stays(pageLoad(host, "/logo.png"));
    await stays(pageLoad(host, "/robots.txt"));
    await stays(pageLoad(host, "/sitemap.xml"));
    // The app router's navigation, a script's fetch.
    await stays(pageLoad(host, "/products", { "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin" }));
    await stays(pageLoad(host, "/products?_rsc=1x2y3", { "sec-fetch-dest": "empty" }));
    // A server action or form post.
    await stays(pageLoad(host, "/checkout", { "sec-fetch-mode": "navigate" }, "POST"));
    expect(fetchSpy).not.toHaveBeenCalled();

    // No fetch metadata at all (a crawler): a page load.
    const crawler = new NextRequest(`https://${host}/products/x`, { headers: { host, "user-agent": "Googlebot" } });
    expect((await proxy(crawler)).status).toBe(307);
  });

  it("never sends a path somewhere else: `//elsewhere.com` stays a path on the store's domain", async () => {
    switchedOn();
    vi.stubGlobal("fetch", resolving("pathy", OWN_DOMAIN));
    const res = await proxy(pageLoad("pathy.zimos.co", "//elsewhere.com/x?y=1"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.host).toBe(OWN_DOMAIN);
    expect(location.search).toBe("?y=1");
  });
});

describe("no loop", () => {
  const SECRET = "edge-secret-for-tests-0123456789abcdef";
  const ORIGIN = "storefront-production.up.railway.app";
  function viaWorker(visitor: string, path = "/") {
    return new NextRequest(`https://${ORIGIN}${path}`, {
      headers: {
        host: ORIGIN,
        "x-zimos-host": visitor,
        "x-zimos-edge": SECRET,
        "x-forwarded-proto": "https",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
      },
    });
  }

  it("serves the store on its own domain, which is the primary one: no redirect", async () => {
    switchedOn();
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const fetchSpy = resolving("loopless", OWN_DOMAIN);
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(viaWorker(OWN_DOMAIN, "/products/x?color=red"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(servedAt(res)).toBe("/store/loopless/products/x");
    expect(lookedUp(fetchSpy)).toBe(OWN_DOMAIN);
  });

  it("never sends a subdomain to one of the platform's own hosts", async () => {
    switchedOn();
    vi.stubGlobal("fetch", resolving("selfish", "selfish.zimos.co"));
    expect(servedAt(await proxy(pageLoad("selfish.zimos.co", "/")))).toBe("/store/selfish");
    vi.stubGlobal("fetch", resolving("sibling", "other.zimos.co"));
    expect(servedAt(await proxy(pageLoad("sibling.zimos.co", "/")))).toBe("/store/sibling");
  });

  it("redirects a subdomain that came through the Worker to the domain itself, never the Railway host", async () => {
    switchedOn();
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolving("worked", OWN_DOMAIN));
    const res = await proxy(viaWorker("worked.zimos.co", "/products?page=2"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`https://${OWN_DOMAIN}/products?page=2`);
  });

  it("leaves the platform's other hosts as they were", async () => {
    switchedOn();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // store.zimos.co (the dashboard's previews), the root domain, development.
    expect((await proxy(pageLoad("store.zimos.co", "/store/naree/products"))).status).toBe(200);
    expect((await proxy(pageLoad("zimos.co"))).headers.get("location")).toBe("https://zimos.co/");
    expect(servedAt(await proxy(pageLoad("naree.localhost:3000", "/")))).toBe("/store/naree");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
