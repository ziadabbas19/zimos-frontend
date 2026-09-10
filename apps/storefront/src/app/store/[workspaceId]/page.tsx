import { notFound, redirect } from "next/navigation";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { PageRenderer } from "@/components/page-renderer";
import { ProductCard } from "@/components/ProductCard";
import { StoreHeader } from "@/components/StoreHeader";

export const revalidate = 60;

/**
 * The store's front page.
 *
 * If the merchant has published a website, its home page ("/") is what a
 * shopper gets, rendered from the published page tree.
 *
 * If they haven't — no site built yet, or built but never published — the
 * catalogue grid below stands in. That fallback is deliberate: a workspace with
 * products but no published site is the normal state during onboarding, and
 * showing a blank page or an error there would make a working store look broken.
 * The public pages API can't distinguish "no published site" from "no such
 * page", but publishing *requires* a page at "/", so any 404 here means there
 * is no live site to render.
 */
export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = createStorefrontApiClient();

  // getStoreMeta is React-cached, so this shares the layout's single fetch.
  const [store, published] = await Promise.all([
    getStoreMeta(workspaceId),
    client.getStorefrontPage(workspaceId, "/"),
  ]);

  if (!store) notFound();

  if (published.kind === "redirect") {
    redirect(`/store/${workspaceId}${published.to}`);
  }

  const tree = published.kind === "page" ? published.data.page.tree : null;
  const hasContent = (tree?.sections?.length ?? 0) > 0;

  if (hasContent) {
    return (
      <main className="flex-1">
        <StoreHeader store={store} workspaceId={workspaceId} linkHome={false} />
        <PageRenderer tree={tree} workspaceId={workspaceId} currency={store.currency} />
      </main>
    );
  }

  const productList = await client.listStorefrontProducts(workspaceId, { limit: 24 });

  return (
    <main className="flex-1">
      <StoreHeader store={store} workspaceId={workspaceId} linkHome={false} />

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
