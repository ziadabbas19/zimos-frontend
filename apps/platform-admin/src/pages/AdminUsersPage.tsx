import { useState, type FormEvent } from "react";
import { Pencil, UserMinus, UserPlus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminPlatformAdmin as Admin, AdminPlatformRole, AdminRolesResponse } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SelectField, TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { PermissionPicker, RolesPanel } from "@/components/platformRoles";
import { Status, StatusBadge, type Tone } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { AGENT_ROLE, CREATOR_ROLE, P, isCreator, permissionLabel, permissionSummary, withinReach } from "@/lib/permissions";
import { statusLabel } from "@/lib/referralStrings";

const STRINGS = {
  en: {
    title: "Admin users",
    description: "Who can sign in to this console, and what each of them can do.",
    grantAccess: "Grant access",
    empty: "No platform users.",
    colName: "Name",
    colEmail: "Email",
    colRole: "Role",
    colAccount: "Account",
    colLastSignIn: "Last sign-in",
    colSignedUp: "Signed up",
    colActions: "Actions",
    you: "You",
    never: "Never",
    edit: "Edit",
    revoke: "Revoke",
    footnote:
      "A role sets an account’s starting permissions; a creator can then adjust them one by one. Only a creator can make another creator or change one. Every change is recorded in the audit log and takes effect on that person’s next request.",
    viewOnly: " Your role can view this list but not change it.",
    grantedToast: "{email} now has the {role} role.",
    alreadyToast: "{email} already had that role.",
    updatedToast: "{email}'s access was updated.",
    revokeTitle: "Revoke {name}'s access?",
    revokeDescription: "{email} will lose access to this console on their next request. Their account and store access are not affected.",
    revokeDescriptionAgent:
      "{email} will lose access to this console on their next request. Their account and store access are not affected, and their referral codes and commission history stay as they are.",
    revokeAccess: "Revoke access",
    revokedToast: "Access revoked for {email}.",
    editAccess: "Edit {name}'s access",
    grantDescription: "The person needs an active Zimos account first — there are no invitations.",
    cancel: "Cancel",
    working: "Working…",
    saving: "Saving…",
    save: "Save",
    accountEmail: "Account email",
    role: "Role",
    wildcard: "{label}: every section, including ones added later.",
    customize: "Customize permissions",
    customizeHint: "Off: the role's default set. On: choose exactly what this person can do.",
  },
  ar: {
    title: "المسؤولون",
    description: "من يمكنه تسجيل الدخول إلى لوحة التحكم هذه، وما يمكن لكل منهم فعله.",
    grantAccess: "منح صلاحية الوصول",
    empty: "لا يوجد مستخدمون للمنصة.",
    colName: "الاسم",
    colEmail: "البريد الإلكتروني",
    colRole: "الدور",
    colAccount: "الحساب",
    colLastSignIn: "آخر تسجيل دخول",
    colSignedUp: "تاريخ التسجيل",
    colActions: "الإجراءات",
    you: "أنت",
    never: "أبدًا",
    edit: "تعديل",
    revoke: "سحب",
    footnote:
      "يحدد الدور الصلاحيات الأولية للحساب، ويمكن لأحد المنشئين بعد ذلك تعديلها واحدة تلو الأخرى. لا يمكن إلا لمنشئ أن يعيّن منشئًا آخر أو يغيّره. يُسجَّل كل تغيير في سجل التدقيق ويسري عند الطلب التالي لذلك الشخص.",
    viewOnly: " يتيح لك دورك عرض هذه القائمة دون تغييرها.",
    grantedToast: "أصبح لدى {email} دور {role}.",
    alreadyToast: "لدى {email} هذا الدور بالفعل.",
    updatedToast: "تم تحديث صلاحيات {email}.",
    revokeTitle: "سحب صلاحية وصول {name}؟",
    revokeDescription: "سيفقد {email} الوصول إلى لوحة التحكم هذه عند طلبه التالي. ولن يتأثر حسابه ولا وصوله إلى متاجره.",
    revokeDescriptionAgent:
      "سيفقد {email} الوصول إلى لوحة التحكم هذه عند طلبه التالي. ولن يتأثر حسابه ولا وصوله إلى متاجره، وتبقى أكواد الإحالة وسجل العمولات الخاصة به كما هي.",
    revokeAccess: "سحب صلاحية الوصول",
    revokedToast: "تم سحب صلاحية وصول {email}.",
    editAccess: "تعديل صلاحيات {name}",
    grantDescription: "يحتاج الشخص إلى حساب Zimos نشط أولًا — لا توجد دعوات.",
    cancel: "إلغاء",
    working: "جارٍ التنفيذ…",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    accountEmail: "البريد الإلكتروني للحساب",
    role: "الدور",
    wildcard: "{label}: كل الأقسام، بما فيها ما يُضاف لاحقًا.",
    customize: "تخصيص الصلاحيات",
    customizeHint: "عند الإيقاف: المجموعة الافتراضية للدور. عند التشغيل: اختر بالضبط ما يمكن لهذا الشخص فعله.",
  },
} satisfies Messages;

const ROLE_TONES: Record<string, Tone> = { creator: "primary", admin: "info", agent: "warning" };

function RoleBadge({ admin }: { admin: Pick<Admin, "role" | "roleName"> }) {
  return <StatusBadge tone={ROLE_TONES[admin.role] ?? "neutral"}>{admin.roleName}</StatusBadge>;
}

export function AdminUsersPage() {
  const t = useT(STRINGS);
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
  const viewerIsCreator = isCreator(user);
  const creatorCount = admins.filter((a) => a.role === CREATOR_ROLE).length;

  /** Whether the viewer can act on this row at all. Mirrors the API's rules. */
  function canActOn(a: Admin): boolean {
    if (a.isYou) return false;
    if (a.role === CREATOR_ROLE) return viewerIsCreator && creatorCount > 1;
    return withinReach(can, a);
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canManage && (
            <Button onClick={() => setGranting(true)} disabled={!roles}>
              <UserPlus /> {t.grantAccess}
            </Button>
          )
        }
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {admins.length === 0 ? (
          <EmptyBlock message={t.empty} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.colName}</Th>
                  <Th>{t.colEmail}</Th>
                  <Th>{t.colRole}</Th>
                  <Th>{t.colAccount}</Th>
                  <Th>{t.colLastSignIn}</Th>
                  <Th>{t.colSignedUp}</Th>
                  {canManage && (
                    <Th className="text-end">
                      <span className="sr-only">{t.colActions}</span>
                    </Th>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <Td>
                      <span className="font-medium">{a.fullName}</span>
                      {a.isYou && (
                        <StatusBadge tone="primary" className="ms-2">
                          {t.you}
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
                      <Status value={a.status} label={statusLabel(a.status)} />
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {a.lastLoginAt ? (
                        <span title={formatDateTime(a.lastLoginAt)}>{formatRelative(a.lastLoginAt)}</span>
                      ) : (
                        <span className="text-ink-soft">{t.never}</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-sm">{formatDate(a.createdAt)}</Td>
                    {canManage && (
                      <Td className="text-end whitespace-nowrap">
                        {canActOn(a) && (
                          <>
                            <Button size="sm" variant="ghost" disabled={!roles} onClick={() => setEditing(a)}>
                              <Pencil /> {t.edit}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRevoking(a)}>
                              <UserMinus className="text-danger" /> {t.revoke}
                            </Button>
                          </>
                        )}
                      </Td>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          {t.footnote}
          {!canManage && t.viewOnly}
        </p>
        {roles && <RolesPanel roles={roles} admins={admins} onChanged={() => void refresh({ silent: true })} />}
      </DataState>

      {granting && roles && (
        <AccessModal
          roles={roles}
          viewerIsCreator={viewerIsCreator}
          onClose={() => setGranting(false)}
          onSubmit={async ({ email, role, permissions }) => {
            const { admin, granted } = await adminApi.grantAdmin({ email: email ?? "", role, permissions });
            toast.success(granted ? fmt(t.grantedToast, { email: admin.email, role: admin.roleName }) : fmt(t.alreadyToast, { email: admin.email }));
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
            toast.success(fmt(t.updatedToast, { email: admin.email }));
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        title={fmt(t.revokeTitle, { name: revoking?.fullName ?? "" })}
        description={fmt(revoking?.role === "agent" ? t.revokeDescriptionAgent : t.revokeDescription, { email: revoking?.email ?? "" })}
        confirmLabel={t.revokeAccess}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await adminApi.revokeAdmin(revoking.id);
          toast.success(fmt(t.revokedToast, { email: revoking.email }));
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
  const t = useT(STRINGS);
  const { can } = useAuth();
  const editing = !!admin;
  const [email, setEmail] = useState("");
  // Mirrors the API: only a creator hands out the creator role, the agent role
  // takes agents.create, and any other role goes only from someone holding all of it.
  const canGive = (r: AdminPlatformRole) => {
    if (r.key === CREATOR_ROLE) return viewerIsCreator;
    if (r.key === AGENT_ROLE) return can(P.AGENTS_CREATE);
    return r.defaultPermissions.every((key) => can(key));
  };
  const [roleKey, setRoleKey] = useState(
    () => admin?.role ?? (roles.roles.some((r) => r.key === "admin" && canGive(r)) ? "admin" : (roles.roles.find(canGive)?.key ?? ""))
  );
  const role: AdminPlatformRole | undefined = roles.roles.find((r) => r.key === roleKey);
  const [custom, setCustom] = useState(false);
  const [permissions, setPermissions] = useState<string[]>(() => admin?.permissions ?? role?.defaultPermissions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The account's own role stays on the list: keeping it gives nothing.
  const roleOptions = roles.roles.filter((r) => r.key === admin?.role || canGive(r));
  const isWildcard = permissions.includes("*");

  // What this person can tick for that role: what they hold themselves, and the
  // agent role's own default set. An account they can edit holds nothing more.
  const offered = roles.permissions.filter((key) => can(key) || (roleKey === AGENT_ROLE && role?.defaultPermissions.includes(key)));

  function chooseRole(key: string) {
    setRoleKey(key);
    const next = roles.roles.find((r) => r.key === key);
    // Changing the role starts from its default set again.
    setPermissions(next?.defaultPermissions ?? []);
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
      title={editing ? fmt(t.editAccess, { name: admin.fullName }) : t.grantAccess}
      description={editing ? admin.email : t.grantDescription}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="access-form" disabled={busy || !roleKey || (!editing && !email.trim())}>
            {busy ? t.saving : editing ? t.save : t.grantAccess}
          </Button>
        </>
      }
    >
      <form id="access-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {!editing && (
          <TextField
            label={t.accountEmail}
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <SelectField
          label={t.role}
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
        {isWildcard ? (
          <p className="text-sm text-ink-soft">{fmt(t.wildcard, { label: permissionLabel("*") })}</p>
        ) : (
          <>
            <Toggle
              label={t.customize}
              description={t.customizeHint}
              checked={custom}
              onChange={setCustom}
            />
            <PermissionPicker keys={offered} value={permissions} disabled={!custom} onChange={setPermissions} />
          </>
        )}
      </form>
    </Modal>
  );
}
