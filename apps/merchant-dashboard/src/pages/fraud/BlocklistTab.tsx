import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import { isApiErrorCode, type BlocklistEntry } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

/** The server returns at most this many entries and doesn't page past it. */
const BLOCKLIST_CAP = 500;

const STRINGS = {
  en: {
    formHeading: "Block a phone number",
    formHint: "Works for any number, even one that has never ordered. Blocking a number that's already blocked just updates its reason.",
    phone: "Phone number",
    phonePlaceholder: "01XXXXXXXXX",
    fullName: "Name (optional)",
    reason: "Reason",
    reasonPlaceholder: "Refused three deliveries",
    phoneRequired: "Enter a phone number.",
    reasonTooShort: "Enter a reason of at least 2 characters.",
    block: "Block number",
    blocking: "Blocking…",
    blockedNew: "{phone} is now blocked.",
    blockedExisting: "{phone} was already blocked — its reason has been updated.",
    listHeading: "Blocked numbers",
    empty: "No phone numbers are blocked.",
    capped: "Showing the first {n} blocked numbers.",
    unnamedCustomer: "Unnamed customer",
    ordersSummary: "{orders} orders · {rejected} rejected",
    blockedOn: "Blocked {date}",
    noReason: "No reason recorded",
    unblock: "Unblock",
    unblockTitle: "Unblock {phone}?",
    unblockDescription: "They'll be able to check out again, and new orders from this number won't be flagged as blocked.",
    unblocking: "Unblocking…",
    cancel: "Cancel",
    unblocked: "{phone} is no longer blocked.",
  },
  ar: {
    formHeading: "حظر رقم هاتف",
    formHint: "يعمل مع أي رقم، حتى لو لم يطلب من قبل. حظر رقم محظور بالفعل يحدّث السبب فقط.",
    phone: "رقم الهاتف",
    phonePlaceholder: "01XXXXXXXXX",
    fullName: "الاسم (اختياري)",
    reason: "السبب",
    reasonPlaceholder: "رفض الاستلام ثلاث مرات",
    phoneRequired: "أدخل رقم الهاتف.",
    reasonTooShort: "أدخل سببًا من حرفين على الأقل.",
    block: "حظر الرقم",
    blocking: "جارٍ الحظر…",
    blockedNew: "تم حظر {phone}.",
    blockedExisting: "{phone} محظور بالفعل — تم تحديث السبب.",
    listHeading: "الأرقام المحظورة",
    empty: "لا توجد أرقام هواتف محظورة.",
    capped: "يتم عرض أول {n} رقم محظور.",
    unnamedCustomer: "عميل بدون اسم",
    ordersSummary: "{orders} أوردر · {rejected} مرفوض",
    blockedOn: "حُظر في {date}",
    noReason: "لم يُسجَّل سبب",
    unblock: "إلغاء الحظر",
    unblockTitle: "إلغاء حظر {phone}؟",
    unblockDescription: "سيتمكن من إتمام الشراء مرة أخرى، ولن تُميَّز الأوردرات الجديدة من هذا الرقم كمحظورة.",
    unblocking: "جارٍ إلغاء الحظر…",
    cancel: "إلغاء",
    unblocked: "تم إلغاء حظر {phone}.",
  },
} satisfies Messages;

/**
 * Wraps a phone in an LTR isolate for interpolation into a sentence. Plain
 * text (toasts, dialog titles) can't hold <bdi>, so this uses the Unicode
 * first-strong isolate pair instead.
 */
function isolate(phone: string): string {
  return `⁦${phone}⁩`;
}

export function BlocklistTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => apiClient.listBlocklist(workspaceId), [workspaceId]);
  const entries = list.data ?? [];
  const [unblocking, setUnblocking] = useState<BlocklistEntry | null>(null);
  const toast = useToast();
  const errorMessage = useErrorMessage();

  async function confirmUnblock() {
    if (!unblocking) return;
    try {
      await apiClient.setCustomerBlacklist(workspaceId, unblocking.customerId, { isBlacklisted: false });
    } catch (err) {
      // ConfirmDialog shows a thrown Error's message as-is.
      throw new Error(errorMessage(err));
    }
    const { customerId, phone } = unblocking;
    list.setData((prev) => (prev ?? []).filter((e) => e.customerId !== customerId));
    toast.success(fmt(t.unblocked, { phone: isolate(phone) }));
    setUnblocking(null);
  }

  return (
    <div className="space-y-6">
      <BlockPhoneForm onBlocked={() => void list.refresh({ silent: true })} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">{t.listHeading}</h2>
        <DataState
          loading={list.loading}
          error={list.error}
          empty={entries.length === 0}
          emptyMessage={t.empty}
          onRetry={() => void list.refresh()}
        >
          {entries.length >= BLOCKLIST_CAP && (
            <p className="mb-3 text-sm text-ink-soft">{fmt(t.capped, { n: BLOCKLIST_CAP })}</p>
          )}
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.customerId}
                className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    to={`/customers/${entry.customerId}`}
                    className="inline-flex min-h-11 flex-wrap items-center gap-x-2 font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span>{entry.fullName || t.unnamedCustomer}</span>
                    <bdi dir="ltr" className="text-ink-soft">
                      {entry.phone}
                    </bdi>
                  </Link>
                  {entry.reason ? (
                    <p className="text-sm text-ink" dir="auto">
                      {entry.reason}
                    </p>
                  ) : (
                    <p className="text-sm text-ink-soft">{t.noReason}</p>
                  )}
                  <p className="text-xs text-ink-soft">
                    {fmt(t.ordersSummary, { orders: entry.totalOrders, rejected: entry.totalRejectedOrders })}
                    {entry.blockedAt && <> · {fmt(t.blockedOn, { date: formatDate(entry.blockedAt) })}</>}
                  </p>
                </div>
                <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setUnblocking(entry)}>
                  {t.unblock}
                </Button>
              </li>
            ))}
          </ul>
        </DataState>
      </section>

      <ConfirmDialog
        open={unblocking !== null}
        title={unblocking ? fmt(t.unblockTitle, { phone: isolate(unblocking.phone) }) : ""}
        description={t.unblockDescription}
        confirmLabel={t.unblock}
        busyLabel={t.unblocking}
        cancelLabel={t.cancel}
        onCancel={() => setUnblocking(null)}
        onConfirm={confirmUnblock}
      />
    </div>
  );
}

function BlockPhoneForm({ onBlocked }: { onBlocked: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; reason?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (phone.trim() === "") nextErrors.phone = t.phoneRequired;
    if (reason.trim().length < 2) nextErrors.reason = t.reasonTooShort;
    setFieldErrors(nextErrors);
    setError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const { created, entry } = await apiClient.blockPhone(workspaceId, {
        phone: phone.trim(),
        reason: reason.trim(),
        ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
      });
      // 201 = a new block; 200 = the phone was already blocked and only its reason changed.
      toast.success(fmt(created ? t.blockedNew : t.blockedExisting, { phone: isolate(entry.phone) }));
      setPhone("");
      setFullName("");
      setReason("");
      onBlocked();
    } catch (err) {
      if (isApiErrorCode(err, "INVALID_PHONE")) {
        setFieldErrors({ phone: errorMessage(err) });
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.formHeading}</h2>
          <p className="text-sm text-ink-soft">{t.formHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.phone}
            required
            type="tel"
            inputMode="tel"
            autoComplete="off"
            dir="ltr"
            maxLength={32}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phonePlaceholder}
            error={fieldErrors.phone}
            className="[&_input]:h-11"
          />
          <TextField
            label={t.fullName}
            autoComplete="off"
            maxLength={200}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="[&_input]:h-11"
          />
        </div>
        <TextField
          label={t.reason}
          required
          maxLength={300}
          dir="auto"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.reasonPlaceholder}
          error={fieldErrors.reason}
          className="[&_input]:h-11"
        />
        {error && <Alert variant="danger">{error}</Alert>}
        <Button type="submit" disabled={busy} className="min-h-11">
          {busy ? t.blocking : t.block}
        </Button>
      </form>
    </Card>
  );
}
