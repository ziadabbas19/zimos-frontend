import { notFound } from "next/navigation";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { ProductCard } from "@/components/ProductCard";
import { CartIcon } from "@/components/CartIcon";
import { ThemeToggle } from "@/components/ThemeToggle";

export const revalidate = 60;

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = createStorefrontApiClient();

  // getStoreMeta is React-cached, so this shares the layout's single fetch.
  const [store, productList] = await Promise.all([
    getStoreMeta(workspaceId),
    client.listStorefrontProducts(workspaceId, { limit: 24 }),
  ]);

  if (!store) notFound();

  return (
    <main className="flex-1">
      <header className="relative border-b border-line bg-paper-raised px-6 py-10 text-center">
        {/* Brand bar — the merchant's two colours, edge to edge. */}
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--brand-primary), var(--brand-secondary))",
          }}
          aria-hidden
        />
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
          <ThemeToggle />
          <CartIcon workspaceId={workspaceId} />
        </div>
        {store.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logoUrl} alt={store.name} className="mx-auto mb-4 h-10" />
        )}
        <h1 className="font-display text-3xl font-medium" style={{ color: "var(--brand-primary)" }}>
          {store.name}
        </h1>
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
