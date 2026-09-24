import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Workspace } from "@store-builder/api-client";
import { getErrorMessage } from "@/lib/errors";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "./AuthContext";

const CURRENT_WORKSPACE_KEY = "sb.currentWorkspaceId";

/**
 * The outcome of creating a store. `addressError` is set when the store was
 * created but the address the merchant picked could not be applied — the store
 * still exists, under the address the backend generated, so this is something
 * to explain rather than an error to throw.
 */
export interface CreateWorkspaceResult {
  workspace: Workspace;
  addressError?: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  selectWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, slug?: string) => Promise<CreateWorkspaceResult>;
  /**
   * Re-read the workspace list. `silent` keeps the current list on screen —
   * without it `loading` flips and RequireWorkspace swaps the whole layout
   * for a spinner, which is wrong after an in-page save.
   */
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_WORKSPACE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const refresh = async (opts?: { silent?: boolean }) => {
    // Auth is still resolving on a fresh page load — stay in the loading state
    // rather than briefly reporting "no workspaces" (which bounces deep links
    // and refreshes to the workspace picker).
    if (status === "loading") {
      setLoading(true);
      return;
    }
    if (status !== "authenticated") {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const list = await apiClient.listWorkspaces();
      setWorkspaces(list);
      if (!currentWorkspaceId && list.length > 0) {
        setCurrentWorkspaceId(list[0].id);
        localStorage.setItem(CURRENT_WORKSPACE_KEY, list[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      currentWorkspace: workspaces.find((w) => w.id === currentWorkspaceId) ?? null,
      loading,
      selectWorkspace(workspaceId) {
        setCurrentWorkspaceId(workspaceId);
        localStorage.setItem(CURRENT_WORKSPACE_KEY, workspaceId);
      },
      /**
       * Two calls, because `POST /workspaces` takes only a name and derives the
       * address itself — there is no way to hand it one. So the store is
       * created, then moved to the address the merchant chose.
       *
       * The move is allowed to fail without failing the whole thing. By the
       * time it runs the store exists, and throwing would leave the merchant
       * looking at an error beside a store that had in fact been created. A
       * clash here means someone took the address between the last check and
       * the write, which is rare but not impossible.
       */
      async createWorkspace(name, slug) {
        const created = await apiClient.createWorkspace(name);
        let workspace = created;
        let addressError: string | undefined;

        if (slug && slug !== created.slug) {
          try {
            workspace = await apiClient.updateWorkspace(created.id, { slug });
          } catch (err) {
            addressError = getErrorMessage(err);
          }
        }

        setWorkspaces((prev) => [...prev, workspace]);
        setCurrentWorkspaceId(workspace.id);
        localStorage.setItem(CURRENT_WORKSPACE_KEY, workspace.id);
        return { workspace, addressError };
      },
      refresh,
    }),
    [workspaces, currentWorkspaceId, loading]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
