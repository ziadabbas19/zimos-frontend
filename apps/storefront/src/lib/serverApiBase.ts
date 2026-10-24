/**
 * Where this server's own calls to the API go.
 *
 * NEXT_PUBLIC_API_BASE_URL is the API's public address (in production
 * https://api.zimos.co/api/v1, behind Cloudflare). Next writes it into the
 * code at build time and the shopper's browser calls it: nothing here changes
 * that.
 *
 * INTERNAL_API_BASE_URL is for this server only. It has no NEXT_PUBLIC_
 * prefix, so it is read from the environment while the server runs — never
 * at build time — and never reaches the browser. On Railway it is the
 * backend's private address, `http://<backend>.railway.internal:<PORT>/api/v1`,
 * which does not pass through Cloudflare, whose bot checks can challenge calls
 * coming from Railway's addresses. Unset, or not a plain http(s) URL, every
 * call takes the public address exactly as before.
 *
 * A call that can't reach the private address at all — connection refused,
 * unknown host, no connection in time — is sent once more to the public one,
 * and a warning is logged. An answer from the API, whatever its status, is
 * never sent again.
 */

const LOCAL_API = "http://localhost:4000/api/v1";

/** Socket errors meaning the call never reached the API. Node's fetch puts them in the error's `cause`. */
const UNREACHABLE = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** A falling-back call is logged at most this often; the ones in between are counted in the next warning. */
const WARN_EVERY_MS = 60_000;

/** The API's public address, the one the browser uses, without its trailing "/". */
export function publicApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? LOCAL_API).replace(/\/$/, "");
}

let parsed: { raw: string; base: string | null } | null = null;

/**
 * The private address from INTERNAL_API_BASE_URL without its trailing "/", or
 * null when it is unset or unusable. A URL with a user, a password, a query or
 * a fragment is unusable. So is any value while `next build` runs: the private
 * network only exists at run time.
 */
export function internalApiBase(): string | null {
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  const raw = process.env.INTERNAL_API_BASE_URL?.trim() ?? "";
  if (parsed?.raw === raw) return parsed.base;
  const base = raw ? parseBase(raw) : null;
  parsed = { raw, base };
  // Said once per value, when it is first used. The private address is no
  // secret; a value that isn't a usable URL is not repeated, whatever it holds.
  if (base) {
    console.info(`[api] Server-side API calls go to the private address ${base} (INTERNAL_API_BASE_URL); the public address is the fallback.`);
  } else if (raw) {
    console.warn("[api] INTERNAL_API_BASE_URL is not a plain http(s) URL; server-side API calls use the public address.");
  }
  return base;
}

function parseBase(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Where this server's calls start: the private address when one is set, the public one otherwise. */
export function serverApiBase(): string {
  return internalApiBase() ?? publicApiBase();
}

export interface ServerApiFetchOptions {
  /**
   * Each attempt gives up after this long, on its own timer, so a call sent
   * again gets the whole time too. A GET or HEAD that runs out of time on the
   * private address is sent again; any other method is not, since the API may
   * have acted on it.
   */
  timeoutMs?: number;
}

/**
 * fetch for a URL built on serverApiBase(). One on the private address that
 * can't reach it is sent once more, unchanged, to the same path on the public
 * one. Any other URL, and every call while INTERNAL_API_BASE_URL is unset, is
 * a plain fetch.
 */
export async function serverApiFetch(url: string, init: RequestInit = {}, { timeoutMs }: ServerApiFetchOptions = {}): Promise<Response> {
  const attempt = (target: string) => fetch(target, timeoutMs ? { ...init, signal: withTimeout(init.signal, timeoutMs) } : init);
  const internal = internalApiBase();
  if (!internal || !isUnder(url, internal)) return attempt(url);
  try {
    return await attempt(url);
  } catch (err) {
    const reason = unreachableReason(err, init, timeoutMs);
    if (!reason) throw err;
    warnFallback(internal, init.method ?? "GET", reason);
    return attempt(publicApiBase() + url.slice(internal.length));
  }
}

function isUnder(url: string, base: string): boolean {
  if (!url.startsWith(base)) return false;
  const next = url.charAt(base.length);
  return next === "" || next === "/" || next === "?";
}

function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}

/** Why the call never got an answer from the API, or null when it may have (or the caller called it off). */
function unreachableReason(err: unknown, init: RequestInit, timeoutMs: number | undefined): string | null {
  const cause = (err as { cause?: unknown } | null)?.cause;
  // With several addresses to try (IPv4 and IPv6), an AggregateError of each one's failure.
  const errors = (cause as { errors?: unknown } | null)?.errors;
  for (const candidate of [cause, ...(Array.isArray(errors) ? errors : [])]) {
    const code = (candidate as { code?: unknown } | null)?.code;
    if (typeof code === "string" && UNREACHABLE.has(code)) return code;
  }
  const method = (init.method ?? "GET").toUpperCase();
  const ownTimeout = Boolean(timeoutMs) && (err as { name?: unknown } | null)?.name === "TimeoutError" && !init.signal?.aborted;
  return ownTimeout && (method === "GET" || method === "HEAD") ? "timeout" : null;
}

let warnedAt = 0;
let unwarned = 0;

/** Names the private host, the method and the reason — never the path, a header or a body. */
function warnFallback(internal: string, method: string, reason: string) {
  const now = Date.now();
  if (warnedAt && now - warnedAt < WARN_EVERY_MS) {
    unwarned += 1;
    return;
  }
  const more = unwarned ? ` ${unwarned} more since the last warning.` : "";
  warnedAt = now;
  unwarned = 0;
  console.warn(
    `[api] The private API address ${new URL(internal).host} could not be reached (${reason}); a ${method} call was sent once more to the public address.${more} Check INTERNAL_API_BASE_URL (the backend's service name and PORT), or unset it.`
  );
}
