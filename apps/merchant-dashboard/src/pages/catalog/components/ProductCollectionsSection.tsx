import { useMemo, useState } from "react";
import { Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { CollectionSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";

interface Props {
  productId: string;
  /** Collections the product currently belongs to (from product detail). */
  memberships: CollectionSummary[];
  onChanged: () => void;
}

export function ProductCollectionsSection({ productId, memberships, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const all = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const memberIds = useMemo(() => new Set(memberships.map((c) => c.id)), [memberships]);
  const available = (all.data ?? []).filter((c) => !memberIds.has(c.id));

  async function add() {
    if (!pick) return;
    setBusy(true);
    try {
      await apiClient.addProductToCollection(workspaceId, productId, pick);
      toast.success("Added to collection.");
      setPick("");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(collectionId: string) {
    setBusy(true);
    try {
      await apiClient.removeProductFromCollection(workspaceId, productId, collectionId);
      toast.success("Removed from collection.");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="font-display text-lg font-medium text-ink">Collections</h2>
        <p className="text-sm text-ink-soft">Storefront groupings this product appears in.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {memberships.length === 0 && (
            <span className="text-sm text-ink-soft">Not in any collection yet.</span>
          )}
          {memberships.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-sm text-ink"
            >
              {c.name}
              <button
                onClick={() => remove(c.id)}
                disabled={busy}
                className="cursor-pointer text-ink-soft hover:text-danger"
                aria-label={`Remove from ${c.name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {all.loading ? (
            <Spinner className="size-4" />
          ) : all.error ? (
            <span className="text-sm text-danger">{getErrorMessage(all.error)}</span>
          ) : available.length === 0 ? (
            <span className="text-sm text-ink-soft">
              {(all.data ?? []).length === 0
                ? "No collections exist yet — create one on the Collections page."
                : "In every collection already."}
            </span>
          ) : (
            <>
              <Select value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-xs">
                <option value="">Add to a collection…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={add} disabled={!pick || busy}>
                Add
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
