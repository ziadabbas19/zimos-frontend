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
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatMinorMoneyExact } from "@/lib/format";
import {
  AUDIENCE_LABELS,
  CYCLES,
  GRANT_LABELS,
  PRESETS,
  describeCodeDiscount,
  initialCodeForm,
  percentText,
  termsOf,
  toCodeInput,
  type CodeForm,
  type CycleDraft,
  type DiscountStepDraft,
  type RateStepDraft,
} from "@/lib/referralCodes";

/**
 * The second kind of referral code's form (Agents → Referral codes,
 * migration 725): who may enter it, when and how often, for which plans,
 * the discount and commission schedules per cycle, the commission basis,
 * the agent link and a one-time benefit, with the simulator under it.
 * Units are converted in lib/referralCodes; the server checks everything again.
 */

const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Monthly", yearly: "Yearly" };

function StepCount({ value, onChange, last, label }: { value: string; onChange: (v: string) => void; last: boolean; label: string }) {
  return (
    <TextField
      label={label}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={last ? "Every payment after" : "1"}
      hint={last ? "Empty: every payment after." : undefined}
    />
  );
}

function DiscountSteps({ steps, onChange, cycle }: { steps: DiscountStepDraft[]; onChange: (next: DiscountStepDraft[]) => void; cycle: BillingCycle }) {
  const set = (i: number, patch: Partial<DiscountStepDraft>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const [preset, setPreset] = useState({ percent: "100", payments: "3", months: "1" });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <TextField label="%" className="w-20" inputMode="decimal" value={preset.percent} onChange={(e) => setPreset({ ...preset, percent: e.target.value })} />
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.firstPayment(preset.percent))}>
          First payment only
        </Button>
        <TextField label="Payments" className="w-24" inputMode="numeric" value={preset.payments} onChange={(e) => setPreset({ ...preset, payments: e.target.value })} />
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.forPayments(preset.percent, preset.payments))}>
          For N payments
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.everyPayment(preset.percent))}>
          Every payment
        </Button>
        <TextField label="Months" className="w-20" inputMode="numeric" value={preset.months} onChange={(e) => setPreset({ ...preset, months: e.target.value })} />
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(PRESETS.freeMonths(preset.months, cycle))}>
          Free months
        </Button>
      </div>
      {steps.length === 0 && <p className="text-sm text-ink-soft">No discount on this cycle.</p>}
      {steps.map((step, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[7rem_10rem_8rem_6rem_auto]">
          <StepCount label={`Step ${i + 1}: payments`} value={step.count} last={i === steps.length - 1} onChange={(count) => set(i, { count })} />
          <SelectField label="Type" value={step.type} onChange={(e) => set(i, { type: e.target.value as DiscountStepDraft["type"] })}>
            <option value="percentage">Percent off</option>
            <option value="fixed">Amount off</option>
            <option value="free_months">Free months</option>
          </SelectField>
          <TextField
            label={step.type === "percentage" ? "Percent" : step.type === "fixed" ? "Amount" : "Months"}
            inputMode="decimal"
            value={step.amount}
            onChange={(e) => set(i, { amount: e.target.value })}
          />
          {step.type === "fixed" ? (
            <TextField label="Currency" maxLength={3} value={step.currency} onChange={(e) => set(i, { currency: e.target.value.toUpperCase() })} />
          ) : (
            <span />
          )}
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove discount step ${i + 1}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...steps, { count: "", type: "percentage", amount: "", currency: "EGP" }])}>
        <Plus /> Add a discount step
      </Button>
    </div>
  );
}

export function RateSteps({ steps, onChange, label }: { steps: RateStepDraft[]; onChange: (next: RateStepDraft[]) => void; label: string }) {
  const set = (i: number, patch: Partial<RateStepDraft>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-3">
      {steps.length === 0 && <p className="text-sm text-ink-soft">No commission on this cycle.</p>}
      {steps.map((step, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[7rem_8rem_auto]">
          <StepCount label={`Step ${i + 1}: payments`} value={step.count} last={i === steps.length - 1} onChange={(count) => set(i, { count })} />
          <TextField label="Rate (%)" inputMode="decimal" value={step.percent} onChange={(e) => set(i, { percent: e.target.value })} />
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${label} step ${i + 1}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...steps, { count: "", percent: "" }])}>
        <Plus /> Add a {label} step
      </Button>
    </div>
  );
}

function CycleEditor({ cycle, draft, onChange, hasAgent }: { cycle: BillingCycle; draft: CycleDraft; onChange: (d: CycleDraft) => void; hasAgent: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-medium text-ink">Discount</h4>
        <DiscountSteps cycle={cycle} steps={draft.discount} onChange={(discount) => onChange({ ...draft, discount })} />
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-ink">Agent commission</h4>
        {hasAgent ? (
          <RateSteps label="commission" steps={draft.commission} onChange={(commission) => onChange({ ...draft, commission })} />
        ) : (
          <p className="text-sm text-ink-soft">No agent: a discount only, nobody earns a commission.</p>
        )}
      </div>
    </div>
  );
}

/** The first payments under the form's unsaved schedules, for one plan and cycle (POST /admin/referral-codes/simulate). */
export function Simulator({ form, plans }: { form: CodeForm; plans: AdminPlan[] }) {
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
    <section aria-label="Simulator" className="space-y-3 rounded-[var(--radius-card)] border border-line p-4">
      <h3 className="font-medium text-ink">Simulator</h3>
      <p className="text-sm text-ink-soft">The first 12 payments under these settings, before saving.</p>
      <div className="flex flex-wrap items-end gap-2">
        <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {paid.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Billing" value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
          {CYCLES.map((c) => (
            <option key={c} value={c}>
              {CYCLE_LABEL[c]}
            </option>
          ))}
        </SelectField>
        <Button type="button" variant="outline" disabled={busy || !planId} onClick={() => void run()}>
          {busy ? "Working…" : "Show payments"}
        </Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {result && (
        <Panel flush>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th>Payment</Th>
                <Th className="text-end">List price</Th>
                <Th className="text-end">Discount</Th>
                <Th className="text-end">Merchant pays</Th>
                <Th className="text-end">Agent commission</Th>
                <Th className="text-end">Platform keeps</Th>
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
                <Td>Total</Td>
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
  onClose: () => void;
  onSaved: (code: AdminReferralCode) => void;
}) {
  const creating = !code;
  const [form, setForm] = useState<CodeForm>(() => initialCodeForm(code, defaultRateBp));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<BillingCycle>("monthly");
  const set = (patch: Partial<CodeForm>) => setForm((f) => ({ ...f, ...patch }));
  const hasAgent = Boolean(form.agentId);
  const switchingOff = !creating && code.active && !form.active;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let input: AdminReferralCodeInput & { code?: string };
    try {
      input = toCodeInput(form, { creating });
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    setBusy(true);
    try {
      const saved = creating
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
      title={creating ? "New referral code" : `Edit ${code.code}`}
      description="Changes apply to stores that enter the code from now on, and to payments still to come. Past payments never change."
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="referral-code-form" disabled={busy || (creating && form.code.trim().length < 3)}>
            {busy ? "Saving…" : creating ? "Create code" : "Save"}
          </Button>
        </>
      }
    >
      <form id="referral-code-form" onSubmit={submit} className="space-y-6">
        {error && <Alert variant="danger">{error}</Alert>}

        <section className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Code"
            required={creating}
            disabled={!creating}
            value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            placeholder="WELCOME"
            maxLength={32}
            hint={creating ? "3–32 letters, digits or dashes. It can't be changed later." : "Codes can't be renamed."}
          />
          <TextField label="Label" value={form.label} onChange={(e) => set({ label: e.target.value })} maxLength={120} hint="Internal only — merchants never see it." />
          <SelectField label="Agent" value={form.agentId} onChange={(e) => set({ agentId: e.target.value })} hint="Optional. No agent: a discount only, no commission. Stores already linked keep their agent.">
            <option value="">No agent</option>
            {agents
              .filter((a) => a.isAgent || a.id === form.agentId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName} ({a.email})
                </option>
              ))}
          </SelectField>
          <SelectField label="Who can enter it" value={form.audience} onChange={(e) => set({ audience: e.target.value as ReferralAudience })} hint="New: an owner with no other store and no payment yet.">
            {(Object.keys(AUDIENCE_LABELS) as ReferralAudience[]).map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABELS[a]}
              </option>
            ))}
          </SelectField>
          {!creating && (
            <Toggle
              label="Active"
              description="Off: it can't be entered, and gives no discount or commission on any payment from now on — including charges already priced with it."
              checked={form.active}
              onChange={(active) => set({ active })}
            />
          )}
        </section>
        {switchingOff && impact && (
          <Alert variant="danger" role="alert">
            {impact.trialingUnpaid > 0
              ? `${impact.trialingUnpaid} store(s) on a trial entered this code and haven't paid yet: switched off, they lose its discount on their first payment. ${impact.currentStores} store(s) use it now.`
              : `${impact.currentStores} store(s) use it now; switched off, their payments from now on get no discount and earn no commission.`}
          </Alert>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <TextField label="Starts" type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} hint="Optional." />
          <TextField label="Ends" type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} hint="Optional. Stores that entered it keep it." />
          <TextField
            label="Use limit (stores)"
            inputMode="numeric"
            value={form.maxUses}
            onChange={(e) => set({ maxUses: e.target.value })}
            placeholder="No limit"
            hint={!creating ? `Used ${code.usesCount ?? 0} so far. Lowering it never takes it from a store.` : "Each store, account and email once."}
          />
        </section>

        <section className="space-y-3">
          <h3 className="font-medium text-ink">Restrictions</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Plans">
            <span className="text-sm text-ink-soft">Plans (none ticked: any):</span>
            {plans.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={form.allowedPlanIds.includes(p.id)} onChange={() => togglePlan(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Billing">
            <span className="text-sm text-ink-soft">Billing (none ticked: both):</span>
            {CYCLES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={form.allowedCycles.includes(c)} onChange={() => toggleCycle(c)} />
                {CYCLE_LABEL[c]}
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Minimum plan price" inputMode="decimal" value={form.minPriceAmount} onChange={(e) => set({ minPriceAmount: e.target.value })} placeholder="None" />
            <TextField label="Its currency" maxLength={3} value={form.minPriceCurrency} onChange={(e) => set({ minPriceCurrency: e.target.value.toUpperCase() })} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-medium text-ink">Discount and commission, payment by payment</h3>
          {!creating && code.kind === "legacy" && (
            <Toggle
              label="Give it a schedule"
              description={`Today: ${describeCodeDiscount(code)}, and its commission on every payment. With a schedule, every store using it follows the schedule from its next payment, each at its own payment number.`}
              checked={form.useSchedule}
              onChange={(useSchedule) => set({ useSchedule })}
            />
          )}
          {form.useSchedule && (
            <>
              <Toggle
                label="Same for monthly and yearly"
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
                        {CYCLE_LABEL[c]}
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
                  label="Commission on"
                  value={form.commissionBasis}
                  onChange={(e) => set({ commissionBasis: e.target.value as ReferralCommissionBasis })}
                  hint="What was paid: a free payment earns nothing. The list price: the agent earns on the price before the discount, even when the merchant paid nothing."
                >
                  <option value="paid">What the merchant paid</option>
                  <option value="list">The list price</option>
                </SelectField>
              )}
            </>
          )}
          {hasAgent && (
            <Toggle
              label="Entering it links the store to this agent"
              description="Only a store with no agent yet; a store already linked keeps its agent. The commission starts with the payment the code applies to."
              checked={form.linksAgent}
              onChange={(linksAgent) => set({ linksAgent })}
            />
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <SelectField label="One-time benefit" value={form.grantType} onChange={(e) => set({ grantType: e.target.value as CodeForm["grantType"] })} hint="Given once, when the code is entered.">
            <option value="">None</option>
            {(Object.keys(GRANT_LABELS) as (keyof typeof GRANT_LABELS)[]).map((g) => (
              <option key={g} value={g}>
                {GRANT_LABELS[g]}
              </option>
            ))}
          </SelectField>
          {form.grantType && (
            <TextField
              label={form.grantType === "trial_days" ? "Days" : form.grantType === "free_orders" ? "Orders" : "Amount (EGP)"}
              inputMode="decimal"
              value={form.grantValue}
              onChange={(e) => set({ grantValue: e.target.value })}
            />
          )}
        </section>

        {form.useSchedule && <Simulator form={form} plans={plans} />}
      </form>
    </Modal>
  );
}
