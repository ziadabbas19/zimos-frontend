import { useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { Order, Payment, PaymentTimeline, Refund } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { ProviderLogo } from "@/components/ProviderLogo";
import { providerName } from "@/lib/providers";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    title: "Payments and refunds",
    loading: "Loading payments…",
    empty: "No payments recorded on this order.",
    sync: "Sync payment status",
    syncing: "Checking with the gateway…",
    synced: "Payment status is up to date.",
    unreachable: "The gateway couldn't be reached for one of the payments. Nothing was changed; try again shortly.",
    paid: "Paid",
    refunded: "Refunded",
    pendingRefunds: "Refunds in progress",
    refundable: "Can still refund",
    refund: "Refund",
    refundTitle: "Refund this order",
    refundGateway: "The money goes back to the shopper's card or wallet through the gateway.",
    refundManual: "This records a refund you hand back yourself (cash, transfer). Nothing is sent to a gateway.",
    amount: "Amount",
    amountHint: "At most {max}.",
    fromPayment: "Refund from",
    paymentOption: "{method} payment of {amount}, {left} left",
    reason: "Reason",
    reasonPlaceholder: "Optional — e.g. item out of stock",
    confirmRefund: "Refund {amount}",
    refunding: "Refunding…",
    amountInvalid: "Enter an amount between 0.01 and {max}.",
    refundProcessed: "Refund of {amount} done.",
    refundPending: "Refund of {amount} sent. The gateway hasn't confirmed it yet; it will update here.",
    refundFailed: "The gateway declined the refund: {reason}",
    refundNoBalance:
      "The gateway couldn't pay this refund: your available balance there is too low. Top it up (or wait for pending payments to become available), then refund again.",
    attempts: "Payment attempts",
    methodViaGateway: "{method} via {gateway}",
    events: "Gateway updates",
    refunds: "Refunds",
    source_merchant: "From the dashboard",
    source_gateway: "From the gateway dashboard",
    via_webhook: "Webhook",
    via_redirect: "Shopper's return",
    via_inquiry: "Status check",
    test: "Test",
    alert_duplicate_payment: "This order was paid twice. Refund the extra payment.",
    alert_paid_after_expiry: "This order was paid after it expired and its stock was gone, so it stays cancelled. Refund the payment.",
    alert_paid_after_cancel: "This order was paid after it was cancelled. Refund the payment.",
    alert_paid_after_cod_switch: "The shopper paid online after switching to cash on delivery: don't collect cash for it.",
    alert_test_payment: "Paid in test mode: no real money was taken, and it can't be shipped.",
    alert_payment_amount_mismatch: "The amount paid differs from the order total. Check it in the gateway dashboard.",
    refundExtra: "Refund extra payment",
    refundPayment: "Refund payment",
    expiresAt: "Waiting for payment until {date}.",
    status_initialized: "Waiting for shopper",
    status_authorized: "Authorized",
    status_captured: "Paid",
    status_failed: "Failed",
    status_refunded: "Refunded",
    status_partially_refunded: "Partly refunded",
    status_expired: "Expired",
    status_cancelled: "Replaced",
    refund_pending: "In progress",
    refund_processed: "Done",
    refund_failed: "Failed",
  },
  ar: {
    title: "المدفوعات والاستردادات",
    loading: "جارٍ تحميل المدفوعات…",
    empty: "لا توجد مدفوعات مسجلة على هذا الأوردر.",
    sync: "مزامنة حالة الدفع",
    syncing: "جارٍ التحقق مع البوابة…",
    synced: "حالة الدفع محدّثة.",
    unreachable: "تعذّر الوصول للبوابة لإحدى الدفعات. لم يتغير شيء، حاول بعد قليل.",
    paid: "المدفوع",
    refunded: "المسترد",
    pendingRefunds: "استردادات جارية",
    refundable: "المتاح للاسترداد",
    refund: "استرداد",
    refundTitle: "استرداد مبلغ من هذا الأوردر",
    refundGateway: "المبلغ يرجع لكارت أو محفظة العميل عن طريق البوابة.",
    refundManual: "هذا يسجل استردادًا ترجّعه بنفسك (كاش أو تحويل). لا يُرسل شيء لأي بوابة.",
    amount: "المبلغ",
    amountHint: "بحد أقصى {max}.",
    fromPayment: "الاسترداد من",
    paymentOption: "دفعة {method} بمبلغ {amount}، متبقٍ {left}",
    reason: "السبب",
    reasonPlaceholder: "اختياري — مثلًا المنتج غير متوفر",
    confirmRefund: "استرداد {amount}",
    refunding: "جارٍ الاسترداد…",
    amountInvalid: "أدخل مبلغًا بين 0.01 و{max}.",
    refundProcessed: "تم استرداد {amount}.",
    refundPending: "تم إرسال استرداد {amount}. البوابة لم تؤكده بعد، وسيتحدث هنا.",
    refundFailed: "رفضت البوابة الاسترداد: {reason}",
    refundNoBalance:
      "البوابة لم تستطع دفع هذا الاسترداد: رصيدك المتاح عندها غير كافٍ. اشحن الرصيد (أو انتظر حتى تصبح المدفوعات المعلقة متاحة)، ثم استرد مرة أخرى.",
    attempts: "محاولات الدفع",
    methodViaGateway: "{method} عبر {gateway}",
    events: "تحديثات البوابة",
    refunds: "الاستردادات",
    source_merchant: "من لوحة التحكم",
    source_gateway: "من لوحة تحكم البوابة",
    via_webhook: "Webhook",
    via_redirect: "رجوع العميل",
    via_inquiry: "فحص الحالة",
    test: "تجربة",
    alert_duplicate_payment: "هذا الأوردر دُفع مرتين. استرد الدفعة الزيادة.",
    alert_paid_after_expiry: "هذا الأوردر دُفع بعد انتهاء مهلته ونفاد مخزونه، لذلك يبقى ملغيًا. استرد المبلغ.",
    alert_paid_after_cancel: "هذا الأوردر دُفع بعد إلغائه. استرد المبلغ.",
    alert_paid_after_cod_switch: "العميل دفع إلكترونيًا بعد التحويل للدفع عند الاستلام: لا تحصّل منه كاش.",
    alert_test_payment: "مدفوع في وضع التجربة: لم تُخصم فلوس حقيقية، ولا يمكن شحنه.",
    alert_payment_amount_mismatch: "المبلغ المدفوع مختلف عن إجمالي الأوردر. راجعه في لوحة تحكم البوابة.",
    refundExtra: "استرداد الدفعة الزيادة",
    refundPayment: "استرداد الدفعة",
    expiresAt: "في انتظار الدفع حتى {date}.",
    status_initialized: "في انتظار العميل",
    status_authorized: "مصرّح",
    status_captured: "مدفوع",
    status_failed: "فشل",
    status_refunded: "مسترد",
    status_partially_refunded: "مسترد جزئيًا",
    status_expired: "انتهت المهلة",
    status_cancelled: "استُبدلت",
    refund_pending: "جارٍ",
    refund_processed: "تم",
    refund_failed: "فشل",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const REFUND_NO_BALANCE = "REFUND_INSUFFICIENT_GATEWAY_BALANCE";

const ATTEMPT_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  initialized: "warning",
  captured: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "info",
  expired: "neutral",
  cancelled: "neutral",
};

const REFUND_TONE = { pending: "warning", processed: "success", failed: "danger" } as const;

/** Alerts that come with a one-click refund of the payment that shouldn't be kept. */
const REFUND_ALERTS = new Set(["duplicate_payment", "paid_after_expiry", "paid_after_cancel"]);

export function PaymentsSection({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const timeline = useAsync(() => apiClient.getPaymentTimeline(workspaceId, order.id), [workspaceId, order.id, order.updatedAt]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ paymentId?: string; amount?: number } | null>(null);

  const data = timeline.data;
  const money = (n: number | string) => formatMoney(n, order.currency);
  const hasGateway = Boolean(data?.attempts.some((p) => p.method));

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const next = await apiClient.syncOrderPayments(workspaceId, order.id);
      timeline.setData(next);
      if (next.unreachable) setError(t.unreachable);
      else toast.success(t.synced);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  // The payment to refund for a "refund the extra payment" alert: the newest
  // gateway payment that still has something left.
  const lastRefundable = data ? [...data.perPayment].reverse().find((p) => p.refundable > 0) : undefined;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <div className="flex flex-wrap gap-2">
            {hasGateway && (
              <Button variant="outline" className="min-h-11" disabled={syncing} onClick={sync}>
                <RefreshCw className="size-4" aria-hidden />
                {syncing ? t.syncing : t.sync}
              </Button>
            )}
            {data && data.refundable > 0 && (
              <Button variant="outline" className="min-h-11" onClick={() => setDialog({})}>
                {t.refund}
              </Button>
            )}
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {timeline.loading && !data ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Spinner /> {t.loading}
          </p>
        ) : timeline.error ? (
          <Alert variant="danger">{errorMessage(timeline.error)}</Alert>
        ) : data ? (
          <>
            {data.alerts.map((alert) => (
              <Alert key={alert} variant={alert === "test_payment" || alert === "paid_after_cod_switch" ? "default" : "danger"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t[`alert_${alert}` as keyof Strings] ?? labels.riskFlag(alert)}</span>
                  {REFUND_ALERTS.has(alert) && lastRefundable && (
                    <Button
                      className="min-h-11"
                      onClick={() => setDialog({ paymentId: lastRefundable.paymentId, amount: lastRefundable.refundable })}
                    >
                      {alert === "duplicate_payment" ? t.refundExtra : t.refundPayment}
                    </Button>
                  )}
                </div>
              </Alert>
            ))}

            {data.paymentExpiresAt && order.financialState === "pending" && !order.cancelledAt && (
              <p className="text-sm text-ink-soft">{fmt(t.expiresAt, { date: formatDateTime(data.paymentExpiresAt) })}</p>
            )}

            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <Stat label={t.paid} value={money(data.amountPaid)} />
              <Stat label={t.refunded} value={money(data.amountRefunded)} />
              <Stat label={t.pendingRefunds} value={money(data.pendingRefunds)} />
              <Stat label={t.refundable} value={money(data.refundable)} />
            </dl>

            {data.attempts.length === 0 && data.refunds.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.empty}</p>
            ) : (
              <div className="space-y-4">
                {data.attempts.length > 0 && (
                  <AttemptList attempts={data.attempts} money={money} t={t} methodLabel={labels.paymentMethod} />
                )}
                {data.refunds.length > 0 && <RefundList refunds={data.refunds} money={money} t={t} />}
                {data.events.length > 0 && <EventList timeline={data} t={t} />}
              </div>
            )}
          </>
        ) : null}
      </CardContent>

      {dialog && data && (
        <RefundDialog
          order={order}
          timeline={data}
          initial={dialog}
          onClose={() => setDialog(null)}
          onDone={(refund) => {
            setDialog(null);
            const amount = money(refund.amount);
            if (refund.status === "processed") toast.success(fmt(t.refundProcessed, { amount }));
            else if (refund.status === "pending") toast.success(fmt(t.refundPending, { amount }));
            else if (refund.failureCode === REFUND_NO_BALANCE) setError(t.refundNoBalance);
            else setError(fmt(t.refundFailed, { reason: refund.failureReason ?? "" }));
            void timeline.refresh({ silent: true });
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.5rem] bg-paper px-3 py-2">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function AttemptList({
  attempts,
  money,
  t,
  methodLabel,
}: {
  attempts: Payment[];
  money: (n: number | string) => string;
  t: Strings;
  methodLabel: (v: Order["paymentMethod"]) => string;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink">{t.attempts}</h3>
      <ul className="mt-2 divide-y divide-line rounded-[0.5rem] border border-line">
        {attempts.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              {/* A method means a gateway attempt; COD / manual records have none. */}
              {p.method && <ProviderLogo code={p.providerCode} size="sm" />}
              <span className="min-w-0">
                <span className="font-medium text-ink">
                  {p.method
                    ? fmt(t.methodViaGateway, { method: methodLabel(p.method), gateway: providerName(p.providerCode) })
                    : p.providerCode}{" "}
                  · {money(p.amount)}
                </span>
                <span className="block text-xs text-ink-soft">
                  {formatDateTime(p.createdAt)}
                  {p.maskedDisplay && ` · ${p.maskedDisplay}`}
                  {p.failureReason && p.status === "failed" && ` · ${p.failureReason}`}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1">
              {p.mode === "test" && <StatusBadge value="test" tone="warning" text={t.test} />}
              <StatusBadge
                value={p.status}
                tone={ATTEMPT_TONE[p.status] ?? "neutral"}
                text={t[`status_${p.status}` as keyof Strings] ?? p.status}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RefundList({ refunds, money, t }: { refunds: Refund[]; money: (n: number | string) => string; t: Strings }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink">{t.refunds}</h3>
      <ul className="mt-2 divide-y divide-line rounded-[0.5rem] border border-line">
        {refunds.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink">{money(r.amount)}</span>
              <span className="block text-xs text-ink-soft">
                {formatDateTime(r.createdAt)} · {t[`source_${r.source}` as keyof Strings]}
                {r.reason && ` · ${r.reason}`}
                {r.failureCode === REFUND_NO_BALANCE
                  ? ` · ${t.refundNoBalance}`
                  : r.failureReason && ` · ${r.failureReason}`}
              </span>
            </span>
            <StatusBadge value={r.status} tone={REFUND_TONE[r.status]} text={t[`refund_${r.status}` as keyof Strings]} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventList({ timeline, t }: { timeline: PaymentTimeline; t: Strings }) {
  return (
    <details className="rounded-[0.5rem] border border-line px-3 py-2 text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-medium text-ink">
        {t.events} ({timeline.events.length})
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-ink-soft">
        {timeline.events.map((e) => (
          <li key={e.id} dir="auto">
            {formatDateTime(e.createdAt)} · {t[`via_${e.source}` as keyof Strings]} · {e.kind ?? "—"} · {e.outcome ?? e.error ?? "—"}
            {e.providerTransactionId && ` · #${e.providerTransactionId}`}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RefundDialog({
  order,
  timeline,
  initial,
  onClose,
  onDone,
}: {
  order: Order;
  timeline: PaymentTimeline;
  initial: { paymentId?: string; amount?: number };
  onClose: () => void;
  onDone: (refund: Refund) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const money = (n: number | string) => formatMoney(n, order.currency);

  const viaGateway = timeline.refundVia === "gateway";
  const [paymentId, setPaymentId] = useState(initial.paymentId ?? timeline.perPayment[0]?.paymentId ?? "");
  const perPayment = timeline.perPayment.find((p) => p.paymentId === paymentId);
  const max = viaGateway ? Math.min(timeline.refundable, perPayment?.refundable ?? 0) : timeline.refundable;
  const [amount, setAmount] = useState(minorToMajorInput(initial.amount ?? max));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minor = majorToMinor(amount);
  const valid = Number.isFinite(minor) && minor >= 1 && minor <= max;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(fmt(t.amountInvalid, { max: money(max) }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const refund = await apiClient.refundOrder(workspaceId, order.id, {
        amount: minor,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(viaGateway && paymentId ? { paymentId } : {}),
      });
      onDone(refund);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const attempt = (id: string) => timeline.attempts.find((p) => p.id === id);

  return (
    <Modal
      open
      onClose={onClose}
      title={t.refundTitle}
      description={viaGateway ? t.refundGateway : t.refundManual}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        {viaGateway && timeline.perPayment.length > 1 && (
          <Field label={t.fromPayment}>
            {({ id }) => (
              <Select id={id} value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className="h-11">
                {timeline.perPayment.map((p) => {
                  const a = attempt(p.paymentId);
                  return (
                    <option key={p.paymentId} value={p.paymentId}>
                      {fmt(t.paymentOption, {
                        method: a?.method ? labels.paymentMethod(a.method) : a?.providerCode ?? "",
                        amount: money(a?.amount ?? 0),
                        left: money(p.refundable),
                      })}
                    </option>
                  );
                })}
              </Select>
            )}
          </Field>
        )}
        <MoneyInput
          label={t.amount}
          value={amount}
          onChange={setAmount}
          currency={order.currency}
          hint={fmt(t.amountHint, { max: money(max) })}
          required
        />
        <Field label={t.reason}>
          {({ id }) => (
            <Textarea id={id} value={reason} maxLength={300} placeholder={t.reasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy || !valid}>
            {busy ? t.refunding : fmt(t.confirmRefund, { amount: valid ? money(minor) : "" })}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
