import { useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type {
  ShippingRate,
  ShippingRateType,
  ShippingZone,
  TaxRate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import {
  basisPointsToPercentInput,
  formatMoney,
  formatPercent,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { SettingsLayout, SettingsPane, useSettingsSection } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CarrierConnectionsSection } from "./CarrierConnectionsSection";
import { ShippingSettingsSection } from "./ShippingSettingsSection";
import { CouriersSection } from "./CouriersSection";
import { DeliveryZonesSection } from "./DeliveryZonesSection";
import { StoreHoursSection } from "./StoreHoursSection";
import { ShippingProfilesSection } from "./ShippingProfilesSection";
import { ShippingOptionsSection } from "./ShippingOptionsSection";
import { shippingTabOf, useShippingSections } from "./ShippingTabs";
import { WeightTiersSection } from "./WeightTiersSection";
import { TRACKING_PROVIDERS_ENABLED } from "@/lib/features";
import { ManualTrackingCard } from "./ManualTrackingCard";

// Read as `tr` (not `t`) in this file: the tax-rate and tier loops below
// already use `t` for their item.
const STRINGS = {
  en: {
    title: "Shipping & Tax",
    description: "Shipping zones and their rates, plus the tax rates applied at checkout.",
    // shared
    name: "Name",
    amount: "Amount",
    country: "Country",
    optional: "Optional.",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    saving: "Saving…",
    working: "Working…",
    activate: "Activate",
    deactivate: "Deactivate",
    activated: '"{name}" activated.',
    deactivated: '"{name}" deactivated.',
    added: '"{name}" added.',
    deleted: '"{name}" deleted.',
    deleteTitle: 'Delete "{name}"?',
    // zones
    zonesHeading: "Shipping zones",
    zonesEmpty: "No shipping zones yet. Add your first one.",
    addZone: "Add zone",
    editZone: "Edit zone",
    saveZone: "Save zone",
    zoneSaved: "Zone saved.",
    zoneActive: "Active",
    zoneInactive: "Inactive",
    zoneNamePlaceholder: "Domestic",
    countries: "Countries",
    countriesHint: "Two-letter codes separated by commas, e.g. EG, SA.",
    noCountries: "No countries",
    deleteZoneBody:
      "Removing a zone deletes its rates too. Orders already placed keep the shipping amount they were charged.",
    deleteZoneConfirm: "Delete zone",
    // rates
    ratesEmpty: "No rates in this zone yet.",
    addRate: "Add rate",
    editRate: "Edit rate",
    saveRate: "Save rate",
    rateSaved: "Rate saved.",
    rateDeleted: "Rate deleted.",
    rateActive: "Active",
    rateInactive: "Inactive",
    colRate: "Rate",
    colType: "Type",
    colDetail: "Detail",
    colDelivery: "Delivery",
    colCarrier: "Carrier",
    colStatus: "Status",
    deleteRateBody: "This shipping rate is removed immediately. Past orders are unaffected.",
    deleteRateConfirm: "Delete rate",
    rateTypeFlat: "Flat",
    rateTypeWeight: "Weight based",
    rateTypeQuantity: "Quantity based",
    rateTypeOrderValue: "Order value based",
    rateTypeFree: "Free",
    noCharge: "No charge",
    tierCountOne: "{count} tier",
    tierCountMany: "{count} tiers",
    dayOne: "{n} day",
    dayMany: "{n} days",
    dayRange: "{min}–{max} days",
    daysFrom: "from {days}",
    daysUpTo: "up to {days}",
    // rate form
    rateNamePlaceholder: "Standard",
    rateType: "Rate type",
    freeRateNote: "A free rate has no extra settings.",
    tiers: "Tiers",
    addTier: "+ Add tier",
    removeTier: "Remove tier",
    upToGrams: "Up to (grams)",
    upToQuantity: "Up to (quantity)",
    minSubtotal: "Minimum subtotal",
    overflowAmount: "Overflow amount",
    overflowHint: "Charged when the order is heavier / larger than every tier.",
    carrierCode: "Carrier code",
    estMinDays: "Est. delivery — min days",
    estMinDaysHint: "Optional. Shown to shoppers at checkout.",
    estMaxDays: "Est. delivery — max days",
    errAmount: "Enter a valid amount.",
    errNoTiers: "Add at least one tier.",
    errTierAmount: "Every tier needs a valid amount.",
    errTierSubtotal: "Every tier needs a valid minimum subtotal.",
    errTierWeight: "Every tier needs a valid weight in grams.",
    errTierQuantity: "Every tier needs a valid quantity.",
    errDays: "Whole number of days, 0–3650.",
    errDaysOrder: "Max days can't be less than min days.",
    // tax rates
    taxHeading: "Tax rates",
    taxOffNote:
      "Tax is turned off for this store — these rates aren’t applied at checkout. Turn it on above to use them.",
    taxEmpty: "No tax rates yet. Add your first one.",
    addTax: "Add tax rate",
    editTax: "Edit tax rate",
    saveTax: "Save tax rate",
    taxSaved: "Tax rate saved.",
    taxRate: "Rate",
    appliesToShipping: "Applies to shipping",
    colPricesIncludeTax: "Prices include tax",
    pricesAlreadyIncludeTax: "Prices already include tax",
    taxNamePlaceholder: "VAT",
    countryHint: "Optional, two-letter code.",
    region: "Region",
    taxRateHint: "Percentage, e.g. 14 for 14%.",
    errPercent: "Enter a percentage of 0 or more.",
    errCountry: "Use a two-letter country code.",
    deleteTaxBody: "This tax rate is removed immediately. Past orders keep the tax they were charged.",
    deleteTaxConfirm: "Delete tax rate",
    // storewide tax switch
    taxSettingTitle: "Tax at checkout",
    taxSettingDescription: "Whether the tax rates below are added to orders.",
    chargeTax: "Charge tax at checkout",
    saveTaxSetting: "Save tax setting",
    taxSettingSaved: "Tax setting saved.",
  },
  ar: {
    title: "الشحن والضرائب",
    description: "مناطق الشحن وأسعارها، ونسب الضريبة التي تُطبَّق في صفحة الدفع.",
    name: "الاسم",
    amount: "المبلغ",
    country: "الدولة",
    optional: "اختياري.",
    edit: "تعديل",
    delete: "حذف",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    working: "جارٍ التنفيذ…",
    activate: "تفعيل",
    deactivate: "إيقاف",
    activated: "تم تفعيل «{name}».",
    deactivated: "تم إيقاف «{name}».",
    added: "تمت إضافة «{name}».",
    deleted: "تم حذف «{name}».",
    deleteTitle: "حذف «{name}»؟",
    zonesHeading: "مناطق الشحن",
    zonesEmpty: "لا توجد مناطق شحن بعد. أضف أول منطقة.",
    addZone: "إضافة منطقة",
    editZone: "تعديل المنطقة",
    saveZone: "حفظ المنطقة",
    zoneSaved: "تم حفظ المنطقة.",
    zoneActive: "نشطة",
    zoneInactive: "غير نشطة",
    zoneNamePlaceholder: "داخل مصر",
    countries: "الدول",
    countriesHint: "أكواد من حرفين مفصولة بفواصل، مثل EG, SA.",
    noCountries: "بدون دول",
    deleteZoneBody: "حذف المنطقة يحذف أسعارها أيضًا. الطلبات المسجّلة من قبل تحتفظ بمبلغ الشحن الذي حُسب عليها.",
    deleteZoneConfirm: "حذف المنطقة",
    ratesEmpty: "لا توجد أسعار في هذه المنطقة بعد.",
    addRate: "إضافة سعر",
    editRate: "تعديل السعر",
    saveRate: "حفظ السعر",
    rateSaved: "تم حفظ السعر.",
    rateDeleted: "تم حذف السعر.",
    rateActive: "نشط",
    rateInactive: "غير نشط",
    colRate: "سعر الشحن",
    colType: "النوع",
    colDetail: "التفاصيل",
    colDelivery: "مدة التوصيل",
    colCarrier: "شركة الشحن",
    colStatus: "الحالة",
    deleteRateBody: "يُحذف سعر الشحن هذا فورًا. الطلبات السابقة لا تتأثر.",
    deleteRateConfirm: "حذف السعر",
    rateTypeFlat: "سعر ثابت",
    rateTypeWeight: "حسب الوزن",
    rateTypeQuantity: "حسب الكمية",
    rateTypeOrderValue: "حسب قيمة الطلب",
    rateTypeFree: "مجاني",
    noCharge: "بدون رسوم",
    tierCountOne: "شريحة واحدة",
    tierCountMany: "{count} شرائح",
    dayOne: "يوم واحد",
    dayMany: "{n} أيام",
    dayRange: "من {min} إلى {max} أيام",
    daysFrom: "ابتداءً من {days}",
    daysUpTo: "حتى {days}",
    rateNamePlaceholder: "شحن عادي",
    rateType: "نوع السعر",
    freeRateNote: "السعر المجاني ليس له إعدادات إضافية.",
    tiers: "الشرائح",
    addTier: "+ إضافة شريحة",
    removeTier: "حذف الشريحة",
    upToGrams: "حتى (جرام)",
    upToQuantity: "حتى (كمية)",
    minSubtotal: "الحد الأدنى للمجموع الفرعي",
    overflowAmount: "المبلغ عند تجاوز الشرائح",
    overflowHint: "يُحتسب عندما يكون الطلب أثقل / أكبر من كل الشرائح.",
    carrierCode: "كود شركة الشحن",
    estMinDays: "مدة التوصيل المتوقعة — أقل عدد أيام",
    estMinDaysHint: "اختياري. يظهر للعملاء في صفحة الدفع.",
    estMaxDays: "مدة التوصيل المتوقعة — أقصى عدد أيام",
    errAmount: "أدخل مبلغًا صحيحًا.",
    errNoTiers: "أضف شريحة واحدة على الأقل.",
    errTierAmount: "كل شريحة تحتاج مبلغًا صحيحًا.",
    errTierSubtotal: "كل شريحة تحتاج حدًا أدنى صحيحًا للمجموع الفرعي.",
    errTierWeight: "كل شريحة تحتاج وزنًا صحيحًا بالجرام.",
    errTierQuantity: "كل شريحة تحتاج كمية صحيحة.",
    errDays: "عدد صحيح من الأيام، من 0 إلى 3650.",
    errDaysOrder: "لا يمكن أن يكون أقصى عدد أيام أقل من أقل عدد أيام.",
    taxHeading: "نسب الضريبة",
    taxOffNote: "الضريبة متوقفة في هذا المتجر — هذه النسب لا تُطبَّق في صفحة الدفع. فعّل الضريبة من الأعلى لاستخدامها.",
    taxEmpty: "لا توجد نسب ضريبة بعد. أضف أول نسبة.",
    addTax: "إضافة نسبة ضريبة",
    editTax: "تعديل نسبة الضريبة",
    saveTax: "حفظ نسبة الضريبة",
    taxSaved: "تم حفظ نسبة الضريبة.",
    taxRate: "النسبة",
    appliesToShipping: "تُطبَّق على الشحن",
    colPricesIncludeTax: "الأسعار شاملة الضريبة",
    pricesAlreadyIncludeTax: "الأسعار شاملة الضريبة بالفعل",
    taxNamePlaceholder: "ضريبة القيمة المضافة",
    countryHint: "اختياري، كود من حرفين.",
    region: "المحافظة",
    taxRateHint: "نسبة مئوية، مثل 14 لـ 14%.",
    errPercent: "أدخل نسبة مئوية تساوي 0 أو أكثر.",
    errCountry: "استخدم كود دولة من حرفين.",
    deleteTaxBody: "تُحذف نسبة الضريبة هذه فورًا. الطلبات السابقة تحتفظ بالضريبة التي حُسبت عليها.",
    deleteTaxConfirm: "حذف نسبة الضريبة",
    taxSettingTitle: "الضريبة في صفحة الدفع",
    taxSettingDescription: "حدّد هل تُضاف نسب الضريبة أدناه إلى الطلبات.",
    chargeTax: "احتساب الضريبة في صفحة الدفع",
    saveTaxSetting: "حفظ إعداد الضريبة",
    taxSettingSaved: "تم حفظ إعداد الضريبة.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const RATE_TYPE_LABEL: Record<ShippingRateType, keyof Strings> = {
  flat: "rateTypeFlat",
  weight_based: "rateTypeWeight",
  quantity_based: "rateTypeQuantity",
  order_value_based: "rateTypeOrderValue",
  free: "rateTypeFree",
};

/** Reads a JSONB config number that may arrive as a number or a BIGINT string. */
function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function rateSummary(r: ShippingRate, tr: Strings): string {
  const cfg = r.config ?? {};
  switch (r.rateType) {
    case "flat":
      return formatMoney(numOrUndef(cfg.amount));
    case "free":
      return tr.noCharge;
    default: {
      const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
      return fmt(tiers.length === 1 ? tr.tierCountOne : tr.tierCountMany, { count: tiers.length });
    }
  }
}

/** "2–5 days" / "3 days" / "from 2 days" / "up to 5 days" / "—". */
function rateDeliveryLabel(r: ShippingRate, tr: Strings): string {
  const min = r.estimatedDeliveryMinDays;
  const max = r.estimatedDeliveryMaxDays;
  const unit = (n: number) => fmt(n === 1 ? tr.dayOne : tr.dayMany, { n });
  if (min != null && max != null) return min === max ? unit(min) : fmt(tr.dayRange, { min, max });
  if (min != null) return fmt(tr.daysFrom, { days: unit(min) });
  if (max != null) return fmt(tr.daysUpTo, { days: unit(max) });
  return "—";
}

/**
 * Parse an optional whole-day field. "" → null (clear / leave unset), a valid
 * 0–3650 integer → that number, anything else → "invalid". Mirrors the backend
 * Joi rule `number().integer().min(0).max(3650).allow(null)`.
 */
function parseDays(input: string): number | null | "invalid" {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > 3650) return "invalid";
  return n;
}

export function ShippingTaxPage() {
  // Key the body on the workspace so all workspace-seeded state (the settings
  // block, the lifted tax toggle) re-initialises on a store switch, mirroring
  // how SettingsPage keys its sections. Avoids a re-sync effect.
  const workspaceId = useWorkspaceId();
  return <ShippingTaxBody key={workspaceId} />;
}

function ShippingTaxBody() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh: refreshWorkspace } = useWorkspace();
  const toast = useToast();
  const tr = useT(STRINGS);
  const zones = useAsync(() => apiClient.listShippingZones(workspaceId), [workspaceId]);
  const taxRates = useAsync(() => apiClient.listTaxRates(workspaceId), [workspaceId]);

  const [zoneForm, setZoneForm] = useState<ShippingZone | "new" | null>(null);
  const [deletingZone, setDeletingZone] = useState<ShippingZone | null>(null);
  const [rateForm, setRateForm] = useState<{ zoneId: string; rate?: ShippingRate } | null>(null);
  const [deletingRate, setDeletingRate] = useState<ShippingRate | null>(null);
  const [taxForm, setTaxForm] = useState<TaxRate | "new" | null>(null);
  const [deletingTax, setDeletingTax] = useState<TaxRate | null>(null);

  // Lifted so the toggle in the settings block drives the tax section's
  // de-emphasis live, before a save lands. Seeded from the workspace; a save
  // persists exactly this value, so it stays consistent without re-syncing.
  const [taxEnabled, setTaxEnabled] = useState(Boolean(currentWorkspace?.settings?.tax_enabled));

  const reloadZones = () => zones.refresh({ silent: true });
  const reloadTax = () => taxRates.refresh({ silent: true });
  const zoneList = zones.data ?? [];
  const taxList = taxRates.data ?? [];

  async function toggleZoneActive(zone: ShippingZone) {
    try {
      await apiClient.updateShippingZone(workspaceId, zone.id, { isActive: !zone.isActive });
      toast.success(fmt(zone.isActive ? tr.deactivated : tr.activated, { name: zone.name }));
      reloadZones();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function toggleRateActive(rate: ShippingRate) {
    try {
      await apiClient.updateShippingRate(workspaceId, rate.id, { isActive: !rate.isActive });
      toast.success(fmt(rate.isActive ? tr.deactivated : tr.activated, { name: rate.name }));
      reloadZones();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDeleteZone() {
    if (!deletingZone) return;
    await apiClient.deleteShippingZone(workspaceId, deletingZone.id);
    toast.success(fmt(tr.deleted, { name: deletingZone.name }));
    setDeletingZone(null);
    reloadZones();
  }

  async function confirmDeleteRate() {
    if (!deletingRate) return;
    await apiClient.deleteShippingRate(workspaceId, deletingRate.id);
    toast.success(tr.rateDeleted);
    setDeletingRate(null);
    reloadZones();
  }

  async function confirmDeleteTax() {
    if (!deletingTax) return;
    await apiClient.deleteTaxRate(workspaceId, deletingTax.id);
    toast.success(fmt(tr.deleted, { name: deletingTax.name }));
    setDeletingTax(null);
    reloadTax();
  }

  const { sections, searchPlaceholder } = useShippingSections();
  const { current, select } = useSettingsSection(sections);
  // What the pane holds: the section in the address, or the first.
  const tab = shippingTabOf(current);
  const shown = sections.find((section) => section.id === tab) ?? sections[0];

  return (
    <SettingsLayout title={tr.title} sections={sections} current={current} onSelect={select} searchPlaceholder={searchPlaceholder}>
      <SettingsPane title={shown.label} description={shown.description} icon={shown.icon} tone={shown.tone}>
        <div className="space-y-12">

      {tab === "rates" && <ShippingSettingsSection onSaved={refreshWorkspace} />}

      {tab === "rates" && <DeliveryZonesSection currency={currentWorkspace?.defaultCurrency ?? "EGP"} />}

      {tab === "rates" && <CouriersSection />}

      {tab === "rates" && <StoreHoursSection />}

      {tab === "rates" && <ShippingProfilesSection />}

      {tab === "options" && <ShippingOptionsSection />}

      {tab === "carriers" && <CarrierConnectionsSection />}

      {/* Tracking for shipments sent by hand: one card under the couriers (lib/features). */}
      {tab === "carriers" && TRACKING_PROVIDERS_ENABLED && <ManualTrackingCard />}

      {tab === "taxes" && (
        <StoreShippingTaxSettings
          taxEnabled={taxEnabled}
          onTaxEnabledChange={setTaxEnabled}
          onSaved={refreshWorkspace}
        />
      )}

      {tab === "rates" && (
        <WeightTiersSection
          zones={zoneList}
          workspace={currentWorkspace}
          currency="EGP"
          onWorkspaceChanged={refreshWorkspace}
        />
      )}

      {tab === "rates" && (
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium text-ink">{tr.zonesHeading}</h2>
          <Button onClick={() => setZoneForm("new")}>{tr.addZone}</Button>
        </div>

        <DataState
          loading={zones.loading}
          error={zones.error}
          empty={zoneList.length === 0}
          emptyMessage={tr.zonesEmpty}
          onRetry={() => zones.refresh()}
        >
          <div className="space-y-4">
            {zoneList.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onEditZone={() => setZoneForm(zone)}
                onDeleteZone={() => setDeletingZone(zone)}
                onToggleZone={() => toggleZoneActive(zone)}
                onAddRate={() => setRateForm({ zoneId: zone.id })}
                onEditRate={(rate) => setRateForm({ zoneId: zone.id, rate })}
                onDeleteRate={(rate) => setDeletingRate(rate)}
                onToggleRate={(rate) => toggleRateActive(rate)}
              />
            ))}
          </div>
        </DataState>
      </section>

      )}

      {tab === "taxes" && (
      <section className={cn("transition-opacity", !taxEnabled && "opacity-60")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">{tr.taxHeading}</h2>
            {!taxEnabled && (
              <p className="mt-1 text-xs text-ink-soft">
                {tr.taxOffNote}
              </p>
            )}
          </div>
          <Button onClick={() => setTaxForm("new")}>{tr.addTax}</Button>
        </div>

        <DataState
          loading={taxRates.loading}
          error={taxRates.error}
          empty={taxList.length === 0}
          emptyMessage={tr.taxEmpty}
          onRetry={() => taxRates.refresh()}
        >
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">{tr.name}</th>
                  <th className="px-4 py-3 font-medium">{tr.country}</th>
                  <th className="px-4 py-3 font-medium">{tr.taxRate}</th>
                  <th className="px-4 py-3 font-medium">{tr.appliesToShipping}</th>
                  <th className="px-4 py-3 font-medium">{tr.colPricesIncludeTax}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {taxList.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{t.country || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatPercent(t.rateBasisPoints)}</td>
                    <td className="px-4 py-3 text-ink-soft">{t.appliesToShipping ? "✓" : "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{t.pricesIncludeTax ? "✓" : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      <Button size="sm" variant="ghost" onClick={() => setTaxForm(t)}>
                        {tr.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeletingTax(t)}
                      >
                        {tr.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>
      )}

      <Modal
        open={zoneForm !== null}
        onClose={() => setZoneForm(null)}
        title={zoneForm === "new" ? tr.addZone : tr.editZone}
      >
        {zoneForm !== null && (
          <ZoneForm
            key={zoneForm === "new" ? "new" : zoneForm.id}
            zone={zoneForm === "new" ? undefined : zoneForm}
            onCancel={() => setZoneForm(null)}
            onDone={() => {
              setZoneForm(null);
              reloadZones();
            }}
          />
        )}
      </Modal>

      <Modal
        open={rateForm !== null}
        onClose={() => setRateForm(null)}
        title={rateForm?.rate ? tr.editRate : tr.addRate}
      >
        {rateForm !== null && (
          <RateForm
            key={rateForm.rate ? rateForm.rate.id : `new-${rateForm.zoneId}`}
            zoneId={rateForm.zoneId}
            rate={rateForm.rate}
            onCancel={() => setRateForm(null)}
            onDone={() => {
              setRateForm(null);
              reloadZones();
            }}
          />
        )}
      </Modal>

      <Modal
        open={taxForm !== null}
        onClose={() => setTaxForm(null)}
        title={taxForm === "new" ? tr.addTax : tr.editTax}
      >
        {taxForm !== null && (
          <TaxRateForm
            key={taxForm === "new" ? "new" : taxForm.id}
            taxRate={taxForm === "new" ? undefined : taxForm}
            onCancel={() => setTaxForm(null)}
            onDone={() => {
              setTaxForm(null);
              reloadTax();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deletingZone !== null}
        title={fmt(tr.deleteTitle, { name: deletingZone?.name ?? "" })}
        description={tr.deleteZoneBody}
        confirmLabel={tr.deleteZoneConfirm}
        cancelLabel={tr.cancel}
        busyLabel={tr.working}
        destructive
        onCancel={() => setDeletingZone(null)}
        onConfirm={confirmDeleteZone}
      />

      <ConfirmDialog
        open={deletingRate !== null}
        title={fmt(tr.deleteTitle, { name: deletingRate?.name ?? "" })}
        description={tr.deleteRateBody}
        confirmLabel={tr.deleteRateConfirm}
        cancelLabel={tr.cancel}
        busyLabel={tr.working}
        destructive
        onCancel={() => setDeletingRate(null)}
        onConfirm={confirmDeleteRate}
      />

      <ConfirmDialog
        open={deletingTax !== null}
        title={fmt(tr.deleteTitle, { name: deletingTax?.name ?? "" })}
        description={tr.deleteTaxBody}
        confirmLabel={tr.deleteTaxConfirm}
        cancelLabel={tr.cancel}
        busyLabel={tr.working}
        destructive
        onCancel={() => setDeletingTax(null)}
        onConfirm={confirmDeleteTax}
      />
        </div>
      </SettingsPane>
    </SettingsLayout>
  );
}

function ZoneCard({
  zone,
  onEditZone,
  onDeleteZone,
  onToggleZone,
  onAddRate,
  onEditRate,
  onDeleteRate,
  onToggleRate,
}: {
  zone: ShippingZone;
  onEditZone: () => void;
  onDeleteZone: () => void;
  onToggleZone: () => void;
  onAddRate: () => void;
  onEditRate: (rate: ShippingRate) => void;
  onDeleteRate: (rate: ShippingRate) => void;
  onToggleRate: (rate: ShippingRate) => void;
}) {
  const tr = useT(STRINGS);
  const rates = zone.rates ?? [];
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line p-4",
        !zone.isActive && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{zone.name}</p>
            <StatusBadge
              value={zone.isActive ? "active" : "inactive"}
              text={zone.isActive ? tr.zoneActive : tr.zoneInactive}
            />
          </div>
          <p className="text-xs text-ink-soft">
            {zone.countries.length ? zone.countries.join(", ") : tr.noCountries}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onToggleZone}>
            {zone.isActive ? tr.deactivate : tr.activate}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEditZone}>
            {tr.edit}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={onDeleteZone}
          >
            {tr.delete}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {rates.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr.ratesEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-[0.5rem] border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2 font-medium">{tr.colRate}</th>
                  <th className="px-3 py-2 font-medium">{tr.colType}</th>
                  <th className="px-3 py-2 font-medium">{tr.colDetail}</th>
                  <th className="px-3 py-2 font-medium">{tr.colDelivery}</th>
                  <th className="px-3 py-2 font-medium">{tr.colCarrier}</th>
                  <th className="px-3 py-2 font-medium">{tr.colStatus}</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr
                    key={rate.id}
                    className={cn(
                      "border-b border-line last:border-0",
                      !rate.isActive && "opacity-60"
                    )}
                  >
                    <td className="px-3 py-2 text-ink">{rate.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{tr[RATE_TYPE_LABEL[rate.rateType]]}</td>
                    <td className="px-3 py-2 text-ink-soft">{rateSummary(rate, tr)}</td>
                    <td className="px-3 py-2 text-ink-soft">{rateDeliveryLabel(rate, tr)}</td>
                    <td className="px-3 py-2 text-ink-soft">{rate.carrierCode || "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        value={rate.isActive ? "active" : "inactive"}
                        text={rate.isActive ? tr.rateActive : tr.rateInactive}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-end">
                      <Button size="sm" variant="ghost" onClick={() => onToggleRate(rate)}>
                        {rate.isActive ? tr.deactivate : tr.activate}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onEditRate(rate)}>
                        {tr.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => onDeleteRate(rate)}
                      >
                        {tr.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2">
          <Button size="sm" variant="outline" onClick={onAddRate}>
            {tr.addRate}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ZoneForm({
  zone,
  onDone,
  onCancel,
}: {
  zone?: ShippingZone;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const [name, setName] = useState(zone?.name ?? "");
  const [countries, setCountries] = useState((zone?.countries ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const countryList = countries
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = { name: name.trim(), countries: countryList };
      if (zone) {
        await apiClient.updateShippingZone(workspaceId, zone.id, payload);
        toast.success(tr.zoneSaved);
      } else {
        await apiClient.createShippingZone(workspaceId, payload);
        toast.success(fmt(tr.added, { name: payload.name }));
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
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField
        label={tr.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={tr.zoneNamePlaceholder}
      />
      <TextField
        label={tr.countries}
        value={countries}
        onChange={(e) => setCountries(e.target.value)}
        error={fieldErrors.countries}
        hint={tr.countriesHint}
        placeholder="EG, SA"
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {tr.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? tr.saving : zone ? tr.saveZone : tr.addZone}
        </Button>
      </div>
    </form>
  );
}

interface TierDraft {
  threshold: string;
  amount: string;
}

function RateForm({
  zoneId,
  rate,
  onDone,
  onCancel,
}: {
  zoneId: string;
  rate?: ShippingRate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const cfg = (rate?.config ?? {}) as Record<string, unknown>;

  const [name, setName] = useState(rate?.name ?? "");
  const [rateType, setRateType] = useState<ShippingRateType>(rate?.rateType ?? "flat");
  const [carrierCode, setCarrierCode] = useState(rate?.carrierCode ?? "");
  const [flatAmount, setFlatAmount] = useState(
    rate?.rateType === "flat" ? minorToMajorInput(numOrUndef(cfg.amount)) : ""
  );
  const [overflowAmount, setOverflowAmount] = useState(minorToMajorInput(numOrUndef(cfg.overflowAmount)));
  const [tiers, setTiers] = useState<TierDraft[]>(() => {
    const raw = Array.isArray(cfg.tiers) ? (cfg.tiers as Array<Record<string, unknown>>) : [];
    if (raw.length === 0) return [{ threshold: "", amount: "" }];
    return raw.map((t) => ({
      threshold:
        rate?.rateType === "order_value_based"
          ? minorToMajorInput(numOrUndef(t.minSubtotal))
          : String(numOrUndef(rate?.rateType === "weight_based" ? t.upToGrams : t.upToQuantity) ?? ""),
      amount: minorToMajorInput(numOrUndef(t.amount)),
    }));
  });
  const [estMinDays, setEstMinDays] = useState(
    rate?.estimatedDeliveryMinDays != null ? String(rate.estimatedDeliveryMinDays) : ""
  );
  const [estMaxDays, setEstMaxDays] = useState(
    rate?.estimatedDeliveryMaxDays != null ? String(rate.estimatedDeliveryMaxDays) : ""
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const showTiers =
    rateType === "weight_based" || rateType === "quantity_based" || rateType === "order_value_based";
  const showOverflow = rateType === "weight_based" || rateType === "quantity_based";
  const thresholdIsMoney = rateType === "order_value_based";
  const thresholdLabel =
    rateType === "weight_based"
      ? tr.upToGrams
      : rateType === "quantity_based"
        ? tr.upToQuantity
        : tr.minSubtotal;

  function setTier(index: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function buildConfig():
    | { config: Record<string, unknown> }
    | { errors: Record<string, string> } {
    if (rateType === "free") return { config: {} };

    if (rateType === "flat") {
      const amount = majorToMinor(flatAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { amount: tr.errAmount } };
      }
      return { config: { amount } };
    }

    const cleaned = tiers.filter((t) => t.threshold.trim() !== "" || t.amount.trim() !== "");
    if (cleaned.length === 0) return { errors: { tiers: tr.errNoTiers } };

    const built: Array<Record<string, number>> = [];
    for (const t of cleaned) {
      const amount = majorToMinor(t.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { tiers: tr.errTierAmount } };
      }
      if (rateType === "order_value_based") {
        const minSubtotal = majorToMinor(t.threshold);
        if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
          return { errors: { tiers: tr.errTierSubtotal } };
        }
        built.push({ minSubtotal, amount });
      } else {
        const threshold = Math.floor(Number(t.threshold));
        if (!Number.isFinite(threshold) || threshold < 0) {
          return {
            errors: {
              tiers:
                rateType === "weight_based"
                  ? tr.errTierWeight
                  : tr.errTierQuantity,
            },
          };
        }
        built.push(
          rateType === "weight_based"
            ? { upToGrams: threshold, amount }
            : { upToQuantity: threshold, amount }
        );
      }
    }

    if (rateType === "order_value_based") return { config: { tiers: built } };

    const overflow = overflowAmount.trim() === "" ? 0 : majorToMinor(overflowAmount);
    if (!Number.isFinite(overflow) || overflow < 0) {
      return { errors: { overflowAmount: tr.errAmount } };
    }
    return { config: { tiers: built, overflowAmount: overflow } };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = buildConfig();
    if ("errors" in result) {
      setFieldErrors(result.errors);
      return;
    }

    const minDays = parseDays(estMinDays);
    const maxDays = parseDays(estMaxDays);
    const dayErrors: Record<string, string> = {};
    if (minDays === "invalid") dayErrors.estimatedDeliveryMinDays = tr.errDays;
    if (maxDays === "invalid") dayErrors.estimatedDeliveryMaxDays = tr.errDays;
    if (typeof minDays === "number" && typeof maxDays === "number" && minDays > maxDays) {
      dayErrors.estimatedDeliveryMaxDays = tr.errDaysOrder;
    }
    if (Object.keys(dayErrors).length > 0) {
      setFieldErrors(dayErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        rateType,
        config: result.config,
        carrierCode: carrierCode.trim() || null,
        estimatedDeliveryMinDays: minDays === "invalid" ? null : minDays,
        estimatedDeliveryMaxDays: maxDays === "invalid" ? null : maxDays,
      };
      if (rate) {
        await apiClient.updateShippingRate(workspaceId, rate.id, payload);
        toast.success(tr.rateSaved);
      } else {
        await apiClient.createShippingRate(workspaceId, zoneId, payload);
        toast.success(fmt(tr.added, { name: payload.name }));
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
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={tr.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={tr.rateNamePlaceholder}
      />

      <Field label={tr.rateType} error={fieldErrors.rateType}>
        {({ id }) => (
          <Select
            id={id}
            value={rateType}
            onChange={(e) => setRateType(e.target.value as ShippingRateType)}
          >
            {(Object.keys(RATE_TYPE_LABEL) as ShippingRateType[]).map((t) => (
              <option key={t} value={t}>
                {tr[RATE_TYPE_LABEL[t]]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {rateType === "flat" && (
        <MoneyInput
          label={tr.amount}
          required
          value={flatAmount}
          onChange={setFlatAmount}
          error={fieldErrors.amount}
        />
      )}

      {rateType === "free" && (
        <p className="text-sm text-ink-soft">{tr.freeRateNote}</p>
      )}

      {showTiers && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">{tr.tiers}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTiers((prev) => [...prev, { threshold: "", amount: "" }])}
            >
              {tr.addTier}
            </Button>
          </div>
          {fieldErrors.tiers && (
            <p className="text-xs font-medium text-danger">{fieldErrors.tiers}</p>
          )}
          {tiers.map((tier, i) => (
            <div key={i} className="rounded-[0.5rem] border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {thresholdIsMoney ? (
                  <MoneyInput
                    label={thresholdLabel}
                    value={tier.threshold}
                    onChange={(v) => setTier(i, { threshold: v })}
                  />
                ) : (
                  <Field label={thresholdLabel}>
                    {({ id, ...aria }) => (
                      <Input
                        id={id}
                        {...aria}
                        type="number"
                        min={0}
                        value={tier.threshold}
                        onChange={(e) => setTier(i, { threshold: e.target.value })}
                      />
                    )}
                  </Field>
                )}
                <MoneyInput
                  label={tr.amount}
                  value={tier.amount}
                  onChange={(v) => setTier(i, { amount: v })}
                />
              </div>
              {tiers.length > 1 && (
                <div className="mt-2 text-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    {tr.removeTier}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showOverflow && (
        <MoneyInput
          label={tr.overflowAmount}
          value={overflowAmount}
          onChange={setOverflowAmount}
          error={fieldErrors.overflowAmount}
          hint={tr.overflowHint}
        />
      )}

      <TextField
        label={tr.carrierCode}
        value={carrierCode}
        onChange={(e) => setCarrierCode(e.target.value)}
        error={fieldErrors.carrierCode}
        hint={tr.optional}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={tr.estMinDays}
          error={fieldErrors.estimatedDeliveryMinDays}
          hint={tr.estMinDaysHint}
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              max={3650}
              value={estMinDays}
              onChange={(e) => setEstMinDays(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={tr.estMaxDays}
          error={fieldErrors.estimatedDeliveryMaxDays}
          hint={tr.optional}
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              max={3650}
              value={estMaxDays}
              onChange={(e) => setEstMaxDays(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {tr.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? tr.saving : rate ? tr.saveRate : tr.addRate}
        </Button>
      </div>
    </form>
  );
}

function TaxRateForm({
  taxRate,
  onDone,
  onCancel,
}: {
  taxRate?: TaxRate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const [name, setName] = useState(taxRate?.name ?? "");
  const [country, setCountry] = useState(taxRate?.country ?? "");
  const [region, setRegion] = useState(taxRate?.region ?? "");
  const [rate, setRate] = useState(
    taxRate ? basisPointsToPercentInput(taxRate.rateBasisPoints) : ""
  );
  const [appliesToShipping, setAppliesToShipping] = useState(taxRate?.appliesToShipping ?? false);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(taxRate?.pricesIncludeTax ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const bp = percentToBasisPoints(rate);
    if (!Number.isFinite(bp) || bp < 0) {
      setFieldErrors({ rateBasisPoints: tr.errPercent });
      return;
    }
    const countryValue = country.trim().toUpperCase();
    if (countryValue && countryValue.length !== 2) {
      setFieldErrors({ country: tr.errCountry });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        country: countryValue || null,
        region: region.trim() || null,
        rateBasisPoints: bp,
        appliesToShipping,
        pricesIncludeTax,
      };
      if (taxRate) {
        await apiClient.updateTaxRate(workspaceId, taxRate.id, payload);
        toast.success(tr.taxSaved);
      } else {
        await apiClient.createTaxRate(workspaceId, payload);
        toast.success(fmt(tr.added, { name: payload.name }));
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
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={tr.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={tr.taxNamePlaceholder}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={tr.country}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint={tr.countryHint}
          placeholder="EG"
        />
        <TextField
          label={tr.region}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          error={fieldErrors.region}
          hint={tr.optional}
        />
      </div>

      <Field
        label={tr.taxRate}
        required
        error={fieldErrors.rateBasisPoints}
        hint={tr.taxRateHint}
      >
        {({ id, ...aria }) => (
          <div className="relative">
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="pe-8"
            />
            <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
              %
            </span>
          </div>
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={appliesToShipping}
          onChange={(e) => setAppliesToShipping(e.target.checked)}
        />
        {tr.appliesToShipping}
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={pricesIncludeTax}
          onChange={(e) => setPricesIncludeTax(e.target.checked)}
        />
        {tr.pricesAlreadyIncludeTax}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {tr.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? tr.saving : taxRate ? tr.saveTax : tr.addTax}
        </Button>
      </div>
    </form>
  );
}

/**
 * The storewide tax switch, kept in `workspace.settings` and saved through the
 * same `PATCH /workspaces/:id` used elsewhere. The free-shipping threshold and
 * the default shipping rate used to live here too; they moved to
 * ShippingSettingsSection with the governorate prices, so two forms never
 * write the same keys. `taxEnabled` is owned by the page so the tax section
 * below can react to it before a save lands.
 */
function StoreShippingTaxSettings({
  taxEnabled,
  onTaxEnabledChange,
  onSaved,
}: {
  taxEnabled: boolean;
  onTaxEnabledChange: (value: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await apiClient.updateWorkspace(workspaceId, { settings: { tax_enabled: taxEnabled } });
      toast.success(tr.taxSettingSaved);
      await onSaved();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{tr.taxSettingTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {tr.taxSettingDescription}
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => onTaxEnabledChange(e.target.checked)}
          />
          {tr.chargeTax}
        </label>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? tr.saving : tr.saveTaxSetting}
          </Button>
        </div>
      </form>
    </section>
  );
}
