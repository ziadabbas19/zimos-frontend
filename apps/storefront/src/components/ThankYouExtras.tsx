"use client";

import { useEffect, useState } from "react";
import {
  fillThankYouContent,
  type StorefrontProduct,
  type ThankYouPageSettings,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { CARD_FIELDS } from "@/lib/cardFields";
import { useStore } from "@/lib/StoreContext";
import { ProductCard } from "./ProductCard";
import { card } from "./ui";

/**
 * The merchant's own words on the thank-you page (settings → thank-you page):
 * plain text, one paragraph per line, with the order number and the shopper's
 * name filled in. Printed as text — nothing in it is treated as markup.
 */
export function ThankYouMessage({
  page,
  orderNumber,
  customerName,
}: {
  page: ThankYouPageSettings;
  orderNumber: string | null;
  customerName: string | null;
}) {
  if (!page.enabled || !page.content.trim()) return null;
  const paragraphs = fillThankYouContent(page.content, { orderNumber, customerName })
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <section className={`${card} mt-6 space-y-2 p-5 text-sm leading-relaxed text-ink sm:p-6`}>
      {paragraphs.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </section>
  );
}

/** Products from the collection the merchant chose to show after an order. */
export function ThankYouProducts({ workspaceId, collectionId }: { workspaceId: string; collectionId: string }) {
  const { t, locale, store } = useStore();
  const [products, setProducts] = useState<StorefrontProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    createStorefrontApiClient()
      .listStorefrontProducts(workspaceId, { collectionId, limit: 4, ...CARD_FIELDS })
      .then((list) => {
        if (!cancelled) setProducts(list.products.slice(0, 4));
      })
      .catch(() => {
        /* a removed collection simply shows nothing */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, collectionId]);

  if (products.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="thanks-products-title">
      <h2 id="thanks-products-title" className="text-center text-lg font-semibold text-ink">
        {t.thankYou.moreProducts}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={store?.currency ?? "EGP"} locale={locale} />
        ))}
      </div>
    </section>
  );
}
