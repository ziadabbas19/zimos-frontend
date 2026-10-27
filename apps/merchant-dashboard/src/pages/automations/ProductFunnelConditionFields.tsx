import { useMemo, useState } from "react";
import { funnelsList } from "@store-builder/api-client";
import { ZLoader } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    products: "Order has one of these products",
    funnels: "Order came from one of these funnels",
    anyProduct: "Any product",
    anyFunnel: "Any funnel or the store",
    chosen: "{n} chosen",
    search: "Search",
    empty: "Nothing to choose from yet.",
    noMatch: "No match.",
    noAccess: "You can't see this list.",
    failed: "Couldn't load the list.",
    gone: "{n} no longer exist",
    clear: "Clear",
  },
  ar: {
    products: "الطلب فيه أحد هذه المنتجات",
    funnels: "الطلب جاء من أحد هذه الأقماع",
    anyProduct: "أي منتج",
    anyFunnel: "أي قمع أو المتجر",
    chosen: "تم اختيار {n}",
    search: "بحث",
    empty: "لا يوجد ما تختار منه بعد.",
    noMatch: "لا نتائج.",
    noAccess: "لا يمكنك رؤية هذه القائمة.",
    failed: "تعذّر تحميل القائمة.",
    gone: "{n} لم تعد موجودة",
    clear: "مسح",
  },
} satisfies Messages;

type Item = { id: string; name: string };

/** Up to 300 of the store's products (three pages), for picking. */
async function loadProducts(workspaceId: string): Promise<Item[]> {
  const out: Item[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 3; page += 1) {
    const res = await apiClient.listProducts(workspaceId, { limit: 100, cursor, status: ["active", "draft"] });
    out.push(...res.products.map((p) => ({ id: p.id, name: p.name })));
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return out;
}

/**
 * The rule editor's "which products" and "which funnels" conditions (SPEC
 * §14.2; backend automations/automationContext.js reads productIds and
 * funnelIds). Nothing chosen = any. Ids of products or funnels deleted since
 * are kept until cleared, and counted.
 */
export function ProductFunnelConditionFields({
  productIds,
  funnelIds,
  onChange,
}: {
  productIds: string[];
  funnelIds: string[];
  onChange: (next: { productIds: string[]; funnelIds: string[] }) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const products = useAsync(() => loadProducts(workspaceId), [workspaceId]);
  const funnels = useAsync(async () => (await funnelsList(apiClient, workspaceId)).map((f) => ({ id: f.id, name: f.name })), [workspaceId]);
  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <PickList
        label={t.products}
        anyText={t.anyProduct}
        state={products}
        value={productIds}
        onChange={(ids) => onChange({ productIds: ids, funnelIds })}
      />
      <PickList
        label={t.funnels}
        anyText={t.anyFunnel}
        state={funnels}
        value={funnelIds}
        onChange={(ids) => onChange({ productIds, funnelIds: ids })}
      />
    </div>
  );
}

function PickList({
  label,
  anyText,
  state,
  value,
  onChange,
}: {
  label: string;
  anyText: string;
  state: { data: Item[] | null; loading: boolean; error: unknown };
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT(STRINGS);
  const [query, setQuery] = useState("");
  const chosen = useMemo(() => new Set(value), [value]);
  const items = state.data ?? [];
  const known = new Set(items.map((i) => i.id));
  const gone = state.data ? value.filter((id) => !known.has(id)).length : 0;
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-sm font-medium text-ink">
        <span>{label}</span>
        <span className="text-xs font-normal text-ink-soft">
          {value.length ? fmt(t.chosen, { n: value.length }) : anyText}
          {value.length > 0 && (
            <button type="button" className="ms-2 cursor-pointer text-primary hover:underline" onClick={() => onChange([])}>
              {t.clear}
            </button>
          )}
        </span>
      </legend>
      {state.loading && !state.data ? (
        <div className="flex justify-center rounded-[0.5rem] border border-line py-4 text-ink-soft">
          <ZLoader size="sm" />
        </div>
      ) : state.error ? (
        <p className="text-sm text-ink-soft">{isPermissionError(state.error) ? t.noAccess : t.failed}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <div className="rounded-[0.5rem] border border-line">
          {items.length > 8 && (
            <input
              type="search"
              aria-label={t.search}
              placeholder={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border-b border-line bg-transparent px-3 py-2 text-sm text-ink outline-none"
            />
          )}
          <ul className="max-h-44 space-y-0.5 overflow-y-auto p-2">
            {shown.length === 0 ? (
              <li className="px-1 py-1 text-sm text-ink-soft">{t.noMatch}</li>
            ) : (
              shown.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      checked={chosen.has(item.id)}
                      onChange={(e) => onChange(e.target.checked ? [...value, item.id] : value.filter((x) => x !== item.id))}
                    />
                    <span className="min-w-0 truncate" dir="auto">
                      {item.name}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {gone > 0 && <p className="mt-1 text-xs text-ink-soft">{fmt(t.gone, { n: gone })}</p>}
    </fieldset>
  );
}
