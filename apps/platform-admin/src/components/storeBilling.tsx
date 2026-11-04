import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminFeatureOverride,
  AdminManualSubscription,
  AdminPlan,
  AdminWorkspaceFeature,
  PlanFeatureCatalogEntry,
  PlanFeatureKey,
} from "@store-builder/api-client";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { P } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMinorMoney } from "@/lib/format";
import { catalogFromFeatureTable, featureLabelIn } from "@/lib/planFeatures";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { DataState, EmptyBlock } from "./DataState";
import { DetailRow } from "./Drawer";
import { FeaturePicker } from "./FeaturePicker";
import { Field, NativeSelect, TextAreaField, TextField } from "./forms";
import { Modal } from "./Modal";
import { Panel, Td, Th } from "./Panel";
import { PricingBadge, Status, StatusBadge } from "./StatusBadge";
import { useToast } from "./Toast";

const DAY_MS = 86_400_000;
const QUICK_MONTHS = [1, 3, 6, 12];

const SOURCE_LABEL: Record<string, string> = {
  manual_admin: "Set by an admin",
  payment: "Paid",
  special_terms: "Special terms",
  trial: "Trial",
  draft: "Not subscribed yet",
  other: "—",
};
const ACTION_LABEL: Record<string, string> = {
  activate: "Activated",
  change_plan: "Plan changed",
  extend: "Extended",
  end_now: "Ended",
};

/** A date input's value (YYYY-MM-DD) for a moment, in the admin's own time zone. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** "In 3 months" chips, or a custom number of days. */
function DurationPicker({
  value,
  onChange,
  allowEndDate,
  endDate,
  onEndDate,
}: {
  value: { months?: number; days?: number } | null;
  onChange: (d: { months?: number; days?: number } | null) => void;
  allowEndDate?: boolean;
  endDate?: string;
  onEndDate?: (v: string) => void;
}) {
  const custom = value === null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">Length</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Length">
        {QUICK_MONTHS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value?.months === m}
            onClick={() => onChange({ months: m })}
            className={`min-h-11 rounded-[0.875rem] border px-3 text-sm ${value?.months === m ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft hover:border-ink-soft"}`}
          >
            {m === 12 ? "1 year" : `${m} month${m > 1 ? "s" : ""}`}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={Boolean(value?.days)}
          onClick={() => onChange({ days: value?.days ?? 30 })}
          className={`min-h-11 rounded-[0.875rem] border px-3 text-sm ${value?.days ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft hover:border-ink-soft"}`}
        >
          Days
        </button>
        {allowEndDate && (
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            onClick={() => onChange(null)}
            className={`min-h-11 rounded-[0.875rem] border px-3 text-sm ${custom ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft hover:border-ink-soft"}`}
          >
            Until a date
          </button>
        )}
      </div>
      {value?.days !== undefined && (
        <TextField
          label="Number of days"
          type="number"
          min={1}
          max={1826}
          value={String(value.days)}
          onChange={(e) => onChange({ days: Number(e.target.value) })}
        />
      )}
      {allowEndDate && custom && (
        <TextField label="Ends on" type="date" required value={endDate ?? ""} onChange={(e) => onEndDate?.(e.target.value)} />
      )}
    </fieldset>
  );
}

type Dialog = null | "activate" | "extend" | "end";

/**
 * The store's subscription as the lifecycle sees it, and the manual actions:
 * activate or change the plan, extend, end now. Each goes through a review
 * screen that states what will happen, and carries one Idempotency-Key per
 * dialog so a double click acts once. Nothing here charges anyone.
 */
export function ManualSubscriptionPanel({ workspaceId, canManage, onChanged }: { workspaceId: string; canManage: boolean; onChanged?: () => void }) {
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => apiClient.adminGetManualSubscription(workspaceId), [workspaceId]);
  const { can } = useAuth();
  const canReadPlans = can(P.PLANS_VIEW);
  const plans = useAsync(() => (canReadPlans ? adminApi.listPlans() : Promise.resolve([])), []);
  const [dialog, setDialog] = useState<Dialog>(null);

  const done = async (message: string) => {
    setDialog(null);
    toast.success(message);
    await refresh({ silent: true });
    onChanged?.();
  };

  return (
    <Panel
      title="Subscription"
      actions={
        canManage && data ? (
          <div className="flex flex-wrap gap-2">
            {/* Choosing the plan reads the plan list, which is its own permission. */}
            {canReadPlans && (
              <Button size="sm" onClick={() => setDialog("activate")}>
                Activate / change plan
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDialog("extend")}>
              Extend
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("end")}>
              End now
            </Button>
          </div>
        ) : undefined
      }
    >
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && <SubscriptionSummary data={data} />}
      </DataState>
      {data && dialog === "activate" && (
        <ActivateDialog workspaceId={workspaceId} data={data} plans={plans.data ?? []} onClose={() => setDialog(null)} onDone={done} />
      )}
      {data && dialog === "extend" && <ExtendDialog workspaceId={workspaceId} data={data} onClose={() => setDialog(null)} onDone={done} />}
      {data && dialog === "end" && <EndDialog workspaceId={workspaceId} data={data} onClose={() => setDialog(null)} onDone={done} />}
    </Panel>
  );
}

function limitText(used: number, max: number | null) {
  return max === null ? `${used} (unlimited)` : `${used} of ${max}`;
}

function SubscriptionSummary({ data }: { data: AdminManualSubscription }) {
  const s = data.subscription;
  const limits = data.limits;
  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label="Plan">{s.plan?.name ?? "—"}</DetailRow>
        <DetailRow label="Status">
          {s.draft ? (
            <StatusBadge tone="info" dot>
              Draft — not subscribed
            </StatusBadge>
          ) : (
            <>
              <Status value={s.status} />
              <PricingBadge kind={s.pricingKind} />
              {s.phase !== "ok" && (
                <StatusBadge tone={s.phase === "restricted" || s.phase === "grace" ? "danger" : "warning"} className="ms-2">
                  {s.phase.replace(/_/g, " ")}
                </StatusBadge>
              )}
            </>
          )}
        </DetailRow>
        {s.draft ? (
          <DetailRow label="Period">
            <span className="text-ink-soft">Starts when the store is activated or starts its trial</span>
          </DetailRow>
        ) : (
          <DetailRow label="Period">
            {formatDate(s.currentPeriodStart)} → {formatDate(s.currentPeriodEnd)}
          </DetailRow>
        )}
        <DetailRow label="Trial ends">{s.trialEndsAt ? formatDateTime(s.trialEndsAt) : "—"}</DetailRow>
        {s.pricingKind && s.pricingKind !== "paid" && (
          <DetailRow label="Pricing">
            {s.pricingKind === "free" ? "Free (gift)" : s.discountPercent ? `Discounted ${s.discountPercent}%` : "Discounted"}
            {s.currency != null && s.effectivePrice != null && (
              <span className="ms-2 tabular text-ink-soft">{formatMinorMoney(s.effectivePrice, s.currency)} / {s.billingCycle === "yearly" ? "year" : "month"}</span>
            )}
            {s.pricingExpiredAt && <span className="ms-2 text-xs text-danger">ended {formatDate(s.pricingExpiredAt)}, not renewed</span>}
          </DetailRow>
        )}
        {limits && (
          <>
            <DetailRow label="Owner's stores">
              <span className="tabular">{limitText(limits.stores.used, limits.stores.max)}</span>
            </DetailRow>
            <DetailRow label="Funnels this month">
              <span className="tabular">{limitText(limits.funnelsThisMonth.used, limits.funnelsThisMonth.max)}</span>
              <span className="ms-2 text-xs text-ink-soft">resets {formatDate(limits.funnelsThisMonth.resetsAt)}</span>
            </DetailRow>
          </>
        )}
        <DetailRow label="Set by">{SOURCE_LABEL[s.source] ?? s.source}</DetailRow>
        {s.restrictsAt && s.phase !== "ok" && s.phase !== "expiring" && (
          <DetailRow label="Restricted from">{formatDateTime(s.restrictsAt)}</DetailRow>
        )}
      </dl>
      {data.openCharge && (
        <p className="rounded-[0.875rem] border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-ink">
          A charge is open for {formatDate(data.openCharge.periodStart)} → {formatDate(data.openCharge.periodEnd)}. Manual changes leave it as it is.
        </p>
      )}
      {data.history.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Manual changes</h3>
          <ul className="divide-y divide-line rounded-[0.875rem] border border-line text-sm">
            {data.history.map((h) => (
              <li key={h.id} className="space-y-0.5 px-3 py-2">
                <p className="font-medium text-ink">
                  {ACTION_LABEL[h.action] ?? h.action}
                  {h.planAfter && h.planAfter.id !== h.planBefore?.id && ` → ${h.planAfter.name ?? "plan"}`}
                  <span className="ms-2 text-xs font-normal text-ink-soft">
                    {formatDate(h.periodStartAfter)} → {formatDate(h.periodEndAfter)}
                  </span>
                </p>
                <p className="text-ink-soft">“{h.note}”</p>
                <p className="text-xs text-ink-soft">
                  {h.actor?.fullName ?? "Someone"} · {formatDateTime(h.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReviewList({ lines }: { lines: string[] }) {
  return (
    <ul className="list-disc space-y-1 ps-5 text-sm text-ink">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

function DialogFooter({
  step,
  onBack,
  onClose,
  onNext,
  onConfirm,
  busy,
  confirmLabel,
  danger,
}: {
  step: "form" | "review";
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
  onConfirm: () => void;
  busy: boolean;
  confirmLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      {step === "form" ? (
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onNext}>Review</Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button variant={danger ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </>
      )}
    </div>
  );
}

function useAction(workspaceId: string) {
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: "activate" | "change-plan" | "extend" | "end", body: Record<string, unknown>, onOk: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.adminManualSubscriptionAction(workspaceId, action, body, key);
      await onOk();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}

function ActivateDialog({
  workspaceId,
  data,
  plans,
  onClose,
  onDone,
}: {
  workspaceId: string;
  data: AdminManualSubscription;
  plans: AdminPlan[];
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  // Read once when the dialog opens: "today" for the form and the summary.
  const [now] = useState(() => Date.now());
  const today = localDay(new Date(now));
  const active = plans.filter((p) => p.active);
  const [planId, setPlanId] = useState(data.subscription.plan?.id ?? active[0]?.id ?? "");
  const [keepDates, setKeepDates] = useState(false);
  const [start, setStart] = useState(today);
  const [duration, setDuration] = useState<{ months?: number; days?: number } | null>({ months: 1 });
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [pricing, setPricing] = useState<"paid" | "free" | "discounted">("paid");
  const [discountBy, setDiscountBy] = useState<"percent" | "amount">("percent");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const { run, busy, error, setError } = useAction(workspaceId);

  const plan = active.find((p) => p.id === planId);
  const cycle = data.subscription.billingCycle;
  const fullPrice = plan ? (cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) : 0;
  const percentValue = Number(percent);
  // The amount is typed in major units; the API takes minor units.
  const amountMinor = Math.round(Number(amount) * 100);
  const effective =
    pricing === "free" ? 0 : pricing === "discounted" ? (discountBy === "percent" ? Math.round((fullPrice * (100 - percentValue)) / 100) : amountMinor) : fullPrice;
  const startDate = start === today ? new Date(now) : new Date(`${start}T00:00:00`);
  const end = keepDates
    ? new Date(data.subscription.currentPeriodEnd)
    : duration === null
      ? endDate
        ? new Date(`${endDate}T23:59:59`)
        : null
      : duration.months
        ? addMonths(startDate, duration.months)
        : duration.days
          ? new Date(startDate.getTime() + duration.days * DAY_MS)
          : null;

  function review() {
    if (!plan) return setError("Choose an active plan.");
    if (note.trim().length < 3) return setError("Write a note: why, and what was agreed.");
    if (!keepDates && (!end || end.getTime() <= now)) return setError("The period must end in the future.");
    if (keepDates && plan.id === data.subscription.plan?.id) return setError("The store is already on this plan.");
    if (!keepDates && pricing === "discounted") {
      if (discountBy === "percent" && !(Number.isInteger(percentValue) && percentValue >= 1 && percentValue <= 99)) {
        return setError("The discount must be a whole percent between 1 and 99.");
      }
      if (discountBy === "amount" && !(amountMinor >= 1 && amountMinor < fullPrice)) {
        return setError("The discounted price must be more than zero and less than the plan price.");
      }
    }
    setError(null);
    setStep("review");
  }

  const lines = keepDates
    ? [
        `Plan: ${data.subscription.plan?.name ?? "none"} → ${plan?.name}.`,
        `The period stays ${formatDate(data.subscription.currentPeriodStart)} → ${formatDate(data.subscription.currentPeriodEnd)}.`,
        "No charge is created; no commission is recorded.",
      ]
    : [
        `Plan: ${plan?.name}, active from ${formatDate(startDate.toISOString())} to ${end ? formatDate(end.toISOString()) : "—"}.`,
        pricing === "paid"
          ? "Pricing: paid, at the plan price."
          : `Pricing: ${pricing === "free" ? "free (gift)" : "discounted"}, ${plan ? formatMinorMoney(effective, plan.currency) : "—"} per ${cycle === "yearly" ? "year" : "month"}. It counts in MRR at this price and is never charged at the plan price; when the period ends it is not renewed.`,
        "Any expired banner or restriction is lifted now; after the end date the usual warning, grace day and restriction apply.",
        "No charge is created; no commission is recorded.",
      ];

  async function confirm() {
    if (keepDates) {
      await run("change-plan", { planId, note: note.trim() }, () => onDone("Plan changed."));
      return;
    }
    const body: Record<string, unknown> = { planId, note: note.trim() };
    if (start !== today) body.startsAt = startDate.toISOString();
    if (duration === null) body.endsAt = end?.toISOString();
    else body.duration = duration;
    body.pricingKind = pricing;
    if (pricing === "discounted") {
      if (discountBy === "percent") body.discountPercent = percentValue;
      else body.priceOverrideAmount = amountMinor;
    }
    await run("activate", body, () => onDone("Subscription activated."));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Activate or change the plan"
      description="Set this store's subscription by hand — for a payment received outside the platform, a partner or a test store."
      footer={
        <DialogFooter
          step={step}
          onBack={() => setStep("form")}
          onClose={onClose}
          onNext={review}
          onConfirm={() => void confirm()}
          busy={busy}
          confirmLabel={keepDates ? "Change plan" : "Activate"}
        />
      }
    >
      {step === "form" ? (
        <div className="space-y-4">
          <Field label="Plan" required>
            {({ id }) => (
              <NativeSelect id={id} value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4" checked={keepDates} onChange={(e) => setKeepDates(e.target.checked)} />
            Only change the plan — keep the current period
          </label>
          {!keepDates && (
            <>
              <TextField label="Starts on" type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} hint="Today by default; may be in the past." />
              <DurationPicker value={duration} onChange={setDuration} allowEndDate endDate={endDate} onEndDate={setEndDate} />
              <Field label="Pricing" required hint="Paid is the plan price, as before. Free and discounted are never charged at the plan price.">
                {({ id }) => (
                  <NativeSelect id={id} value={pricing} onChange={(e) => setPricing(e.target.value as typeof pricing)}>
                    <option value="paid">Paid (plan price)</option>
                    <option value="free">Free (gift)</option>
                    <option value="discounted">Discounted</option>
                  </NativeSelect>
                )}
              </Field>
              {pricing === "discounted" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Discount by">
                    {({ id }) => (
                      <NativeSelect id={id} value={discountBy} onChange={(e) => setDiscountBy(e.target.value as typeof discountBy)}>
                        <option value="percent">Percent off</option>
                        <option value="amount">Fixed price per period</option>
                      </NativeSelect>
                    )}
                  </Field>
                  {discountBy === "percent" ? (
                    <TextField label="Percent (1-99)" type="number" min={1} max={99} value={percent} onChange={(e) => setPercent(e.target.value)} />
                  ) : (
                    <TextField label={`Price per ${cycle === "yearly" ? "year" : "month"}${plan ? ` (${plan.currency})` : ""}`} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  )}
                </div>
              )}
            </>
          )}
          <TextAreaField label="Note" required value={note} onChange={(e) => setNote(e.target.value)} rows={3} hint="Why, and what was agreed (kept with the change and in the audit log)." />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <ReviewList lines={lines} />
          <p className="text-sm text-ink-soft">“{note.trim()}”</p>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function ExtendDialog({
  workspaceId,
  data,
  onClose,
  onDone,
}: {
  workspaceId: string;
  data: AdminManualSubscription;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [duration, setDuration] = useState<{ months?: number; days?: number } | null>({ months: 1 });
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const { run, busy, error, setError } = useAction(workspaceId);
  const [now] = useState(() => Date.now());
  const lapsed = new Date(data.subscription.currentPeriodEnd).getTime() < now;
  const from = new Date(Math.max(new Date(data.subscription.currentPeriodEnd).getTime(), now));
  const end = duration?.months ? addMonths(from, duration.months) : duration?.days ? new Date(from.getTime() + duration.days * DAY_MS) : null;

  function review() {
    if (!duration || !end) return setError("Choose how long to extend by.");
    if (note.trim().length < 3) return setError("Write a note.");
    setError(null);
    setStep("review");
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Extend the subscription"
      footer={
        <DialogFooter step={step} onBack={() => setStep("form")} onClose={onClose} onNext={review} onConfirm={() => void run("extend", { duration, note: note.trim() }, () => onDone("Subscription extended."))} busy={busy} confirmLabel="Extend" />
      }
    >
      {step === "form" ? (
        <div className="space-y-4">
          <DurationPicker value={duration} onChange={setDuration} />
          <TextAreaField label="Note" required value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <ReviewList
            lines={[
              `The period ends on ${end ? formatDate(end.toISOString()) : "—"} instead of ${formatDate(data.subscription.currentPeriodEnd)}${lapsed ? " (it had lapsed, so it runs from today)" : ""}.`,
              "The plan stays the same. No charge is created; no commission is recorded.",
            ]}
          />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function EndDialog({
  workspaceId,
  data,
  onClose,
  onDone,
}: {
  workspaceId: string;
  data: AdminManualSubscription;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const { run, busy, error, setError } = useAction(workspaceId);
  function review() {
    if (note.trim().length < 3) return setError("Write a note.");
    setError(null);
    setStep("review");
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="End the subscription now"
      footer={
        <DialogFooter step={step} onBack={() => setStep("form")} onClose={onClose} onNext={review} onConfirm={() => void run("end", { note: note.trim() }, () => onDone("Subscription ended."))} busy={busy} confirmLabel="End now" danger />
      }
    >
      {step === "form" ? (
        <div className="space-y-4">
          <TextAreaField label="Note" required value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <ReviewList
            lines={[
              `The period ends now instead of ${formatDate(data.subscription.currentPeriodEnd)}.`,
              "The store gets the usual grace day, then it is restricted (storefront unavailable, no new products or funnels) until it is paid or activated again.",
            ]}
          />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

// --------------------------------------------------------------- features

function sourceBadge(f: AdminWorkspaceFeature) {
  if (f.source === "override") {
    return f.enabled ? <StatusBadge tone="success">Added by an admin</StatusBadge> : <StatusBadge tone="danger">Removed by an admin</StatusBadge>;
  }
  if (f.source === "plan") return <StatusBadge tone="neutral">From the plan</StatusBadge>;
  return <span className="text-xs text-ink-soft">—</span>;
}

/**
 * The store's features as the platform works them out — the plan's, with this
 * store's overrides winning — each with where it comes from; adding
 * overrides with the plan editor's feature picker; revoking them.
 */
export function FeatureOverridesPanel({ workspaceId, canManage, onChanged }: { workspaceId: string; canManage: boolean; onChanged?: () => void }) {
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => apiClient.adminListWorkspaceFeatures(workspaceId), [workspaceId]);
  // The catalogue's names come with the store's features (no list in the console).
  const catalog = data ? catalogFromFeatureTable(data.features) : [];
  const featureLabel = (key: string) => featureLabelIn(catalog, key);
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<AdminFeatureOverride | null>(null);
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      await apiClient.adminRevokeFeatureOverride(workspaceId, revoking.id);
      toast.success(`${featureLabel(revoking.featureKey)}: back to the plan.`);
      setRevoking(null);
      await refresh({ silent: true });
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Features"
      flush
      actions={
        canManage ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            Add feature
          </Button>
        ) : undefined
      }
    >
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th>Feature</Th>
                <Th>On</Th>
                <Th>Source</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.features.map((f) => (
                <TableRow key={f.key}>
                  <Td className="whitespace-normal">
                    <span className="font-medium text-ink">{featureLabel(f.key)}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {f.override ? (
                        <>
                          “{f.override.reason}”
                          {f.override.expiresAt ? ` · until ${formatDate(f.override.expiresAt)}` : " · no end date"}
                          {f.override.grantedBy && ` · ${f.override.grantedBy.fullName}`}
                        </>
                      ) : f.inPlan ? (
                        "Included in the plan"
                      ) : (
                        "Not in the plan"
                      )}
                    </span>
                  </Td>
                  <Td>{f.enabled ? <StatusBadge tone="success">Yes</StatusBadge> : <StatusBadge tone="neutral">No</StatusBadge>}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {sourceBadge(f)}
                      {f.expiredOverride && <StatusBadge tone="warning">Override expired {formatDate(f.expiredOverride.expiresAt)}</StatusBadge>}
                    </div>
                  </Td>
                  <Td className="text-end">
                    {canManage && f.override && (
                      <Button size="sm" variant="outline" onClick={() => setRevoking(f.override)}>
                        Revoke
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data && data.overrides.some((o) => o.state !== "active") && (
          <div className="border-t border-line px-4 py-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">Past overrides</h3>
            <ul className="space-y-2 text-sm">
              {data.overrides
                .filter((o) => o.state !== "active")
                .map((o) => (
                  <li key={o.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <StatusBadge tone={o.state === "revoked" ? "neutral" : "warning"}>{o.state === "revoked" ? "Revoked" : "Expired"}</StatusBadge>
                    <span className="text-ink">
                      {featureLabel(o.featureKey)} — {o.mode === "grant" ? "added" : "removed"}
                    </span>
                    <span className="text-xs text-ink-soft">
                      “{o.reason}” · {formatDate(o.createdAt)}
                      {o.state === "revoked" && o.revokedAt ? ` → revoked ${formatDate(o.revokedAt)}${o.revokedBy ? ` by ${o.revokedBy.fullName}` : ""}` : ""}
                      {o.state === "expired" && o.expiresAt ? ` → ended ${formatDate(o.expiresAt)}` : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </DataState>
      {adding && data && (
        <AddFeatureDialog
          workspaceId={workspaceId}
          catalog={catalog}
          live={data.features.filter((f) => f.override).map((f) => f.key)}
          onClose={() => setAdding(false)}
          onDone={async (message) => {
            setAdding(false);
            toast.success(message);
            await refresh({ silent: true });
            onChanged?.();
          }}
        />
      )}
      {revoking && (
        <Modal
          open
          onClose={() => setRevoking(null)}
          title={`Revoke the override on ${featureLabel(revoking.featureKey)}?`}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRevoking(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void revoke()} disabled={busy}>
                {busy ? "Revoking…" : "Revoke"}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink">
            The store goes back to what its plan says for this feature. The override stays in the history.
          </p>
        </Modal>
      )}
    </Panel>
  );
}

function AddFeatureDialog({
  workspaceId,
  catalog,
  live,
  onClose,
  onDone,
}: {
  workspaceId: string;
  catalog: PlanFeatureCatalogEntry[];
  live: PlanFeatureKey[];
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [keys, setKeys] = useState<PlanFeatureKey[]>([]);
  const [mode, setMode] = useState<"grant" | "deny">("grant");
  const [until, setUntil] = useState("");
  const [tomorrow] = useState(() => localDay(new Date(Date.now() + DAY_MS)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (keys.length === 0) return setError("Tick at least one feature.");
    if (reason.trim().length < 3) return setError("Write the reason.");
    setBusy(true);
    setError(null);
    try {
      for (const featureKey of keys) {
        await apiClient.adminAddFeatureOverride(workspaceId, {
          featureKey,
          mode,
          reason: reason.trim(),
          expiresAt: until ? new Date(`${until}T23:59:59`).toISOString() : null,
        });
      }
      await onDone(keys.length === 1 ? `${featureLabelIn(catalog, keys[0])} ${mode === "grant" ? "added" : "removed"}.` : `${keys.length} features ${mode === "grant" ? "added" : "removed"}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add or remove features for this store"
      description="On top of its plan. The plan itself is not changed."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">This store</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {(["grant", "deny"] as const).map((m) => (
              <label key={m} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.875rem] border px-3 text-sm ${mode === m ? "border-primary bg-primary-soft" : "border-line"}`}>
                <input type="radio" name="override-mode" checked={mode === m} onChange={() => setMode(m)} />
                {m === "grant" ? "Gets these features" : "Loses these features"}
              </label>
            ))}
          </div>
        </fieldset>
        <FeaturePicker
          catalog={catalog}
          value={keys}
          onChange={setKeys}
          legend="Features"
          disabled={live.map((key) => ({ key, reason: "Has an override — revoke it first" }))}
        />
        <TextField label="Until (optional)" type="date" min={tomorrow} value={until} onChange={(e) => setUntil(e.target.value)} hint="Leave empty for no end date. It stops applying by itself after this day." />
        <TextAreaField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- audit

/** The latest audit entries for this store (subscription, features, access…). */
export function StoreAuditPanel({ workspaceId }: { workspaceId: string }) {
  const { data, loading, error, refresh } = useAsync(() => adminApi.listAuditLog({ workspaceId, limit: 20 }), [workspaceId]);
  return (
    <Panel
      title="Audit log"
      actions={
        <Link to={`/audit-log?workspaceId=${workspaceId}`} className="text-sm font-medium text-primary hover:underline">
          Full log
        </Link>
      }
    >
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && data.rows.length === 0 ? (
          <EmptyBlock message="Nothing recorded for this store yet." />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {data?.rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <code className="font-mono text-xs text-ink">{row.action}</code>
                  <span className="ms-2 text-ink-soft">{row.actorName ?? "System"}</span>
                </span>
                <span className="text-xs text-ink-soft">{formatDateTime(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </Panel>
  );
}
