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
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "./catalogLabels";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Collections",
    products: "Products",
    description: "Storefront groupings. Add or remove products from a product's own page.",
    newCollection: "New collection",
    empty: "No collections yet. Create your first one.",
    showProducts: "Show products",
    hideProducts: "Hide products",
    noProducts: "No products in this collection yet.",
    rename: "Rename",
    delete: "Delete",
    editTitle: "Edit collection",
    deleteTitle: "Delete “{name}”?",
    deleteDescription:
      "A collection is only a storefront grouping — deleting it is permanent, but the products in it are not affected.",
    deleteConfirm: "Delete collection",
    deleting: "Deleting…",
    deletedToast: "“{name}” deleted. Products themselves are untouched.",
    name: "Name",
    namePlaceholder: "Summer",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Warm-weather picks",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    create: "Create",
    savedToast: "Collection saved.",
    createdToast: "“{name}” created.",
  },
  ar: {
    title: "المجموعات",
    products: "المنتجات",
    description: "مجموعات المنتجات في المتجر. أضف المنتجات أو أزلها من صفحة كل منتج.",
    newCollection: "مجموعة جديدة",
    empty: "لا توجد مجموعات بعد. أنشئ أول مجموعة.",
    showProducts: "عرض المنتجات",
    hideProducts: "إخفاء المنتجات",
    noProducts: "لا توجد منتجات في هذه المجموعة بعد.",
    rename: "إعادة تسمية",
    delete: "حذف",
    editTitle: "تعديل المجموعة",
    deleteTitle: "حذف “{name}”؟",
    deleteDescription:
      "المجموعة مجرد تجميع في المتجر — حذفها نهائي، لكن المنتجات التي بداخلها لن تتأثر.",
    deleteConfirm: "حذف المجموعة",
    deleting: "جارٍ الحذف…",
    deletedToast: "تم حذف “{name}”. المنتجات نفسها لم تتغير.",
    name: "الاسم",
    namePlaceholder: "الصيف",
    descriptionLabel: "الوصف",
    descriptionPlaceholder: "اختيارات للجو الحار",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    create: "إنشاء",
    savedToast: "تم حفظ المجموعة.",
    createdToast: "تم إنشاء “{name}”.",
  },
} satisfies Messages;

function CollectionForm({
  collection,
  onDone,
  onCancel,
}: {
  collection?: CollectionSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
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
        toast.success(t.savedToast);
      } else {
        await apiClient.createCollection(workspaceId, payload);
        toast.success(fmt(t.createdToast, { name: payload.name }));
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField
        label={t.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={t.namePlaceholder}
      />
      <Field label={t.descriptionLabel} error={fieldErrors.description}>
        {({ id }) => (
          <Textarea
            id={id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descriptionPlaceholder}
          />
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0}>
          {saving ? t.saving : collection ? t.save : t.create}
        </Button>
      </div>
    </form>
  );
}

function CollectionProducts({ collectionId }: { collectionId: string }) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const detail = useAsync(
    () => apiClient.getCollection(workspaceId, collectionId),
    [workspaceId, collectionId]
  );

  if (detail.loading) return <Spinner className="size-4" />;
  if (detail.error)
    return <p className="text-sm text-danger">{errorMessage(detail.error)}</p>;

  const products = detail.data?.products ?? [];
  if (products.length === 0)
    return <p className="text-sm text-ink-soft">{t.noProducts}</p>;

  return (
    <ul className="space-y-1 text-sm">
      {products.map((p) => (
        <li key={p.id}>
          <Link to={`/catalog/${p.id}`} className="text-primary hover:underline">
            {p.name}
          </Link>
          <span className="ms-2 text-xs text-ink-soft">{labels.status(p.status)}</span>
        </li>
      ))}
    </ul>
  );
}

export function CollectionsPage() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
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
    try {
      await apiClient.deleteCollection(workspaceId, deleting.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.deletedToast, { name: deleting.name }));
    setDeleting(null);
    reload();
  }

  const collections = list.data ?? [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        back={{ to: "/catalog", label: t.products }}
        description={t.description}
        actions={<Button onClick={() => setCreating(true)}>{t.newCollection}</Button>}
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={collections.length === 0}
        emptyMessage={t.empty}
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
                      {expanded === c.id ? t.hideProducts : t.showProducts}
                    </button>
                    {expanded === c.id && (
                      <div className="mt-2 border-s-2 border-line ps-3">
                        <CollectionProducts collectionId={c.id} />
                      </div>
                    )}
                  </div>
                  <div className="whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      {t.rename}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setDeleting(c)}
                    >
                      {t.delete}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.newCollection}>
        <CollectionForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editTitle}>
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
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deleting}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
