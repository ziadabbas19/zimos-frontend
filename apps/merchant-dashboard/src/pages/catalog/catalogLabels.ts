import { useMemo } from "react";
import type { CatalogEntityStatus, ProductStatus, ProductType } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

/** Status and type names shared by the catalog screens, in the active language. */
const LABELS = {
  en: {
    status_draft: "Draft",
    status_active: "Active",
    status_archived: "Archived",
    type_physical: "Physical",
    type_digital: "Digital",
    type_service: "Service",
    defaultOffer: "Default",
  },
  ar: {
    status_draft: "مسودة",
    status_active: "نشط",
    status_archived: "مؤرشف",
    type_physical: "منتج ملموس",
    type_digital: "منتج رقمي",
    type_service: "خدمة",
    defaultOffer: "افتراضي",
  },
} satisfies Messages;

export function useCatalogLabels() {
  const t = useT(LABELS);
  return useMemo(
    () => ({
      status: (s: ProductStatus | CatalogEntityStatus) => t[`status_${s}`],
      type: (type: ProductType) => t[`type_${type}`],
      defaultOffer: t.defaultOffer,
    }),
    [t]
  );
}
