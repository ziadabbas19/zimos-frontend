
/**
 * A store's public address — the slug it is served on.
 *
 * Every workspace is reachable at `<slug>.zimos.co`, so the slug is not an
 * internal identifier the merchant never sees: it is the link they hand out.
 * This module holds the two things the dashboard needs to talk about it — how
 * to build the URL, and how to say why an address was refused.
 *
 * The *rules* are not repeated here. Whether an address may be used is decided
 * by `GET /workspaces/check-slug` and enforced again on PATCH, so there is one
 * authority and the UI can never quietly disagree with it.
 */

/** Overridable so a staging deploy can hang stores off its own domain — the
 * storefront reads the same value as `NEXT_PUBLIC_ROOT_DOMAIN`. */
export const ROOT_DOMAIN = (
  import.meta.env.VITE_PUBLIC_ROOT_DOMAIN ?? "zimos.co"
).toLowerCase();

/** The host a store is served on, for display: `mystore.zimos.co`. */
export function storeHost(slug: string): string {
  return `${slug}.${ROOT_DOMAIN}`;
}

/** A store's public URL: `https://mystore.zimos.co`. */
export function storeUrl(slug: string): string {
  return `https://${storeHost(slug)}`;
}

/**
 * A first guess at an address for a store called `name`, used to prefill the
 * field so most merchants never have to think about it.
 *
 * Only a suggestion: it shapes the text into something that *can* be a slug,
 * and the backend's check is what decides whether it may actually be used. It
 * mirrors the backend's own naming (`toWorkspaceSlug`) so the prefill matches
 * the address a store would be given anyway if the merchant left it alone.
 */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
}
