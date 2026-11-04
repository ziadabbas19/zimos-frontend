import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchInput, TextField } from "@/components/forms";
import { Mono, Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import type {
  AdminFeatureFlag as FeatureFlag,
  AdminFeatureFlagInput as FeatureFlagInput,
} from "@store-builder/api-client";
import { formatRelative } from "@/lib/format";

function toInput(flag: FeatureFlag): FeatureFlagInput {
  return { id: flag.id, key: flag.key, description: flag.description, enabled: flag.enabled, rollout: flag.rollout, targetWorkspaceIds: flag.targetWorkspaceIds };
}

export function FeatureFlagsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can(P.FEATURE_FLAGS_MANAGE);
  // Targeting picks from the store list, which is its own permission.
  const canTarget = canManage && can(P.WORKSPACES_VIEW);
  const { data, loading, error, refresh, setData } = useAsync(
    () => Promise.all([adminApi.listFlags(), canTarget ? adminApi.listWorkspaceRows(can) : Promise.resolve([] as AdminWorkspaceRow[])]),
    []
  );
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [targeting, setTargeting] = useState<FeatureFlag | null>(null);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);

  const flags = useMemo(() => data?.[0] ?? [], [data]);
  const workspaces = data?.[1] ?? [];

  const upsert = (flag: FeatureFlag) =>
    setData((prev) => {
      if (!prev) throw new Error("Flags not loaded.");
      const list = prev[0].some((f) => f.id === flag.id) ? prev[0].map((f) => (f.id === flag.id ? flag : f)) : [...prev[0], flag].sort((a, b) => a.key.localeCompare(b.key));
      return [list, prev[1]];
    });

  const filtered = flags.filter((f) => {
    const q = query.trim().toLowerCase();
    return !q || f.key.includes(q) || f.description.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Feature flags"
        description="Gradual rollouts and per-workspace targeting."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)} disabled={!data}>
              <Plus /> New flag
            </Button>
          )
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search flags" />
          <span className="text-sm text-ink-soft">
            {flags.filter((f) => f.enabled).length} of {flags.length} enabled
          </span>
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={flags.length === 0 ? "No feature flags yet." : "No flags match your search."} />
        ) : (
          <Panel flush>
            <ul className="divide-y divide-line">
              {filtered.map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  canManage={canManage}
                  onSaved={upsert}
                  onTargets={canTarget ? () => setTargeting(flag) : undefined}
                  onDelete={() => setDeleting(flag)}
                />
              ))}
            </ul>
          </Panel>
        )}
      </DataState>

      {creating && (
        <CreateFlagModal
          onClose={() => setCreating(false)}
          onSaved={(f) => {
            upsert(f);
            toast.success(`Flag ${f.key} created.`);
            setCreating(false);
          }}
        />
      )}
      {targeting && (
        <TargetsModal
          flag={targeting}
          workspaces={workspaces}
          onClose={() => setTargeting(null)}
          onSaved={(f) => {
            upsert(f);
            toast.success(`Targets updated for ${f.key}.`);
            setTargeting(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.key ?? ""}?`}
        description="Code checking this flag will receive the default (off)."
        confirmLabel="Delete flag"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteFlag(deleting.id);
          setData((prev) => {
            if (!prev) throw new Error("Flags not loaded.");
            return [prev[0].filter((f) => f.id !== deleting.id), prev[1]];
          });
          toast.success("Flag deleted.");
          setDeleting(null);
        }}
      />
    </div>
  );
}

function FlagRow({
  flag,
  canManage,
  onSaved,
  onTargets,
  onDelete,
}: {
  flag: FeatureFlag;
  canManage: boolean;
  onSaved: (f: FeatureFlag) => void;
  onTargets?: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [rollout, setRollout] = useState(flag.rollout);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRollout(flag.rollout);
  }, [flag.rollout]);

  async function persist(patch: Partial<FeatureFlagInput>, message: string) {
    setSaving(true);
    try {
      onSaved(await adminApi.saveFlag({ ...toInput(flag), ...patch }));
      toast.success(message);
    } catch (err) {
      setRollout(flag.rollout);
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const commitRollout = () => {
    if (rollout !== flag.rollout) void persist({ rollout }, `${flag.key} rollout set to ${rollout}%.`);
  };

  return (
    <li className="grid grid-cols-1 items-center gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_16rem_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Mono className="text-sm">{flag.key}</Mono>
          <StatusBadge tone={flag.enabled ? "success" : "neutral"} dot>
            {flag.enabled ? "On" : "Off"}
          </StatusBadge>
          {flag.targetWorkspaceIds.length > 0 && (
            <StatusBadge tone="primary">
              {flag.targetWorkspaceIds.length} targeted workspace{flag.targetWorkspaceIds.length === 1 ? "" : "s"}
            </StatusBadge>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-soft">{flag.description || "No description."}</p>
        <p className="mt-0.5 text-xs text-ink-soft">Updated {formatRelative(flag.updatedAt)}</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs">
          {canManage ? (
            <label htmlFor={`rollout-${flag.id}`} className="font-medium text-ink-soft">
              Rollout
            </label>
          ) : (
            <span className="font-medium text-ink-soft">Rollout</span>
          )}
          <span className="tabular font-semibold text-ink">{rollout}%</span>
        </div>
        {canManage && (
          <>
            <input
              id={`rollout-${flag.id}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={rollout}
              disabled={!flag.enabled || saving}
              onChange={(e) => setRollout(Number(e.target.value))}
              onPointerUp={commitRollout}
              onKeyUp={(e) => {
                if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End" || e.key.startsWith("Page")) commitRollout();
              }}
              className="range-primary mt-1 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-ink-soft">{flag.enabled ? "Targeted workspaces always receive the flag." : "Enable the flag to roll out."}</p>
          </>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-2 lg:justify-end">
          <Toggle
            label={`${flag.key} enabled`}
            hideLabel
            checked={flag.enabled}
            disabled={saving}
            onChange={(v) => void persist({ enabled: v }, `${flag.key} turned ${v ? "on" : "off"}.`)}
          />
          {onTargets && (
            <Button size="sm" variant="outline" onClick={onTargets}>
              <Target /> Targets
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${flag.key}`} onClick={onDelete}>
            <Trash2 className="text-danger" />
          </Button>
        </div>
      )}
    </li>
  );
}

function CreateFlagModal({ onClose, onSaved }: { onClose: () => void; onSaved: (f: FeatureFlag) => void }) {
  const [form, setForm] = useState<FeatureFlagInput>({ key: "", description: "", enabled: false, rollout: 0, targetWorkspaceIds: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await adminApi.saveFlag(form));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="New feature flag"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="flag-form" disabled={busy}>
            {busy ? "Creating…" : "Create flag"}
          </Button>
        </>
      }
    >
      <form id="flag-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Key" required placeholder="checkout.one_page_v2" hint="Lowercase, dots and underscores. Can't be changed later in code without a migration." value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
        <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <TextField
          label="Initial rollout %"
          type="number"
          min={0}
          max={100}
          value={String(form.rollout)}
          onChange={(e) => setForm({ ...form, rollout: Number(e.target.value) })}
        />
        <Toggle label="Enabled" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      </form>
    </Modal>
  );
}

function TargetsModal({
  flag,
  workspaces,
  onClose,
  onSaved,
}: {
  flag: FeatureFlag;
  workspaces: AdminWorkspaceRow[];
  onClose: () => void;
  onSaved: (f: FeatureFlag) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(flag.targetWorkspaceIds));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = new Set(workspaces.map((w) => w.workspace.id));
  const unknownIds = flag.targetWorkspaceIds.filter((id) => !known.has(id));
  const visible = workspaces.filter(({ workspace }) => {
    const q = query.trim().toLowerCase();
    return !q || workspace.name.toLowerCase().includes(q) || workspace.slug.includes(q);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await adminApi.saveFlag({ ...toInput(flag), targetWorkspaceIds: Array.from(selected) }));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Targeted workspaces"
      description={`Workspaces that always receive ${flag.key} when it is on, regardless of rollout %.`}
      footer={
        <>
          <span className="me-auto text-sm text-ink-soft">{selected.size} selected</span>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save targets"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="danger">{error}</Alert>}
        <Input type="search" placeholder="Filter workspaces" aria-label="Filter workspaces" value={query} onChange={(e) => setQuery(e.target.value)} />
        {unknownIds.length > 0 && (
          <p className="text-xs text-ink-soft">
            {unknownIds.length} targeted id{unknownIds.length === 1 ? " is" : "s are"} not in the current workspace list and will be kept.
          </p>
        )}
        <ul className="scroll-thin max-h-72 divide-y divide-line overflow-y-auto rounded-[0.875rem] border border-line">
          {visible.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-ink-soft">No workspaces match.</li>
          ) : (
            visible.map(({ workspace, subscription }) => (
              <li key={workspace.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-primary-soft/50">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={selected.has(workspace.id)}
                    onChange={() => toggle(workspace.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{workspace.name}</span>
                  <span className="text-xs text-ink-soft">{subscription?.planName ?? ""}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}
