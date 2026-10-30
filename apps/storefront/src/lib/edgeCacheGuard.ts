import { ServerResponse, type OutgoingHttpHeaders } from "node:http";
import { PRIVATE_CACHE_CONTROL, edgeCacheValue, keepsEdgeCache } from "./edgeCache";

/**
 * The second of lib/edgeCache's two checks, on the way out: the proxy marks a
 * public page `public, s-maxage=…` before it is rendered, so it cannot know
 * that the page will redirect (the store home does when the merchant points
 * it elsewhere), answer 404 or 500, set a cookie, or be one of the app's own
 * navigations (an RSC payload: Next takes their headers away from the proxy,
 * and answers one with a bad `_rsc` with a 307). Just before the status line
 * and headers leave, a response that still carries the mark and is not a 200
 * HTML page gets Next's own `private, no-cache, no-store` back.
 *
 * Every response leaves through ServerResponse.prototype.writeHead — called
 * directly, or by Node itself on the first write or end — so that is where
 * this looks. It only ever touches a response whose Cache-Control is exactly
 * the mark; any other response goes out as it was. Installed once, at server
 * start, by src/instrumentation.ts, and only while STOREFRONT_EDGE_CACHE_ENABLED
 * is "true".
 */

const INSTALLED = Symbol.for("zimos.edgeCacheGuard");

type WriteHead = (this: ServerResponse, statusCode: number, ...rest: unknown[]) => ServerResponse;

/** A header passed to writeHead itself (an object, or a flat or paired array), lowercase name. */
function headerInArgs(rest: unknown[], name: string): string | null {
  const headers = rest.find((arg) => typeof arg === "object" && arg !== null);
  if (!headers) return null;
  if (Array.isArray(headers)) {
    const pairs: unknown[][] = Array.isArray(headers[0])
      ? (headers as unknown[][])
      : Array.from({ length: Math.floor(headers.length / 2) }, (_, i) => [headers[2 * i], headers[2 * i + 1]]);
    const hit = pairs.find((pair) => String(pair[0]).toLowerCase() === name);
    return hit ? String(hit[1]) : null;
  }
  for (const [key, value] of Object.entries(headers as OutgoingHttpHeaders)) {
    if (key.toLowerCase() === name && value !== undefined) return String(value);
  }
  return null;
}

function headerOf(res: ServerResponse, rest: unknown[], name: string): string | null {
  const own = res.getHeader(name);
  if (own !== undefined) return String(own);
  return headerInArgs(rest, name);
}

/** Installs the check once per process; answers a function that takes it out again (for tests). */
export function installEdgeCacheGuard(env: NodeJS.ProcessEnv = process.env): () => void {
  const proto = ServerResponse.prototype as unknown as { writeHead: WriteHead; [INSTALLED]?: true };
  if (proto[INSTALLED]) return () => undefined;
  proto[INSTALLED] = true;
  const mark = edgeCacheValue(env);
  const original = proto.writeHead;
  proto.writeHead = function writeHead(this: ServerResponse, statusCode: number, ...rest: unknown[]) {
    if (!this.headersSent && headerOf(this, rest, "cache-control") === mark) {
      const req = this.req;
      const keep = keepsEdgeCache({
        status: typeof statusCode === "number" ? statusCode : this.statusCode,
        contentType: headerOf(this, rest, "content-type"),
        setsCookie: headerOf(this, rest, "set-cookie") !== null,
        requestHeaderNames: req ? Object.keys(req.headers) : [],
        requestUrl: req?.url ?? null,
      });
      if (!keep) this.setHeader("Cache-Control", PRIVATE_CACHE_CONTROL);
    }
    return original.call(this, statusCode, ...rest);
  };
  return () => {
    proto.writeHead = original;
    delete proto[INSTALLED];
  };
}
