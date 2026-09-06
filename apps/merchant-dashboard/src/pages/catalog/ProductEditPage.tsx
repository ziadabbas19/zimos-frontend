import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatProductCode } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ProductDetailsForm } from "./components/ProductDetailsForm";
import { ProductImagesSection } from "./components/ProductImagesSection";
import { VariantsSection } from "./components/VariantsSection";
import { OffersSection } from "./components/OffersSection";
import { ProductCollectionsSection } from "./components/ProductCollectionsSection";

export function ProductEditPage() {
  const { productId } = useParams<{ productId: string }>();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const isNew = !productId;

  const product = useAsync(
    () => (productId ? apiClient.getProduct(workspaceId, productId) : Promise.resolve(null)),
    [workspaceId, productId]
  );

  if (isNew) {
    return (
      <div className="max-w-3xl">
        <PageHeader
          title="New product"
          back={{ to: "/catalog", label: "Products" }}
          description="Name, description and at least one image are required. Add variants, offers and collections after it's created."
        />
        <ProductDetailsForm
          mode="create"
          onCreated={(created) => navigate(`/catalog/${created.id}`)}
        />
      </div>
    );
  }

  const data = product.data;
  const reload = () => product.refresh({ silent: true });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={data?.name ?? "Product"}
        titleMeta={formatProductCode(data?.productCode) ?? undefined}
        back={{ to: "/catalog", label: "Products" }}
        actions={data && <StatusBadge value={data.status} />}
      />

      <DataState loading={product.loading} error={product.error} onRetry={() => product.refresh()}>
        {data && (
          <div className="space-y-6">
            <ProductDetailsForm mode="edit" product={data} onSaved={reload} />
            <ProductImagesSection
              mode="edit"
              productId={data.id}
              media={data.media ?? []}
              onChanged={reload}
            />
            <VariantsSection
              productId={data.id}
              variants={data.variants ?? []}
              onChanged={reload}
            />
            <OffersSection
              productId={data.id}
              offers={data.offers ?? []}
              variants={data.variants ?? []}
              onChanged={reload}
            />
            <ProductCollectionsSection
              productId={data.id}
              memberships={data.collections ?? []}
              onChanged={reload}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}
