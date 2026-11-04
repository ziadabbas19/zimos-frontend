import { useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import type { AdminPaymentMethod } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Panel, Mono } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { P } from "@/lib/permissions";
import * as adminApi from "@/lib/adminApi";

const STRINGS = {
  en: {
    title: "Payment methods",
    description: "How merchants pay their subscription. Merchants see the ones that are on, in this order.",
    refresh: "Refresh",
    turnedOn: "Turned on.",
    turnedOff: "Turned off.",
    needsManage: "Turning methods on or off needs the “Payment methods — turn on and off” permission.",
    empty: "No payment methods yet.",
    offered: "Offered to merchants",
    notOffered: "Not offered",
    transferTo: "Transfer to",
    noNumber: "— no number yet —",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    editNumber: "Edit number",
    toggleOn: "{name} on",
    gatewaysTitle: "Gateways not added yet",
    gatewaysDescription: "This server has these gateways. Turning one on adds it to the list above.",
    configured: "Configured in the environment.",
    notConfigured: "Not configured: {missing}",
    addAndTurnOn: "Add and turn on",
    savedToast: "Saved. The change is in the audit log.",
    onHere: "On here",
    offHere: "Off here",
    noAdapter: "this server has no adapter for it",
    configuredLower: "configured in the environment",
    notConfiguredLower: "not configured in the environment ({missing})",
    dialogTitle: "{name}: where the money goes",
    dialogDescription: "Merchants send their transfers here. Check it twice: a wrong number sends their money elsewhere.",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    numberLabel: "Number or InstaPay address",
    noteArLabel: "Note in Arabic (optional)",
    noteEnLabel: "Note in English (optional)",
    linkLabel: "Payment link (optional)",
    linkHint: "An https link, e.g. your InstaPay link. Leave it empty if there is none: merchants then see the number only.",
    linkHttps: "The link must start with https://",
    payLink: "Payment link",
  },
  ar: {
    title: "طرق الدفع",
    description: "كيف يدفع التجار اشتراكهم. يرى التجار الطرق المفعّلة بهذا الترتيب.",
    refresh: "تحديث",
    turnedOn: "فُعّلت.",
    turnedOff: "أُوقفت.",
    needsManage: "تفعيل الطرق أو إيقافها يحتاج إلى صلاحية «طرق الدفع — التفعيل والإيقاف».",
    empty: "لا توجد طرق دفع بعد.",
    offered: "معروضة على التجار",
    notOffered: "غير معروضة",
    transferTo: "التحويل إلى",
    noNumber: "— لا يوجد رقم بعد —",
    moveUp: "نقل {name} لأعلى",
    moveDown: "نقل {name} لأسفل",
    editNumber: "تعديل الرقم",
    toggleOn: "تفعيل {name}",
    gatewaysTitle: "بوابات لم تُضف بعد",
    gatewaysDescription: "هذا الخادم يدعم هذه البوابات. تفعيل إحداها يضيفها إلى القائمة أعلاه.",
    configured: "مُعدّة في بيئة التشغيل.",
    notConfigured: "غير مُعدّة: {missing}",
    addAndTurnOn: "إضافة وتفعيل",
    savedToast: "حُفظ. التغيير مسجّل في سجل التدقيق.",
    onHere: "مفعّلة هنا",
    offHere: "متوقفة هنا",
    noAdapter: "لا يوجد على هذا الخادم محوّل لها",
    configuredLower: "مُعدّة في بيئة التشغيل",
    notConfiguredLower: "غير مُعدّة في بيئة التشغيل ({missing})",
    dialogTitle: "{name}: أين تذهب الأموال",
    dialogDescription: "يرسل التجار تحويلاتهم إلى هنا. راجعه مرتين: الرقم الخاطئ يرسل أموالهم إلى مكان آخر.",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    numberLabel: "الرقم أو عنوان إنستاباي",
    noteArLabel: "ملاحظة بالعربية (اختيارية)",
    noteEnLabel: "ملاحظة بالإنجليزية (اختيارية)",
    linkLabel: "رابط الدفع (اختياري)",
    linkHint: "رابط https، مثل رابط إنستاباي. اتركه فارغًا إن لم يوجد، وسيرى التجار الرقم فقط.",
    linkHttps: "يجب أن يبدأ الرابط بـ https://",
    payLink: "رابط الدفع",
  },
} satisfies Messages;

/**
 * The ways merchants can pay Zimos. Reading is for whoever reviews payments;
 * turning a method on or off and the order need payment_methods.manage, and
 * a manual method's number payment_methods.edit_numbers (the creator's unless
 * granted). A gateway shows whether it is on here and whether the server's
 * environment has what it needs — by variable names, never a value.
 */
export function PaymentMethodsPage() {
  const t = useT(STRINGS);
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can(P.PAYMENT_METHODS_MANAGE);
  const canEditNumbers = can(P.PAYMENT_METHODS_EDIT_NUMBERS);
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listPaymentMethods(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPaymentMethod | null>(null);
  const methods = data?.methods ?? [];

  async function setEnabled(code: string, enabled: boolean) {
    setBusy(code);
    try {
      await adminApi.updatePaymentMethod(code, { enabled });
      await refresh({ silent: true });
      toast.success(enabled ? t.turnedOn : t.turnedOff);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, step: -1 | 1) {
    const codes = methods.map((m) => m.code);
    const target = index + step;
    if (target < 0 || target >= codes.length) return;
    [codes[index], codes[target]] = [codes[target], codes[index]];
    setBusy("order");
    try {
      setData(await adminApi.reorderPaymentMethods(codes));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {t.refresh}
          </Button>
        }
      />
      {!canManage && (
        <Alert className="mb-4">{t.needsManage}</Alert>
      )}
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        <div className="space-y-4">
          {methods.length === 0 ? (
            <EmptyBlock message={t.empty} />
          ) : (
            <Panel flush>
              <ul className="divide-y divide-line">
                {methods.map((m, index) => (
                  <li key={m.code} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {m.labelEn}
                        <span className="font-normal text-ink-soft" dir="rtl">
                          {m.labelAr}
                        </span>
                        <Mono className="text-xs">{m.code}</Mono>
                        <Status value={m.offered ? "active" : "inactive"} label={m.offered ? t.offered : t.notOffered} />
                      </p>
                      {m.kind === "manual" ? (
                        <p className="text-sm text-ink-soft">
                          {t.transferTo} <span dir="ltr" className="font-mono text-ink">{m.accountNumber || t.noNumber}</span>
                          {m.paymentLink && (
                            <span className="block text-xs">
                              {t.payLink}:{" "}
                              <a href={m.paymentLink} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-primary underline">
                                {m.paymentLink}
                              </a>
                            </span>
                          )}
                          {(m.noteEn || m.noteAr) && <span className="block text-xs">{m.noteEn || m.noteAr}</span>}
                        </p>
                      ) : (
                        <GatewayState method={m} />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={fmt(t.moveUp, { name: m.labelEn })}
                            disabled={busy !== null || index === 0}
                            onClick={() => void move(index, -1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={fmt(t.moveDown, { name: m.labelEn })}
                            disabled={busy !== null || index === methods.length - 1}
                            onClick={() => void move(index, 1)}
                          >
                            <ArrowDown />
                          </Button>
                        </>
                      )}
                      {m.kind === "manual" && canEditNumbers && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                          {t.editNumber}
                        </Button>
                      )}
                      {canManage && (
                        <Toggle
                          checked={m.enabled}
                          label={fmt(t.toggleOn, { name: m.labelEn })}
                          hideLabel
                          disabled={busy !== null}
                          onChange={(next) => void setEnabled(m.code, next)}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {(data?.gatewaysNotAdded.length ?? 0) > 0 && (
            <Panel title={t.gatewaysTitle} description={t.gatewaysDescription}>
              <ul className="space-y-3">
                {data!.gatewaysNotAdded.map((g) => (
                  <li key={g.code} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-ink">{g.name}</span> <Mono className="text-xs">{g.code}</Mono>
                      <span className="block text-xs text-ink-soft">
                        {g.configured ? t.configured : fmt(t.notConfigured, { missing: g.missing.join(", ") })}
                      </span>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void setEnabled(g.code, true)}>
                        {t.addAndTurnOn}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </DataState>

      {editing && (
        <AccountDialog
          method={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success(t.savedToast);
            void refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function GatewayState({ method }: { method: AdminPaymentMethod }) {
  const t = useT(STRINGS);
  const g = method.gateway;
  if (!g) return null;
  return (
    <p className="text-sm text-ink-soft">
      {g.name ?? method.code} · {method.enabled ? t.onHere : t.offHere} ·{" "}
      {!g.adapterInstalled
        ? t.noAdapter
        : g.configured
          ? t.configuredLower
          : fmt(t.notConfiguredLower, { missing: g.missing.join(", ") })}
    </p>
  );
}

function AccountDialog({ method, onClose, onSaved }: { method: AdminPaymentMethod; onClose: () => void; onSaved: () => void }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [accountNumber, setAccountNumber] = useState(method.accountNumber ?? "");
  const [paymentLink, setPaymentLink] = useState(method.paymentLink ?? "");
  const [noteAr, setNoteAr] = useState(method.noteAr ?? "");
  const [noteEn, setNoteEn] = useState(method.noteEn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const link = paymentLink.trim();
    // Optional; when given it must be https (the server checks too).
    if (link && !/^https:\/\//i.test(link)) {
      setError(t.linkHttps);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.updatePaymentMethodAccount(method.code, {
        accountNumber: accountNumber.trim(),
        paymentLink: link || null,
        noteAr: noteAr.trim(),
        noteEn: noteEn.trim(),
      });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={fmt(t.dialogTitle, { name: locale === "ar" ? method.labelAr : method.labelEn })}
      description={t.dialogDescription}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !accountNumber.trim()}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label={t.numberLabel} dir="ltr" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={80} required />
        <TextField
          label={t.linkLabel}
          dir="ltr"
          type="url"
          placeholder="https://"
          value={paymentLink}
          onChange={(e) => setPaymentLink(e.target.value)}
          maxLength={500}
          hint={t.linkHint}
        />
        <TextField label={t.noteArLabel} dir="rtl" value={noteAr} onChange={(e) => setNoteAr(e.target.value)} maxLength={500} />
        <TextField label={t.noteEnLabel} value={noteEn} onChange={(e) => setNoteEn(e.target.value)} maxLength={500} />
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
