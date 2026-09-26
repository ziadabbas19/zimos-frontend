import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, isApiErrorCode, type Order, type UpdateOrderPayload } from "@store-builder/api-client";
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
import { isCarrierBooked } from "@/pages/shipping/carriers";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";

const SHIPPED_STATES = ["fulfilled", "partially_fulfilled", "returned"];

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
      "Releases the stock reservation and marks the confirmation as rejected. Refunding a paid order is a separate step.",
    cancelConfirm: "Cancel this order",
    keepOrder: "Keep order",
    working: "Working…",
    reason: "Reason",
    reasonPlaceholder: "Customer changed their mind",
    reasonRequired: "Enter a reason for the cancellation.",
    cancelledToast: "Order cancelled. The stock reservation has been released.",
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
      "يحرر حجز المخزون ويعلّم التأكيد كمرفوض. استرداد قيمة أوردر مدفوع خطوة منفصلة.",
    cancelConfirm: "إلغاء هذا الأوردر",
    keepOrder: "الإبقاء على الأوردر",
    working: "جارٍ التنفيذ…",
    reason: "السبب",
    reasonPlaceholder: "العميل غيّر رأيه",
    reasonRequired: "أدخل سبب الإلغاء.",
    cancelledToast: "تم إلغاء الأوردر وتحرير حجز المخزون.",
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
  const [editing, setEditing] = useState(false);
  const [waybillBusy, setWaybillBusy] = useState(false);
  const manualCancelPrompt = useManualCancelPrompt();

  const isCancelled = Boolean(order.cancelledAt);
  const isShipped = SHIPPED_STATES.includes(order.fulfillmentState);
  const canCancel = !isCancelled && !isShipped;
  const canEdit = !isCancelled && !isShipped;
  // The backend cancels 'created' and 'failed' courier deliveries at the
  // courier first (cancelCarrierShipmentsForOrder), all-or-nothing.
  const courierToCancel = (order.shipments ?? []).some(
    (s) => isCarrierBooked(s) && (s.status === "created" || s.status === "failed"),
  );

  /** Throws a translated Error (ConfirmDialog and the manual-cancel dialog show it as-is). */
  async function cancel(cancelReason: string, acknowledgeManualCancel: boolean) {
    try {
      await apiClient.cancelOrder(workspaceId, order.id, cancelReason, { acknowledgeManualCancel });
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
    const cancelReason = reason.trim();
    if (cancelReason.length === 0) throw new Error(t.reasonRequired);
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
        <TextField
          label={t.reason}
          required
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.reasonPlaceholder}
        />
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
  const [city, setCity] = useState(addr.city ?? "");
  const [province, setProvince] = useState(addr.province ?? "");
  const [addressLine, setAddressLine] = useState(addr.addressLine ?? "");
  const [postalCode, setPostalCode] = useState(addr.postalCode ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");

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
