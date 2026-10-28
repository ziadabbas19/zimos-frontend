import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";

/**
 * A link that names one of the user's stores (?workspace=<id>: a device
 * notification, the way back from Fawaterak) opens that store, since the
 * current store is whichever was picked last in this browser. A store that is
 * not one of the user's is ignored: the page opens on the current store (and
 * the API answers 404 for what belongs to another). The parameter stays in the
 * address for the page that reads it.
 */
export function useStoreFromLink(): void {
  const [params] = useSearchParams();
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace();
  const wanted = params.get("workspace");
  useEffect(() => {
    if (wanted && wanted !== currentWorkspace?.id && workspaces.some((w) => w.id === wanted)) selectWorkspace(wanted);
  }, [wanted, currentWorkspace?.id, workspaces, selectWorkspace]);
}
