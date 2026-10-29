/** The store last opened on this device (context/WorkspaceContext keeps it; lib/bootstrap reads it before anything renders). */
export const CURRENT_WORKSPACE_KEY = "sb.currentWorkspaceId";

export function storedWorkspaceId(): string | null {
  try {
    return localStorage.getItem(CURRENT_WORKSPACE_KEY);
  } catch {
    return null;
  }
}
