import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  ConfirmationState,
  FinancialState,
  FulfillmentState,
  Order,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";

const CONFIRMATION: ConfirmationState[] = [
  "pending",
  "confirmed",
  "rejected",
  "unreachable",
  "postponed",
];
const FINANCIAL: FinancialState[] = [
  "pending",
  "partially_paid",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];
const FULFILLMENT: FulfillmentState[] = [
  "unfulfilled",
  "partially_fulfilled",
  "fulfilled",
  "returned",
];

function label(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ");
}

export function OrdersListPage() {
  const workspaceId = useWorkspaceId();
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | "">("");
  const [financialState, setFinancialState] = useState<FinancialState | "">("");
  const [fulfillmentState, setFulfillmentState] = useState<FulfillmentState | "">("");

  const list = useCursorList<Order>(
    (cursor) =>
      apiClient
        .listOrders(workspaceId, {
          cursor,
          limit: 50,
          confirmationState: confirmationState || undefined,
          financialState: financialState || undefined,
          fulfillmentState: fulfillmentState || undefined,
        })
        .then((r) => ({ items: r.orders, nextCursor: r.nextCursor })),
    [workspaceId, confirmationState, financialState, fulfillmentState]
  );

  return (
    <div className="max-w-6xl">
      <PageHeader title="Orders" description="Every order, with its confirmation, payment, and fulfilment state." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          value={confirmationState}
          onChange={(e) => setConfirmationState(e.target.value as ConfirmationState | "")}
        >
          <option value="">Any confirmation</option>
          {CONFIRMATION.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
        <Select
          value={financialState}
          onChange={(e) => setFinancialState(e.target.value as FinancialState | "")}
        >
          <option value="">Any payment</option>
          {FINANCIAL.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
        <Select
          value={fulfillmentState}
          onChange={(e) => setFulfillmentState(e.target.value as FulfillmentState | "")}
        >
          <option value="">Any fulfilment</option>
          {FULFILLMENT.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
      </div>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage="No orders match these filters."
        onRetry={list.reload}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-line last:border-0 hover:bg-paper-raised"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/orders/${order.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {order.contactSnapshot?.fullName || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatMoney(order.totalAmount, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge label="Conf" value={order.confirmationState} />
                      <StatusBadge label="Pay" value={order.financialState} />
                      <StatusBadge label="Ship" value={order.fulfillmentState} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}
