import { notFound } from "next/navigation";
import { ApiError } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { ProductCard } from "@/components/ProductCard";

export const revalidate = 60;

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = createStorefrontApiClient();

  const [store, productList] = await Promise.all([
    client.getStorefrontMeta(workspaceId).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }),
    client.listStorefrontProducts(workspaceId, { limit: 24 }),
  ]);

  if (!store) notFound();

  return (
    <main className="flex-1">
      <header className="border-b border-line bg-paper-raised px-6 py-10 text-center">
        {store.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logoUrl} alt={store.name} className="mx-auto mb-4 h-10" />
        )}
        <h1 className="font-display text-3xl font-medium text-ink">{store.name}</h1>
        {store.tagline && <p className="mt-2 text-sm text-ink-soft">{store.tagline}</p>}
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {productList.products.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">
            No products published yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {productList.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                workspaceId={workspaceId}
                currency={store.currency}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
