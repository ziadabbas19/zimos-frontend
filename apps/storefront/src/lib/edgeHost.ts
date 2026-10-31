/**
 * Merchant domains reach this app through a Cloudflare Worker
 * (worker/custom-domains-worker.js, docs/custom-domains/README.md): the
 * Worker calls our own Railway host, so `Host` is ours and the visitor's host
 * is in `X-Zimos-Host`. Not `X-Forwarded-Host`: Railway's edge sets that one
 * itself, to the host it was called on (ours), whatever the Worker sent. A
 * Worker from before X-Zimos-Host sent only X-Forwarded-Host, which is still
 * read when X-Zimos-Host is absent. The Worker proves it
 * is the Worker with `X-Zimos-Edge`, equal to CUSTOM_DOMAIN_EDGE_SECRET.
 * Without that proof the forwarded host is ignored: anyone can call the
 * origin directly and send any header they like.
 */

export const EDGE_SECRET_HEADER = "x-zimos-edge";
// The visitor's host, set by the Worker.
export const EDGE_HOST_HEADER = "x-zimos-host";
// The shopper's IP as Cloudflare saw it (CF-Connecting-IP), set by the Worker:
// behind it, x-real-ip is Cloudflare's address, not the shopper's.
export const EDGE_CLIENT_IP_HEADER = "x-zimos-client-ip";
// "1": the Worker keeps this page's answer itself, under the visitor's own URL
// (its EDGE_CACHE_ENABLED, lib/edgeCache). Trusted only with the secret.
export const EDGE_CACHE_HEADER = "x-zimos-edge-cache";
const IP_LIKE = /^[0-9a-f:.]{2,45}$/i;
// A shorter secret is treated as unset: the forwarded host is never trusted.
const MIN_SECRET_LENGTH = 32;
const HOST_SHAPE = /^[a-z0-9.-]+(:\d{1,5})?$/;

/**
 * Constant-time comparison: the time taken does not depend on where the two
 * strings first differ, so the secret cannot be guessed one character at a
 * time. Runtime-neutral (no node:crypto), so it works wherever the proxy runs.
 */
export function sameSecret(given: string | null | undefined, expected: string): boolean {
  const a = given ?? "";
  if (!a || !expected) return false;
  let diff = a.length ^ expected.length;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= a.charCodeAt(i % a.length) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export interface VisitorHost {
  /** The host the visitor asked for, as `Host` would carry it. */
  host: string | null;
  /** True when it came from the Worker's X-Zimos-Host (or X-Forwarded-Host). */
  forwarded: boolean;
  /** The shopper's IP from the Worker, only when forwarded. */
  clientIp: string | null;
}

/**
 * The visitor's host: the Worker's X-Zimos-Host when proven, else its
 * X-Forwarded-Host when X-Zimos-Host is absent, else `Host`. An X-Zimos-Host
 * that is present but malformed falls back to `Host`, never to X-Forwarded-Host.
 */
export function visitorHost(headers: Headers): VisitorHost {
  const own = headers.get("host");
  const secret = (process.env.CUSTOM_DOMAIN_EDGE_SECRET ?? "").trim();
  if (secret.length < MIN_SECRET_LENGTH || !sameSecret(headers.get(EDGE_SECRET_HEADER), secret)) {
    return { host: own, forwarded: false, clientIp: null };
  }
  const sent = headers.get(EDGE_HOST_HEADER) ?? (headers.get("x-forwarded-host") ?? "").split(",")[0];
  const forwarded = sent.trim().toLowerCase();
  if (!forwarded || !HOST_SHAPE.test(forwarded)) return { host: own, forwarded: false, clientIp: null };
  const ip = (headers.get(EDGE_CLIENT_IP_HEADER) ?? "").trim();
  return { host: forwarded, forwarded: true, clientIp: IP_LIKE.test(ip) ? ip : null };
}
