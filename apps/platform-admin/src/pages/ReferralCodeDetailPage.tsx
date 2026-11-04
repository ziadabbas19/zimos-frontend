import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Pencil, X } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminPlan, AdminRedemption, AdminRedemptionParams, AdminReferralCode, BillingCycle } from "@store-builder/api-client";
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
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatMinorMoneyExact } from "@/lib/format";
import {
  AUDIENCE_LABELS,
  SOURCE_LABELS,
  STATE_LABELS,
  describeCodeCommission,
  describeCodeDiscount,
  describeCommissionSteps,
  describeDiscountSteps,
  describeGrant,
  usesLabel,
} from "@/lib/referralCodes";
import { P } from "@/lib/permissions";
import { neverApproved } from "@/lib/referrals";
import { STATE_TONE } from "./ReferralCodesPage";

/**
 * One referral code (migration 725): its settings, its schedules per cycle,
 * what switching it off would cost, and every store that entered it, with
 * search and filters.
 */

const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Monthly", yearly: "Yearly" };

/** What a reviewer reads of a code, line by line, to set a waiting change against it. */
function readingOf(code: AdminReferralCode, plans: AdminPlan[]): [string, string][] {
  const planNames = (code.allowedPlanIds ?? []).map((id) => plans.find((p) => p.id === id)?.name ?? "A plan").sort();
  return [
    ["Discount", describeCodeDiscount(code)],
    ["Commission", describeCodeCommission(code)],
    ["Commission on", code.commissionBasis === "list" ? "The list price" : "What the merchant paid"],
    ["Who can enter it", AUDIENCE_LABELS[code.audience ?? "any"]],
    ["Starts", code.startsAt ? formatDateTime(code.startsAt) : "Any time"],
    ["Ends", code.endsAt ? formatDateTime(code.endsAt) : "Never"],
    ["Use limit", code.maxUses == null ? "No limit" : String(code.maxUses)],
    ["Plans", planNames.length ? planNames.join(", ") : "Any plan"],
    ["Billing", code.allowedCycles?.length ? code.allowedCycles.map((c) => CYCLE_LABEL[c]).join(", ") : "Monthly and yearly"],
    ["Minimum plan price", code.minPrice ? formatMinorMoneyExact(code.minPrice.amount, code.minPrice.currency) : "None"],
    ["One-time benefit", describeGrant(code.grant) ?? "None"],
    ["Links the store", code.linksAgent === false ? "No" : "Yes"],
  ];
}

export function ReferralCodeDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { can } = useAuth();
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
        <PageHeader title="Referral code" back={{ to: "/referral-codes", label: "Referral codes" }} />
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
  const reviewable = pending && can(P.REFERRAL_CODES_APPROVE);
  const proposed = code.proposed;
  const reading = readingOf(code, plans.data ?? []);
  const changes = proposed ? readingOf(proposed, plans.data ?? []).filter(([, value], i) => value !== reading[i][1]) : [];
  const reviewed = (message: string) => {
    setReview(null);
    setReason("");
    toast.success(message);
    void refresh({ silent: true });
  };

  return (
    <div>
      <PageHeader
        title={code.code}
        description={code.label ?? undefined}
        back={{ to: "/referral-codes", label: "Referral codes" }}
        actions={
          (editable || reviewable) && (
            <div className="flex flex-wrap gap-2">
              {reviewable && (
                <>
                  <Button onClick={() => setReview("approve")}>
                    <Check /> Approve
                  </Button>
                  {/* With the flag off, a code with a schedule has nothing here to edit it with. */}
                  {(data.v2Enabled || code.kind !== "schedule") && (
                    <Button variant="outline" onClick={() => setReview("edit")}>
                      <Pencil /> Edit and approve
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setReview("reject")}>
                    <X /> Reject
                  </Button>
                </>
              )}
              {editable && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </Button>
              )}
            </div>
          )
        }
      />

      {pending && (
        <Panel className="mb-4">
          <h2 className="mb-2 font-medium text-ink">{proposed ? "A change is waiting for review" : "This new code is waiting for review"}</h2>
          {proposed ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">Until it&rsquo;s approved, stores using this code keep what was approved, and new stores can&rsquo;t enter it.</p>
              <dl className="space-y-2">
                {changes.map(([label, value]) => (
                  <DetailRow key={label} label={label}>
                    {reading.find(([key]) => key === label)?.[1]} → <strong>{value}</strong>
                  </DetailRow>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-ink-soft">It stays off until it&rsquo;s approved. Its settings are below.</p>
          )}
        </Panel>
      )}
      {(code.approvalStatus === "rejected" || code.changesRejected) && (
        <Alert variant="danger" className="mb-4">
          {code.changesRejected ? "The last change to this code was rejected; it goes on as approved." : "This code was rejected."}
          {code.approvalNote && ` Reason: ${code.approvalNote}`}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <dl className="space-y-2">
            <DetailRow label="State">
              <span className="flex flex-wrap gap-1">
                {!neverApproved(code) && <StatusBadge tone={STATE_TONE[state]}>{STATE_LABELS[state]}</StatusBadge>}
                <ApprovalBadge code={code} />
              </span>
            </DetailRow>
            <DetailRow label="Agent">
              {code.agent ? (
                <Link to={`/agents/${code.agent.id}`} className="hover:text-primary hover:underline">
                  {code.agent.fullName}
                </Link>
              ) : (
                "No agent (a discount only)"
              )}
            </DetailRow>
            <DetailRow label="Who can enter it">{AUDIENCE_LABELS[code.audience ?? "any"]}</DetailRow>
            <DetailRow label="Used">{usesLabel(code)}</DetailRow>
            <DetailRow label="Dates">
              {code.startsAt || code.endsAt ? `${code.startsAt ? formatDateTime(code.startsAt) : "—"} → ${code.endsAt ? formatDateTime(code.endsAt) : "—"}` : "Any time"}
            </DetailRow>
            <DetailRow label="Plans">{planNames.length ? planNames.join(", ") : "Any plan"}</DetailRow>
            <DetailRow label="Billing">{code.allowedCycles?.length ? code.allowedCycles.map((c) => CYCLE_LABEL[c]).join(", ") : "Monthly and yearly"}</DetailRow>
            {code.minPrice && <DetailRow label="Minimum plan price">{formatMinorMoneyExact(code.minPrice.amount, code.minPrice.currency)}</DetailRow>}
            {grant && <DetailRow label="One-time benefit">{grant}</DetailRow>}
            {code.agent && (
              <>
                <DetailRow label="Commission on">{code.commissionBasis === "list" ? "The list price" : "What the merchant paid"}</DetailRow>
                <DetailRow label="Links the store">{code.linksAgent === false ? "No" : "Yes, when it has no agent yet"}</DetailRow>
              </>
            )}
            <DetailRow label="Suggested commission">
              <CommissionTotals totals={code.commission} empty="No payments yet" />
            </DetailRow>
          </dl>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-medium text-ink">{code.kind === "legacy" ? "Every payment (no schedule)" : "Payment by payment"}</h2>
          {terms &&
            (["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
              <div key={cycle} className="mb-3">
                <h3 className="text-sm font-medium text-ink">{CYCLE_LABEL[cycle]}</h3>
                <p className="text-sm">{describeDiscountSteps(terms[cycle].discount)}</p>
                {code.agent && <p className="text-sm text-ink-soft">Commission: {describeCommissionSteps(terms[cycle].commission)}</p>}
              </div>
            ))}
          {impact.currentStores > 0 && (
            <Alert className="mt-2">
              {impact.currentStores} store(s) use it now
              {impact.trialingUnpaid > 0 ? `; ${impact.trialingUnpaid} on a trial haven't paid yet and would lose its discount if it were switched off.` : "."}
            </Alert>
          )}
        </Panel>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-medium text-ink">Stores that entered it</h2>
      <CodeRedemptions codeId={code.id} />

      {editing && (
        <ReferralCodeFormModal
          code={code}
          impact={impact}
          agents={agents.data?.agents ?? []}
          plans={plans.data ?? []}
          defaultRateBp={data.defaultCommissionRateBp}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Saved. It applies from the next payment.");
            void refresh({ silent: true });
          }}
        />
      )}
      {review === "edit" && data.v2Enabled && (
        <ReferralCodeFormModal
          code={proposed ?? code}
          ownerId={code.agentId ?? undefined}
          agents={[]}
          plans={plans.data ?? []}
          defaultRateBp={data.defaultCommissionRateBp}
          description="Your changes go on the code with this approval."
          submitLabel="Approve"
          submit={(input) => adminApi.approveReferralCode(code.id, input)}
          onClose={() => setReview(null)}
          onSaved={(saved) => reviewed(`${saved.code} approved.`)}
        />
      )}
      {review === "edit" && !data.v2Enabled && (
        <CodeModal
          code={proposed ?? code}
          hideActive
          defaultRateBp={data.defaultCommissionRateBp}
          description="Your changes go on the code with this approval."
          submitLabel="Approve"
          onClose={() => setReview(null)}
          onSubmit={async (input) => {
            const saved = await adminApi.approveReferralCode(code.id, input);
            reviewed(`${saved.code} approved.`);
          }}
        />
      )}
      <ConfirmDialog
        open={review === "approve"}
        title={`Approve ${code.code}?`}
        description={proposed ? "The change applies to payments still to come, and new stores can enter the code again." : "It switches on, and merchants can enter it."}
        confirmLabel="Approve"
        busyLabel="Approving…"
        onCancel={() => setReview(null)}
        onConfirm={async () => {
          const saved = await adminApi.approveReferralCode(code.id);
          reviewed(`${saved.code} approved.`);
        }}
      />
      <ConfirmDialog
        open={review === "reject"}
        title={`Reject ${code.code}?`}
        description={proposed ? "The change is dropped, and the code goes on as approved." : "It stays off. Its owner can change it and send it again."}
        confirmLabel="Reject"
        busyLabel="Rejecting…"
        destructive
        onCancel={() => setReview(null)}
        onConfirm={async () => {
          const saved = await adminApi.rejectReferralCode(code.id, reason.trim());
          reviewed(`${saved.code} rejected.`);
        }}
      >
        <TextAreaField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          hint="Optional. The code's owner can see it."
        />
      </ConfirmDialog>
    </div>
  );
}

type StatusFilter = "all" | "current" | "ended";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "current", label: "Using it" },
  { value: "ended", label: "Replaced" },
];

function CodeRedemptions({ codeId }: { codeId: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<"" | "new" | "existing">("");
  const params: AdminRedemptionParams = { q: q.trim() || undefined, status: status === "all" ? undefined : status, merchantKind: kind || undefined };
  const { data, loading, error, refresh } = useAsync(() => adminApi.listCodeRedemptions(codeId, params), [codeId, q, status, kind]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search store or owner email…" />
        <SelectField label="Merchant" value={kind} onChange={(e) => setKind(e.target.value as "" | "new" | "existing")}>
          <option value="">New and existing</option>
          <option value="new">New</option>
          <option value="existing">Existing</option>
        </SelectField>
      </div>
      <FilterChips className="mb-3" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {!data || data.redemptions.length === 0 ? (
          <EmptyBlock message="No store has entered it yet." />
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
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>{show === "code" ? "Code" : "Store"}</Th>
            <Th>Entered</Th>
            <Th>Discount</Th>
            <Th>Agent</Th>
            <Th>First payment with it</Th>
            <Th>Subscription</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <Td className="align-top">
                {show !== "code" && (
                  <CanLink permission={P.WORKSPACES_VIEW} to={`/workspaces/${r.workspace.id}`} className="block font-medium hover:text-primary hover:underline">
                    {r.workspace.name ?? "Deleted store"}
                  </CanLink>
                )}
                {show !== "store" && (
                  <Link to={`/referral-codes/${r.code.id}`} className="hover:text-primary hover:underline">
                    <Mono>{r.code.code}</Mono>
                  </Link>
                )}
                {show === "store" && r.owner?.email && <span className="block text-xs text-ink-soft">{r.owner.email}</span>}
                <span className="mt-1 flex flex-wrap gap-1">
                  {r.isFirst && <StatusBadge tone="primary">First code</StatusBadge>}
                  {!r.current && <StatusBadge tone="neutral">Replaced</StatusBadge>}
                  {r.merchantKind && <StatusBadge tone="info">{r.merchantKind === "new" ? "New merchant" : "Existing merchant"}</StatusBadge>}
                </span>
              </Td>
              <Td className="align-top text-sm whitespace-nowrap">
                {formatDate(r.createdAt)}
                <span className="block text-xs text-ink-soft">{SOURCE_LABELS[r.source]}</span>
              </Td>
              <Td className="align-top text-sm">
                {r.terms ? describeDiscountSteps(r.terms[r.billingCycle ?? "monthly"].discount) : "As the code stands"}
                {r.grant && <span className="block text-xs text-ink-soft">+ {describeGrant(r.grant)}</span>}
              </Td>
              <Td className="align-top text-sm">{r.agent?.fullName ?? (r.agent ? "Agent" : "—")}</Td>
              <Td className="align-top text-sm">
                {r.firstInvoice ? (
                  <>
                    {formatMinorMoneyExact(r.firstInvoice.amount, r.firstInvoice.currency)}
                    <span className="block text-xs text-ink-soft">
                      {formatMinorMoneyExact(r.firstInvoice.discountAmount, r.firstInvoice.currency)} off · {formatDate(r.firstInvoice.paidAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-soft">Not paid yet</span>
                )}
                <span className="block text-xs text-ink-soft">{r.paymentsMade} payment(s) with it</span>
              </Td>
              <Td className="align-top">{r.subscriptionStatus ? <Status value={r.subscriptionStatus} /> : "—"}</Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
