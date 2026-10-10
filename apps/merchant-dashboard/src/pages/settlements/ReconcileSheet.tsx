import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { SettlementLinePayload, UnsettledCarrier, UnsettledOrder } from "@store-builder/api-client";
import { EmptyState } from "@/components/EmptyState";
import { IconCourier } from "@/components/icons";
import { FilterChoice } from "@/components/list";
import { Modal } from "@/components/Modal";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { formatDate, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { AmountInput, focusField } from "@/pages/profit/CostFields";
import { SETTLEMENT_STRINGS, settlementErrorText } from "./settlementStrings";

/** Per-order editor state. Amounts are major-unit text, as typed. */
/** A delivered parcel of an order sent as several (`partial: true` on GET /settlements/unsettled). */
function isParcelRow(order: UnsettledOrder): boolean {
  return (order as UnsettledOrder & { partial?: boolean }).partial === true && Boolean(order.shipmentId);
}

/** One row per order, or per parcel of a split order: two parcels of one order must not share a row. */
function rowKey(order: UnsettledOrder): string {
  return isParcelRow(order) ? `${order.orderId}:${order.shipmentId}` : order.orderId;
}

interface RowDraft {
  checked: boolean;
  collected: string;
  fee: string;
}

interface RowErrors {
  collected?: string;
  fee?: string;
}

/**
 * «سجّل تحويل»: the orders a courier paid for, in a sheet over the page. Tick
 * the orders, fix an amount where the courier paid less, type its fee (one
 * figure can be put on every ticked order), and save a draft settlement —
 * `POST /settlements` with the same lines the page always sent.
 *
 * The amount and the fee of an order show once it is ticked, so a courier
 * with fifty orders is a list to tick, not a hundred fields. What is wrong is
 * said under its own field, and the first such field is brought into view.
 *
 * A `Modal`: the same pane as a sheet (a bottom sheet on the phone), which
 * also asks before ticks and amounts are thrown away by a stray tap outside.
 */
export function ReconcileSheet({
  open,
  onClose,
  carriers,
  orders,
  initialCarrier,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** The couriers with orders to settle. */
  carriers: ReadonlyArray<UnsettledCarrier>;
  orders: ReadonlyArray<UnsettledOrder>;
  /** The courier whose row was pressed; null when the sheet was opened from the header. */
  initialCarrier: string | null;
  /** Saves the draft. Resolve to close; throw to stay open with the reason. */
  onCreate: (carrierCode: string, lines: SettlementLinePayload[]) => Promise<void>;
}) {
  const t = useT(SETTLEMENT_STRINGS);
  const common = useCommon();
  const formId = useId();
  const [carrier, setCarrier] = useState("");
  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const [quickFee, setQuickFee] = useState("");
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const onlyCarrier = carriers.length === 1 ? carriers[0]?.carrierCode : undefined;
  // The sheet opens clean: ticks left behind by Cancel never come back.
  useEffect(() => {
    if (!open) return;
    setCarrier(initialCarrier ?? onlyCarrier ?? "");
    setRows({});
    setQuickFee("");
    setErrors({});
    setFailure(null);
  }, [open, initialCarrier, onlyCarrier]);

  const group = orders.filter((order) => order.carrierCode === carrier);
  const rowOf = (order: UnsettledOrder): RowDraft =>
    rows[rowKey(order)] ?? { checked: false, collected: minorToMajorInput(order.dueAmount), fee: "" };
  const selected = group.filter((order) => rowOf(order).checked);
  const allChecked = group.length > 0 && selected.length === group.length;
  // The API records one currency per settlement, taken from its orders.
  const currency = group[0]?.currency ?? orders[0]?.currency ?? "EGP";
  const collectedId = (orderId: string) => `${formId}-c-${orderId}`;
  const feeId = (orderId: string) => `${formId}-f-${orderId}`;
  const quickFeeId = `${formId}-quick`;

  function patchRow(order: UnsettledOrder, patch: Partial<RowDraft>) {
    setRows((prev) => ({
      ...prev,
      [rowKey(order)]: { ...(prev[rowKey(order)] ?? { checked: false, collected: minorToMajorInput(order.dueAmount), fee: "" }), ...patch },
    }));
    if (errors[rowKey(order)]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[rowKey(order)];
        return next;
      });
    }
  }

  function checkAll(checked: boolean) {
    setRows((prev) => {
      const next = { ...prev };
      for (const order of group) {
        next[rowKey(order)] = { ...(prev[rowKey(order)] ?? { checked: false, collected: minorToMajorInput(order.dueAmount), fee: "" }), checked };
      }
      return next;
    });
  }

  function applyFee() {
    setRows((prev) => {
      const next = { ...prev };
      for (const order of group) {
        const row = prev[rowKey(order)];
        if (row?.checked) next[rowKey(order)] = { ...row, fee: quickFee };
      }
      return next;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || selected.length === 0) return;
    const lines: SettlementLinePayload[] = [];
    const found: Record<string, RowErrors> = {};
    let firstWrong: string | null = null;
    for (const order of selected) {
      const row = rowOf(order);
      const collected = majorToMinor(row.collected);
      const fee = row.fee.trim() === "" ? 0 : majorToMinor(row.fee);
      const wrong: RowErrors = {};
      if (!Number.isFinite(collected) || collected < 0) wrong.collected = t.invalidAmount;
      // Checked here too: the server's refusal names an order id, not a number.
      else if (collected > order.dueAmount) wrong.collected = fmt(t.exceedsDue, { due: formatMoney(order.dueAmount, order.currency) });
      if (!Number.isFinite(fee) || fee < 0) wrong.fee = t.invalidFee;
      if (wrong.collected || wrong.fee) {
        found[rowKey(order)] = wrong;
        firstWrong ??= wrong.collected ? collectedId(rowKey(order)) : feeId(rowKey(order));
        continue;
      }
      // A parcel of a split order is settled by its own shipment.
      lines.push({ orderId: order.orderId, ...(isParcelRow(order) ? { shipmentId: order.shipmentId } : {}), collectedAmount: collected, feeAmount: fee } as SettlementLinePayload);
    }
    setErrors(found);
    if (firstWrong) {
      focusField(firstWrong);
      return;
    }
    setBusy(true);
    setFailure(null);
    onCreate(carrier, lines)
      .catch((err: unknown) => setFailure(settlementErrorText(err, t)))
      .finally(() => setBusy(false));
  }

  // What the ticked orders add up to, as typed: a preview of the draft, never sent.
  let collectedSum = 0;
  let feeSum = 0;
  for (const order of selected) {
    const row = rowOf(order);
    const collected = majorToMinor(row.collected);
    const fee = row.fee.trim() === "" ? 0 : majorToMinor(row.fee);
    if (Number.isFinite(collected)) collectedSum += collected;
    if (Number.isFinite(fee)) feeSum += fee;
  }
  const picked = pluralOf(t, "selectedCount", selected.length);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={carrier ? fmt(t.reconcileTitleFor, { courier: providerName(carrier) }) : t.reconcileTitle}
      description={carriers.length > 0 ? t.reconcileDesc : undefined}
      className="max-w-2xl"
      footer={
        carriers.length === 0 ? (
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose}>
            {common.close}
          </Button>
        ) : (
          <>
            <p role="status" className="min-w-0 text-[13px] leading-5 text-ink-soft tabular-nums max-sm:order-last max-sm:text-center sm:me-auto">
              {selected.length > 0
                ? fmt(t.totalsLine, {
                    count: picked,
                    collected: formatMoney(collectedSum, currency),
                    fees: formatMoney(feeSum, currency),
                  })
                : picked}
            </p>
            <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
              {common.cancel}
            </Button>
            <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy || selected.length === 0}>
              {busy ? t.creating : t.createDraft}
            </Button>
          </>
        )
      }
    >
      {carriers.length === 0 ? (
        <EmptyState icon={<IconCourier aria-hidden />} title={t.noUnsettled} description={t.noUnsettledDesc} className="border-0 py-6" />
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          {carriers.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-ink">{t.chooseCourier}</p>
              <FilterChoice
                label={t.chooseCourier}
                options={carriers.map((option) => ({ value: option.carrierCode, label: providerName(option.carrierCode) }))}
                value={carrier || null}
                onChange={(value) => {
                  setCarrier(value ?? "");
                  setErrors({});
                }}
              />
            </div>
          )}

          {carrier && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-paper-sunken px-3 py-3">
                <div className="min-w-0 flex-1 basis-40 space-y-1.5">
                  <label htmlFor={quickFeeId} className="block text-sm font-medium text-ink">
                    {t.feePerOrder}
                  </label>
                  <AmountInput id={quickFeeId} value={quickFee} onChange={setQuickFee} adornment={currency} placeholder="0.00" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full px-4 md:h-10"
                  disabled={selected.length === 0}
                  onClick={applyFee}
                >
                  {t.applyFee}
                </Button>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 cursor-pointer accent-primary"
                  checked={allChecked}
                  onChange={(event) => checkAll(event.target.checked)}
                />
                {t.selectAll}
              </label>

              <ul className="divide-y divide-line border-t border-line">
                {group.map((order) => {
                  const row = rowOf(order);
                  const wrong = errors[rowKey(order)];
                  const cid = collectedId(rowKey(order));
                  const fid = feeId(rowKey(order));
                  return (
                    <li key={rowKey(order)} className="flex items-start gap-2 py-2">
                      <label className="-ms-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          className="size-5 cursor-pointer accent-primary"
                          checked={row.checked}
                          aria-label={fmt(t.selectOrder, { number: order.orderNumber })}
                          onChange={(event) => patchRow(order, { checked: event.target.checked })}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-h-11 flex-col justify-center">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="min-w-0 truncate text-[15px] leading-6 font-semibold text-ink">
                              {isParcelRow(order) && <span className="font-medium text-ink-soft">{t.partOfOrder} </span>}
                              <bdi dir="ltr" className="tabular-nums">
                                {order.orderNumber}
                              </bdi>
                              {order.customerName && (
                                <>
                                  {" · "}
                                  <bdi className="font-medium">{order.customerName}</bdi>
                                </>
                              )}
                            </p>
                            <p className="shrink-0 text-[15px] leading-6 font-semibold text-ink tabular-nums">
                              <bdi dir="ltr">{formatMoney(order.dueAmount, order.currency)}</bdi>
                            </p>
                          </div>
                          <p className="truncate text-xs leading-5 text-ink-soft">
                            {order.waybillNumber && (
                              <>
                                {t.waybill} <bdi dir="ltr">{order.waybillNumber}</bdi>
                              </>
                            )}
                            {order.waybillNumber && order.deliveredAt && " · "}
                            {order.deliveredAt && (
                              <>
                                {t.delivered} {formatDate(order.deliveredAt)}
                              </>
                            )}
                          </p>
                        </div>

                        {row.checked && (
                          <div className="mt-1 mb-1.5 grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label htmlFor={cid} className="block text-xs font-medium text-ink-soft">
                                {t.collected}
                              </label>
                              <AmountInput
                                id={cid}
                                value={row.collected}
                                onChange={(value) => patchRow(order, { collected: value })}
                                adornment={order.currency}
                                invalid={Boolean(wrong?.collected)}
                                describedBy={wrong?.collected ? `${cid}-error` : undefined}
                                placeholder="0.00"
                              />
                              {wrong?.collected && (
                                <p id={`${cid}-error`} role="alert" className="text-xs leading-4 font-medium text-danger">
                                  {wrong.collected}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label htmlFor={fid} className="block text-xs font-medium text-ink-soft">
                                {t.courierFee}
                              </label>
                              <AmountInput
                                id={fid}
                                value={row.fee}
                                onChange={(value) => patchRow(order, { fee: value })}
                                adornment={order.currency}
                                invalid={Boolean(wrong?.fee)}
                                describedBy={wrong?.fee ? `${fid}-error` : undefined}
                                placeholder="0.00"
                              />
                              {wrong?.fee && (
                                <p id={`${fid}-error`} role="alert" className="text-xs leading-4 font-medium text-danger">
                                  {wrong.fee}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {failure && <Alert variant="danger">{failure}</Alert>}
        </form>
      )}
    </Modal>
  );
}
