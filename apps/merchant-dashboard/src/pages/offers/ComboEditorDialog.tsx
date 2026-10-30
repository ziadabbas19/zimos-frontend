import { useEffect, useRef, useState } from "react";
import { IconDelete, IconPlus } from "@/components/icons";
import { Button, Input, Label, cn } from "@store-builder/ui";
import {
  apiErrorCode,
  apiErrorDetails,
  combosCreate,
  combosPreview,
  combosUpdate,
  type ComboDto,
  type ComboItemInput,
  type ComboPayload,
  type ComboPricingMode,
  type ComboStatus,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  basisPointsToPercentInput,
  formatMoney,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
  variantLabel,
} from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ImageField } from "@/pages/website/editor/ImageField";
import { FormProblem, OfferPreview, SheetActions, TOUCH_FIELD, focusFirstInvalid } from "./OfferKit";
import { ProductChecklist, ProductSelect } from "./OfferRuleParts";

/**
 * Creating or editing a combo: different products sold together at one price
 * (backend modules/combos, PRODUCT_COMBOS_ENABLED). Its name, words and
 * picture, whether it is live, its products — each at a set option or one the
 * customer picks, with a quantity — and its price: a fixed price, a percentage
 * off or an amount off what the products cost apart. Under it the server
 * prices the draft live (combosPreview), and says in words why it would refuse
 * it. The products are always sent whole.
 */

const STRINGS = {
  en: {
    createTitle: "New combo",
    editTitle: "Edit combo",
    description: "Different products sold together at one price. The customer adds the whole combo in one tap.",
    name: "Combo name",
    namePlaceholder: "Breakfast for two",
    nameRequired: "Write a name for the combo.",
    about: "Description",
    aboutPlaceholder: "What is in it and why it is a good deal",
    picture: "Picture",
    status: "Status",
    status_draft: "Draft — not in the store yet",
    status_active: "Active — shown in the store",
    status_archived: "Archived",
    items: "Products in the combo",
    itemsHint: "From 2 to 10, at least two different products.",
    item: "Item {n}",
    product: "Product",
    chooseProduct: "Choose a product…",
    option: "Option",
    chooseOption: "Choose an option…",
    customerPicks: "The customer picks",
    optionGone: "An option no longer for sale",
    noOptions: "This product has no option for sale.",
    quantity: "Quantity",
    remove: "Remove item {n}",
    addItem: "Add a product",
    itemFix: "Choose the product, its option, and a quantity from 1 to 100.",
    itemsInvalid: "Some products of the combo need fixing.",
    pricing: "Price",
    mode_fixed_price: "Fixed price",
    mode_percent_off: "Percentage off",
    mode_amount_off: "Amount off",
    value_fixed_price: "Price of the whole combo",
    value_percent_off: "Percentage off (%)",
    value_amount_off: "Amount off the products",
    priceFix_fixed_price: "Write the combo's price.",
    priceFix_percent_off: "Write a percentage from 0.01 to 100.",
    priceFix_amount_off: "Write the amount off.",
    preview: "The price",
    previewLine: "Products apart: {full} — Combo: {total} — Saving: {saving}",
    previewPick: "Where the customer picks the option, from its cheapest option.",
    previewIncomplete: "Choose the products and the price to see what the combo costs.",
    previewPricing: "Working out the price…",
    previewFailed: "The price could not be worked out. Check the products and the price.",
    showEverywhere: "Show it on the page of every product in it",
    showOn: "Show it on these product pages",
    showOnHint: "Up to 50 products.",
    showOnRequired: "Choose at least one product page, or show it on every product in it.",
    COMBO_PRICE_ABOVE_TOTAL: "The combo cannot cost more than its products bought apart ({total}).",
    comboAmountTooHigh: "The amount off must be less than what the products cost apart ({total}).",
    COMBO_NEEDS_TWO_PRODUCTS: "A combo needs at least two different products.",
    COMBO_PRODUCT_NEEDS_INPUT: "A product that asks the customer for details (a required field or a required menu choice) cannot be in a combo.",
    comboProductNeedsInputNamed: "“{name}” asks the customer for details (a required field or a required menu choice), so it cannot be in a combo.",
    COMBO_VARIANT_REQUIRED: "Choose the option of every product, or let the customer pick it.",
    save: "Save combo",
    created: "Combo created.",
    saved: "Combo saved.",
  },
  ar: {
    createTitle: "باقة منتجات جديدة",
    editTitle: "تعديل الباقة",
    description: "منتجات مختلفة تُباع معًا بسعر واحد. يضيف العميل الباقة كاملة بضغطة واحدة.",
    name: "اسم الباقة",
    namePlaceholder: "فطور لشخصين",
    nameRequired: "اكتب اسمًا للباقة.",
    about: "الوصف",
    aboutPlaceholder: "ما الذي تحتويه ولماذا هي صفقة جيدة",
    picture: "الصورة",
    status: "الحالة",
    status_draft: "مسودة — لا تظهر في المتجر بعد",
    status_active: "مفعّلة — تظهر في المتجر",
    status_archived: "مؤرشفة",
    items: "منتجات الباقة",
    itemsHint: "من 2 إلى 10، منها منتجان مختلفان على الأقل.",
    item: "العنصر {n}",
    product: "المنتج",
    chooseProduct: "اختر منتجًا…",
    option: "الخيار",
    chooseOption: "اختر خيارًا…",
    customerPicks: "يختار العميل",
    optionGone: "خيار لم يعد متاحًا للبيع",
    noOptions: "لا يوجد لهذا المنتج خيار متاح للبيع.",
    quantity: "الكمية",
    remove: "حذف العنصر {n}",
    addItem: "إضافة منتج",
    itemFix: "اختر المنتج وخياره، وكمية من 1 إلى 100.",
    itemsInvalid: "بعض منتجات الباقة تحتاج إلى تصحيح.",
    pricing: "السعر",
    mode_fixed_price: "سعر ثابت",
    mode_percent_off: "خصم بنسبة",
    mode_amount_off: "خصم بمبلغ",
    value_fixed_price: "سعر الباقة كاملة",
    value_percent_off: "نسبة الخصم (%)",
    value_amount_off: "مبلغ الخصم من المنتجات",
    priceFix_fixed_price: "اكتب سعر الباقة.",
    priceFix_percent_off: "اكتب نسبة من 0.01 إلى 100.",
    priceFix_amount_off: "اكتب مبلغ الخصم.",
    preview: "السعر",
    previewLine: "المنتجات منفصلة: {full} — الباقة: {total} — التوفير: {saving}",
    previewPick: "حيث يختار العميل الخيار، يُحسب السعر من أرخص خيار.",
    previewIncomplete: "اختر المنتجات والسعر لعرض سعر الباقة.",
    previewPricing: "جارٍ حساب السعر…",
    previewFailed: "تعذّر حساب السعر. راجع المنتجات والسعر.",
    showEverywhere: "اعرضها في صفحة كل منتج فيها",
    showOn: "اعرضها في صفحات هذه المنتجات",
    showOnHint: "حتى 50 منتجًا.",
    showOnRequired: "اختر صفحة منتج واحدة على الأقل، أو اعرضها في صفحة كل منتج فيها.",
    COMBO_PRICE_ABOVE_TOTAL: "لا يمكن أن يزيد سعر الباقة عن سعر منتجاتها منفصلة ({total}).",
    comboAmountTooHigh: "يجب أن يكون مبلغ الخصم أقل من سعر المنتجات منفصلة ({total}).",
    COMBO_NEEDS_TWO_PRODUCTS: "تحتاج الباقة إلى منتجين مختلفين على الأقل.",
    COMBO_PRODUCT_NEEDS_INPUT: "لا يمكن إضافة منتج يطلب من العميل بيانات (حقل مطلوب أو اختيار إلزامي من القائمة) إلى باقة.",
    comboProductNeedsInputNamed: "«{name}» يطلب من العميل بيانات (حقل مطلوب أو اختيار إلزامي من القائمة)، لذلك لا يمكن إضافته إلى باقة.",
    COMBO_VARIANT_REQUIRED: "اختر خيار كل منتج، أو اترك العميل يختاره.",
    save: "حفظ الباقة",
    created: "تم إنشاء الباقة.",
    saved: "تم حفظ الباقة.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const MODES: readonly ComboPricingMode[] = ["fixed_price", "percent_off", "amount_off"];
const MIN_ITEMS = 2;
const MAX_ITEMS = 10;
const MAX_SHOW_ON = 50;
/** An item's choice when the customer picks the option (a variant id is a UUID, so never this). */
const PICK = "pick";

/** One product of the combo as the form holds it. */
interface ItemDraft {
  /** React's key only. */
  key: number;
  productId: string | null;
  /** PICK, a variant id, or "" while nothing is chosen. */
  choice: string;
  quantity: string;
}

let nextKey = 0;
const blankItem = (): ItemDraft => ({ key: nextKey++, productId: null, choice: "", quantity: "1" });

const activeVariants = (product: Product | undefined) => (product?.variants ?? []).filter((variant) => variant.status === "active");

/** What picking a product chooses for it: its one option, or the customer's pick when it has several. */
function defaultChoice(product: Product | undefined): string {
  const variants = activeVariants(product);
  if (variants.length === 1) return variants[0].id;
  return variants.length > 1 ? PICK : "";
}

/** A whole number of pieces from 1 to 100. */
function quantityOk(text: string): boolean {
  const quantity = Number(text);
  return text.trim() !== "" && Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
}

/** The API shape of a draft item, or null while something in it is missing or out of range. */
function comboItemInput(item: ItemDraft): ComboItemInput | null {
  if (!item.productId || !item.choice || !quantityOk(item.quantity)) return null;
  const quantity = Number(item.quantity);
  return item.choice === PICK
    ? { productId: item.productId, variantId: null, pickVariant: true, quantity }
    : { productId: item.productId, variantId: item.choice, pickVariant: false, quantity };
}

/** The price as the API wants it — minor units, or basis points for a percentage — or null when it cannot be read. */
function comboPriceValue(mode: ComboPricingMode, text: string): number | null {
  if (mode === "percent_off") {
    const bp = percentToBasisPoints(text);
    return Number.isInteger(bp) && bp >= 1 && bp <= 10000 ? bp : null;
  }
  const minor = majorToMinor(text);
  return Number.isFinite(minor) && minor >= 0 ? minor : null;
}

/** The item a refusal names (`items[2].productId`), or null. */
function refusedItem(err: unknown): number | null {
  const details = apiErrorDetails<Array<{ field?: unknown }>>(err);
  const field = Array.isArray(details) ? details[0]?.field : undefined;
  const match = typeof field === "string" ? /^items\[(\d+)\]/.exec(field) : null;
  return match ? Number(match[1]) : null;
}

/** The server's refusal of a combo in the merchant's words, or null for anything that is not about the combo itself. */
function comboRefusal(
  err: unknown,
  t: Strings,
  mode: ComboPricingMode,
  currency: string,
  productName: (index: number) => string | null
): string | null {
  const code = apiErrorCode(err);
  if (code === "COMBO_PRICE_ABOVE_TOTAL") {
    const details = apiErrorDetails<Array<{ componentsTotal?: unknown }>>(err);
    const total = Array.isArray(details) ? Number(details[0]?.componentsTotal) : NaN;
    return fmt(mode === "amount_off" ? t.comboAmountTooHigh : t.COMBO_PRICE_ABOVE_TOTAL, {
      total: Number.isFinite(total) ? formatMoney(total, currency) : "—",
    });
  }
  if (code === "COMBO_NEEDS_TWO_PRODUCTS") return t.COMBO_NEEDS_TWO_PRODUCTS;
  if (code === "COMBO_PRODUCT_NEEDS_INPUT") {
    const index = refusedItem(err);
    const name = index === null ? null : productName(index);
    return name ? fmt(t.comboProductNeedsInputNamed, { name }) : t.COMBO_PRODUCT_NEEDS_INPUT;
  }
  if (code === "COMBO_VARIANT_REQUIRED") return t.COMBO_VARIANT_REQUIRED;
  return null;
}

/**
 * The store's products for the pickers (drafts and active, the first 200),
 * plus any product of the combo beyond them, read one by one, so every item
 * shows its product and options.
 */
function useComboProducts(combo: ComboDto | undefined) {
  const workspaceId = useWorkspaceId();
  return useAsync(async () => {
    const { products } = await apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 });
    const known = new Set(products.map((product) => product.id));
    const missing = [...new Set((combo?.items ?? []).map((item) => item.productId))].filter(
      (id): id is string => typeof id === "string" && !known.has(id)
    );
    const extra = await Promise.all(missing.map((id) => apiClient.getProduct(workspaceId, id).catch(() => null)));
    return [...products, ...extra.filter((product): product is Product => product !== null)];
  }, [workspaceId, combo?.id]);
}

/** The server's last answer for the draft it was asked about (`key`). */
type PreviewState = ({ kind: "priced"; componentsTotal: number; total: number } | { kind: "refused"; error: unknown }) & { key: string };

export function ComboEditorDialog({ combo, onClose, onSaved }: { combo?: ComboDto; onClose: () => void; onSaved: (combo: ComboDto) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const products = useComboProducts(combo);
  const catalog = products.data ?? [];
  const productOf = (id: string | null) => (id ? catalog.find((product) => product.id === id) : undefined);

  const [name, setName] = useState(combo?.name ?? "");
  const [about, setAbout] = useState(combo?.description ?? "");
  const [imageUrl, setImageUrl] = useState(combo?.imageUrl ?? "");
  const [status, setStatus] = useState<ComboStatus>(combo?.status ?? "draft");
  const [items, setItems] = useState<ItemDraft[]>(() =>
    combo && combo.items.length > 0
      ? combo.items.map((item) => ({
          key: nextKey++,
          productId: item.productId,
          choice: item.pickVariant ? PICK : (item.variantId ?? ""),
          quantity: String(item.quantity),
        }))
      : [blankItem(), blankItem()]
  );
  const [mode, setMode] = useState<ComboPricingMode>(combo?.pricingMode ?? "fixed_price");
  const [value, setValue] = useState(() =>
    !combo ? "" : combo.pricingMode === "percent_off" ? basisPointsToPercentInput(combo.priceValue) : minorToMajorInput(combo.priceValue)
  );
  const [everywhere, setEverywhere] = useState(() => (combo?.showOnProductIds.length ?? 0) === 0);
  const [showOn, setShowOn] = useState<string[]>(() => combo?.showOnProductIds ?? []);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  /** Mark every unfinished item once a save was refused for them. */
  const [checkItems, setCheckItems] = useState(false);
  /** The item the server's last refusal named, until the items change. */
  const [refused, setRefused] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const inputs = items.map(comboItemInput);
  const priceValue = comboPriceValue(mode, value);
  const ready = inputs.length >= MIN_ITEMS && inputs.every((input) => input !== null) && priceValue !== null;
  const previewKey = ready ? JSON.stringify({ pricingMode: mode, priceValue, items: inputs }) : "";
  const anyPick = items.some((item) => item.choice === PICK);
  const productName = (index: number) => {
    const id = items[index]?.productId ?? null;
    return productOf(id)?.name ?? combo?.items.find((item) => item.productId === id)?.productName ?? null;
  };
  const refusal = (err: unknown) => comboRefusal(err, t, mode, currency, productName);

  // The live price: the server prices the draft the way it will check it on save.
  // Until a draft is complete there is nothing to price; a changed one keeps the last answer, dimmed, until the next.
  const shown = previewKey ? preview : null;
  const stale = shown !== null && shown.key !== previewKey;
  useEffect(() => {
    if (!previewKey) return;
    let live = true;
    const timer = window.setTimeout(() => {
      combosPreview(apiClient, workspaceId, JSON.parse(previewKey) as Pick<ComboPayload, "pricingMode" | "priceValue" | "items">)
        .then((result) => {
          if (live) setPreview({ key: previewKey, kind: "priced", componentsTotal: result.componentsTotal, total: result.total });
        })
        .catch((err: unknown) => {
          if (live) setPreview({ key: previewKey, kind: "refused", error: err });
        });
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [previewKey, workspaceId]);

  const patchItem = (index: number, change: Partial<ItemDraft>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)));
    setRefused(null);
  };

  async function save() {
    setError(null);
    if (!name.trim()) {
      setNameError(t.nameRequired);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (inputs.some((input) => input === null)) {
      setCheckItems(true);
      setError(t.itemsInvalid);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (new Set(items.map((item) => item.productId)).size < MIN_ITEMS) {
      setError(t.COMBO_NEEDS_TWO_PRODUCTS);
      return;
    }
    if (priceValue === null) {
      setPriceError(t[`priceFix_${mode}`]);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (!everywhere && showOn.length === 0) {
      setError(t.showOnRequired);
      return;
    }
    setBusy(true);
    const payload: ComboPayload = {
      name: name.trim(),
      description: about.trim() || null,
      imageUrl: imageUrl || null,
      status,
      pricingMode: mode,
      priceValue,
      showOnProductIds: everywhere ? [] : showOn,
      items: inputs as ComboItemInput[],
    };
    try {
      const saved = combo ? await combosUpdate(apiClient, workspaceId, combo.id, payload) : await combosCreate(apiClient, workspaceId, payload);
      toast.success(combo ? t.saved : t.created);
      onSaved(saved);
    } catch (err) {
      setRefused(refusedItem(err));
      setError(refusal(err) ?? errorMessage(err));
      setBusy(false);
    }
  }

  const statuses: ComboStatus[] = status === "archived" ? ["draft", "active", "archived"] : ["draft", "active"];
  const numberBox = "h-11 text-base tabular-nums md:h-10 md:text-sm";

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={combo ? t.editTitle : t.createTitle}
      description={t.description}
      className="max-w-[46rem]"
      footer={<SheetActions busy={busy} onCancel={onClose} onSave={() => void save()} saveLabel={t.save} />}
    >
      <div ref={formRef} className="space-y-5">
        <TextField
          label={t.name}
          required
          maxLength={200}
          placeholder={t.namePlaceholder}
          value={name}
          disabled={busy}
          error={nameError ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          className="[&_input]:h-11 [&_input]:text-base md:[&_input]:h-10 md:[&_input]:text-sm"
        />

        <Field label={t.about}>
          {({ id }) => (
            <Textarea id={id} rows={3} maxLength={2000} placeholder={t.aboutPlaceholder} value={about} disabled={busy} onChange={(e) => setAbout(e.target.value)} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <ImageField label={t.picture} value={imageUrl} onChange={setImageUrl} />
          <div className="space-y-1.5">
            <Label htmlFor="combo-status">{t.status}</Label>
            <Select id="combo-status" className={TOUCH_FIELD} value={status} disabled={busy} onChange={(e) => setStatus(e.target.value as ComboStatus)}>
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {t[`status_${option}`]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-semibold text-ink">{t.items}</p>
            <p className="text-xs text-ink-soft">{t.itemsHint}</p>
          </div>
          {items.map((item, index) => {
            const product = productOf(item.productId);
            const variants = activeVariants(product);
            const knownChoice = item.choice === "" || item.choice === PICK || variants.some((variant) => variant.id === item.choice);
            // One option for sale and it is the one chosen: nothing to choose.
            const showOptions = variants.length > 1 || !knownChoice || (item.choice === PICK && variants.length <= 1);
            const invalid = (checkItems && inputs[index] === null) || refused === index;
            return (
              <fieldset
                key={item.key}
                disabled={busy}
                data-slot="combo-item"
                data-invalid={invalid ? "" : undefined}
                className={cn("min-w-0 space-y-2 rounded-[1rem] bg-paper-raised p-3 ring-1", invalid ? "ring-danger" : "ring-line")}
              >
                <legend className="sr-only">{fmt(t.item, { n: index + 1 })}</legend>
                <div className="grid grid-cols-[minmax(0,1fr)_5rem_2.75rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem_2.75rem]">
                  <div className="col-span-3 min-w-0 sm:col-span-1">
                    <ProductSelect
                      id={`combo-product-${item.key}`}
                      label={t.product}
                      products={catalog}
                      value={item.productId}
                      anyLabel={t.chooseProduct}
                      disabled={busy || products.loading}
                      onChange={(productId) => patchItem(index, { productId, choice: defaultChoice(productOf(productId)) })}
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    {product && showOptions && (
                      <>
                        <Label htmlFor={`combo-option-${item.key}`}>{t.option}</Label>
                        <Select
                          id={`combo-option-${item.key}`}
                          className={TOUCH_FIELD}
                          value={item.choice}
                          aria-invalid={invalid && !item.choice ? true : undefined}
                          onChange={(e) => patchItem(index, { choice: e.target.value })}
                        >
                          {item.choice === "" && <option value="">{t.chooseOption}</option>}
                          <option value={PICK}>{t.customerPicks}</option>
                          {!knownChoice && <option value={item.choice}>{t.optionGone}</option>}
                          {variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variantLabel(variant)} — {formatMoney(variant.priceAmount, variant.currency)}
                            </option>
                          ))}
                        </Select>
                      </>
                    )}
                    {product && variants.length === 0 && item.choice === "" && <p className="text-xs text-danger">{t.noOptions}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`combo-qty-${item.key}`}>{t.quantity}</Label>
                    <Input
                      id={`combo-qty-${item.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      dir="ltr"
                      value={item.quantity}
                      aria-invalid={invalid && !quantityOk(item.quantity) ? true : undefined}
                      onChange={(e) => patchItem(index, { quantity: e.target.value })}
                      className={numberBox}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={fmt(t.remove, { n: index + 1 })}
                    title={fmt(t.remove, { n: index + 1 })}
                    disabled={items.length <= MIN_ITEMS}
                    onClick={() => {
                      setItems((current) => current.filter((_, i) => i !== index));
                      setRefused(null);
                    }}
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <IconDelete className="size-[18px]" aria-hidden />
                  </button>
                </div>
                {checkItems && inputs[index] === null && (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {t.itemFix}
                  </p>
                )}
              </fieldset>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full px-4 md:min-h-9"
            disabled={busy || items.length >= MAX_ITEMS}
            onClick={() => setItems((current) => [...current, blankItem()])}
          >
            <IconPlus className="size-4" aria-hidden />
            {t.addItem}
          </Button>
        </div>

        <fieldset disabled={busy} className="min-w-0 space-y-2.5">
          <legend className="text-sm font-semibold text-ink">{t.pricing}</legend>
          <div className="flex flex-wrap gap-x-5">
            {MODES.map((option) => (
              <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
                <input
                  type="radio"
                  name="combo-pricing"
                  value={option}
                  className="size-5 shrink-0 cursor-pointer accent-primary"
                  checked={mode === option}
                  onChange={() => {
                    setMode(option);
                    setValue("");
                    setPriceError(null);
                  }}
                />
                {t[`mode_${option}`]}
              </label>
            ))}
          </div>
          <TextField
            label={t[`value_${mode}`]}
            type="number"
            inputMode="decimal"
            min={mode === "percent_off" ? 0.01 : 0}
            max={mode === "percent_off" ? 100 : undefined}
            step="0.01"
            dir="ltr"
            value={value}
            error={priceError ?? undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setPriceError(null);
            }}
            className="max-w-56 [&_input]:h-11 [&_input]:text-base [&_input]:tabular-nums md:[&_input]:h-10 md:[&_input]:text-sm"
          />
        </fieldset>

        <OfferPreview label={t.preview} className={stale ? "[&>p:not(:first-child)]:opacity-60" : undefined}>
          {shown?.kind === "priced" ? (
            <>
              <p className="font-medium text-ink tabular-nums">
                <bdi>
                  {fmt(t.previewLine, {
                    full: formatMoney(shown.componentsTotal, currency),
                    total: formatMoney(shown.total, currency),
                    saving: formatMoney(Math.max(0, shown.componentsTotal - shown.total), currency),
                  })}
                </bdi>
              </p>
              {anyPick && <p className="text-xs text-ink-soft">{t.previewPick}</p>}
            </>
          ) : shown?.kind === "refused" ? (
            <p className="text-sm font-medium text-danger">{refusal(shown.error) ?? t.previewFailed}</p>
          ) : (
            <p className="text-xs text-ink-soft">{previewKey ? t.previewPricing : t.previewIncomplete}</p>
          )}
        </OfferPreview>

        <div className="space-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={everywhere}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.checked;
                setEverywhere(next);
                // Narrowing it starts from the combo's own products.
                if (!next && showOn.length === 0) {
                  setShowOn([...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))].slice(0, MAX_SHOW_ON));
                }
              }}
            />
            {t.showEverywhere}
          </label>
          {!everywhere && (
            <ProductChecklist
              label={t.showOn}
              hint={t.showOnHint}
              products={catalog}
              value={showOn}
              onChange={setShowOn}
              disabled={busy}
              max={MAX_SHOW_ON}
              loading={products.loading}
            />
          )}
        </div>

        <FormProblem>{error}</FormProblem>
      </div>
    </Modal>
  );
}
