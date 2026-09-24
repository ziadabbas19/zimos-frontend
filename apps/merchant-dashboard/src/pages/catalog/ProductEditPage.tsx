import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatProductCode } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useCatalogLabels } from "./catalogLabels";
import { ProductDetailsForm } from "./components/ProductDetailsForm";
import { ProductImagesSection } from "./components/ProductImagesSection";
import { VariantsSection } from "./components/VariantsSection";
import { OffersSection } from "./components/OffersSection";
import { ProductCollectionsSection } from "./components/ProductCollectionsSection";

const STRINGS = {
  en: {
    newTitle: "New product",
    newDescription:
      "Name, description, an image and a price are required. Add more variants, offers and collections after it's created.",
    products: "Products",
    product: "Product",
    noActiveVariant: "Add a variant so customers can buy this product.",
    noActiveVariantArchived:
      "This product has no active variant. Once it's restored, add or reactivate a variant so customers can buy it.",
  },
  ar: {
    newTitle: "منتج جديد",
    newDescription:
      "الاسم والوصف وصورة واحدة والسعر مطلوبة. أضف متغيرات وعروضًا ومجموعات أخرى بعد إنشائه.",
    products: "المنتجات",
    product: "المنتج",
    noActiveVariant: "أضف متغيرًا حتى يتمكن العملاء من شراء هذا المنتج.",
    noActiveVariantArchived:
      "لا يوجد متغير نشط لهذا المنتج. بعد استعادته، أضف متغيرًا أو فعّل متغيرًا حتى يتمكن العملاء من شرائه.",
  },
} satisfies Messages;

export function ProductEditPage() {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
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
          title={t.newTitle}
          back={{ to: "/catalog", label: t.products }}
          description={t.newDescription}
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
  const hasActiveVariant = (data?.variants ?? []).some((v) => v.status === "active");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={data?.name ?? t.product}
        titleMeta={formatProductCode(data?.productCode) ?? undefined}
        back={{ to: "/catalog", label: t.products }}
        actions={data && <StatusBadge value={data.status} text={labels.status(data.status)} />}
      />

      <DataState loading={product.loading} error={product.error} onRetry={() => product.refresh()}>
        {data && (
          <div className="space-y-6">
            {!hasActiveVariant && (
              <p
                role="status"
                className="rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-medium text-accent-dark"
              >
                {data.status === "archived" ? t.noActiveVariantArchived : t.noActiveVariant}
              </p>
            )}
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
