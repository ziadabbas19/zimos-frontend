import { useState, type FormEvent } from "react";
import { Pencil, UserMinus, UserPlus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import type { AdminPlatformAdmin as Admin, AdminPlatformRole, AdminRolesResponse } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SelectField, TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge, type Tone } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { CREATOR_ROLE, P, permissionLabel } from "@/lib/permissions";

const ROLE_TONES: Record<string, Tone> = { creator: "primary", admin: "info", agent: "warning" };

function RoleBadge({ admin }: { admin: Pick<Admin, "role" | "roleName"> }) {
  return <StatusBadge tone={ROLE_TONES[admin.role] ?? "neutral"}>{admin.roleName}</StatusBadge>;
}

function permissionSummary(permissions: string[]): string {
  if (permissions.includes("*")) return "Everything";
  return `${permissions.length} permission${permissions.length === 1 ? "" : "s"}`;
}

export function AdminUsersPage() {
  const toast = useToast();
  const { user, can } = useAuth();
  const { data, loading, error, refresh } = useAsync(
    () => Promise.all([adminApi.listAdmins(), adminApi.listRoles()]),
    []
  );
  const [granting, setGranting] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [revoking, setRevoking] = useState<Admin | null>(null);

  const admins = data?.[0] ?? [];
  const roles = data?.[1];
  const canManage = can(P.ADMINS_MANAGE);
  const viewerIsCreator = user?.platformRole === CREATOR_ROLE;
  const creatorCount = admins.filter((a) => a.role === CREATOR_ROLE).length;

  /** Why this row's actions are off for the viewer, or null. Mirrors the API's rules. */
  function blockedReason(a: Admin): string | null {
    if (a.isYou) return "You cannot change your own access.";
    if (a.role === CREATOR_ROLE && !viewerIsCreator) return "Only a creator can change a creator.";
    if (a.role === CREATOR_ROLE && creatorCount <= 1) return "The last creator cannot be changed.";
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Admin users"
        description="Who can sign in to this console, and what each of them can do."
        actions={
          canManage && (
            <Button onClick={() => setGranting(true)} disabled={!roles}>
              <UserPlus /> Grant access
            </Button>
          )
        }
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {admins.length === 0 ? (
          <EmptyBlock message="No platform users." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Account</Th>
                  <Th>Last sign-in</Th>
                  <Th>Signed up</Th>
                  {canManage && (
                    <Th className="text-end">
                      <span className="sr-only">Actions</span>
                    </Th>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => {
                  const blocked = blockedReason(a);
                  return (
                    <TableRow key={a.id}>
                      <Td>
                        <span className="font-medium">{a.fullName}</span>
                        {a.isYou && (
                          <StatusBadge tone="primary" className="ms-2">
                            You
                          </StatusBadge>
                        )}
                      </Td>
                      <Td className="text-sm">{a.email}</Td>
                      <Td>
                        <RoleBadge admin={a} />
                        <span className="mt-1 block text-xs text-ink-soft" title={a.permissions.map(permissionLabel).join("\n")}>
                          {permissionSummary(a.permissions)}
                        </span>
                      </Td>
                      <Td>
                        <Status value={a.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-sm">
                        {a.lastLoginAt ? (
                          <span title={formatDateTime(a.lastLoginAt)}>{formatRelative(a.lastLoginAt)}</span>
                        ) : (
                          <span className="text-ink-soft">Never</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-sm">{formatDate(a.createdAt)}</Td>
                      {canManage && (
                        <Td className="text-end whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!blocked || !roles}
                            title={blocked ?? undefined}
                            onClick={() => setEditing(a)}
                          >
                            <Pencil /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!blocked}
                            title={blocked ?? undefined}
                            onClick={() => setRevoking(a)}
                          >
                            <UserMinus className="text-danger" /> Revoke
                          </Button>
                        </Td>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          A role sets an account&rsquo;s starting permissions; a creator can then adjust them one by one. Only a
          creator can make another creator or change one. Every change is recorded in the audit log and takes effect on
          that person&rsquo;s next request.
          {!canManage && " Your role can view this list but not change it."}
        </p>
      </DataState>

      {granting && roles && (
        <AccessModal
          roles={roles}
          viewerIsCreator={viewerIsCreator}
          onClose={() => setGranting(false)}
          onSubmit={async ({ email, role, permissions }) => {
            const { admin, granted } = await adminApi.grantAdmin({ email: email ?? "", role, permissions });
            toast.success(granted ? `${admin.email} now has the ${admin.roleName} role.` : `${admin.email} already had that role.`);
            setGranting(false);
            void refresh({ silent: true });
          }}
        />
      )}
      {editing && roles && (
        <AccessModal
          admin={editing}
          roles={roles}
          viewerIsCreator={viewerIsCreator}
          onClose={() => setEditing(null)}
          onSubmit={async ({ role, permissions }) => {
            const admin = await adminApi.updateAdmin(editing.id, { role, permissions });
            toast.success(`${admin.email}'s access was updated.`);
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        title={`Revoke ${revoking?.fullName ?? ""}'s access?`}
        description={`${revoking?.email ?? ""} will lose access to this console on their next request. Their account and store access are not affected${
          revoking?.role === "agent" ? ", and their referral codes and commission history stay as they are" : ""
        }.`}
        confirmLabel="Revoke access"
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await adminApi.revokeAdmin(revoking.id);
          toast.success(`Access revoked for ${revoking.email}.`);
          setRevoking(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

/**
 * Grant (no `admin`) or edit (`admin`) a role and permission set. Permissions
 * follow the role's default until "Customize" is switched on; the API applies
 * the same rule when no explicit set is sent.
 */
function AccessModal({
  admin,
  roles,
  viewerIsCreator,
  onClose,
  onSubmit,
}: {
  admin?: Admin;
  roles: AdminRolesResponse;
  viewerIsCreator: boolean;
  onClose: () => void;
  onSubmit: (value: { email?: string; role: string; permissions?: string[] }) => Promise<void>;
}) {
  const editing = !!admin;
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState(admin?.role ?? "admin");
  const role: AdminPlatformRole | undefined = roles.roles.find((r) => r.key === roleKey);
  const [custom, setCustom] = useState(false);
  const [permissions, setPermissions] = useState<string[]>(() => admin?.permissions ?? role?.defaultPermissions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only a creator may hand out the creator role (the API refuses otherwise).
  const roleOptions = roles.roles.filter((r) => r.key !== CREATOR_ROLE || viewerIsCreator);
  const isWildcard = permissions.includes("*");

  function chooseRole(key: string) {
    setRoleKey(key);
    const next = roles.roles.find((r) => r.key === key);
    // Changing the role starts from its default set again.
    setPermissions(next?.defaultPermissions ?? []);
  }

  function toggle(key: string, on: boolean) {
    setPermissions((current) => (on ? [...current, key] : current.filter((k) => k !== key)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const roleChanged = !admin || roleKey !== admin.role;
      await onSubmit({
        email: admin ? undefined : email.trim(),
        role: roleKey,
        // Without "Customize", a new role gets its default set (the API's
        // rule when no set is sent) and an unchanged role keeps its own.
        permissions: custom ? permissions : roleChanged ? undefined : permissions,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={editing ? `Edit ${admin.fullName}'s access` : "Grant access"}
      description={editing ? admin.email : "The person needs an active Zimos account first — there are no invitations."}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="access-form" disabled={busy || (!editing && !email.trim())}>
            {busy ? "Saving…" : editing ? "Save" : "Grant access"}
          </Button>
        </>
      }
    >
      <form id="access-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {!editing && (
          <TextField
            label="Account email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <SelectField
          label="Role"
          value={roleKey}
          onChange={(e) => chooseRole(e.target.value)}
          hint={role?.description ?? undefined}
        >
          {roleOptions.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <Toggle
          label="Customize permissions"
          description="Off: the role's default set. On: choose exactly what this person can do."
          checked={custom}
          onChange={setCustom}
        />
        {isWildcard ? (
          <p className="text-sm text-ink-soft">
            {permissionLabel("*")}: every section, including ones added later.
          </p>
        ) : (
          <fieldset disabled={!custom} className={cn("grid gap-2 sm:grid-cols-2", !custom && "opacity-60")}>
            <legend className="sr-only">Permissions</legend>
            {roles.permissions.map((key) => (
              <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={permissions.includes(key)}
                  onChange={(e) => toggle(key, e.target.checked)}
                />
                <span>{permissionLabel(key)}</span>
              </label>
            ))}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
