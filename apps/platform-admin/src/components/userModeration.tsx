import { useState } from "react";
import { Ban, PlayCircle, Trash2 } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import type { AdminUserDetail } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { TextAreaField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import { P } from "@/lib/permissions";

type Action = "suspend" | "unsuspend" | "delete";

/** The account's state as a badge: deleted, suspended, or its plain status. */
const BADGE_STRINGS = {
  en: { deleted: "Deleted", suspended: "Suspended" },
  ar: { deleted: "محذوف", suspended: "موقوف" },
} satisfies Messages;

export function UserStateBadge({ status, deleted }: { status: string; deleted?: boolean }) {
  const t = useT(BADGE_STRINGS);
  if (deleted) {
    return (
      <StatusBadge tone="danger" dot>
        {t.deleted}
      </StatusBadge>
    );
  }
  if (status === "suspended") {
    return (
      <StatusBadge tone="danger" dot>
        {t.suspended}
      </StatusBadge>
    );
  }
  return null;
}

/**
 * Suspend, unsuspend and delete an account (POST /admin/users/:id/…).
 * Suspending ends every session and refuses sign-in; deleting anonymises the
 * account and keeps its row, and an owner of stores is deleted only with
 * those stores suspended. Hidden for your own account and for any account the
 * API says is out of the viewer's reach (a creator's, or one above them).
 */
export function UserModerationActions({ user, onChanged }: { user: AdminUserDetail; onChanged: () => void }) {
  const toast = useToast();
  const { can, user: me } = useAuth();
  const [acting, setActing] = useState<Action | null>(null);
  const [reason, setReason] = useState("");

  if (!can(P.WORKSPACES_MANAGE) || !user.canActOn || user.deletedAt || me?.id === user.id) return null;

  const suspended = user.status === "suspended";
  const ownedStores = user.workspaces.filter((s) => s.role === "owner").length;

  function open(action: Action) {
    setReason("");
    setActing(action);
  }

  async function confirm() {
    const why = reason.trim();
    if (acting === "suspend") {
      await adminApi.suspendUser(user.id, why);
      toast.success("Account suspended. Its sessions were ended.");
    } else if (acting === "unsuspend") {
      await adminApi.unsuspendUser(user.id, why || undefined);
      toast.success("Account unsuspended.");
    } else if (acting === "delete") {
      await adminApi.deleteUser(user.id, { reason: why || undefined, ...(ownedStores > 0 ? { stores: "suspend" as const } : {}) });
      toast.success(ownedStores > 0 ? "Account deleted and its stores suspended." : "Account deleted.");
    }
    setActing(null);
    onChanged();
  }

  const titles: Record<Action, string> = {
    suspend: "Suspend account",
    unsuspend: "Unsuspend account",
    delete: "Delete account",
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {suspended ? (
          <Button variant="outline" onClick={() => open("unsuspend")}>
            <PlayCircle /> Unsuspend
          </Button>
        ) : (
          <Button variant="outline" onClick={() => open("suspend")}>
            <Ban /> Suspend
          </Button>
        )}
        <Button variant="destructive" onClick={() => open("delete")}>
          <Trash2 /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={acting !== null}
        title={acting ? titles[acting] : ""}
        confirmLabel={acting ? titles[acting] : "Confirm"}
        destructive={acting !== "unsuspend"}
        confirmDisabled={acting === "suspend" && reason.trim().length < 2}
        onCancel={() => setActing(null)}
        onConfirm={confirm}
      >
        <div className="space-y-4">
          {acting === "suspend" && (
            <Alert>Every session ends now and sign-in is refused (password and Google) until the account is unsuspended.</Alert>
          )}
          {acting === "delete" && (
            <Alert variant="danger">
              The email, phone and name are anonymised and every session ends. The account row stays so its stores and orders
              keep their history. This cannot be undone.
              {ownedStores > 0 && ` This account owns ${ownedStores} store(s): they will be suspended too.`}
            </Alert>
          )}
          <TextAreaField
            label="Reason"
            required={acting === "suspend"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            hint="Kept in the audit log. Internal."
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
