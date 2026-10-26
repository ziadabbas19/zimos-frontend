import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, RefreshCw, Undo2 } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminRiskIdentifierType as IdentifierType,
  AdminRiskSignal as Signal,
  AdminRiskSignalReason,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, NativeSelect } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatRate, formatRelative } from "@/lib/format";
import { Pager } from "@/pages/BlocklistPage";

const TYPE_OPTIONS: Array<{ value: IdentifierType; label: string }> = [
  { value: "phone", label: "Phones" },
  { value: "email", label: "Emails" },
  { value: "address", label: "Addresses" },
];

const WINDOWS = [30, 90, 180, 365];
const MIN_STORES = [2, 3, 5, 10];
const MIN_REFUSED = [2, 3, 5, 10];

const REASON_LABEL: Record<AdminRiskSignalReason, string> = {
  multi_store: "Several stores",
  high_refusal: "Many refusals",
};

/** The reason stored with a one-click block — the evidence, in words. */
function blockReason(s: Signal, windowDays: number): string {
  const parts = [`ordered in ${s.workspaceCount} store${s.workspaceCount === 1 ? "" : "s"}`];
  if (s.refusedCount > 0) parts.push(`${s.refusedCount} of ${s.orderCount} orders cancelled or returned`);
  return `Fraud signal: ${parts.join("; ")} (last ${windowDays} days)`;
}

export function FraudSignalsPage() {
  const toast = useToast();
  const [type, setType] = useState<IdentifierType>("phone");
  const [windowDays, setWindowDays] = useState(90);
  const [minWorkspaces, setMinWorkspaces] = useState(3);
  const [minRefused, setMinRefused] = useState(3);
  // Any filter change starts again from the first page (see BlocklistPage).
  const filterKey = [type, windowDays, minWorkspaces, minRefused].join("|");
  const [page, setPage] = useState({ key: filterKey, offset: 0 });
  const offset = page.key === filterKey ? page.offset : 0;
  const setOffset = (next: number) => setPage({ key: filterKey, offset: next });
  // Rows being blocked or unblocked right now, by value.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const { data, loading, error, refresh, setData } = useAsync(
    () => adminApi.listRiskSignals({ type, windowDays, minWorkspaces, minRefused, offset }),
    [type, windowDays, minWorkspaces, minRefused, offset]
  );

  const signals = data?.signals ?? [];
  const thresholds = data?.thresholds;

  function patchRow(value: string, patch: Partial<Signal>) {
    setData((prev) => {
      if (!prev) throw new Error("Signals not loaded.");
      return { ...prev, signals: prev.signals.map((s) => (s.value === value ? { ...s, ...patch } : s)) };
    });
  }

  async function withPending(value: string, run: () => Promise<void>) {
    setPending((p) => new Set(p).add(value));
    try {
      await run();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(value);
        return next;
      });
    }
  }

  const block = (s: Signal) =>
    withPending(s.value, async () => {
      const { entry } = await adminApi.blockIdentifier({
        ...s.block,
        reason: blockReason(s, thresholds?.windowDays ?? windowDays),
        source: "signal",
      });
      patchRow(s.value, { blocked: true, blocklistEntryId: entry.id });
      toast.success(`${s.label} is now blocked in every workspace.`);
    });

  const unblock = (s: Signal) =>
    withPending(s.value, async () => {
      if (!s.blocklistEntryId) return;
      await adminApi.deleteBlocklistEntry(s.blocklistEntryId);
      patchRow(s.value, { blocked: false, blocklistEntryId: null });
      toast.success(`${s.label} unblocked.`);
    });

  return (
    <div>
      <PageHeader
        title="Fraud signals"
        description="Phones, emails and addresses that repeat across stores or keep refusing orders."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <FilterChips options={TYPE_OPTIONS} value={type} onChange={setType} />
        <div className="flex flex-wrap items-end gap-3">
          <Threshold label="Window" value={windowDays} options={WINDOWS} format={(d) => `Last ${d} days`} onChange={setWindowDays} />
          <Threshold label="Stores at least" value={minWorkspaces} options={MIN_STORES} onChange={setMinWorkspaces} />
          <Threshold label="Refused at least" value={minRefused} options={MIN_REFUSED} onChange={setMinRefused} />
        </div>
      </div>

      {thresholds && (
        <p className="mb-3 text-sm text-ink-soft">
          Showing identifiers that ordered in at least {thresholds.minWorkspaces} stores, or had at least{" "}
          {thresholds.minRefused} cancelled or returned orders making up {formatRate(thresholds.minRefusalRate, 0)}{" "}
          or more of their orders, in the last {thresholds.windowDays} days. Unpaid online orders are not counted.
        </p>
      )}

      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {signals.length === 0 ? (
          <EmptyBlock message="No identifier crosses these thresholds." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Identifier</Th>
                  <Th>Stores</Th>
                  <Th className="text-end">Orders</Th>
                  <Th className="text-end">Cancelled / returned</Th>
                  <Th>Last order</Th>
                  <Th>Why</Th>
                  <Th className="text-end">
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((s) => (
                  <SignalRow
                    key={s.value}
                    signal={s}
                    busy={pending.has(s.value)}
                    onBlock={() => void block(s)}
                    onUnblock={() => void unblock(s)}
                  />
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
        {data && <Pager total={data.total} limit={data.limit} offset={offset} onOffset={setOffset} />}
      </DataState>
    </div>
  );
}

function Threshold({
  label,
  value,
  options,
  format = String,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format?: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      <NativeSelect className="h-9 w-36" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function SignalRow({
  signal: s,
  busy,
  onBlock,
  onUnblock,
}: {
  signal: Signal;
  busy: boolean;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const shown = s.workspaces.slice(0, 3);
  const more = s.workspaceCount - shown.length;
  return (
    <TableRow>
      <Td className="max-w-80">
        <span className="block truncate font-medium" title={s.label}>
          {s.label || "—"}
        </span>
        {s.type === "phone" && s.value !== s.label && <Mono className="mt-1 inline-block">{s.value}</Mono>}
      </Td>
      <Td className="max-w-64 text-sm">
        <span className="tabular font-semibold">{s.workspaceCount}</span>
        <span className="block truncate text-xs text-ink-soft">
          {shown.map((w, i) => (
            <span key={w.id}>
              {i > 0 && ", "}
              <Link to={`/workspaces/${w.id}`} className="hover:text-primary">
                {w.name ?? "Deleted workspace"}
              </Link>
            </span>
          ))}
          {more > 0 && ` +${more} more`}
        </span>
      </Td>
      <Td className="tabular text-end">{s.orderCount}</Td>
      <Td className="tabular text-end">
        {s.refusedCount}
        {s.refusalRate !== null && s.refusedCount > 0 && (
          <span className="block text-xs text-ink-soft">{formatRate(s.refusalRate, 0)}</span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-sm">
        <span title={formatDateTime(s.lastSeenAt)}>{formatRelative(s.lastSeenAt)}</span>
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {s.reasons.map((r) => (
            <StatusBadge key={r} tone={r === "high_refusal" ? "danger" : "warning"}>
              {REASON_LABEL[r] ?? r}
            </StatusBadge>
          ))}
        </div>
      </Td>
      <Td className="text-end whitespace-nowrap">
        {s.blocked ? (
          <div className="flex items-center justify-end gap-2">
            <StatusBadge tone="danger" dot>
              Blocked
            </StatusBadge>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onUnblock} aria-label={`Unblock ${s.label}`}>
              <Undo2 /> Unblock
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={onBlock}>
            <Ban /> {busy ? "Blocking…" : "Block"}
          </Button>
        )}
      </Td>
    </TableRow>
  );
}
