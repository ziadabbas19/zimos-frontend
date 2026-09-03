import { Navigate, Outlet } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Spinner } from "@store-builder/ui";

export function RequireWorkspace() {
  const { loading, workspaces, currentWorkspace } = useWorkspace();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-soft">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (workspaces.length === 0 || !currentWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  return <Outlet />;
}
