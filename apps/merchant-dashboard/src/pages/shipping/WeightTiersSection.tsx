import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type {
  ShippingZone,
  TierPriceProposal,
  WeightTier,
  WeightTierSettings,
  Workspace,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { formatKg, gramsToKgInput, kgInputToGrams } from "@/lib/weight";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WeightInput } from "@/components/WeightInput";
import { useToast } from "@/components/Toast";
import { useTierLabel } from "./weightTiers";

const MAX_TIERS = 20;

const STRINGS = {
  en: {
    title: "Weight tiers",
    intro:
      "Group orders by total weight. Tiers can price shipping per zone and tell your courier which package to book.",
    modeLabel: "Shipping price",
    modeRates: "From zone rates",
    modeTiers: "By weight tier",
    switchToTiers: "Price by weight tiers…",
    switchToRates: "Switch back to zone rates",
    switchToRatesTitle: "Price shipping from zone rates again?",
    switchToRatesBody: "Checkout goes back to your zone rates. Your tiers and tier prices are kept.",
    switchToRatesConfirm: "Switch to rates",
    switchedToRates: "Shipping is priced from zone rates again.",
    switchedToTiers: "Shipping is now priced by weight tier.",
    noWeightBanner: "{count} product variants have no weight. Shipping weighs them at your default item weight.",
    noWeightBannerOne: "1 product variant has no weight. Shipping weighs it at your default item weight.",
    noWeightLink: "Open products",
    defaultWeight: "Default item weight",
    defaultWeightHint: "Used for any product without a weight. Required for tier pricing.",
    saveDefaultWeight: "Save",
    defaultWeightSaved: "Default item weight saved.",
    kg: "kg",
    tiersHeading: "Tiers",
    tiersHint: "Each tier ends at its weight (included). The first starts at 0 kg; only the last can have no upper limit.",
    tierN: "Tier {n}",
    upTo: "Up to",
    openEnded: "No upper limit",
    addTier: "Add tier",
    removeTier: "Remove tier",
    saveTiers: "Save tiers",
    saving: "Saving…",
    tiersSaved: "Weight tiers saved.",
    noTiers: "No tiers yet. Add your first tier, e.g. up to 1 kg.",
    errTierWeight: "Enter a weight above the previous tier.",
    errTierCount: "Between 1 and 20 tiers.",
    gridHeading: "Price per zone and tier",
    gridHint: "An empty cell has no price: checkout charges your default shipping rate for that tier.",
    gridNoZones: "Add a shipping zone first to price your tiers.",
    gridNoTiers: "Save at least one tier to price it.",
    zone: "Zone",
    inactive: "inactive",
    savePrices: "Save prices",
    pricesSaved: "Tier prices saved.",
    errPrice: "Enter a valid amount, or leave it empty.",
    wizardTitle: "Price shipping by weight tier",
    wizardStep1: "1. Default item weight",
    wizardStep1Hint: "Products without a weight are counted at this weight.",
    wizardStep2: "2. Check the prices",
    wizardStep2Hint:
      "Empty cells are filled from your current zone rates, priced at each tier's heaviest weight. Change anything before switching.",
    wizardFromRates: "from rates",
    wizardFromDefault: "default rate",
    wizardNeedsTiers: "Save at least one weight tier first.",
    wizardNext: "Next",
    wizardBack: "Back",
    wizardSwitch: "Switch to tier pricing",
    cancel: "Cancel",
    errDefaultWeight: "Enter a weight above 0 kg.",
  },
  ar: {
    title: "شرائح الوزن",
    intro: "قسّم الأوردرات حسب الوزن الإجمالي. الشرائح تحدد سعر الشحن لكل منطقة ونوع الشحنة عند شركة الشحن.",
    modeLabel: "سعر الشحن",
    modeRates: "من أسعار المناطق",
    modeTiers: "حسب شريحة الوزن",
    switchToTiers: "التسعير بشرائح الوزن…",
    switchToRates: "الرجوع لأسعار المناطق",
    switchToRatesTitle: "الرجوع لتسعير الشحن من أسعار المناطق؟",
    switchToRatesBody: "صفحة الدفع هترجع تستخدم أسعار المناطق. الشرائح وأسعارها هتفضل محفوظة.",
    switchToRatesConfirm: "الرجوع للأسعار",
    switchedToRates: "سعر الشحن رجع يُحسب من أسعار المناطق.",
    switchedToTiers: "سعر الشحن أصبح يُحسب حسب شريحة الوزن.",
    noWeightBanner: "يوجد {count} متغير منتج بدون وزن. الشحن يحسبها بالوزن الافتراضي للمنتج.",
    noWeightBannerOne: "يوجد متغير منتج واحد بدون وزن. الشحن يحسبه بالوزن الافتراضي للمنتج.",
    noWeightLink: "فتح المنتجات",
    defaultWeight: "الوزن الافتراضي للمنتج",
    defaultWeightHint: "يُستخدم لأي منتج بدون وزن. مطلوب للتسعير بالشرائح.",
    saveDefaultWeight: "حفظ",
    defaultWeightSaved: "تم حفظ الوزن الافتراضي.",
    kg: "كجم",
    tiersHeading: "الشرائح",
    tiersHint: "كل شريحة تنتهي عند وزنها (شاملًا). الأولى تبدأ من 0 كجم، والأخيرة فقط ممكن تكون بدون حد أقصى.",
    tierN: "الشريحة {n}",
    upTo: "حتى",
    openEnded: "بدون حد أقصى",
    addTier: "إضافة شريحة",
    removeTier: "حذف الشريحة",
    saveTiers: "حفظ الشرائح",
    saving: "جارٍ الحفظ…",
    tiersSaved: "تم حفظ شرائح الوزن.",
    noTiers: "لا توجد شرائح بعد. أضف أول شريحة، مثلًا حتى 1 كجم.",
    errTierWeight: "أدخل وزنًا أكبر من الشريحة السابقة.",
    errTierCount: "من شريحة واحدة إلى 20 شريحة.",
    gridHeading: "السعر لكل منطقة وشريحة",
    gridHint: "الخانة الفارغة ليس لها سعر: صفحة الدفع تحسب سعر الشحن الافتراضي لهذه الشريحة.",
    gridNoZones: "أضف منطقة شحن أولًا لتسعير الشرائح.",
    gridNoTiers: "احفظ شريحة واحدة على الأقل لتسعيرها.",
    zone: "المنطقة",
    inactive: "غير نشطة",
    savePrices: "حفظ الأسعار",
    pricesSaved: "تم حفظ أسعار الشرائح.",
    errPrice: "أدخل مبلغًا صحيحًا، أو اتركه فارغًا.",
    wizardTitle: "تسعير الشحن حسب شريحة الوزن",
    wizardStep1: "1. الوزن الافتراضي للمنتج",
    wizardStep1Hint: "المنتجات اللي مالهاش وزن بتتحسب بالوزن ده.",
    wizardStep2: "2. راجع الأسعار",
    wizardStep2Hint: "الخانات الفارغة اتملت من أسعار المناطق الحالية، محسوبة على أثقل وزن في كل شريحة. عدّل أي سعر قبل التحويل.",
    wizardFromRates: "من الأسعار",
    wizardFromDefault: "السعر الافتراضي",
    wizardNeedsTiers: "احفظ شريحة وزن واحدة على الأقل أولًا.",
    wizardNext: "التالي",
    wizardBack: "رجوع",
    wizardSwitch: "التحويل للتسعير بالشرائح",
    cancel: "إلغاء",
    errDefaultWeight: "أدخل وزنًا أكبر من 0 كجم.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const cellKey = (zoneId: string, tierId: string) => `${zoneId}:${tierId}`;

// The forms below seed their state from the server once; a new key after any
// saved change re-seeds them all from the fresh read.
function bodyKey(data: WeightTierSettings): string {
  return JSON.stringify([
    data.pricingMode,
    data.defaultItemWeightGrams,
    data.tiers.map((tier) => [tier.id, tier.upToGrams]),
    data.prices.map((p) => [p.zoneId, p.tierId, p.amount]),
  ]);
}

/** Grid of major-unit strings keyed zone:tier, from stored prices. */
function gridFrom(prices: Array<{ zoneId: string; tierId: string; amount: number }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of prices) out[cellKey(p.zoneId, p.tierId)] = minorToMajorInput(p.amount);
  return out;
}

/** "" → null (no price); a valid ≥ 0 amount → minor units; otherwise "invalid". */
function parseCell(input: string | undefined): number | null | "invalid" {
  if (!input || input.trim() === "") return null;
  const minor = majorToMinor(input);
  return Number.isFinite(minor) && minor >= 0 ? minor : "invalid";
}

interface Props {
  zones: ShippingZone[];
  workspace: Workspace | null;
  currency: string;
  onWorkspaceChanged: () => Promise<void> | void;
}

export function WeightTiersSection({ zones, workspace, currency, onWorkspaceChanged }: Props) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => apiClient.getWeightTiers(workspaceId), [workspaceId]);
  const reload = () => settings.refresh({ silent: true });

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.intro}</p>
      </div>
      <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
        {settings.data && (
          <WeightTiersBody
            key={bodyKey(settings.data)}
            data={settings.data}
            zones={zones}
            workspace={workspace}
            currency={currency}
            t={t}
            onChanged={reload}
            onWorkspaceChanged={onWorkspaceChanged}
          />
        )}
      </DataState>
    </section>
  );
}

function WeightTiersBody({
  data,
  zones,
  workspace,
  currency,
  t,
  onChanged,
  onWorkspaceChanged,
}: {
  data: WeightTierSettings;
  zones: ShippingZone[];
  workspace: Workspace | null;
  currency: string;
  t: Strings;
  onChanged: () => void;
  onWorkspaceChanged: () => Promise<void> | void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirmRates, setConfirmRates] = useState(false);
  const tierMode = data.pricingMode === "weight_tiers";

  async function switchToRates() {
    try {
      await apiClient.setShippingPricingMode(workspaceId, { mode: "rates" });
      toast.success(t.switchedToRates);
      setConfirmRates(false);
      onChanged();
      await onWorkspaceChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      {data.variantsWithoutWeight > 0 && (
        <Alert variant="info" className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {data.variantsWithoutWeight === 1
              ? t.noWeightBannerOne
              : fmt(t.noWeightBanner, { count: data.variantsWithoutWeight })}
          </span>
          <Link to="/catalog" className="text-sm font-medium text-primary hover:underline">
            {t.noWeightLink}
          </Link>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line p-4">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span className="text-ink-soft">{t.modeLabel}:</span>
          <StatusBadge value={data.pricingMode} tone={tierMode ? "info" : "neutral"} text={tierMode ? t.modeTiers : t.modeRates} />
        </div>
        {tierMode ? (
          <Button variant="outline" onClick={() => setConfirmRates(true)}>
            {t.switchToRates}
          </Button>
        ) : (
          <Button onClick={() => setWizardOpen(true)}>{t.switchToTiers}</Button>
        )}
      </div>

      <DefaultWeightForm data={data} t={t} onSaved={onChanged} />

      <TierEditor data={data} t={t} onSaved={onChanged} />

      <TierPriceGrid data={data} zones={zones} currency={currency} t={t} onSaved={onChanged} />

      {wizardOpen && (
        <PricingModeWizard
          data={data}
          zones={zones}
          workspace={workspace}
          currency={currency}
          t={t}
          onClose={() => setWizardOpen(false)}
          onSwitched={async () => {
            setWizardOpen(false);
            toast.success(t.switchedToTiers);
            onChanged();
            await onWorkspaceChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmRates}
        title={t.switchToRatesTitle}
        description={t.switchToRatesBody}
        confirmLabel={t.switchToRatesConfirm}
        cancelLabel={t.cancel}
        onCancel={() => setConfirmRates(false)}
        onConfirm={switchToRates}
      />
    </div>
  );
}

function DefaultWeightForm({ data, t, onSaved }: { data: WeightTierSettings; t: Strings; onSaved: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState(gramsToKgInput(data.defaultItemWeightGrams));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const grams = kgInputToGrams(value);
    if (grams !== null && (Number.isNaN(grams) || grams <= 0)) {
      setError(t.errDefaultWeight);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.updateWorkspace(workspaceId, { settings: { default_item_weight_grams: grams } });
      toast.success(t.defaultWeightSaved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <WeightInput
        label={t.defaultWeight}
        unit={t.kg}
        value={value}
        onChange={setValue}
        error={error ?? undefined}
        hint={t.defaultWeightHint}
        required={data.pricingMode === "weight_tiers"}
        className="w-full sm:w-72"
      />
      <Button type="submit" variant="outline" disabled={saving} className="mb-6">
        {saving ? t.saving : t.saveDefaultWeight}
      </Button>
    </form>
  );
}

interface TierRow {
  id?: string;
  upTo: string;
  open: boolean;
}

function TierEditor({ data, t, onSaved }: { data: WeightTierSettings; t: Strings; onSaved: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [rows, setRows] = useState<TierRow[]>(() =>
    data.tiers.map((tier) => ({ id: tier.id, upTo: gramsToKgInput(tier.upToGrams), open: tier.upToGrams === null }))
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<TierRow>) =>
    setRows((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function addTier() {
    setRows((prev) => {
      if (prev.length >= MAX_TIERS) return prev;
      // A new tier goes last, so the previous last one can't stay open-ended.
      const closed = prev.map((row) => ({ ...row, open: false }));
      return [...closed, { upTo: "", open: false }];
    });
  }

  async function save() {
    const errs: Record<number, string> = {};
    let previous = 0;
    const tiers = rows.map((row, i) => {
      const isLast = i === rows.length - 1;
      if (row.open && isLast) return { ...(row.id ? { id: row.id } : {}), upToGrams: null };
      const grams = kgInputToGrams(row.upTo);
      if (grams === null || Number.isNaN(grams) || grams <= previous) errs[i] = t.errTierWeight;
      else previous = grams;
      return { ...(row.id ? { id: row.id } : {}), upToGrams: grams };
    });
    setErrors(errs);
    if (rows.length < 1 || rows.length > MAX_TIERS) {
      setFormError(t.errTierCount);
      return;
    }
    if (Object.keys(errs).length > 0) return;
    setFormError(null);
    setSaving(true);
    try {
      await apiClient.replaceWeightTiers(workspaceId, { tiers });
      toast.success(t.tiersSaved);
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Where each row starts: the previous row's bound as currently typed.
  const starts = rows.reduce<number[]>((acc, _row, i) => {
    const previous = i === 0 ? 0 : acc[i - 1];
    const grams = i === 0 ? null : kgInputToGrams(rows[i - 1].upTo);
    acc.push(grams !== null && !Number.isNaN(grams) ? grams : previous);
    return acc;
  }, []);
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="font-medium text-ink">{t.tiersHeading}</h3>
      <p className="mt-1 text-sm text-ink-soft">{t.tiersHint}</p>
      {formError && (
        <Alert variant="danger" className="mt-3">
          {formError}
        </Alert>
      )}
      {rows.length === 0 && <p className="mt-3 text-sm text-ink-soft">{t.noTiers}</p>}
      <ol className="mt-3 space-y-2">
        {rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          const fromKg = formatKg(starts[i]);
          return (
            <li key={row.id ?? `new-${i}`} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-sm font-medium text-ink">{fmt(t.tierN, { n: i + 1 })}</span>
              <span className="text-sm text-ink-soft">
                {fromKg} {t.kg} →
              </span>
              {row.open && isLast ? (
                <span className="text-sm text-ink">{t.openEnded}</span>
              ) : (
                <div className="relative w-32">
                  <Input
                    aria-label={`${t.upTo} (${t.kg})`}
                    inputMode="decimal"
                    value={row.upTo}
                    onChange={(e) => update(i, { upTo: e.target.value })}
                    className={cn("pe-10", errors[i] && "border-danger")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
                    {t.kg}
                  </span>
                </div>
              )}
              {isLast && (
                <label className="flex items-center gap-1.5 text-sm text-ink">
                  <input type="checkbox" checked={row.open} onChange={(e) => update(i, { open: e.target.checked })} />
                  {t.openEnded}
                </label>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                disabled={rows.length <= 1}
              >
                {t.removeTier}
              </Button>
              {errors[i] && <p className="w-full text-xs font-medium text-danger">{errors[i]}</p>}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" onClick={addTier} disabled={rows.length >= MAX_TIERS}>
          {t.addTier}
        </Button>
        <Button type="button" onClick={save} disabled={saving || rows.length === 0}>
          {saving ? t.saving : t.saveTiers}
        </Button>
      </div>
    </div>
  );
}

/** Editable zone × tier grid. Used on the page and inside the wizard. */
function PriceGridTable({
  tiers,
  zones,
  values,
  onChange,
  currency,
  t,
  invalid,
  badges,
}: {
  tiers: WeightTier[];
  zones: ShippingZone[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  currency: string;
  t: Strings;
  invalid: ReadonlySet<string>;
  badges?: Record<string, string>;
}) {
  const tierLabel = useTierLabel();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="text-start text-ink-soft">
            <th className="px-2 py-2 text-start font-medium">{t.zone}</th>
            {tiers.map((tier) => (
              <th key={tier.id} className="px-2 py-2 text-start font-medium whitespace-nowrap">
                {tierLabel(tier)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.id} className="border-t border-line">
              <td className="px-2 py-2 text-ink">
                {zone.name}
                {!zone.isActive && <span className="ms-1 text-xs text-ink-soft">({t.inactive})</span>}
              </td>
              {tiers.map((tier) => {
                const key = cellKey(zone.id, tier.id);
                return (
                  <td key={tier.id} className="px-2 py-2 align-top">
                    <div className="relative">
                      <Input
                        aria-label={`${zone.name} — ${tierLabel(tier)}`}
                        inputMode="decimal"
                        value={values[key] ?? ""}
                        onChange={(e) => onChange(key, e.target.value)}
                        className={cn("w-28 pe-11", invalid.has(key) && "border-danger")}
                      />
                      <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-2 text-xs text-ink-soft">
                        {currency}
                      </span>
                    </div>
                    {badges?.[key] && <span className="mt-0.5 block text-[11px] text-ink-soft">{badges[key]}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Validates a grid and groups it per zone, as PUT /zones/:id/tier-prices wants it. */
function gridToZonePrices(
  zones: ShippingZone[],
  tiers: WeightTier[],
  values: Record<string, string>
): { invalid: Set<string>; byZone: Map<string, Array<{ tierId: string; amount: number }>> } {
  const invalid = new Set<string>();
  const byZone = new Map<string, Array<{ tierId: string; amount: number }>>();
  for (const zone of zones) {
    const prices: Array<{ tierId: string; amount: number }> = [];
    for (const tier of tiers) {
      const key = cellKey(zone.id, tier.id);
      const parsed = parseCell(values[key]);
      if (parsed === "invalid") invalid.add(key);
      else if (parsed !== null) prices.push({ tierId: tier.id, amount: parsed });
    }
    byZone.set(zone.id, prices);
  }
  return { invalid, byZone };
}

function samePrices(a: Array<{ tierId: string; amount: number }>, b: Array<{ tierId: string; amount: number }>): boolean {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((p) => [p.tierId, p.amount]));
  return b.every((p) => m.get(p.tierId) === p.amount);
}

/** PUTs the zones whose prices changed. */
async function saveZonePrices(
  workspaceId: string,
  byZone: Map<string, Array<{ tierId: string; amount: number }>>,
  stored: WeightTierSettings["prices"]
) {
  for (const [zoneId, prices] of byZone) {
    const before = stored.filter((p) => p.zoneId === zoneId).map((p) => ({ tierId: p.tierId, amount: p.amount }));
    if (!samePrices(before, prices)) await apiClient.replaceZoneTierPrices(workspaceId, zoneId, prices);
  }
}

function TierPriceGrid({
  data,
  zones,
  currency,
  t,
  onSaved,
}: {
  data: WeightTierSettings;
  zones: ShippingZone[];
  currency: string;
  t: Strings;
  onSaved: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [values, setValues] = useState<Record<string, string>>(() => gridFrom(data.prices));
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const { invalid: bad, byZone } = gridToZonePrices(zones, data.tiers, values);
    setInvalid(bad);
    if (bad.size > 0) {
      setFormError(t.errPrice);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await saveZonePrices(workspaceId, byZone, data.prices);
      toast.success(t.pricesSaved);
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="font-medium text-ink">{t.gridHeading}</h3>
      <p className="mt-1 text-sm text-ink-soft">{t.gridHint}</p>
      {formError && (
        <Alert variant="danger" className="mt-3">
          {formError}
        </Alert>
      )}
      {data.tiers.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t.gridNoTiers}</p>
      ) : zones.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t.gridNoZones}</p>
      ) : (
        <>
          <div className="mt-3">
            <PriceGridTable
              tiers={data.tiers}
              zones={zones}
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
              currency={currency}
              t={t}
              invalid={invalid}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t.saving : t.savePrices}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Two steps: the default item weight, then the price grid with every empty
 * cell proposed from the current rates (POST /pricing-mode dryRun). Switching
 * saves the edited grid, then flips the mode with prefill off — the grid the
 * merchant saw is exactly what gets charged.
 */
function PricingModeWizard({
  data,
  zones,
  workspace,
  currency,
  t,
  onClose,
  onSwitched,
}: {
  data: WeightTierSettings;
  zones: ShippingZone[];
  workspace: Workspace | null;
  currency: string;
  t: Strings;
  onClose: () => void;
  onSwitched: () => Promise<void> | void;
}) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [step, setStep] = useState<1 | 2>(1);
  const [weight, setWeight] = useState(
    gramsToKgInput(data.defaultItemWeightGrams ?? (workspace?.settings?.default_item_weight_grams as number | null | undefined))
  );
  const [weightError, setWeightError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => gridFrom(data.prices));
  const [proposals, setProposals] = useState<TierPriceProposal[]>([]);
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const badges = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of proposals) out[cellKey(p.zoneId, p.tierId)] = p.basis === "rates" ? t.wizardFromRates : t.wizardFromDefault;
    return out;
  }, [proposals, t]);

  async function next() {
    const grams = kgInputToGrams(weight);
    if (grams === null || Number.isNaN(grams) || grams <= 0) {
      setWeightError(t.errDefaultWeight);
      return;
    }
    setWeightError(null);
    setError(null);
    setBusy(true);
    try {
      const dry = await apiClient.setShippingPricingMode(workspaceId, { mode: "weight_tiers", dryRun: true });
      const found = dry.proposals ?? [];
      setProposals(found);
      setValues((prev) => {
        const merged = { ...prev };
        for (const p of found) {
          const key = cellKey(p.zoneId, p.tierId);
          if (!merged[key]) merged[key] = minorToMajorInput(p.amount);
        }
        return merged;
      });
      setStep(2);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function switchMode() {
    const grams = kgInputToGrams(weight);
    const { invalid: bad, byZone } = gridToZonePrices(zones, data.tiers, values);
    setInvalid(bad);
    if (bad.size > 0) {
      setError(t.errPrice);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveZonePrices(workspaceId, byZone, data.prices);
      await apiClient.setShippingPricingMode(workspaceId, {
        mode: "weight_tiers",
        defaultItemWeightGrams: grams ?? undefined,
        prefill: false,
      });
      await onSwitched();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const footer =
    data.tiers.length === 0 ? (
      <Button variant="outline" onClick={onClose}>
        {t.cancel}
      </Button>
    ) : step === 1 ? (
      <>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
        <Button onClick={next} disabled={busy}>
          {busy ? t.saving : t.wizardNext}
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
          {t.wizardBack}
        </Button>
        <Button onClick={switchMode} disabled={busy}>
          {busy ? t.saving : t.wizardSwitch}
        </Button>
      </>
    );

  return (
    <Modal open onClose={onClose} title={t.wizardTitle} footer={footer} className="max-w-3xl">
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}
      {data.tiers.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.wizardNeedsTiers}</p>
      ) : step === 1 ? (
        <div className="space-y-2">
          <h3 className="font-medium text-ink">{t.wizardStep1}</h3>
          <WeightInput
            label={t.defaultWeight}
            unit={t.kg}
            value={weight}
            onChange={setWeight}
            error={weightError ?? undefined}
            hint={t.wizardStep1Hint}
            required
            className="sm:w-72"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-medium text-ink">{t.wizardStep2}</h3>
          <p className="text-sm text-ink-soft">{t.wizardStep2Hint}</p>
          {zones.length === 0 ? (
            <p className="text-sm text-ink-soft">{t.gridNoZones}</p>
          ) : (
            <PriceGridTable
              tiers={data.tiers}
              zones={zones}
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
              currency={currency}
              t={t}
              invalid={invalid}
              badges={badges}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
