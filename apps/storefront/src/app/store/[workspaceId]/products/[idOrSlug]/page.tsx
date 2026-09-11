import { notFound } from "next/navigation";
import Link from "next/link";
import { ApiError, formatMoney } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { AddToCartButton } from "@/components/AddToCartButton";

export const revalidate = 60;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ workspaceId: string; idOrSlug: string }>;
}) {
  const { workspaceId, idOrSlug } = await params;
  const client = await createServerStorefrontApiClient();

  // getStoreMeta is React-cached, so this shares the layout's single fetch.
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    client.getStorefrontProduct(workspaceId, idOrSlug).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }),
  ]);

  if (!store || !product) notFound();

  const defaultOffer = product.offers.find((o) => o.isDefault) ?? product.offers[0];
  const price = defaultOffer?.priceAmount ?? product.variants[0]?.priceAmount;
  // No variant picker yet — default to the first in-stock variant.
  const purchasableVariant =
    product.variants.find((v) => v.inStock) ?? product.variants[0];

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <Link href={`/store/${workspaceId}`} className="text-sm text-primary hover:underline">
        ← Back to {store.name}
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="aspect-square rounded-[var(--radius-card)] bg-primary-soft" />

        <div>
          <h1 className="font-display text-2xl font-medium text-ink">{product.name}</h1>
          {price !== undefined && (
            <p className="mt-2 text-xl text-primary-dark">{formatMoney(price, store.currency)}</p>
          )}
          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>
          )}

          <div className="mt-6 space-y-2">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between rounded-[0.5rem] border border-line px-4 py-2 text-sm"
              >
                <span>{Object.values(variant.optionValues).join(" / ") || variant.sku}</span>
                <span className={variant.inStock ? "text-ink-soft" : "text-danger"}>
                  {variant.inStock ? "In stock" : "Out of stock"}
                </span>
              </div>
            ))}
          </div>

          <AddToCartButton
            variantId={purchasableVariant?.id}
            offerId={defaultOffer?.id}
            disabled={!purchasableVariant?.inStock}
          />
        </div>
      </div>
    </main>
  );
}
