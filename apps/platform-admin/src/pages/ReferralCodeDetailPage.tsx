import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminRedemption, AdminRedemptionParams, BillingCycle } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { FilterChips, SearchInput, SelectField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CommissionTotals } from "@/components/referrals";
import { ReferralCodeFormModal } from "@/components/referralCodeForm";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatMinorMoneyExact } from "@/lib/format";
import {
  AUDIENCE_LABELS,
  SOURCE_LABELS,
  STATE_LABELS,
  describeCommissionSteps,
  describeDiscountSteps,
  describeGrant,
  usesLabel,
} from "@/lib/referralCodes";
import { P } from "@/lib/permissions";
import { STATE_TONE } from "./ReferralCodesPage";

/**
 * One referral code (migration 725): its settings, its schedules per cycle,
 * what switching it off would cost, and every store that entered it, with
 * search and filters.
 */

const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Monthly", yearly: "Yearly" };

export function ReferralCodeDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => adminApi.getReferralCode(id), [id]);
  const [editing, setEditing] = useState(false);
  const agents = useAsync(() => adminApi.listAgents(), []);
  const plans = useAsync(() => adminApi.listPlans(), []);

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

  return (
    <div>
      <PageHeader
        title={code.code}
        description={code.label ?? undefined}
        back={{ to: "/referral-codes", label: "Referral codes" }}
        actions={
          editable && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <dl className="space-y-2">
            <DetailRow label="State">
              <StatusBadge tone={STATE_TONE[state]}>{STATE_LABELS[state]}</StatusBadge>
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
                  <Link to={`/workspaces/${r.workspace.id}`} className="block font-medium hover:text-primary hover:underline">
                    {r.workspace.name ?? "Deleted store"}
                  </Link>
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
