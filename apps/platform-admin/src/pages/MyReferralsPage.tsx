import { useState } from "react";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminReferralCode, AdminReferralCodeInput, CommissionListStatus } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { useToast } from "@/components/Toast";
import {
  CodeModal,
  CodeStatus,
  CommissionTotals,
  LedgerTable,
  MerchantsTable,
} from "@/components/referrals";
import { ReferralCodeFormModal } from "@/components/referralCodeForm";
import { useAuth } from "@/context/AuthContext";
import { PAYOUT_OPTIONS, neverApproved } from "@/lib/referrals";
import { describeCodeCommission, describeCodeDiscount } from "@/lib/referralCodes";
import { CreateAgentModal } from "@/pages/AgentsPage";
import { Pager } from "@/pages/BlocklistPage";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { P } from "@/lib/permissions";

type StatusFilter = "all" | CommissionListStatus;

/** What saving means for the code, for someone whose codes wait for review. */
function reviewHint(code: AdminReferralCode | undefined): string {
  if (!code) return "It stays off until it has been reviewed and approved.";
  if (neverApproved(code)) return "It stays off until it has been approved. A change to anything but the label sends it for review again.";
  return "The label changes at once. Anything else waits for review: until it's approved, stores using this code keep what was approved, and new stores can't enter it.";
}

/**
 * An account's own view: their codes, the merchants who entered them, and the
 * commission each of those merchants' payments suggests. They make and change
 * their own codes here, and a creator reviews them (migration 742). Payouts
 * are marked by the Zimos team.
 */
export function MyReferralsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const mine = useAsync(() => adminApi.getMyReferrals(), []);
  const plans = useAsync(() => (can(P.PLANS_VIEW) ? adminApi.listPlans() : Promise.resolve([])), []);
  // { code: undefined }: a new one.
  const [form, setForm] = useState<{ code?: AdminReferralCode } | null>(null);
  const [addingAgent, setAddingAgent] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState({ key: status, offset: 0 });
  const offset = page.key === status ? page.offset : 0;
  const ledger = useAsync(
    () => adminApi.listMyCommissions({ status: status === "all" ? undefined : status, offset }),
    [status, offset]
  );

  const agent = mine.data?.agent;
  const v2 = mine.data?.v2Enabled ?? false;
  const defaultRateBp = mine.data?.defaultCommissionRateBp ?? 3000;
  const hint = can(P.REFERRAL_CODES_APPROVE) ? undefined : reviewHint(form?.code);

  const save = (input: AdminReferralCodeInput & { code?: string }) =>
    form?.code
      ? adminApi.updateOwnReferralCode(form.code.id, input)
      : adminApi.createOwnReferralCode(input as AdminReferralCodeInput & { code: string });

  function saved(code: AdminReferralCode) {
    setForm(null);
    toast.success(code.approvalStatus === "pending" ? `${code.code} was sent for review.` : `${code.code} saved.`);
    void mine.refresh({ silent: true });
  }

  return (
    <div>
      <PageHeader
        title="My referrals"
        description="Your referral codes, the merchants who used them, and the commission suggested for each of their payments."
        actions={
          <div className="flex flex-wrap gap-2">
            {can(P.AGENTS_CREATE) && (
              <Button variant="outline" onClick={() => setAddingAgent(true)}>
                <UserPlus /> Add agent
              </Button>
            )}
            <Button onClick={() => setForm({})}>
              <Plus /> New code
            </Button>
          </div>
        }
      />

      <DataState loading={mine.loading && !mine.data} error={mine.error} onRetry={() => void mine.refresh()}>
        {agent && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">My codes</h2>
              {agent.codes.length === 0 ? (
                <EmptyBlock message="You don't have a referral code yet. Make one, and it works once it has been approved." />
              ) : (
                <Panel flush>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>Code</Th>
                        <Th>Merchant discount</Th>
                        <Th>Your commission</Th>
                        <Th className="text-end">Merchants</Th>
                        <Th>Suggested commission</Th>
                        <Th>Status</Th>
                        <Th className="text-end">
                          <span className="sr-only">Actions</span>
                        </Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agent.codes.map((c) => (
                        <TableRow key={c.id}>
                          <Td>
                            <Mono>{c.code}</Mono>
                            {c.label && <span className="block text-xs text-ink-soft">{c.label}</span>}
                          </Td>
                          <Td className="text-sm">{describeCodeDiscount(c)}</Td>
                          <Td className="text-sm">{describeCodeCommission(c)}</Td>
                          <Td className="text-end text-sm">{c.merchantsReferred}</Td>
                          <Td>
                            <CommissionTotals totals={c.commission} empty="No payments yet" />
                          </Td>
                          <Td>
                            <CodeStatus code={c} />
                          </Td>
                          <Td className="text-end">
                            {/* With the flag off, a code with a schedule has nothing here to edit it with. */}
                            {(v2 || c.kind !== "schedule") && (
                              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.code}`} onClick={() => setForm({ code: c })}>
                                <Pencil />
                              </Button>
                            )}
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Panel>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Merchants who used my codes</h2>
              {mine.data!.merchants.length === 0 ? (
                <EmptyBlock message="No merchant has entered one of your codes yet." />
              ) : (
                <MerchantsTable merchants={mine.data!.merchants} linkWorkspaces={false} />
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Payments and commission</h2>
                <FilterChips options={PAYOUT_OPTIONS} value={status} onChange={setStatus} />
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                A suggested commission is recorded for every payment a referred merchant makes, renewals included.
                Payouts are arranged with the Zimos team, who mark each one paid here.
              </p>
              <DataState loading={ledger.loading && !ledger.data} error={ledger.error} onRetry={() => void ledger.refresh()}>
                {ledger.data && ledger.data.totals.length > 0 && (
                  <div className="mb-3">
                    <CommissionTotals totals={ledger.data.totals} />
                  </div>
                )}
                {(ledger.data?.commissions.length ?? 0) === 0 ? (
                  <EmptyBlock message={status === "all" ? "No payments yet." : "No rows match this filter."} />
                ) : (
                  <LedgerTable rows={ledger.data!.commissions} />
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
            </section>
          </div>
        )}
      </DataState>

      {form && agent && v2 && (
        <ReferralCodeFormModal
          code={form.code ? (form.code.proposed ?? form.code) : undefined}
          ownerId={agent.id}
          agents={[]}
          plans={plans.data ?? []}
          defaultRateBp={defaultRateBp}
          description={hint}
          submit={save}
          onClose={() => setForm(null)}
          onSaved={saved}
        />
      )}
      {form && agent && !v2 && (
        <CodeModal
          code={form.code ? (form.code.proposed ?? form.code) : undefined}
          hideActive
          defaultRateBp={defaultRateBp}
          description={hint}
          onClose={() => setForm(null)}
          onSubmit={async (input) => saved(await save(input))}
        />
      )}
      {addingAgent && (
        <CreateAgentModal
          defaultRateBp={defaultRateBp}
          onClose={() => setAddingAgent(false)}
          onCreated={(email) => {
            setAddingAgent(false);
            toast.success(`${email} is now an agent.`);
          }}
        />
      )}
    </div>
  );
}
