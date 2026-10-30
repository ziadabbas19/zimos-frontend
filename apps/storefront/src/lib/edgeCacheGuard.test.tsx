// @vitest-environment node
import { ServerResponse, createServer, request as httpRequest, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRIVATE_CACHE_CONTROL, edgeCacheValue } from "./edgeCache";
import { installEdgeCacheGuard } from "./edgeCacheGuard";

const MARK = edgeCacheValue({});

/**
 * A real Node server, as `next start` is: each path answers the way some page
 * does, with the proxy's mark already set, and the guard decides what leaves.
 */
const PAGES: Record<string, (res: ServerResponse) => void> = {
  "/page": (res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.write("<html>");
    res.end("</html>");
  },
  // The store home answering a merchant's redirect (redirect() in a page).
  "/redirect": (res) => {
    res.statusCode = 307;
    res.setHeader("Location", "/products");
    res.end();
  },
  "/permanent": (res) => {
    res.writeHead(308, { Location: "/new", "Content-Type": "text/html" });
    res.end();
  },
  "/missing": (res) => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<html>not found</html>");
  },
  "/cookie": (res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Set-Cookie", "a=b; Path=/");
    res.end("<html>");
  },
  "/cookie-in-writehead": (res) => {
    res.writeHead(200, ["Content-Type", "text/html", "Set-Cookie", "a=b"]);
    res.end("<html>");
  },
  "/rsc": (res) => {
    res.setHeader("Content-Type", "text/x-component");
    res.end("0:{}");
  },
};

let server: Server;
let uninstall: () => void;

beforeAll(async () => {
  uninstall = installEdgeCacheGuard({});
  server = createServer((req, res) => {
    const [path] = (req.url ?? "/").split("?");
    res.setHeader("Cache-Control", req.headers["x-test-own-header"] === "1" ? "public, max-age=31536000, immutable" : MARK);
    (PAGES[path] ?? PAGES["/page"])(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

afterAll(async () => {
  uninstall();
  await new Promise((resolve) => server.close(resolve));
});

function get(path: string, headers: Record<string, string> = {}, method = "GET"): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("installEdgeCacheGuard", () => {
  it("lets a 200 HTML page keep the mark, for GET and HEAD", async () => {
    expect((await get("/page")).headers["cache-control"]).toBe(MARK);
    expect((await get("/page", {}, "HEAD")).headers["cache-control"]).toBe(MARK);
  });

  it("never lets a redirect leave marked", async () => {
    const temporary = await get("/redirect");
    expect(temporary.status).toBe(307);
    expect(temporary.headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
    const permanent = await get("/permanent");
    expect(permanent.status).toBe(308);
    expect(permanent.headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
  });

  it("takes the mark back from a 404 and from a response that sets a cookie", async () => {
    expect((await get("/missing")).headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
    const cookie = await get("/cookie");
    expect(cookie.headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
    expect(cookie.headers["set-cookie"]).toEqual(["a=b; Path=/"]);
    expect((await get("/cookie-in-writehead")).headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
  });

  it("never keeps the app's navigations: an RSC payload, an RSC request, a `_rsc` link", async () => {
    expect((await get("/rsc")).headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
    expect((await get("/page", { RSC: "1" })).headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
    expect((await get("/page", { "Next-Router-Prefetch": "1" })).headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
    expect((await get("/page?_rsc=abc12")).headers["cache-control"]).toBe(PRIVATE_CACHE_CONTROL);
  });

  it("leaves any other Cache-Control alone", async () => {
    const own = await get("/redirect", { "x-test-own-header": "1" });
    expect(own.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("installs once per process", () => {
    const installed = ServerResponse.prototype.writeHead;
    installEdgeCacheGuard({})();
    expect(ServerResponse.prototype.writeHead).toBe(installed);
  });
});
