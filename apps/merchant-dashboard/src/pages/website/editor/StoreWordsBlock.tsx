import { useState } from "react";
import { Button, Input } from "@store-builder/ui";
import { Segmented } from "@/components/Segmented";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useEditorLocale } from "./editorLocale";
import { LookBlock } from "./theme/parts";
import { XS_ONLY } from "./xsBlocks";

/**
 * The words on the store's own pages — a product's buttons and order form,
 * the catalogue, the cart and checkout — written the merchant's way, per
 * language (storefront lib/storeWords.ts, the same paths). Saved as
 * `themeSettings.storeWords`; a word left empty is the store's own (shown
 * as the field's placeholder).
 */

/** Each word's path and the storefront's own words for it, [English, Arabic] (lib/i18n.ts). */
export const STORE_WORD_DEFAULTS: Record<string, [string, string]> = {
  "product.orderNow": [
    "Order now",
    "اطلب الآن"
  ],
  "product.addToCart": [
    "Add to cart",
    "أضف للسلة"
  ],
  "product.stickyOrder": [
    "Order now — cash on delivery",
    "اطلب الآن — الدفع عند الاستلام"
  ],
  "product.quantity": [
    "Quantity",
    "الكمية"
  ],
  "common.inStock": [
    "In stock",
    "متوفر"
  ],
  "form.title": [
    "Order now — pay on delivery",
    "اطلب الآن — والدفع عند الاستلام"
  ],
  "form.subtitle": [
    "Fill in your details and we'll call you to confirm.",
    "اكتب بياناتك وهنتصل بيك لتأكيد الطلب."
  ],
  "form.phone": [
    "Mobile number",
    "رقم الموبايل"
  ],
  "form.governorate": [
    "Governorate",
    "المحافظة"
  ],
  "form.city": [
    "City / area",
    "المدينة / المنطقة"
  ],
  "form.notes": [
    "Notes",
    "ملاحظات"
  ],
  "form.total": [
    "Total",
    "الإجمالي"
  ],
  "form.submit": [
    "Confirm order",
    "تأكيد الطلب"
  ],
  "checkout.codHint": [
    "Pay the courier in cash when your order arrives.",
    "ادفع كاش للمندوب لما طلبك يوصل."
  ],
  "shop.details": [
    "Details",
    "التفاصيل"
  ],
  "shop.shippingReturns": [
    "Shipping & returns",
    "الشحن والاسترجاع"
  ],
  "catalog.allProducts": [
    "All products",
    "كل المنتجات"
  ],
  "catalog.sort": [
    "Sort by",
    "رتب حسب"
  ],
  "catalog.filters": [
    "Filters",
    "الفلاتر"
  ],
  "catalog.price": [
    "Price",
    "السعر"
  ],
  "catalog.related": [
    "Similar products you may like",
    "منتجات قريبة ممكن تعجبك"
  ],
  "cart.title": [
    "Your cart",
    "سلة التسوق"
  ],
  "cart.empty": [
    "Your cart is empty.",
    "سلة التسوق فاضية."
  ],
  "cart.emptyHint": [
    "Browse the store and add something you love.",
    "تصفح المتجر وضيف اللي يعجبك."
  ],
  "cart.checkout": [
    "Checkout",
    "إتمام الطلب"
  ],
  "checkout.title": [
    "Checkout",
    "إتمام الطلب"
  ],
  "common.continueShopping": [
    "Continue shopping",
    "متابعة التسوق"
  ]
};

const GROUPS = {
  "product": [
    "product.orderNow",
    "product.addToCart",
    "product.stickyOrder",
    "product.quantity",
    "common.inStock",
    "shop.details",
    "shop.shippingReturns"
  ],
  "form": [
    "form.title",
    "form.subtitle",
    "form.phone",
    "form.governorate",
    "form.city",
    "form.notes",
    "form.total",
    "form.submit",
    "checkout.codHint"
  ],
  "catalog": [
    "catalog.allProducts",
    "catalog.sort",
    "catalog.filters",
    "catalog.price",
    "catalog.related"
  ],
  "cart": [
    "cart.title",
    "cart.empty",
    "cart.emptyHint",
    "cart.checkout",
    "checkout.title",
    "common.continueShopping"
  ]
} as const;

type Blob = Record<string, unknown>;
type Lang = "ar" | "en";

/** One language's saved words, only the known paths. */
export function readStoreWordsOf(saved: unknown, lang: Lang): Record<string, string> {
  const all = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Blob) : {};
  const own = all[lang] && typeof all[lang] === "object" ? (all[lang] as Blob) : {};
  return Object.fromEntries(
    Object.entries(own).flatMap(([path, word]): Array<[string, string]> => (Object.hasOwn(STORE_WORD_DEFAULTS, path) && typeof word === "string" && word !== "" ? [[path, word]] : []))
  );
}

/** The saved blob with one word set (or emptied); undefined once nothing is the merchant's own. */
export function withStoreWord(saved: unknown, lang: Lang, path: string, word: string): Blob | undefined {
  const all = saved && typeof saved === "object" && !Array.isArray(saved) ? { ...(saved as Blob) } : {};
  const words = { ...readStoreWordsOf(saved, lang) };
  if (word === "") delete words[path];
  else words[path] = word;
  if (Object.keys(words).length > 0) all[lang] = words;
  else delete all[lang];
  return Object.keys(all).length > 0 ? all : undefined;
}

const UI = {
  en: {
    title: "Words on the shop pages",
    hint: "The product page, the order form, the catalogue, the cart and checkout. Empty keeps the store's own words.",
    groups: { product: "Product page", form: "Order form", catalog: "Catalogue", cart: "Cart and checkout" },
    reset: "Back to the store's own words",
  },
  ar: {
    title: "كلام صفحات المتجر",
    hint: "صفحة المنتج وفورم الطلب وصفحة المنتجات والسلة والدفع. الخانة الفاضية بتسيب كلام المتجر الأصلي.",
    groups: { product: "صفحة المنتج", form: "فورم الطلب", catalog: "صفحة المنتجات", cart: "السلة والدفع" },
    reset: "رجوع لكلام المتجر الأصلي",
  },
};

/**
 * Offered with an imported template's extras: on a store that wears one of
 * those templates (or while XS_ONLY is on). Any other store's look panel is as it was.
 */
export function StoreWordsBlock(props: { saved: unknown; onChange: (next: Blob | undefined, historyKey?: string) => void }) {
  const { currentWorkspace } = useWorkspace();
  const look = currentWorkspace?.themeSettings?.xsLook;
  if (!XS_ONLY && (typeof look !== "string" || look === "")) return null;
  return <StoreWordsFields {...props} />;
}

function StoreWordsFields({ saved, onChange }: { saved: unknown; onChange: (next: Blob | undefined, historyKey?: string) => void }) {
  const editor = useEditorLocale() === "ar" ? "ar" : "en";
  const ui = UI[editor];
  // The words of which of the store's languages are being written.
  const [lang, setLang] = useState<Lang>("ar");
  const words = readStoreWordsOf(saved, lang);
  return (
    <LookBlock title={ui.title} hint={ui.hint}>
      <Segmented<Lang>
        size="sm"
        label={ui.title}
        value={lang}
        onChange={setLang}
        options={[
          { value: "ar", label: "العربية" },
          { value: "en", label: "English" },
        ]}
      />
      {(Object.keys(GROUPS) as Array<keyof typeof GROUPS>).map((group) => (
        <details key={group} className="group rounded-[0.875rem] ring-1 ring-line">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm font-medium text-ink">{ui.groups[group]}</summary>
          <div className="space-y-2 px-3 pb-3">
            {GROUPS[group].map((path) => {
              const fallback = STORE_WORD_DEFAULTS[path][lang === "ar" ? 1 : 0];
              return (
                <label key={path} className="block space-y-1">
                  <span className="text-sm text-ink-soft" dir={lang === "ar" ? "rtl" : "ltr"}>
                    {fallback}
                  </span>
                  <Input
                    value={words[path] ?? ""}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                    maxLength={160}
                    placeholder={fallback}
                    className="h-9 text-sm"
                    onChange={(e) => onChange(withStoreWord(saved, lang, path, e.target.value), `store-words:${lang}:${path}`)}
                  />
                </label>
              );
            })}
          </div>
        </details>
      ))}
      {saved !== undefined && saved !== null && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(undefined)}>
          {ui.reset}
        </Button>
      )}
    </LookBlock>
  );
}
