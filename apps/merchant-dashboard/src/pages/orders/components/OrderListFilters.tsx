import { useId, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { IconArrowDown, IconArrowUp } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  ORDER_SOURCES,
  funnelsList,
  ordersListTags,
  ordersManualOptions,
  type OrderListFilters,
  type OrderSource,
  type OrderTagCount,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, getLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { FilterChoice, FilterGroup } from "@/components/list";
import { useOrderLabels } from "../orderLabels";
import { placeName } from "@/lib/format";

const STRINGS = {
  en: {
    any: "Any",
    pair: "{name}: {value}",
    tag: "Tag",
    tagOption: "{tag} ({count})",
    source: "Source",
    payment: "Payment method",
    governorate: "Governorate",
    governoratePlaceholder: "e.g. Cairo",
    carrier: "Courier",
    carrierPlaceholder: "Courier name",
    seen: "Opened or not",
    seen_true: "Opened",
    seen_false: "Not opened yet",
    test: "Test orders",
    test_true: "Only test orders",
    test_false: "Without test orders",
    archived: "Archive",
    archived_exclude: "Without archived",
    archived_only: "Archived only",
    archived_include: "With archived",
    source_store: "Store",
    source_funnel: "Funnel",
    source_manual: "Manual",
    source_api: "API",
    source_import: "Import",
    source_upsell: "Upsell",
    columnsHint: "Tick the columns to show after the fixed ones and put them in your order. Kept on this device.",
    col_customer: "Customer",
    col_products: "Products",
    col_total: "Total",
    col_payment: "Payment",
    col_stage: "Stage",
    col_timeline: "Placed / confirmed",
    col_tags: "Tags",
    col_source: "Source",
    col_governorate: "Governorate",
    col_address: "Address",
    col_shipping: "Shipping",
    col_ipCountry: "IP country",
    col_dataQuality: "Data quality",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    product: "Product",
    funnel: "Funnel",
    dataQuality: "Data quality",
    dq_good: "Good",
    dq_low: "Poor",
    ipCountry: "IP country",
    ipCountryPlaceholder: "e.g. EG",
    discountCode: "Discount code",
    discountCodePlaceholder: "e.g. SAVE10",
    utmSource: "UTM source",
    utmSourcePlaceholder: "e.g. facebook",
    utmCampaign: "UTM campaign",
    utmCampaignPlaceholder: "Campaign name",
    groupOrder: "The order",
    groupOrderHint: "Tag, opened or not, test orders, archive",
    groupPayment: "Payment",
    groupPaymentHint: "Payment method, discount code",
    groupShipping: "Shipping and place",
    groupShippingHint: "Governorate, courier",
    groupProduct: "Product and source",
    groupProductHint: "Product, where the order came from, funnel",
    groupMarketing: "Marketing and data",
    groupMarketingHint: "UTM source and campaign, IP country, data quality",
  },
  ar: {
    any: "الكل",
    pair: "{name}: {value}",
    tag: "التاج",
    tagOption: "{tag} ({count})",
    source: "المصدر",
    payment: "طريقة الدفع",
    governorate: "المحافظة",
    governoratePlaceholder: "مثلًا Cairo",
    carrier: "شركة الشحن",
    carrierPlaceholder: "اسم شركة الشحن",
    seen: "المشاهدة",
    seen_true: "تم فتحه",
    seen_false: "لم يُفتح بعد",
    test: "الطلبات التجريبية",
    test_true: "التجريبية فقط",
    test_false: "بدون التجريبية",
    archived: "الأرشيف",
    archived_exclude: "بدون المؤرشفة",
    archived_only: "المؤرشفة فقط",
    archived_include: "مع المؤرشفة",
    source_store: "المتجر",
    source_funnel: "فانل",
    source_manual: "يدوي",
    source_api: "API",
    source_import: "استيراد",
    source_upsell: "عرض إضافي",
    columnsHint: "اختر الأعمدة التي تظهر بعد الأعمدة الثابتة ورتّبها كما تريد. تُحفظ على هذا الجهاز.",
    col_customer: "العميل",
    col_products: "المنتجات",
    col_total: "الإجمالي",
    col_payment: "الدفع",
    col_stage: "المرحلة",
    col_timeline: "الطلب / التأكيد",
    col_tags: "التاجز",
    col_source: "المصدر",
    col_governorate: "المحافظة",
    col_address: "العنوان",
    col_shipping: "الشحن",
    col_ipCountry: "دولة الـ IP",
    col_dataQuality: "جودة البيانات",
    moveUp: "تحريك {name} لأعلى",
    moveDown: "تحريك {name} لأسفل",
    product: "المنتج",
    funnel: "الفانل",
    dataQuality: "جودة البيانات",
    dq_good: "جيدة",
    dq_low: "ضعيفة",
    ipCountry: "دولة الـ IP",
    ipCountryPlaceholder: "مثلًا EG",
    discountCode: "كود الخصم",
    discountCodePlaceholder: "مثلًا SAVE10",
    utmSource: "مصدر UTM",
    utmSourcePlaceholder: "مثلًا facebook",
    utmCampaign: "حملة UTM",
    utmCampaignPlaceholder: "اسم الحملة",
    groupOrder: "الطلب نفسه",
    groupOrderHint: "التاج، الفتح، التجريبي، الأرشيف",
    groupPayment: "الدفع",
    groupPaymentHint: "طريقة الدفع، كود الخصم",
    groupShipping: "الشحن والمكان",
    groupShippingHint: "المحافظة، شركة الشحن",
    groupProduct: "المنتج والمصدر",
    groupProductHint: "المنتج، مصدر الطلب، مسار البيع",
    groupMarketing: "التسويق والبيانات",
    groupMarketingHint: "مصدر وحملة UTM، دولة عنوان IP، جودة البيانات",
  },
} satisfies Messages;

// ---------------------------------------------------------------- filters --

/** The fifteen filters of the Filters sheet, by their name in the URL. */
export const ORDER_FILTER_KEYS = [
  "tag",
  "source",
  "paymentMethod",
  "governorate",
  "carrier",
  "seen",
  "test",
  "archived",
  "productId",
  "funnelId",
  "dataQuality",
  "ipCountry",
  "discountCode",
  "utmSource",
  "utmCampaign",
] as const;
export type OrderFilterKey = (typeof ORDER_FILTER_KEYS)[number];
const PAYMENT_METHODS = ["cod", "card", "wallet", "valu", "kiosk", "bank_transfer"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The list's extra filters, kept in the URL next to stage / q / from / to
 * so a filtered list can be shared, saved as a view and survives a refresh.
 * Anything malformed in a hand-edited URL is dropped, never sent.
 */
export function useOrderExtraFilters() {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const text = (key: string, max: number) => (params.get(key) ?? "").trim().slice(0, max);
    const oneOf = <T extends string>(key: string, allowed: readonly T[]): T | "" => {
      const v = params.get(key);
      return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : "";
    };
    const matching = (key: string, pattern: RegExp) => {
      const v = (params.get(key) ?? "").trim();
      return pattern.test(v) ? v : "";
    };
    return {
      tag: text("tag", 40),
      source: oneOf("source", ORDER_SOURCES),
      paymentMethod: oneOf("paymentMethod", PAYMENT_METHODS),
      governorate: text("governorate", 100),
      carrier: text("carrier", 100),
      seen: oneOf("seen", ["true", "false"] as const),
      test: oneOf("test", ["true", "false"] as const),
      archived: oneOf("archived", ["only", "include"] as const),
      productId: matching("productId", UUID),
      funnelId: matching("funnelId", UUID),
      dataQuality: oneOf("dataQuality", ["good", "low"] as const),
      ipCountry: matching("ipCountry", /^[A-Za-z]{2}$/).toUpperCase(),
      discountCode: text("discountCode", 100),
      utmSource: text("utmSource", 100),
      utmCampaign: text("utmCampaign", 200),
    };
  }, [params]);

  const query: OrderListFilters = useMemo(
    () => ({
      tag: values.tag || undefined,
      source: (values.source || undefined) as OrderSource | undefined,
      paymentMethod: (values.paymentMethod || undefined) as OrderListFilters["paymentMethod"],
      governorate: values.governorate || undefined,
      carrier: values.carrier || undefined,
      seen: values.seen ? values.seen === "true" : undefined,
      test: values.test ? values.test === "true" : undefined,
      archived: values.archived || undefined,
      productId: values.productId || undefined,
      funnelId: values.funnelId || undefined,
      dataQuality: values.dataQuality || undefined,
      ipCountry: values.ipCountry || undefined,
      discountCode: values.discountCode || undefined,
      utmSource: values.utmSource || undefined,
      utmCampaign: values.utmCampaign || undefined,
    }),
    [values]
  );

  function update(patch: Partial<Record<OrderFilterKey, string | null>>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }

  const active = ORDER_FILTER_KEYS.filter((key) => values[key]);
  return {
    values,
    query,
    /** Stable string of the active filters, for effect dependencies. */
    key: active.map((k) => `${k}=${values[k]}`).join("&"),
    active,
    update,
    clear: () => update(Object.fromEntries(ORDER_FILTER_KEYS.map((k) => [k, null]))),
  };
}

export type OrderExtraFilters = ReturnType<typeof useOrderExtraFilters>;

// ---------------------------------------------------- columns, page size --

export const OPTIONAL_COLUMNS = [
  "customer",
  "products",
  "total",
  "payment",
  "stage",
  "timeline",
  "tags",
  "source",
  "governorate",
  "address",
  "shipping",
  "ipCountry",
  "dataQuality",
] as const;
export type OrderColumn = (typeof OPTIONAL_COLUMNS)[number];
/**
 * What the table always shows now, in its fixed leading columns (customer,
 * amount, status, place): choosing one of these again would only print it
 * twice, so the chooser no longer offers them and the table skips them.
 */
const ALWAYS_SHOWN: readonly OrderColumn[] = ["customer", "total", "stage", "governorate"];
/** The columns a merchant can add after the fixed ones, in the chooser's order. */
export const CHOOSABLE_COLUMNS: readonly OrderColumn[] = OPTIONAL_COLUMNS.filter((c) => !ALWAYS_SHOWN.includes(c));
const DEFAULT_COLUMNS: OrderColumn[] = ["products"];
export const PAGE_SIZES = [25, 50, 100] as const;

/** The merchant's optional columns as the table draws them: theirs, in their order, without the fixed ones. */
export function shownOrderColumns(columns: readonly OrderColumn[]): OrderColumn[] {
  return columns.filter((c) => !ALWAYS_SHOWN.includes(c));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** Which columns the table shows and how many rows a page holds, per workspace on this device. */
export function useOrderListPrefs() {
  const workspaceId = useWorkspaceId();
  const columnsKey = `zimos.orders.columns.${workspaceId}`;
  const sizeKey = `zimos.orders.pageSize.${workspaceId}`;
  const [columns, setColumnsState] = useState<OrderColumn[]>(() => {
    const stored = readJson<unknown>(columnsKey, DEFAULT_COLUMNS);
    const list: OrderColumn[] = Array.isArray(stored) ? (stored as OrderColumn[]) : DEFAULT_COLUMNS;
    return list.filter((c) => OPTIONAL_COLUMNS.includes(c));
  });
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const stored = readJson<number>(sizeKey, 50);
    return (PAGE_SIZES as readonly number[]).includes(stored) ? stored : 50;
  });
  return {
    columns,
    setColumns: (next: OrderColumn[]) => {
      // In the merchant's order (the chooser moves them); unknown ones dropped.
      const ordered = next.filter((c, i) => OPTIONAL_COLUMNS.includes(c) && next.indexOf(c) === i);
      setColumnsState(ordered);
      writeJson(columnsKey, ordered);
    },
    pageSize,
    setPageSize: (next: number) => {
      setPageSizeState(next);
      writeJson(sizeKey, next);
    },
  };
}

export type OrderListPrefs = ReturnType<typeof useOrderListPrefs>;

export function useColumnLabel() {
  const t = useT(STRINGS);
  return (column: OrderColumn) => t[`col_${column}`];
}

export function useSourceLabel() {
  const t = useT(STRINGS);
  return (source: OrderSource) => t[`source_${source}`];
}

// ------------------------------------------------- what the pickers offer --

interface NamedOption {
  id: string;
  name: string;
}

/**
 * The lists the pickers choose from: the store's tags, its governorates, its
 * first hundred products and its funnels. Asked for only once `enabled` (the
 * Filters sheet was opened, or the link already filters by a product or a
 * funnel whose name the chip has to say), not on every visit to the list.
 * A list this role may not read comes back empty — or, for governorates, null:
 * the field is then typed, not picked.
 */
export function useOrderFilterOptions(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(async () => {
    if (!enabled) return null;
    const [tags, governorates, products, funnels] = await Promise.all([
      ordersListTags(apiClient, workspaceId).catch(() => [] as OrderTagCount[]),
      ordersManualOptions(apiClient, workspaceId)
        .then((o) => o.governorates)
        .catch(() => null),
      apiClient
        .listProducts(workspaceId, { limit: 100 })
        .then((r): NamedOption[] => r.products.map((p) => ({ id: p.id, name: p.name })))
        .catch(() => [] as NamedOption[]),
      funnelsList(apiClient, workspaceId)
        .then((list): NamedOption[] => list.map((f) => ({ id: f.id, name: f.name })))
        .catch(() => [] as NamedOption[]),
    ]);
    return { tags, governorates, products, funnels };
  }, [workspaceId, enabled]);
  return loaded.data;
}

export type OrderFilterOptions = NonNullable<ReturnType<typeof useOrderFilterOptions>>;

// ------------------------------------------------------------------ chips --

/** The filters in effect, each as the words of its chip under the toolbar. */
export function useOrderFilterChips(
  filters: OrderExtraFilters,
  options: OrderFilterOptions | null
): Array<{ key: OrderFilterKey; label: string }> {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const { values } = filters;
  const pair = (name: string, value: string) => fmt(t.pair, { name, value });
  const productName = (id: string) => options?.products.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const funnelName = (id: string) => options?.funnels.find((f) => f.id === id)?.name ?? id.slice(0, 8);

  const text: Record<OrderFilterKey, () => string> = {
    tag: () => pair(t.tag, values.tag),
    source: () => pair(t.source, values.source ? t[`source_${values.source}`] : ""),
    paymentMethod: () => pair(t.payment, values.paymentMethod ? labels.paymentMethod(values.paymentMethod) : ""),
    governorate: () => pair(t.governorate, placeName(values.governorate)),
    carrier: () => pair(t.carrier, values.carrier),
    seen: () => (values.seen === "true" ? t.seen_true : t.seen_false),
    test: () => (values.test === "true" ? t.test_true : t.test_false),
    archived: () => (values.archived === "only" ? t.archived_only : t.archived_include),
    productId: () => pair(t.product, productName(values.productId)),
    funnelId: () => pair(t.funnel, funnelName(values.funnelId)),
    dataQuality: () => pair(t.dataQuality, values.dataQuality === "low" ? t.dq_low : t.dq_good),
    ipCountry: () => pair(t.ipCountry, values.ipCountry),
    discountCode: () => pair(t.discountCode, values.discountCode),
    utmSource: () => pair(t.utmSource, values.utmSource),
    utmCampaign: () => pair(t.utmCampaign, values.utmCampaign),
  };
  return filters.active.map((key) => ({ key, label: text[key]() }));
}

// ------------------------------------------------ the groups in the sheet --

const FIELD_LABEL = "mb-1.5 block text-xs leading-4 font-medium text-ink-soft";

/** A field of a filter group under its small name. `htmlFor` for a real field; a row of pills names itself. */
function Labelled({ label, htmlFor, wide, children }: { label: string; htmlFor?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      {htmlFor ? (
        <label htmlFor={htmlFor} data-slot="filter-hint" className={FIELD_LABEL}>
          {label}
        </label>
      ) : (
        <p data-slot="filter-hint" className={FIELD_LABEL}>
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * The fifteen filters as five folding groups of the Filters sheet (FilterSheet
 * of the list kit). Each takes effect as it changes — a pill or a select at
 * once, a typed field when the merchant leaves it or presses Enter — and a
 * group that already filters the list arrives open.
 */
export function OrderExtraFilterGroups({
  filters,
  options,
  onChange,
}: {
  filters: OrderExtraFilters;
  options: OrderFilterOptions | null;
  /** One write to the URL per change. */
  onChange: (patch: Partial<Record<OrderFilterKey, string | null>>) => void;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const { values } = filters;
  const ids = {
    tag: useId(),
    gov: useId(),
    carrier: useId(),
    product: useId(),
    funnel: useId(),
    ip: useId(),
    code: useId(),
    utmS: useId(),
    utmC: useId(),
  };
  const tags = options?.tags ?? [];
  const governorates = options?.governorates ?? null;
  const products = options?.products ?? [];
  const funnels = options?.funnels ?? [];
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const funnelName = (id: string) => funnels.find((f) => f.id === id)?.name ?? id.slice(0, 8);
  const on = (...keys: OrderFilterKey[]) => keys.some((key) => Boolean(values[key]));
  const fields = "grid gap-4 sm:grid-cols-2";

  return (
    <>
      <FilterGroup collapsible defaultOpen={on("tag", "seen", "test", "archived")} label={t.groupOrder} hint={t.groupOrderHint}>
        <div className={fields}>
          <Labelled label={t.tag} htmlFor={ids.tag} wide>
            <Select id={ids.tag} value={values.tag} onChange={(e) => onChange({ tag: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              {values.tag && !tags.some((x) => x.tag === values.tag) && <option value={values.tag}>{values.tag}</option>}
              {tags.map((x) => (
                <option key={x.tag} value={x.tag}>
                  {fmt(t.tagOption, { tag: x.tag, count: x.count })}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label={t.seen} wide>
            <FilterChoice
              label={t.seen}
              allowClear
              value={values.seen || null}
              onChange={(next) => onChange({ seen: next })}
              options={[
                { value: "false", label: t.seen_false },
                { value: "true", label: t.seen_true },
              ]}
            />
          </Labelled>
          <Labelled label={t.test} wide>
            <FilterChoice
              label={t.test}
              allowClear
              value={values.test || null}
              onChange={(next) => onChange({ test: next })}
              options={[
                { value: "false", label: t.test_false },
                { value: "true", label: t.test_true },
              ]}
            />
          </Labelled>
          <Labelled label={t.archived} wide>
            <FilterChoice
              label={t.archived}
              value={values.archived || "exclude"}
              onChange={(next) => onChange({ archived: next === null || next === "exclude" ? null : next })}
              options={[
                { value: "exclude", label: t.archived_exclude },
                { value: "only", label: t.archived_only },
                { value: "include", label: t.archived_include },
              ]}
            />
          </Labelled>
        </div>
      </FilterGroup>

      <FilterGroup collapsible defaultOpen={on("paymentMethod", "discountCode")} label={t.groupPayment} hint={t.groupPaymentHint}>
        <div className={fields}>
          <Labelled label={t.payment} wide>
            <FilterChoice
              label={t.payment}
              allowClear
              value={values.paymentMethod || null}
              onChange={(next) => onChange({ paymentMethod: next })}
              options={PAYMENT_METHODS.map((method) => ({ value: method, label: labels.paymentMethod(method) }))}
            />
          </Labelled>
          <DebouncedText
            id={ids.code}
            label={t.discountCode}
            placeholder={t.discountCodePlaceholder}
            value={values.discountCode}
            onCommit={(v) => onChange({ discountCode: v || null })}
          />
        </div>
      </FilterGroup>

      <FilterGroup collapsible defaultOpen={on("governorate", "carrier")} label={t.groupShipping} hint={t.groupShippingHint}>
        <div className={fields}>
          {/* The governorate filter matches the saved value exactly ("القاهرة (Cairo)"), so it is picked
              from the list, not typed; a role that can't read the list types it as before. */}
          {governorates && governorates.length > 0 ? (
            <Labelled label={t.governorate} htmlFor={ids.gov}>
              <Select
                id={ids.gov}
                value={values.governorate}
                onChange={(e) => onChange({ governorate: e.target.value || null })}
                className="h-11"
              >
                <option value="">{t.any}</option>
                {values.governorate && !governorates.some((g) => `${g.ar} (${g.en})` === values.governorate) && (
                  <option value={values.governorate}>{placeName(values.governorate)}</option>
                )}
                {governorates.map((g) => (
                  <option key={g.code} value={`${g.ar} (${g.en})`}>
                    {getLocale() === "ar" ? g.ar : g.en}
                  </option>
                ))}
              </Select>
            </Labelled>
          ) : (
            <DebouncedText
              id={ids.gov}
              label={t.governorate}
              placeholder={t.governoratePlaceholder}
              value={values.governorate}
              onCommit={(v) => onChange({ governorate: v || null })}
            />
          )}
          <DebouncedText
            id={ids.carrier}
            label={t.carrier}
            placeholder={t.carrierPlaceholder}
            value={values.carrier}
            onCommit={(v) => onChange({ carrier: v || null })}
          />
        </div>
      </FilterGroup>

      <FilterGroup collapsible defaultOpen={on("productId", "source", "funnelId")} label={t.groupProduct} hint={t.groupProductHint}>
        <div className={fields}>
          <Labelled label={t.product} htmlFor={ids.product}>
            <Select
              id={ids.product}
              value={values.productId}
              onChange={(e) => onChange({ productId: e.target.value || null })}
              className="h-11"
            >
              <option value="">{t.any}</option>
              {values.productId && !products.some((p) => p.id === values.productId) && (
                <option value={values.productId}>{productName(values.productId)}</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label={t.funnel} htmlFor={ids.funnel}>
            <Select id={ids.funnel} value={values.funnelId} onChange={(e) => onChange({ funnelId: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              {values.funnelId && !funnels.some((f) => f.id === values.funnelId) && (
                <option value={values.funnelId}>{funnelName(values.funnelId)}</option>
              )}
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label={t.source} wide>
            <FilterChoice
              label={t.source}
              allowClear
              value={values.source || null}
              onChange={(next) => onChange({ source: next })}
              options={ORDER_SOURCES.map((source) => ({ value: source, label: t[`source_${source}`] }))}
            />
          </Labelled>
        </div>
      </FilterGroup>

      <FilterGroup
        collapsible
        defaultOpen={on("utmSource", "utmCampaign", "ipCountry", "dataQuality")}
        label={t.groupMarketing}
        hint={t.groupMarketingHint}
      >
        <div className={fields}>
          <DebouncedText
            id={ids.utmS}
            label={t.utmSource}
            placeholder={t.utmSourcePlaceholder}
            value={values.utmSource}
            onCommit={(v) => onChange({ utmSource: v || null })}
          />
          <DebouncedText
            id={ids.utmC}
            label={t.utmCampaign}
            placeholder={t.utmCampaignPlaceholder}
            value={values.utmCampaign}
            maxLength={200}
            onCommit={(v) => onChange({ utmCampaign: v || null })}
          />
          <DebouncedText
            id={ids.ip}
            label={t.ipCountry}
            placeholder={t.ipCountryPlaceholder}
            value={values.ipCountry}
            maxLength={2}
            onCommit={(v) => onChange({ ipCountry: /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null })}
          />
          <Labelled label={t.dataQuality}>
            <FilterChoice
              label={t.dataQuality}
              allowClear
              value={values.dataQuality || null}
              onChange={(next) => onChange({ dataQuality: next })}
              options={[
                { value: "good", label: t.dq_good },
                { value: "low", label: t.dq_low },
              ]}
            />
          </Labelled>
        </div>
      </FilterGroup>
    </>
  );
}

// --------------------------------------------------------- column chooser --

/**
 * The table's optional columns: the shown ones first, in the table's order
 * (each can be moved up or down), then the rest. Ticking adds a column at the
 * end, un-ticking removes it; the choice is saved at once, per store, on this
 * device (`zimos.orders.columns.<store>`).
 */
export function OrderColumnChooser({ prefs }: { prefs: OrderListPrefs }) {
  const t = useT(STRINGS);
  const shown = shownOrderColumns(prefs.columns);
  return (
    <>
      <p data-slot="filter-hint" className="mb-2 text-xs leading-4 text-ink-soft">
        {t.columnsHint}
      </p>
      <ul className="grid gap-1">
        {[...shown, ...CHOOSABLE_COLUMNS.filter((c) => !shown.includes(c))].map((column) => {
          const checked = shown.includes(column);
          const at = shown.indexOf(column);
          const move = (by: number) => {
            const next = [...shown];
            next.splice(at, 1);
            next.splice(at + by, 0, column);
            prefs.setColumns(next);
          };
          return (
            <li key={column} className="flex items-center gap-1">
              {checked && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-11 rounded-full"
                    disabled={at === 0}
                    aria-label={fmt(t.moveUp, { name: t[`col_${column}`] })}
                    onClick={() => move(-1)}
                  >
                    <IconArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-11 rounded-full"
                    disabled={at === shown.length - 1}
                    aria-label={fmt(t.moveDown, { name: t[`col_${column}`] })}
                    onClick={() => move(1)}
                  >
                    <IconArrowDown className="size-4" aria-hidden />
                  </Button>
                </>
              )}
              <label className={cn("flex min-h-11 flex-1 cursor-pointer items-center gap-2 text-sm text-ink", !checked && "ps-[5.75rem]")}>
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  onChange={() => prefs.setColumns(checked ? shown.filter((c) => c !== column) : [...shown, column])}
                />
                {t[`col_${column}`]}
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ------------------------------------------------------------- text field --

/** A text filter that reaches the URL when the merchant leaves the field or presses Enter. */
function DebouncedText({
  id,
  label,
  placeholder,
  value,
  maxLength = 100,
  onCommit,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength?: number;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (draft.trim() !== value) setDraft(value);
  }
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
  };
  return (
    <Labelled label={label} htmlFor={id}>
      <Input
        id={id}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="h-11"
      />
    </Labelled>
  );
}
