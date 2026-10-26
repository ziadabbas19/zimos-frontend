import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminAuditEntry, AdminAuditLogPage } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { DetailRow, Drawer } from "@/components/Drawer";
import { NativeSelect } from "@/components/forms";
import { JsonBlock, Mono, Panel, Td, Th } from "@/components/Panel";
import { humanize } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

/** Rows revealed per "Load more" click, within the fetched window. */
const PAGE = 25;

/** Sentinel for the narrowed query while no filter is active — never rendered. */
const NO_QUERY: AdminAuditLogPage = { rows: [], total: null };

const PERIODS: Array<{ value: string; label: string; hours: number | null }> = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "all", label: "All time", hours: null },
];

interface Option {
  value: string;
  label: string;
}

/** Distinct `key` values across the window, as options, sorted by label. */
function optionsFrom(
  rows: AdminAuditEntry[],
  id: (r: AdminAuditEntry) => string | null,
  label: (r: AdminAuditEntry) => string
): Option[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const value = id(r);
    if (value && !seen.has(value)) seen.set(value, label(r));
  }
  return [...seen].map(([value, l]) => ({ value, label: l })).sort((a, b) => a.label.localeCompare(b.label));
}

export function AuditLogPage() {
  const [period, setPeriod] = useState("30d");
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  // A store page links here with ?workspaceId=… (ignored unless it is a UUID,
  // which is all the endpoint accepts).
  const [params] = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState(() => {
    const id = params.get("workspaceId") ?? "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : "";
  });
  const [reveal, setReveal] = useState(PAGE);
  const [selected, setSelected] = useState<AdminAuditEntry | null>(null);

  const from = useMemo(() => {
    const hours = PERIODS.find((p) => p.value === period)?.hours ?? null;
    return hours === null ? undefined : new Date(Date.now() - hours * 3_600_000).toISOString();
  }, [period]);

  const narrowed =
    action !== "all" || entityType !== "all" || actorUserId !== "" || workspaceId !== "";

  // Two windows, deliberately. `base` is the period alone, and is the only
  // thing the filter dropdowns are built from — building them from the
  // filtered rows instead would collapse each list to the single value just
  // chosen, so picking an action would make every other action unselectable.
  const base = useAsync(() => adminApi.listAuditLog({ from }), [from]);

  // The filtered window. Every filter is applied by the endpoint, so these
  // rows need no narrowing here. Skipped entirely while nothing is filtered:
  // the query would be identical to `base` and would spend a second request —
  // and a rate-limit budget — fetching bytes already in hand.
  const scoped = useAsync(
    () =>
      narrowed
        ? adminApi.listAuditLog({
            from,
            action: action === "all" ? undefined : action,
            entityType: entityType === "all" ? undefined : entityType,
            actorUserId: actorUserId || undefined,
            workspaceId: workspaceId || undefined,
          })
        : Promise.resolve(NO_QUERY),
    [from, action, entityType, actorUserId, workspaceId]
  );

  const source = narrowed ? scoped : base;
  const rows = source.data?.rows ?? [];
  const total = source.data?.total ?? null;
  const loading = base.loading || (narrowed && scoped.loading);
  const error = (narrowed ? scoped.error : null) ?? base.error;

  const facetRows = useMemo(() => base.data?.rows ?? [], [base.data]);
  const actions = useMemo(
    () => [...new Set(facetRows.map((r) => r.action))].sort(),
    [facetRows]
  );
  const entityTypes = useMemo(
    () => [...new Set(facetRows.map((r) => r.entityType))].sort(),
    [facetRows]
  );
  // Actor and workspace are filtered by id, not by text: the endpoint takes
  // `actorUserId`/`workspaceId` as UUIDs and answers 422 on anything else, and
  // offers no name or email search. So these are pickers over the ids actually
  // present, rather than the free-text boxes they used to be.
  const actors = useMemo(
    () =>
      optionsFrom(
        facetRows,
        (r) => r.actorUserId,
        (r) => r.actorName ?? r.actorEmail ?? r.actorUserId ?? "Unknown"
      ),
    [facetRows]
  );
  const workspaces = useMemo(() => {
    const options = optionsFrom(facetRows, (r) => r.workspaceId, (r) => r.workspaceName ?? r.workspaceId ?? "");
    // The store a link opened with may not be among the recent rows.
    return workspaceId && !options.some((o) => o.value === workspaceId)
      ? [...options, { value: workspaceId, label: workspaceId }]
      : options;
  }, [facetRows, workspaceId]);

  const resetPaging = () => setReveal(PAGE);
  const refreshAll = () => {
    void base.refresh();
    if (narrowed) void scoped.refresh();
  };

  const loaded = rows.length;
  const shown = Math.min(reveal, loaded);
  // `total` counts the whole match set server-side, so "there are more" is now
  // a fact rather than an inference from a window that came back looking full.
  const beyondWindow = total !== null && total > loaded;

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every administrative action, with before and after state."
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading} error={error} onRetry={refreshAll}>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <NativeSelect
            aria-label="Actor"
            value={actorUserId}
            onChange={(e) => {
              setActorUserId(e.target.value);
              resetPaging();
            }}
          >
            <option value="">All actors</option>
            {actors.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              resetPaging();
            }}
          >
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Entity type"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              resetPaging();
            }}
          >
            <option value="all">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Workspace"
            value={workspaceId}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              resetPaging();
            }}
          >
            <option value="">All workspaces</option>
            {workspaces.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Time period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              resetPaging();
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {loaded === 0 ? (
          <EmptyBlock
            message={
              narrowed
                ? "No entries match these filters."
                : "No audit entries recorded in this period."
            }
          />
        ) : (
          <>
            <Panel flush>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>Time</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Entity</Th>
                    <Th>Workspace</Th>
                    <Th>IP</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, reveal).map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <Td className="text-ink-soft">
                        <span title={formatDateTime(r.createdAt)}>{formatRelative(r.createdAt)}</span>
                      </Td>
                      <Td>
                        <span className="block">{r.actorName ?? "—"}</span>
                        {r.actorEmail && <span className="text-xs text-ink-soft">{r.actorEmail}</span>}
                      </Td>
                      <Td>
                        <Mono>{r.action}</Mono>
                      </Td>
                      <Td>
                        <span className="block">{r.entityLabel ?? r.entityId ?? "—"}</span>
                        <span className="text-xs text-ink-soft">{humanize(r.entityType)}</span>
                      </Td>
                      <Td className="text-ink-soft">{r.workspaceName ?? "—"}</Td>
                      <Td className="tabular font-mono text-xs text-ink-soft">{r.ip ?? "—"}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
              <span>
                Showing {formatNumber(shown)} of {formatNumber(loaded)}
                {/* Only ever states a count the server actually reported. An
                    older build that sends no `total` leaves this off rather
                    than substituting the window size for it. */}
                {beyondWindow && ` loaded — ${formatNumber(total)} match in total`}
              </span>
              {reveal < loaded && (
                <Button variant="outline" size="sm" onClick={() => setReveal((r) => r + PAGE)}>
                  Load more
                </Button>
              )}
            </div>
            {beyondWindow && (
              <p className="mt-1 text-xs text-ink-soft">
                {/* Counts what was actually loaded rather than the size asked
                    for: the two differ whenever the server returns short, and
                    quoting the request would describe a window that isn't the
                    one on screen. */}
                This view holds the newest {formatNumber(loaded)}. Narrow the time period or add a
                filter to reach the other {formatNumber(total - loaded)}.
              </p>
            )}
          </>
        )}
      </DataState>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action ?? ""}
        description={selected ? formatDateTime(selected.createdAt) : undefined}
      >
        {selected && (
          <div className="space-y-5">
            <dl>
              <DetailRow label="Actor">
                {selected.actorName ?? "—"}
                {selected.actorEmail && ` · ${selected.actorEmail}`}
              </DetailRow>
              <DetailRow label="Action">
                <Mono>{selected.action}</Mono>
              </DetailRow>
              <DetailRow label="Entity">
                {humanize(selected.entityType)}
                {selected.entityLabel && ` · ${selected.entityLabel}`}
              </DetailRow>
              <DetailRow label="Entity ID">
                {selected.entityId ? <Mono>{selected.entityId}</Mono> : "—"}
              </DetailRow>
              <DetailRow label="Workspace">{selected.workspaceName ?? "—"}</DetailRow>
              <DetailRow label="IP address">{selected.ip ?? "—"}</DetailRow>
              <DetailRow label="User agent">
                <span className="text-xs">{selected.userAgent || "—"}</span>
              </DetailRow>
              <DetailRow label="Entry ID">
                <Mono>{selected.id}</Mono>
              </DetailRow>
            </dl>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-ink">Before</h3>
              <JsonBlock value={selected.before} />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-ink">After</h3>
              <JsonBlock value={selected.after} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
