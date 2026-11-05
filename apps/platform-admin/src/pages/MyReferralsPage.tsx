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
import { fmt, useT } from "@/i18n/LocaleContext";
import { codeToEdit, neverApproved, payoutOptions } from "@/lib/referrals";
import { describeCodeCommission, describeCodeDiscount } from "@/lib/referralCodes";
import { REFERRAL_STRINGS, isolate, referralStrings } from "@/lib/referralStrings";
import { CreateAgentModal } from "@/pages/AgentsPage";
import { Pager } from "@/pages/BlocklistPage";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { P, isCreator } from "@/lib/permissions";

type StatusFilter = "all" | CommissionListStatus;

/** What saving means for the code, for someone whose codes wait for review. */
function reviewHint(code: AdminReferralCode | undefined): string {
  const t = referralStrings();
  if (!code) return t.myHintNew;
  if (neverApproved(code)) return t.myHintNeverApproved;
  return t.myHintApproved;
}

/**
 * An account's own view: their codes, the merchants who entered them, and the
 * commission each of those merchants' payments suggests. They make and change
 * their own codes here, and a creator reviews them (migration 742). Payouts
 * are marked by the Zimos team.
 */
export function MyReferralsPage() {
  const t = useT(REFERRAL_STRINGS);
  const toast = useToast();
  const { can, user } = useAuth();
  const creator = isCreator(user);
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
  const hint = creator ? undefined : reviewHint(form?.code);

  const save = (input: AdminReferralCodeInput & { code?: string }) =>
    form?.code
      ? adminApi.updateOwnReferralCode(form.code.id, input)
      : adminApi.createOwnReferralCode(input as AdminReferralCodeInput & { code: string });

  function saved(code: AdminReferralCode) {
    setForm(null);
    toast.success(fmt(code.approvalStatus === "pending" ? t.listSentForReview : t.mySaved, { code: isolate(code.code) }));
    void mine.refresh({ silent: true });
  }

  return (
    <div>
      <PageHeader
        title={t.myTitle}
        description={t.myDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            {can(P.AGENTS_CREATE) && (
              <Button variant="outline" onClick={() => setAddingAgent(true)}>
                <UserPlus /> {t.myAddAgent}
              </Button>
            )}
            <Button onClick={() => setForm({})}>
              <Plus /> {t.listNewCode}
            </Button>
          </div>
        }
      />

      <DataState loading={mine.loading && !mine.data} error={mine.error} onRetry={() => void mine.refresh()}>
        {agent && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">{t.myCodes}</h2>
              {agent.codes.length === 0 ? (
                <EmptyBlock message={t.myEmpty} />
              ) : (
                <Panel flush>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>{t.code}</Th>
                        <Th>{t.myMerchantDiscount}</Th>
                        <Th>{t.myYourCommission}</Th>
                        <Th className="text-end">{t.merchants}</Th>
                        <Th>{t.suggestedCommission}</Th>
                        <Th>{t.status}</Th>
                        <Th className="text-end">
                          <span className="sr-only">{t.actions}</span>
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
                            <CommissionTotals totals={c.commission} empty={t.noPaymentsYet} />
                          </Td>
                          <Td>
                            <CodeStatus code={c} />
                          </Td>
                          <Td className="text-end">
                            {/* With the flag off, a code with a schedule has nothing here to edit it with. */}
                            {(v2 || c.kind !== "schedule") && (
                              <Button size="icon-sm" variant="ghost" aria-label={fmt(t.codeEdit, { code: isolate(c.code) })} onClick={() => setForm({ code: c })}>
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
              <h2 className="mb-3 text-lg font-semibold text-ink">{t.myMerchantsTitle}</h2>
              {mine.data!.merchants.length === 0 ? (
                <EmptyBlock message={t.myNoMerchants} />
              ) : (
                <MerchantsTable merchants={mine.data!.merchants} linkWorkspaces={false} />
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">{t.myPaymentsTitle}</h2>
                <FilterChips options={payoutOptions()} value={status} onChange={setStatus} />
              </div>
              <p className="mb-3 text-sm text-ink-soft">{t.myPaymentsNote}</p>
              <DataState loading={ledger.loading && !ledger.data} error={ledger.error} onRetry={() => void ledger.refresh()}>
                {ledger.data && ledger.data.totals.length > 0 && (
                  <div className="mb-3">
                    <CommissionTotals totals={ledger.data.totals} />
                  </div>
                )}
                {(ledger.data?.commissions.length ?? 0) === 0 ? (
                  <EmptyBlock message={status === "all" ? t.myNoPayments : t.noRowsMatch} />
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
          code={form.code ? codeToEdit(form.code, creator) : undefined}
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
          code={form.code ? codeToEdit(form.code, creator) : undefined}
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
            toast.success(fmt(t.myAgentAdded, { email }));
          }}
        />
      )}
    </div>
  );
}
