import { useState } from "react";
import { Input, Label, cn } from "@store-builder/ui";
import type { Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

/** Pieces the offer screens share: the store's products and the two product pickers. (The row of a rule is OfferKit's OfferRow.) */

const STRINGS = {
  en: {
    anyProduct: "Every product",
    search: "Search products",
    noMatch: "No products match.",
    selected: "{count} selected",
    loading: "Loading your products…",
  },
  ar: {
    anyProduct: "كل المنتجات",
    search: "ابحث في المنتجات",
    noMatch: "لا توجد منتجات مطابقة.",
    selected: "تم تحديد {count}",
    loading: "جارٍ تحميل منتجاتك…",
  },
} satisfies Messages;

/** The store's sellable products (first 200), loaded once per screen. */
export function useStoreProducts() {
  const workspaceId = useWorkspaceId();
  return useAsync(
    () => apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
}

/** One product, or "every product" (null). */
export function ProductSelect({
  id,
  label,
  hint,
  products,
  value,
  onChange,
  disabled,
  anyLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  products: Product[];
  value: string | null;
  onChange: (productId: string | null) => void;
  disabled?: boolean;
  anyLabel?: string;
}) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} className="h-11 text-base md:h-10 md:text-sm" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{anyLabel ?? t.anyProduct}</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/** Several products, as a searchable checklist: every line is a 44px target. */
export function ProductChecklist({
  label,
  hint,
  products,
  value,
  onChange,
  disabled,
  max,
  loading,
  className,
}: {
  label: string;
  hint?: string;
  products: Product[];
  value: string[];
  onChange: (productIds: string[]) => void;
  disabled?: boolean;
  max?: number;
  /** The products are still on their way: say so instead of "no products match". */
  loading?: boolean;
  className?: string;
}) {
  const t = useT(STRINGS);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q));
  const full = max !== undefined && value.length >= max;
  return (
    <fieldset className={cn("min-w-0 space-y-1.5", className)}>
      <legend className="text-sm font-medium text-ink">
        {label}
        {value.length > 0 && <span className="ms-2 text-xs font-normal text-ink-soft tabular-nums">{fmt(t.selected, { count: value.length })}</span>}
      </legend>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      <Input
        type="search"
        aria-label={t.search}
        placeholder={t.search}
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
        className="h-11 text-base md:h-10 md:text-sm"
      />
      <ul data-slot="offer-checklist" className="zimos-offer-checklist max-h-52 divide-y divide-line overflow-y-auto overscroll-contain rounded-[0.875rem] bg-paper-raised ring-1 ring-line">
        {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-soft">{loading ? t.loading : t.noMatch}</li>}
        {shown.map((p) => {
          const checked = value.includes(p.id);
          return (
            <li key={p.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm text-ink transition-[background-color] duration-[var(--dur-fade)] hover:bg-ink/4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 motion-reduce:transition-none">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 cursor-pointer accent-primary"
                  checked={checked}
                  disabled={disabled || (!checked && full)}
                  onChange={() => onChange(checked ? value.filter((x) => x !== p.id) : [...value, p.id])}
                />
                <span className="min-w-0 truncate">
                  <bdi>{p.name}</bdi>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
