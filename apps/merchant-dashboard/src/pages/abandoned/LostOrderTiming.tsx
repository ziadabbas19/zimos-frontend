import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  ApiError,
  LOST_ORDER_ABANDON_MINUTES_RANGE,
  LOST_ORDER_DEFAULT_ABANDON_MINUTES,
  lostOrdersSaveAbandonAfter,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { countOf } from "@/lib/plural";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { IconLock } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";

/** System roles carrying workspace.manage, which the setting needs (fraud_rules, workspaceService.js). */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);
const PRESETS = [15, 30, 60, 180] as const;
const { min: MIN, max: MAX } = LOST_ORDER_ABANDON_MINUTES_RANGE;

const STRINGS = {
  en: {
    title: "When does a checkout count as lost?",
    description:
      "After this long with nothing typed, the checkout moves to Lost orders and your recovery automations start. A shorter time reaches the shopper sooner; a longer one leaves slow typists alone.",
    now: "Right now: after {span} without activity.",
    minutes: "Minutes without activity",
    hint: "Between {min} and {max} minutes. The default is {def}.",
    presets: "Common choices",
    invalid: "Enter whole minutes between {min} and {max}.",
    reset: "Use the default",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    saving: "Saving…",
    saved: "Saved. Checkouts now count as lost after {span}.",
    forbidden: "Only the store owner or a manager can change this.",
  },
  ar: {
    title: "متى يُعدّ الطلب مفقودًا؟",
    description:
      "بعد هذه المدة دون أن يكتب العميل شيئًا، ينتقل الطلب إلى الطلبات المفقودة وتبدأ أتمتة الاسترجاع. المدة الأقصر توصلك إلى العميل أسرع، والأطول تترك من يكتب على مهله دون إزعاج.",
    now: "الآن: بعد {span} بدون نشاط.",
    minutes: "دقائق بدون نشاط",
    hint: "من {min} إلى {max} دقيقة. الافتراضي {def}.",
    presets: "اختيارات شائعة",
    invalid: "أدخل عدد دقائق صحيحًا من {min} إلى {max}.",
    reset: "استعادة الافتراضي",
    cancel: "إلغاء",
    close: "إغلاق",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ. سيُعدّ الطلب مفقودًا بعد {span}.",
    forbidden: "يمكن لمالك المتجر أو المدير فقط تغيير هذا.",
  },
} satisfies Messages;

// The same pill as a filter choice (glass/list.css styles `.zimos-chip` once).
const PRESET_PILL =
  "zimos-chip inline-flex h-10 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const PRESET_ON = "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]";
const PRESET_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

/**
 * The lost-orders timing (`abandoned_after_minutes`), as a small
 * sheet opened from the header's «أدوات» menu. Everyone can read the value;
 * the form is for the roles allowed to set it (a 403 takes it away for the
 * session and says who can).
 */
export function LostOrderTimingSheet({
  open,
  onOpenChange,
  minutes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The minutes in force; null until the list or the stats reported them. */
  minutes: number | null;
  onSaved: (minutes: number) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const { currentWorkspace, refresh } = useWorkspace();
  const [forbidden, setForbidden] = useState(false);
  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const inForce = minutes ?? LOST_ORDER_DEFAULT_ABANDON_MINUTES;

  const [value, setValue] = useState(String(inForce));
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(inForce));
    setShowErrors(false);
    setError(null);
  }, [open, inForce]);

  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const invalid = !(parsed >= MIN && parsed <= MAX);

  async function save(next: number | null) {
    setBusy(true);
    setError(null);
    try {
      const stored = await lostOrdersSaveAbandonAfter(apiClient, workspaceId, next);
      toast.success(fmt(t.saved, { span: countOf("minute", stored) }));
      onOpenChange(false);
      onSaved(stored);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        onOpenChange(false);
        toast.error(t.forbidden);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) {
      setShowErrors(true);
      return;
    }
    void save(parsed);
  }

  const footer = editable ? (
    <>
      <Button
        type="button"
        variant="ghost"
        className="rounded-full px-4 sm:me-auto"
        onClick={() => void save(null)}
        disabled={busy || minutes === LOST_ORDER_DEFAULT_ABANDON_MINUTES}
      >
        {t.reset}
      </Button>
      <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => onOpenChange(false)} disabled={busy}>
        {t.cancel}
      </Button>
      <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
        {busy ? t.saving : t.save}
      </Button>
    </>
  ) : (
    <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => onOpenChange(false)}>
      {t.close}
    </Button>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={t.title}
      description={t.description}
      size="sm"
      footer={footer}
    >
      <div data-slot="lost-timing" className="space-y-4">
        {minutes !== null && (
          <p className="text-sm leading-6 font-medium text-ink">{fmt(t.now, { span: countOf("minute", minutes) })}</p>
        )}
        {editable ? (
          <form id={formId} onSubmit={submit} noValidate className="space-y-4">
            <TextField
              label={t.minutes}
              required
              dir="ltr"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              hint={fmt(t.hint, { min: MIN, max: MAX, def: LOST_ORDER_DEFAULT_ABANDON_MINUTES })}
              error={showErrors && invalid ? fmt(t.invalid, { min: MIN, max: MAX }) : undefined}
            />
            <div role="group" aria-label={t.presets} className="flex flex-wrap gap-2">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={parsed === n}
                  onClick={() => setValue(String(n))}
                  className={cn(PRESET_PILL, parsed === n ? PRESET_ON : PRESET_OFF)}
                >
                  {countOf("minute", n)}
                </button>
              ))}
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
          </form>
        ) : (
          <p className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
            <IconLock className="mt-1 size-4 shrink-0" aria-hidden />
            <span>{t.forbidden}</span>
          </p>
        )}
      </div>
    </Sheet>
  );
}
