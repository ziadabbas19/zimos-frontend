import type { Order, OrderStage } from "@store-builder/api-client";

const SHIPPING_STAGES: readonly OrderStage[] = ["shipped", "out_for_delivery", "delivered"];

/**
 * Whether moving `order` to `target` has something to ask first — exactly the
 * cases in which the change-status dialog (components/StatusChanger.tsx) shows
 * a field of its own or a warning that deserves reading:
 *   - reopening a cancelled order (it takes the stock again);
 *   - cancelling (a reason is required);
 *   - "needs follow-up" (no answer, or asked to postpone);
 *   - a shipping stage on an order with no live shipment (a courier name and a
 *     tracking number are recorded for it).
 * Every other move is a bare `{ status }` and can be made in place, with Undo.
 */
export function moveNeedsDialog(order: Pick<Order, "stage" | "shipments">, target: OrderStage): boolean {
  if (order.stage === "cancelled") return true;
  if (target === "cancelled" || target === "needs_follow_up") return true;
  const hasLiveShipment = (order.shipments ?? []).some((s) => s.status !== "cancelled" && s.status !== "returned");
  return SHIPPING_STAGES.includes(target) && !hasLiveShipment;
}

/**
 * The stages whose arrival reaches the customer (the store's order emails and
 * automations): confirmed, the follow-up calls, each shipping step and the
 * cancellation. The stage route takes no "do not tell the customer", so a move
 * back INTO one of these is not offered as an Undo: it would tell them again.
 */
const STAGES_THAT_NOTIFY: readonly OrderStage[] = ["ready_to_ship", "needs_follow_up", "shipped", "out_for_delivery", "delivered", "returned", "cancelled"];

/** Whether putting an order back in `stage` says nothing to the customer. */
export function movesBackQuietly(stage: OrderStage): boolean {
  return !STAGES_THAT_NOTIFY.includes(stage);
}
