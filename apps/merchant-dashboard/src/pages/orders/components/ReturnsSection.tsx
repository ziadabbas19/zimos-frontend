import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { Order, ReturnReasonCode, ReturnRequest, ReturnStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, humanize } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";

const REASON_CODES: ReturnReasonCode[] = [
  "damaged",
  "defective",
  "wrong_item",
  "not_as_described",
  "no_longer_wanted",
  "arrived_late",
  "other",
];

const STRINGS = {
  en: {
    title: "Returns",
    loading: "Loading returns…",
    empty: "No returns on this order.",
    restocked: "Restocked {date}",
    approve: "Approve",
    reject: "Reject",
    restock: "Restock units",
    approvedToast: "Return approved.",
    rejectedToast: "Return rejected.",
    restockedToast: "Returned units added back to stock.",
    openedToast: "Return opened.",
    notDelivered: "A return can only be opened once the order has been delivered.",
    openTitle: "Open a return",
    reason: "Reason",
    detail: "Detail",
    detailPlaceholder: "Optional — box crushed in transit",
    items: "Items",
    ordered: "ordered {qty}",
    qtyLabel: "Quantity to return for {name}",
    chooseItems: "Choose at least one item and quantity to return.",
    opening: "Opening…",
    open: "Open return",
    reason_damaged: "Damaged",
    reason_defective: "Defective",
    reason_wrong_item: "Wrong item",
    reason_not_as_described: "Not as described",
    reason_no_longer_wanted: "No longer wanted",
    reason_arrived_late: "Arrived late",
    reason_other: "Other",
    status_requested: "Requested",
    status_approved: "Approved",
    status_rejected: "Rejected",
    status_received: "Received",
    status_refunded: "Refunded",
    listSep: ", ",
  },
  ar: {
    title: "المرتجعات",
    loading: "جارٍ تحميل المرتجعات…",
    empty: "لا توجد مرتجعات على هذا الأوردر.",
    restocked: "أُعيد إلى المخزون {date}",
    approve: "قبول",
    reject: "رفض",
    restock: "إعادة إلى المخزون",
    approvedToast: "تم قبول المرتجع.",
    rejectedToast: "تم رفض المرتجع.",
    restockedToast: "تمت إعادة القطع المرتجعة إلى المخزون.",
    openedToast: "تم فتح المرتجع.",
    notDelivered: "لا يمكن فتح مرتجع إلا بعد تسليم الأوردر.",
    openTitle: "فتح مرتجع",
    reason: "السبب",
    detail: "التفاصيل",
    detailPlaceholder: "اختياري — الكرتونة اتضربت في الشحن",
    items: "العناصر",
    ordered: "المطلوب {qty}",
    qtyLabel: "الكمية المرتجعة من {name}",
    chooseItems: "اختر عنصرًا واحدًا على الأقل وكمية لإرجاعها.",
    opening: "جارٍ الفتح…",
    open: "فتح المرتجع",
    reason_damaged: "تالف",
    reason_defective: "به عيب",
    reason_wrong_item: "منتج خاطئ",
    reason_not_as_described: "مخالف للوصف",
    reason_no_longer_wanted: "لم يعد مطلوبًا",
    reason_arrived_late: "وصل متأخرًا",
    reason_other: "سبب آخر",
    status_requested: "مطلوب",
    status_approved: "مقبول",
    status_rejected: "مرفوض",
    status_received: "مستلم",
    status_refunded: "مسترد",
    listSep: "، ",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

function reasonLabel(reason: string, t: Strings): string {
  // The backend stores "code" or "code: the merchant's own words".
  const at = reason.indexOf(":");
  const code = (at === -1 ? reason : reason.slice(0, at)).trim();
  const detail = at === -1 ? "" : reason.slice(at + 1).trim();
  const key = `reason_${code}` as keyof Strings;
  const label = key in t ? t[key] : humanize(code);
  return detail ? `${label} — ${detail}` : label;
}

function statusLabel(status: ReturnStatus, t: Strings): string {
  const key = `status_${status}` as keyof Strings;
  return key in t ? t[key] : humanize(status);
}

interface Props {
  order: Order;
  onOrderMaybeChanged: () => void;
}

export function ReturnsSection({ order, onOrderMaybeChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const returns = useAsync(() => apiClient.listOrderReturns(workspaceId, order.id), [workspaceId, order.id]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const delivered =
    order.fulfillmentState === "fulfilled" || (order.shipments ?? []).some((s) => s.status === "delivered");

  const itemName = (orderItemId: string) => {
    const oi = order.items.find((i) => i.id === orderItemId);
    return oi ? oi.productNameSnapshot : orderItemId.slice(0, 8);
  };

  async function moderate(ret: ReturnRequest, action: "approve" | "reject") {
    setBusyId(ret.id);
    try {
      await apiClient.moderateReturn(workspaceId, ret.id, action);
      toast.success(action === "approve" ? t.approvedToast : t.rejectedToast);
      returns.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function restock(ret: ReturnRequest) {
    setBusyId(ret.id);
    try {
      await apiClient.restockReturn(workspaceId, ret.id);
      toast.success(t.restockedToast);
      returns.refresh({ silent: true });
      onOrderMaybeChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const list = returns.data ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 font-display text-lg font-medium text-ink">{t.title}</h2>

        {returns.loading ? (
          <div role="status" className="flex items-center gap-2 text-sm text-ink-soft">
            <Spinner className="size-5" role="presentation" aria-hidden="true" aria-label={undefined} />
            {t.loading}
          </div>
        ) : returns.error ? (
          <Alert variant="danger">{errorMessage(returns.error)}</Alert>
        ) : list.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            {t.empty}
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((ret) => (
              <li key={ret.id} className="rounded-[0.5rem] border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ink">{reasonLabel(ret.reason, t)}</span>
                  <StatusBadge value={ret.status} text={statusLabel(ret.status, t)} />
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {ret.items.map((it) => `${it.quantity}× ${itemName(it.orderItemId)}`).join(t.listSep)}
                  {ret.restockedAt && (
                    <span> · {fmt(t.restocked, { date: formatDateTime(ret.restockedAt) })}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ret.status === "requested" && (
                    <>
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() => moderate(ret, "approve")}
                        disabled={busyId === ret.id}
                      >
                        {t.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => moderate(ret, "reject")}
                        disabled={busyId === ret.id}
                      >
                        {t.reject}
                      </Button>
                    </>
                  )}
                  {ret.status === "approved" && !ret.restockedAt && (
                    <Button size="sm" className="min-h-11" onClick={() => restock(ret)} disabled={busyId === ret.id}>
                      {t.restock}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {delivered ? (
          <NewReturnForm
            order={order}
            onDone={() => {
              toast.success(t.openedToast);
              returns.refresh({ silent: true });
            }}
          />
        ) : (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{t.notDelivered}</p>
        )}
      </CardContent>
    </Card>
  );
}

function NewReturnForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("damaged");
  const [reasonDetail, setReasonDetail] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const items = order.items
      .map((it) => ({ orderItemId: it.id, quantity: Math.floor(Number(qty[it.id] ?? "0") || 0) }))
      .filter((l) => l.quantity > 0);
    if (items.length === 0) {
      setFormError(t.chooseItems);
      return;
    }
    setSaving(true);
    try {
      await apiClient.createReturn(workspaceId, order.id, {
        reasonCode,
        reasonDetail: reasonDetail.trim() || undefined,
        items,
      });
      setQty({});
      setReasonDetail("");
      onDone();
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-line pt-4" noValidate>
      <h3 className="text-sm font-medium text-ink">{t.openTitle}</h3>
      {formError && (
        <Alert variant="danger" role="alert">
          {formError}
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.reason} error={fieldErrors.reasonCode}>
          {({ id }) => (
            <Select id={id} value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}>
              {REASON_CODES.map((r) => (
                <option key={r} value={r}>
                  {t[`reason_${r}` as keyof Strings]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label={t.detail} error={fieldErrors.reasonDetail}>
        {({ id }) => (
          <Textarea
            id={id}
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder={t.detailPlaceholder}
          />
        )}
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-soft">{t.items}</legend>
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 text-sm">
            <span className="flex-1 text-ink">
              {it.productNameSnapshot}
              <span className="text-ink-soft"> ({fmt(t.ordered, { qty: it.quantity })})</span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={it.quantity}
              value={qty[it.id] ?? ""}
              onChange={(e) => setQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
              placeholder="0"
              aria-label={fmt(t.qtyLabel, { name: it.productNameSnapshot })}
              className="h-11 w-20 rounded-[0.5rem] border border-line bg-paper-raised px-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>
        ))}
        {fieldErrors["items.quantity"] && (
          <p className="text-xs font-medium text-danger">{fieldErrors["items.quantity"]}</p>
        )}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" size="sm" className="min-h-11" disabled={saving}>
          {saving ? t.opening : t.open}
        </Button>
      </div>
    </form>
  );
}
