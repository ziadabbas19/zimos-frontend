import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminReferralCodeRow, ReferralAudience, ReferralCodeApproval, ReferralCodeState } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, SearchInput, SelectField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { AgentLinkRequests } from "@/components/agentLinkRequests";
import { ApprovalBadge } from "@/components/referrals";
import { ReferralCodeFormModal } from "@/components/referralCodeForm";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate } from "@/lib/format";
import { audienceLabels, describeCodeDiscount, describeGrant, stateLabels, usesLabel } from "@/lib/referralCodes";
import { P, isCreator } from "@/lib/permissions";
import { neverApproved, newCodeReviewHint } from "@/lib/referrals";
import { REFERRAL_STRINGS, isolate, rangeArrow, referralStrings } from "@/lib/referralStrings";

/**
 * Agents → Referral codes (migration 725): every code, with or without an
 * agent — what it takes off, who may enter it, how many stores used it of
 * its limit, and its state. A row opens the code's page.
 */

export const STATE_TONE: Record<ReferralCodeState, Tone> = {
  active: "success",
  inactive: "neutral",
  scheduled: "info",
  expired: "warning",
  full: "warning",
};

type StateFilter = "all" | ReferralCodeState;

function stateOptions(): { value: StateFilter; label: string }[] {
  const labels = stateLabels();
  return [
    { value: "all", label: referralStrings().all },
    ...(Object.keys(labels) as ReferralCodeState[]).map((s) => ({ value: s, label: labels[s] })),
  ];
}

type ApprovalFilter = "all" | Exclude<ReferralCodeApproval, "approved">;

export function ReferralCodesPage() {
  const t = useT(REFERRAL_STRINGS);
  const toast = useToast();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const [q, setQ] = useState("");
  const [state, setState] = useState<StateFilter>("all");
  const [agentId, setAgentId] = useState("");
  const [audience, setAudience] = useState<"" | ReferralAudience>("");
  const [approval, setApproval] = useState<ApprovalFilter>("all");
  const [creating, setCreating] = useState(false);

  const list = useAsync(
    () =>
      adminApi.listReferralCodes({
        q: q.trim() || undefined,
        state: state === "all" ? undefined : state,
        agentId: agentId || undefined,
        audience: audience || undefined,
        approval: approval === "all" ? undefined : approval,
      }),
    [q, state, agentId, audience, approval]
  );
  const agents = useAsync(() => adminApi.listAgents(), []);
  const plans = useAsync(() => (can(P.PLANS_VIEW) ? adminApi.listPlans() : Promise.resolve([])), []);
  const linkRequests = useAsync(() => adminApi.listAgentLinkRequests(), []);
  const v2 = list.data?.v2Enabled ?? false;
  const codes = list.data?.codes ?? [];
  const pendingReview = list.data?.pendingReview ?? 0;
  const approvalOptions: { value: ApprovalFilter; label: string }[] = [
    { value: "all", label: t.listAnyReview },
    { value: "pending", label: pendingReview > 0 ? fmt(t.listPendingCount, { count: pendingReview }) : t.pendingReview },
    { value: "rejected", label: t.rejected },
  ];
  const audiences = audienceLabels();

  return (
    <div>
      <PageHeader
        title={t.referralCodes}
        description={t.listDescription}
        back={{ to: "/agents", label: t.agents }}
        actions={
          can(P.AGENTS_MANAGE) &&
          v2 && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t.listNewCode}
            </Button>
          )
        }
      />
      {list.data && !v2 && (
        <Alert className="mb-4">{t.listV2Off}</Alert>
      )}

      {(linkRequests.data?.requests.length ?? 0) > 0 && (
        <div className="mb-4">
          <AgentLinkRequests showStore requests={linkRequests.data?.requests ?? []} onChanged={() => void linkRequests.refresh({ silent: true })} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchInput value={q} onChange={setQ} placeholder={t.listSearch} />
        <SelectField label={t.agent} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">{t.listAnyAgent}</option>
          <option value="none">{t.noAgent}</option>
          {(agents.data?.agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
            </option>
          ))}
        </SelectField>
        <SelectField label={t.whoCanEnter} value={audience} onChange={(e) => setAudience(e.target.value as "" | ReferralAudience)}>
          <option value="">{t.listAnyone}</option>
          {(Object.keys(audiences) as ReferralAudience[]).map((a) => (
            <option key={a} value={a}>
              {audiences[a]}
            </option>
          ))}
        </SelectField>
      </div>
      <FilterChips className="mb-2" options={stateOptions()} value={state} onChange={setState} />
      <FilterChips className="mb-4" options={approvalOptions} value={approval} onChange={setApproval} />

      <DataState skeleton={<ListSkeleton variant="table" />} loading={list.loading && !list.data} error={list.error} onRetry={() => void list.refresh()}>
        {codes.length === 0 ? (
          <EmptyBlock message={t.listEmpty} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.code}</Th>
                  <Th>{t.agent}</Th>
                  <Th>{t.discount}</Th>
                  <Th>{t.listWho}</Th>
                  <Th className="text-end">{t.detailUsed}</Th>
                  <Th>{t.detailDates}</Th>
                  <Th>{t.state}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <CodeRow key={c.id} code={c} />
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {creating && (
        <ReferralCodeFormModal
          agents={agents.data?.agents ?? []}
          plans={plans.data ?? []}
          defaultRateBp={list.data?.defaultCommissionRateBp ?? 3000}
          description={isCreator(user) ? undefined : newCodeReviewHint()}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            toast.success(fmt(saved.approvalStatus === "pending" ? t.listSentForReview : t.listReady, { code: isolate(saved.code) }));
            navigate(`/referral-codes/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}

function CodeRow({ code }: { code: AdminReferralCodeRow }) {
  const t = useT(REFERRAL_STRINGS);
  const grant = describeGrant(code.grant);
  return (
    <TableRow>
      <Td className="align-top">
        <Link to={`/referral-codes/${code.id}`} className="hover:text-primary hover:underline">
          <Mono>{code.code}</Mono>
        </Link>
        {code.label && <span className="block text-xs text-ink-soft">{code.label}</span>}
      </Td>
      <Td className="align-top text-sm">
        {code.agent ? (
          <Link to={`/agents/${code.agent.id}`} className="hover:text-primary hover:underline">
            {code.agent.fullName}
          </Link>
        ) : (
          <span className="text-ink-soft">{t.noAgent}</span>
        )}
      </Td>
      <Td className="align-top text-sm">
        {describeCodeDiscount(code)}
        {grant && <span className="block text-xs text-ink-soft">+ {grant}</span>}
      </Td>
      <Td className="align-top text-sm">{audienceLabels()[code.audience ?? "any"]}</Td>
      <Td className="text-end align-top text-sm tabular-nums">{usesLabel(code)}</Td>
      <Td className="align-top text-xs whitespace-nowrap text-ink-soft">
        {code.startsAt || code.endsAt ? `${isolate(code.startsAt ? formatDate(code.startsAt) : "—")} ${rangeArrow()} ${isolate(code.endsAt ? formatDate(code.endsAt) : "—")}` : t.anyTime}
      </Td>
      <Td className="align-top">
        <span className="flex flex-wrap gap-1">
          {!neverApproved(code) && (
            <StatusBadge tone={STATE_TONE[code.state ?? (code.active ? "active" : "inactive")]}>{stateLabels()[code.state ?? (code.active ? "active" : "inactive")]}</StatusBadge>
          )}
          <ApprovalBadge code={code} />
        </span>
      </Td>
    </TableRow>
  );
}
