import { Alert, Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useReportDirty } from "@/lib/useUnsavedGuard";

const STRINGS = {
  en: {
    save: "Save changes",
    saving: "Saving…",
    reset: "Discard changes",
    readOnlyTitle: "View only",
    readOnly: "Only the store owner, a workspace manager or an editor can change these settings.",
  },
  ar: {
    save: "حفظ التغييرات",
    saving: "جارٍ الحفظ…",
    reset: "تجاهل التغييرات",
    readOnlyTitle: "عرض فقط",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو المحرر فقط تغيير هذه الإعدادات.",
  },
} satisfies Messages;

/** The no-permission notice every store-settings tab opens with. */
export function ReadOnlyNotice({ editable }: { editable: boolean }) {
  const t = useT(STRINGS);
  if (editable) return null;
  return (
    <Alert>
      <p className="font-medium">{t.readOnlyTitle}</p>
      <p>{t.readOnly}</p>
    </Alert>
  );
}

/** Error line plus Discard / Save, shared by the store-settings tabs. */
export function SettingsFormFooter({
  editable,
  dirty,
  saving,
  error,
  onSave,
  onReset,
}: {
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onReset: () => void;
}) {
  const t = useT(STRINGS);
  // A tab that keeps its own draft is covered here: leaving with it unsaved asks first.
  useReportDirty(editable && dirty);
  return (
    <div className="space-y-3">
      {error && <Alert variant="danger">{error}</Alert>}
      {editable && (
        <div className="flex flex-wrap justify-end gap-2">
          {dirty && (
            <Button variant="outline" disabled={saving} onClick={onReset}>
              {t.reset}
            </Button>
          )}
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving ? t.saving : t.save}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A labelled checkbox row: title, hint, and the switch at the end. */
export function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
      />
    </label>
  );
}
