import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import type { AdminPlatformAdmin, AdminPlatformRole, AdminRolesResponse } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextAreaField, TextField } from "@/components/forms";
import { Modal } from "@/components/Modal";
import { Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { P, permissionLabel, permissionSummary, withPermission, withinReach } from "@/lib/permissions";

/**
 * The tick list of permissions, for a role and for one account. Only `keys` are
 * offered; ticking an edit key ticks the key that opens its page (lib/permissions).
 */
export function PermissionPicker({
  keys,
  value,
  disabled = false,
  onChange,
}: {
  keys: string[];
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset disabled={disabled} className={cn("grid gap-2 sm:grid-cols-2", disabled && "opacity-60")}>
      <legend className="sr-only">Permissions</legend>
      {keys.map((key) => (
        <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value.includes(key)}
            onChange={(e) => onChange(withPermission(value, key, e.target.checked))}
          />
          <span>{permissionLabel(key)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The roles the console offers: the three seeded ones, which are fixed, and the
 * custom ones. Saving a custom role changes the accounts holding it (the API
 * adds and removes the keys that changed), so a person can't edit one they
 * hold themselves, and a role with accounts on it can't be deleted. Mirrors the
 * API: a role with a key the viewer doesn't hold, or with an account above them
 * on it, offers them nothing.
 */
export function RolesPanel({
  roles,
  admins,
  onChanged,
}: {
  roles: AdminRolesResponse;
  admins: AdminPlatformAdmin[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const { user, can } = useAuth();
  const canManage = can(P.ADMINS_MANAGE);
  const [editing, setEditing] = useState<AdminPlatformRole | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminPlatformRole | null>(null);
  const roleWithinReach = (role: AdminPlatformRole) =>
    !role.builtIn &&
    role.defaultPermissions.every((key) => can(key)) &&
    admins.filter((a) => a.role === role.key).every((a) => withinReach(can, a));

  return (
    <Panel
      title="Roles"
      description="A role is a name and a starting set of permissions. Changing a custom role reaches everyone holding it on their next request."
      className="mt-6"
      actions={
        canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> New role
          </Button>
        )
      }
      flush
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Role</Th>
            <Th>Permissions</Th>
            <Th className="text-end">Accounts</Th>
            {canManage && (
              <Th className="text-end">
                <span className="sr-only">Actions</span>
              </Th>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.roles.map((role) => (
            <TableRow key={role.key}>
              <Td>
                <span className="font-medium">{role.name}</span>
                {role.builtIn && (
                  <StatusBadge tone="neutral" className="ms-2">
                    Built in
                  </StatusBadge>
                )}
                {role.description && <span className="block text-xs text-ink-soft">{role.description}</span>}
              </Td>
              <Td className="text-sm">
                <span title={role.defaultPermissions.map(permissionLabel).join("\n")}>{permissionSummary(role.defaultPermissions)}</span>
              </Td>
              <Td className="tabular text-end">{role.holders}</Td>
              {canManage && (
                <Td className="text-end whitespace-nowrap">
                  {roleWithinReach(role) && user?.platformRole !== role.key && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(role)}>
                      <Pencil /> Edit
                    </Button>
                  )}
                  {roleWithinReach(role) && role.holders === 0 && (
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${role.name}`} onClick={() => setDeleting(role)}>
                      <Trash2 className="text-danger" />
                    </Button>
                  )}
                </Td>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing && (
        <RoleModal
          role={editing === "new" ? null : editing}
          allKeys={roles.permissions}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            toast.success(created ? `Role ${saved.name} created.` : `Role ${saved.name} updated.`);
            setEditing(null);
            onChanged();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete the ${deleting?.name ?? ""} role?`}
        description="No account holds it, so nobody loses access."
        confirmLabel="Delete role"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteRole(deleting.key);
          toast.success(`Role ${deleting.name} deleted.`);
          setDeleting(null);
          onChanged();
        }}
      />
    </Panel>
  );
}

function RoleModal({
  role,
  allKeys,
  onClose,
  onSaved,
}: {
  role: AdminPlatformRole | null;
  allKeys: string[];
  onClose: () => void;
  onSaved: (role: AdminPlatformRole, created: boolean) => void;
}) {
  const { can } = useAuth();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.defaultPermissions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the API lets this person hand out: what they hold.
  const offered = allKeys.filter((key) => can(key));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), description: description.trim() || null, permissions };
    try {
      if (role) onSaved(await adminApi.updateRole(role.key, payload), false);
      else onSaved(await adminApi.createRole(payload), true);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={role ? `Edit the ${role.name} role` : "New role"}
      description={role ? `${role.holders} account${role.holders === 1 ? " holds" : "s hold"} this role.` : "Give it to someone from Grant access, or from Edit on their row."}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="role-form" disabled={busy || name.trim().length < 2}>
            {busy ? "Saving…" : role ? "Save" : "Create role"}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Name" required minLength={2} maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <TextAreaField label="Description" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        <PermissionPicker keys={offered} value={permissions} onChange={setPermissions} />
      </form>
    </Modal>
  );
}
