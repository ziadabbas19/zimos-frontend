import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminAgent, AdminAgentLink, BillingCycle, ReferralCommissionBasis } from "@store-builder/api-client";
import { AgentLinkRequests } from "@/components/agentLinkRequests";
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
import { fmt, useT } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { P, isCreator } from "@/lib/permissions";
import { cycleLabel, describeCommissionSteps, toLocalInput, type RateStepDraft } from "@/lib/referralCodes";
import { REFERRAL_STRINGS, isolate, referralStrings } from "@/lib/referralStrings";
import { useAsync } from "@/lib/useAsync";
import { RedemptionTable } from "@/pages/ReferralCodeDetailPage";

/**
 * A store's referral codes and agent (migration 725), on its page: every code
 * it entered (its first marked), the agent earning on its payments now, and
 * every link it had, who set or ended it and when. The console links a store
 * to an agent by hand, moves it to another or ends the link
 * (REFERRAL_CODES_V2_ENABLED; ending works either way). From anyone but a creator
 * each of those waits for review (migration 743), one at a time per store.
 */

function linkTermsText(link: AdminAgentLink): string {
  const t = referralStrings();
  if (!link.terms) return fmt(t.storeTermsAsCode, { code: isolate(link.code?.code ?? t.storeTheCode) });
  const m = describeCommissionSteps(link.terms.monthly);
  const y = describeCommissionSteps(link.terms.yearly);
  return m === y ? m : fmt(t.describeByCycle, { monthly: m, yearly: y });
}

function sourceText(): Record<AdminAgentLink["source"], string> {
  const t = referralStrings();
  return { manual: t.linkSource_manual, code: t.linkSource_code };
}

export function WorkspaceReferralsPanel({ workspaceId }: { workspaceId: string }) {
  const t = useT(REFERRAL_STRINGS);
  const { can, user } = useAuth();
  const creator = isCreator(user);
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.getWorkspaceReferrals(workspaceId), [workspaceId]);
  const agents = useAsync(() => (can(P.AGENTS_MANAGE) ? adminApi.listAgents() : Promise.resolve(null)), []);
  const [linking, setLinking] = useState(false);
  const [ending, setEnding] = useState<AdminAgentLink | null>(null);
  const requests = data?.linkRequests ?? [];
  // A second change can't be asked for while one waits; a creator's applies anyway.
  const manage = can(P.AGENTS_MANAGE) && (creator || !requests.some((r) => r.status === "pending"));
  const open = data?.openLink ?? null;

  return (
    <section aria-label={t.storeSection} className="space-y-4">
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-ink">{t.agent}</h3>
                  {open ? (
                    <div className="mt-1 space-y-0.5 text-sm">
                      <p>
                        <Link to={`/agents/${open.agent.id}`} className="font-medium hover:text-primary hover:underline">
                          {open.agent.fullName ?? t.agentUnnamed}
                        </Link>{" "}
                        <span className="text-ink-soft">
                          · {sourceText()[open.source]} · {fmt(t.storeSince, { date: formatDate(open.startsAt) })}
                          {open.endsAt ? ` · ${fmt(t.storeUntil, { date: formatDate(open.endsAt) })}` : ""}
                        </span>
                      </p>
                      <p className="text-ink-soft">{linkTermsText(open)}</p>
                      <p className="text-ink-soft">{fmt(t.storeCommissionOn, { basis: open.commissionBasis === "list" ? t.basisListPrice : t.basisStorePaid })}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-ink-soft">{t.storeNoAgent}</p>
                  )}
                </div>
                {manage && (
                  <div className="flex gap-2">
                    {data.v2Enabled && (
                      <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
                        {open ? t.storeChangeAgent : t.storeLinkToAgent}
                      </Button>
                    )}
                    {open && (
                      <Button variant="outline" size="sm" onClick={() => setEnding(open)}>
                        {t.storeEndLink}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            {requests.length > 0 && <AgentLinkRequests requests={requests} onChanged={() => void refresh({ silent: true })} />}

            <div>
              <h3 className="mb-2 font-medium text-ink">{t.storeCodesEntered}</h3>
              {data.redemptions.length === 0 ? <EmptyBlock message={t.storeNoCode} /> : <RedemptionTable rows={data.redemptions} show="code" />}
            </div>

            {data.links.length > 0 && (
              <div>
                <h3 className="mb-2 font-medium text-ink">{t.storeHistory}</h3>
                <Panel flush>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>{t.agent}</Th>
                        <Th>{t.storeHow}</Th>
                        <Th>{t.storeFrom}</Th>
                        <Th>{t.storeEnded}</Th>
                        <Th>{t.commission}</Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.links.map((l) => (
                        <TableRow key={l.id}>
                          <Td className="align-top text-sm">{l.agent.fullName ?? t.agentUnnamed}</Td>
                          <Td className="align-top text-sm">
                            {sourceText()[l.source]}
                            {l.code?.code && (
                              <span className="block">
                                <Mono>{l.code.code}</Mono>
                              </span>
                            )}
                            {l.createdBy && <span className="block text-xs text-ink-soft">{fmt(t.storeBy, { name: l.createdBy.fullName })}</span>}
                          </Td>
                          <Td className="align-top text-sm whitespace-nowrap">{formatDateTime(l.startsAt)}</Td>
                          <Td className="align-top text-sm">
                            {l.open ? (
                              <StatusBadge tone="success">{t.storeOpen}</StatusBadge>
                            ) : (
                              <>
                                {formatDateTime(l.endedAt ?? "")}
                                <span className="block text-xs text-ink-soft">
                                  {l.endReason === "replaced" ? t.storeMoved : t.storeEnded}
                                  {l.endedBy ? ` ${fmt(t.storeBy, { name: l.endedBy.fullName })}` : ""}
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
          onSaved={(waiting) => {
            setLinking(false);
            toast.success(waiting ? t.storeSentStays : t.storeLinked);
            void refresh({ silent: true });
          }}
        />
      )}
      {ending && (
        <ConfirmDialog
          open
          title={t.storeEndTitle}
          description={creator ? t.storeEndNow : t.storeEndReview}
          confirmLabel={t.storeEndLink}
          cancelLabel={t.cancel}
          busyLabel={t.working}
          onCancel={() => setEnding(null)}
          onConfirm={async () => {
            // A refusal is shown in the dialog itself.
            const result = await adminApi.endAgentLink(ending.id);
            toast.success(result.request ? t.detailSentForReview : t.storeLinkEnded);
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
    const t = referralStrings();
    const last = i === rows.length - 1;
    const count = r.count.trim() ? Number(r.count) : null;
    if (count == null && !last) throw new Error(t.errLinkOnlyLast);
    if (count != null && (!Number.isInteger(count) || count < 1)) throw new Error(t.errLinkPayments);
    const percent = Number(r.percent);
    if (!r.percent.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(t.errLinkRate);
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
  /** `waiting`: it went for review, and nothing has changed yet. */
  onSaved: (waiting: boolean) => void;
}) {
  const t = useT(REFERRAL_STRINGS);
  const { user } = useAuth();
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
      const result = await adminApi.createAgentLink(workspaceId, {
        agentId,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        terms,
        commissionBasis: basis,
        note: note.trim() || null,
      });
      onSaved(Boolean(result.request));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={replacing ? t.linkChangeTitle : t.linkNewTitle}
      description={
        !isCreator(user)
          ? replacing
            ? fmt(t.linkReviewReplacing, { name: replacing.agent.fullName ?? t.linkTheCurrentAgent })
            : t.linkReviewNew
          : replacing
            ? fmt(t.linkReplacing, { name: replacing.agent.fullName ?? t.linkTheCurrentAgentStart })
            : t.linkNew
      }
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="agent-link-form" disabled={busy || !agentId}>
            {busy ? t.saving : t.linkSubmit}
          </Button>
        </>
      }
    >
      <form id="agent-link-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <SelectField label={t.agent} required value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">{t.linkChooseAgent}</option>
          {agents
            .filter((a) => a.isAgent && a.id !== replacing?.agent.id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} ({a.email})
              </option>
            ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.starts} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <TextField label={t.ends} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} hint={t.optional} />
        </div>
        <Toggle label={t.linkDifferent} checked={separate} onChange={setSeparate} />
        {(separate ? (["monthly", "yearly"] as BillingCycle[]) : (["monthly"] as BillingCycle[])).map((cycle) => (
          <div key={cycle}>
            {separate && <h4 className="mb-2 text-sm font-medium text-ink">{cycleLabel(cycle)}</h4>}
            <RateSteps label={t.formCommissionWord} steps={cycle === "monthly" ? monthly : yearly} onChange={cycle === "monthly" ? setMonthly : setYearly} />
          </div>
        ))}
        <SelectField label={t.commissionOn} value={basis} onChange={(e) => setBasis(e.target.value as ReferralCommissionBasis)}>
          <option value="paid">{t.whatStorePaid}</option>
          <option value="list">{t.listPriceThe}</option>
        </SelectField>
        <TextAreaField label={t.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
      </form>
    </Modal>
  );
}

/** Every code entered on any store this account owns, on the person's page. */
export function UserReferralsPanel({ userId }: { userId: string }) {
  const t = useT(REFERRAL_STRINGS);
  const { data, loading, error, refresh } = useAsync(() => adminApi.getUserReferrals(userId), [userId]);
  return (
    <section aria-label={t.referralCodes}>
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (data.redemptions.length === 0 ? <EmptyBlock message={t.accountNoCodes} /> : <RedemptionTable rows={data.redemptions} show="both" />)}
      </DataState>
    </section>
  );
}
