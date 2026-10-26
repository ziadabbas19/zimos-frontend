import { useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  automationFlowsCreate,
  automationFlowsUpdate,
  parseMoney,
  type AutomationFlowConditions,
  type AutomationFlowRule,
  type AutomationStep,
  type AutomationStepType,
  type AutomationWaitUnit,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { SegmentConditionFields, type SegmentConditions } from "./SegmentConditionFields";
import { ProductFunnelConditionFields } from "./ProductFunnelConditionFields";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { AUTOMATION_STRINGS, emptyStep, stepProblem, stepTypeLabel, triggerLabel } from "./automationText";
import { TemplatePicker } from "@/components/WhatsappTemplates";

const STRINGS = {
  en: {
    createTitle: "New automation",
    editTitle: "Edit automation",
    name: "Name",
    trigger: "When this happens",
    stepsTitle: "Do these steps, in order",
    stepN: "Step {n}",
    addStep: "Add step",
    moveUp: "Move step {n} up",
    moveDown: "Move step {n} down",
    removeStep: "Remove step {n}",
    waitAmount: "How long",
    waitUnit: "Unit",
    templateName: "Template name",
    templateHint: "Exactly as approved in Meta: lowercase letters, numbers and underscores.",
    language: "Language",
    variables: "Template variables",
    variablesHint: "In order: the first box fills the template's first placeholder.",
    variable: "Variable {n}",
    addVariable: "Add variable",
    removeVariable: "Remove variable {n}",
    smsBody: "Message",
    emailSubject: "Subject",
    emailBody: "Message",
    emailHint: "Sent only when the order has an email address.",
    webhookUrl: "URL",
    webhookHint: "Receives a JSON POST with the event and the order's details.",
    tag: "Tag",
    status: "New status",
    statusHint: "Done in the name of the store owner. Confirming applies to cash-on-delivery orders.",
    teamMessage: "Message to the team",
    tokens: "Insert a detail:",
    conditionsTitle: "Only when (optional)",
    paymentMethod: "Payment method",
    any: "Any",
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Wallet",
    valu: "valU installments",
    kiosk: "Kiosk (Aman / Masary)",
    bank_transfer: "Bank transfer",
    minTotal: "Order total at least",
    source: "Order came from",
    sourceStore: "The store",
    sourceFunnel: "A funnel",
    governorates: "Governorates",
    listHint: "Separate with commas.",
    tags: "Order has any of these tags",
    firstOrder: "Customer",
    firstOnly: "First order only",
    returningOnly: "Returning customers only",
    risk: "Risk level",
    risk_low: "Low",
    risk_moderate: "Medium",
    risk_high: "High",
    coupon: "Coupon code for {{coupon_code}}",
    delayDays: "Days after delivery",
    stopOnChange: "Stop the remaining steps if the order's status changes while waiting",
    needsAction: "Add at least one step that is not a wait.",
    endsOnWait: "The sequence cannot end with a wait.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
  },
  ar: {
    createTitle: "أتمتة جديدة",
    editTitle: "تعديل الأتمتة",
    name: "الاسم",
    trigger: "عندما يحدث",
    stepsTitle: "نفّذ هذه الخطوات بالترتيب",
    stepN: "الخطوة {n}",
    addStep: "إضافة خطوة",
    moveUp: "تحريك الخطوة {n} لأعلى",
    moveDown: "تحريك الخطوة {n} لأسفل",
    removeStep: "حذف الخطوة {n}",
    waitAmount: "المدة",
    waitUnit: "الوحدة",
    templateName: "اسم القالب",
    templateHint: "كما هو معتمد في Meta تمامًا: حروف إنجليزية صغيرة وأرقام وشرطة سفلية.",
    language: "اللغة",
    variables: "متغيرات القالب",
    variablesHint: "بالترتيب: أول خانة تملأ أول متغير في القالب.",
    variable: "المتغير {n}",
    addVariable: "إضافة متغير",
    removeVariable: "حذف المتغير {n}",
    smsBody: "نص الرسالة",
    emailSubject: "العنوان",
    emailBody: "نص الرسالة",
    emailHint: "تُرسل فقط إذا كان للطلب بريد إلكتروني.",
    webhookUrl: "الرابط",
    webhookHint: "يستقبل طلب POST بصيغة JSON فيه الحدث وبيانات الطلب.",
    tag: "الوسم",
    status: "الحالة الجديدة",
    statusHint: "تُنفَّذ باسم مالك المتجر. التأكيد يخص طلبات الدفع عند الاستلام.",
    teamMessage: "رسالة للفريق",
    tokens: "أدرج بيانًا:",
    conditionsTitle: "فقط إذا (اختياري)",
    paymentMethod: "طريقة الدفع",
    any: "أي",
    cod: "الدفع عند الاستلام",
    card: "بطاقة",
    wallet: "محفظة",
    valu: "تقسيط valU",
    kiosk: "الدفع في الكشك (أمان / مصاري)",
    bank_transfer: "تحويل بنكي",
    minTotal: "إجمالي الطلب لا يقل عن",
    source: "مصدر الطلب",
    sourceStore: "المتجر",
    sourceFunnel: "قمع بيع",
    governorates: "المحافظات",
    listHint: "افصل بفاصلة.",
    tags: "الطلب عليه أحد هذه الوسوم",
    firstOrder: "العميل",
    firstOnly: "أول طلب فقط",
    returningOnly: "العملاء العائدون فقط",
    risk: "مستوى الخطورة",
    risk_low: "منخفض",
    risk_moderate: "متوسط",
    risk_high: "مرتفع",
    coupon: "كود الخصم لـ {{coupon_code}}",
    delayDays: "عدد الأيام بعد التسليم",
    stopOnChange: "إيقاف باقي الخطوات إذا تغيّرت حالة الطلب أثناء الانتظار",
    needsAction: "أضف خطوة واحدة على الأقل غير الانتظار.",
    endsOnWait: "لا يمكن أن ينتهي التسلسل بانتظار.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

const splitList = (value: string) =>
  value
    .split(/[,،\n]/)
    .map((v) => v.trim())
    .filter(Boolean);

/** Where a token chip inserts: the text field that had focus last. */
type Target = { step: number; field: string; param?: number } | null;

export function RuleEditorDialog({
  rule,
  triggers,
  tokens,
  stepTypes,
  onClose,
  onSaved,
}: {
  rule: AutomationFlowRule | null;
  triggers: string[];
  tokens: string[];
  stepTypes: AutomationStepType[];
  onClose: () => void;
  onSaved: (rule: AutomationFlowRule, created: boolean) => void;
}) {
  const t = useT(STRINGS);
  const at = useT(AUTOMATION_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();

  const c = rule?.conditions ?? {};
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? triggers[0] ?? "order.created");
  const [steps, setSteps] = useState<AutomationStep[]>(rule?.actions?.length ? rule.actions : [emptyStep("whatsapp_template")]);
  const [paymentMethod, setPaymentMethod] = useState<string>(c.paymentMethod ?? "");
  const [minTotal, setMinTotal] = useState(c.minTotalAmount != null ? String(c.minTotalAmount / 100) : "");
  const [source, setSource] = useState<string>(c.source ?? "");
  const [governorates, setGovernorates] = useState((c.governorates ?? []).join("، "));
  const [tags, setTags] = useState((c.tags ?? []).join("، "));
  const [firstOrder, setFirstOrder] = useState(c.isFirstOrder === true ? "first" : c.isFirstOrder === false ? "returning" : "");
  // "medium" is how rules were saved before the levels matched the orders' ("moderate").
  const [risk, setRisk] = useState<string[]>(() => (c.riskLevel ?? []).map((level: string) => (level === "medium" ? "moderate" : level)));
  const [segment, setSegment] = useState<SegmentConditions>({ segmentId: c.segmentId ?? null, excludeSegmentId: c.excludeSegmentId ?? null });
  const [scope, setScope] = useState({ productIds: c.productIds ?? [], funnelIds: c.funnelIds ?? [] });
  const [coupon, setCoupon] = useState(c.couponCode ?? "");
  const [delayDays, setDelayDays] = useState(String(c.delayDays ?? 3));
  const [stopOnChange, setStopOnChange] = useState(c.stopOnStatusChange !== false);
  const [newType, setNewType] = useState<AutomationStepType>("wait");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const target = useRef<Target>(null);

  const patchStep = (index: number, patch: Partial<AutomationStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? ({ ...s, ...patch } as AutomationStep) : s)));
  const move = (index: number, by: number) =>
    setSteps((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  function insertToken(token: string) {
    const where = target.current;
    if (!where) return;
    const text = `{{${token}}}`;
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== where.step) return s;
        const record = s as unknown as Record<string, unknown>;
        if (where.field === "params" && where.param !== undefined) {
          const params = [...((record.params as string[]) ?? [])];
          params[where.param] = `${params[where.param] ?? ""}${text}`;
          return { ...s, params } as AutomationStep;
        }
        return { ...s, [where.field]: `${(record[where.field] as string) ?? ""}${text}` } as AutomationStep;
      })
    );
  }

  const actionable = steps.some((s) => s.type !== "wait");
  const endsOnWait = steps.length > 0 && steps[steps.length - 1].type === "wait";
  const invalid = name.trim().length < 2 || steps.length === 0 || !actionable || endsOnWait || steps.some(stepProblem);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    setFormError(null);
    const min = minTotal.trim() === "" ? null : Number(parseMoney(minTotal));
    const conditions: AutomationFlowConditions = {
      paymentMethod: (paymentMethod || null) as AutomationFlowConditions["paymentMethod"],
      minTotalAmount: min !== null && Number.isFinite(min) ? min : null,
      source: (source || null) as AutomationFlowConditions["source"],
      governorates: splitList(governorates),
      tags: splitList(tags),
      isFirstOrder: firstOrder === "first" ? true : firstOrder === "returning" ? false : null,
      riskLevel: risk as AutomationFlowConditions["riskLevel"],
      couponCode: coupon.trim() || null,
      ...segment,
      stopOnStatusChange: stopOnChange,
      // Picked in ProductFunnelConditionFields; nothing chosen = any.
      productIds: scope.productIds,
      funnelIds: scope.funnelIds,
      ...(trigger === "review.request" ? { delayDays: Math.min(60, Math.max(1, Number(delayDays) || 3)) } : {}),
    };
    const cleaned = steps.map((s) =>
      s.type === "whatsapp_template" ? { ...s, params: s.params.map((p) => p.trim()).filter(Boolean) } : s.type === "webhook" ? { ...s, url: s.url.trim() } : s
    );
    const payload = { name: name.trim(), trigger, conditions, actions: cleaned };
    try {
      const saved = rule
        ? await automationFlowsUpdate(apiClient, workspaceId, rule.id, payload)
        : await automationFlowsCreate(apiClient, workspaceId, payload);
      onSaved(saved, !rule);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFormError(Object.values(fields)[0] ?? errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? t.editTitle : t.createTitle}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" form="automation-rule-form" disabled={saving || invalid}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="automation-rule-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.name} required value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          <Field label={t.trigger}>
            {({ id }) => (
              <Select id={id} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {triggers.map((tr) => (
                  <option key={tr} value={tr}>
                    {triggerLabel(at, tr)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">{t.stepsTitle}</h3>
          {tokens.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-soft">{t.tokens}</span>
              {tokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  // Keeps focus (and so the insertion target) in the text field.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertToken(token)}
                  className="cursor-pointer rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-ink-soft hover:border-primary hover:text-primary"
                >
                  {token}
                </button>
              ))}
            </div>
          )}

          <ol className="mt-3 space-y-0">
            {steps.map((step, index) => (
              <li key={index} className="relative ps-8">
                {/* The vertical line and the numbered dot of the sequence. */}
                {index < steps.length - 1 && <span className="absolute start-3 top-7 bottom-0 w-px bg-line" aria-hidden />}
                <span
                  className="absolute start-0 top-3 flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-dark dark:text-primary"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="mb-3 rounded-[0.5rem] border border-line p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      <span className="sr-only">{fmt(t.stepN, { n: index + 1 })}: </span>
                      {stepTypeLabel(at, step.type)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Button type="button" size="icon-sm" variant="ghost" disabled={index === 0} aria-label={fmt(t.moveUp, { n: index + 1 })} onClick={() => move(index, -1)}>
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === steps.length - 1}
                        aria-label={fmt(t.moveDown, { n: index + 1 })}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={steps.length === 1}
                        aria-label={fmt(t.removeStep, { n: index + 1 })}
                        onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    </span>
                  </div>
                  <StepFields t={t} at={at} step={step} index={index} onChange={(patch) => patchStep(index, patch)} onFocus={(where) => (target.current = where)} />
                </div>
              </li>
            ))}
          </ol>

          {!actionable && <p className="text-xs font-medium text-danger">{t.needsAction}</p>}
          {actionable && endsOnWait && <p className="text-xs font-medium text-danger">{t.endsOnWait}</p>}

          {steps.length < 12 && (
            <div className="mt-2 flex items-center gap-2">
              <Select aria-label={t.addStep} value={newType} onChange={(e) => setNewType(e.target.value as AutomationStepType)} className="max-w-56">
                {stepTypes.map((type) => (
                  <option key={type} value={type}>
                    {stepTypeLabel(at, type)}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="outline" onClick={() => setSteps((prev) => [...prev, emptyStep(newType)])}>
                <Plus className="size-4" aria-hidden />
                {t.addStep}
              </Button>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">{t.conditionsTitle}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {trigger === "review.request" && (
              <TextField label={t.delayDays} type="number" min={1} max={60} dir="ltr" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
            )}
            <Field label={t.paymentMethod}>
              {({ id }) => (
                <Select id={id} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="">{t.any}</option>
                  <option value="cod">{t.cod}</option>
                  <option value="card">{t.card}</option>
                  <option value="wallet">{t.wallet}</option>
                  <option value="valu">{t.valu}</option>
                  <option value="kiosk">{t.kiosk}</option>
                  <option value="bank_transfer">{t.bank_transfer}</option>
                </Select>
              )}
            </Field>
            <TextField label={t.minTotal} dir="ltr" inputMode="decimal" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} />
            <Field label={t.source}>
              {({ id }) => (
                <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">{t.any}</option>
                  <option value="store">{t.sourceStore}</option>
                  <option value="funnel">{t.sourceFunnel}</option>
                </Select>
              )}
            </Field>
            <Field label={t.firstOrder}>
              {({ id }) => (
                <Select id={id} value={firstOrder} onChange={(e) => setFirstOrder(e.target.value)}>
                  <option value="">{t.any}</option>
                  <option value="first">{t.firstOnly}</option>
                  <option value="returning">{t.returningOnly}</option>
                </Select>
              )}
            </Field>
            <TextField label={t.governorates} hint={t.listHint} value={governorates} onChange={(e) => setGovernorates(e.target.value)} />
            <TextField label={t.tags} hint={t.listHint} value={tags} onChange={(e) => setTags(e.target.value)} />
            <SegmentConditionFields value={segment} onChange={setSegment} />
            <ProductFunnelConditionFields productIds={scope.productIds} funnelIds={scope.funnelIds} onChange={setScope} />
            <TextField label={t.coupon} dir="ltr" value={coupon} maxLength={100} onChange={(e) => setCoupon(e.target.value)} />
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">{t.risk}</legend>
              <div className="flex flex-wrap gap-3">
                {(["low", "moderate", "high"] as const).map((level) => (
                  <label key={level} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      checked={risk.includes(level)}
                      onChange={(e) => setRisk((prev) => (e.target.checked ? [...prev, level] : prev.filter((r) => r !== level)))}
                    />
                    {t[`risk_${level}`]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-4 cursor-pointer accent-primary" checked={stopOnChange} onChange={(e) => setStopOnChange(e.target.checked)} />
            {t.stopOnChange}
          </label>
        </div>
      </form>
    </Modal>
  );
}

function StepFields({
  t,
  at,
  step,
  index,
  onChange,
  onFocus,
}: {
  t: T;
  at: Record<string, string>;
  step: AutomationStep;
  index: number;
  onChange: (patch: Partial<AutomationStep>) => void;
  onFocus: (where: Target) => void;
}) {
  const focus = (field: string, param?: number) => () => onFocus({ step: index, field, param });

  switch (step.type) {
    case "wait":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t.waitAmount}
            type="number"
            min={1}
            max={720}
            dir="ltr"
            value={String(step.amount)}
            onChange={(e) => onChange({ amount: Math.round(Number(e.target.value)) || 0 })}
          />
          <Field label={t.waitUnit}>
            {({ id }) => (
              <Select id={id} value={step.unit} onChange={(e) => onChange({ unit: e.target.value as AutomationWaitUnit })}>
                {(["minutes", "hours", "days"] as const).map((unit) => (
                  <option key={unit} value={unit}>
                    {at[`unit_${unit}`]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      );
    case "whatsapp_template":
      return (
        <div className="space-y-3">
          {/* A template synced from Meta fills the name, language and variable count. */}
          <TemplatePicker
            name={step.template}
            language={step.language}
            onPick={(tpl) => onChange({ template: tpl.name, language: tpl.language, params: Array.from({ length: tpl.paramsCount }, (_, i) => step.params[i] ?? "") })}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <TextField label={t.templateName} dir="ltr" hint={t.templateHint} value={step.template} onChange={(e) => onChange({ template: e.target.value.trim() })} />
            <TextField label={t.language} dir="ltr" value={step.language} onChange={(e) => onChange({ language: e.target.value.trim() })} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{t.variables}</p>
            <p className="mb-2 text-xs text-ink-soft">{t.variablesHint}</p>
            <div className="space-y-2">
              {step.params.map((param, p) => (
                <div key={p} className="flex items-center gap-2">
                  <Input
                    aria-label={fmt(t.variable, { n: p + 1 })}
                    placeholder={fmt(t.variable, { n: p + 1 })}
                    dir="auto"
                    value={param}
                    onFocus={focus("params", p)}
                    onChange={(e) => onChange({ params: step.params.map((x, i) => (i === p ? e.target.value : x)) })}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={fmt(t.removeVariable, { n: p + 1 })}
                    onClick={() => onChange({ params: step.params.filter((_, i) => i !== p) })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            {step.params.length < 20 && (
              <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => onChange({ params: [...step.params, ""] })}>
                <Plus className="size-4" aria-hidden />
                {t.addVariable}
              </Button>
            )}
          </div>
        </div>
      );
    case "sms":
      return (
        <Field label={t.smsBody}>
          {({ id }) => <Textarea id={id} dir="auto" maxLength={600} value={step.body} onFocus={focus("body")} onChange={(e) => onChange({ body: e.target.value })} />}
        </Field>
      );
    case "email":
      return (
        <div className="space-y-3">
          <TextField label={t.emailSubject} dir="auto" maxLength={200} value={step.subject} onFocus={focus("subject")} onChange={(e) => onChange({ subject: e.target.value })} />
          <Field label={t.emailBody} hint={t.emailHint}>
            {({ id }) => <Textarea id={id} dir="auto" rows={4} maxLength={5000} value={step.body} onFocus={focus("body")} onChange={(e) => onChange({ body: e.target.value })} />}
          </Field>
        </div>
      );
    case "webhook":
      return <TextField label={t.webhookUrl} dir="ltr" placeholder="https://example.com/hook" hint={t.webhookHint} value={step.url} onChange={(e) => onChange({ url: e.target.value })} />;
    case "add_tag":
      return <TextField label={t.tag} maxLength={40} value={step.tag} onChange={(e) => onChange({ tag: e.target.value })} />;
    case "set_status":
      return (
        <Field label={t.status} hint={t.statusHint}>
          {({ id }) => (
            <Select id={id} value={step.status} onChange={(e) => onChange({ status: e.target.value as "confirmed" | "cancelled" })}>
              <option value="confirmed">{at.status_confirmed}</option>
              <option value="cancelled">{at.status_cancelled}</option>
            </Select>
          )}
        </Field>
      );
    case "notify_team":
      return (
        <Field label={t.teamMessage}>
          {({ id }) => <Textarea id={id} dir="auto" maxLength={500} value={step.message} onFocus={focus("message")} onChange={(e) => onChange({ message: e.target.value })} />}
        </Field>
      );
    default:
      return null;
  }
}
