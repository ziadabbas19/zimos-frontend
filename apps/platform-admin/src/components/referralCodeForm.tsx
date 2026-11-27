import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import type {
  AdminAgent,
  AdminPlan,
  AdminReferralCode,
  AdminReferralCodeInput,
  AdminReferralSimulation,
  BillingCycle,
  ReferralAudience,
  ReferralCommissionBasis,
  ReferralTerms,
} from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { Panel, Td, Th } from "@/components/Panel";
import { SelectField, TextField } from "@/components/forms";
import { Toggle } from "@/components/Toggle";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatMinorMoneyExact } from "@/lib/format";
import { P } from "@/lib/permissions";
import { neverApproved } from "@/lib/referrals";
import {
  CYCLES,
  PRESETS,
  audienceLabels,
  cycleLabel,
  describeCodeDiscount,
  grantLabels,
  initialCodeForm,
  percentText,
  termsOf,
  toCodeInput,
  type CodeForm,
  type CycleDraft,
  type DiscountStepDraft,
  type RateStepDraft,
} from "@/lib/referralCodes";
import { REFERRAL_STRINGS, isolate } from "@/lib/referralStrings";

/**
 * The second kind of referral code's form (Agents → Referral codes,
 * migration 725): who may enter it, when and how often, for which plans,
 * the discount and commission schedules per cycle, the commission basis,
 * the agent link and a one-time benefit, with the simulator under it.
 * Units are converted in lib/referralCodes; the server checks everything again.
 */

function StepCount({ value, onChange, last, label }: { value: string; onChange: (v: string) => void; last: boolean; label: string }) {
  const t = useT(REFERRAL_STRINGS);
  return (
    <TextField
      label={label}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={last ? t.formPlaceholderEveryAfter : "1"}
      hint={last ? t.formEmptyEveryAfter : undefined}
    />
  );
}

function DiscountSteps({
  steps,
  onChange,
  cycle,
  onFreeMonths,
}: {
  steps: DiscountStepDraft[];
  onChange: (next: DiscountStepDraft[]) => void;
  cycle: BillingCycle;
  /** Set while monthly and yearly share one schedule: free months mean different steps on each period. */
  onFreeMonths?: (months: string) => void;
}) {
  const t = useT(REFERRAL_STRINGS);
  const set = (i: number, patch: Partial<DiscountStepDraft>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const [preset, setPreset] = useState({ percent: "100", payments: "3", months: "1" });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <TextField label="%" className="w-20" inputMode="decimal" value={preset.percent} onChange={(e) => setPreset({ ...preset, percent: e.target.value })} />
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(PRESETS.firstPayment(preset.percent))}>
          {t.formFirstPaymentOnly}
        </Button>
        <TextField label={t.formPayments} className="w-24" inputMode="numeric" value={preset.payments} onChange={(e) => setPreset({ ...preset, payments: e.target.value })} />
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(PRESETS.forPayments(preset.percent, preset.payments))}>
          {t.formForNPayments}
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(PRESETS.everyPayment(preset.percent))}>
          {t.formEveryPayment}
        </Button>
        <TextField label={t.months} className="w-20" inputMode="numeric" value={preset.months} onChange={(e) => setPreset({ ...preset, months: e.target.value })} />
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => (onFreeMonths ? onFreeMonths(preset.months) : onChange(PRESETS.freeMonths(preset.months, cycle)))}>
          {t.formFreeMonths}
        </Button>
      </div>
      {steps.length === 0 && <p className="text-sm text-ink-soft">{t.formNoDiscountOnCycle}</p>}
      {steps.map((step, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[7rem_10rem_8rem_6rem_auto]">
          <StepCount label={fmt(t.formStepPayments, { n: i + 1 })} value={step.count} last={i === steps.length - 1} onChange={(count) => set(i, { count })} />
          <SelectField label={t.formType} value={step.type} onChange={(e) => set(i, { type: e.target.value as DiscountStepDraft["type"] })}>
            <option value="percentage">{t.formPercentOff}</option>
            <option value="fixed">{t.formAmountOff}</option>
            <option value="free_months">{t.formFreeMonths}</option>
          </SelectField>
          <TextField
            label={step.type === "percentage" ? t.percent : step.type === "fixed" ? t.amount : t.months}
            inputMode="decimal"
            value={step.amount}
            onChange={(e) => set(i, { amount: e.target.value })}
          />
          {step.type === "fixed" ? (
            <TextField label={t.currency} maxLength={3} dir="ltr" value={step.currency} onChange={(e) => set(i, { currency: e.target.value.toUpperCase() })} />
          ) : (
            <span />
          )}
          <Button type="button" size="icon-sm" variant="ghost" className="size-11" aria-label={fmt(t.formRemoveDiscountStep, { n: i + 1 })} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => onChange([...steps, { count: "", type: "percentage", amount: "", currency: "EGP" }])}>
        <Plus /> {t.formAddDiscountStep}
      </Button>
    </div>
  );
}

export function RateSteps({ steps, onChange, label }: { steps: RateStepDraft[]; onChange: (next: RateStepDraft[]) => void; label: string }) {
  const t = useT(REFERRAL_STRINGS);
  const set = (i: number, patch: Partial<RateStepDraft>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-3">
      {steps.length === 0 && <p className="text-sm text-ink-soft">{t.formNoCommissionOnCycle}</p>}
      {steps.map((step, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[7rem_8rem_auto]">
          <StepCount label={fmt(t.formStepPayments, { n: i + 1 })} value={step.count} last={i === steps.length - 1} onChange={(count) => set(i, { count })} />
          <TextField label={t.formRate} inputMode="decimal" value={step.percent} onChange={(e) => set(i, { percent: e.target.value })} />
          <Button type="button" size="icon-sm" variant="ghost" className="size-11" aria-label={fmt(t.formRemoveStep, { label, n: i + 1 })} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => onChange([...steps, { count: "", percent: "" }])}>
        <Plus /> {fmt(t.formAddStep, { label })}
      </Button>
    </div>
  );
}

/** Monthly / yearly, first in the form: the discount, the commission and the preview below are this period's. */
function PeriodSwitch({ value, onChange }: { value: BillingCycle; onChange: (next: BillingCycle) => void }) {
  const t = useT(REFERRAL_STRINGS);
  const name = useId();
  const hintId = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={hintId}>
      <legend className="text-sm font-medium text-ink">{t.formPeriod}</legend>
      <div className="inline-flex rounded-full border border-line bg-paper p-1">
        {CYCLES.map((c) => (
          <label
            key={c}
            className={cn(
              "flex min-h-11 min-w-24 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50",
              value === c ? "bg-primary text-primary-foreground" : "text-ink-soft hover:text-ink"
            )}
          >
            <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} className="sr-only" />
            {cycleLabel(c)}
          </label>
        ))}
      </div>
      <p id={hintId} className="text-xs text-ink-soft">
        {t.formPeriodHint}
      </p>
    </fieldset>
  );
}

/** A titled group of the form. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-line pt-5">
      <h3 id={id} className="font-medium text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * What the customer pays under the form's unsaved settings, for the period
 * chosen at the top and one plan: the server's own pricing (POST
 * /admin/referral-codes/simulate runs the same discount calculation as a real
 * charge), asked again shortly after each change. The first payment in a
 * sentence, all twelve in a table on demand.
 */
function LivePreview({ form, plans, cycle }: { form: CodeForm; plans: AdminPlan[]; cycle: BillingCycle }) {
  const t = useT(REFERRAL_STRINGS);
  const paid = plans.filter((p) => p.monthlyPrice > 0 && (form.allowedPlanIds.length === 0 || form.allowedPlanIds.includes(p.id)));
  const [picked, setPicked] = useState("");
  const planId = paid.some((p) => p.id === picked) ? picked : (paid[0]?.id ?? "");
  let terms: ReferralTerms | null = null;
  try {
    terms = termsOf(form);
  } catch {
    // Not readable yet (an empty or bad step): nothing to ask the server.
  }
  const hasAgent = Boolean(form.agentId);
  const key = planId && terms ? JSON.stringify({ planId, billingCycle: cycle, terms, commissionBasis: form.commissionBasis, hasAgent }) : "";
  const [answer, setAnswer] = useState<{ key: string; result?: AdminReferralSimulation; error?: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    let stale = false;
    const timer = setTimeout(() => {
      adminApi
        .simulateReferralCode(JSON.parse(key))
        .then((result) => {
          if (!stale) setAnswer({ key, result });
        })
        .catch((err) => {
          if (!stale) setAnswer({ key, error: getErrorMessage(err) });
        });
    }, 350);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [key]);

  const current = answer && answer.key === key ? answer : null;
  const result = current?.result ?? null;
  const first = result?.rows[0];
  const money = (n: number) => (result ? formatMinorMoneyExact(n, result.currency) : "");
  const cycleName = cycleLabel(cycle);

  return (
    <section aria-label={t.previewTitle} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-ink">{t.previewTitle}</h4>
          <p className="text-xs text-ink-soft">{t.previewSameAsCheckout}</p>
        </div>
        {paid.length > 1 && (
          <SelectField label={t.previewPlan} value={planId} onChange={(e) => setPicked(e.target.value)} className="min-w-40">
            {paid.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <p aria-live="polite" className="text-sm text-ink">
        {!paid.length
          ? t.previewNoPlans
          : !terms
            ? t.previewNeedsInput
            : current?.error
              ? null
              : !first
                ? t.previewLoading
                : first.discount > 0
                  ? fmt(t.previewPays, { pays: money(first.merchantPays), list: money(first.listPrice), cycle: cycleName })
                  : fmt(t.previewNoDiscount, { list: money(first.listPrice), cycle: cycleName })}
      </p>
      {current?.error && <Alert variant="danger">{current.error}</Alert>}
      {result && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">{fmt(t.previewAll, { n: result.rows.length })}</summary>
          <Panel flush className="mt-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.simPayment}</Th>
                  <Th className="text-end">{t.simListPrice}</Th>
                  <Th className="text-end">{t.discount}</Th>
                  <Th className="text-end">{t.simMerchantPays}</Th>
                  {hasAgent && <Th className="text-end">{t.formAgentCommission}</Th>}
                  <Th className="text-end">{t.simPlatformKeeps}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.paymentNo}>
                    <Td>{r.paymentNo}</Td>
                    <Td className="text-end tabular-nums">{money(r.listPrice)}</Td>
                    <Td className="text-end tabular-nums">{money(r.discount)}</Td>
                    <Td className="text-end tabular-nums">{money(r.merchantPays)}</Td>
                    {hasAgent && (
                      <Td className="text-end tabular-nums">
                        {money(r.commission)}
                        {r.commissionRateBp != null && <span className="block text-xs text-ink-soft">{percentText(r.commissionRateBp)}</span>}
                      </Td>
                    )}
                    <Td className={r.platformNet < 0 ? "text-end text-danger tabular-nums" : "text-end tabular-nums"}>{money(r.platformNet)}</Td>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <Td>{t.simTotal}</Td>
                  <Td className="text-end tabular-nums">{money(result.totals.listPrice)}</Td>
                  <Td className="text-end tabular-nums">{money(result.totals.discount)}</Td>
                  <Td className="text-end tabular-nums">{money(result.totals.merchantPays)}</Td>
                  {hasAgent && <Td className="text-end tabular-nums">{money(result.totals.commission)}</Td>}
                  <Td className="text-end tabular-nums">{money(result.totals.platformNet)}</Td>
                </TableRow>
              </TableBody>
            </Table>
          </Panel>
        </details>
      )}
    </section>
  );
}

export function ReferralCodeFormModal({
  code,
  impact,
  agents,
  plans,
  defaultRateBp,
  ownerId,
  submit: submitInput,
  description,
  submitLabel,
  onClose,
  onSaved,
}: {
  /** Absent to create one. */
  code?: AdminReferralCode;
  /** What switching it off costs (the code page's), for the warning. */
  impact?: { currentStores: number; trialingUnpaid: number };
  agents: AdminAgent[];
  plans: AdminPlan[];
  defaultRateBp: number;
  /**
   * The account the code stays with, null for none (My referrals, and a
   * creator's review, migration 742): its agent and its on/off switch aren't
   * this form's to change, and aren't sent.
   */
  ownerId?: string | null;
  /** Saves it somewhere other than the console's own routes. */
  submit?: (input: AdminReferralCodeInput & { code?: string }) => Promise<AdminReferralCode>;
  description?: string;
  submitLabel?: string;
  onClose: () => void;
  onSaved: (code: AdminReferralCode) => void;
}) {
  const t = useT(REFERRAL_STRINGS);
  const { can } = useAuth();
  const creating = !code;
  const fixedOwner = ownerId !== undefined;
  const [form, setForm] = useState<CodeForm>(() => {
    const initial = initialCodeForm(code, defaultRateBp);
    return fixedOwner ? { ...initial, agentId: ownerId ?? "" } : initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The period being edited and previewed; a code for yearly only opens on yearly.
  const [period, setPeriod] = useState<BillingCycle>(() => (form.allowedCycles.length === 1 ? form.allowedCycles[0] : "monthly"));
  const [advancedOpen, setAdvancedOpen] = useState(() => Boolean(form.minPriceAmount || form.grantType));
  const set = (patch: Partial<CodeForm>) => setForm((f) => ({ ...f, ...patch }));
  const hasAgent = Boolean(form.agentId);
  const switchingOff = !creating && code.active && !form.active;
  const audiences = audienceLabels();
  const grants = grantLabels();
  // One schedule for both periods lives in `monthly` (lib/referralCodes termsOf).
  const editing: BillingCycle = form.sameForBoth ? "monthly" : period;
  const draft = form[editing];
  const setDraft = (next: CycleDraft) => set({ [editing]: next } as Partial<CodeForm>);
  const onlyCycle = form.allowedCycles.length === 1 ? form.allowedCycles[0] : null;

  // Free months on a shared schedule: N free payments monthly, one payment N months off yearly — so the periods part.
  function freeMonthsOnBoth(months: string) {
    set({
      sameForBoth: false,
      monthly: { ...form.monthly, discount: PRESETS.freeMonths(months, "monthly") },
      yearly: { ...form.monthly, discount: PRESETS.freeMonths(months, "yearly") },
    });
  }

  function setPeriods(value: string) {
    const cycles = value ? [value as BillingCycle] : [];
    set({ allowedCycles: cycles });
    if (cycles.length === 1) setPeriod(cycles[0]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let input: AdminReferralCodeInput & { code?: string };
    try {
      input = toCodeInput(form, { creating });
      // The agent only when it changes: a code whose agent has since lost the role stays editable.
      if (!creating && (input.agentId ?? null) === (code.agentId ?? null)) delete input.agentId;
      if (fixedOwner) {
        delete input.agentId;
        delete input.active;
      }
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    setBusy(true);
    try {
      const saved = submitInput
        ? await submitInput(input)
        : creating
          ? await adminApi.createStandaloneReferralCode(input as AdminReferralCodeInput & { code: string })
          : await adminApi.updateReferralCode(code.id, input);
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  const togglePlan = (id: string) => set({ allowedPlanIds: form.allowedPlanIds.includes(id) ? form.allowedPlanIds.filter((p) => p !== id) : [...form.allowedPlanIds, id] });

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={creating ? t.codeNew : fmt(t.codeEdit, { code: isolate(code.code) })}
      description={description ?? t.formDefaultDescription}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="referral-code-form" className="min-h-11" disabled={busy || (creating && form.code.trim().length < 3)}>
            {busy ? t.saving : (submitLabel ?? (creating ? t.codeCreate : t.save))}
          </Button>
        </>
      }
    >
      <form id="referral-code-form" onSubmit={submit} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="space-y-3">
          <PeriodSwitch value={period} onChange={setPeriod} />
          {form.useSchedule && (
            <Toggle label={t.formSameForBoth} checked={form.sameForBoth} onChange={(sameForBoth) => set({ sameForBoth, ...(sameForBoth ? {} : { yearly: form.monthly }) })} />
          )}
          {onlyCycle && onlyCycle !== period && (
            <p className="text-sm text-ink-soft">{fmt(t.formNotOnPeriod, { cycle: cycleLabel(onlyCycle).toLowerCase() })}</p>
          )}
        </div>

        <Group title={t.formGroupCode}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.code}
              required={creating}
              disabled={!creating}
              dir="ltr"
              value={form.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              placeholder="WELCOME"
              maxLength={32}
              hint={creating ? t.codeHintNew : t.codeHintFixed}
            />
            <TextField label={t.label} value={form.label} onChange={(e) => set({ label: e.target.value })} maxLength={120} hint={t.labelHint} />
          </div>
          {!creating && !fixedOwner && !neverApproved(code) && (
            <Toggle label={t.active} description={t.formActiveHint} checked={form.active} onChange={(active) => set({ active })} />
          )}
          {switchingOff && impact && (
            <Alert variant="danger" role="alert">
              {impact.trialingUnpaid > 0
                ? fmt(t.formOffWarnTrial, { trial: impact.trialingUnpaid, current: impact.currentStores })
                : fmt(t.formOffWarn, { current: impact.currentStores })}
            </Alert>
          )}
        </Group>

        <Group title={`${t.discount} · ${cycleLabel(period)}`}>
          {!creating && code.kind === "legacy" && (
            <Toggle
              label={t.formGiveSchedule}
              description={fmt(t.formGiveScheduleHint, { discount: describeCodeDiscount(code) })}
              checked={form.useSchedule}
              onChange={(useSchedule) => set({ useSchedule })}
            />
          )}
          {form.useSchedule && (
            <DiscountSteps
              cycle={period}
              steps={draft.discount}
              onChange={(discount) => setDraft({ ...draft, discount })}
              onFreeMonths={form.sameForBoth ? freeMonthsOnBoth : undefined}
            />
          )}
          {form.useSchedule && can(P.AGENTS_VIEW) && <LivePreview form={form} plans={plans} cycle={period} />}
        </Group>

        <Group title={t.formGroupLimits}>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t.starts} type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} hint={t.optional} />
            <TextField label={t.ends} type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} hint={t.formEndsHint} />
            <TextField
              label={t.formUseLimit}
              inputMode="numeric"
              value={form.maxUses}
              onChange={(e) => set({ maxUses: e.target.value })}
              placeholder={t.noLimit}
              hint={!creating ? fmt(t.formUsedSoFar, { n: code.usesCount ?? 0 }) : t.formUsesHint}
            />
          </div>
        </Group>

        <Group title={t.formGroupWho}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={t.whoCanEnter} value={form.audience} onChange={(e) => set({ audience: e.target.value as ReferralAudience })} hint={t.formWhoHint}>
              {(Object.keys(audiences) as ReferralAudience[]).map((a) => (
                <option key={a} value={a}>
                  {audiences[a]}
                </option>
              ))}
            </SelectField>
            <SelectField label={t.formPeriods} value={onlyCycle ?? ""} onChange={(e) => setPeriods(e.target.value)}>
              <option value="">{t.formPeriodsBoth}</option>
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {fmt(t.formPeriodsOnly, { cycle: cycleLabel(c) })}
                </option>
              ))}
            </SelectField>
            {!fixedOwner && (
              <SelectField label={t.agent} value={form.agentId} onChange={(e) => set({ agentId: e.target.value })} hint={t.formAgentHint}>
                <option value="">{t.noAgent}</option>
                {agents
                  .filter((a) => a.isAgent || a.id === form.agentId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName} ({a.email})
                    </option>
                  ))}
              </SelectField>
            )}
          </div>
          {plans.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="group" aria-label={t.plans}>
              <span className="text-sm text-ink-soft">{t.formPlansNoneTicked}</span>
              {plans.map((p) => (
                <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={form.allowedPlanIds.includes(p.id)} onChange={() => togglePlan(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </Group>

        {hasAgent && (
          <Group title={`${t.formAgentCommission} · ${cycleLabel(period)}`}>
            {form.useSchedule && <RateSteps label={t.formCommissionWord} steps={draft.commission} onChange={(commission) => setDraft({ ...draft, commission })} />}
            {form.useSchedule && (
              <SelectField
                label={t.commissionOn}
                value={form.commissionBasis}
                onChange={(e) => set({ commissionBasis: e.target.value as ReferralCommissionBasis })}
                hint={t.formCommissionOnHint}
                className="max-w-md"
              >
                <option value="paid">{t.whatMerchantPaid}</option>
                <option value="list">{t.listPriceThe}</option>
              </SelectField>
            )}
            <Toggle label={t.formLinksAgent} description={t.formLinksAgentHint} checked={form.linksAgent} onChange={(linksAgent) => set({ linksAgent })} />
          </Group>
        )}

        <details open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)} className="border-t border-line pt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink">{t.formAdvanced}</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <TextField label={t.minPlanPrice} inputMode="decimal" value={form.minPriceAmount} onChange={(e) => set({ minPriceAmount: e.target.value })} placeholder={t.none} />
            <TextField label={t.formItsCurrency} maxLength={3} dir="ltr" value={form.minPriceCurrency} onChange={(e) => set({ minPriceCurrency: e.target.value.toUpperCase() })} />
            <SelectField label={t.oneTimeBenefit} value={form.grantType} onChange={(e) => set({ grantType: e.target.value as CodeForm["grantType"] })} hint={t.formBenefitHint}>
              <option value="">{t.none}</option>
              {(Object.keys(grants) as (keyof typeof grants)[]).map((g) => (
                <option key={g} value={g}>
                  {grants[g]}
                </option>
              ))}
            </SelectField>
            {form.grantType && (
              <TextField
                label={form.grantType === "trial_days" ? t.formDays : form.grantType === "free_orders" ? t.formOrders : t.formAmountEgp}
                inputMode="decimal"
                value={form.grantValue}
                onChange={(e) => set({ grantValue: e.target.value })}
              />
            )}
          </div>
        </details>
      </form>
    </Modal>
  );
}
