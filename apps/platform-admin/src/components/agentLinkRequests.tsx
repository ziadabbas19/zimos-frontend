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
import * as adminApi from "@/lib/adminApi";
import { formatDateTime } from "@/lib/format";
import { P, isCreator } from "@/lib/permissions";
import { describeCommissionSteps } from "@/lib/referralCodes";

/**
 * Changes to which agent earns on a store, asked for by anyone but a creator
 * (migration 743). Nothing changes on the store until one is approved, and only
 * a creator reviews what they asked for themselves.
 */

function describe(request: AdminAgentLinkRequest): string {
  const { changes, agent } = request;
  const name = agent?.fullName ?? "the agent";
  if (request.kind === "end") return `End ${name}'s link`;
  const parts: string[] = [];
  if (changes.terms) {
    const m = describeCommissionSteps(changes.terms.monthly);
    const y = describeCommissionSteps(changes.terms.yearly);
    parts.push(m === y ? m : `Monthly: ${m}. Yearly: ${y}`);
  }
  if (changes.commissionBasis) parts.push(`on ${changes.commissionBasis === "list" ? "the list price" : "what the store paid"}`);
  if (changes.endsAt) parts.push(`until ${formatDateTime(changes.endsAt)}`);
  if (request.kind === "link") return `Link the store to ${name}${parts.length ? `: ${parts.join(", ")}` : ""}`;
  if ("note" in changes && !parts.length) return `Change the note on ${name}'s link`;
  return `Change ${name}'s link${parts.length ? `: ${parts.join(", ")}` : ""}`;
}

const STATUS_TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;
const STATUS_TEXT = { pending: "Pending review", approved: "Approved", rejected: "Rejected" } as const;

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
      <h3 className="mb-3 font-medium text-ink">Changes to a store&apos;s agent</h3>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
            <div>
              {showStore && (
                <Link to={`/workspaces/${request.workspaceId}`} className="block font-medium hover:text-primary hover:underline">
                  {request.workspace?.name ?? "Store"}
                </Link>
              )}
              <p>{describe(request)}</p>
              <p className="text-xs text-ink-soft">
                {request.requestedBy ? `By ${request.requestedBy.fullName} · ` : ""}
                {formatDateTime(request.createdAt)}
              </p>
              {request.status === "pending" && (
                <p className="text-xs text-ink-soft">Until it&rsquo;s approved, the store stays as it is.</p>
              )}
              {request.reason && <p className="text-xs text-ink-soft">Reason: {request.reason}</p>}
              {request.status === "pending" && can(P.REFERRAL_CODES_APPROVE) && !mayReview(request) && (
                <p className="text-xs text-ink-soft">You asked for this or made this link, so someone else has to review it.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={STATUS_TONE[request.status]} dot>
                {STATUS_TEXT[request.status]}
              </StatusBadge>
              {request.status === "pending" && mayReview(request) && (
                <>
                  <Button size="sm" onClick={() => setActing({ request, approve: true })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActing({ request, approve: false })}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={acting?.approve === true}
        title="Approve this change?"
        description={acting ? `${describe(acting.request)}. It applies now, to the payments still to come.` : undefined}
        confirmLabel="Approve"
        busyLabel="Approving…"
        onCancel={() => setActing(null)}
        onConfirm={async () => {
          if (!acting) return;
          await adminApi.approveAgentLinkRequest(acting.request.id);
          done("Approved.");
        }}
      />
      <ConfirmDialog
        open={acting?.approve === false}
        title="Reject this change?"
        description="Nothing changes on the store."
        confirmLabel="Reject"
        busyLabel="Rejecting…"
        destructive
        onCancel={() => setActing(null)}
        onConfirm={async () => {
          if (!acting) return;
          await adminApi.rejectAgentLinkRequest(acting.request.id, reason.trim());
          done("Rejected.");
        }}
      >
        <TextAreaField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          hint="Optional. Whoever asked can see it."
        />
      </ConfirmDialog>
    </Panel>
  );
}
