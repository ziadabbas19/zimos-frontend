import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import type { AdminAgentLinkRequest } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel } from "@/components/Panel";
import { TextAreaField } from "@/components/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime } from "@/lib/format";
import { P, isCreator } from "@/lib/permissions";
import { describeCommissionSteps } from "@/lib/referralCodes";
import { REFERRAL_STRINGS, referralStrings } from "@/lib/referralStrings";

/**
 * Changes to which agent earns on a store, asked for by anyone but a creator
 * (migration 743). Nothing changes on the store until one is approved, and only
 * a creator reviews what they asked for themselves.
 */

function describe(request: AdminAgentLinkRequest): string {
  const t = referralStrings();
  const { changes, agent } = request;
  const name = agent?.fullName ?? t.reqTheAgent;
  if (request.kind === "end") return fmt(t.reqEnd, { name });
  const parts: string[] = [];
  if (changes.terms) {
    const m = describeCommissionSteps(changes.terms.monthly);
    const y = describeCommissionSteps(changes.terms.yearly);
    parts.push(m === y ? m : fmt(t.describeByCycle, { monthly: m, yearly: y }));
  }
  if (changes.commissionBasis) parts.push(fmt(t.reqOn, { basis: changes.commissionBasis === "list" ? t.basisListPrice : t.basisStorePaid }));
  if (changes.endsAt) parts.push(fmt(t.reqUntil, { date: formatDateTime(changes.endsAt) }));
  const details = parts.length ? `: ${parts.join(t.listSeparator)}` : "";
  if (request.kind === "link") return fmt(t.reqLink, { name, details });
  if ("note" in changes && !parts.length) return fmt(t.reqChangeNote, { name });
  return fmt(t.reqChange, { name, details });
}

const STATUS_TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;

function statusText(): Record<AdminAgentLinkRequest["status"], string> {
  const t = referralStrings();
  return { pending: t.pendingReview, approved: t.approved, rejected: t.rejected };
}

export function AgentLinkRequests({
  requests,
  showStore = false,
  onChanged,
}: {
  requests: AdminAgentLinkRequest[];
  /** On a list across stores, name the store on each row. */
  showStore?: boolean;
  onChanged: () => void;
}) {
  const t = useT(REFERRAL_STRINGS);
  const toast = useToast();
  const { can, user } = useAuth();
  const [acting, setActing] = useState<{ request: AdminAgentLinkRequest; approve: boolean } | null>(null);
  const [reason, setReason] = useState("");

  const mayReview = (request: AdminAgentLinkRequest) => can(P.REFERRAL_CODES_APPROVE) && (isCreator(user) || !request.authorIds.includes(user?.id ?? ""));

  function done(message: string) {
    setActing(null);
    setReason("");
    toast.success(message);
    onChanged();
  }

  return (
    <Panel>
      <h3 className="mb-3 font-medium text-ink">{t.reqTitle}</h3>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
            <div>
              {showStore && (
                <Link to={`/workspaces/${request.workspaceId}`} className="block font-medium hover:text-primary hover:underline">
                  {request.workspace?.name ?? t.storeUnnamed}
                </Link>
              )}
              <p>{describe(request)}</p>
              <p className="text-xs text-ink-soft">
                {request.requestedBy ? fmt(t.reqBy, { name: request.requestedBy.fullName }) : ""}
                {formatDateTime(request.createdAt)}
              </p>
              {request.status === "pending" && (
                <p className="text-xs text-ink-soft">{t.reqUntilApproved}</p>
              )}
              {request.reason && <p className="text-xs text-ink-soft">{fmt(t.reasonValue, { reason: request.reason })}</p>}
              {request.status === "pending" && can(P.REFERRAL_CODES_APPROVE) && !mayReview(request) && (
                <p className="text-xs text-ink-soft">{t.reqOwnWork}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={STATUS_TONE[request.status]} dot>
                {statusText()[request.status]}
              </StatusBadge>
              {request.status === "pending" && mayReview(request) && (
                <>
                  <Button size="sm" onClick={() => setActing({ request, approve: true })}>
                    {t.approve}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActing({ request, approve: false })}>
                    {t.reject}
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={acting?.approve === true}
        title={t.reqApproveTitle}
        description={acting ? fmt(t.reqApproveDescription, { what: describe(acting.request) }) : undefined}
        confirmLabel={t.approve}
        cancelLabel={t.cancel}
        busyLabel={t.approving}
        onCancel={() => setActing(null)}
        onConfirm={async () => {
          if (!acting) return;
          await adminApi.approveAgentLinkRequest(acting.request.id);
          done(t.reqApprovedToast);
        }}
      />
      <ConfirmDialog
        open={acting?.approve === false}
        title={t.reqRejectTitle}
        description={t.reqRejectDescription}
        confirmLabel={t.reject}
        cancelLabel={t.cancel}
        busyLabel={t.rejecting}
        destructive
        onCancel={() => setActing(null)}
        onConfirm={async () => {
          if (!acting) return;
          await adminApi.rejectAgentLinkRequest(acting.request.id, reason.trim());
          done(t.reqRejectedToast);
        }}
      >
        <TextAreaField
          label={t.reason}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          hint={t.reqReasonHint}
        />
      </ConfirmDialog>
    </Panel>
  );
}
