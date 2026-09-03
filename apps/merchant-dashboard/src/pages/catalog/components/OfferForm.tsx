import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import type {
  CreateOfferPayload,
  Offer,
  OfferPricingMode,
  UpdateOfferPayload,
  Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { majorToMinor, minorToMajorInput, variantLabel } from "@/lib/format";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";

interface Props {
  productId: string;
  /** Active variants of this product, to build the line picker. */
  variants: Variant[];
  offer?: Offer;
  onDone: () => void;
  onCancel: () => void;
}

interface LineDraft {
  variantId: string;
  quantity: string;
}

export function OfferForm({ productId, variants, offer, onDone, onCancel }: Props) {
  const workspaceId = useWorkspaceId();
  const isEdit = Boolean(offer);
  const sellable = variants.filter((v) => v.status === "active");

  const [name, setName] = useState(offer?.name ?? "");
  const [pricingMode, setPricingMode] = useState<OfferPricingMode>(offer?.pricingMode ?? "fixed");
  const [price, setPrice] = useState(minorToMajorInput(offer?.priceAmount));
  const [badge, setBadge] = useState(offer?.badge ?? "");
  const [isDefault, setIsDefault] = useState(offer?.isDefault ?? false);
  const [lines, setLines] = useState<LineDraft[]>(
    offer?.lines?.length
      ? offer.lines.map((l) => ({ variantId: l.variantId, quantity: String(l.quantity) }))
      : [{ variantId: sellable[0]?.id ?? "", quantity: "1" }]
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function setLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const cleanLines = lines
      .filter((l) => l.variantId)
      .map((l) => ({ variantId: l.variantId, quantity: Math.max(1, Math.floor(Number(l.quantity) || 0)) }));
    if (cleanLines.length === 0) {
      setFieldErrors({ lines: "Add at least one variant to the bundle." });
      return;
    }

    let priceMinor: number | undefined;
    if (pricingMode === "fixed") {
      priceMinor = majorToMinor(price);
      if (!Number.isFinite(priceMinor) || priceMinor < 0) {
        setFieldErrors({ priceAmount: "A fixed-price offer needs a valid price." });
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit && offer) {
        const payload: UpdateOfferPayload = {
          name: name.trim(),
          pricingMode,
          priceAmount: pricingMode === "fixed" ? priceMinor : null,
          badge: badge.trim() || null,
          isDefault,
          lines: cleanLines,
        };
        await apiClient.updateOffer(workspaceId, offer.id, payload);
      } else {
        const payload: CreateOfferPayload = {
          name: name.trim(),
          pricingMode,
          priceAmount: priceMinor,
          badge: badge.trim() || null,
          isDefault,
          lines: cleanLines,
        };
        await apiClient.createOffer(workspaceId, productId, payload);
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

  if (sellable.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="danger">Add an active variant to this product before creating an offer.</Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label="Offer name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder="3-pack bundle"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pricing mode" error={fieldErrors.pricingMode}>
          {({ id }) => (
            <Select
              id={id}
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as OfferPricingMode)}
            >
              <option value="fixed">Fixed price</option>
              <option value="computed">Computed from variants</option>
            </Select>
          )}
        </Field>
        {pricingMode === "fixed" && (
          <MoneyInput
            label="Bundle price"
            required
            value={price}
            onChange={setPrice}
            error={fieldErrors.priceAmount}
          />
        )}
      </div>

      <TextField
        label="Badge"
        value={badge}
        onChange={(e) => setBadge(e.target.value)}
        error={fieldErrors.badge}
        hint="Optional — e.g. “Best value”."
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-soft">Bundle contents</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLines((prev) => [...prev, { variantId: sellable[0].id, quantity: "1" }])}
          >
            + Add line
          </Button>
        </div>
        {fieldErrors.lines && <p className="text-xs font-medium text-danger">{fieldErrors.lines}</p>}
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select
              value={line.variantId}
              onChange={(e) => setLine(i, { variantId: e.target.value })}
              className="flex-1"
            >
              {sellable.map((v) => (
                <option key={v.id} value={v.id}>
                  {variantLabel(v)}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => setLine(i, { quantity: e.target.value })}
              className="w-20"
              aria-label="Quantity"
            />
            {lines.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default offer for this product
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save offer" : "Create offer"}
        </Button>
      </div>
    </form>
  );
}
