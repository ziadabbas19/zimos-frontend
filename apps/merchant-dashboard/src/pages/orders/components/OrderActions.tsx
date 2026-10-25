import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, isApiErrorCode, ordersCancelWithOptions, type Order, type UpdateOrderPayload } from "@store-builder/api-client";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { MoneyInput } from "@/components/MoneyInput";
import { NotifyCustomerToggle } from "./NotifyCustomerToggle";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { isCarrierBooked } from "@/pages/shipping/carriers";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";
import { formValue, isLockedOrder } from "@/components/OrdersLock";

const SHIPPED_STATES = ["fulfilled", "partially_fulfilled", "returned"];

const CANCEL_REASON_KINDS = ["customer", "fake", "duplicate", "stock", "other"] as const;
type CancelReasonKind = (typeof CANCEL_REASON_KINDS)[number];

const STRINGS = {
  en: {
    editAddress: "Edit address / notes",
    preparing: "Preparing…",
    downloadWaybill: "Download waybill",
    cancelOrder: "Cancel order",
    cancelled: "Cancelled",
    shippedNote: "Shipped — cancel and edit are disabled; open a return instead.",
    cancelTitle: "Cancel {number}?",
    cancelDescription:
      "Releases the stock reservation and marks the confirmation as rejected. A paid order can be refunded here too.",
    cancelConfirm: "Cancel this order",
    keepOrder: "Keep order",
    working: "Working…",
    reason: "Details",
    reasonKind: "Reason",
    reason_customer: "Customer cancelled",
    reason_fake: "Fake order",
    reason_duplicate: "Duplicate order",
    reason_stock: "Out of stock",
    reason_other: "Other",
    reasonPlaceholder: "Customer changed their mind",
    reasonRequired: "Enter a reason for the cancellation.",
    cancelledToast: "Order cancelled. The stock reservation has been released.",
    refundOnCancel: "Refund {amount} the customer paid",
    refundAmount: "Amount to refund",
    refundInvalid: "Enter an amount between 0.01 and {max}.",
    refundFailed: "The order is cancelled, but the refund failed: {reason} Refund it from the payments card.",
    courierCancelNote:
      "This order has a courier delivery that hasn't been collected or is marked Failed. It's cancelled with the courier first; if the courier refuses, nothing is cancelled and the order stays active.",
    notCancelled: "Nothing was cancelled: the order is still active.",
    editTitle: "Edit {number}",
    updatedToast: "Order updated.",
    editNote: "Only the shipping address and internal notes can be edited. Totals aren't re-priced.",
    country: "Country (2-letter code)",
    city: "City / area",
    province: "Governorate",
    postalCode: "Postal code",
    addressLine: "Address",
    internalNotes: "Internal notes",
    cancel: "Cancel",
    saving: "Saving…",
    saveChanges: "Save changes",
  },
  ar: {
    editAddress: "تعديل العنوان / الملاحظات",
    preparing: "جارٍ التجهيز…",
    downloadWaybill: "تحميل بوليصة الشحن",
    cancelOrder: "إلغاء الأوردر",
    cancelled: "ملغي",
    shippedNote: "تم الشحن — الإلغاء والتعديل غير متاحين؛ افتح مرتجعًا بدلًا من ذلك.",
    cancelTitle: "إلغاء {number}؟",
    cancelDescription:
      "يحرر حجز المخزون ويعلّم التأكيد كمرفوض. يمكن استرداد قيمة الأوردر المدفوع هنا أيضًا.",
    cancelConfirm: "إلغاء هذا الأوردر",
    keepOrder: "الإبقاء على الأوردر",
    working: "جارٍ التنفيذ…",
    reason: "التفاصيل",
    reasonKind: "السبب",
    reason_customer: "العميل ألغى",
    reason_fake: "أوردر وهمي",
    reason_duplicate: "أوردر مكرر",
    reason_stock: "المنتج غير متوفر",
    reason_other: "سبب آخر",
    reasonPlaceholder: "العميل غيّر رأيه",
    reasonRequired: "أدخل سبب الإلغاء.",
    cancelledToast: "تم إلغاء الأوردر وتحرير حجز المخزون.",
    refundOnCancel: "رد {amount} دفعها العميل",
    refundAmount: "المبلغ المسترد",
    refundInvalid: "أدخل مبلغًا بين 0.01 و{max}.",
    refundFailed: "تم إلغاء الطلب، لكن الاسترداد فشل: {reason} استرده من بطاقة المدفوعات.",
    courierCancelNote:
      "لهذا الأوردر شحنة مع شركة شحن لم تُستلم بعد أو حالتها «فشل». سيتم إلغاؤها لدى الشركة أولًا؛ وإذا رفضت الشركة، فلن يُلغى أي شيء ويبقى الأوردر نشطًا.",
    notCancelled: "لم يتم إلغاء أي شيء: الأوردر ما زال نشطًا.",
    editTitle: "تعديل {number}",
    updatedToast: "تم تحديث الأوردر.",
    editNote: "يمكن تعديل عنوان الشحن والملاحظات الداخلية فقط. لا يُعاد حساب الإجماليات.",
    country: "الدولة (رمز من حرفين)",
    city: "المدينة / المنطقة",
    province: "المحافظة",
    postalCode: "الرمز البريدي",
    addressLine: "العنوان",
    internalNotes: "ملاحظات داخلية",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    saveChanges: "حفظ التغييرات",
  },
} satisfies Messages;

interface Props {
  order: Order;
  onChanged: () => void;
}

export function OrderActions({ order, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  // SPEC §4.4: the reason is picked from a list; "other" needs the details typed.
  const [reasonKind, setReasonKind] = useState<CancelReasonKind>("customer");
  const [editing, setEditing] = useState(false);
  const [waybillBusy, setWaybillBusy] = useState(false);
  const manualCancelPrompt = useManualCancelPrompt();
  // SPEC §4.4 cancellation options: give the money back, tell the customer.
  const refundable = Math.max(0, Number(order.amountPaid) - Number(order.amountRefunded));
  const [notify, setNotify] = useState(true);
  const [giveBack, setGiveBack] = useState(false);
  const [refundAmount, setRefundAmount] = useState(minorToMajorInput(refundable));

  const isCancelled = Boolean(order.cancelledAt);
  const isShipped = SHIPPED_STATES.includes(order.fulfillmentState);
  const canCancel = !isCancelled && !isShipped;
  // A locked order's details come hidden: no form that would write "••••" over them.
  const canEdit = !isCancelled && !isShipped && !isLockedOrder(order);
  // The backend cancels 'created' and 'failed' courier deliveries at the
  // courier first (cancelCarrierShipmentsForOrder), all-or-nothing.
  const courierToCancel = (order.shipments ?? []).some(
    (s) => isCarrierBooked(s) && (s.status === "created" || s.status === "failed"),
  );

  /** Throws a translated Error (ConfirmDialog and the manual-cancel dialog show it as-is). */
  async function cancel(cancelReason: string, acknowledgeManualCancel: boolean) {
    try {
      const result = await ordersCancelWithOptions(apiClient, workspaceId, order.id, {
        reason: cancelReason,
        acknowledgeManualCancel,
        notifyCustomer: notify,
        ...(giveBack && refundable > 0 ? { refundAmount: majorToMinor(refundAmount) } : {}),
      });
      if (result.refundError) toast.error(fmt(t.refundFailed, { reason: errorMessage(result.refundError) }));
    } catch (err) {
      if (isApiErrorCode(err, "CARRIER_CANCEL_FAILED")) {
        // The whole cancellation rolled back. Refresh anyway: a rejected key
        // is marked invalid on the courier account even so.
        onChanged();
        throw new Error(`${t.notCancelled} ${errorMessage(err)}`);
      }
      throw err;
    }
    toast.success(t.cancelledToast);
    setCancelling(false);
    setReason("");
    onChanged();
  }

  async function confirmCancel() {
    const details = reason.trim();
    if (reasonKind === "other" && details.length === 0) throw new Error(t.reasonRequired);
    if (giveBack && refundable > 0) {
      const minor = majorToMinor(refundAmount);
      if (!Number.isFinite(minor) || minor < 1 || minor > refundable) {
        throw new Error(fmt(t.refundInvalid, { max: formatMoney(refundable, order.currency) }));
      }
    }
    const cancelReason =
      reasonKind === "other" ? details : details ? `${t[`reason_${reasonKind}`]} — ${details}`.slice(0, 500) : t[`reason_${reasonKind}`];
    try {
      await cancel(cancelReason, false);
    } catch (err) {
      // A courier without a cancel API: nothing changed yet. The merchant
      // cancels the booking in the courier's dashboard, confirms, and the
      // same cancellation is sent again with the acknowledgement.
      const offered = manualCancelPrompt.offer(err, async () => {
        try {
          await cancel(cancelReason, true);
        } catch (retryErr) {
          throw retryErr instanceof ApiError ? new Error(errorMessage(retryErr)) : retryErr;
        }
      });
      if (offered) {
        setCancelling(false);
        return;
      }
      throw err instanceof ApiError ? new Error(errorMessage(err)) : err;
    }
  }

  async function downloadWaybill() {
    setWaybillBusy(true);
    try {
      const blob = await apiClient.getWaybillPdf(workspaceId, order.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setWaybillBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => setEditing(true)}>
          {t.editAddress}
        </Button>
      )}
      <Button variant="outline" size="sm" className="min-h-11" onClick={downloadWaybill} disabled={waybillBusy}>
        {waybillBusy ? t.preparing : t.downloadWaybill}
      </Button>
      {canCancel && (
        <Button
          variant="danger"
          size="sm"
          className="min-h-11"
          onClick={() => {
            setReason("");
            setCancelling(true);
          }}
        >
          {t.cancelOrder}
        </Button>
      )}
      {isCancelled && (
        <span className="text-sm text-danger">
          {t.cancelled}
          {order.cancellationReason ? ` — ${order.cancellationReason}` : ""}
        </span>
      )}
      {!isCancelled && isShipped && <span className="text-sm text-ink-soft">{t.shippedNote}</span>}

      <ConfirmDialog
        open={cancelling}
        title={fmt(t.cancelTitle, { number: order.orderNumber })}
        description={t.cancelDescription}
        confirmLabel={t.cancelConfirm}
        cancelLabel={t.keepOrder}
        busyLabel={t.working}
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={confirmCancel}
      >
        <Field label={t.reasonKind} className="mb-3">
          {({ id }) => (
            <Select
              id={id}
              value={reasonKind}
              onChange={(e) => setReasonKind(e.target.value as CancelReasonKind)}
              className="h-11"
            >
              {CANCEL_REASON_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t[`reason_${kind}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <TextField
          label={t.reason}
          required={reasonKind === "other"}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.reasonPlaceholder}
        />
        {refundable > 0 && (
          <div className="mt-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-primary" checked={giveBack} onChange={(e) => setGiveBack(e.target.checked)} />
              {fmt(t.refundOnCancel, { amount: formatMoney(refundable, order.currency) })}
            </label>
            {giveBack && (
              <MoneyInput label={t.refundAmount} value={refundAmount} onChange={setRefundAmount} currency={order.currency} />
            )}
          </div>
        )}
        <NotifyCustomerToggle checked={notify} onChange={setNotify} />
        {courierToCancel && <p className="mt-3 text-sm text-ink-soft">{t.courierCancelNote}</p>}
      </ConfirmDialog>

      {manualCancelPrompt.dialog}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={fmt(t.editTitle, { number: order.orderNumber })}
      >
        <EditOrderForm
          order={order}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            toast.success(t.updatedToast);
            onChanged();
          }}
        />
      </Modal>
    </div>
  );
}

function EditOrderForm({
  order,
  onDone,
  onCancel,
}: {
  order: Order;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const addr = order.shippingAddressSnapshot ?? {};
  const [country, setCountry] = useState(addr.country ?? "EG");
  const [city, setCity] = useState(formValue(addr.city));
  const [province, setProvince] = useState(formValue(addr.province));
  const [addressLine, setAddressLine] = useState(formValue(addr.addressLine));
  const [postalCode, setPostalCode] = useState(formValue(addr.postalCode));
  const [notes, setNotes] = useState(formValue(order.notes));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: UpdateOrderPayload = { notes: notes.trim() };
    if (addressLine.trim() && city.trim() && country.trim()) {
      payload.shippingAddress = {
        country: country.trim().toUpperCase(),
        city: city.trim(),
        addressLine: addressLine.trim(),
        province: province.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        // Keep the shopper's delivery note — the backend replaces the whole
        // address snapshot, and this form doesn't edit it.
        notes: addr.notes || undefined,
      };
    }
    try {
      await apiClient.updateOrder(workspaceId, order.id, payload);
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {formError && (
        <Alert variant="danger" role="alert">
          {formError}
        </Alert>
      )}
      <p className="text-sm text-ink-soft">{t.editNote}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.country}
          value={country}
          maxLength={2}
          dir="ltr"
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors["shippingAddress.country"]}
        />
        <TextField
          label={t.province}
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          error={fieldErrors["shippingAddress.province"]}
        />
        <TextField
          label={t.city}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors["shippingAddress.city"]}
        />
        <TextField
          label={t.postalCode}
          value={postalCode}
          maxLength={20}
          dir="ltr"
          onChange={(e) => setPostalCode(e.target.value)}
          error={fieldErrors["shippingAddress.postalCode"]}
        />
      </div>
      <TextField
        label={t.addressLine}
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        error={fieldErrors["shippingAddress.addressLine"]}
      />
      <Field label={t.internalNotes} error={fieldErrors.notes}>
        {({ id }) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
        <Button type="submit" className="min-h-11" disabled={saving}>
          {saving ? t.saving : t.saveChanges}
        </Button>
      </div>
    </form>
  );
}
