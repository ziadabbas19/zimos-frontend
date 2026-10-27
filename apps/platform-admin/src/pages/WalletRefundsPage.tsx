import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminWalletRefund, WalletRefundStatus } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, TextField } from "@/components/forms";
import { Modal } from "@/components/Modal";
import { Panel, Td, Th } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMinorMoneyExact, formatRelative } from "@/lib/format";
import { REFUND_STATUS, refundActions } from "@/lib/walletRefunds";
import { Pager } from "@/pages/BlocklistPage";

type Filter = WalletRefundStatus | "all";
type Action = { kind: "reject" | "paid"; refund: AdminWalletRefund } | null;
const PAGE_SIZE = 20;

const STRINGS = {
  en: {
    title: "Balance refunds",
    description: "Stores asking for unused prepaid balance back. Up to 75% of each paid top-up; gifts and corrections never count. The amount is held off the store's balance until you reject it or mark it paid.",
    refresh: "Refresh",
    waiting: "Waiting",
    approved: "Approved",
    paid: "Paid",
    rejected: "Rejected",
    cancelled: "Cancelled",
    all: "All",
    emptyWaiting: "No refund is waiting for review.",
    emptyOther: "No refunds match.",
    colStore: "Store",
    colAmount: "Amount",
    colSendTo: "Send to",
    colAsked: "Asked",
    colStatus: "Status",
    colActions: "Actions",
    deletedStore: "Deleted store",
    ref: "Ref: {ref}",
    approve: "Approve",
    markPaid: "Mark paid",
    reject: "Reject",
    approvedToast: "Approved. Send the money, then mark it paid.",
    paidTitle: "Mark the refund paid",
    rejectTitle: "Reject the refund",
    paidHelp: "After you sent the money by hand. Give the transfer's reference; this closes the request.",
    rejectHelp: "The held amount goes back to the store's balance. The note is shown to the store.",
    needRef: "Enter the transfer's reference.",
    needReason: "Write the reason (at least 3 characters).",
    paidToast: "Marked paid.",
    rejectedToast: "Rejected. The amount is back on the store's balance.",
    store: "Store",
    reference: "Transfer reference",
    noteOptional: "Note (optional)",
    reason: "Reason",
    cancel: "Cancel",
    saving: "Saving…",
  },
  ar: {
    title: "استرداد الرصيد",
    description: "متاجر تطلب استرداد رصيد مدفوع مسبقًا غير مستخدم. حتى 75% من كل شحنة مدفوعة؛ الهدايا والتصحيحات لا تُحتسب أبدًا. يُحجز المبلغ من رصيد المتجر حتى ترفضه أو تسجّل دفعه.",
    refresh: "تحديث",
    waiting: "قيد الانتظار",
    approved: "موافق عليها",
    paid: "مدفوعة",
    rejected: "مرفوضة",
    cancelled: "ملغاة",
    all: "الكل",
    emptyWaiting: "لا يوجد استرداد بانتظار المراجعة.",
    emptyOther: "لا توجد طلبات مطابقة.",
    colStore: "المتجر",
    colAmount: "المبلغ",
    colSendTo: "يُحوَّل إلى",
    colAsked: "تاريخ الطلب",
    colStatus: "الحالة",
    colActions: "الإجراءات",
    deletedStore: "متجر محذوف",
    ref: "المرجع: {ref}",
    approve: "موافقة",
    markPaid: "تسجيل الدفع",
    reject: "رفض",
    approvedToast: "تمت الموافقة. حوّل المبلغ ثم سجّل الدفع.",
    paidTitle: "تسجيل دفع الاسترداد",
    rejectTitle: "رفض الاسترداد",
    paidHelp: "بعد أن تحوّل المبلغ يدويًا. أدخل مرجع التحويل؛ هذا يُغلق الطلب.",
    rejectHelp: "يعود المبلغ المحجوز إلى رصيد المتجر. تظهر الملاحظة للمتجر.",
    needRef: "أدخل مرجع التحويل.",
    needReason: "اكتب السبب (3 أحرف على الأقل).",
    paidToast: "تم تسجيل الدفع.",
    rejectedToast: "تم الرفض. عاد المبلغ إلى رصيد المتجر.",
    store: "المتجر",
    reference: "مرجع التحويل",
    noteOptional: "ملاحظة (اختيارية)",
    reason: "السبب",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
  },
} satisfies Messages;


/**
 * Merchants asking for unused prepaid balance back (billing/walletRefundService):
 * approve, then send the money by hand and mark it paid with its reference;
 * or reject with a note, which puts the held amount back on the balance.
 */
export function WalletRefundsPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const [status, setStatus] = useState<Filter>("requested");
  const [page, setPage] = useState({ status, offset: 0 });
  const [action, setAction] = useState<Action>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const offset = page.status === status ? page.offset : 0;
  const { data, loading, error, refresh } = useAsync(
    () => adminApi.listWalletRefunds({ status: status === "all" ? undefined : status, page: offset / PAGE_SIZE + 1, pageSize: PAGE_SIZE }),
    [status, offset]
  );
  const refunds = data?.requests ?? [];

  async function approve(refund: AdminWalletRefund) {
    setBusyId(refund.id);
    try {
      await adminApi.approveWalletRefund(refund.id);
      toast.success(t.approvedToast);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
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
      <FilterChips
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: "requested", label: t.waiting },
          { value: "approved", label: t.approved },
          { value: "paid", label: t.paid },
          { value: "rejected", label: t.rejected },
          { value: "cancelled", label: t.cancelled },
          { value: "all", label: t.all },
        ]}
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {refunds.length === 0 ? (
          <EmptyBlock message={status === "requested" ? t.emptyWaiting : t.emptyOther} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.colStore}</Th>
                  <Th className="text-end">{t.colAmount}</Th>
                  <Th>{t.colSendTo}</Th>
                  <Th>{t.colAsked}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th className="text-end">{t.colActions}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((r) => {
                  const can = refundActions(r.status);
                  return (
                    <TableRow key={r.id}>
                      <Td>
                        {r.workspace ? (
                          <Link to={`/workspaces/${r.workspace.id}`} className="font-medium text-ink hover:text-primary">
                            {r.workspace.name}
                          </Link>
                        ) : (
                          t.deletedStore
                        )}
                      </Td>
                      <Td className="tabular text-end text-sm">{formatMinorMoneyExact(r.amount, r.currency)}</Td>
                      <Td className="text-sm">
                        {r.payoutMethod ?? "—"}
                        {r.payoutAccount && (
                          <span className="block font-mono text-xs text-ink-soft" dir="ltr">
                            {r.payoutAccount}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-sm">
                        <span title={formatDateTime(r.createdAt)}>{formatRelative(r.createdAt)}</span>
                      </Td>
                      <Td>
                        <Status value={REFUND_STATUS[r.status].badge} label={REFUND_STATUS[r.status].label} />
                        {r.payoutReference && <span className="mt-1 block text-xs text-ink-soft">{fmt(t.ref, { ref: r.payoutReference })}</span>}
                        {r.adminNote && <span className="block text-xs text-ink-soft">{r.adminNote}</span>}
                      </Td>
                      <Td className="text-end">
                        <div className="flex flex-wrap justify-end gap-2">
                          {can.approve && (
                            <Button size="sm" onClick={() => void approve(r)} disabled={busyId === r.id}>
                              {t.approve}
                            </Button>
                          )}
                          {can.markPaid && (
                            <Button size="sm" onClick={() => setAction({ kind: "paid", refund: r })}>
                              {t.markPaid}
                            </Button>
                          )}
                          {can.reject && (
                            <Button size="sm" variant="outline" onClick={() => setAction({ kind: "reject", refund: r })}>
                              {t.reject}
                            </Button>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
        {data && <Pager total={data.total} limit={PAGE_SIZE} offset={offset} onOffset={(next) => setPage({ status, offset: next })} />}
      </DataState>
      <RefundActionDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          void refresh();
        }}
      />
    </div>
  );
}

function RefundActionDialog({ action, onClose, onDone }: { action: Action; onClose: () => void; onDone: () => void }) {
  const t = useT(STRINGS);
  return (
    <Modal
      open={action !== null}
      onClose={onClose}
      title={action?.kind === "paid" ? t.paidTitle : t.rejectTitle}
      description={
        action?.kind === "paid"
          ? t.paidHelp
          : t.rejectHelp
      }
    >
      {action && <RefundActionForm key={`${action.kind}:${action.refund.id}`} action={action} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function RefundActionForm({ action, onClose, onDone }: { action: NonNullable<Action>; onClose: () => void; onDone: () => void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paid = action.kind === "paid";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (paid ? reference.trim().length < 2 : note.trim().length < 3) {
      setError(paid ? t.needRef : t.needReason);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (paid) {
        await adminApi.markWalletRefundPaid(action.refund.id, { payoutReference: reference.trim(), note: note.trim() || undefined });
        toast.success(t.paidToast);
      } else {
        await adminApi.rejectWalletRefund(action.refund.id, note.trim());
        toast.success(t.rejectedToast);
      }
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <p className="text-sm text-ink">
        {action.refund.workspace?.name ?? t.store} · <span className="tabular">{formatMinorMoneyExact(action.refund.amount, action.refund.currency)}</span>
      </p>
      {paid && <TextField label={t.reference} dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} required />}
      <TextField label={paid ? t.noteOptional : t.reason} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} required={!paid} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? t.saving : paid ? t.markPaid : t.reject}
        </Button>
      </div>
    </form>
  );
}
