import { useEffect, useState } from "react";
import { Card, CardContent, Spinner, Alert } from "@store-builder/ui";
import type { Workspace } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .adminListWorkspaces()
      .then(setWorkspaces)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load workspaces."));
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink">Workspaces</h1>
      <p className="mt-1 text-sm text-ink-soft">Every store created on the platform.</p>

      <div className="mt-6">
        {error && <Alert variant="danger">{error}</Alert>}
        {!workspaces && !error && (
          <div className="flex justify-center py-12 text-ink-soft">
            <Spinner className="size-6" />
          </div>
        )}
        {workspaces && workspaces.length === 0 && (
          <p className="text-sm text-ink-soft">No workspaces yet.</p>
        )}
        {workspaces && workspaces.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Slug</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => (
                    <tr key={workspace.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium text-ink">{workspace.name}</td>
                      <td className="px-5 py-3 text-ink-soft">{workspace.slug}</td>
                      <td className="px-5 py-3 text-ink-soft">
                        {new Date(workspace.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
