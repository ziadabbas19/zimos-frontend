import { hostnameOf, isRootDomainHost, storeSlugFromHost } from "./domains";
import { serverApiBase, serverApiFetch } from "./serverApiBase";

/**
 * Merchant-owned domains (`shop.example.com`). The proxy cannot tell from the
 * host alone which store one belongs to, so it asks the API —
 * GET /store/resolve-host?host= — and remembers the answer for a minute,
 * misses included, so an unknown host costs one lookup rather than one per
 * request.
 */

export interface ResolvedHost {
  slug: string;
  /** The funnel shown on the domain's root instead of the store home, if any. */
  homeFunnelRef: string | null;
  /** The store's canonical host (its primary domain with a certificate), if it has one. */
  primaryHost: string | null;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { at: number; value: ResolvedHost | null }>();

/** Hosts that can never be a merchant domain: no lookup is made for them. */
function isPlatformOrLocal(hostname: string): boolean {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":") ||
    hostname.startsWith("[") ||
    !hostname.includes(".") ||
    isRootDomainHost(hostname)
  );
}

export async function resolveCustomHost(host: string | null | undefined): Promise<ResolvedHost | null> {
  const hostname = hostnameOf(host);
  if (isPlatformOrLocal(hostname)) return null;
  return lookup(hostname);
}

/**
 * The canonical host of the store served on a platform subdomain
 * (`<slug>.zimos.co`), when it has a primary domain — the proxy redirects
 * there. Null for a store without one, and for development hosts.
 */
export async function primaryHostForPlatformHost(host: string | null | undefined): Promise<string | null> {
  const hostname = hostnameOf(host);
  if (!storeSlugFromHost(hostname) || hostname.endsWith(".localhost") || hostname.includes(":")) return null;
  return (await lookup(hostname))?.primaryHost ?? null;
}

async function lookup(hostname: string): Promise<ResolvedHost | null> {
  const hit = cache.get(hostname);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: ResolvedHost | null = null;
  try {
    const res = await serverApiFetch(
      `${serverApiBase()}/store/resolve-host?host=${encodeURIComponent(hostname)}`,
      { headers: { accept: "application/json" } },
      // The proxy stops waiting at 1.5 s (proxy.ts); the request stops with it.
      // One sent again on the public address gets its own 1.5 s, and its
      // answer is remembered for the requests after.
      { timeoutMs: 1500 }
    );
    if (res.ok) {
      const body = (await res.json()) as { store?: { slug?: unknown; homeFunnel?: { ref?: unknown } | null; primaryHost?: unknown } };
      const slug = body.store?.slug;
      if (typeof slug === "string" && slug) {
        const ref = body.store?.homeFunnel?.ref;
        const primary = body.store?.primaryHost;
        value = {
          slug,
          homeFunnelRef: typeof ref === "string" && ref ? ref : null,
          primaryHost: typeof primary === "string" && primary ? primary.toLowerCase() : null,
        };
      }
    } else if (res.status !== 404) {
      // The API is unwell: do not remember this as "unknown host".
      return hit?.value ?? null;
    }
  } catch {
    return hit?.value ?? null;
  }

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(hostname, { at: Date.now(), value });
  return value;
}
