import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { Order, ReturnReasonCode, ReturnRequest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatDateTime, humanize } from "@/lib/format";
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

interface Props {
  order: Order;
  onOrderMaybeChanged: () => void;
}

export function ReturnsSection({ order, onOrderMaybeChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const returns = useAsync(
    () => apiClient.listOrderReturns(workspaceId, order.id),
    [workspaceId, order.id]
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const delivered =
    order.fulfillmentState === "fulfilled" ||
    (order.shipments ?? []).some((s) => s.status === "delivered");

  const itemName = (orderItemId: string) => {
    const oi = order.items.find((i) => i.id === orderItemId);
    return oi ? oi.productNameSnapshot : orderItemId.slice(0, 8);
  };

  async function moderate(ret: ReturnRequest, action: "approve" | "reject") {
    setBusyId(ret.id);
    try {
      await apiClient.moderateReturn(workspaceId, ret.id, action);
      toast.success(`Return ${action === "approve" ? "approved" : "rejected"}.`);
      returns.refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function restock(ret: ReturnRequest) {
    setBusyId(ret.id);
    try {
      await apiClient.restockReturn(workspaceId, ret.id);
      toast.success("Returned units added back to stock.");
      returns.refresh({ silent: true });
      onOrderMaybeChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const list = returns.data ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 font-display text-lg font-medium text-ink">Returns</h2>

        {returns.loading ? (
          <Spinner className="size-5" />
        ) : returns.error ? (
          <Alert variant="danger">{getErrorMessage(returns.error)}</Alert>
        ) : list.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No returns on this order.
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((ret) => (
              <li key={ret.id} className="rounded-[0.5rem] border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ink">{humanize(ret.reason)}</span>
                  <StatusBadge value={ret.status} />
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {ret.items
                    .map((it) => `${it.quantity}× ${itemName(it.orderItemId)}`)
                    .join(", ")}
                  {ret.restockedAt && <span> · Restocked {formatDateTime(ret.restockedAt)}</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  {ret.status === "requested" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => moderate(ret, "approve")}
                        disabled={busyId === ret.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moderate(ret, "reject")}
                        disabled={busyId === ret.id}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {ret.status === "approved" && !ret.restockedAt && (
                    <Button size="sm" onClick={() => restock(ret)} disabled={busyId === ret.id}>
                      Restock units
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
              toast.success("Return opened.");
              returns.refresh({ silent: true });
            }}
          />
        ) : (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">
            A return can only be opened once the order has been delivered.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NewReturnForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const workspaceId = useWorkspaceId();
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
      setFormError("Choose at least one item and quantity to return.");
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
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-ink">Open a return</h3>
      {formError && <Alert variant="danger">{formError}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Reason" error={fieldErrors.reasonCode}>
          {({ id }) => (
            <Select
              id={id}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
            >
              {REASON_CODES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Detail" error={fieldErrors.reasonDetail}>
        {({ id }) => (
          <Textarea
            id={id}
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="Optional — box crushed in transit"
          />
        )}
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium text-ink-soft">Items</span>
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 text-sm">
            <span className="flex-1 text-ink">
              {it.productNameSnapshot}
              <span className="text-ink-soft"> (ordered {it.quantity})</span>
            </span>
            <input
              type="number"
              min={0}
              max={it.quantity}
              value={qty[it.id] ?? ""}
              onChange={(e) => setQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
              placeholder="0"
              className="h-9 w-20 rounded-[0.5rem] border border-line bg-paper-raised px-2 text-sm"
            />
          </div>
        ))}
        {fieldErrors["items.quantity"] && (
          <p className="text-xs font-medium text-danger">{fieldErrors["items.quantity"]}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Opening…" : "Open return"}
        </Button>
      </div>
    </form>
  );
}
