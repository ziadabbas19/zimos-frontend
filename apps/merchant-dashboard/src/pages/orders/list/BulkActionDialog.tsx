import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ORDER_STAGES,
  couriersList,
  ordersBulk,
  type CarrierInfo,
  type OrderBulkAction,
  type OrderBulkPayload,
  type OrderBulkResponse,
  type OrderStage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf, pluralOf } from "@/lib/plural";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useOrderLabels } from "../orderLabels";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    a_set_status: "Change status",
    a_add_tag: "Add a tag",
    a_remove_tag: "Remove a tag",
    a_ship: "Book the courier",
    a_archive: "Archive",
    a_unarchive: "Restore from archive",
    a_mark_seen: "Mark as opened",
    a_mark_unseen: "Mark as not opened",
    title: "{action} — {orders}",
    status: "New status",
    reason: "Reason (optional)",
    bulkCourier: "Courier (optional)",
    bulkCourierNone: "— No courier —",
    statusHint: "Orders that can't take this status from where they are stay as they are.",
    tag: "Tag",
    courier: "Courier",
    courierManual: "Another one (type its name)",
    courierName: "Courier name",
    courierHint: "A connected courier books each order; any other name records a manual shipment.",
    confirm_archive: "The orders leave the list and its counts. Nothing is deleted.",
    confirm_generic: "This applies to every selected order.",
    confirm_one: "This applies to this order.",
    cancel: "Cancel",
    apply: "Apply",
    applying: "Working…",
    resultTitle: "Result",
    resultOk: "{orders} updated.",
    failed_one: "1 order could not be updated:",
    failed_other: "{n} orders could not be updated:",
    close: "Close",
  },
  ar: {
    a_set_status: "تغيير الحالة",
    a_add_tag: "إضافة تاج",
    a_remove_tag: "حذف تاج",
    a_ship: "حجز شركة الشحن",
    a_archive: "أرشفة",
    a_unarchive: "استرجاع من الأرشيف",
    a_mark_seen: "تعليم كمفتوح",
    a_mark_unseen: "تعليم كغير مفتوح",
    title: "{action} — {orders}",
    status: "الحالة الجديدة",
    reason: "السبب (اختياري)",
    bulkCourier: "المندوب (اختياري)",
    bulkCourierNone: "— بدون مندوب —",
    statusHint: "الطلبات التي لا تقبل هذه الحالة من وضعها الحالي تبقى كما هي.",
    tag: "التاج",
    courier: "شركة الشحن",
    courierManual: "شركة أخرى (اكتب اسمها)",
    courierName: "اسم شركة الشحن",
    courierHint: "شركة الشحن المربوطة تحجز كل أوردر؛ أي اسم آخر يسجّل شحنة يدوية.",
    confirm_archive: "الطلبات تختفي من القائمة وأعدادها. لا يُحذف شيء.",
    confirm_generic: "سيُطبَّق هذا على كل الطلبات المحددة.",
    confirm_one: "سيُطبَّق هذا على هذا الطلب.",
    cancel: "إلغاء",
    apply: "تطبيق",
    applying: "جارٍ التنفيذ…",
    resultTitle: "النتيجة",
    resultOk: "تم تحديث {orders}.",
    failed_one: "تعذّر تحديث طلب واحد:",
    failed_two: "تعذّر تحديث طلبين:",
    failed_few: "تعذّر تحديث {n} طلبات:",
    failed_other: "تعذّر تحديث {n} طلبًا:",
    close: "إغلاق",
  },
} satisfies Messages;

/** One request for `POST /orders/bulk`: an action over the ticked orders, or over one order from its row's menu. */
export interface BulkRequest {
  /** Changes with every opening, so the form starts clean each time. */
  id: number;
  action: OrderBulkAction;
  orderIds: string[];
  /** One order, from its own row: named in the title instead of a count. */
  orderNumber?: string;
  /** From the ticked rows: the selection is let go once it is done. */
  fromSelection: boolean;
}

/** What was sent, so the caller can offer to take it back. */
export interface BulkSent {
  action: OrderBulkAction;
  orderIds: string[];
  payload: OrderBulkPayload;
}

/** The name of a bulk action, as the bar, its menu and the dialog's title say it. */
export function useBulkActionLabel() {
  const t = useT(STRINGS);
  return (action: OrderBulkAction) => t[`a_${action}`];
}

/**
 * The dialog of a bulk action: it asks for what the action needs — the new
 * status (with a reason, and one of the store's own couriers when the orders
 * go out), a tag, a courier —
 * or says what will happen, then sends `POST /orders/bulk` with the same
 * payloads the list always sent. Choosing a connected courier does not send
 * anything here: it hands over to the batch-ship dialog (`onShipWith`).
 */
export function BulkActionDialog({
  request,
  onClose,
  onApplied,
  onShipWith,
}: {
  request: BulkRequest | null;
  onClose: () => void;
  onApplied: (response: OrderBulkResponse, sent: BulkSent, request: BulkRequest) => void;
  onShipWith: (carrierCode: string, request: BulkRequest) => void;
}) {
  const t = useT(STRINGS);
  // Kept while the dialog closes, so it does not empty on its way out.
  const [shown, setShown] = useState<BulkRequest | null>(request);
  if (request && request !== shown) setShown(request);
  const [busy, setBusy] = useState(false);

  const orders = shown ? (shown.orderNumber ?? countOf("order", shown.orderIds.length)) : "";
  return (
    <Modal
      open={request !== null}
      onClose={() => (busy ? undefined : onClose())}
      title={shown ? fmt(t.title, { action: t[`a_${shown.action}`], orders }) : ""}
    >
      {shown && (
        <BulkActionForm key={shown.id} request={shown} busy={busy} setBusy={setBusy} onClose={onClose} onApplied={onApplied} onShipWith={onShipWith} />
      )}
    </Modal>
  );
}

function BulkActionForm({
  request,
  busy,
  setBusy,
  onClose,
  onApplied,
  onShipWith,
}: {
  request: BulkRequest;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
  onApplied: (response: OrderBulkResponse, sent: BulkSent, request: BulkRequest) => void;
  onShipWith: (carrierCode: string, request: BulkRequest) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const errorMessage = useOrderErrorMessage();
  const { action, orderIds } = request;
  const [status, setStatus] = useState<OrderStage>("ready_to_ship");
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState("");
  // "" is a name typed by hand, and where the form starts: nothing is chosen for the merchant.
  const [courier, setCourier] = useState("");
  const [courierName, setCourierName] = useState("");
  // The store's own couriers (Shipping → Your couriers), for orders sent out together with one of them.
  const storeCouriers = useAsync(
    () => (action === "set_status" ? couriersList(apiClient, workspaceId).then((list) => list.filter((c) => c.active)) : Promise.resolve([])),
    [workspaceId, action]
  );
  const [courierId, setCourierId] = useState("");
  const courierStage = status === "shipped" || status === "out_for_delivery" || status === "delivered";
  const [error, setError] = useState<string | null>(null);

  // Asked for only when a courier is about to be chosen — not on every visit to the list.
  const carriers = useAsync<CarrierInfo[]>(
    () => (action === "ship" ? apiClient.listCarriers(workspaceId).then((r) => r.carriers.filter((c) => c.connection)) : Promise.resolve([])),
    [workspaceId, action]
  );
  // A connected courier ships through a checked, queued batch (BulkShipDialog).
  const connected = carriers.data ?? [];

  function payload(): OrderBulkPayload | null {
    if (action === "set_status") {
      return { status, reason: reason.trim() || undefined, ...(courierStage && courierId ? { courierId } : {}) };
    }
    if (action === "add_tag" || action === "remove_tag") return tag.trim() ? { tags: [tag.trim()] } : null;
    if (action === "ship") {
      const code = courier || courierName.trim();
      return code ? { carrierCode: code } : null;
    }
    return {};
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = payload();
    if (!body) return;
    if (action === "ship" && courier) {
      onShipWith(courier, request);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await ordersBulk(apiClient, workspaceId, { action, orderIds, payload: body });
      onApplied(response, { action, orderIds, payload: body }, request);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      {action === "set_status" && (
        <>
          <Field label={t.status} hint={orderIds.length > 1 ? t.statusHint : undefined}>
            {({ id }) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as OrderStage)} className="h-11">
                {ORDER_STAGES.filter((s) => s !== "awaiting_payment").map((s) => (
                  <option key={s} value={s}>
                    {labels.stage(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {courierStage && (storeCouriers.data ?? []).length > 0 && (
            <Field label={t.bulkCourier}>
              {({ id }) => (
                <Select id={id} value={courierId} onChange={(e) => setCourierId(e.target.value)} className="h-11">
                  <option value="">{t.bulkCourierNone}</option>
                  {(storeCouriers.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <TextField label={t.reason} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </>
      )}

      {(action === "add_tag" || action === "remove_tag") && (
        <Field label={t.tag} required>
          {({ id }) => <Input id={id} value={tag} maxLength={40} autoFocus onChange={(e) => setTag(e.target.value)} className="h-11" />}
        </Field>
      )}

      {action === "ship" && (
        <>
          <Field label={t.courier} hint={t.courierHint}>
            {({ id }) => (
              <Select id={id} value={courier} onChange={(e) => setCourier(e.target.value)} className="h-11">
                {connected.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
                <option value="">{t.courierManual}</option>
              </Select>
            )}
          </Field>
          {!courier && (
            <TextField label={t.courierName} required value={courierName} maxLength={100} onChange={(e) => setCourierName(e.target.value)} />
          )}
        </>
      )}

      {action === "archive" && <p className="text-sm text-ink-soft">{t.confirm_archive}</p>}
      {(action === "unarchive" || action === "mark_seen" || action === "mark_unseen") && (
        <p className="text-sm text-ink-soft">{orderIds.length > 1 ? t.confirm_generic : t.confirm_one}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
        <Button type="submit" className="min-h-11 rounded-full px-5" disabled={busy || payload() === null}>
          {busy ? t.applying : t.apply}
        </Button>
      </div>
    </form>
  );
}

/** What happened to each order, when some could not take the action: their number and why. */
export function BulkResultDialog({ result, onClose }: { result: OrderBulkResponse | null; onClose: () => void }) {
  const t = useT(STRINGS);
  const errorMessage = useOrderErrorMessage();
  // Kept while the dialog closes.
  const [shown, setShown] = useState<OrderBulkResponse | null>(result);
  if (result && result !== shown) setShown(result);
  const failures = shown ? shown.results.filter((r) => !r.ok) : [];

  return (
    <Modal
      open={result !== null}
      onClose={onClose}
      title={t.resultTitle}
      footer={
        <Button className="min-h-11 rounded-full px-5" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {shown && (
        <div className="space-y-3">
          <p className="text-sm text-ink">{fmt(t.resultOk, { orders: countOf("order", shown.succeeded) })}</p>
          {failures.length > 0 && (
            <>
              <p className="text-sm font-medium text-danger">{pluralOf(t, "failed", failures.length)}</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {failures.map((f) => (
                  <li key={f.orderId} className="flex flex-wrap gap-2">
                    <bdi dir="ltr" className="font-medium text-ink">
                      {f.orderNumber ?? f.orderId}
                    </bdi>
                    <span className="text-ink-soft">{errorMessage({ code: f.code, message: f.message })}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
