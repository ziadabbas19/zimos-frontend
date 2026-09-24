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
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput, variantLabel } from "@/lib/format";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    linesRequired: "Add at least one variant to the bundle.",
    priceRequired: "A fixed-price offer needs a valid price.",
    needsVariant: "Add an active variant to this product before creating an offer.",
    close: "Close",
    name: "Offer name",
    namePlaceholder: "3-pack bundle",
    pricingMode: "Pricing mode",
    fixed: "Fixed price",
    computed: "Computed from variants",
    bundlePrice: "Bundle price",
    badge: "Badge",
    badgeHint: "Optional — e.g. “Best value”.",
    contents: "Bundle contents",
    addLine: "+ Add line",
    quantity: "Quantity",
    remove: "Remove",
    isDefault: "Default offer for this product",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save offer",
    create: "Create offer",
  },
  ar: {
    linesRequired: "أضف متغيرًا واحدًا على الأقل إلى الباقة.",
    priceRequired: "العرض بسعر ثابت يحتاج إلى سعر صحيح.",
    needsVariant: "أضف متغيرًا نشطًا لهذا المنتج قبل إنشاء عرض.",
    close: "إغلاق",
    name: "اسم العرض",
    namePlaceholder: "باقة 3 قطع",
    pricingMode: "طريقة التسعير",
    fixed: "سعر ثابت",
    computed: "محسوب من المتغيرات",
    bundlePrice: "سعر الباقة",
    badge: "الشارة",
    badgeHint: "اختياري — مثل “الأوفر”.",
    contents: "محتويات الباقة",
    addLine: "+ إضافة بند",
    quantity: "الكمية",
    remove: "إزالة",
    isDefault: "العرض الافتراضي لهذا المنتج",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ العرض",
    create: "إنشاء العرض",
  },
} satisfies Messages;

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
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
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
    if (saving) return;
    setFormError(null);
    setFieldErrors({});

    const cleanLines = lines
      .filter((l) => l.variantId)
      .map((l) => ({ variantId: l.variantId, quantity: Math.max(1, Math.floor(Number(l.quantity) || 0)) }));
    if (cleanLines.length === 0) {
      setFieldErrors({ lines: t.linesRequired });
      return;
    }

    let priceMinor: number | undefined;
    if (pricingMode === "fixed") {
      priceMinor = majorToMinor(price);
      if (!Number.isFinite(priceMinor) || priceMinor < 0) {
        setFieldErrors({ priceAmount: t.priceRequired });
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
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (sellable.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="danger">{t.needsVariant}</Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            {t.close}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={t.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={t.namePlaceholder}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.pricingMode} error={fieldErrors.pricingMode}>
          {({ id }) => (
            <Select
              id={id}
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as OfferPricingMode)}
            >
              <option value="fixed">{t.fixed}</option>
              <option value="computed">{t.computed}</option>
            </Select>
          )}
        </Field>
        {pricingMode === "fixed" && (
          <MoneyInput
            label={t.bundlePrice}
            required
            value={price}
            onChange={setPrice}
            error={fieldErrors.priceAmount}
          />
        )}
      </div>

      <TextField
        label={t.badge}
        value={badge}
        onChange={(e) => setBadge(e.target.value)}
        error={fieldErrors.badge}
        hint={t.badgeHint}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-soft">{t.contents}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLines((prev) => [...prev, { variantId: sellable[0].id, quantity: "1" }])}
          >
            {t.addLine}
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
              aria-label={t.quantity}
            />
            {lines.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              >
                {t.remove}
              </Button>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        {t.isDefault}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : isEdit ? t.save : t.create}
        </Button>
      </div>
    </form>
  );
}
