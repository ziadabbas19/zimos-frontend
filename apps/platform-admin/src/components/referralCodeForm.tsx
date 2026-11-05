import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminAgent,
  AdminPlan,
  AdminReferralCode,
  AdminReferralCodeInput,
  AdminReferralSimulation,
  BillingCycle,
  ReferralAudience,
  ReferralCommissionBasis,
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

function DiscountSteps({ steps, onChange, cycle }: { steps: DiscountStepDraft[]; onChange: (next: DiscountStepDraft[]) => void; cycle: BillingCycle }) {
  const t = useT(REFERRAL_STRINGS);
  const set = (i: number, patch: Partial<DiscountStepDraft>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const [preset, setPreset] = useState({ percent: "100", payments: "3", months: "1" });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <TextField label="%" className="w-20" inputMode="decimal" value={preset.percent} onChange={(e) => setPreset({ ...preset, percent: e.target.value })} />
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.firstPayment(preset.percent))}>
          {t.formFirstPaymentOnly}
        </Button>
        <TextField label={t.formPayments} className="w-24" inputMode="numeric" value={preset.payments} onChange={(e) => setPreset({ ...preset, payments: e.target.value })} />
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.forPayments(preset.percent, preset.payments))}>
          {t.formForNPayments}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.everyPayment(preset.percent))}>
          {t.formEveryPayment}
        </Button>
        <TextField label={t.months} className="w-20" inputMode="numeric" value={preset.months} onChange={(e) => setPreset({ ...preset, months: e.target.value })} />
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.freeMonths(preset.months, cycle))}>
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
          <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.formRemoveDiscountStep, { n: i + 1 })} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...steps, { count: "", type: "percentage", amount: "", currency: "EGP" }])}>
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
          <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.formRemoveStep, { label, n: i + 1 })} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...steps, { count: "", percent: "" }])}>
        <Plus /> {fmt(t.formAddStep, { label })}
      </Button>
    </div>
  );
}

function CycleEditor({ cycle, draft, onChange, hasAgent }: { cycle: BillingCycle; draft: CycleDraft; onChange: (d: CycleDraft) => void; hasAgent: boolean }) {
  const t = useT(REFERRAL_STRINGS);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-medium text-ink">{t.discount}</h4>
        <DiscountSteps cycle={cycle} steps={draft.discount} onChange={(discount) => onChange({ ...draft, discount })} />
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-ink">{t.formAgentCommission}</h4>
        {hasAgent ? (
          <RateSteps label={t.formCommissionWord} steps={draft.commission} onChange={(commission) => onChange({ ...draft, commission })} />
        ) : (
          <p className="text-sm text-ink-soft">{t.formNoAgentNote}</p>
        )}
      </div>
    </div>
  );
}

/** The first payments under the form's unsaved schedules, for one plan and cycle (POST /admin/referral-codes/simulate). */
export function Simulator({ form, plans }: { form: CodeForm; plans: AdminPlan[] }) {
  const t = useT(REFERRAL_STRINGS);
  const paid = plans.filter((p) => p.monthlyPrice > 0);
  const [planId, setPlanId] = useState(paid[0]?.id ?? "");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [result, setResult] = useState<AdminReferralSimulation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const terms = termsOf(form);
      setResult(await adminApi.simulateReferralCode({ planId, billingCycle: cycle, terms, commissionBasis: form.commissionBasis, hasAgent: Boolean(form.agentId) }));
    } catch (err) {
      setResult(null);
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number) => (result ? formatMinorMoneyExact(n, result.currency) : "");
  return (
    <section aria-label={t.simTitle} className="space-y-3 rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="font-medium text-ink">{t.simTitle}</h3>
      <p className="text-sm text-ink-soft">{t.simHint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <SelectField label={t.plan} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {paid.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t.billing} value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
          {CYCLES.map((c) => (
            <option key={c} value={c}>
              {cycleLabel(c)}
            </option>
          ))}
        </SelectField>
        <Button type="button" variant="outline" disabled={busy || !planId} onClick={() => void run()}>
          {busy ? t.working : t.simShow}
        </Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {result && (
        <Panel flush>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th>{t.simPayment}</Th>
                <Th className="text-end">{t.simListPrice}</Th>
                <Th className="text-end">{t.discount}</Th>
                <Th className="text-end">{t.simMerchantPays}</Th>
                <Th className="text-end">{t.formAgentCommission}</Th>
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
                  <Td className="text-end tabular-nums">
                    {money(r.commission)}
                    {r.commissionRateBp != null && <span className="block text-xs text-ink-soft">{percentText(r.commissionRateBp)}</span>}
                  </Td>
                  <Td className={r.platformNet < 0 ? "text-end text-danger tabular-nums" : "text-end tabular-nums"}>{money(r.platformNet)}</Td>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <Td>{t.simTotal}</Td>
                <Td className="text-end tabular-nums">{money(result.totals.listPrice)}</Td>
                <Td className="text-end tabular-nums">{money(result.totals.discount)}</Td>
                <Td className="text-end tabular-nums">{money(result.totals.merchantPays)}</Td>
                <Td className="text-end tabular-nums">{money(result.totals.commission)}</Td>
                <Td className="text-end tabular-nums">{money(result.totals.platformNet)}</Td>
              </TableRow>
            </TableBody>
          </Table>
        </Panel>
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
  const [tab, setTab] = useState<BillingCycle>("monthly");
  const set = (patch: Partial<CodeForm>) => setForm((f) => ({ ...f, ...patch }));
  const hasAgent = Boolean(form.agentId);
  const switchingOff = !creating && code.active && !form.active;
  const audiences = audienceLabels();
  const grants = grantLabels();

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
  const toggleCycle = (c: BillingCycle) => set({ allowedCycles: form.allowedCycles.includes(c) ? form.allowedCycles.filter((x) => x !== c) : [...form.allowedCycles, c] });

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={creating ? t.codeNew : fmt(t.codeEdit, { code: isolate(code.code) })}
      description={description ?? t.formDefaultDescription}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="referral-code-form" disabled={busy || (creating && form.code.trim().length < 3)}>
            {busy ? t.saving : (submitLabel ?? (creating ? t.codeCreate : t.save))}
          </Button>
        </>
      }
    >
      <form id="referral-code-form" onSubmit={submit} className="space-y-6">
        {error && <Alert variant="danger">{error}</Alert>}

        <section className="grid gap-4 sm:grid-cols-2">
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
          <SelectField label={t.whoCanEnter} value={form.audience} onChange={(e) => set({ audience: e.target.value as ReferralAudience })} hint={t.formWhoHint}>
            {(Object.keys(audiences) as ReferralAudience[]).map((a) => (
              <option key={a} value={a}>
                {audiences[a]}
              </option>
            ))}
          </SelectField>
          {!creating && !fixedOwner && !neverApproved(code) && (
            <Toggle
              label={t.active}
              description={t.formActiveHint}
              checked={form.active}
              onChange={(active) => set({ active })}
            />
          )}
        </section>
        {switchingOff && impact && (
          <Alert variant="danger" role="alert">
            {impact.trialingUnpaid > 0
              ? fmt(t.formOffWarnTrial, { trial: impact.trialingUnpaid, current: impact.currentStores })
              : fmt(t.formOffWarn, { current: impact.currentStores })}
          </Alert>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
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
        </section>

        <section className="space-y-3">
          <h3 className="font-medium text-ink">{t.formRestrictions}</h3>
          {plans.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label={t.plans}>
              <span className="text-sm text-ink-soft">{t.formPlansNoneTicked}</span>
              {plans.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.allowedPlanIds.includes(p.id)} onChange={() => togglePlan(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label={t.billing}>
            <span className="text-sm text-ink-soft">{t.formBillingNoneTicked}</span>
            {CYCLES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={form.allowedCycles.includes(c)} onChange={() => toggleCycle(c)} />
                {cycleLabel(c)}
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t.minPlanPrice} inputMode="decimal" value={form.minPriceAmount} onChange={(e) => set({ minPriceAmount: e.target.value })} placeholder={t.none} />
            <TextField label={t.formItsCurrency} maxLength={3} dir="ltr" value={form.minPriceCurrency} onChange={(e) => set({ minPriceCurrency: e.target.value.toUpperCase() })} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-medium text-ink">{t.formScheduleTitle}</h3>
          {!creating && code.kind === "legacy" && (
            <Toggle
              label={t.formGiveSchedule}
              description={fmt(t.formGiveScheduleHint, { discount: describeCodeDiscount(code) })}
              checked={form.useSchedule}
              onChange={(useSchedule) => set({ useSchedule })}
            />
          )}
          {form.useSchedule && (
            <>
              <Toggle
                label={t.formSameForBoth}
                checked={form.sameForBoth}
                onChange={(sameForBoth) => set({ sameForBoth, ...(sameForBoth ? {} : { yearly: form.monthly }) })}
              />
              {form.sameForBoth ? (
                <CycleEditor cycle="monthly" hasAgent={hasAgent} draft={form.monthly} onChange={(monthly) => set({ monthly })} />
              ) : (
                <div className="space-y-3">
                  <div role="tablist" className="flex gap-2">
                    {CYCLES.map((c) => (
                      <Button key={c} type="button" role="tab" aria-selected={tab === c} size="sm" variant={tab === c ? "default" : "outline"} onClick={() => setTab(c)}>
                        {cycleLabel(c)}
                      </Button>
                    ))}
                  </div>
                  <CycleEditor
                    cycle={tab}
                    hasAgent={hasAgent}
                    draft={form[tab]}
                    onChange={(d) => set({ [tab]: d } as Partial<CodeForm>)}
                  />
                </div>
              )}
              {hasAgent && (
                <SelectField
                  label={t.commissionOn}
                  value={form.commissionBasis}
                  onChange={(e) => set({ commissionBasis: e.target.value as ReferralCommissionBasis })}
                  hint={t.formCommissionOnHint}
                >
                  <option value="paid">{t.whatMerchantPaid}</option>
                  <option value="list">{t.listPriceThe}</option>
                </SelectField>
              )}
            </>
          )}
          {hasAgent && (
            <Toggle
              label={t.formLinksAgent}
              description={t.formLinksAgentHint}
              checked={form.linksAgent}
              onChange={(linksAgent) => set({ linksAgent })}
            />
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
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
        </section>

        {form.useSchedule && can(P.AGENTS_VIEW) && <Simulator form={form} plans={plans} />}
      </form>
    </Modal>
  );
}
