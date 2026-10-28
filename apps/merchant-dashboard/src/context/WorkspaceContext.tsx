import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BillingCycle, Workspace } from "@store-builder/api-client";
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
  /** `referralCode`: an agent's code, attached to the new store's subscription. */
  /** `plan`: one of the public plans, while the server requires plans (see GET /auth/signup-options). */
  createWorkspace: (
    name: string,
    slug?: string,
    referralCode?: string,
    plan?: { planId: string; billingCycle?: BillingCycle }
  ) => Promise<CreateWorkspaceResult>;
  /**
   * Re-read the workspace list. `silent` keeps the current list on screen —
   * without it `loading` flips and RequireWorkspace swaps the whole layout
   * for the Z loader, which is wrong after an in-page save.
   */
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  /**
   * Put a workspace the API just returned from a save into the list, so every
   * screen reads what the server now holds — without a re-read, which would
   * flip `loading` (see `refresh`).
   */
  applySavedWorkspace: (workspace: Workspace) => void;
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
      // Functional update: `refresh` is often called from a closure captured
      // before a selection changed (createWorkspace selects, then refreshes),
      // and must not overwrite that newer selection with list[0].
      setCurrentWorkspaceId((prev) => {
        if (prev || list.length === 0) return prev;
        localStorage.setItem(CURRENT_WORKSPACE_KEY, list[0].id);
        return list[0].id;
      });
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
       *
       * The list is then re-read rather than extended with the POST response:
       * that response carries no `role`, and every role-gated screen (Shipping,
       * Payments, the confirmation queue, ...) would treat the creator as a
       * non-owner until the next reload. The re-read is silent and awaited, so
       * the picker still shows its "creating" state and the new store is in the
       * list, with its role, before anything navigates into it.
       */
      async createWorkspace(name, slug, referralCode, plan) {
        // A bad referral code refuses the whole creation (422
        // REFERRAL_CODE_INVALID), so nothing exists yet to clean up.
        const created = await apiClient.createWorkspace(name, referralCode || undefined, plan);
        let workspace = created;
        let addressError: string | undefined;

        if (slug && slug !== created.slug) {
          try {
            workspace = await apiClient.updateWorkspace(created.id, { slug });
          } catch (err) {
            addressError = getErrorMessage(err);
          }
        }

        setCurrentWorkspaceId(workspace.id);
        localStorage.setItem(CURRENT_WORKSPACE_KEY, workspace.id);
        try {
          await refresh({ silent: true });
        } catch {
          // The store exists; don't fail creation over the re-read. Fall back to
          // the POST response so it is at least listed and selectable.
          setWorkspaces((prev) =>
            prev.some((w) => w.id === workspace.id) ? prev : [...prev, workspace]
          );
        }
        return { workspace, addressError };
      },
      refresh,
      applySavedWorkspace(saved) {
        // A PATCH response carries no `role` or `permissions`; keep the ones the
        // list read gave, or every role-gated screen would treat the merchant
        // as a non-owner.
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === saved.id ? { ...w, ...saved, role: w.role, permissions: w.permissions } : w))
        );
      },
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
