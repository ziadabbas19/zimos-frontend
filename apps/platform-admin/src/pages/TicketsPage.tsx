import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { SupportTicketPriority, SupportTicketStatus } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, NativeSelect, SearchInput } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Pager } from "@/pages/BlocklistPage";
import { PRIORITY_LABEL, STATUS_LABEL, priorityBadge } from "@/lib/tickets";

type StatusFilter = "all" | SupportTicketStatus;

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function TicketsPage() {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [priority, setPriority] = useState<"" | SupportTicketPriority>("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());

  const filterKey = [status, priority, q].join("|");
  const [page, setPage] = useState({ key: filterKey, offset: 0 });
  const offset = page.key === filterKey ? page.offset : 0;

  const { data, loading, error, refresh } = useAsync(
    () =>
      adminApi.listTickets({
        status: status === "all" ? undefined : status,
        priority: priority || undefined,
        q: q || undefined,
        offset,
      }),
    [status, priority, q, offset]
  );

  const counts = data?.counts;
  const all = counts ? counts.open + counts.pending + counts.resolved + counts.closed : undefined;
  const options: Array<{ value: StatusFilter; label: string; count?: number }> = [
    { value: "open", label: STATUS_LABEL.open, count: counts?.open },
    { value: "pending", label: STATUS_LABEL.pending, count: counts?.pending },
    { value: "resolved", label: STATUS_LABEL.resolved, count: counts?.resolved },
    { value: "closed", label: STATUS_LABEL.closed, count: counts?.closed },
    { value: "all", label: "All", count: all },
  ];
  const tickets = data?.tickets ?? [];

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description="Merchant requests waiting on the platform team."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips options={options} value={status} onChange={setStatus} />
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="Priority"
            className="h-10 w-36"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "" | SupportTicketPriority)}
          >
            <option value="">Any priority</option>
            {(Object.keys(PRIORITY_LABEL) as SupportTicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
          <SearchInput value={query} onChange={setQuery} placeholder="Search subjects" />
        </div>
      </div>

      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {tickets.length === 0 ? (
          <EmptyBlock message={status === "open" ? "Nothing is waiting on the platform team." : "No tickets match."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Subject</Th>
                  <Th>Workspace</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th>Last message</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <Td className="max-w-96">
                      <span className="flex items-center gap-2">
                        <Link to={`/tickets/${t.id}`} className="block min-w-0 truncate font-medium text-ink hover:text-primary">
                          {t.subject}
                        </Link>
                        {(() => {
                          // Urgent and high tickets sit at the top of the queue and say so.
                          const badge = priorityBadge(t.priority);
                          return badge ? <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge> : null;
                        })()}
                      </span>
                      <span className="text-xs text-ink-soft">
                        {t.category} · {t.messageCount ?? 0} message{t.messageCount === 1 ? "" : "s"} · opened by{" "}
                        {t.createdBy ?? "a deleted user"}
                      </span>
                    </Td>
                    <Td className="text-sm">
                      <Link to={`/workspaces/${t.workspaceId}`} className="hover:text-primary">
                        {t.workspaceName ?? "Deleted workspace"}
                      </Link>
                    </Td>
                    <Td>
                      <Status value={t.status} label={STATUS_LABEL[t.status]} />
                    </Td>
                    <Td>
                      <Status value={t.priority} label={PRIORITY_LABEL[t.priority]} />
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      <span title={formatDateTime(t.lastMessageAt)}>{formatRelative(t.lastMessageAt)}</span>
                      <span className="block text-xs text-ink-soft">
                        {t.lastMessageBy === "admin" ? "by the platform" : "by the merchant"}
                      </span>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
        {data && (
          <Pager total={data.total} limit={data.limit} offset={offset} onOffset={(o) => setPage({ key: filterKey, offset: o })} />
        )}
      </DataState>
    </div>
  );
}
