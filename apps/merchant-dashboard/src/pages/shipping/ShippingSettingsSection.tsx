import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { ShippingSettingsResponse } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Shipping prices",
    description:
      "What customers pay for shipping. The checkout shows this exact amount as soon as the customer picks their governorate, and the order is charged the same.",
    defaultRate: "Default shipping price",
    defaultRateHint: "Charged for any governorate without its own price. Leave blank to charge nothing.",
    threshold: "Free shipping from",
    thresholdHint: "Orders with a subtotal at or above this amount ship free. Leave blank to turn off.",
    carrier: "Default courier",
    carrierHint: "Preselected when you ship an order. You can pick another one per order; the customer's price never changes.",
    carrierNone: "No preference",
    carrierManual: "Manual (I book the courier myself)",
    carrierNotConnected: "{name} (not connected)",
    governorates: "Price per governorate",
    governoratesHint: "Leave a governorate blank to use the default price. Enter 0 to ship there free.",
    tierModeNote:
      "This store prices shipping by weight tier, so the prices per governorate below are not used until you switch back to rate pricing. The default price and free-shipping threshold still apply.",
    invalidAmount: "Enter an amount of 0 or more, or leave it blank.",
    save: "Save shipping prices",
    saving: "Saving…",
    saved: "Shipping prices saved.",
    productNote: "Individual products can also ship free or add an extra fee — set it in each product's details.",
    areas: "Where you deliver",
    areasHint:
      "For stores that deliver with their own couriers. Orders from any other governorate are refused at checkout with a clear message. Keep the governorate field on in the checkout form.",
    areasOnly: "Only deliver to the governorates I tick",
    areasNone: "Tick at least one governorate, or switch this off.",
    minimumNote: "A minimum order amount is set in Offers → Order rules.",
    pickup: "Pickup from the store",
    pickupOn: "Let customers pick up their order from the store",
    pickupHint: "The checkout offers pickup with no delivery fee and no address. Mark the order delivered when the customer collects it.",
    pickupAddress: "Store address shown to the customer",
    pickupPhone: "Store phone",
    pickupNote: "Pickup note (for example: ready in 20 minutes)",
  },
  ar: {
    title: "أسعار الشحن",
    description:
      "ما يدفعه العميل مقابل الشحن. تعرض صفحة الدفع هذا المبلغ نفسه بمجرد أن يختار العميل محافظته، ويُحاسَب الطلب عليه دون تغيير.",
    defaultRate: "سعر الشحن الافتراضي",
    defaultRateHint: "يُطبَّق على أي محافظة ليس لها سعر خاص. اتركه فارغًا لعدم احتساب أي مبلغ.",
    threshold: "الشحن مجاني ابتداءً من",
    thresholdHint: "الطلبات التي يبلغ إجماليها المبدئي هذا المبلغ أو أكثر تُشحن مجانًا. اتركه فارغًا لإيقافه.",
    carrier: "شركة الشحن الافتراضية",
    carrierHint: "تُختار تلقائيًا عند شحن الطلب. يمكنك اختيار شركة أخرى لكل طلب، ولا يتغير السعر الذي دفعه العميل.",
    carrierNone: "بدون تفضيل",
    carrierManual: "يدوي (أحجز مع شركة الشحن بنفسي)",
    carrierNotConnected: "{name} (غير متصلة)",
    governorates: "السعر حسب المحافظة",
    governoratesHint: "اترك المحافظة فارغة لاستخدام السعر الافتراضي، أو أدخل 0 لشحن مجاني إليها.",
    tierModeNote:
      "يحتسب هذا المتجر الشحن حسب شرائح الوزن، لذلك لا تُستخدم أسعار المحافظات أدناه حتى تعود إلى التسعير بالأسعار. يظل السعر الافتراضي وحد الشحن المجاني مطبقين.",
    invalidAmount: "أدخل مبلغًا يساوي 0 أو أكثر، أو اتركه فارغًا.",
    save: "حفظ أسعار الشحن",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ أسعار الشحن.",
    productNote: "يمكن أيضًا جعل شحن منتج بعينه مجانيًا أو إضافة رسوم إضافية عليه — من بيانات كل منتج.",
    areas: "مناطق التوصيل",
    areasHint:
      "للمتاجر التي توصّل بمندوبيها. تُرفض الطلبات من أي محافظة أخرى عند الدفع برسالة واضحة. أبقِ حقل المحافظة ظاهرًا في نموذج الدفع.",
    areasOnly: "التوصيل إلى المحافظات التي أحددها فقط",
    areasNone: "حدّد محافظة واحدة على الأقل، أو أوقف هذا الخيار.",
    minimumNote: "يُضبط الحد الأدنى للطلب من العروض ← قواعد الطلب.",
    pickup: "الاستلام من المتجر",
    pickupOn: "السماح للعملاء باستلام الطلب من المتجر",
    pickupHint: "تعرض صفحة الدفع خيار الاستلام بدون رسوم توصيل وبدون عنوان. حدِّد الطلب كمُسلَّم عندما يستلمه العميل.",
    pickupAddress: "عنوان المتجر الذي يظهر للعميل",
    pickupPhone: "هاتف المتجر",
    pickupNote: "ملاحظة الاستلام (مثال: جاهز خلال 20 دقيقة)",
  },
} satisfies Messages;

/** "" -> null; a valid amount -> minor units; anything else -> "invalid". */
function parseAmount(input: string): number | null | "invalid" {
  if (input.trim() === "") return null;
  const minor = majorToMinor(input);
  return Number.isFinite(minor) && minor >= 0 ? minor : "invalid";
}

/**
 * The store's shipping prices: a default, a price per governorate, a free-
 * shipping threshold and the default courier. Saved through PATCH
 * /shipping/settings (shipping.manage), audited server-side.
 */
export function ShippingSettingsSection({ onSaved }: { onSaved?: () => Promise<void> | void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const data = useAsync(() => apiClient.getShippingSettings(workspaceId), [workspaceId]);

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5" data-search-anchor="shipping-prices">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <DataState loading={data.loading} error={data.error} empty={false} onRetry={() => data.refresh()}>
        {data.data && (
          <SettingsForm
            // Re-seed the form from what the server saved.
            key={JSON.stringify(data.data.settings)}
            initial={data.data}
            onSaved={async (settings) => {
              data.setData({ ...data.data!, settings });
              await onSaved?.();
            }}
          />
        )}
      </DataState>
    </section>
  );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: ShippingSettingsResponse;
  onSaved: (settings: ShippingSettingsResponse["settings"]) => Promise<void>;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { settings, governorates, carriers } = initial;

  const [defaultRate, setDefaultRate] = useState(minorToMajorInput(settings.defaultRateAmount));
  const [threshold, setThreshold] = useState(minorToMajorInput(settings.freeShippingThresholdAmount));
  const [carrier, setCarrier] = useState(settings.defaultCarrierCode ?? "");
  const [areasOnly, setAreasOnly] = useState((settings.servedGovernorates ?? []).length > 0);
  const [served, setServed] = useState<string[]>(settings.servedGovernorates ?? []);
  const [pickup, setPickup] = useState(settings.storePickup ?? { enabled: false, address: "", phone: "", note: "" });
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(governorates.map((g) => [g.code, minorToMajorInput(settings.governorateRates[g.code])]))
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    const errs: Record<string, string> = {};
    const defaultAmount = parseAmount(defaultRate);
    const thresholdAmount = parseAmount(threshold);
    if (defaultAmount === "invalid") errs.defaultRateAmount = t.invalidAmount;
    if (thresholdAmount === "invalid") errs.freeShippingThresholdAmount = t.invalidAmount;
    const governorateRates: Record<string, number> = {};
    for (const g of governorates) {
      const amount = parseAmount(rates[g.code] ?? "");
      if (amount === "invalid") errs[`governorateRates.${g.code}`] = t.invalidAmount;
      else if (amount !== null) governorateRates[g.code] = amount;
    }
    if (areasOnly && served.length === 0) errs.servedGovernorates = t.areasNone;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const saved = await apiClient.updateShippingSettings(workspaceId, {
        defaultRateAmount: defaultAmount as number | null,
        freeShippingThresholdAmount: thresholdAmount as number | null,
        governorateRates,
        defaultCarrierCode: carrier || null,
        servedGovernorates: areasOnly ? governorates.map((g) => g.code).filter((code) => served.includes(code)) : [],
        storePickup: { ...pickup, address: pickup.address.trim(), phone: pickup.phone.trim(), note: pickup.note.trim() },
      });
      toast.success(t.saved);
      await onSaved(saved);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-5">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label={t.defaultRate}
          value={defaultRate}
          onChange={setDefaultRate}
          error={fieldErrors.defaultRateAmount}
          hint={t.defaultRateHint}
        />
        <MoneyInput
          label={t.threshold}
          value={threshold}
          onChange={setThreshold}
          error={fieldErrors.freeShippingThresholdAmount}
          hint={t.thresholdHint}
        />
      </div>

      <Field label={t.carrier} hint={t.carrierHint} error={fieldErrors.defaultCarrierCode} className="sm:max-w-[calc(50%-0.5rem)]">
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            <option value="">{t.carrierNone}</option>
            <option value="manual">{t.carrierManual}</option>
            {carriers.map((c) => (
              <option key={c.code} value={c.code}>
                {c.connected ? c.name : fmt(t.carrierNotConnected, { name: c.name })}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">{t.governorates}</legend>
        <p className="text-xs text-ink-soft">{t.governoratesHint}</p>
        {settings.pricingMode === "weight_tiers" && <Alert variant="info">{t.tierModeNote}</Alert>}
        {fieldErrors.governorateRates && <p className="text-xs font-medium text-danger">{fieldErrors.governorateRates}</p>}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {governorates.map((g) => (
            <MoneyInput
              key={g.code}
              label={g[locale]}
              value={rates[g.code] ?? ""}
              onChange={(value) => setRates((prev) => ({ ...prev, [g.code]: value }))}
              error={fieldErrors[`governorateRates.${g.code}`]}
              placeholder={defaultRate.trim() || "—"}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">{t.areas}</legend>
        <p className="text-xs text-ink-soft">{t.areasHint}</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={areasOnly} onChange={(e) => setAreasOnly(e.target.checked)} />
          {t.areasOnly}
        </label>
        {areasOnly && (
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {governorates.map((g) => (
              <label key={g.code} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={served.includes(g.code)}
                  onChange={(e) =>
                    setServed((prev) => (e.target.checked ? [...prev, g.code] : prev.filter((code) => code !== g.code)))
                  }
                />
                {g[locale]}
              </label>
            ))}
          </div>
        )}
        {fieldErrors.servedGovernorates && <p className="text-xs font-medium text-danger">{fieldErrors.servedGovernorates}</p>}
        <p className="text-xs text-ink-soft">{t.minimumNote}</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">{t.pickup}</legend>
        <p className="text-xs text-ink-soft">{t.pickupHint}</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={pickup.enabled} onChange={(e) => setPickup({ ...pickup, enabled: e.target.checked })} />
          {t.pickupOn}
        </label>
        {pickup.enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.pickupAddress} error={fieldErrors["storePickup.address"]}>
              {({ id, ...aria }) => (
                <input
                  id={id}
                  {...aria}
                  maxLength={300}
                  value={pickup.address}
                  onChange={(e) => setPickup({ ...pickup, address: e.target.value })}
                  className="w-full rounded-md border border-line bg-paper-raised px-3 py-2 text-sm text-ink"
                />
              )}
            </Field>
            <Field label={t.pickupPhone} error={fieldErrors["storePickup.phone"]}>
              {({ id, ...aria }) => (
                <input
                  id={id}
                  {...aria}
                  dir="ltr"
                  inputMode="tel"
                  maxLength={32}
                  value={pickup.phone}
                  onChange={(e) => setPickup({ ...pickup, phone: e.target.value })}
                  className="w-full rounded-md border border-line bg-paper-raised px-3 py-2 text-sm text-ink"
                />
              )}
            </Field>
            <Field label={t.pickupNote} error={fieldErrors["storePickup.note"]} className="sm:col-span-2">
              {({ id, ...aria }) => (
                <input
                  id={id}
                  {...aria}
                  maxLength={300}
                  value={pickup.note}
                  onChange={(e) => setPickup({ ...pickup, note: e.target.value })}
                  className="w-full rounded-md border border-line bg-paper-raised px-3 py-2 text-sm text-ink"
                />
              )}
            </Field>
          </div>
        )}
      </fieldset>

      <p className="text-xs text-ink-soft">{t.productNote}</p>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
