import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import type { Shipment, ShipmentStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatDateTime, humanize } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";

const STATUSES: ShipmentStatus[] = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

interface Props {
  orderId: string;
  shipments: Shipment[];
  orderCancelled: boolean;
  onChanged: () => void;
}

export function ShipmentsSection({ orderId, shipments, orderCancelled, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [carrierCode, setCarrierCode] = useState("manual");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function updateStatus(shipment: Shipment, status: ShipmentStatus) {
    setBusyId(shipment.id);
    try {
      await apiClient.updateShipment(workspaceId, orderId, shipment.id, { status });
      toast.success(`Shipment marked "${humanize(status)}".`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await apiClient.createShipment(workspaceId, orderId, {
        carrierCode: carrierCode.trim() || "manual",
        waybillNumber: waybillNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
      });
      toast.success("Shipment created.");
      setWaybillNumber("");
      setTrackingUrl("");
      onChanged();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 font-display text-lg font-medium text-ink">Shipments</h2>

        {shipments.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No shipments yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {shipments.map((s) => (
              <li key={s.id} className="rounded-[0.5rem] border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-ink">{s.trackingCode}</span>
                    <span className="ml-2 text-sm text-ink-soft">via {s.carrierCode}</span>
                  </div>
                  <StatusBadge value={s.status} />
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {s.waybillNumber && <span>Waybill {s.waybillNumber} · </span>}
                  {s.trackingUrl && (
                    <a
                      href={s.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Track
                    </a>
                  )}
                  {s.shippedAt && <span> · Shipped {formatDateTime(s.shippedAt)}</span>}
                  {s.deliveredAt && <span> · Delivered {formatDateTime(s.deliveredAt)}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-ink-soft">Set status</span>
                  <Select
                    value={s.status}
                    disabled={busyId === s.id}
                    onChange={(e) => updateStatus(s, e.target.value as ShipmentStatus)}
                    className="h-8 w-48 text-[13px]"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {humanize(st)}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}

        {orderCancelled ? (
          <p className="mt-4 text-sm text-ink-soft">Order is cancelled — no new shipments.</p>
        ) : (
          <form onSubmit={create} className="mt-4 space-y-3 border-t border-line pt-4">
            <h3 className="text-sm font-medium text-ink">Add a shipment</h3>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="Carrier"
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                error={fieldErrors.carrierCode}
              />
              <TextField
                label="Waybill #"
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                error={fieldErrors.waybillNumber}
              />
              <TextField
                label="Tracking URL"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                error={fieldErrors.trackingUrl}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? "Creating…" : "Create shipment"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
