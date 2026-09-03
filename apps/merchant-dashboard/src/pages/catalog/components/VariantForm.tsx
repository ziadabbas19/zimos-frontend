import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { CreateVariantPayload, UpdateVariantPayload, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { majorToMinor, minorToMajorInput, formatOptions } from "@/lib/format";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";

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
    setFormError(null);
    setFieldErrors({});

    const priceMinor = majorToMinor(price);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      setFieldErrors({ priceAmount: "Enter a valid price (0 or more)." });
      return;
    }
    const costMinor = cost.trim() ? majorToMinor(cost) : null;
    if (costMinor !== null && (!Number.isFinite(costMinor) || costMinor < 0)) {
      setFieldErrors({ costAmount: "Enter a valid cost, or leave it blank." });
      return;
    }
    const compareMinor = compareAt.trim() ? majorToMinor(compareAt) : null;
    if (compareMinor !== null && (!Number.isFinite(compareMinor) || compareMinor < 0)) {
      setFieldErrors({ compareAtAmount: "Enter a valid amount, or leave it blank." });
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
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label="SKU"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        error={fieldErrors.sku}
        placeholder="TSHIRT-M"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label="Price"
          required
          value={price}
          onChange={setPrice}
          error={fieldErrors.priceAmount}
          currency={variant?.currency ?? "EGP"}
        />
        <MoneyInput
          label="Cost"
          value={cost}
          onChange={setCost}
          error={fieldErrors.costAmount}
          hint="Optional."
          currency={variant?.currency ?? "EGP"}
        />
      </div>

      <MoneyInput
        label="Compare-at price"
        value={compareAt}
        onChange={setCompareAt}
        error={fieldErrors.compareAtAmount}
        hint="Optional — shown struck-through on the storefront."
        currency={variant?.currency ?? "EGP"}
      />

      {!isEdit && (
        <>
          <TextField
            label="Initial stock"
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            error={fieldErrors.stockOnHand}
            hint="Set once here. Later changes go through Inventory."
          />
          <TextField
            label="Option values"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            error={fieldErrors.optionValues}
            hint='e.g. Size=M, Color=Red'
          />
        </>
      )}

      {isEdit && (
        <>
          <div className="rounded-[0.5rem] border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
            Stock: <strong className="text-ink">{variant?.stockOnHand}</strong> on hand
            {variant?.reservedStock ? `, ${variant.reservedStock} reserved` : ""} — managed in
            Inventory.
            {formatOptions(variant?.optionValues) && (
              <div className="mt-0.5">Options: {formatOptions(variant?.optionValues)}</div>
            )}
          </div>
          <Field label="Status" error={fieldErrors.status}>
            {({ id }) => (
              <Select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "archived")}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
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
        Allow overselling (accept orders past available stock)
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save variant" : "Add variant"}
        </Button>
      </div>
    </form>
  );
}
