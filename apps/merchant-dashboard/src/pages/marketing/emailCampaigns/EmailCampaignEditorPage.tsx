import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  EMAIL_CAMPAIGN_RFM_LABELS,
  apiErrorCode,
  apiErrorDetails,
  emailCampaignAudienceCount,
  emailCampaignCreate,
  emailCampaignDelete,
  emailCampaignGet,
  emailCampaignOverview,
  emailCampaignSchedule,
  emailCampaignSend,
  emailCampaignSendTest,
  emailCampaignUnschedule,
  emailCampaignUpdate,
  type EmailCampaign,
  type EmailCampaignOverview,
  type EmailCampaignRfmLabel,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState, CardSkeleton } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PlanFeatureNotice } from "@/components/PlanFeatureNotice";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/errorMessages";
import { usePlanFeatures } from "@/lib/usePlanFeatures";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { BlockEditor } from "./BlockEditor";
import { CampaignResult } from "./CampaignResult";
import { CAMPAIGN_STRINGS, type CampaignText } from "./campaignStrings";
import { CampaignStatusBadge } from "./EmailCampaignsPage";
import { EmailPreview } from "./EmailPreview";
import { QuotaMeter } from "./QuotaMeter";
import { campaignLimitProblem, campaignLimitText } from "./campaignLimits";
import {
  RULE_KEYS,
  audiencePayload,
  audienceReady,
  blankForm,
  formOf,
  payloadOf,
  previewBlocks,
  validate,
  type AudienceKind,
  type CampaignDraftForm,
  type Problems,
  type RuleKey,
} from "./campaignForm";

type Step = "audience" | "content" | "review";
const STEPS: Step[] = ["audience", "content", "review"];
const STEP_LABEL: Record<Step, keyof CampaignText> = { audience: "stepAudience", content: "stepContent", review: "stepReview" };
const AUDIENCES: AudienceKind[] = ["all", "segment", "rfm", "rules"];

/** "2026-11-20T18:30" in the device's time, for <input type="datetime-local">. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** How many the audience reaches, re-counted a moment after it changes. */
function useAudienceCount(form: CampaignDraftForm) {
  const workspaceId = useWorkspaceId();
  const [state, setState] = useState<{ count: number; subscribed: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = audienceReady(form);
  const key = ready ? JSON.stringify(audiencePayload(form)) : "";
  useEffect(() => {
    if (!key) {
      setState(null);
      return;
    }
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      emailCampaignAudienceCount(apiClient, workspaceId, JSON.parse(key))
        .then((r) => live && setState(r))
        .catch(() => live && setState(null))
        .finally(() => live && setLoading(false));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspaceId, key]);
  return { count: state, loading };
}

function Stepper({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  const t = useT(CAMPAIGN_STRINGS);
  return (
    <nav aria-label={t.steps} className="mb-5">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const current = s === step;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onStep(s)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none",
                  current ? "border-primary bg-primary text-white" : "border-line bg-paper-raised text-ink hover:border-primary/50"
                )}
              >
                <span aria-hidden className={cn("flex size-6 items-center justify-center rounded-full text-xs", current ? "bg-white/20" : "bg-paper-sunken")}>
                  {i + 1}
                </span>
                {t[STEP_LABEL[s]]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CampaignEditor({ initial, overview, onSaved }: { initial: EmailCampaign | null; overview: EmailCampaignOverview; onSaved: (c: EmailCampaign) => void }) {
  const t = useT(CAMPAIGN_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scheduleId = useId();

  const start = useMemo(() => (initial ? formOf(initial) : blankForm(overview.locale, overview.sender.replyTo)), [initial, overview]);
  const [form, setForm] = useState<CampaignDraftForm>(start);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(start));
  const dirty = JSON.stringify(form) !== savedJson;
  useReportDirty(dirty);
  const [step, setStep] = useState<Step>("audience");
  const [problems, setProblems] = useState<Problems>({});
  const [busy, setBusy] = useState<null | "save" | "test" | "schedule" | "unschedule">(null);
  const [confirm, setConfirm] = useState<null | "send" | "delete">(null);
  const [scheduleAt, setScheduleAt] = useState(() => localInput(initial?.scheduledAt ? new Date(initial.scheduledAt) : new Date(Date.now() + 3600 * 1000)));
  // The earliest time the picker offers, fixed when the editor opens (the server checks again).
  const [earliest] = useState(() => localInput(new Date(Date.now() + 60 * 1000)));
  const [formError, setFormError] = useState<string | null>(null);
  const audience = useAudienceCount(form);

  const set = <K extends keyof CampaignDraftForm>(key: K, value: CampaignDraftForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const err = (key: string) => (problems[key] ? (t[problems[key]] as string) : undefined);

  function goTo(next: Step) {
    setStep(next);
    // The heading of the new step takes focus, so a screen reader hears where it is.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  /** Saves (creating on first save); answers the saved campaign, or null with the problems shown. */
  async function save({ forSending = false } = {}): Promise<EmailCampaign | null> {
    const found = validate(form, { forSending });
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setFormError(t.fixFirst);
      if (found.name || found.audience || Object.keys(found).some((k) => k.startsWith("rules."))) goTo(found.name ? step : "audience");
      else goTo("content");
      return null;
    }
    setFormError(null);
    const body = payloadOf(form);
    const saved = initial ? await emailCampaignUpdate(apiClient, workspaceId, initial.id, body) : await emailCampaignCreate(apiClient, workspaceId, body);
    setSavedJson(JSON.stringify(form));
    onSaved(saved);
    if (!initial) navigate(`/marketing/email-campaigns/${saved.id}`, { replace: true });
    return saved;
  }

  async function run(kind: "save" | "test" | "schedule" | "unschedule", fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const needed = audience.count?.count ?? null;
  const remaining = overview.quota.monthly.remaining;
  const short = needed !== null && remaining !== null && needed > remaining;
  // The plan's other two limits: the month's campaigns, and the largest audience (QuotaMeter.tsx).
  const limit = campaignLimitProblem(overview, { audienceSize: needed, alreadyScheduled: initial?.status === "scheduled" });
  const blocked = short || limit !== null;
  const from = `"${overview.sender.fromName}" <${overview.sender.fromAddress}>`;

  return (
    <div className="min-w-0">
      <PageHeader
        title={initial ? initial.name : t.newTitle}
        titleBadge={initial ? <CampaignStatusBadge status={initial.status} /> : undefined}
        back={{ to: "/marketing/email-campaigns", label: t.back }}
        actions={
          <Button variant="outline" className="min-h-11" disabled={busy !== null || (!dirty && Boolean(initial))} onClick={() => void run("save", async () => void ((await save()) && toast.success(t.saved)))}>
            {busy === "save" ? t.saving : t.saveDraft}
          </Button>
        }
      />
      {initial?.status === "scheduled" && initial.scheduledAt && (
        <Alert variant="info" className="mb-4">
          {fmt(t.scheduledFor, { date: formatDateTime(initial.scheduledAt) })}
        </Alert>
      )}

      <Stepper step={step} onStep={goTo} />
      {formError && (
        <Alert variant="danger" className="mb-4" role="alert">
          {formError}
        </Alert>
      )}

      <div className="mb-5 max-w-xl">
        <TextField label={t.campaignName} hint={t.campaignNameHint} value={form.name} maxLength={120} required onChange={(e) => set("name", e.target.value)} error={err("name")} dir="auto" />
      </div>

      {step === "audience" && (
        <Section title={t.audienceTitle} description={t.audienceHint}>
          <h2 ref={headingRef} tabIndex={-1} className="sr-only">
            {t.stepAudience}
          </h2>
          <fieldset className="space-y-2">
            <legend className="sr-only">{t.audienceTitle}</legend>
            {AUDIENCES.filter((k) => k !== "rfm" || overview.audiences.rfm).map((kind) => (
              <label
                key={kind}
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors motion-reduce:transition-none",
                  form.audienceKind === kind ? "border-primary bg-primary-soft/40" : "border-line hover:border-primary/40"
                )}
              >
                <input type="radio" name="audience" value={kind} checked={form.audienceKind === kind} onChange={() => set("audienceKind", kind)} className="mt-1 size-4 accent-[var(--color-primary)]" />
                <span>
                  <span className="block text-sm font-medium text-ink">{t[`audience_${kind}` as keyof CampaignText]}</span>
                  <span className="block text-xs text-ink-soft">{t[`audience_${kind}Hint` as keyof CampaignText]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {form.audienceKind === "segment" && (
            <div className="mt-4 max-w-md">
              {overview.audiences.segments.length === 0 ? (
                <p className="text-sm text-ink-soft">{t.noSegments}</p>
              ) : (
                <Field label={t.segment} error={err("audience")} required>
                  {({ id, ...aria }) => (
                    <Select id={id} {...aria} value={form.segmentId} onChange={(e) => set("segmentId", e.target.value)} className="pointer-coarse:min-h-11">
                      <option value="">{t.pickSegment}</option>
                      {overview.audiences.segments.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
            </div>
          )}

          {form.audienceKind === "rfm" && (
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-ink">{t.audience_rfm}</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {EMAIL_CAMPAIGN_RFM_LABELS.map((label) => (
                  <label key={label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink hover:border-primary/40">
                    <input
                      type="checkbox"
                      checked={form.rfmLabels.includes(label)}
                      onChange={(e) => set("rfmLabels", e.target.checked ? [...form.rfmLabels, label] : form.rfmLabels.filter((l: EmailCampaignRfmLabel) => l !== label))}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    {t[`rfm_${label}` as keyof CampaignText]}
                  </label>
                ))}
              </div>
              {err("audience") && <p className="mt-2 text-xs font-medium text-danger">{err("audience")}</p>}
            </fieldset>
          )}

          {form.audienceKind === "rules" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {RULE_KEYS.map((key: RuleKey) =>
                key === "minSpent" || key === "maxSpent" ? (
                  <MoneyInput key={key} label={t[key]} value={form.rules[key]} onChange={(v) => set("rules", { ...form.rules, [key]: v })} error={err(`rules.${key}`)} />
                ) : (
                  <TextField
                    key={key}
                    label={t[key]}
                    inputMode="numeric"
                    value={form.rules[key]}
                    onChange={(e) => set("rules", { ...form.rules, [key]: e.target.value })}
                    error={err(`rules.${key}`)}
                  />
                )
              )}
              {err("audience") && <p className="text-xs font-medium text-danger sm:col-span-2">{err("audience")}</p>}
            </div>
          )}

          <p className="mt-4 text-sm font-medium text-ink" aria-live="polite">
            {audience.loading ? t.counting : audience.count ? fmt(t.countOf, { count: formatCount(audience.count.count), subscribed: formatCount(audience.count.subscribed) }) : ""}
          </p>
          <div className="mt-4 flex justify-end">
            <Button className="min-h-11" onClick={() => goTo("content")}>
              {t.next}
            </Button>
          </div>
        </Section>
      )}

      {step === "content" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Section title={t.contentTitle}>
            <h2 ref={headingRef} tabIndex={-1} className="sr-only">
              {t.stepContent}
            </h2>
            <div className="space-y-4">
              <TextField label={t.subject} hint={t.subjectHint} value={form.subject} maxLength={200} onChange={(e) => set("subject", e.target.value)} error={err("subject")} required dir="auto" />
              <TextField label={t.preheader} hint={t.preheaderHint} value={form.preheader} maxLength={200} onChange={(e) => set("preheader", e.target.value)} dir="auto" />
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-ink">{t.language}</span>
                  <Segmented
                    label={t.language}
                    value={form.locale}
                    onChange={(v) => set("locale", v)}
                    options={[
                      { value: "ar", label: t.arabic },
                      { value: "en", label: t.english },
                    ]}
                  />
                </div>
                <TextField className="min-w-[14rem] flex-1" label={t.replyTo} hint={t.replyToHint} type="email" dir="ltr" value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} error={err("replyTo")} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">{t.blocks}</h3>
                <BlockEditor blocks={form.blocks} onChange={(blocks) => set("blocks", blocks)} problems={problems} />
              </div>
            </div>
          </Section>
          <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
            <Section title={t.preview}>
              <EmailPreview subject={form.subject} preheader={form.preheader} blocks={previewBlocks(form)} locale={form.locale} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={busy !== null || previewBlocks(form).length === 0 || !form.subject.trim() || !overview.provider.ready}
                  onClick={() =>
                    void run("test", async () => {
                      const r = await emailCampaignSendTest(apiClient, workspaceId, {
                        subject: form.subject.trim(),
                        preheader: form.preheader.trim() || null,
                        blocks: previewBlocks(form),
                        locale: form.locale,
                        replyTo: form.replyTo.trim() || null,
                      });
                      toast.success(fmt(t.testSent, { email: r.to }));
                    })
                  }
                >
                  {t.sendTest}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="min-h-11" onClick={() => goTo("audience")}>
                    {t.previous}
                  </Button>
                  <Button className="min-h-11" onClick={() => goTo("review")}>
                    {t.next}
                  </Button>
                </div>
              </div>
            </Section>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Section title={t.reviewTitle}>
            <h2 ref={headingRef} tabIndex={-1} className="sr-only">
              {t.stepReview}
            </h2>
            <dl className="divide-y divide-line text-sm">
              {(
                [
                  [t.from, <bdi dir="ltr" key="from">{from}</bdi>],
                  [t.replyTo, form.replyTo.trim() ? <bdi dir="ltr" key="reply">{form.replyTo.trim()}</bdi> : "—"],
                  [t.subject, form.subject.trim() || "—"],
                  [t.to, audience.loading ? t.counting : audience.count ? fmt(t.count, { count: formatCount(audience.count.count) }) : "—"],
                ] as Array<[string, ReactNode]>
              ).map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="text-ink" dir="auto">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {short && (
              <Alert variant="danger" className="mt-4" role="alert">
                {fmt(t.quotaShort, { needed: formatCount(needed), remaining: formatCount(remaining) })}
              </Alert>
            )}
            {limit && (
              <Alert variant="danger" className="mt-4" role="alert" data-limit={limit.kind}>
                {campaignLimitText(t, limit)}
              </Alert>
            )}
            {!short && needed !== null && remaining !== null && <p className="mt-3 text-xs text-ink-soft">{fmt(t.quotaAfter, { needed: formatCount(needed), remaining: formatCount(remaining) })}</p>}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="min-h-11" disabled={busy !== null || blocked || needed === 0 || !overview.provider.ready} onClick={() => setConfirm("send")}>
                {t.sendNow}
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => goTo("content")}>
                {t.previous}
              </Button>
            </div>

            <div className="mt-6 rounded-lg border border-line p-3">
              <Field label={t.scheduleAt} hint={t.scheduleHint}>
                {({ id, ...aria }) => (
                  <input
                    id={id}
                    {...aria}
                    aria-describedby={scheduleId}
                    type="datetime-local"
                    value={scheduleAt}
                    min={earliest}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="h-10 w-full max-w-xs rounded-[0.5rem] border border-line-strong bg-paper-raised px-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11"
                  />
                )}
              </Field>
              <span id={scheduleId} className="sr-only">
                {t.scheduleHint}
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={busy !== null || blocked || !scheduleAt}
                  onClick={() =>
                    void run("schedule", async () => {
                      const saved = await save({ forSending: true });
                      if (!saved) return;
                      const next = await emailCampaignSchedule(apiClient, workspaceId, saved.id, new Date(scheduleAt).toISOString());
                      onSaved(next);
                      toast.success(fmt(t.scheduled, { date: formatDateTime(next.scheduledAt) }));
                    })
                  }
                >
                  {t.schedule}
                </Button>
                {initial?.status === "scheduled" && (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={busy !== null}
                    onClick={() =>
                      void run("unschedule", async () => {
                        onSaved(await emailCampaignUnschedule(apiClient, workspaceId, initial.id));
                        toast.success(t.unscheduled);
                      })
                    }
                  >
                    {t.unschedule}
                  </Button>
                )}
              </div>
            </div>
            {initial && (
              <div className="mt-6 border-t border-line pt-4">
                <Button variant="ghost" className="min-h-11 text-danger" onClick={() => setConfirm("delete")}>
                  {t.delete}
                </Button>
              </div>
            )}
          </Section>
          <QuotaMeter overview={overview} className="self-start" />
        </div>
      )}

      <ConfirmDialog
        open={confirm === "send"}
        title={fmt(t.sendNowConfirm, { count: formatCount(needed ?? 0) })}
        description={t.sendNowBody}
        confirmLabel={t.sendNow}
        cancelLabel={t.keep}
        busyLabel={t.sending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const saved = await save({ forSending: true });
          if (!saved) {
            setConfirm(null);
            return;
          }
          try {
            const started = await emailCampaignSend(apiClient, workspaceId, saved.id);
            setConfirm(null);
            onSaved(started);
            toast.success(t.started);
          } catch (e) {
            if (apiErrorCode(e) === "EMAIL_QUOTA_EXCEEDED") {
              const d = apiErrorDetails<{ needed: number; remaining: number }>(e);
              throw new Error(d ? fmt(t.quotaShort, { needed: formatCount(d.needed), remaining: formatCount(d.remaining) }) : errorMessage(e));
            }
            if (apiErrorCode(e) === "AUDIENCE_TOO_LARGE") {
              const d = apiErrorDetails<{ audienceSize: number; max: number }>(e);
              throw new Error(d ? campaignLimitText(t, { kind: "audience", size: d.audienceSize, max: d.max }) : errorMessage(e));
            }
            if (apiErrorCode(e) === "CAMPAIGN_LIMIT_REACHED") {
              const d = apiErrorDetails<{ max: number; used: number; resetsAt: string }>(e);
              throw new Error(d ? campaignLimitText(t, { kind: "campaigns", ...d }) : errorMessage(e));
            }
            throw new Error(errorMessage(e));
          }
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title={t.deleteConfirm}
        description={t.deleteBody}
        confirmLabel={t.delete}
        cancelLabel={t.keep}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!initial) return;
          await emailCampaignDelete(apiClient, workspaceId, initial.id);
          setSavedJson(JSON.stringify(form));
          setConfirm(null);
          toast.success(t.deleted);
          navigate("/marketing/email-campaigns");
        }}
      />
    </div>
  );
}

/** /marketing/email-campaigns/new and /marketing/email-campaigns/:campaignId — EMAIL_CAMPAIGNS_ENABLED. */
export function EmailCampaignEditorPage() {
  const t = useT(CAMPAIGN_STRINGS);
  const { campaignId = "new" } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceId();
  const plan = usePlanFeatures();
  const locked = plan.gated("email_campaigns");
  const isNew = campaignId === "new";
  const [overview, setOverview] = useState<EmailCampaignOverview | null>(null);
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  // The id of the campaign this screen just created: the address moves to it, and nothing needs reloading.
  const created = useRef<string | null>(null);
  const onSaved = (c: EmailCampaign) => {
    if (!campaign) created.current = c.id;
    setCampaign(c);
  };

  useEffect(() => {
    if (locked) return;
    if (created.current && created.current === campaignId) {
      created.current = null;
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([emailCampaignOverview(apiClient, workspaceId), isNew ? Promise.resolve(null) : emailCampaignGet(apiClient, workspaceId, campaignId)])
      .then(([o, c]) => {
        if (!live) return;
        setOverview(o);
        setCampaign(c);
      })
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, locked, attempt, campaignId]);

  if (locked) {
    return (
      <div className="min-w-0">
        <PageHeader title={t.title} back={{ to: "/marketing/email-campaigns", label: t.back }} />
        <PlanFeatureNotice feature="email_campaigns" />
      </div>
    );
  }
  if (apiErrorCode(error) === "NOT_FOUND") return <NotFoundPage />;

  const skeleton = (
    <div className="space-y-5" role="status" aria-busy="true">
      <CardSkeleton lines={1} className="max-w-xl" />
      <CardSkeleton lines={5} />
    </div>
  );

  return (
    <DataState loading={loading && !overview} error={error} onRetry={() => setAttempt((n) => n + 1)} skeleton={skeleton}>
      {overview &&
        (campaign && !["draft", "scheduled"].includes(campaign.status) ? (
          <CampaignResult campaign={campaign} overview={overview} onChange={onSaved} />
        ) : (
          // Keyed by status only: a new draft's first save keeps the editor (and the step) as it is.
          <CampaignEditor key={campaign ? campaign.status : "draft"} initial={campaign} overview={overview} onSaved={onSaved} />
        ))}
    </DataState>
  );
}
