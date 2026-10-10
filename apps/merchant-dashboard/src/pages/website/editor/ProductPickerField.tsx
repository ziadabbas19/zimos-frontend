import { useEffect, useMemo, useState } from "react";
import { IconExternal, IconSearch } from "@/components/icons";
import { Input } from "@store-builder/ui";
import type { ProductListParams } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useEditorLocale } from "./editorLocale";

const STRINGS = {
  en: {
    search: "Search products",
    searchCollections: "Search collections",
    none: "Not set",
    draft: "draft",
    archived: "archived",
    loading: "Loading…",
    failed: "Couldn't load the list. The current value is kept.",
    noMatch: "Nothing matches.",
    unknown: "Saved value: {value}",
    editProduct: "Edit product",
    editCollections: "Edit collections",
  },
  ar: {
    search: "ابحث عن منتج",
    searchCollections: "ابحث عن مجموعة",
    none: "غير محدّد",
    draft: "مسودة",
    archived: "مؤرشف",
    loading: "جارٍ التحميل…",
    failed: "تعذّر تحميل القائمة. القيمة الحالية محفوظة كما هي.",
    noMatch: "لا توجد نتائج.",
    unknown: "القيمة المحفوظة: {value}",
    editProduct: "تعديل المنتج",
    editCollections: "تعديل المجموعات",
  },
};

interface Option {
  value: string;
  label: string;
}

/**
 * The builder's product / collection field (SPEC §9.3: pick from the store's
 * own catalogue instead of pasting an id), with a link to edit what is
 * picked. Stores the id as before; an older value (an id or a slug typed by
 * hand) is kept and still shown, by name when it can be found.
 */
export function ProductPickerField({
  kind,
  label,
  hint,
  value,
  onChange,
}: {
  kind: "product" | "collection";
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const locale = useEditorLocale();
  const t = locale === "ar" ? STRINGS.ar : STRINGS.en;
  const workspaceId = useWorkspaceId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const list = useAsync<Option[]>(async () => {
    if (kind === "collection") {
      const collections = await apiClient.listCollections(workspaceId);
      return collections.map((c) => ({ value: c.id, label: c.name }));
    }
    // The catalogue's own search (name or a variant's SKU).
    const { products } = await apiClient.listProducts(workspaceId, { limit: 50, status: ["active", "draft"], q: debounced || undefined } as ProductListParams);
    return products.map((p) => ({
      value: p.id,
      label: p.status === "active" ? p.name : `${p.name} (${p.status === "draft" ? t.draft : t.archived})`,
    }));
  }, [workspaceId, kind, kind === "product" ? debounced : ""]);

  // The saved product when the list (first 50, or a search) does not hold it.
  const current = useAsync<Option | null>(async () => {
    if (kind !== "product" || !value || !/^[0-9a-f-]{36}$/i.test(value)) return null;
    const product = await apiClient.getProduct(workspaceId, value).catch(() => null);
    return product ? { value: product.id, label: product.name } : null;
  }, [workspaceId, kind, value]);

  const options = useMemo(() => {
    const filtered =
      kind === "collection" && query.trim()
        ? (list.data ?? []).filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
        : (list.data ?? []);
    if (value && !filtered.some((o) => o.value === value)) {
      const known = current.data ?? (list.data ?? []).find((o) => o.value === value) ?? null;
      return [known ?? { value, label: t.unknown.replace("{value}", value) }, ...filtered];
    }
    return filtered;
  }, [list.data, current.data, value, query, kind, t.unknown]);

  const editHref = kind === "product" ? (value && /^[0-9a-f-]{36}$/i.test(value) ? `/catalog/${value}` : null) : "/catalog/collections";

  return (
    <Field label={label} hint={hint}>
      {({ id }) => (
        <div className="space-y-2">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === "product" ? t.search : t.searchCollections}
              aria-label={kind === "product" ? t.search : t.searchCollections}
              className="ps-8"
            />
          </div>
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t.none}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {list.loading && !list.data && <p className="text-xs text-ink-soft">{t.loading}</p>}
          {Boolean(list.error) && <p className="text-xs text-danger">{t.failed}</p>}
          {list.data && options.length === 0 && query.trim() && <p className="text-xs text-ink-soft">{t.noMatch}</p>}
          {editHref && (kind === "collection" || value) && (
            <a
              href={editHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center gap-1 rounded-[0.5rem] text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-11"
            >
              <IconExternal className="size-3.5" aria-hidden />
              {kind === "product" ? t.editProduct : t.editCollections}
            </a>
          )}
        </div>
      )}
    </Field>
  );
}
