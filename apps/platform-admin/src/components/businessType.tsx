import type { AdminWorkspaceOverview } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DetailRow } from "@/components/Drawer";

const STRINGS = {
  en: {
    label: "Sells",
    none: "Not answered",
    fashion: "Fashion & clothing",
    electronics: "Electronics & mobiles",
    beauty: "Beauty & care",
    food: "Food & drinks",
    home: "Home & furniture",
    accessories: "Accessories & jewelry",
    kids: "Kids & toys",
    sports: "Sports & fitness",
    services: "Services",
    other: "Other",
  },
  ar: {
    label: "يبيع",
    none: "بلا إجابة",
    fashion: "أزياء وملابس",
    electronics: "إلكترونيات وموبايلات",
    beauty: "تجميل وعناية",
    food: "أطعمة ومشروبات",
    home: "منزل وأثاث",
    accessories: "إكسسوارات ومجوهرات",
    kids: "أطفال وألعاب",
    sports: "رياضة ولياقة",
    services: "خدمات",
    other: "أخرى",
  },
} satisfies Messages;

/**
 * What the store said it sells on the store setup (migration 753), as a
 * read-only detail row: the choice, and the merchant's own words for "other".
 */
export function BusinessTypeRow({ workspace }: { workspace: Pick<AdminWorkspaceOverview, "businessType" | "businessTypeOther"> }) {
  const t = useT(STRINGS);
  const type = workspace.businessType;
  return (
    <DetailRow label={t.label}>
      {!type ? (
        <span className="text-ink-soft">{t.none}</span>
      ) : (
        <span>
          {t[type] ?? type}
          {type === "other" && workspace.businessTypeOther && (
            <span className="text-ink-soft" dir="auto">
              {" · "}
              {workspace.businessTypeOther}
            </span>
          )}
        </span>
      )}
    </DetailRow>
  );
}
