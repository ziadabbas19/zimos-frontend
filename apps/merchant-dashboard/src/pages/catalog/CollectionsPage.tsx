import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type {
  CollectionSummary,
  CreateCollectionPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

function CollectionForm({
  collection,
  onDone,
  onCancel,
}: {
  collection?: CollectionSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: CreateCollectionPayload = {
      name: name.trim(),
      description: description.trim(),
    };
    try {
      if (collection) {
        await apiClient.updateCollection(workspaceId, collection.id, payload);
        toast.success("Collection saved.");
      } else {
        await apiClient.createCollection(workspaceId, payload);
        toast.success(`"${payload.name}" created.`);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder="Summer"
      />
      <Field label="Description" error={fieldErrors.description}>
        {({ id }) => (
          <Textarea
            id={id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Warm-weather picks"
          />
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0}>
          {saving ? "Saving…" : collection ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}

function CollectionProducts({ collectionId }: { collectionId: string }) {
  const workspaceId = useWorkspaceId();
  const detail = useAsync(
    () => apiClient.getCollection(workspaceId, collectionId),
    [workspaceId, collectionId]
  );

  if (detail.loading) return <Spinner className="size-4" />;
  if (detail.error)
    return <p className="text-sm text-danger">{getErrorMessage(detail.error)}</p>;

  const products = detail.data?.products ?? [];
  if (products.length === 0)
    return <p className="text-sm text-ink-soft">No products in this collection yet.</p>;

  return (
    <ul className="space-y-1 text-sm">
      {products.map((p) => (
        <li key={p.id}>
          <Link to={`/catalog/${p.id}`} className="text-primary hover:underline">
            {p.name}
          </Link>
          <span className="ml-2 text-xs text-ink-soft">{p.status}</span>
        </li>
      ))}
    </ul>
  );
}

export function CollectionsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollectionSummary | null>(null);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = () => list.refresh({ silent: true });

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteCollection(workspaceId, deleting.id);
    toast.success(`"${deleting.name}" deleted. Products themselves are untouched.`);
    setDeleting(null);
    reload();
  }

  const collections = list.data ?? [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Collections"
        back={{ to: "/catalog", label: "Products" }}
        description="Storefront groupings. Add or remove products from a product's own page."
        actions={<Button onClick={() => setCreating(true)}>New collection</Button>}
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={collections.length === 0}
        emptyMessage="No collections yet. Create your first one."
        onRetry={() => list.refresh()}
      >
        <div className="space-y-2">
          {collections.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft">{c.slug}</p>
                    {c.description && (
                      <p className="mt-1 text-sm text-ink-soft">{c.description}</p>
                    )}
                    <button
                      onClick={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
                      className="cursor-pointer mt-2 text-xs text-primary hover:underline"
                    >
                      {expanded === c.id ? "Hide products" : "Show products"}
                    </button>
                    {expanded === c.id && (
                      <div className="mt-2 border-l-2 border-line pl-3">
                        <CollectionProducts collectionId={c.id} />
                      </div>
                    )}
                  </div>
                  <div className="whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setDeleting(c)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title="New collection">
        <CollectionForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit collection">
        {editing && (
          <CollectionForm
            collection={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="A collection is only a storefront grouping — deleting it is permanent, but the products in it are not affected."
        confirmLabel="Delete collection"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
