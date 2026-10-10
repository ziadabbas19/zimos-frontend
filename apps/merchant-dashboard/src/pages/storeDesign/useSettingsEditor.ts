import { useState } from "react";
import { ApiError, type Workspace } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useToast } from "@/components/Toast";

/**
 * Role keys that carry website.edit (SYSTEM_ROLES in the backend's
 * core/security/permissions.js) — what PATCH /workspaces/:id asks for. The
 * dashboard only sees the role key, so a 403 on save also flips a tab to
 * read-only.
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "editor"]);

/**
 * The draft / saved / saving / error state every store-settings tab shares:
 * `read` picks the tab's slice out of the workspace settings blob, `write`
 * saves a draft and answers with the updated workspace.
 */
export function useSettingsEditor<T>(
  read: (settings: Record<string, unknown>) => T,
  write: (draft: T) => Promise<Workspace>,
  savedMessage: string
) {
  const { currentWorkspace, refresh } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const settingsOf = (w: { settings?: unknown } | null | undefined) => (w?.settings ?? {}) as Record<string, unknown>;

  const [saved, setSaved] = useState<T>(() => read(settingsOf(currentWorkspace)));
  const [draft, setDraft] = useState<T>(saved);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // Leaving the page with an edit that is not saved asks first (lib/useUnsavedGuard).
  useReportDirty(editable && dirty);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const workspace = await write(draft);
      const next = read(settingsOf(workspace));
      setSaved(next);
      setDraft(next);
      toast.success(savedMessage);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setDraft(saved);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return {
    ready: !!currentWorkspace,
    draft,
    setDraft,
    saved,
    dirty,
    saving,
    editable,
    forbidden,
    error,
    save,
    reset: () => {
      setDraft(saved);
      setError(null);
    },
  };
}
