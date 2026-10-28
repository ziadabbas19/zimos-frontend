import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminAgent, AdminAgentLink, BillingCycle, ReferralCommissionBasis } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { RateSteps } from "@/components/referralCodeForm";
import { useAuth } from "@/context/AuthContext";
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { describeCommissionSteps, toLocalInput, type RateStepDraft } from "@/lib/referralCodes";
import { useAsync } from "@/lib/useAsync";
import { RedemptionTable } from "@/pages/ReferralCodeDetailPage";

/**
 * A store's referral codes and agent (migration 725), on its page: every code
 * it entered (its first marked), the agent earning on its payments now, and
 * every link it had, who set or ended it and when. The console links a store
 * to an agent by hand, moves it to another or ends the link
 * (REFERRAL_CODES_V2_ENABLED; ending works either way).
 */

const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Monthly", yearly: "Yearly" };

function linkTermsText(link: AdminAgentLink): string {
  if (!link.terms) return `As its code: ${link.code?.code ?? "the code"}'s rate on every payment that carries it`;
  const m = describeCommissionSteps(link.terms.monthly);
  const y = describeCommissionSteps(link.terms.yearly);
  return m === y ? m : `Monthly: ${m}. Yearly: ${y}`;
}

const SOURCE_TEXT: Record<AdminAgentLink["source"], string> = { manual: "Set by hand", code: "From a code" };

export function WorkspaceReferralsPanel({ workspaceId }: { workspaceId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.getWorkspaceReferrals(workspaceId), [workspaceId]);
  const agents = useAsync(() => (can(P.AGENTS_MANAGE) ? adminApi.listAgents() : Promise.resolve(null)), []);
  const [linking, setLinking] = useState(false);
  const [ending, setEnding] = useState<AdminAgentLink | null>(null);
  const manage = can(P.AGENTS_MANAGE);
  const open = data?.openLink ?? null;

  return (
    <section aria-label="Referral codes and agent" className="space-y-4">
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-ink">Agent</h3>
                  {open ? (
                    <div className="mt-1 space-y-0.5 text-sm">
                      <p>
                        <Link to={`/agents/${open.agent.id}`} className="font-medium hover:text-primary hover:underline">
                          {open.agent.fullName ?? "Agent"}
                        </Link>{" "}
                        <span className="text-ink-soft">
                          · {SOURCE_TEXT[open.source]} · since {formatDate(open.startsAt)}
                          {open.endsAt ? ` · until ${formatDate(open.endsAt)}` : ""}
                        </span>
                      </p>
                      <p className="text-ink-soft">{linkTermsText(open)}</p>
                      <p className="text-ink-soft">Commission on {open.commissionBasis === "list" ? "the list price" : "what the store paid"}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-ink-soft">No agent earns on this store&apos;s payments.</p>
                  )}
                </div>
                {manage && (
                  <div className="flex gap-2">
                    {data.v2Enabled && (
                      <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
                        {open ? "Change agent" : "Link to an agent"}
                      </Button>
                    )}
                    {open && (
                      <Button variant="outline" size="sm" onClick={() => setEnding(open)}>
                        End link
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            <div>
              <h3 className="mb-2 font-medium text-ink">Codes this store entered</h3>
              {data.redemptions.length === 0 ? <EmptyBlock message="No code yet." /> : <RedemptionTable rows={data.redemptions} show="code" />}
            </div>

            {data.links.length > 0 && (
              <div>
                <h3 className="mb-2 font-medium text-ink">Agent history</h3>
                <Panel flush>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>Agent</Th>
                        <Th>How</Th>
                        <Th>From</Th>
                        <Th>Ended</Th>
                        <Th>Commission</Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.links.map((l) => (
                        <TableRow key={l.id}>
                          <Td className="align-top text-sm">{l.agent.fullName ?? "Agent"}</Td>
                          <Td className="align-top text-sm">
                            {SOURCE_TEXT[l.source]}
                            {l.code?.code && (
                              <span className="block">
                                <Mono>{l.code.code}</Mono>
                              </span>
                            )}
                            {l.createdBy && <span className="block text-xs text-ink-soft">by {l.createdBy.fullName}</span>}
                          </Td>
                          <Td className="align-top text-sm whitespace-nowrap">{formatDateTime(l.startsAt)}</Td>
                          <Td className="align-top text-sm">
                            {l.open ? (
                              <StatusBadge tone="success">Open</StatusBadge>
                            ) : (
                              <>
                                {formatDateTime(l.endedAt ?? "")}
                                <span className="block text-xs text-ink-soft">
                                  {l.endReason === "replaced" ? "Moved to another agent" : "Ended"}
                                  {l.endedBy ? ` by ${l.endedBy.fullName}` : ""}
                                </span>
                              </>
                            )}
                          </Td>
                          <Td className="align-top text-xs text-ink-soft">
                            {linkTermsText(l)}
                            {l.note && <span className="block">“{l.note}”</span>}
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Panel>
              </div>
            )}
          </>
        )}
      </DataState>

      {linking && (
        <AgentLinkModal
          workspaceId={workspaceId}
          agents={agents.data?.agents ?? []}
          replacing={open}
          defaultRateBp={agents.data?.defaultCommissionRateBp ?? 3000}
          onClose={() => setLinking(false)}
          onSaved={() => {
            setLinking(false);
            toast.success("Linked. The agent earns from the store's next payment.");
            void refresh({ silent: true });
          }}
        />
      )}
      {ending && (
        <ConfirmDialog
          open
          title="End this link?"
          description="From now on no agent earns on this store's payments. Commissions already written stay."
          confirmLabel="End link"
          onCancel={() => setEnding(null)}
          onConfirm={async () => {
            // A refusal is shown in the dialog itself.
            await adminApi.endAgentLink(ending.id);
            toast.success("Link ended.");
            setEnding(null);
            void refresh({ silent: true });
          }}
        />
      )}
    </section>
  );
}

const draftSteps = (rows: RateStepDraft[]) =>
  rows.map((r, i) => {
    const last = i === rows.length - 1;
    const count = r.count.trim() ? Number(r.count) : null;
    if (count == null && !last) throw new Error("Only the last step can run for every payment after.");
    if (count != null && (!Number.isInteger(count) || count < 1)) throw new Error("A step's payments are a whole number, 1 or more.");
    const percent = Number(r.percent);
    if (!r.percent.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("A rate is a percentage from 0 to 100.");
    return { count, rateBp: Math.round(percent * 100) };
  });

export function AgentLinkModal({
  workspaceId,
  agents,
  replacing,
  defaultRateBp,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  agents: AdminAgent[];
  replacing: AdminAgentLink | null;
  defaultRateBp: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [endsAt, setEndsAt] = useState("");
  const [separate, setSeparate] = useState(false);
  const [monthly, setMonthly] = useState<RateStepDraft[]>([{ count: "", percent: String(defaultRateBp / 100) }]);
  const [yearly, setYearly] = useState<RateStepDraft[]>([{ count: "", percent: String(defaultRateBp / 100) }]);
  const [basis, setBasis] = useState<ReferralCommissionBasis>("paid");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let terms;
    try {
      const m = draftSteps(monthly);
      terms = { monthly: m, yearly: separate ? draftSteps(yearly) : m };
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    setBusy(true);
    try {
      await adminApi.createAgentLink(workspaceId, {
        agentId,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        terms,
        commissionBasis: basis,
        note: note.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={replacing ? "Change the store's agent" : "Link the store to an agent"}
      description={
        replacing
          ? `${replacing.agent.fullName ?? "The current agent"} stops earning now; the new agent earns from the start date.`
          : "The agent earns a commission on every payment of this store from the start date."
      }
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="agent-link-form" disabled={busy || !agentId}>
            {busy ? "Saving…" : "Link"}
          </Button>
        </>
      }
    >
      <form id="agent-link-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <SelectField label="Agent" required value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Choose an agent</option>
          {agents
            .filter((a) => a.isAgent && a.id !== replacing?.agent.id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} ({a.email})
              </option>
            ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <TextField label="Ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} hint="Optional." />
        </div>
        <Toggle label="Different for monthly and yearly" checked={separate} onChange={setSeparate} />
        {(separate ? (["monthly", "yearly"] as BillingCycle[]) : (["monthly"] as BillingCycle[])).map((cycle) => (
          <div key={cycle}>
            {separate && <h4 className="mb-2 text-sm font-medium text-ink">{CYCLE_LABEL[cycle]}</h4>}
            <RateSteps label="commission" steps={cycle === "monthly" ? monthly : yearly} onChange={cycle === "monthly" ? setMonthly : setYearly} />
          </div>
        ))}
        <SelectField label="Commission on" value={basis} onChange={(e) => setBasis(e.target.value as ReferralCommissionBasis)}>
          <option value="paid">What the store paid</option>
          <option value="list">The list price</option>
        </SelectField>
        <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
      </form>
    </Modal>
  );
}

/** Every code entered on any store this account owns, on the person's page. */
export function UserReferralsPanel({ userId }: { userId: string }) {
  const { data, loading, error, refresh } = useAsync(() => adminApi.getUserReferrals(userId), [userId]);
  return (
    <section aria-label="Referral codes">
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (data.redemptions.length === 0 ? <EmptyBlock message="No referral code entered on this account's stores." /> : <RedemptionTable rows={data.redemptions} show="both" />)}
      </DataState>
    </section>
  );
}
