import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import type { ShippingRate, ShippingRateType, ShippingZone, TaxRate } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
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
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const RATE_TYPE_LABEL: Record<ShippingRateType, string> = {
  flat: "Flat",
  weight_based: "Weight based",
  quantity_based: "Quantity based",
  order_value_based: "Order value based",
  free: "Free",
};

/** Reads a JSONB config number that may arrive as a number or a BIGINT string. */
function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function rateSummary(r: ShippingRate): string {
  const cfg = r.config ?? {};
  switch (r.rateType) {
    case "flat":
      return formatMoney(numOrUndef(cfg.amount));
    case "free":
      return "No charge";
    default: {
      const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
      return `${tiers.length} tier${tiers.length === 1 ? "" : "s"}`;
    }
  }
}

export function ShippingTaxPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const zones = useAsync(() => apiClient.listShippingZones(workspaceId), [workspaceId]);
  const taxRates = useAsync(() => apiClient.listTaxRates(workspaceId), [workspaceId]);

  const [zoneForm, setZoneForm] = useState<ShippingZone | "new" | null>(null);
  const [deletingZone, setDeletingZone] = useState<ShippingZone | null>(null);
  const [rateForm, setRateForm] = useState<{ zoneId: string; rate?: ShippingRate } | null>(null);
  const [deletingRate, setDeletingRate] = useState<ShippingRate | null>(null);
  const [taxForm, setTaxForm] = useState<TaxRate | "new" | null>(null);
  const [deletingTax, setDeletingTax] = useState<TaxRate | null>(null);

  const reloadZones = () => zones.refresh({ silent: true });
  const reloadTax = () => taxRates.refresh({ silent: true });
  const zoneList = zones.data ?? [];
  const taxList = taxRates.data ?? [];

  async function confirmDeleteZone() {
    if (!deletingZone) return;
    await apiClient.deleteShippingZone(workspaceId, deletingZone.id);
    toast.success(`"${deletingZone.name}" deleted.`);
    setDeletingZone(null);
    reloadZones();
  }

  async function confirmDeleteRate() {
    if (!deletingRate) return;
    await apiClient.deleteShippingRate(workspaceId, deletingRate.id);
    toast.success("Rate deleted.");
    setDeletingRate(null);
    reloadZones();
  }

  async function confirmDeleteTax() {
    if (!deletingTax) return;
    await apiClient.deleteTaxRate(workspaceId, deletingTax.id);
    toast.success(`"${deletingTax.name}" deleted.`);
    setDeletingTax(null);
    reloadTax();
  }

  return (
    <div className="max-w-5xl space-y-12">
      <PageHeader
        title="Shipping & Tax"
        description="Shipping zones and their rates, plus the tax rates applied at checkout."
      />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium text-ink">Shipping zones</h2>
          <Button onClick={() => setZoneForm("new")}>Add zone</Button>
        </div>

        <DataState
          loading={zones.loading}
          error={zones.error}
          empty={zoneList.length === 0}
          emptyMessage="No shipping zones yet. Add your first one."
          onRetry={() => zones.refresh()}
        >
          <div className="space-y-4">
            {zoneList.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onEditZone={() => setZoneForm(zone)}
                onDeleteZone={() => setDeletingZone(zone)}
                onAddRate={() => setRateForm({ zoneId: zone.id })}
                onEditRate={(rate) => setRateForm({ zoneId: zone.id, rate })}
                onDeleteRate={(rate) => setDeletingRate(rate)}
              />
            ))}
          </div>
        </DataState>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium text-ink">Tax rates</h2>
          <Button onClick={() => setTaxForm("new")}>Add tax rate</Button>
        </div>

        <DataState
          loading={taxRates.loading}
          error={taxRates.error}
          empty={taxList.length === 0}
          emptyMessage="No tax rates yet. Add your first one."
          onRetry={() => taxRates.refresh()}
        >
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Applies to shipping</th>
                  <th className="px-4 py-3 font-medium">Prices include tax</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setTaxForm(t)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeletingTax(t)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>

      <Modal
        open={zoneForm !== null}
        onClose={() => setZoneForm(null)}
        title={zoneForm === "new" ? "Add zone" : "Edit zone"}
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
        title={rateForm?.rate ? "Edit rate" : "Add rate"}
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
        title={taxForm === "new" ? "Add tax rate" : "Edit tax rate"}
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
        title={`Delete "${deletingZone?.name ?? ""}"?`}
        description="Removing a zone deletes its rates too. Orders already placed keep the shipping amount they were charged."
        confirmLabel="Delete zone"
        destructive
        onCancel={() => setDeletingZone(null)}
        onConfirm={confirmDeleteZone}
      />

      <ConfirmDialog
        open={deletingRate !== null}
        title={`Delete "${deletingRate?.name ?? ""}"?`}
        description="This shipping rate is removed immediately. Past orders are unaffected."
        confirmLabel="Delete rate"
        destructive
        onCancel={() => setDeletingRate(null)}
        onConfirm={confirmDeleteRate}
      />

      <ConfirmDialog
        open={deletingTax !== null}
        title={`Delete "${deletingTax?.name ?? ""}"?`}
        description="This tax rate is removed immediately. Past orders keep the tax they were charged."
        confirmLabel="Delete tax rate"
        destructive
        onCancel={() => setDeletingTax(null)}
        onConfirm={confirmDeleteTax}
      />
    </div>
  );
}

function ZoneCard({
  zone,
  onEditZone,
  onDeleteZone,
  onAddRate,
  onEditRate,
  onDeleteRate,
}: {
  zone: ShippingZone;
  onEditZone: () => void;
  onDeleteZone: () => void;
  onAddRate: () => void;
  onEditRate: (rate: ShippingRate) => void;
  onDeleteRate: (rate: ShippingRate) => void;
}) {
  const rates = zone.rates ?? [];
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{zone.name}</p>
          <p className="text-xs text-ink-soft">
            {zone.countries.length ? zone.countries.join(", ") : "No countries"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEditZone}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={onDeleteZone}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {rates.length === 0 ? (
          <p className="text-sm text-ink-soft">No rates in this zone yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-[0.5rem] border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2 font-medium">Rate</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                  <th className="px-3 py-2 font-medium">Carrier</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink">{rate.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{RATE_TYPE_LABEL[rate.rateType]}</td>
                    <td className="px-3 py-2 text-ink-soft">{rateSummary(rate)}</td>
                    <td className="px-3 py-2 text-ink-soft">{rate.carrierCode || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onEditRate(rate)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => onDeleteRate(rate)}
                      >
                        Delete
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
            Add rate
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
        toast.success("Zone saved.");
      } else {
        await apiClient.createShippingZone(workspaceId, payload);
        toast.success(`"${payload.name}" added.`);
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
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder="Domestic"
      />
      <TextField
        label="Countries"
        value={countries}
        onChange={(e) => setCountries(e.target.value)}
        error={fieldErrors.countries}
        hint="Two-letter codes separated by commas, e.g. EG, SA."
        placeholder="EG, SA"
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? "Saving…" : zone ? "Save zone" : "Add zone"}
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

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const showTiers =
    rateType === "weight_based" || rateType === "quantity_based" || rateType === "order_value_based";
  const showOverflow = rateType === "weight_based" || rateType === "quantity_based";
  const thresholdIsMoney = rateType === "order_value_based";
  const thresholdLabel =
    rateType === "weight_based"
      ? "Up to (grams)"
      : rateType === "quantity_based"
        ? "Up to (quantity)"
        : "Minimum subtotal";

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
        return { errors: { amount: "Enter a valid amount." } };
      }
      return { config: { amount } };
    }

    const cleaned = tiers.filter((t) => t.threshold.trim() !== "" || t.amount.trim() !== "");
    if (cleaned.length === 0) return { errors: { tiers: "Add at least one tier." } };

    const built: Array<Record<string, number>> = [];
    for (const t of cleaned) {
      const amount = majorToMinor(t.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { tiers: "Every tier needs a valid amount." } };
      }
      if (rateType === "order_value_based") {
        const minSubtotal = majorToMinor(t.threshold);
        if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
          return { errors: { tiers: "Every tier needs a valid minimum subtotal." } };
        }
        built.push({ minSubtotal, amount });
      } else {
        const threshold = Math.floor(Number(t.threshold));
        if (!Number.isFinite(threshold) || threshold < 0) {
          return {
            errors: {
              tiers:
                rateType === "weight_based"
                  ? "Every tier needs a valid weight in grams."
                  : "Every tier needs a valid quantity.",
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
      return { errors: { overflowAmount: "Enter a valid amount." } };
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

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        rateType,
        config: result.config,
        carrierCode: carrierCode.trim() || null,
      };
      if (rate) {
        await apiClient.updateShippingRate(workspaceId, rate.id, payload);
        toast.success("Rate saved.");
      } else {
        await apiClient.createShippingRate(workspaceId, zoneId, payload);
        toast.success(`"${payload.name}" added.`);
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
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder="Standard"
      />

      <Field label="Rate type" error={fieldErrors.rateType}>
        {({ id }) => (
          <Select
            id={id}
            value={rateType}
            onChange={(e) => setRateType(e.target.value as ShippingRateType)}
          >
            {(Object.keys(RATE_TYPE_LABEL) as ShippingRateType[]).map((t) => (
              <option key={t} value={t}>
                {RATE_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {rateType === "flat" && (
        <MoneyInput
          label="Amount"
          required
          value={flatAmount}
          onChange={setFlatAmount}
          error={fieldErrors.amount}
        />
      )}

      {rateType === "free" && (
        <p className="text-sm text-ink-soft">A free rate has no extra settings.</p>
      )}

      {showTiers && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">Tiers</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTiers((prev) => [...prev, { threshold: "", amount: "" }])}
            >
              + Add tier
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
                  label="Amount"
                  value={tier.amount}
                  onChange={(v) => setTier(i, { amount: v })}
                />
              </div>
              {tiers.length > 1 && (
                <div className="mt-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove tier
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showOverflow && (
        <MoneyInput
          label="Overflow amount"
          value={overflowAmount}
          onChange={setOverflowAmount}
          error={fieldErrors.overflowAmount}
          hint="Charged when the order is heavier / larger than every tier."
        />
      )}

      <TextField
        label="Carrier code"
        value={carrierCode}
        onChange={(e) => setCarrierCode(e.target.value)}
        error={fieldErrors.carrierCode}
        hint="Optional."
      />

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? "Saving…" : rate ? "Save rate" : "Add rate"}
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
      setFieldErrors({ rateBasisPoints: "Enter a percentage of 0 or more." });
      return;
    }
    const countryValue = country.trim().toUpperCase();
    if (countryValue && countryValue.length !== 2) {
      setFieldErrors({ country: "Use a two-letter country code." });
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
        toast.success("Tax rate saved.");
      } else {
        await apiClient.createTaxRate(workspaceId, payload);
        toast.success(`"${payload.name}" added.`);
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
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder="VAT"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint="Optional, two-letter code."
          placeholder="EG"
        />
        <TextField
          label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          error={fieldErrors.region}
          hint="Optional."
        />
      </div>

      <Field
        label="Rate"
        required
        error={fieldErrors.rateBasisPoints}
        hint="Percentage, e.g. 14 for 14%."
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
              className="pr-8"
            />
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-ink-soft">
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
        Applies to shipping
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={pricesIncludeTax}
          onChange={(e) => setPricesIncludeTax(e.target.checked)}
        />
        Prices already include tax
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? "Saving…" : taxRate ? "Save tax rate" : "Add tax rate"}
        </Button>
      </div>
    </form>
  );
}
