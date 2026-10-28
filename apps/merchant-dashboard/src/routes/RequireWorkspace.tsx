import { Navigate, Outlet } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PageLoader } from "@/components/DataState";
import { useStoreFromLink } from "@/lib/useStoreFromLink";

export function RequireWorkspace() {
  const { loading, workspaces, currentWorkspace } = useWorkspace();
  // ?workspace=<id> on any page (a device notification's link) opens that store, when it is one of the user's.
  useStoreFromLink();

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
