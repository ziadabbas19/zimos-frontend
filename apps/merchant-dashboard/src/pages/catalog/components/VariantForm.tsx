import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  isApiErrorCode,
  type CreateVariantPayload,
  type UpdateVariantPayload,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput, formatOptions } from "@/lib/format";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "../catalogLabels";

const STRINGS = {
  en: {
    sku: "SKU",
    price: "Price",
    cost: "Cost",
    optional: "Optional.",
    compareAt: "Compare-at price",
    compareAtHint: "Optional — shown struck-through on the storefront.",
    stock: "Initial stock",
    stockHint: "Set once here. Later changes go through Inventory.",
    options: "Option values",
    optionsHint: "e.g. Size=M, Color=Red",
    stockLine: "Stock: {onHand} on hand",
    reserved: ", {reserved} reserved",
    managedInInventory: " — managed in Inventory.",
    optionsLine: "Options: {options}",
    status: "Status",
    allowOverselling: "Allow overselling (accept orders past available stock)",
    priceInvalid: "Enter a valid price (0 or more).",
    costInvalid: "Enter a valid cost, or leave it blank.",
    compareAtInvalid: "Enter a valid amount, or leave it blank.",
    skuTaken: "That SKU is already used by another variant.",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save variant",
    add: "Add variant",
  },
  ar: {
    sku: "SKU",
    price: "السعر",
    cost: "التكلفة",
    optional: "اختياري.",
    compareAt: "السعر قبل الخصم",
    compareAtHint: "اختياري — يظهر مشطوبًا في المتجر.",
    stock: "المخزون المبدئي",
    stockHint: "يُحدد مرة واحدة هنا. أي تغيير لاحق يتم من المخزون.",
    options: "قيم الخيارات",
    optionsHint: "مثال: Size=M, Color=Red",
    stockLine: "المخزون: {onHand} متاح",
    reserved: "، {reserved} محجوز",
    managedInInventory: " — يُدار من المخزون.",
    optionsLine: "الخيارات: {options}",
    status: "الحالة",
    allowOverselling: "السماح بالبيع بعد نفاد المخزون (قبول أوردرات تتجاوز المتاح)",
    priceInvalid: "أدخل سعرًا صحيحًا (صفر أو أكثر).",
    costInvalid: "أدخل تكلفة صحيحة، أو اتركها فارغة.",
    compareAtInvalid: "أدخل مبلغًا صحيحًا، أو اتركه فارغًا.",
    skuTaken: "رمز SKU هذا مستخدم لمتغير آخر.",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ المتغير",
    add: "إضافة المتغير",
  },
} satisfies Messages;

interface Props {
  productId: string;
  variant?: Variant;
  onDone: () => void;
  onCancel: () => void;
}

/** Parse "Size=M, Color=Red" -> { Size: "M", Color: "Red" }. */
function parseOptionValues(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of input.split(",")) {
    const [k, ...rest] = pair.split("=");
    const key = k?.trim();
    const value = rest.join("=").trim();
    if (key && value) out[key] = value;
  }
  return out;
}

function stringifyOptionValues(values: Record<string, string> | undefined): string {
  if (!values) return "";
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

export function VariantForm({ productId, variant, onDone, onCancel }: Props) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const isEdit = Boolean(variant);

  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(minorToMajorInput(variant?.priceAmount));
  const [cost, setCost] = useState(minorToMajorInput(variant?.costAmount));
  const [compareAt, setCompareAt] = useState(minorToMajorInput(variant?.compareAtAmount));
  const [stock, setStock] = useState("0");
  const [options, setOptions] = useState(stringifyOptionValues(variant?.optionValues));
  const [allowOverselling, setAllowOverselling] = useState(variant?.allowOverselling ?? false);
  const [status, setStatus] = useState<"active" | "archived">(variant?.status ?? "active");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setFieldErrors({});

    const priceMinor = majorToMinor(price);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      setFieldErrors({ priceAmount: t.priceInvalid });
      return;
    }
    const costMinor = cost.trim() ? majorToMinor(cost) : null;
    if (costMinor !== null && (!Number.isFinite(costMinor) || costMinor < 0)) {
      setFieldErrors({ costAmount: t.costInvalid });
      return;
    }
    const compareMinor = compareAt.trim() ? majorToMinor(compareAt) : null;
    if (compareMinor !== null && (!Number.isFinite(compareMinor) || compareMinor < 0)) {
      setFieldErrors({ compareAtAmount: t.compareAtInvalid });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && variant) {
        const payload: UpdateVariantPayload = {
          sku: sku.trim() || null,
          priceAmount: priceMinor,
          costAmount: costMinor,
          compareAtAmount: compareMinor,
          allowOverselling,
          status,
        };
        await apiClient.updateVariant(workspaceId, variant.id, payload);
      } else {
        const stockValue = Number(stock);
        const payload: CreateVariantPayload = {
          sku: sku.trim() || null,
          priceAmount: priceMinor,
          costAmount: costMinor,
          compareAtAmount: compareMinor,
          optionValues: parseOptionValues(options),
          allowOverselling,
          stockOnHand: Number.isFinite(stockValue) && stockValue > 0 ? Math.floor(stockValue) : 0,
        };
        await apiClient.createVariant(workspaceId, productId, payload);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (isApiErrorCode(err, "DUPLICATE_RESOURCE")) fields.sku = t.skuTaken;
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={t.sku}
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        error={fieldErrors.sku}
        placeholder="TSHIRT-M"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label={t.price}
          required
          value={price}
          onChange={setPrice}
          error={fieldErrors.priceAmount}
          currency={variant?.currency ?? "EGP"}
        />
        <MoneyInput
          label={t.cost}
          value={cost}
          onChange={setCost}
          error={fieldErrors.costAmount}
          hint={t.optional}
          currency={variant?.currency ?? "EGP"}
        />
      </div>

      <MoneyInput
        label={t.compareAt}
        value={compareAt}
        onChange={setCompareAt}
        error={fieldErrors.compareAtAmount}
        hint={t.compareAtHint}
        currency={variant?.currency ?? "EGP"}
      />

      {!isEdit && (
        <>
          <TextField
            label={t.stock}
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            error={fieldErrors.stockOnHand}
            hint={t.stockHint}
          />
          <TextField
            label={t.options}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            error={fieldErrors.optionValues}
            hint={t.optionsHint}
          />
        </>
      )}

      {isEdit && (
        <>
          <div className="rounded-[0.5rem] border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
            {fmt(t.stockLine, { onHand: variant?.stockOnHand ?? 0 })}
            {variant?.reservedStock ? fmt(t.reserved, { reserved: variant.reservedStock }) : ""}
            {t.managedInInventory}
            {formatOptions(variant?.optionValues) && (
              <div className="mt-0.5">
                {fmt(t.optionsLine, { options: formatOptions(variant?.optionValues) })}
              </div>
            )}
          </div>
          <Field label={t.status} error={fieldErrors.status}>
            {({ id }) => (
              <Select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "archived")}
              >
                <option value="active">{labels.status("active")}</option>
                <option value="archived">{labels.status("archived")}</option>
              </Select>
            )}
          </Field>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={allowOverselling}
          onChange={(e) => setAllowOverselling(e.target.checked)}
        />
        {t.allowOverselling}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : isEdit ? t.save : t.add}
        </Button>
      </div>
    </form>
  );
}
