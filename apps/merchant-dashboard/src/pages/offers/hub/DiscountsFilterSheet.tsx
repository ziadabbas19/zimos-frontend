import type { DiscountType } from "@store-builder/api-client";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { pluralOf } from "@/lib/plural";
import { useT } from "@/i18n/LocaleContext";
import { DiscountResultsBar, type DiscountResults } from "@/pages/discounts/DiscountResults";
import { DISCOUNT_STRINGS, DISCOUNT_TYPES, TYPE_LABEL } from "./discountModel";

export type DiscountKind = "code" | "automatic";

/**
 * The one place the discounts list is filtered: the kind of discount, a code
 * against an automatic one — and, for a role that reads analytics, the window
 * of days the result figures cover, with the report as a file. Filters take
 * effect as they change; the main button only closes the sheet.
 */
export function DiscountsFilterSheet({
  open,
  onOpenChange,
  type,
  onType,
  kind,
  onKind,
  onReset,
  shownCount,
  results,
  hasDiscounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DiscountType | null;
  onType: (type: DiscountType | null) => void;
  kind: DiscountKind | null;
  onKind: (kind: DiscountKind | null) => void;
  onReset: () => void;
  /** How many discounts the list shows now. */
  shownCount: number;
  results: DiscountResults;
  hasDiscounts: boolean;
}) {
  const t = useT(DISCOUNT_STRINGS);
  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      activeCount={(type ? 1 : 0) + (kind ? 1 : 0)}
      onReset={onReset}
      applyLabel={pluralOf(t, "show", shownCount)}
    >
      <FilterGroup label={t.filterType}>
        <FilterChoice<DiscountType>
          label={t.filterType}
          allowClear
          value={type}
          onChange={onType}
          options={DISCOUNT_TYPES.map((value) => ({ value, label: t[TYPE_LABEL[value]] }))}
        />
      </FilterGroup>
      <FilterGroup label={t.filterKind}>
        <FilterChoice<DiscountKind>
          label={t.filterKind}
          allowClear
          value={kind}
          onChange={onKind}
          options={[
            { value: "code", label: t.kind_code },
            { value: "automatic", label: t.kind_automatic },
          ]}
        />
      </FilterGroup>
      {/* Not a filter of the list: the days its result columns are counted over. Absent without analytics.view. */}
      {!results.denied && hasDiscounts && (
        <FilterGroup label={t.filterResults} hint={t.filterResultsHint}>
          <DiscountResultsBar results={results} bare />
        </FilterGroup>
      )}
    </FilterSheet>
  );
}
