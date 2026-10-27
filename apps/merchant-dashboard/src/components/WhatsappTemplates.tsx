import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import { whatsappTemplatesList, whatsappTemplatesSync, type WhatsappTemplateRow } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: {
    pick: "Approved template",
    pickNone: "Choose a template…",
    pickHint: "Synced from your WhatsApp account. Only approved templates can be sent.",
    params: "{n} variables",
    title: "Message templates",
    description: "Your WhatsApp account's templates and their status in Meta. Automations and the inbox can only send approved ones.",
    sync: "Sync from Meta",
    syncing: "Syncing…",
    synced: "Last synced {at}",
    neverSynced: "Not synced yet.",
    empty: "No templates in your WhatsApp account yet. Create them in Meta's WhatsApp Manager, then sync.",
    noPermission: "You don't have access to the WhatsApp templates.",
    rejected: "Rejected: {reason}",
    status_APPROVED: "Approved",
    status_PENDING: "In review",
    status_REJECTED: "Rejected",
    status_PAUSED: "Paused",
    status_DISABLED: "Disabled",
  },
  ar: {
    pick: "قالب معتمد",
    pickNone: "اختر قالبًا…",
    pickHint: "متزامنة من حساب واتساب الخاص بك. القوالب المعتمدة فقط يمكن إرسالها.",
    params: "{n} متغيرات",
    title: "قوالب الرسائل",
    description: "قوالب حساب واتساب الخاص بك وحالتها في Meta. الأتمتة وصندوق الرسائل يرسلان القوالب المعتمدة فقط.",
    sync: "مزامنة من Meta",
    syncing: "جارٍ المزامنة…",
    synced: "آخر مزامنة {at}",
    neverSynced: "لم تتم المزامنة بعد.",
    empty: "لا توجد قوالب في حساب واتساب بعد. أنشئها من WhatsApp Manager في Meta ثم زامن.",
    noPermission: "ليست لديك صلاحية الاطلاع على قوالب واتساب.",
    rejected: "مرفوض: {reason}",
    status_APPROVED: "معتمد",
    status_PENDING: "قيد المراجعة",
    status_REJECTED: "مرفوض",
    status_PAUSED: "موقوف مؤقتًا",
    status_DISABLED: "معطّل",
  },
} satisfies Messages;

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", PAUSED: "warning", DISABLED: "danger" };

/**
 * WhatsApp message templates synced from Meta (SPEC §14.1; backend
 * whatsapp/whatsappTemplates.js): the list with its statuses for the WhatsApp
 * settings, and the picker the automation editor and the inbox put above
 * their template name field.
 */

export function useWhatsappTemplates() {
  const workspaceId = useWorkspaceId();
  const [templates, setTemplates] = useState<WhatsappTemplateRow[] | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    whatsappTemplatesList(apiClient, workspaceId)
      .then((res) => {
        setTemplates(res.templates);
        setSyncedAt(res.syncedAt);
        setError(null);
      })
      .catch((err) => {
        setTemplates([]);
        setError(err);
      });
  }, [workspaceId]);
  useEffect(load, [load]);
  return { templates, syncedAt, error, setTemplates, setSyncedAt };
}

function useStatusText() {
  const t = useT(STRINGS);
  return (status: string) => (t as Record<string, string>)[`status_${status}`] ?? status.toLowerCase();
}

/**
 * Picks a synced template: hands back its name, language and variable count.
 * Renders nothing when the store has none synced — the name field stays the way in.
 */
export function TemplatePicker({ name, language, onPick }: { name: string; language: string; onPick: (template: WhatsappTemplateRow) => void }) {
  const t = useT(STRINGS);
  const statusText = useStatusText();
  const { templates } = useWhatsappTemplates();
  if (!templates || templates.length === 0) return null;
  const key = (tpl: { name: string; language: string }) => `${tpl.name}|${tpl.language}`;
  const current = templates.find((tpl) => key(tpl) === key({ name, language }));
  return (
    <div className="space-y-2">
      <Field label={t.pick} hint={t.pickHint}>
        {(props) => (
          <Select
            {...props}
            value={current ? key(current) : ""}
            onChange={(e) => {
              const picked = templates.find((tpl) => key(tpl) === e.target.value);
              if (picked) onPick(picked);
            }}
          >
            <option value="">{t.pickNone}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={key(tpl)} disabled={tpl.status !== "APPROVED"}>
                {tpl.name} ({tpl.language}){tpl.status !== "APPROVED" ? ` — ${statusText(tpl.status)}` : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {current?.bodyText && (
        <p dir="auto" className="whitespace-pre-line rounded-[var(--radius-card)] bg-paper px-3 py-2 text-sm text-ink">
          {current.bodyText}
          <span className="mt-1 block text-xs text-ink-soft">{fmt(t.params, { n: current.paramsCount })}</span>
        </p>
      )}
    </div>
  );
}

/** The WhatsApp settings' list of templates, with their status and a sync button. */
export function WhatsappTemplatesPanel() {
  const t = useT(STRINGS);
  const statusText = useStatusText();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const { templates, syncedAt, error, setTemplates, setSyncedAt } = useWhatsappTemplates();
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setSyncError(null);
    try {
      const res = await whatsappTemplatesSync(apiClient, workspaceId);
      setTemplates(res.templates);
      setSyncedAt(res.syncedAt);
    } catch (err) {
      setSyncError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{t.title}</h3>
          <p className="text-sm text-ink-soft">{t.description}</p>
          <p className="mt-1 text-xs text-ink-soft">{syncedAt ? fmt(t.synced, { at: formatDateTime(syncedAt) }) : t.neverSynced}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void sync()}>
          {busy ? <ZLoader size="sm" /> : <RefreshCw className="size-4" aria-hidden />}
          {busy ? t.syncing : t.sync}
        </Button>
      </div>
      {syncError && <Alert variant="danger">{syncError}</Alert>}
      {templates === null ? (
        <div className="flex justify-center py-4 text-ink-soft">
          <ZLoader />
        </div>
      ) : error && isPermissionError(error) ? (
        <p className="text-sm text-ink-soft">{t.noPermission}</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
          {templates.map((tpl) => (
            <li key={tpl.id} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <code dir="ltr" className="text-sm font-medium text-ink">
                  {tpl.name}
                </code>
                <span className="text-xs text-ink-soft">
                  {tpl.language}
                  {tpl.category ? ` · ${tpl.category.toLowerCase()}` : ""}
                </span>
                <StatusBadge value={tpl.status.toLowerCase()} tone={TONE[tpl.status] ?? "neutral"} text={statusText(tpl.status)} />
              </div>
              {tpl.bodyText && (
                <p dir="auto" className="line-clamp-2 text-sm text-ink-soft">
                  {tpl.bodyText}
                </p>
              )}
              {tpl.rejectedReason && <p className="text-xs text-danger">{fmt(t.rejected, { reason: tpl.rejectedReason })}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
