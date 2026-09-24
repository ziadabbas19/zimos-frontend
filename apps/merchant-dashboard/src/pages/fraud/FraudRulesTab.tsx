import { useId, useMemo, useState } from "react";
import { Alert, Button, Card, Input, cn } from "@store-builder/ui";
import { ApiError, resolveFraudRules, type FraudAction, type FraudRules } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

/**
 * Role keys allowed to change fraud rules. The backend's real test is the
 * workspace.manage permission, which the dashboard can't see (GET /workspaces
 * exposes only the role key) — these are the two system roles that carry it.
 * A custom role that also has it still reads the tab as read-only; a 403 on
 * save flips an editable form to read-only too.
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

type CountRuleKey = "duplicate_window_minutes" | "max_orders_per_phone_per_day" | "high_rejection_threshold";

/** Backend bounds (workspaceValidation.js) and the value a rule starts at when switched on. */
const COUNT_RULES: ReadonlyArray<{ key: CountRuleKey; min: number; max: number; initial: number }> = [
  { key: "duplicate_window_minutes", min: 1, max: 10080, initial: 60 },
  { key: "max_orders_per_phone_per_day", min: 1, max: 100, initial: 3 },
  { key: "high_rejection_threshold", min: 1, max: 100, initial: 3 },
];

const STRINGS = {
  en: {
    readOnlyTitle: "View only",
    readOnly: "Only the store owner or a workspace manager can change fraud rules.",
    readOnlyForbidden: "Your role can't change fraud rules, so they're shown read-only. Ask the store owner if they need changing.",
    actionHeading: "When a rule below matches",
    actionFlag: "Flag the order for review",
    actionFlagHint: "The order is placed and marked as flagged so your team can check it before shipping.",
    actionBlock: "Refuse the order",
    actionBlockHint: "The shopper sees an error at checkout and no order is created.",
    rulesHeading: "Rules",
    rulesHint: "Each rule is off until you switch it on.",
    duplicate_window_minutes: "Duplicate orders",
    duplicate_window_minutesHint: "The same customer orders any of the same products again within this many minutes.",
    duplicate_window_minutesUnit: "minutes",
    max_orders_per_phone_per_day: "Too many orders from one phone",
    max_orders_per_phone_per_dayHint: "The customer already placed this many orders in the last 24 hours.",
    max_orders_per_phone_per_dayUnit: "orders",
    high_rejection_threshold: "Customers who often refuse orders",
    high_rejection_thresholdHint: "The customer has rejected at least this many orders before.",
    high_rejection_thresholdUnit: "rejected orders",
    rangeError: "Enter a whole number from {min} to {max}.",
    blacklistHeading: "Blocked customers",
    blockBlacklisted: "Always refuse orders from blocked customers",
    blockBlacklistedHint: "When off, their orders are still placed but flagged. Manage blocked phones in the Blocklist tab.",
    save: "Save rules",
    saving: "Saving…",
    reset: "Discard changes",
    saved: "Fraud rules saved.",
  },
  ar: {
    readOnlyTitle: "عرض فقط",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل فقط تغيير قواعد الحماية من الاحتيال.",
    readOnlyForbidden: "دورك لا يسمح بتغيير قواعد الحماية من الاحتيال، لذلك تظهر للعرض فقط. اطلب من مالك المتجر إذا احتاجت إلى تعديل.",
    actionHeading: "عند انطباق إحدى القواعد التالية",
    actionFlag: "تمييز الأوردر للمراجعة",
    actionFlagHint: "يُسجَّل الأوردر ويُميَّز كمشتبه به ليراجعه فريقك قبل الشحن.",
    actionBlock: "رفض الأوردر",
    actionBlockHint: "تظهر للمشتري رسالة خطأ عند إتمام الشراء ولا يُسجَّل أي أوردر.",
    rulesHeading: "القواعد",
    rulesHint: "كل قاعدة متوقفة حتى تقوم بتفعيلها.",
    duplicate_window_minutes: "الأوردرات المكررة",
    duplicate_window_minutesHint: "يطلب العميل نفسه أيًّا من نفس المنتجات مرة أخرى خلال هذا العدد من الدقائق.",
    duplicate_window_minutesUnit: "دقيقة",
    max_orders_per_phone_per_day: "أوردرات كثيرة من نفس الهاتف",
    max_orders_per_phone_per_dayHint: "سجّل العميل هذا العدد من الأوردرات خلال آخر 24 ساعة.",
    max_orders_per_phone_per_dayUnit: "أوردر",
    high_rejection_threshold: "عملاء يرفضون الأوردرات كثيرًا",
    high_rejection_thresholdHint: "رفض العميل هذا العدد من الأوردرات على الأقل من قبل.",
    high_rejection_thresholdUnit: "أوردر مرفوض",
    rangeError: "أدخل رقمًا صحيحًا من {min} إلى {max}.",
    blacklistHeading: "العملاء المحظورون",
    blockBlacklisted: "رفض أوردرات العملاء المحظورين دائمًا",
    blockBlacklistedHint: "عند إيقافها تُسجَّل أوردراتهم لكن تُميَّز كمشتبه بها. أدِر الأرقام المحظورة من تبويب قائمة الحظر.",
    save: "حفظ القواعد",
    saving: "جارٍ الحفظ…",
    reset: "تجاهل التغييرات",
    saved: "تم حفظ قواعد الحماية من الاحتيال.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

/** A counting rule as edited: the switch plus the raw input text. */
interface CountRuleDraft {
  on: boolean;
  value: string;
}

interface Draft {
  action: FraudAction;
  block_blacklisted: boolean;
  counts: Record<CountRuleKey, CountRuleDraft>;
}

function toDraft(rules: FraudRules): Draft {
  const counts = {} as Record<CountRuleKey, CountRuleDraft>;
  for (const rule of COUNT_RULES) {
    const stored = rules[rule.key];
    counts[rule.key] =
      stored == null ? { on: false, value: String(rule.initial) } : { on: true, value: String(stored) };
  }
  return { action: rules.action, block_blacklisted: rules.block_blacklisted, counts };
}

/** The whole rule set, every key explicit — an off rule is sent as null. */
function toRules(draft: Draft): FraudRules {
  const out: FraudRules = {
    action: draft.action,
    block_blacklisted: draft.block_blacklisted,
    duplicate_window_minutes: null,
    max_orders_per_phone_per_day: null,
    high_rejection_threshold: null,
  };
  for (const rule of COUNT_RULES) {
    const d = draft.counts[rule.key];
    out[rule.key] = d.on ? Number(d.value) : null;
  }
  return out;
}

function sameRules(a: FraudRules, b: FraudRules): boolean {
  return (Object.keys(a) as Array<keyof FraudRules>).every((k) => a[k] === b[k]);
}

function rangeProblem(rule: (typeof COUNT_RULES)[number], d: CountRuleDraft): boolean {
  if (!d.on) return false;
  const trimmed = d.value.trim();
  if (!/^\d+$/.test(trimmed)) return true;
  const n = Number(trimmed);
  return n < rule.min || n > rule.max;
}

export function FraudRulesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, refresh } = useWorkspace();

  const stored = useMemo(
    () => resolveFraudRules(currentWorkspace?.settings?.fraud_rules),
    [currentWorkspace?.settings?.fraud_rules]
  );
  // The last rule set known to be on the server — replaced by the PATCH
  // response on save, so "dirty" is right before the silent refresh lands.
  const [saved, setSaved] = useState<FraudRules>(stored);
  const [draft, setDraft] = useState<Draft>(() => toDraft(stored));
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const roleAllows = EDITOR_ROLES.has(currentWorkspace?.role ?? "");
  const editable = roleAllows && !forbidden;
  const disabled = !editable || saving;

  const problems = COUNT_RULES.filter((rule) => rangeProblem(rule, draft.counts[rule.key])).map((r) => r.key);
  const dirty = problems.length > 0 || !sameRules(toRules(draft), saved);

  function setCount(key: CountRuleKey, patch: Partial<CountRuleDraft>) {
    setDraft((prev) => ({ ...prev, counts: { ...prev.counts, [key]: { ...prev.counts[key], ...patch } } }));
  }

  async function save() {
    if (problems.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const workspace = await apiClient.updateWorkspace(workspaceId, {
        settings: { fraud_rules: toRules(draft) },
      });
      const next = resolveFraudRules(workspace.settings?.fraud_rules);
      setSaved(next);
      setDraft(toDraft(next));
      setShowErrors(false);
      toast.success(t.saved);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Whatever the role key suggested, the server says no — stop offering
        // edits and put the stored rules back.
        setForbidden(true);
        setDraft(toDraft(saved));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {!editable && (
        <Alert>
          <p className="font-medium">{t.readOnlyTitle}</p>
          <p>{forbidden ? t.readOnlyForbidden : t.readOnly}</p>
        </Alert>
      )}

      <Card className="space-y-3 p-5">
        <fieldset disabled={disabled} className="space-y-3">
          <legend className="font-display text-lg font-medium text-ink">{t.actionHeading}</legend>
          {(["flag", "block"] as const).map((action) => (
            <ChoiceRow
              key={action}
              type="radio"
              name="fraud-action"
              checked={draft.action === action}
              onChange={() => setDraft((prev) => ({ ...prev, action }))}
              label={action === "flag" ? t.actionFlag : t.actionBlock}
              hint={action === "flag" ? t.actionFlagHint : t.actionBlockHint}
            />
          ))}
        </fieldset>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.rulesHeading}</h2>
          <p className="text-sm text-ink-soft">{t.rulesHint}</p>
        </div>
        <div className="divide-y divide-line">
          {COUNT_RULES.map((rule) => (
            <CountRuleRow
            key={rule.key}
            rule={rule}
            draft={draft.counts[rule.key]}
            disabled={disabled}
            error={showErrors && problems.includes(rule.key) ? fmt(t.rangeError, { min: rule.min, max: rule.max }) : undefined}
            t={t}
              onChange={(patch) => setCount(rule.key, patch)}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.blacklistHeading}</h2>
        <ChoiceRow
          type="checkbox"
          checked={draft.block_blacklisted}
          disabled={disabled}
          onChange={(checked) => setDraft((prev) => ({ ...prev, block_blacklisted: checked }))}
          label={t.blockBlacklisted}
          hint={t.blockBlacklistedHint}
        />
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving || !dirty} className="min-h-11">
            {saving ? t.saving : t.save}
          </Button>
          {dirty && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => {
                setDraft(toDraft(saved));
                setShowErrors(false);
                setError(null);
              }}
            >
              {t.reset}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** A radio or checkbox with its label and hint — the whole row is the 44px target. */
function ChoiceRow({
  type,
  name,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] border px-3 py-2.5 transition-colors",
        checked ? "border-primary/50 bg-primary-soft/40" : "border-line",
        "has-[:disabled]:cursor-default has-[:disabled]:opacity-80"
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-5 shrink-0 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="block text-sm text-ink-soft">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function CountRuleRow({
  rule,
  draft,
  disabled,
  error,
  t,
  onChange,
}: {
  rule: (typeof COUNT_RULES)[number];
  draft: CountRuleDraft;
  disabled: boolean;
  error?: string;
  t: Strings;
  onChange: (patch: Partial<CountRuleDraft>) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const unit = t[`${rule.key}Unit` as keyof Strings];
  return (
    <div className="space-y-2 py-4 first:pt-0 last:pb-0">
      <ChoiceRow
        type="checkbox"
        checked={draft.on}
        disabled={disabled}
        onChange={(on) => onChange({ on })}
        label={t[rule.key]}
        hint={t[`${rule.key}Hint` as keyof Strings]}
      />
      {draft.on && (
        <div className="ps-3">
          <div className="flex items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              {`${t[rule.key]} (${unit})`}
            </label>
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={rule.min}
              max={rule.max}
              step={1}
              value={draft.value}
              disabled={disabled}
              onChange={(e) => onChange({ value: e.target.value })}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn("h-11 w-28", error && "border-danger")}
            />
            <span className="text-sm text-ink-soft">{unit}</span>
          </div>
          {error && (
            <p id={errorId} className="mt-1 text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
