import { useEffect, useId, useState } from "react";
import { Check, X } from "lucide-react";
import { Input, Label, cn, ZLoader } from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { isUsernameFormatValid, normalizeUsername, type UsernameStatus } from "@/lib/username";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Username",
    hint: "3–30 lowercase English letters, numbers, “_” or “.”, starting with a letter.",
    checking: "Checking…",
    available: "Available",
    taken: "Already taken — try another one.",
    invalid: "Not a valid username. Use lowercase English letters, numbers, “_” or “.”, starting with a letter.",
    reserved: "This name is reserved. Choose another one.",
    current: "This is your current username.",
    busy: "Too many checks right now — wait a moment and try again.",
    failed: "Couldn't check this name. You can still try to save it.",
  },
  ar: {
    label: "اسم المستخدم",
    hint: "من 3 إلى 30 حرفًا إنجليزيًا صغيرًا أو رقمًا أو «_» أو «.»، ويبدأ بحرف.",
    checking: "جارٍ التحقق…",
    available: "متاح",
    taken: "هذا الاسم مستخدم — جرّب اسمًا آخر.",
    invalid: "اسم غير صالح. استخدم حروفًا إنجليزية صغيرة أو أرقامًا أو «_» أو «.»، وابدأ بحرف.",
    reserved: "هذا الاسم محجوز. اختر اسمًا آخر.",
    current: "هذا هو اسم المستخدم الحالي.",
    busy: "محاولات تحقق كثيرة الآن — انتظر قليلًا ثم حاول مرة أخرى.",
    failed: "تعذّر التحقق من هذا الاسم. ما زال بإمكانك محاولة حفظه.",
  },
} satisfies Messages;

export type { UsernameStatus } from "@/lib/username";

/**
 * A username input with a live availability check: format first (no request
 * for an obviously invalid name), then GET /auth/username-available after the
 * person stops typing for a moment. The result is announced politely to
 * screen readers. `current` is the account's own name (settings), which is
 * never "taken".
 */
export function UsernameField({
  value,
  onChange,
  onStatus,
  current = null,
  disabled,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onStatus?: (status: UsernameStatus) => void;
  current?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useT(STRINGS);
  const id = useId();
  const statusId = useId();
  // What the server said, and for which name — anything else is still being checked.
  const [answer, setAnswer] = useState<{ name: string; status: UsernameStatus } | null>(null);

  const name = normalizeUsername(value);
  const local: UsernameStatus | null = !name
    ? "idle"
    : current && name === current
      ? "current"
      : !isUsernameFormatValid(name)
        ? "invalid"
        : null;
  const status: UsernameStatus = local ?? (answer && answer.name === name ? answer.status : "checking");

  useEffect(() => {
    if (local) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiClient.checkUsernameAvailable(name).then(
        (result) => {
          if (!cancelled) setAnswer({ name, status: result.available ? "available" : (result.reason ?? "taken") });
        },
        (err) => {
          if (!cancelled) setAnswer({ name, status: err instanceof ApiError && err.status === 429 ? "busy" : "failed" });
        }
      );
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [name, local]);

  // Tell the form what it may submit.
  useEffect(() => {
    onStatus?.(status);
    // onStatus is the parent's callback; only a new status is news.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const bad = status === "taken" || status === "invalid" || status === "reserved";
  const message =
    status === "idle"
      ? null
      : status === "checking"
        ? t.checking
        : status === "available"
          ? t.available
          : t[status];

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{t.label}</Label>
      {/* LTR as a whole, so the status icon sits after the text in either language. */}
      <div className="relative" dir="ltr">
        <Input
          id={id}
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={30}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ""))}
          aria-invalid={bad || undefined}
          aria-describedby={`${statusId}-hint ${statusId}`}
          className="pe-10 text-start"
          placeholder="your.name"
        />
        <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-3" aria-hidden>
          {status === "checking" && <ZLoader size="sm" className="text-ink-soft" aria-hidden />}
          {(status === "available" || status === "current") && <Check className="size-4 text-success" />}
          {bad && <X className="size-4 text-danger" />}
        </span>
      </div>
      <p id={`${statusId}-hint`} className="text-xs text-ink-soft">
        {t.hint}
      </p>
      <p
        id={statusId}
        aria-live="polite"
        className={cn(
          "min-h-4 text-xs",
          bad ? "font-medium text-danger" : status === "available" ? "font-medium text-success" : "text-ink-soft"
        )}
      >
        {message}
      </p>
    </div>
  );
}
