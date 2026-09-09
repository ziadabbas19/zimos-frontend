import { useState } from "react";
import { Link } from "react-router-dom";
import type { Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";

export function CustomersPage() {
  const workspaceId = useWorkspaceId();
  const [blacklistedOnly, setBlacklistedOnly] = useState(false);

  const list = useCursorList<Customer>(
    (cursor) =>
      apiClient
        .listCustomers(workspaceId, {
          cursor,
          limit: 50,
          blacklistedOnly: blacklistedOnly || undefined,
        })
        .then((r) => ({ items: r.customers, nextCursor: r.nextCursor })),
    [workspaceId, blacklistedOnly]
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Customers"
        description="Everyone who has ordered, keyed on their phone number."
      />

      <label className="mb-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={blacklistedOnly}
          onChange={(e) => setBlacklistedOnly(e.target.checked)}
        />
        Blacklisted only
      </label>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage={
          blacklistedOnly ? "No blacklisted customers." : "No customers yet."
        }
        onRetry={list.reload}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Rejected</th>
                <th className="px-4 py-3 font-medium">Reliability</th>
                <th className="px-4 py-3 font-medium">Blacklisted</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-line last:border-0 hover:bg-paper-raised"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {customer.fullName || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {customer.phoneRaw || customer.phoneNormalized}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{customer.totalOrders}</td>
                  <td className="px-4 py-3 text-ink-soft">{customer.totalRejectedOrders}</td>
                  <td className="px-4 py-3 text-ink-soft">{customer.reliabilityScore}</td>
                  <td className="px-4 py-3">
                    {customer.isBlacklisted ? (
                      <StatusBadge value="blacklisted" tone="danger" />
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
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
