import type { PageElement, PageElementType } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useEditorLocale } from "./editorLocale";

/**
 * Data binding in the editor.
 *
 * `BindingFields` — under an element's content: for each bindable prop, pick a
 * data source; it is stored as `props.bindings = { prop: source }` and the
 * storefront shows the live value in place of the typed one
 * (page-renderer/bindings.ts). The sources are the backend's closed list.
 *
 * `PageProductField` — the page's product (`tree.productId`), which product
 * bindings, repeaters and product elements without a product of their own
 * read from. Change it and the same page sells another product.
 */

const STRINGS = {
  en: {
    bind: "Bind",
    typed: "Use what is written in Content",
    hint: "The store shows the live value. What you wrote stays as a fallback.",
    "product.title": "Product — name",
    "product.description": "Product — description",
    "product.price": "Product — price",
    "product.compare_at": "Product — price before discount",
    "product.special_offer_text": "Product — special offer text",
    "product.images[0]": "Product — first image",
    "product.images[1]": "Product — second image",
    "product.images[2]": "Product — third image",
    "store.name": "Store — name",
    "store.phone": "Store — phone",
    "store.email": "Store — email",
    "store.address": "Store — address",
    "legal.refund_policy": "Refund policy",
    "legal.privacy_policy": "Privacy policy",
    "legal.terms_of_service": "Terms of service",
    "legal.shipping_policy": "Shipping policy",
    text: "Text",
    label: "Button text",
    src: "Image",
    alt: "Image description",
    pageProduct: "Page product",
    pageProductHint: "Bound fields, repeaters and product elements with no product of their own use this product.",
    newest: "The store's newest product",
  },
  ar: {
    bind: "ربط",
    typed: "استخدم ما هو مكتوب في تبويب المحتوى",
    hint: "المتجر يعرض القيمة الحقيقية. ما كتبته يبقى كبديل.",
    "product.title": "المنتج — الاسم",
    "product.description": "المنتج — الوصف",
    "product.price": "المنتج — السعر",
    "product.compare_at": "المنتج — السعر قبل الخصم",
    "product.special_offer_text": "المنتج — نص العرض الخاص",
    "product.images[0]": "المنتج — الصورة الأولى",
    "product.images[1]": "المنتج — الصورة الثانية",
    "product.images[2]": "المنتج — الصورة الثالثة",
    "store.name": "المتجر — الاسم",
    "store.phone": "المتجر — الهاتف",
    "store.email": "المتجر — البريد",
    "store.address": "المتجر — العنوان",
    "legal.refund_policy": "سياسة الاسترجاع",
    "legal.privacy_policy": "سياسة الخصوصية",
    "legal.terms_of_service": "شروط الخدمة",
    "legal.shipping_policy": "سياسة الشحن",
    text: "النص",
    label: "نص الزرار",
    src: "الصورة",
    alt: "وصف الصورة",
    pageProduct: "منتج الصفحة",
    pageProductHint: "الحقول المربوطة والـ repeater وعناصر المنتج التي لم يُحدد لها منتج تستخدم هذا المنتج.",
    newest: "أحدث منتج في المتجر",
  },
} as const;

const TEXT_SOURCES = [
  "product.title",
  "product.description",
  "product.price",
  "product.compare_at",
  "product.special_offer_text",
  "store.name",
  "store.phone",
  "store.email",
  "store.address",
  "legal.refund_policy",
  "legal.privacy_policy",
  "legal.terms_of_service",
  "legal.shipping_policy",
] as const;
const IMAGE_SOURCES = ["product.images[0]", "product.images[1]", "product.images[2]"] as const;

type PropKey = "text" | "label" | "src" | "alt";

/** Which props of which elements can be bound, and to what kind of source. */
const BINDABLE: Partial<Record<PageElementType, Array<{ key: PropKey; kind: "text" | "image" }>>> = {
  heading: [{ key: "text", kind: "text" }],
  text: [{ key: "text", kind: "text" }],
  rich_text: [{ key: "text", kind: "text" }],
  button: [{ key: "label", kind: "text" }],
  text_link: [{ key: "text", kind: "text" }],
  image: [
    { key: "src", kind: "image" },
    { key: "alt", kind: "text" },
  ],
};

/** Whether this kind of element has anything that can show live store data. */
export function canBind(type: PageElementType): boolean {
  return BINDABLE[type] !== undefined;
}

/** How many of the element's props are bound to live data. */
export function boundCount(element: PageElement): number {
  const raw = (element.props as Record<string, unknown> | undefined)?.bindings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  return Object.values(raw).filter((v) => typeof v === "string" && v !== "").length;
}

export function BindingFields({
  element,
  onChange,
}: {
  element: PageElement;
  /** Receives the next `props.bindings`, or undefined when nothing is bound any more. */
  onChange: (bindings: Record<string, string> | undefined) => void;
}) {
  const locale = useEditorLocale();
  const t = STRINGS[locale] as Record<string, string>;
  const slots = BINDABLE[element.type];
  if (!slots) return null;

  const raw = (element.props as Record<string, unknown> | undefined)?.bindings;
  const current = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

  return (
    <div data-slot="inspector-bindings" className="space-y-3">
      {slots.map(({ key, kind }) => (
        <Field key={key} label={`${t.bind}: ${t[key]}`}>
          {({ id }) => (
            <Select
              id={id}
              value={typeof current[key] === "string" ? (current[key] as string) : ""}
              onChange={(e) => {
                const next: Record<string, string> = {};
                for (const [k, v] of Object.entries(current)) {
                  if (typeof v === "string" && v && k !== key) next[k] = v;
                }
                if (e.target.value) next[key] = e.target.value;
                onChange(Object.keys(next).length > 0 ? next : undefined);
              }}
            >
              <option value="">{t.typed}</option>
              {(kind === "image" ? IMAGE_SOURCES : TEXT_SOURCES).map((source) => (
                <option key={source} value={source}>
                  {t[source]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ))}
      <p className="text-xs leading-5 text-ink-soft">{t.hint}</p>
    </div>
  );
}

export function PageProductField({ value, onChange }: { value: string; onChange: (productId: string) => void }) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const workspaceId = useWorkspaceId();
  // A role without catalogue access still edits the page; it just sees no list.
  const products = useAsync(
    () =>
      apiClient
        .listProducts(workspaceId, { status: "active", limit: 100 })
        .then((r) => r.products)
        .catch(() => []),
    [workspaceId]
  );
  const list = products.data ?? [];

  return (
    <div className="border-b border-line px-4 py-3">
      <Field label={t.pageProduct} hint={t.pageProductHint}>
        {({ id }) => (
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t.newest}</option>
            {/* Keeps a chosen product visible even when it is not in the first page of the list. */}
            {value && !list.some((p) => p.id === value) && <option value={value}>{value}</option>}
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
