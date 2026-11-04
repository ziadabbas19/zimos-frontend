import { useMemo, useState, type FormEvent } from "react";
import { Info, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SelectField, TextAreaField, TextField } from "@/components/forms";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import type {
  AdminAnnouncement as Announcement,
  AdminPlan as Plan,
  AnnouncementAudience,
  AnnouncementSeverity,
} from "@store-builder/api-client";
import { formatDateTime, toDateTimeInput } from "@/lib/format";

type Filter = "all" | "live" | "scheduled" | "ended";

interface AnnouncementForm {
  id?: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  planId: string;
  workspaceId: string;
  startsAt: string;
  endsAt: string;
  dismissible: boolean;
}

function emptyForm(): AnnouncementForm {
  const start = new Date(Date.now() + 3_600_000);
  start.setMinutes(0, 0, 0);
  return { title: "", body: "", severity: "info", audience: "all", planId: "", workspaceId: "", startsAt: toDateTimeInput(start.toISOString()), endsAt: "", dismissible: true };
}

export function AnnouncementBanner({ title, body, severity, dismissible }: { title: string; body: string; severity: AnnouncementSeverity; dismissible: boolean }) {
  const Icon = severity === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[0.875rem] border px-4 py-3 text-sm",
        severity === "warning" ? "border-accent/30 bg-accent-soft" : "border-primary/20 bg-primary-soft"
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", severity === "warning" ? "text-accent-dark" : "text-primary-dark dark:text-primary")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title || "Announcement title"}</p>
        <p className="text-ink-soft">{body || "Message shown to merchants at the top of their dashboard."}</p>
      </div>
      {dismissible && <X className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-label="Dismiss (preview)" />}
    </div>
  );
}

export function AnnouncementsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can(P.ANNOUNCEMENTS_MANAGE);
  // Naming a plan or a store takes the permission that reads them.
  const canReadPlans = can(P.PLANS_VIEW);
  const canReadStores = can(P.WORKSPACES_VIEW);
  const { data, loading, error, refresh, setData } = useAsync(
    () =>
      Promise.all([
        adminApi.listAnnouncements(),
        canReadPlans ? adminApi.listPlans() : Promise.resolve([] as Plan[]),
        canReadStores ? adminApi.listWorkspaceRows(can) : Promise.resolve([] as AdminWorkspaceRow[]),
      ]),
    []
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<AnnouncementForm | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const announcements = useMemo(() => data?.[0] ?? [], [data]);
  const plans = data?.[1] ?? [];
  const workspaces = data?.[2] ?? [];

  const setAnnouncements = (fn: (list: Announcement[]) => Announcement[]) =>
    setData((prev) => {
      if (!prev) throw new Error("Announcements not loaded.");
      return [fn(prev[0]), prev[1], prev[2]];
    });

  const filtered = announcements.filter((a) => filter === "all" || adminApi.announcementStatus(a) === filter);
  const options = (
    [
      ["all", "All"],
      ["live", "Live"],
      ["scheduled", "Scheduled"],
      ["ended", "Ended"],
    ] as Array<[Filter, string]>
  ).map(([value, label]) => ({
    value,
    label,
    count: value === "all" ? announcements.length : announcements.filter((a) => adminApi.announcementStatus(a) === value).length,
  }));

  function audienceLabel(a: Announcement) {
    if (a.audience === "plan") return canReadPlans ? `Plan: ${plans.find((p) => p.id === a.planId)?.name ?? "Unknown plan"}` : "One plan";
    if (a.audience === "workspace") return `Workspace: ${a.workspaceName ?? a.workspaceId}`;
    return "All merchants";
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Banner messages shown in merchant dashboards."
        actions={
          canManage && (
            <Button onClick={() => setEditing(emptyForm())} disabled={!data}>
              <Plus /> New announcement
            </Button>
          )
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <FilterChips options={options} value={filter} onChange={setFilter} className="mb-4" />
        {filtered.length === 0 ? (
          <EmptyBlock message={announcements.length === 0 ? "No announcements yet." : "No announcements in this state."} />
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Status value={adminApi.announcementStatus(a)} />
                  <StatusBadge tone={a.severity === "warning" ? "warning" : "info"}>{a.severity}</StatusBadge>
                  <StatusBadge tone="neutral">{audienceLabel(a)}</StatusBadge>
                  <span className="text-xs text-ink-soft">
                    {formatDateTime(a.startsAt)} → {a.endsAt ? formatDateTime(a.endsAt) : "no end"}
                  </span>
                  {canManage && (
                    <div className="ms-auto flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${a.title}`}
                        onClick={() =>
                          setEditing({
                            id: a.id,
                            title: a.title,
                            body: a.body,
                            severity: a.severity,
                            audience: a.audience,
                            planId: a.planId ?? "",
                            workspaceId: a.workspaceId ?? "",
                            startsAt: toDateTimeInput(a.startsAt),
                            endsAt: toDateTimeInput(a.endsAt),
                            dismissible: a.dismissible,
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${a.title}`} onClick={() => setDeleting(a)}>
                        <Trash2 className="text-danger" />
                      </Button>
                    </div>
                  )}
                </div>
                <AnnouncementBanner title={a.title} body={a.body} severity={a.severity} dismissible={a.dismissible} />
                <p className="mt-2 text-xs text-ink-soft">Created by {a.createdBy}</p>
              </li>
            ))}
          </ul>
        )}
      </DataState>

      {editing && data && (
        <AnnouncementEditor
          initial={editing}
          plans={plans}
          workspaces={workspaces}
          canReadPlans={canReadPlans}
          canReadStores={canReadStores}
          onClose={() => setEditing(null)}
          onSaved={(a) => {
            setAnnouncements((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]));
            toast.success(adminApi.announcementStatus(a) === "scheduled" ? "Announcement scheduled." : "Announcement saved.");
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The banner is removed from merchant dashboards immediately."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteAnnouncement(deleting.id);
          setAnnouncements((list) => list.filter((x) => x.id !== deleting.id));
          toast.success("Announcement deleted.");
          setDeleting(null);
        }}
      />
    </div>
  );
}

function AnnouncementEditor({
  initial,
  plans,
  workspaces,
  canReadPlans,
  canReadStores,
  onClose,
  onSaved,
}: {
  initial: AnnouncementForm;
  plans: Plan[];
  workspaces: AdminWorkspaceRow[];
  canReadPlans: boolean;
  canReadStores: boolean;
  onClose: () => void;
  onSaved: (a: Announcement) => void;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AnnouncementForm>(k: K, v: AnnouncementForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.startsAt) {
      setError("Start time is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await adminApi.saveAnnouncement({
          id: form.id,
          title: form.title,
          body: form.body,
          severity: form.severity,
          audience: form.audience,
          planId: form.planId || null,
          workspaceId: form.workspaceId || null,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          dismissible: form.dismissible,
        })
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={form.id ? "Edit announcement" : "New announcement"}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="announcement-form" disabled={busy}>
            {busy ? "Saving…" : form.startsAt && new Date(form.startsAt).getTime() > Date.now() ? "Schedule" : "Publish now"}
          </Button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Title" required maxLength={80} value={form.title} onChange={(e) => set("title", e.target.value)} />
        <TextAreaField label="Message" required maxLength={280} hint={`${form.body.length}/280`} value={form.body} onChange={(e) => set("body", e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Severity" value={form.severity} onChange={(e) => set("severity", e.target.value as AnnouncementSeverity)}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
          </SelectField>
          <SelectField label="Audience" value={form.audience} onChange={(e) => set("audience", e.target.value as AnnouncementAudience)}>
            <option value="all">All merchants</option>
            {(canReadPlans || form.audience === "plan") && <option value="plan">Workspaces on a plan</option>}
            {(canReadStores || form.audience === "workspace") && <option value="workspace">A single workspace</option>}
          </SelectField>
          {form.audience === "plan" && canReadPlans && (
            <SelectField label="Plan" required value={form.planId} onChange={(e) => set("planId", e.target.value)}>
              <option value="">Choose a plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          )}
          {form.audience === "workspace" && canReadStores && (
            <SelectField label="Workspace" required value={form.workspaceId} onChange={(e) => set("workspaceId", e.target.value)}>
              <option value="">Choose a workspace…</option>
              {workspaces.map(({ workspace }) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Starts" type="datetime-local" required value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          <TextField label="Ends" type="datetime-local" hint="Optional." value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </div>
        <Toggle label="Dismissible" description="Merchants can close the banner." checked={form.dismissible} onChange={(v) => set("dismissible", v)} />
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Preview</p>
          <div className="rounded-[0.875rem] border border-dashed border-line bg-paper-sunken p-3">
            <AnnouncementBanner title={form.title} body={form.body} severity={form.severity} dismissible={form.dismissible} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
