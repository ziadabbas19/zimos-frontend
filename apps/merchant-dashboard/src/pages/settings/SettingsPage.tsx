import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, Button, Label, cn } from "@store-builder/ui";
import type {
  InviteMemberPayload,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { ColorField } from "@/components/ColorField";
import {
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  normalizeHex,
  readThemeColor,
} from "@/lib/brandColors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

export function SettingsPage() {
  const workspaceId = useWorkspaceId();

  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader
        title="Settings"
        description="Your store profile and the people who can manage it."
      />
      <WorkspaceProfileSection key={`profile-${workspaceId}`} />
      <TeamSection key={`team-${workspaceId}`} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Workspace profile
// ---------------------------------------------------------------------

function WorkspaceProfileSection() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh } = useWorkspace();
  const toast = useToast();

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [tagline, setTagline] = useState(currentWorkspace?.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(currentWorkspace?.logoUrl ?? null);
  const [logoStage, setLogoStage] = useState<"preparing" | "uploading" | null>(null);
  const uploading = logoStage !== null;
  const [primaryColor, setPrimaryColor] = useState(() =>
    readThemeColor(currentWorkspace?.themeSettings, "primaryColor", DEFAULT_PRIMARY)
  );
  const [secondaryColor, setSecondaryColor] = useState(() =>
    readThemeColor(currentWorkspace?.themeSettings, "secondaryColor", DEFAULT_SECONDARY)
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const colorsValid = Boolean(normalizeHex(primaryColor) && normalizeHex(secondaryColor));

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a failure
    if (!file) return;
    setFormError(null);
    try {
      // Resize first if it is over the 5 MB cap, so a big logo export uploads
      // instead of being rejected.
      setLogoStage("preparing");
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setFormError(problem);
        return;
      }
      setLogoStage("uploading");
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      setLogoUrl(media.url);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLogoStage(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await apiClient.updateWorkspace(workspaceId, {
        name: name.trim(),
        tagline: tagline.trim() || null,
        logoUrl,
        // Merge, never replace: themeSettings is a shared blob and may already
        // carry keys owned by other parts of the product.
        themeSettings: {
          ...(currentWorkspace?.themeSettings ?? {}),
          primaryColor: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY,
          secondaryColor: normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY,
        },
      });
      toast.success("Store profile saved.");
      // Refresh the workspace list so the new name shows in the header switcher.
      await refresh();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">Store profile</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The name, logo, and tagline shown across your dashboard and storefront.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />

        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex flex-wrap items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Store logo"
                className="size-16 rounded-[0.5rem] border border-line bg-paper object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-[0.5rem] border border-dashed border-line text-xs text-ink-soft">
                None
              </div>
            )}
            <label
              className={cn(
                "inline-flex cursor-pointer items-center rounded-[0.5rem] border border-line bg-paper-raised px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper",
                uploading && "pointer-events-none opacity-50"
              )}
            >
              {logoStage === "preparing" ? "Resizing…" : logoStage === "uploading" ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={onLogoFile}
              />
            </label>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-soft">PNG, JPEG, GIF or WEBP, up to 5MB.</p>
        </div>

        <TextField
          label="Tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          error={fieldErrors.tagline}
          hint="Optional — a short line shown under your store name."
        />

        <div className="space-y-4 rounded-[0.5rem] border border-line p-4">
          <div>
            <h3 className="text-sm font-medium text-ink">Store colours</h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              Used for your storefront header, buttons and links.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              label="Primary"
              hint="Buttons, links and highlights."
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorField
              label="Secondary"
              hint="Accents and badges."
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div
              className="flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-line p-3"
              style={{ backgroundColor: `${normalizeHex(primaryColor) ?? DEFAULT_PRIMARY}14` }}
            >
              <span
                className="rounded-[0.5rem] px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY }}
              >
                Add to cart
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY }}
              >
                Sale
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY }}
              >
                View details
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || uploading || !name.trim() || !colorsValid}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------

function TeamSection() {
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();

  const data = useAsync(
    () =>
      Promise.all([
        apiClient.listWorkspaceMembers(workspaceId),
        apiClient.listPendingInvites(workspaceId),
        apiClient.listWorkspaceRoles(workspaceId),
      ]).then(([members, invites, roles]) => ({ members, invites, roles })),
    [workspaceId]
  );

  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  const reload = () => data.refresh({ silent: true });
  const members = data.data?.members ?? [];
  const invites = data.data?.invites ?? [];
  const roles = data.data?.roles ?? [];

  async function changeRole(member: WorkspaceMember, roleId: string) {
    try {
      await apiClient.updateMemberRole(workspaceId, member.id, roleId);
      toast.success("Role updated.");
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function resend(invite: WorkspaceInvite) {
    try {
      await apiClient.resendInvite(workspaceId, invite.id);
      toast.success(`Invite re-sent to ${invite.invitedEmail}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await apiClient.removeMember(workspaceId, removing.id);
    toast.success("Member removed.");
    setRemoving(null);
    reload();
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Team members</h2>
          <p className="mt-1 text-sm text-ink-soft">
            People who can sign in to this store, and the role that sets what they can do.
          </p>
        </div>
        <Button onClick={() => setInviting(true)} disabled={roles.length === 0}>
          Invite member
        </Button>
      </div>

      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        <div className="mt-4 space-y-8">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = Boolean(member.user && user && member.user.id === user.id);
                  return (
                    <tr key={member.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {member.user?.fullName || member.user?.email || "—"}
                          {isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-ink-soft">(you)</span>
                          )}
                        </div>
                        {member.user?.email && (
                          <div className="text-xs text-ink-soft">{member.user.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-ink-soft">{member.role.name}</span>
                        ) : (
                          <Select
                            aria-label={`Role for ${member.user?.email ?? "member"}`}
                            value={member.role.id}
                            onChange={(e) => changeRole(member, e.target.value)}
                            className="max-w-[220px]"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span
                            className="text-xs text-ink-soft"
                            title="You can't remove yourself"
                          >
                            —
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger-soft"
                            onClick={() => setRemoving(member)}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {invites.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Pending invites</h3>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-ink">{invite.invitedEmail}</span>
                            <StatusBadge value="invited" tone="warning" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{invite.role.name}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => resend(invite)}>
                            Resend
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DataState>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite member"
        description="They'll get an email with a link to join this store."
      >
        <InviteMemberForm
          roles={roles}
          onCancel={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            reload();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={
          removing?.user
            ? `Remove ${removing.user.fullName || removing.user.email}?`
            : "Remove this member?"
        }
        description="They lose access to this store immediately. You can invite them again later."
        confirmLabel="Remove member"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

function InviteMemberForm({
  roles,
  onCancel,
  onDone,
}: {
  roles: WorkspaceRole[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: InviteMemberPayload = { email: email.trim(), roleId };
      await apiClient.inviteMember(workspaceId, payload);
      toast.success(`Invite sent to ${payload.email}.`);
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder="teammate@example.com"
      />

      <Field label="Role" required error={fieldErrors.roleId}>
        {({ id }) => (
          <Select id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !email.trim() || !roleId}>
          {saving ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
