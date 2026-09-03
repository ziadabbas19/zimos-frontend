import { useWorkspace } from "@/context/WorkspaceContext";

/**
 * The current workspace id. Safe to call `!`-free inside the dashboard routes:
 * they all render under <RequireWorkspace/>, which redirects when none is set.
 */
export function useWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}
