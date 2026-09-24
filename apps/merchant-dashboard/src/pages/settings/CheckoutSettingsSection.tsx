import { useId, useMemo, useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  ApiError,
  resolveCheckoutSettings,
  type CheckoutFieldMode,
  type CheckoutSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

/**
 * Role keys allowed to change checkout fields. PATCH /workspaces/:id needs
 * website.edit (checkout_settings asks for nothing more, unlike fraud_rules),
 * and these are the system roles that carry it (SYSTEM_ROLES in the backend's
 * core/security/permissions.js). The dashboard only sees the role key, so a
 * custom role with website.edit still reads the card as view-only; a 403 on
 * save flips an editable card to view-only too.
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "editor"]);

type FieldKey = keyof CheckoutSettings;

/** Allowed values per key — mirrors CHECKOUT_FIELD_MODES / CHECKOUT_NOTES_MODES. */
const FIELDS: ReadonlyArray<{ key: FieldKey; modes: readonly CheckoutFieldMode[] }> = [
  { key: "email", modes: ["hidden", "optional", "required"] },
  { key: "postal_code", modes: ["hidden", "optional", "required"] },
  { key: "notes", modes: ["hidden", "optional"] },
];

const STRINGS = {
  en: {
    title: "Checkout fields",
    description:
      "Choose which extra details shoppers are asked for at checkout. Name, phone and address are always required.",
    readOnlyTitle: "View only",
    readOnly: "Only the store owner, a workspace manager or an editor can change checkout fields.",
    readOnlyForbidden: "Your role can't change checkout fields, so they're shown read-only. Ask the store owner if they need changing.",
    email: "Email",
    emailHint: "Used for order updates by email.",
    postal_code: "Postal code",
    postal_codeHint: "Some couriers ask for it.",
    notes: "Order notes",
    notesHint: "A free-text note for the courier, such as landmarks or delivery times.",
    hidden: "Hidden",
    optional: "Optional",
    required: "Required",
    quickFormNote:
      "The quick order form on product pages stays short: it shows email and postal code only when you make them required.",
    save: "Save checkout fields",
    saving: "Saving…",
    reset: "Discard changes",
    saved: "Checkout fields saved.",
  },
  ar: {
    title: "حقول إتمام الطلب",
    description:
      "اختر البيانات الإضافية التي تُطلب من المشتري عند إتمام الطلب. الاسم والهاتف والعنوان مطلوبة دائمًا.",
    readOnlyTitle: "عرض فقط",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو المحرر فقط تغيير حقول إتمام الطلب.",
    readOnlyForbidden: "دورك لا يسمح بتغيير حقول إتمام الطلب، لذلك تظهر للعرض فقط. اطلب من مالك المتجر إذا احتاجت إلى تعديل.",
    email: "البريد الإلكتروني",
    emailHint: "يُستخدم لإرسال تحديثات الطلب بالبريد.",
    postal_code: "الرمز البريدي",
    postal_codeHint: "تطلبه بعض شركات الشحن.",
    notes: "ملاحظات الطلب",
    notesHint: "ملاحظة حرة للمندوب، مثل علامة مميزة أو مواعيد التوصيل.",
    hidden: "مخفي",
    optional: "اختياري",
    required: "مطلوب",
    quickFormNote:
      "نموذج الطلب السريع في صفحات المنتجات يظل مختصرًا: يعرض البريد الإلكتروني والرمز البريدي فقط عندما تجعلهما مطلوبين.",
    save: "حفظ حقول إتمام الطلب",
    saving: "جارٍ الحفظ…",
    reset: "تجاهل التغييرات",
    saved: "تم حفظ حقول إتمام الطلب.",
  },
} satisfies Messages;

function sameSettings(a: CheckoutSettings, b: CheckoutSettings): boolean {
  return FIELDS.every(({ key }) => a[key] === b[key]);
}

export function CheckoutSettingsSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, refresh } = useWorkspace();

  const stored = useMemo(
    () => resolveCheckoutSettings(currentWorkspace?.settings?.checkout_settings),
    [currentWorkspace?.settings?.checkout_settings]
  );
  // The last settings known to be on the server — replaced by the PATCH
  // response on save, so "dirty" is right before the silent refresh lands.
  const [saved, setSaved] = useState<CheckoutSettings>(stored);
  const [draft, setDraft] = useState<CheckoutSettings>(stored);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const dirty = !sameSettings(draft, saved);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Only the checkout_settings sub-keys are sent; the backend merges them
      // into the settings blob and leaves every other key alone.
      const workspace = await apiClient.updateWorkspace(workspaceId, {
        settings: { checkout_settings: { ...draft } },
      });
      const next = resolveCheckoutSettings(workspace.settings?.checkout_settings);
      setSaved(next);
      setDraft(next);
      toast.success(t.saved);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Whatever the role key suggested, the server says no — stop offering
        // edits and put the stored settings back.
        setForbidden(true);
        setDraft(saved);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 space-y-4">
        {!editable && (
          <Alert>
            <p className="font-medium">{t.readOnlyTitle}</p>
            <p>{forbidden ? t.readOnlyForbidden : t.readOnly}</p>
          </Alert>
        )}

        <div className="divide-y divide-line">
          {FIELDS.map(({ key, modes }) => (
            <ModeField
              key={key}
              name={`checkout-${key}`}
              label={t[key]}
              hint={t[`${key}Hint`]}
              modes={modes}
              modeLabel={(mode) => t[mode]}
              value={draft[key]}
              disabled={!editable || saving}
              onChange={(mode) => setDraft((prev) => ({ ...prev, [key]: mode }))}
            />
          ))}
        </div>

        <p className="text-xs text-ink-soft">{t.quickFormNote}</p>

        {error && <Alert variant="danger">{error}</Alert>}

        {editable && (
          <div className="flex flex-wrap justify-end gap-2">
            {dirty && (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={saving}
                onClick={() => {
                  setDraft(saved);
                  setError(null);
                }}
              >
                {t.reset}
              </Button>
            )}
            <Button onClick={save} disabled={saving || !dirty} className="min-h-11">
              {saving ? t.saving : t.save}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** One field's visibility as a row of radio pills — each pill is a 44px target. */
function ModeField({
  name,
  label,
  hint,
  modes,
  modeLabel,
  value,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  modes: readonly CheckoutFieldMode[];
  modeLabel: (mode: CheckoutFieldMode) => string;
  value: CheckoutFieldMode;
  disabled: boolean;
  onChange: (mode: CheckoutFieldMode) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-ink">
          {label}
        </p>
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="flex shrink-0 flex-wrap gap-2"
      >
        {modes.map((mode) => {
          const checked = value === mode;
          return (
            <label
              key={mode}
              className={cn(
                "flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 text-sm transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "border-primary bg-primary-soft/40 font-medium text-ink" : "border-line text-ink-soft hover:border-primary/50",
                "has-[:disabled]:cursor-default has-[:disabled]:opacity-80"
              )}
            >
              <input
                type="radio"
                name={name}
                value={mode}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(mode)}
                className="size-4 shrink-0 accent-primary"
              />
              {modeLabel(mode)}
            </label>
          );
        })}
      </div>
    </div>
  );
}
