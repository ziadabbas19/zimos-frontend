import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Pencil, X } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminAgent, AdminPlan, AdminRedemption, AdminRedemptionParams, AdminReferralCode, BillingCycle } from "@store-builder/api-client";
import { CanLink } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { FilterChips, SearchInput, SelectField, TextAreaField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ApprovalBadge, CodeModal, CommissionTotals } from "@/components/referrals";
import { ReferralCodeFormModal } from "@/components/referralCodeForm";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatMinorMoneyExact } from "@/lib/format";
import {
  audienceLabels,
  cycleLabel,
  describeCodeCommission,
  describeCodeDiscount,
  describeCommissionSteps,
  describeDiscountSteps,
  describeGrant,
  sourceLabels,
  stateLabels,
  usesLabel,
} from "@/lib/referralCodes";
import { P, isCreator } from "@/lib/permissions";
import { codeToEdit, consoleReviewHint, neverApproved } from "@/lib/referrals";
import { REFERRAL_STRINGS, counted, isolate, rangeArrow, referralStrings, statusLabel } from "@/lib/referralStrings";
import { STATE_TONE } from "./ReferralCodesPage";

/**
 * One referral code (migration 725): its settings, its schedules per cycle,
 * what switching it off would cost, and every store that entered it, with
 * search and filters.
 */

/** What a reviewer reads of a code, line by line, to set a waiting change against it. */
function readingOf(code: AdminReferralCode, plans: AdminPlan[], agents: AdminAgent[]): [string, string][] {
  const t = referralStrings();
  const planNames = (code.allowedPlanIds ?? []).map((id) => plans.find((p) => p.id === id)?.name ?? t.detailAPlan).sort();
  const agentName = code.agentId ? (agents.find((a) => a.id === code.agentId)?.fullName ?? t.detailAnAgent) : t.noAgent;
  return [
    [t.agent, agentName],
    [t.discount, describeCodeDiscount(code)],
    [t.commission, describeCodeCommission(code)],
    [t.commissionOn, code.commissionBasis === "list" ? t.listPriceThe : t.whatMerchantPaid],
    [t.whoCanEnter, audienceLabels()[code.audience ?? "any"]],
    [t.starts, code.startsAt ? formatDateTime(code.startsAt) : t.anyTime],
    [t.ends, code.endsAt ? formatDateTime(code.endsAt) : t.detailNever],
    [t.detailUseLimit, code.maxUses == null ? t.noLimit : String(code.maxUses)],
    [t.plans, planNames.length ? planNames.join(t.listSeparator) : t.anyPlan],
    [t.billing, code.allowedCycles?.length ? code.allowedCycles.map((c) => cycleLabel(c)).join(t.listSeparator) : t.monthlyAndYearly],
    [t.minPlanPrice, code.minPrice ? formatMinorMoneyExact(code.minPrice.amount, code.minPrice.currency) : t.none],
    [t.oneTimeBenefit, describeGrant(code.grant) ?? t.none],
    [t.linksStore, code.linksAgent === false ? t.no : t.yes],
  ];
}

export function ReferralCodeDetailPage() {
  const t = useT(REFERRAL_STRINGS);
  const { id = "" } = useParams();
  const toast = useToast();
  const { can, user } = useAuth();
  const creator = isCreator(user);
  const { data, loading, error, refresh } = useAsync(() => adminApi.getReferralCode(id), [id]);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState<"approve" | "edit" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const agents = useAsync(() => adminApi.listAgents(), []);
  // Names the plans a code is limited to; without the permission that reads them the names stay out.
  const plans = useAsync(() => (can(P.PLANS_VIEW) ? adminApi.listPlans() : Promise.resolve([])), []);

  if (!data) {
    return (
      <div>
        <PageHeader title={t.referralCode} back={{ to: "/referral-codes", label: t.referralCodes }} />
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {null}
        </DataState>
      </div>
    );
  }

  const { code, impact } = data;
  const terms = code.terms ?? code.effectiveTerms ?? null;
  const state = code.state ?? (code.active ? "active" : "inactive");
  const planNames = (plans.data ?? []).filter((p) => code.allowedPlanIds?.includes(p.id)).map((p) => p.name);
  const grant = describeGrant(code.grant);
  // Editing the second kind needs the flag; a first-kind code is edited on its agent's page as before.
  const editable = can(P.AGENTS_MANAGE) && data.v2Enabled;
  const pending = code.approvalStatus === "pending";
  // Only a creator reviews what they made or changed.
  const ownWork = !creator && (code.authorIds ?? []).includes(user?.id ?? "");
  const reviewable = pending && can(P.REFERRAL_CODES_APPROVE) && !ownWork;
  const proposed = code.proposed;
  const agentList = agents.data?.agents ?? [];
  const reading = readingOf(code, plans.data ?? [], agentList);
  const changes = proposed ? readingOf(proposed, plans.data ?? [], agentList).filter(([, value], i) => value !== reading[i][1]) : [];
  const reviewed = (message: string) => {
    setReview(null);
    setReason("");
    toast.success(message);
    void refresh({ silent: true });
  };

  return (
    <div>
      <PageHeader
        title={isolate(code.code)}
        description={code.label ?? undefined}
        back={{ to: "/referral-codes", label: t.referralCodes }}
        actions={
          (editable || reviewable) && (
            <div className="flex flex-wrap gap-2">
              {reviewable && (
                <>
                  <Button onClick={() => setReview("approve")}>
                    <Check /> {t.approve}
                  </Button>
                  {/* With the flag off, a code with a schedule has nothing here to edit it with. */}
                  {(data.v2Enabled || code.kind !== "schedule") && (
                    <Button variant="outline" onClick={() => setReview("edit")}>
                      <Pencil /> {t.detailEditAndApprove}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setReview("reject")}>
                    <X /> {t.reject}
                  </Button>
                </>
              )}
              {editable && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> {t.edit}
                </Button>
              )}
            </div>
          )
        }
      />

      {pending && (
        <Panel className="mb-4">
          <h2 className="mb-2 font-medium text-ink">{proposed ? t.detailChangeWaiting : t.detailNewWaiting}</h2>
          {proposed ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">{t.detailUntilApproved}</p>
              <dl className="space-y-2">
                {changes.map(([label, value]) => (
                  <DetailRow key={label} label={label}>
                    {isolate(reading.find(([key]) => key === label)?.[1] ?? "")} {rangeArrow()} <strong>{isolate(value)}</strong>
                  </DetailRow>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-ink-soft">{t.detailStaysOff}</p>
          )}
          {can(P.REFERRAL_CODES_APPROVE) && ownWork && (
            <p className="mt-3 text-sm text-ink-soft">{t.detailOwnWork}</p>
          )}
        </Panel>
      )}
      {(code.approvalStatus === "rejected" || code.changesRejected) && (
        <Alert variant="danger" className="mb-4">
          {code.changesRejected ? t.detailLastChangeRejected : t.detailCodeRejected}
          {code.approvalNote && ` ${fmt(t.reasonValue, { reason: code.approvalNote })}`}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <dl className="space-y-2">
            <DetailRow label={t.state}>
              <span className="flex flex-wrap gap-1">
                {!neverApproved(code) && <StatusBadge tone={STATE_TONE[state]}>{stateLabels()[state]}</StatusBadge>}
                <ApprovalBadge code={code} />
              </span>
            </DetailRow>
            <DetailRow label={t.agent}>
              {code.agent ? (
                <Link to={`/agents/${code.agent.id}`} className="hover:text-primary hover:underline">
                  {code.agent.fullName}
                </Link>
              ) : (
                t.detailNoAgent
              )}
            </DetailRow>
            <DetailRow label={t.whoCanEnter}>{audienceLabels()[code.audience ?? "any"]}</DetailRow>
            <DetailRow label={t.detailUsed}>{usesLabel(code)}</DetailRow>
            <DetailRow label={t.detailDates}>
              {code.startsAt || code.endsAt ? `${isolate(code.startsAt ? formatDateTime(code.startsAt) : "—")} ${rangeArrow()} ${isolate(code.endsAt ? formatDateTime(code.endsAt) : "—")}` : t.anyTime}
            </DetailRow>
            <DetailRow label={t.plans}>{planNames.length ? planNames.join(t.listSeparator) : t.anyPlan}</DetailRow>
            <DetailRow label={t.billing}>{code.allowedCycles?.length ? code.allowedCycles.map((c) => cycleLabel(c)).join(t.listSeparator) : t.monthlyAndYearly}</DetailRow>
            {code.minPrice && <DetailRow label={t.minPlanPrice}>{formatMinorMoneyExact(code.minPrice.amount, code.minPrice.currency)}</DetailRow>}
            {grant && <DetailRow label={t.oneTimeBenefit}>{grant}</DetailRow>}
            {code.agent && (
              <>
                <DetailRow label={t.commissionOn}>{code.commissionBasis === "list" ? t.listPriceThe : t.whatMerchantPaid}</DetailRow>
                <DetailRow label={t.linksStore}>{code.linksAgent === false ? t.no : t.detailLinksWhenNoAgent}</DetailRow>
              </>
            )}
            <DetailRow label={t.suggestedCommission}>
              <CommissionTotals totals={code.commission} empty={t.noPaymentsYet} />
            </DetailRow>
          </dl>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-medium text-ink">{code.kind === "legacy" ? t.detailEveryPayment : t.detailPaymentByPayment}</h2>
          {terms &&
            (["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
              <div key={cycle} className="mb-3">
                <h3 className="text-sm font-medium text-ink">{cycleLabel(cycle)}</h3>
                <p className="text-sm">{describeDiscountSteps(terms[cycle].discount)}</p>
                {code.agent && <p className="text-sm text-ink-soft">{fmt(t.detailCommissionValue, { value: describeCommissionSteps(terms[cycle].commission) })}</p>}
              </div>
            ))}
          {impact.currentStores > 0 && (
            <Alert className="mt-2">
              {impact.trialingUnpaid > 0
                ? fmt(t.detailImpactTrial, { current: impact.currentStores, trial: impact.trialingUnpaid })
                : fmt(t.detailImpact, { current: impact.currentStores })}
            </Alert>
          )}
        </Panel>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-medium text-ink">{t.detailStoresEntered}</h2>
      <CodeRedemptions codeId={code.id} />

      {editing && (
        <ReferralCodeFormModal
          code={codeToEdit(code, creator)}
          impact={impact}
          agents={agents.data?.agents ?? []}
          plans={plans.data ?? []}
          defaultRateBp={data.defaultCommissionRateBp}
          description={creator ? undefined : consoleReviewHint()}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            toast.success(saved.approvalStatus === "pending" ? t.detailSentForReview : t.detailSavedNextPayment);
            void refresh({ silent: true });
          }}
        />
      )}
      {review === "edit" && data.v2Enabled && (
        <ReferralCodeFormModal
          code={proposed ?? code}
          ownerId={(proposed ?? code).agentId}
          agents={[]}
          plans={plans.data ?? []}
          defaultRateBp={data.defaultCommissionRateBp}
          description={t.detailApproveDescription}
          submitLabel={t.approve}
          submit={(input) => adminApi.approveReferralCode(code.id, input)}
          onClose={() => setReview(null)}
          onSaved={(saved) => reviewed(fmt(t.detailApprovedToast, { code: isolate(saved.code) }))}
        />
      )}
      {review === "edit" && !data.v2Enabled && (
        <CodeModal
          code={proposed ?? code}
          hideActive
          defaultRateBp={data.defaultCommissionRateBp}
          description={t.detailApproveDescription}
          submitLabel={t.approve}
          onClose={() => setReview(null)}
          onSubmit={async (input) => {
            const saved = await adminApi.approveReferralCode(code.id, input);
            reviewed(fmt(t.detailApprovedToast, { code: isolate(saved.code) }));
          }}
        />
      )}
      <ConfirmDialog
        open={review === "approve"}
        title={fmt(t.detailApproveTitle, { code: isolate(code.code) })}
        description={proposed ? t.detailApproveChange : t.detailApproveNew}
        confirmLabel={t.approve}
        cancelLabel={t.cancel}
        busyLabel={t.approving}
        onCancel={() => setReview(null)}
        onConfirm={async () => {
          const saved = await adminApi.approveReferralCode(code.id);
          reviewed(fmt(t.detailApprovedToast, { code: isolate(saved.code) }));
        }}
      />
      <ConfirmDialog
        open={review === "reject"}
        title={fmt(t.detailRejectTitle, { code: isolate(code.code) })}
        description={proposed ? t.detailRejectChange : t.detailRejectNew}
        confirmLabel={t.reject}
        cancelLabel={t.cancel}
        busyLabel={t.rejecting}
        destructive
        onCancel={() => setReview(null)}
        onConfirm={async () => {
          const saved = await adminApi.rejectReferralCode(code.id, reason.trim());
          reviewed(fmt(t.detailRejectedToast, { code: isolate(saved.code) }));
        }}
      >
        <TextAreaField
          label={t.reason}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          hint={t.detailReasonHint}
        />
      </ConfirmDialog>
    </div>
  );
}

type StatusFilter = "all" | "current" | "ended";

function statusOptions(): { value: StatusFilter; label: string }[] {
  const t = referralStrings();
  return [
    { value: "all", label: t.all },
    { value: "current", label: t.redUsingIt },
    { value: "ended", label: t.redReplaced },
  ];
}

function CodeRedemptions({ codeId }: { codeId: string }) {
  const t = useT(REFERRAL_STRINGS);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<"" | "new" | "existing">("");
  const params: AdminRedemptionParams = { q: q.trim() || undefined, status: status === "all" ? undefined : status, merchantKind: kind || undefined };
  const { data, loading, error, refresh } = useAsync(() => adminApi.listCodeRedemptions(codeId, params), [codeId, q, status, kind]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <SearchInput value={q} onChange={setQ} placeholder={t.redSearch} />
        <SelectField label={t.merchant} value={kind} onChange={(e) => setKind(e.target.value as "" | "new" | "existing")}>
          <option value="">{t.redNewAndExisting}</option>
          <option value="new">{t.redNew}</option>
          <option value="existing">{t.redExisting}</option>
        </SelectField>
      </div>
      <FilterChips className="mb-3" options={statusOptions()} value={status} onChange={setStatus} />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {!data || data.redemptions.length === 0 ? (
          <EmptyBlock message={t.redEmpty} />
        ) : (
          <RedemptionTable rows={data.redemptions} show="store" />
        )}
      </DataState>
    </div>
  );
}

/** A store's uses of codes, or a code's stores: date, code, kind of discount, agent, the payment it applied to. */
/** `show`: the store (a code's list), the code (a store's), or both (an account's). */
export function RedemptionTable({ rows, show }: { rows: AdminRedemption[]; show: "store" | "code" | "both" }) {
  const t = useT(REFERRAL_STRINGS);
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>{show === "code" ? t.code : t.store}</Th>
            <Th>{t.redEntered}</Th>
            <Th>{t.discount}</Th>
            <Th>{t.agent}</Th>
            <Th>{t.redFirstPaymentWithIt}</Th>
            <Th>{t.subscription}</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <Td className="align-top">
                {show !== "code" && (
                  <CanLink permission={P.WORKSPACES_VIEW} to={`/workspaces/${r.workspace.id}`} className="block font-medium hover:text-primary hover:underline">
                    {r.workspace.name ?? t.redDeletedStore}
                  </CanLink>
                )}
                {show !== "store" && (
                  <Link to={`/referral-codes/${r.code.id}`} className="hover:text-primary hover:underline">
                    <Mono>{r.code.code}</Mono>
                  </Link>
                )}
                {show === "store" && r.owner?.email && <span className="block text-xs text-ink-soft">{r.owner.email}</span>}
                <span className="mt-1 flex flex-wrap gap-1">
                  {r.isFirst && <StatusBadge tone="primary">{t.redFirstCode}</StatusBadge>}
                  {!r.current && <StatusBadge tone="neutral">{t.redReplaced}</StatusBadge>}
                  {r.merchantKind && <StatusBadge tone="info">{r.merchantKind === "new" ? t.redNewMerchant : t.redExistingMerchant}</StatusBadge>}
                </span>
              </Td>
              <Td className="align-top text-sm whitespace-nowrap">
                {formatDate(r.createdAt)}
                <span className="block text-xs text-ink-soft">{sourceLabels()[r.source]}</span>
              </Td>
              <Td className="align-top text-sm">
                {r.terms ? describeDiscountSteps(r.terms[r.billingCycle ?? "monthly"].discount) : t.redAsCodeStands}
                {r.grant && <span className="block text-xs text-ink-soft">+ {describeGrant(r.grant)}</span>}
              </Td>
              <Td className="align-top text-sm">{r.agent?.fullName ?? (r.agent ? t.agentUnnamed : "—")}</Td>
              <Td className="align-top text-sm">
                {r.firstInvoice ? (
                  <>
                    {formatMinorMoneyExact(r.firstInvoice.amount, r.firstInvoice.currency)}
                    <span className="block text-xs text-ink-soft">
                      {fmt(t.redFirstInvoice, { amount: formatMinorMoneyExact(r.firstInvoice.discountAmount, r.firstInvoice.currency), date: formatDate(r.firstInvoice.paidAt) })}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-soft">{t.redNotPaid}</span>
                )}
                <span className="block text-xs text-ink-soft">{counted(t, "paymentsWithIt", r.paymentsMade)}</span>
              </Td>
              <Td className="align-top">{r.subscriptionStatus ? <Status value={r.subscriptionStatus} label={statusLabel(r.subscriptionStatus)} /> : "—"}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
