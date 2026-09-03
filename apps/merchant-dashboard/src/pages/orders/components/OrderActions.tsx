import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { Order, UpdateOrderPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";

const SHIPPED_STATES = ["fulfilled", "partially_fulfilled", "returned"];

interface Props {
  order: Order;
  onChanged: () => void;
}

export function OrderActions({ order, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [waybillBusy, setWaybillBusy] = useState(false);

  const isCancelled = Boolean(order.cancelledAt);
  const isShipped = SHIPPED_STATES.includes(order.fulfillmentState);
  const canCancel = !isCancelled && !isShipped;
  const canEdit = !isCancelled && !isShipped;

  async function confirmCancel() {
    if (reason.trim().length === 0) throw new Error("Enter a reason for the cancellation.");
    await apiClient.cancelOrder(workspaceId, order.id, reason.trim());
    toast.success("Order cancelled. The stock reservation has been released.");
    setCancelling(false);
    setReason("");
    onChanged();
  }

  async function downloadWaybill() {
    setWaybillBusy(true);
    try {
      const blob = await apiClient.getWaybillPdf(workspaceId, order.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWaybillBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit address / notes
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={downloadWaybill} disabled={waybillBusy}>
        {waybillBusy ? "Preparing…" : "Download waybill"}
      </Button>
      {canCancel && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setReason("");
            setCancelling(true);
          }}
        >
          Cancel order
        </Button>
      )}
      {isCancelled && (
        <span className="text-sm text-danger">
          Cancelled{order.cancellationReason ? ` — ${order.cancellationReason}` : ""}
        </span>
      )}
      {!isCancelled && isShipped && (
        <span className="text-sm text-ink-soft">
          Shipped — cancel/edit are disabled; open a return instead.
        </span>
      )}

      <ConfirmDialog
        open={cancelling}
        title={`Cancel ${order.orderNumber}?`}
        description="Releases the inventory reservation and moves confirmation to “rejected”. Refunding a paid order is a separate step."
        confirmLabel="Cancel this order"
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={confirmCancel}
      >
        <TextField
          label="Reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer changed their mind"
        />
      </ConfirmDialog>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${order.orderNumber}`}>
        <EditOrderForm
          order={order}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            toast.success("Order updated.");
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
      };
    }
    try {
      await apiClient.updateOrder(workspaceId, order.id, payload);
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <p className="text-sm text-ink-soft">
        Only the shipping address and internal notes are editable. Totals aren't re-priced.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Country (2-letter)"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors["shippingAddress.country"]}
        />
        <TextField
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors["shippingAddress.city"]}
        />
        <TextField
          label="Province"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          error={fieldErrors["shippingAddress.province"]}
        />
        <TextField
          label="Postal code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          error={fieldErrors["shippingAddress.postalCode"]}
        />
      </div>
      <TextField
        label="Address line"
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        error={fieldErrors["shippingAddress.addressLine"]}
      />
      <Field label="Internal notes" error={fieldErrors.notes}>
        {({ id }) => (
          <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
