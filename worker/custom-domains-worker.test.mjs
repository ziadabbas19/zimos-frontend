// The custom-domains Worker (custom-domains-worker.js) with fetch and the
// zone's cache (caches.default) replaced: nothing leaves the machine.
// Run: node --test worker/
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "./custom-domains-worker.js";

const ORIGIN = "storefront-production.up.railway.app";
const SECRET = "edge-secret-for-tests-0123456789abcdef";
const MARK = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const PRIVATE = "private, no-cache, no-store, max-age=0, must-revalidate";
const ON = { ORIGIN_HOST: ORIGIN, EDGE_SECRET: SECRET, EDGE_CACHE_ENABLED: "true" };
const OFF = { ORIGIN_HOST: ORIGIN, EDGE_SECRET: SECRET };

/** caches.default: what was put, by URL; what is matched comes back as a new Response. */
function fakeCache() {
  const kept = new Map();
  return {
    kept,
    matched: [],
    async match(request) {
      this.matched.push(request.url);
      const hit = kept.get(request.url);
      return hit ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : undefined;
    },
    async put(request, response) {
      assert.equal(request.method, "GET");
      kept.set(request.url, { status: response.status, headers: [...response.headers], body: await response.text() });
    },
  };
}

let cache;
let calls;
let pages; // visitor host → the HTML the storefront renders for it
let answer; // (url, init) → Response, the storefront's answer
let waited;

const ctx = () => ({ waitUntil: (promise) => waited.push(promise) });
const settle = () => Promise.all(waited.splice(0));

beforeEach(() => {
  cache = fakeCache();
  globalThis.caches = { default: cache };
  calls = [];
  waited = [];
  pages = new Map([
    ["www.store-a.com", "<html>store A</html>"],
    ["www.store-b.com", "<html>store B</html>"],
  ]);
  // Like the storefront: a public page is marked only when the Worker said it keeps it.
  answer = (url, init) => {
    const host = init.headers.get("x-zimos-host");
    const signalled = init.headers.get("x-zimos-edge-cache") === "1";
    const personal = /^\/(cart|pay|checkout)(\/|$)/.test(new URL(url).pathname);
    return new Response(pages.get(host) ?? "<html>?</html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": signalled && !personal ? MARK : PRIVATE },
    });
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return answer(url, init);
  };
});

afterEach(() => {
  delete globalThis.caches;
});

async function visit(url, { env = ON, method = "GET", headers = {} } = {}) {
  const res = await worker.fetch(new Request(url, { method, headers }), env, ctx());
  await settle();
  return res;
}

describe("with EDGE_CACHE_ENABLED off (the default)", () => {
  it("forwards every request exactly as before: no cache read, no signal, no label", async () => {
    for (const env of [OFF, { ...OFF, EDGE_CACHE_ENABLED: "1" }, { ...OFF, EDGE_CACHE_ENABLED: "TRUE" }]) {
      calls = [];
      const res = await visit("https://www.store-a.com/products/x?utm_source=fb", {
        env,
        headers: { "cf-connecting-ip": "203.0.113.7", "x-zimos-host": "www.store-b.com", "x-zimos-edge-cache": "1", "x-zimos-edge": "forged" },
      });
      assert.equal(calls.length, 1);
      const { url, init } = calls[0];
      assert.equal(url, `https://${ORIGIN}/products/x?utm_source=fb`);
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "manual");
      assert.equal(init.cache, undefined);
      assert.equal(init.headers.get("x-zimos-host"), "www.store-a.com");
      assert.equal(init.headers.get("x-forwarded-host"), "www.store-a.com");
      assert.equal(init.headers.get("x-forwarded-proto"), "https");
      assert.equal(init.headers.get("x-zimos-edge"), SECRET);
      assert.equal(init.headers.get("x-zimos-client-ip"), "203.0.113.7");
      // A shopper can never send the Worker's promise to keep the page.
      assert.equal(init.headers.get("x-zimos-edge-cache"), null);
      assert.equal(res.headers.get("x-zimos-cache"), null);
      assert.equal(res.headers.get("cache-control"), PRIVATE);
    }
    assert.deepEqual(cache.matched, []);
    assert.equal(cache.kept.size, 0);
  });

  it("still answers 503 without its secrets", async () => {
    const res = await visit("https://www.store-a.com/", { env: { EDGE_CACHE_ENABLED: "true" } });
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
  });
});

describe("with EDGE_CACHE_ENABLED on", () => {
  it("keeps a public page under the shopper's own URL: MISS, then HIT without asking the storefront", async () => {
    const first = await visit("https://www.store-a.com/products/x");
    assert.equal(first.headers.get("x-zimos-cache"), "MISS");
    assert.equal(await first.text(), "<html>store A</html>");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers.get("x-zimos-edge-cache"), "1");
    // The subrequest itself is never kept under ORIGIN_HOST.
    assert.equal(calls[0].init.cache, "no-store");
    assert.deepEqual([...cache.kept.keys()], ["https://www.store-a.com/products/x"]);

    const second = await visit("https://www.store-a.com/products/x");
    assert.equal(second.headers.get("x-zimos-cache"), "HIT");
    assert.equal(await second.text(), "<html>store A</html>");
    assert.equal(calls.length, 1);
  });

  it("never answers one store's host with another's page: same path, two keys", async () => {
    await visit("https://www.store-a.com/products/x");
    const b = await visit("https://www.store-b.com/products/x");
    assert.equal(b.headers.get("x-zimos-cache"), "MISS");
    assert.equal(await b.text(), "<html>store B</html>");
    assert.equal(calls.length, 2);
    assert.equal(calls[1].init.headers.get("x-zimos-host"), "www.store-b.com");
    assert.deepEqual([...cache.kept.keys()].sort(), ["https://www.store-a.com/products/x", "https://www.store-b.com/products/x"]);
    assert.equal(await (await visit("https://www.store-a.com/products/x")).text(), "<html>store A</html>");
    assert.equal(await (await visit("https://www.store-b.com/products/x")).text(), "<html>store B</html>");
    // Nothing is ever kept under the Railway host.
    assert.ok([...cache.kept.keys()].every((key) => !key.includes(ORIGIN)));
  });

  it("keys the query string too: another query is another copy", async () => {
    await visit("https://www.store-a.com/products?page=1");
    const other = await visit("https://www.store-a.com/products?page=2");
    assert.equal(other.headers.get("x-zimos-cache"), "MISS");
    assert.equal(cache.kept.size, 2);
  });

  it("never adds, changes or removes Cache-Control: the storefront's own, on a MISS and on a HIT", async () => {
    const miss = await visit("https://www.store-a.com/");
    const hit = await visit("https://www.store-a.com/");
    assert.equal(miss.headers.get("cache-control"), MARK);
    assert.equal(hit.headers.get("cache-control"), MARK);
    const cart = await visit("https://www.store-a.com/cart");
    assert.equal(cart.headers.get("cache-control"), PRIVATE);
  });

  it("keeps nothing the storefront did not mark: /cart, /pay, /checkout stay private and go to it every time", async () => {
    answer = (url) =>
      new Response("<html>personal</html>", {
        status: 200,
        headers: { "content-type": "text/html", "cache-control": /\/(cart|pay|checkout)/.test(url) ? PRIVATE : MARK },
      });
    for (const path of ["/cart", "/pay/o1", "/checkout"]) {
      for (let i = 0; i < 2; i += 1) {
        const res = await visit(`https://www.store-a.com${path}`);
        assert.equal(res.headers.get("x-zimos-cache"), "MISS", path);
      }
    }
    assert.equal(calls.length, 6);
    assert.equal(cache.kept.size, 0);
  });

  it("keeps only a 200 HTML answer with exactly the mark and no Set-Cookie", async () => {
    const answers = [
      { status: 200, headers: { "content-type": "text/html", "cache-control": MARK, "set-cookie": "zimos_store_preview=x" } },
      { status: 404, headers: { "content-type": "text/html", "cache-control": MARK } },
      { status: 307, headers: { location: "https://www.store-a.com/", "cache-control": MARK } },
      { status: 200, headers: { "content-type": "text/x-component", "cache-control": MARK } },
      { status: 200, headers: { "content-type": "text/html", "cache-control": "public, max-age=600" } },
      { status: 200, headers: { "content-type": "text/html", "cache-control": `${MARK}, private` } },
      { status: 200, headers: { "content-type": "text/html" } },
    ];
    for (const [i, init] of answers.entries()) {
      answer = () => new Response(init.status === 307 ? null : "<html>x</html>", init);
      await visit(`https://www.store-a.com/p${i}`);
    }
    assert.equal(cache.kept.size, 0);
  });

  it("bypasses the copy for a visitor with one of our cookies, and never signals for them", async () => {
    await visit("https://www.store-a.com/products/x");
    for (const cookie of ["zimos_store_locale=en", "_ga=1; zimos_store_color_mode=dark", "zimos_store_preview=t", "zimos_session=s"]) {
      calls = [];
      const res = await visit("https://www.store-a.com/products/x", { headers: { cookie } });
      assert.equal(res.headers.get("x-zimos-cache"), "BYPASS", cookie);
      assert.equal(calls.length, 1, cookie);
      assert.equal(calls[0].init.headers.get("x-zimos-edge-cache"), null, cookie);
      assert.equal(calls[0].init.cache, undefined, cookie);
    }
    // Cookies only scripts read leave the page the same.
    calls = [];
    const touched = await visit("https://www.store-a.com/products/x", { headers: { cookie: "zimos_touch=x; _fbp=y" } });
    assert.equal(touched.headers.get("x-zimos-cache"), "HIT");
    assert.equal(calls.length, 0);
  });

  it("bypasses the app's navigations, previews, Range and Authorization", async () => {
    await visit("https://www.store-a.com/products/x");
    const bypassed = [
      { url: "https://www.store-a.com/products/x", headers: { rsc: "1" } },
      { url: "https://www.store-a.com/products/x", headers: { "next-router-prefetch": "1" } },
      { url: "https://www.store-a.com/products/x", headers: { "next-url": "/products" } },
      { url: "https://www.store-a.com/products/x?_rsc=abc12" },
      { url: "https://www.store-a.com/products/x?storePreview=t" },
      { url: "https://www.store-a.com/products/x?paymentsPreview=t" },
      { url: "https://www.store-a.com/products/x?zimos-view=t" },
      { url: "https://www.store-a.com/products/x", headers: { range: "bytes=0-10" } },
      { url: "https://www.store-a.com/products/x", headers: { authorization: "Bearer x" } },
    ];
    for (const { url, headers } of bypassed) {
      calls = [];
      const res = await visit(url, { headers });
      assert.equal(res.headers.get("x-zimos-cache"), "BYPASS", `${url} ${JSON.stringify(headers)}`);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].init.headers.get("x-zimos-edge-cache"), null);
    }
    assert.equal(cache.kept.size, 1);
  });

  it("leaves assets, route handlers, files and non-GET requests exactly as before", async () => {
    for (const [path, method] of [["/_next/static/chunks/a.js", "GET"], ["/api/x", "GET"], ["/logo.png", "GET"], ["/products/x", "POST"]]) {
      calls = [];
      const res = await visit(`https://www.store-a.com${path}`, { method });
      assert.equal(res.headers.get("x-zimos-cache"), null, path);
      assert.equal(calls[0].init.cache, undefined, path);
      assert.equal(calls[0].init.headers.get("x-zimos-edge-cache"), null, path);
    }
    assert.deepEqual(cache.matched, []);
  });

  it("answers a HEAD from a kept copy without a body, and never keeps a HEAD's answer", async () => {
    const miss = await visit("https://www.store-a.com/", { method: "HEAD" });
    assert.equal(miss.headers.get("x-zimos-cache"), "MISS");
    assert.equal(calls[0].init.headers.get("x-zimos-edge-cache"), null);
    assert.equal(cache.kept.size, 0);
    await visit("https://www.store-a.com/");
    calls = [];
    const hit = await visit("https://www.store-a.com/", { method: "HEAD" });
    assert.equal(hit.headers.get("x-zimos-cache"), "HIT");
    assert.equal(hit.headers.get("cache-control"), MARK);
    assert.equal(await hit.text(), "");
    assert.equal(calls.length, 0);
  });

  it("a cache that fails to answer or to keep never fails the request", async () => {
    cache.match = async () => {
      throw new Error("cache down");
    };
    cache.put = async () => {
      throw new Error("413");
    };
    const res = await visit("https://www.store-a.com/");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "<html>store A</html>");
  });

  it("keeps nothing on a runtime that refuses cache: \"no-store\" (a copy could otherwise land under ORIGIN_HOST)", async () => {
    const RealRequest = globalThis.Request;
    globalThis.Request = class extends RealRequest {
      constructor(input, init = {}) {
        if (init.cache !== undefined) throw new TypeError("The 'cache' field on 'RequestInitializerDict' is not implemented.");
        super(input, init);
      }
    };
    try {
      // A fresh copy of the module: what the runtime takes is learned once per isolate.
      const { default: fresh } = await import(`./custom-domains-worker.js?no-store-refused=${Date.now()}`);
      const res = await fresh.fetch(new RealRequest("https://www.store-a.com/products/x"), ON, ctx());
      await settle();
      assert.equal(res.headers.get("x-zimos-cache"), null);
      assert.equal(calls[0].init.cache, undefined);
      assert.equal(calls[0].init.headers.get("x-zimos-edge-cache"), null);
      assert.deepEqual(cache.matched, []);
    } finally {
      globalThis.Request = RealRequest;
    }
  });
});

describe("the files every store answers for itself (robots.txt, sitemap.xml, manifest), whatever EDGE_CACHE_ENABLED says", () => {
  // proxy.ts STORE_FILES: what the storefront rewrites to /store/<slug>/… at the root of a merchant domain.
  const proxySource = readFileSync(new URL("../apps/storefront/src/proxy.ts", import.meta.url), "utf8");
  const declared = /const STORE_FILES = new Set\(\[([^\]]*)\]\)/.exec(proxySource);
  const STORE_FILES = declared ? [...declared[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

  it("covers every file the storefront answers per store", () => {
    assert.deepEqual(STORE_FILES.slice().sort(), ["/manifest.webmanifest", "/robots.txt", "/sitemap.xml"]);
  });

  for (const env of [OFF, ON]) {
    const state = env === ON ? "on" : "off";
    it(`never lets Cloudflare keep them under ORIGIN_HOST (cache: "no-store"), with the variable ${state}`, async () => {
      for (const path of STORE_FILES) {
        for (const url of [`https://www.store-a.com${path}`, `https://www.store-b.com${path}?v=2`]) {
          calls = [];
          const res = await visit(url, { env, headers: { "cf-connecting-ip": "203.0.113.7" } });
          assert.equal(calls.length, 1, url);
          const { url: target, init } = calls[0];
          assert.equal(target, url.replace(/www\.store-[ab]\.com/, ORIGIN), url);
          assert.equal(init.cache, "no-store", url);
          assert.equal(init.cf, undefined, url);
          // Everything else as before: the visitor's host, the proof, no promise to keep, no label, no Cache API.
          assert.equal(init.headers.get("x-zimos-host"), new URL(url).host);
          assert.equal(init.headers.get("x-zimos-edge"), SECRET);
          assert.equal(init.headers.get("x-zimos-client-ip"), "203.0.113.7");
          assert.equal(init.headers.get("x-zimos-edge-cache"), null);
          assert.equal(res.headers.get("x-zimos-cache"), null);
          assert.equal(res.headers.get("cache-control"), PRIVATE);
        }
      }
      assert.deepEqual(cache.matched, []);
      assert.equal(cache.kept.size, 0);
    });
  }

  it("however the path is spelled", async () => {
    for (const path of ["/ROBOTS.TXT", "/robots%2Etxt", "/Sitemap.xml"]) {
      calls = [];
      await visit(`https://www.store-a.com${path}`, { env: OFF });
      assert.equal(calls[0].init.cache, "no-store", path);
    }
  });

  it("other files stay as they were: Cloudflare may still keep the build's assets", async () => {
    for (const path of ["/_next/static/chunks/a.js", "/logo.png", "/favicon.ico", "/fonts/x.woff2", "/robots.txt.bak", "/blog/robots.txt"]) {
      calls = [];
      await visit(`https://www.store-a.com${path}`, { env: OFF });
      assert.equal(calls[0].init.cache, undefined, path);
      assert.equal(calls[0].init.cf, undefined, path);
    }
  });

  it("on a runtime that refuses cache: \"no-store\", asks Cloudflare not to cache them (cf.cacheTtl: -1)", async () => {
    const RealRequest = globalThis.Request;
    globalThis.Request = class extends RealRequest {
      constructor(input, init = {}) {
        if (init.cache !== undefined) throw new TypeError("The 'cache' field on 'RequestInitializerDict' is not implemented.");
        super(input, init);
      }
    };
    try {
      const { default: fresh } = await import(`./custom-domains-worker.js?store-files-no-cache-option=${Date.now()}`);
      for (const env of [OFF, ON]) {
        for (const path of STORE_FILES) {
          calls = [];
          await fresh.fetch(new RealRequest(`https://www.store-a.com${path}`), env, ctx());
          assert.equal(calls[0].init.cache, undefined, path);
          assert.deepEqual(calls[0].init.cf, { cacheTtl: -1 }, path);
        }
        // A page is left alone there, as before.
        calls = [];
        await fresh.fetch(new RealRequest("https://www.store-a.com/products/x"), env, ctx());
        assert.equal(calls[0].init.cf, undefined);
        assert.equal(calls[0].init.cache, undefined);
      }
    } finally {
      globalThis.Request = RealRequest;
    }
  });
});
