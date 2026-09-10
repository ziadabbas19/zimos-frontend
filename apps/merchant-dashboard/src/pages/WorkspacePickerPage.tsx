import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardContent, Input, Label, Alert, Spinner } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@store-builder/api-client";

export function WorkspacePickerPage() {
  const { user, logout } = useAuth();
  const { workspaces, loading, selectWorkspace, createWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToDashboard(workspaceId: string) {
    selectWorkspace(workspaceId);
    navigate("/");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const workspace = await createWorkspace(name.trim());
      navigate("/");
      void workspace;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the store. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium text-ink">
              {workspaces.length > 0 ? "Choose a store" : "Let's set up your store"}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Signed in as {user?.email}.{" "}
              <button onClick={() => logout()} className="cursor-pointer text-primary hover:underline">
                Sign out
              </button>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center text-ink-soft">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            {workspaces.length > 0 && (
              <div className="mt-8 space-y-3">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => goToDashboard(workspace.id)}
                    className="cursor-pointer flex w-full items-center justify-between rounded-[var(--radius-card)] border border-line bg-paper-raised px-5 py-4 text-left transition-colors hover:border-primary"
                  >
                    <div>
                      <p className="font-medium text-ink">{workspace.name}</p>
                      <p className="text-xs text-ink-soft">{workspace.slug}</p>
                    </div>
                    <span className="text-sm text-primary">Open →</span>
                  </button>
                ))}
              </div>
            )}

            <Card className="mt-8">
              <CardContent className="pt-6">
                <h2 className="font-display text-lg font-medium text-ink">Create a new store</h2>
                <form onSubmit={handleCreate} className="mt-4 space-y-4">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="space-y-1.5">
                    <Label htmlFor="workspaceName">Store name</Label>
                    <Input
                      id="workspaceName"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ahmed's Store"
                    />
                  </div>
                  <Button type="submit" disabled={creating || name.trim().length === 0}>
                    {creating ? "Creating…" : "Create store"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
