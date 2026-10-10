import { useEffect, useRef, useState } from "react";
import { IconDelete, IconPlus } from "@/components/icons";
import { Button, Input, Label, cn } from "@store-builder/ui";
import {
  BUNDLE_DISCOUNT_TYPES,
  BUNDLE_DISPLAY_STYLES,
  BUNDLE_MAX_TIERS,
  bundlesCreate,
  bundlesPreview,
  bundlesUpdate,
  type BundleDiscountType,
  type BundleDisplayStyle,
  type BundleDto,
  type BundlePreviewTier,
  type BundleTierInput,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FormProblem, OfferPreview, SheetActions, TOUCH_FIELD, focusFirstInvalid } from "./OfferKit";

/**
 * Creating or editing a quantity bundle: the name, a starting
 * template, the tiers, and under them a live preview of what each tier costs
 * for a sample unit price — priced by the server, the same way an order is.
 */

const STRINGS = {
  en: {
    createTitle: "New bundle",
    editTitle: "Edit bundle",
    description: "Shoppers pay less per piece when they buy more. One bundle can be used on many products.",
    name: "Bundle name",
    namePlaceholder: "Buy more, save more",
    display: "Shown in the store as",
    display_cards: "Cards",
    display_radio: "List",
    display_dropdown: "Dropdown",
    active: "This bundle is on",
    templates: "Start from a template",
    template_percentage: "Percentage discount",
    template_fixed: "Fixed price",
    template_bxgy: "Buy X get Y",
    template_custom: "Custom",
    tiers: "Tiers",
    tier: "Tier {n}",
    quantity: "Pieces",
    type: "Discount",
    type_percentage: "Percent off",
    type_fixed_price: "Fixed price for the tier",
    type_fixed_amount_off: "Amount off the tier",
    type_buy_x_get_y: "Free pieces",
    value: "Value",
    title: "Title in the store",
    titlePlaceholder: "Buy 2 and save 5%",
    label: "Highlight",
    labelPlaceholder: "Best seller",
    freeShipping: "Free shipping",
    isDefault: "Selected by default",
    remove: "Remove tier {n}",
    addTier: "Add tier",
    preview: "The shopper sees",
    previewPrice: "For a piece that costs",
    previewLine: "{pieces} for {total}",
    previewEach: "{each} a piece",
    previewSave: "saves {amount}",
    previewFree: "Free shipping",
    previewFailed: "Fix the tiers to see what the shopper pays.",
    nameRequired: "Write a name for the bundle.",
    valueInvalid: "Tier {n} needs fixing.",
    fix_percentage: "Pieces: a whole number from 1 to 100. Percent off: from 0 to 100.",
    fix_fixed_price: "Pieces: a whole number from 1 to 100. Then write the price of the whole tier.",
    fix_fixed_amount_off: "Pieces: a whole number from 1 to 100. Then write the amount off.",
    fix_buy_x_get_y: "Pieces: a whole number from 1 to 100. Free pieces: a whole number below it.",
    save: "Save bundle",
    created: "Bundle created.",
    saved: "Bundle saved.",
  },
  ar: {
    createTitle: "باقة جديدة",
    editTitle: "تعديل الباقة",
    description: "العميل يدفع أقل للقطعة كلما اشترى أكثر. الباقة الواحدة تُستخدم على منتجات كثيرة.",
    name: "اسم الباقة",
    namePlaceholder: "اشترِ أكثر ووفّر أكثر",
    display: "شكلها في المتجر",
    display_cards: "بطاقات",
    display_radio: "قائمة",
    display_dropdown: "قائمة منسدلة",
    active: "هذه الباقة مفعّلة",
    templates: "ابدأ من قالب",
    template_percentage: "خصم بنسبة",
    template_fixed: "سعر ثابت",
    template_bxgy: "اشترِ X واحصل على Y",
    template_custom: "مخصص",
    tiers: "الشرائح",
    tier: "شريحة {n}",
    quantity: "الكمية",
    type: "الخصم",
    type_percentage: "نسبة خصم",
    type_fixed_price: "سعر ثابت للشريحة",
    type_fixed_amount_off: "مبلغ خصم على الشريحة",
    type_buy_x_get_y: "قطع مجانية",
    value: "القيمة",
    title: "العنوان في المتجر",
    titlePlaceholder: "اشترِ 2 ووفّر 5%",
    label: "تمييز",
    labelPlaceholder: "الأكثر مبيعًا",
    freeShipping: "شحن مجاني",
    isDefault: "محددة افتراضيًا",
    remove: "حذف شريحة {n}",
    addTier: "إضافة شريحة",
    preview: "ما يراه العميل",
    previewPrice: "لقطعة سعرها",
    previewLine: "{pieces} بـ {total}",
    previewEach: "{each} للقطعة",
    previewSave: "يوفّر {amount}",
    previewFree: "شحن مجاني",
    previewFailed: "صحّح الشرائح لعرض ما يدفعه العميل.",
    nameRequired: "اكتب اسمًا للباقة.",
    valueInvalid: "الشريحة {n} تحتاج إلى تصحيح.",
    fix_percentage: "القطع: عدد صحيح من 1 إلى 100. نسبة الخصم: من 0 إلى 100.",
    fix_fixed_price: "القطع: عدد صحيح من 1 إلى 100. ثم اكتب سعر الشريحة كلها.",
    fix_fixed_amount_off: "القطع: عدد صحيح من 1 إلى 100. ثم اكتب مبلغ الخصم.",
    fix_buy_x_get_y: "القطع: عدد صحيح من 1 إلى 100. القطع المجانية: عدد صحيح أقل منه.",
    save: "حفظ الباقة",
    created: "تم إنشاء الباقة.",
    saved: "تم حفظ الباقة.",
  },
} satisfies Messages;

/** A tier as the form holds it: the value as typed (percent, money in major units, or pieces). */
interface TierDraft {
  quantity: string;
  discountType: BundleDiscountType;
  value: string;
  title: string;
  label: string;
  freeShipping: boolean;
  isDefault: boolean;
}

type Template = "percentage" | "fixed" | "bxgy" | "custom";

const blank = (quantity: number, discountType: BundleDiscountType = "percentage", value = "0"): TierDraft => ({
  quantity: String(quantity),
  discountType,
  value,
  title: "",
  label: "",
  freeShipping: false,
  isDefault: false,
});

const TEMPLATES: Record<Template, () => TierDraft[]> = {
  percentage: () => [
    { ...blank(1, "percentage", "0"), isDefault: true },
    blank(2, "percentage", "5"),
    blank(3, "percentage", "10"),
    blank(4, "percentage", "15"),
  ],
  fixed: () => [{ ...blank(1, "percentage", "0"), isDefault: true }, blank(2, "fixed_price", ""), blank(3, "fixed_price", "")],
  bxgy: () => [{ ...blank(1, "percentage", "0"), isDefault: true }, blank(3, "buy_x_get_y", "1")],
  custom: () => [{ ...blank(1, "percentage", "0"), isDefault: true }],
};

function draftOf(tier: BundleTierInput): TierDraft {
  const value =
    tier.discountType === "percentage"
      ? String(tier.discountValue / 100)
      : tier.discountType === "buy_x_get_y"
        ? String(tier.discountValue)
        : minorToMajorInput(tier.discountValue);
  return {
    quantity: String(tier.quantity),
    discountType: tier.discountType,
    value,
    title: tier.title ?? "",
    label: tier.label ?? "",
    freeShipping: Boolean(tier.freeShipping),
    isDefault: Boolean(tier.isDefault),
  };
}

/** The API shape of a draft tier, or null when a number in it cannot be read. */
function toInput(tier: TierDraft): BundleTierInput | null {
  const quantity = Number(tier.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
  let discountValue: number;
  if (tier.discountType === "percentage") {
    const pct = Number(tier.value || "0");
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    discountValue = Math.round(pct * 100);
  } else if (tier.discountType === "buy_x_get_y") {
    discountValue = Number(tier.value);
    if (!Number.isInteger(discountValue) || discountValue < 0 || discountValue >= quantity) return null;
  } else {
    discountValue = majorToMinor(tier.value);
    if (!Number.isFinite(discountValue) || discountValue < 0) return null;
  }
  return {
    quantity,
    discountType: tier.discountType,
    discountValue,
    title: tier.title.trim() || null,
    label: tier.label.trim() || null,
    freeShipping: tier.freeShipping,
    isDefault: tier.isDefault,
  };
}

export function BundleEditorDialog({
  bundle,
  onClose,
  onSaved,
}: {
  bundle?: BundleDto;
  onClose: () => void;
  onSaved: (bundle: BundleDto) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(bundle?.name ?? "");
  const [displayStyle, setDisplayStyle] = useState<BundleDisplayStyle>(bundle?.displayStyle ?? "cards");
  const [isActive, setIsActive] = useState(bundle?.isActive ?? true);
  // All its products priced together, "any 3 of these".
  const [tiers, setTiers] = useState<TierDraft[]>(() => (bundle ? bundle.tiers.map(draftOf) : TEMPLATES.percentage()));
  const [samplePrice, setSamplePrice] = useState("250");
  const [preview, setPreview] = useState<BundlePreviewTier[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  /** The tier a save was refused for: marked until it is touched again. */
  const [badTier, setBadTier] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const inputs = tiers.map(toInput);
  const valid = inputs.every((tier): tier is BundleTierInput => tier !== null);
  const previewKey = valid ? JSON.stringify([inputs, samplePrice]) : "";

  // The live preview: the server prices the draft's tiers for the sample price.
  useEffect(() => {
    if (!previewKey) {
      setPreview(null);
      return;
    }
    const unit = majorToMinor(samplePrice);
    if (!Number.isFinite(unit) || unit < 0) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      bundlesPreview(apiClient, workspaceId, JSON.parse(previewKey)[0] as BundleTierInput[], unit, controller.signal)
        .then(setPreview)
        .catch(() => {
          if (!controller.signal.aborted) setPreview(null);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [previewKey, samplePrice, workspaceId]);

  const patch = (index: number, change: Partial<TierDraft>) =>
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...change } : tier)));

  async function save() {
    if (!name.trim()) {
      setNameError(t.nameRequired);
      focusFirstInvalid(formRef.current);
      return;
    }
    const bad = inputs.findIndex((tier) => tier === null);
    if (bad >= 0) {
      setBadTier(bad);
      setError(fmt(t.valueInvalid, { n: bad + 1 }));
      focusFirstInvalid(formRef.current);
      return;
    }
    setBadTier(null);
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), displayStyle, isActive, tiers: inputs as BundleTierInput[] };
    try {
      const saved = bundle
        ? await bundlesUpdate(apiClient, workspaceId, bundle.id, payload)
        : await bundlesCreate(apiClient, workspaceId, payload);
      toast.success(bundle ? t.saved : t.created);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const tierBox = "h-11 text-base tabular-nums md:h-10 md:text-sm";

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={bundle ? t.editTitle : t.createTitle}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bundle-display">{t.display}</Label>
            <Select
              id="bundle-display"
              className={TOUCH_FIELD}
              value={displayStyle}
              disabled={busy}
              onChange={(e) => setDisplayStyle(e.target.value as BundleDisplayStyle)}
            >
              {BUNDLE_DISPLAY_STYLES.map((style) => (
                <option key={style} value={style}>
                  {t[`display_${style}`]}
                </option>
              ))}
            </Select>
          </div>
          <SettingsGroup className="sm:self-end">
            <SettingsSwitch checked={isActive} onChange={setIsActive} label={t.active} disabled={busy} />
          </SettingsGroup>
        </div>

        {!bundle && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t.templates}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TEMPLATES) as Template[]).map((template) => (
                <Button
                  key={template}
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full px-4 md:min-h-9"
                  disabled={busy}
                  onClick={() => {
                    setTiers(TEMPLATES[template]());
                    setBadTier(null);
                  }}
                >
                  {t[`template_${template}`]}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-ink">{t.tiers}</p>
          {tiers.map((tier, index) => {
            const invalid = badTier === index && inputs[index] === null;
            return (
              <fieldset
                key={index}
                disabled={busy}
                data-slot="offer-tier"
                data-invalid={invalid ? "" : undefined}
                className={cn("min-w-0 space-y-3 rounded-[1rem] bg-paper-raised p-3 ring-1", invalid ? "ring-danger" : "ring-line")}
              >
                <legend className="sr-only">{fmt(t.tier, { n: index + 1 })}</legend>
                <div className="grid grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-end gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_7rem_2.75rem]">
                  <div className="space-y-1">
                    <Label htmlFor={`tier-q-${index}`}>{t.quantity}</Label>
                    <Input
                      id={`tier-q-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      dir="ltr"
                      value={tier.quantity}
                      aria-invalid={invalid ? true : undefined}
                      onChange={(e) => patch(index, { quantity: e.target.value })}
                      className={tierBox}
                    />
                  </div>
                  <div className="col-span-2 min-w-0 space-y-1 sm:col-span-1">
                    <Label htmlFor={`tier-t-${index}`}>{t.type}</Label>
                    <Select
                      id={`tier-t-${index}`}
                      className={TOUCH_FIELD}
                      value={tier.discountType}
                      onChange={(e) => patch(index, { discountType: e.target.value as BundleDiscountType, value: "" })}
                    >
                      {BUNDLE_DISCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t[`type_${type}`]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <Label htmlFor={`tier-v-${index}`}>{t.value}</Label>
                    <Input
                      id={`tier-v-${index}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={tier.discountType === "buy_x_get_y" ? 1 : "0.01"}
                      dir="ltr"
                      value={tier.value}
                      aria-invalid={invalid ? true : undefined}
                      onChange={(e) => patch(index, { value: e.target.value })}
                      className={tierBox}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={fmt(t.remove, { n: index + 1 })}
                    title={fmt(t.remove, { n: index + 1 })}
                    disabled={tiers.length <= 1}
                    onClick={() => {
                      setTiers((current) => current.filter((_, i) => i !== index));
                      setBadTier(null);
                    }}
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <IconDelete className="size-[18px]" aria-hidden />
                  </button>
                </div>
                {invalid && (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {t[`fix_${tier.discountType}`]}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`tier-title-${index}`}>{t.title}</Label>
                    <Input
                      id={`tier-title-${index}`}
                      placeholder={t.titlePlaceholder}
                      maxLength={200}
                      value={tier.title}
                      onChange={(e) => patch(index, { title: e.target.value })}
                      className={TOUCH_FIELD}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tier-label-${index}`}>{t.label}</Label>
                    <Input
                      id={`tier-label-${index}`}
                      placeholder={t.labelPlaceholder}
                      maxLength={100}
                      value={tier.label}
                      onChange={(e) => patch(index, { label: e.target.value })}
                      className={TOUCH_FIELD}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 text-sm text-ink">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-primary"
                      checked={tier.freeShipping}
                      onChange={(e) => patch(index, { freeShipping: e.target.checked })}
                    />
                    {t.freeShipping}
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="bundle-default-tier"
                      className="size-5 shrink-0 cursor-pointer accent-primary"
                      checked={tier.isDefault}
                      onChange={() => setTiers((current) => current.map((x, i) => ({ ...x, isDefault: i === index })))}
                    />
                    {t.isDefault}
                  </label>
                </div>
              </fieldset>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full px-4 md:min-h-9"
            disabled={busy || tiers.length >= BUNDLE_MAX_TIERS}
            onClick={() =>
              setTiers((current) => [
                ...current,
                blank(Math.max(0, ...current.map((x) => Number(x.quantity) || 0)) + 1, "percentage", "0"),
              ])
            }
          >
            <IconPlus className="size-4" aria-hidden />
            {t.addTier}
          </Button>
        </div>

        {/* What the shopper is offered, priced by the server for a sample piece price. */}
        <OfferPreview label={t.preview}>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="bundle-sample" className="text-xs font-normal text-ink-soft">
              {t.previewPrice}
            </Label>
            <Input
              id="bundle-sample"
              type="number"
              inputMode="decimal"
              min={0}
              dir="ltr"
              value={samplePrice}
              // The sample price is not part of the bundle: it never makes the sheet ask before closing.
              onInput={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                setSamplePrice(e.target.value);
              }}
              className={cn("w-28", tierBox)}
            />
          </div>
          {preview ? (
            <ul className="divide-y divide-line">
              {preview.map((row) => (
                <li key={row.quantity} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                  <span className="min-w-0 font-medium text-ink">
                    <bdi>{fmt(t.previewLine, { pieces: countOf("piece", row.quantity), total: formatMoney(row.total) })}</bdi>
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-ink-soft tabular-nums">
                    <bdi>{fmt(t.previewEach, { each: formatMoney(row.perUnit) })}</bdi>
                    {row.discount > 0 && (
                      <bdi className="font-medium text-success">{fmt(t.previewSave, { amount: formatMoney(row.discount) })}</bdi>
                    )}
                    {row.freeShipping && <span className="font-medium text-primary">{t.previewFree}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-soft">{t.previewFailed}</p>
          )}
        </OfferPreview>

        <FormProblem>{error}</FormProblem>
      </div>
    </Modal>
  );
}
