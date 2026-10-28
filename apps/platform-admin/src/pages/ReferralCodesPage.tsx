import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminReferralCodeRow, ReferralAudience, ReferralCodeState } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips, SearchInput, SelectField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ReferralCodeFormModal } from "@/components/referralCodeForm";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate } from "@/lib/format";
import { AUDIENCE_LABELS, STATE_LABELS, describeCodeDiscount, describeGrant, usesLabel } from "@/lib/referralCodes";
import { P } from "@/lib/permissions";

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
const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...(Object.keys(STATE_LABELS) as ReferralCodeState[]).map((s) => ({ value: s, label: STATE_LABELS[s] })),
];

export function ReferralCodesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [state, setState] = useState<StateFilter>("all");
  const [agentId, setAgentId] = useState("");
  const [audience, setAudience] = useState<"" | ReferralAudience>("");
  const [creating, setCreating] = useState(false);

  const list = useAsync(
    () => adminApi.listReferralCodes({ q: q.trim() || undefined, state: state === "all" ? undefined : state, agentId: agentId || undefined, audience: audience || undefined }),
    [q, state, agentId, audience]
  );
  const agents = useAsync(() => adminApi.listAgents(), []);
  const plans = useAsync(() => adminApi.listPlans(), []);
  const v2 = list.data?.v2Enabled ?? false;
  const codes = list.data?.codes ?? [];

  return (
    <div>
      <PageHeader
        title="Referral codes"
        description="Every code, with or without an agent: its discount, who can enter it, and how many stores used it."
        back={{ to: "/agents", label: "Agents" }}
        actions={
          can(P.AGENTS_MANAGE) &&
          v2 && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New code
            </Button>
          )
        }
      />
      {list.data && !v2 && (
        <Alert className="mb-4">
          Codes with limits, schedules or no agent are switched off (REFERRAL_CODES_V2_ENABLED). Codes are created on each agent&apos;s page, as before.
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search code or label…" />
        <SelectField label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Any agent</option>
          <option value="none">No agent</option>
          {(agents.data?.agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
            </option>
          ))}
        </SelectField>
        <SelectField label="Who can enter it" value={audience} onChange={(e) => setAudience(e.target.value as "" | ReferralAudience)}>
          <option value="">Anyone</option>
          {(Object.keys(AUDIENCE_LABELS) as ReferralAudience[]).map((a) => (
            <option key={a} value={a}>
              {AUDIENCE_LABELS[a]}
            </option>
          ))}
        </SelectField>
      </div>
      <FilterChips className="mb-4" options={STATE_OPTIONS} value={state} onChange={setState} />

      <DataState skeleton={<ListSkeleton variant="table" />} loading={list.loading && !list.data} error={list.error} onRetry={() => void list.refresh()}>
        {codes.length === 0 ? (
          <EmptyBlock message="No codes match." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Code</Th>
                  <Th>Agent</Th>
                  <Th>Discount</Th>
                  <Th>Who</Th>
                  <Th className="text-end">Used</Th>
                  <Th>Dates</Th>
                  <Th>State</Th>
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
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            toast.success(`${saved.code} is ready.`);
            navigate(`/referral-codes/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}

function CodeRow({ code }: { code: AdminReferralCodeRow }) {
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
          <span className="text-ink-soft">No agent</span>
        )}
      </Td>
      <Td className="align-top text-sm">
        {describeCodeDiscount(code)}
        {grant && <span className="block text-xs text-ink-soft">+ {grant}</span>}
      </Td>
      <Td className="align-top text-sm">{AUDIENCE_LABELS[code.audience ?? "any"]}</Td>
      <Td className="text-end align-top text-sm tabular-nums">{usesLabel(code)}</Td>
      <Td className="align-top text-xs whitespace-nowrap text-ink-soft">
        {code.startsAt || code.endsAt ? `${code.startsAt ? formatDate(code.startsAt) : "—"} → ${code.endsAt ? formatDate(code.endsAt) : "—"}` : "Any time"}
      </Td>
      <Td className="align-top">
        <StatusBadge tone={STATE_TONE[code.state ?? (code.active ? "active" : "inactive")]}>{STATE_LABELS[code.state ?? (code.active ? "active" : "inactive")]}</StatusBadge>
      </Td>
    </TableRow>
  );
}
