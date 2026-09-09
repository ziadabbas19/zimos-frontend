import type { Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  unfulfilledCount: number;
  fulfilledCount: number;
  /** True when we stopped at `cap` rather than reaching the end of the list. */
  reachedCap: boolean;
  currency: string;
  cap: number;
}

/**
 * Rolls the order list up into the numbers the Overview shows. There is no
 * stats endpoint on the backend, so this walks `listOrders` page by page
 * (200 at a time) and does the maths in the browser, stopping either when the
 * list runs out or once `cap` orders have been gathered — whichever comes first.
 */
export async function fetchOrderStats(
  workspaceId: string,
  opts: { cap?: number } = {}
): Promise<OrderStats> {
  const cap = opts.cap ?? 1000;
  const orders: Order[] = [];
  let cursor: string | undefined;
  let reachedCap = false;

  for (;;) {
    const page = await apiClient.listOrders(workspaceId, { cursor, limit: 200 });
    orders.push(...page.orders);
    if (!page.nextCursor) break;
    if (orders.length >= cap) {
      reachedCap = true;
      break;
    }
    cursor = page.nextCursor;
  }

  let totalRevenue = 0;
  let unfulfilledCount = 0;
  let fulfilledCount = 0;
  for (const order of orders) {
    if (order.cancelledAt === null) totalRevenue += Number(order.totalAmount);
    if (order.fulfillmentState === "unfulfilled") unfulfilledCount += 1;
    else if (order.fulfillmentState === "fulfilled") fulfilledCount += 1;
  }

  return {
    totalOrders: orders.length,
    totalRevenue,
    unfulfilledCount,
    fulfilledCount,
    reachedCap,
    currency: orders[0]?.currency ?? "EGP",
    cap,
  };
}
