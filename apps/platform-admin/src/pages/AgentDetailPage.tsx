import { useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminCommission,
  AdminReferralCode,
  CommissionListStatus,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import {
  CodeModal,
  CodeStatus,
  CommissionTotals,
  LedgerTable,
  MarkPaidModal,
  MerchantsTable,
} from "@/components/referrals";
import { PAYOUT_OPTIONS, describeDiscount, neverApproved } from "@/lib/referrals";
import { Pager } from "@/pages/BlocklistPage";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatBp, formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";

type StatusFilter = "all" | CommissionListStatus;

export function AgentDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { can } = useAuth();
  const detail = useAsync(() => adminApi.getAgent(id), [id]);

  const [editing, setEditing] = useState<AdminReferralCode | null>(null);
  const [adding, setAdding] = useState(false);

  const agent = detail.data?.agent;
  const defaultRateBp = detail.data?.defaultCommissionRateBp ?? 3000;
  const canManage = can(P.AGENTS_MANAGE);

  return (
    <div>
      <PageHeader
        back={{ to: "/agents", label: "Agents" }}
        title={agent?.fullName ?? "Agent"}
        titleBadge={agent && !agent.isAgent ? <StatusBadge tone="neutral">No longer an agent</StatusBadge> : undefined}
        description={agent?.email}
        actions={
          canManage &&
          agent?.isAgent && (
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add code
            </Button>
          )
        }
      />

      <DataState loading={detail.loading && !detail.data} error={detail.error} onRetry={() => void detail.refresh()}>
        {agent && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Referral codes</h2>
              {agent.codes.length === 0 ? (
                <EmptyBlock message="This agent has no codes yet." />
              ) : (
                <Panel flush>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>Code</Th>
                        <Th>Discount</Th>
                        <Th>Commission rate</Th>
                        <Th className="text-end">Merchants</Th>
                        <Th>Suggested commission</Th>
                        <Th>Status</Th>
                        {canManage && (
                          <Th className="text-end">
                            <span className="sr-only">Actions</span>
                          </Th>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agent.codes.map((c) => (
                        <TableRow key={c.id}>
                          <Td>
                            <Mono>{c.code}</Mono>
                            {c.label && <span className="block text-xs text-ink-soft">{c.label}</span>}
                          </Td>
                          <Td className="text-sm">{describeDiscount(c)}</Td>
                          <Td className="text-sm">
                            {formatBp(c.effectiveCommissionRateBp)}
                            {c.commissionRateBp == null && <span className="block text-xs text-ink-soft">Default</span>}
                          </Td>
                          <Td className="text-end text-sm">{c.merchantsReferred}</Td>
                          <Td>
                            <CommissionTotals totals={c.commission} empty="No payments yet" />
                          </Td>
                          <Td>
                            <CodeStatus code={c} />
                            <span className="mt-1 block text-xs text-ink-soft">Since {formatDate(c.createdAt)}</span>
                          </Td>
                          {canManage && (
                            <Td className="text-end">
                              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}>
                                <Pencil />
                              </Button>
                            </Td>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Panel>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Referred merchants</h2>
              {detail.data!.merchants.length === 0 ? (
                <EmptyBlock message="No merchant has entered one of these codes yet." />
              ) : (
                <MerchantsTable merchants={detail.data!.merchants} linkWorkspaces={can(P.WORKSPACES_VIEW)} />
              )}
            </section>

            <CommissionLedger
              agentId={agent.id}
              canMarkPaid={can(P.COMMISSIONS_MARK_PAID)}
              onChanged={() => void detail.refresh({ silent: true })}
            />
          </div>
        )}
      </DataState>

      {adding && agent && (
        <CodeModal
          defaultRateBp={defaultRateBp}
          onClose={() => setAdding(false)}
          onSubmit={async (input) => {
            const code = await adminApi.createReferralCode(agent.id, { ...input, code: input.code ?? "" });
            toast.success(`Code ${code.code} created.`);
            setAdding(false);
            void detail.refresh({ silent: true });
          }}
        />
      )}
      {editing && (
        <CodeModal
          code={editing}
          hideActive={neverApproved(editing)}
          defaultRateBp={defaultRateBp}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            const code = await adminApi.updateReferralCode(editing.id, input);
            toast.success(`Code ${code.code} saved.`);
            setEditing(null);
            void detail.refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function CommissionLedger({
  agentId,
  canMarkPaid,
  onChanged,
}: {
  agentId: string;
  canMarkPaid: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState({ key: status, offset: 0 });
  const offset = page.key === status ? page.offset : 0;
  const ledger = useAsync(
    () => adminApi.listCommissions({ agentId, status: status === "all" ? undefined : status, offset }),
    [agentId, status, offset]
  );
  const [marking, setMarking] = useState<AdminCommission | null>(null);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Commission ledger</h2>
        <FilterChips options={PAYOUT_OPTIONS} value={status} onChange={setStatus} />
      </div>
      <DataState loading={ledger.loading && !ledger.data} error={ledger.error} onRetry={() => void ledger.refresh()}>
        {ledger.data && ledger.data.totals.length > 0 && (
          <div className="mb-3">
            <CommissionTotals totals={ledger.data.totals} />
          </div>
        )}
        {(ledger.data?.commissions.length ?? 0) === 0 ? (
          <EmptyBlock message={status === "all" ? "No payments with this agent's codes yet." : "No rows match this filter."} />
        ) : (
          <LedgerTable rows={ledger.data!.commissions} onMarkPaid={canMarkPaid ? setMarking : undefined} />
        )}
        {ledger.data && (
          <Pager
            total={ledger.data.total}
            limit={ledger.data.limit}
            offset={offset}
            onOffset={(next) => setPage({ key: status, offset: next })}
          />
        )}
      </DataState>

      {marking && (
        <MarkPaidModal
          row={marking}
          onClose={() => setMarking(null)}
          onConfirm={async (note) => {
            await adminApi.markCommissionPaid(marking.id, note || undefined);
            toast.success("Commission marked paid.");
            setMarking(null);
            void ledger.refresh({ silent: true });
            onChanged();
          }}
        />
      )}
    </section>
  );
}
