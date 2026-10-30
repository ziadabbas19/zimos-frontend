"use client";

import { useEffect, useMemo, useState } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";
import { LOCALE_COOKIE } from "./localeCookie";
import { readStorePreviewCookie } from "./storePreview";

/** A catalogue read this recently is reused, so the drawer and the cart or checkout page share one request. */
export const CATALOG_REUSE_MS = 30_000;

const shared = new Map<string, { at: number; products: Promise<StorefrontProduct[]> }>();

/** What the request's headers depend on (the shopper's language, a staff preview): another value is another catalogue. */
function requestContext(): string {
  if (typeof document === "undefined") return "";
  const locale = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`)) ?? "";
  return `${locale}|${readStorePreviewCookie() ?? ""}`;
}

/** The catalogue of a store, one request for every reader in CATALOG_REUSE_MS; a failure is not kept. */
export function fetchCatalog(workspaceId: string, limit: number): Promise<StorefrontProduct[]> {
  const key = `${workspaceId}:${limit}:${requestContext()}`;
  const hit = shared.get(key);
  if (hit && Date.now() - hit.at < CATALOG_REUSE_MS) return hit.products;
  const products = createStorefrontApiClient()
    .listStorefrontProducts(workspaceId, { limit })
    .then((res) => res.products);
  shared.set(key, { at: Date.now(), products });
  products.catch(() => {
    if (shared.get(key)?.products === products) shared.delete(key);
  });
  return products;
}

/** Test seam. */
export function forgetCatalogs(): void {
  shared.clear();
}

/**
 * The public catalogue, fetched in the browser. Cart lines only carry a
 * variant, so this is how the cart/checkout pages show product names and
 * images, and how they pick an order-bump product. No `workspaceId` (yet):
 * nothing is fetched.
 */
export function useCatalog(workspaceId: string | undefined, limit = 48) {
  const [products, setProducts] = useState<StorefrontProduct[] | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchCatalog(workspaceId, limit)
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, limit]);

  const byVariant = useMemo(() => {
    const map = new Map<string, StorefrontProduct>();
    for (const p of products ?? []) for (const v of p.variants) map.set(v.id, p);
    return map;
  }, [products]);

  return { products, byVariant, loaded: products !== null };
}
