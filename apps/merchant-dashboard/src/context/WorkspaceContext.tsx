import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Workspace } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "./AuthContext";

const CURRENT_WORKSPACE_KEY = "sb.currentWorkspaceId";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  selectWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_WORKSPACE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
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
    setLoading(true);
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
      async createWorkspace(name) {
        const workspace = await apiClient.createWorkspace(name);
        setWorkspaces((prev) => [...prev, workspace]);
        setCurrentWorkspaceId(workspace.id);
        localStorage.setItem(CURRENT_WORKSPACE_KEY, workspace.id);
        return workspace;
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
