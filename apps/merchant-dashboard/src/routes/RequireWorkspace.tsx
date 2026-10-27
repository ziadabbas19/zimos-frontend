import { Navigate, Outlet } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PageLoader } from "@/components/DataState";

export function RequireWorkspace() {
  const { loading, workspaces, currentWorkspace } = useWorkspace();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <PageLoader />
      </div>
    );
  }

  if (workspaces.length === 0 || !currentWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  return <Outlet />;
}
