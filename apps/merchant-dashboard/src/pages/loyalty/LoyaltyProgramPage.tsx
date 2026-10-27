import { useEffect, useId, useState, type FormEvent } from "react";
import { IconAward, IconCoins, IconCustomers, IconPeople } from "@/components/icons";
import { Alert } from "@store-builder/ui";
import {
  LOYALTY_LIMITS,
  loyaltyGet,
  loyaltySave,
  shopperAccountsGet,
  type LoyaltySettings,
  type LoyaltySettingsPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMinorMoney, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { PlanFeatureNotice } from "@/components/PlanFeatureNotice";
import { ReportKpiStrip } from "@/components/report/ReportKpiStrip";
import { SettingsGroup, SettingsLinkRow, SettingsRow, SettingsSwitch } from "@/components/settings";
import { KpiCard } from "@/components/KpiCard";
import { SaveBar } from "@/components/SaveBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { LOYALTY_STRINGS, parseWhole, toAsciiDigits } from "./loyaltyStrings";
// Loyalty points, VIP tiers and "refer a friend" share this sidebar entry as tabs.
import { RewardsTabs } from "./RewardsTabs";
import { MoneyControl, NumberControl, ProgrammeExample, ProgrammeNote, ProgrammeSkeleton, focusFirstInvalid } from "./programmeKit";

interface Draft {
  enabled: boolean;
  earn: string;
  value: string;
  minPoints: string;
  maxPercent: string;
  maxPerOrder: string;
  expiry: string;
}

const FIELDS = ["earn", "value", "minPoints", "maxPercent", "maxPerOrder", "expiry"] as const;
type FieldKey = (typeof FIELDS)[number];

const toDraft = (s: LoyaltySettings): Draft => ({
  enabled: s.enabled,
  earn: s.earnPointsPerUnit === null ? "" : String(s.earnPointsPerUnit),
  value: s.pointValue === null ? "" : minorToMajorInput(s.pointValue),
  minPoints: String(s.minRedeemPoints),
  maxPercent: String(s.maxRedeemPercent),
  maxPerOrder: s.maxRedeemPointsPerOrder == null ? "" : String(s.maxRedeemPointsPerOrder),
  expiry: s.expiryDays === null ? "" : String(s.expiryDays),
});

const sameDraft = (a: Draft, b: Draft) => a.enabled === b.enabled && FIELDS.every((k) => a[k].trim() === b[k].trim());

/** The earn rate as the API takes it: 0.01–1000 with at most two decimals; "" → null; anything else → undefined. */
function parseEarn(raw: string): number | null | undefined {
  const ascii = toAsciiDigits(raw);
  if (ascii === "") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(ascii)) return undefined;
  const n = Number(ascii);
  return n >= LOYALTY_LIMITS.earnMin && n <= LOYALTY_LIMITS.earnMax ? n : undefined;
}

/** One point's value in minor units (from 1); "" → null; anything else → undefined. */
function parseValue(raw: string): number | null | undefined {
  const ascii = toAsciiDigits(raw);
  if (ascii === "") return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(ascii)) return undefined;
  const minor = majorToMinor(ascii);
  return Number.isFinite(minor) && minor >= LOYALTY_LIMITS.pointValueMin && minor <= LOYALTY_LIMITS.pointValueMax ? minor : undefined;
}

const count = (n: number) => new Intl.NumberFormat(getIntlLocale()).format(n);

/**
 * Customers → Loyalty programme (GET customers.view, PUT
 * discounts.manage): the switch, how many points a customer earns, what a
 * point is worth, the limits on spending them and when they expire — with
 * how many points customers hold today and what those are worth.
 *
 * The rules are settings groups (the switch, earning, spending, expiry); a
 * change shows the save bar, and leaving with one unsaved asks first.
 *
 * A plan without loyalty points (the API's LOYALTY_REQUIRE_PLAN_FEATURE):
 * the switch can't go on and the plan notice says why; a store whose points
 * are frozen (that plan, or an unpaid subscription) is told its customers'
 * balances wait, untouched.
 */
export function LoyaltyProgramPage() {
  const t = useT(LOYALTY_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const phone = useIsPhone();
  const formId = useId();

  const overview = useAsync(() => loyaltyGet(apiClient, workspaceId), [workspaceId]);
  // Spending points needs a signed-in shopper: say so when the store has no accounts.
  // A role that may not read that setting (website.edit) simply sees no hint.
  const accounts = useAsync(() => shopperAccountsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const data = overview.data;
  const saved = data ? toDraft(data.settings) : null;
  const savedKey = saved ? JSON.stringify(saved) : null;
  // The form starts from what is saved, and again after each save.
  useEffect(() => {
    if (savedKey) setDraft(JSON.parse(savedKey) as Draft);
  }, [savedKey]);

  const currency = data?.currency ?? "EGP";
  const unit = formatMinorMoney(100, currency);
  const dirty = Boolean(draft && saved && !sameDraft(draft, saved));
  // Leaving the page with a change not saved asks first.
  useReportDirty(dirty);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    if (key !== "enabled") setErrors((e) => ({ ...e, [key]: undefined }));
    setFailure(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !data || saving) return;
    const earn = parseEarn(draft.earn);
    const value = parseValue(draft.value);
    const minPoints = parseWhole(draft.minPoints, 1, LOYALTY_LIMITS.minRedeemMax);
    const maxPercent = parseWhole(draft.maxPercent, 1, 100);
    const noPerOrder = toAsciiDigits(draft.maxPerOrder) === "";
    const maxPerOrder = noPerOrder ? null : parseWhole(draft.maxPerOrder, 1, LOYALTY_LIMITS.maxPerOrderMax);
    const noExpiry = toAsciiDigits(draft.expiry) === "";
    const expiry = noExpiry ? null : parseWhole(draft.expiry, LOYALTY_LIMITS.expiryMin, LOYALTY_LIMITS.expiryMax);

    const found: Partial<Record<FieldKey, string>> = {};
    // Both rates are needed to run the programme; switched off, they may stay empty.
    if (earn === undefined || (draft.enabled && earn === null)) found.earn = t.earnError;
    if (value === undefined || (draft.enabled && value === null)) found.value = t.valueError;
    if (minPoints === null) found.minPoints = t.minPointsError;
    if (maxPercent === null) found.maxPercent = t.maxPercentError;
    if (!noPerOrder && maxPerOrder === null) found.maxPerOrder = t.maxPerOrderError;
    if (!noExpiry && expiry === null) found.expiry = t.expiryError;
    setErrors(found);
    if (FIELDS.some((k) => found[k])) {
      setFailure(t.fixFields);
      // After the rows have drawn their problems: the first one comes into view and takes the focus.
      window.requestAnimationFrame(() => focusFirstInvalid(document.getElementById(formId)));
      return;
    }

    const body: LoyaltySettingsPayload = {
      enabled: draft.enabled,
      earnPointsPerUnit: earn ?? null,
      pointValue: value ?? null,
      minRedeemPoints: minPoints ?? 1,
      maxRedeemPercent: maxPercent ?? 100,
      maxRedeemPointsPerOrder: maxPerOrder,
      expiryDays: expiry,
    };
    setSaving(true);
    setFailure(null);
    try {
      const next = await loyaltySave(apiClient, workspaceId, body);
      overview.setData({ ...data, settings: next.settings, active: next.active });
      // What the outstanding points are worth follows the new point value, and the frozen state the switch: read it again.
      void overview.refresh({ silent: true });
      toast.success(next.active ? t.savedOn : next.settings.enabled ? t.saved : t.savedOff);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const badge = data ? (
    data.frozen && data.settings.enabled ? (
      <StatusBadge value="frozen" tone="warning" text={t.stateFrozen} />
    ) : data.active ? (
      <StatusBadge value="active" tone="success" text={t.stateOn} />
    ) : data.settings.enabled ? (
      <StatusBadge value="pending" tone="warning" text={t.stateIncomplete} />
    ) : (
      <StatusBadge value="disabled" tone="neutral" text={t.stateOff} />
    )
  ) : undefined;

  // What the two rates mean together, on the numbers being typed.
  const liveEarn = draft ? parseEarn(draft.earn) : null;
  const liveValue = draft ? parseValue(draft.value) : null;
  const examplePoints = liveEarn ? Math.floor(1000 * liveEarn) : 0;
  const field = (key: FieldKey) => `${formId}-${key}`;
  // The plan lacks loyalty points: the switch may go off, never on (the API refuses it with 403 PLAN_FEATURE_REQUIRED).
  const cannotSwitchOn = Boolean(data?.planLocked) && !data?.settings.enabled && !draft?.enabled;

  return (
    <div>
      {/* A phone keeps the first screen for the switch and the rules: the sentence is said by the first group. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} titleBadge={badge} />
      <RewardsTabs active="loyalty" />

      <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()} skeleton={<ProgrammeSkeleton tiles={3} groups={[1, 2, 2, 1]} />}>
        {data && draft && (
          <form id={formId} onSubmit={submit} noValidate className="max-w-3xl space-y-5">
            {data.planLocked ? (
              <PlanFeatureNotice feature="loyalty" message={data.frozenReason === "plan" && data.settings.enabled ? t.frozenPlan : undefined} />
            ) : (
              data.frozenReason === "subscription" &&
              data.settings.enabled && (
                <ProgrammeNote to="/subscription" action={t.frozenSubscriptionAction}>
                  {t.frozenSubscription}
                </ProgrammeNote>
              )
            )}
            {accounts.data && !accounts.data.enabled && (data.settings.enabled || draft.enabled) && (
              <ProgrammeNote to="/store-settings/customer-accounts" action={t.accountsOffAction}>
                {t.accountsOff}
              </ProgrammeNote>
            )}

            <SettingsGroup description={phone ? t.customerGets : undefined}>
              <SettingsSwitch
                checked={draft.enabled}
                onChange={(next) => set("enabled", next)}
                label={t.enable}
                hint={draft.enabled ? t.enableHintOn : t.enableHintOff}
                disabled={saving || cannotSwitchOn}
              />
            </SettingsGroup>

            <section aria-label={t.holdersTitle}>
              <h2 className="mb-2 px-4 text-[13px] leading-5 font-semibold text-ink-soft">{t.holdersTitle}</h2>
              <ReportKpiStrip sparkline={false}>
                <KpiCard label={t.statCustomers} value={count(data.customersWithPoints)} icon={<IconPeople aria-hidden />} />
                <KpiCard label={t.statPoints} value={count(data.outstandingPoints)} icon={<IconAward aria-hidden />} />
                <KpiCard
                  label={t.statWorth}
                  value={data.outstandingWorth === null ? "—" : formatMoney(data.outstandingWorth, currency)}
                  hint={data.outstandingWorth === null ? t.statWorthNone : undefined}
                  icon={<IconCoins aria-hidden />}
                />
              </ReportKpiStrip>
            </section>

            <SettingsGroup
              title={t.groupEarn}
              description={t.settingsHint}
              footer={
                liveEarn && liveValue && examplePoints > 0 ? (
                  <ProgrammeExample>
                    {fmt(t.summaryLine, {
                      spend: formatMinorMoney(100000, currency),
                      points: pluralOf(t, "points", examplePoints),
                      worth: formatMoney(examplePoints * liveValue, currency),
                    })}
                  </ProgrammeExample>
                ) : undefined
              }
            >
              <SettingsRow
                label={fmt(t.earn, { unit })}
                hint={fmt(t.earnHint, { unit })}
                htmlFor={field("earn")}
                error={errors.earn}
                control={
                  <NumberControl
                    id={field("earn")}
                    inputMode="decimal"
                    maxLength={7}
                    value={draft.earn}
                    disabled={saving}
                    invalid={Boolean(errors.earn)}
                    onChange={(v) => set("earn", v)}
                  />
                }
              />
              <SettingsRow
                label={t.value}
                hint={liveValue ? `${t.valueHint} ${fmt(t.valueExample, { n: 100, amount: formatMoney(100 * liveValue, currency) })}` : t.valueHint}
                htmlFor={field("value")}
                error={errors.value}
                control={
                  <MoneyControl
                    id={field("value")}
                    currency={currency}
                    value={draft.value}
                    disabled={saving}
                    invalid={Boolean(errors.value)}
                    onChange={(v) => set("value", v)}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t.groupSpend}>
              <SettingsRow
                label={t.minPoints}
                hint={t.minPointsHint}
                htmlFor={field("minPoints")}
                error={errors.minPoints}
                control={
                  <NumberControl
                    id={field("minPoints")}
                    maxLength={8}
                    value={draft.minPoints}
                    disabled={saving}
                    invalid={Boolean(errors.minPoints)}
                    onChange={(v) => set("minPoints", v)}
                  />
                }
              />
              <SettingsRow
                label={t.maxPercent}
                hint={t.maxPercentHint}
                htmlFor={field("maxPercent")}
                error={errors.maxPercent}
                control={
                  <NumberControl
                    id={field("maxPercent")}
                    maxLength={3}
                    value={draft.maxPercent}
                    disabled={saving}
                    invalid={Boolean(errors.maxPercent)}
                    unit={t.percentUnit}
                    unitHidden
                    onChange={(v) => set("maxPercent", v)}
                  />
                }
              />
              <SettingsRow
                label={t.maxPerOrder}
                hint={t.maxPerOrderHint}
                htmlFor={field("maxPerOrder")}
                error={errors.maxPerOrder}
                control={
                  <NumberControl
                    id={field("maxPerOrder")}
                    maxLength={8}
                    value={draft.maxPerOrder}
                    disabled={saving}
                    invalid={Boolean(errors.maxPerOrder)}
                    unit={t.pointsUnit}
                    onChange={(v) => set("maxPerOrder", v)}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t.groupExpiry}>
              <SettingsRow
                label={t.expiry}
                hint={t.expiryHint}
                htmlFor={field("expiry")}
                error={errors.expiry}
                control={
                  <NumberControl
                    id={field("expiry")}
                    maxLength={4}
                    value={draft.expiry}
                    disabled={saving}
                    invalid={Boolean(errors.expiry)}
                    unit={t.expiryUnit}
                    onChange={(v) => set("expiry", v)}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup>
              <SettingsLinkRow to="/customers" icon={IconCustomers} label={t.holdersLink} hint={t.holdersLinkHint} />
            </SettingsGroup>

            {failure && <Alert variant="danger">{failure}</Alert>}

            <SaveBar
              dirty={dirty}
              saving={saving}
              saveLabel={t.save}
              savingLabel={t.saving}
              onDiscard={() => {
                if (saved) setDraft(saved);
                setErrors({});
                setFailure(null);
              }}
            />
          </form>
        )}
      </DataState>
    </div>
  );
}
