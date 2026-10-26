import { catalogCollectionFlags } from "@store-builder/api-client";
import { CollectionVisibilityFields } from "./components/CollectionVisibilityFields";
import { CollectionSeoFields, collectionSeoOf, collectionSeoPayload, downloadCollectionsCsv } from "./components/CollectionSeoFields";
import { storeUrl } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Download,
  ExternalLink,
  Folder,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  ListOrdered,
  Pencil,
  Trash2,
} from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import type { CollectionDetail, CollectionSummary, CreateCollectionPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "./catalogLabels";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { ImageField } from "@/pages/website/editor/ImageField";
import {
  MAX_DEPTH,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  flattenTree,
  indent,
  moveAmongSiblings,
  moveSubtree,
  outdent,
  projectedDepth,
  reorderItems,
  subtreeRange,
  type FlatNode,
} from "./collectionTree";

/** Pixels per level, on screen and for the sideways pull while dragging. */
const INDENT = 28;

const STRINGS = {
  en: {
    title: "Collections",
    products: "Products",
    description:
      "How your storefront groups products, up to three levels deep. Drag a collection to reorder it — pull it sideways to put it inside the one above — or use the arrows.",
    newCollection: "New collection",
    empty: "No collections yet. Create your first one.",
    noProducts: "No products in this collection yet.",
    productCountOne: "1 product",
    productCountOther: "{n} products",
    reorder: "Reorder {name}",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    indent: "Put {name} inside the collection above",
    outdent: "Move {name} out one level",
    orderProducts: "Order the products in {name}",
    preview: "Open {name} in the store",
    subcategories: "{n} subcategories",
    subcategory: "1 subcategory",
    inHeader: "In header",
    hiddenBadge: "Hidden",
    exportCsv: "Export",
    edit: "Edit {name}",
    delete: "Delete {name}",
    editTitle: "Edit collection",
    deleteTitle: "Delete “{name}”?",
    deleteDescription:
      "A collection is only a storefront grouping — deleting it is permanent, but the products in it are not affected. Collections inside it move up to the top level.",
    deleteConfirm: "Delete collection",
    deleting: "Deleting…",
    deletedToast: "“{name}” deleted. Products themselves are untouched.",
    name: "Name",
    namePlaceholder: "Summer",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Warm-weather picks",
    parent: "Inside",
    topLevel: "Top level",
    parentHint: "Collections can be nested up to three levels deep.",
    image: "Image",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    create: "Create",
    savedToast: "Collection saved.",
    createdToast: "“{name}” created.",
    orderSaved: "New order saved.",
    orderTitle: "Order of products in “{name}”",
    orderDescription: "The storefront lists this collection's products in this order when sorted by “Featured”.",
    moveProductUp: "Move {name} up",
    moveProductDown: "Move {name} down",
    reorderProduct: "Reorder {name}",
    saveOrder: "Save order",
    dragStart: "Picked up {name}. Use the arrow keys to move it, Space to drop, Escape to cancel.",
    dragOver: "{name} is over {over}.",
    dragEnd: "{name} dropped.",
    dragCancel: "Move cancelled.",
    instructions:
      "To pick up a collection, press Space or Enter. Move it with the up and down arrow keys, press Space or Enter again to drop it, or Escape to cancel.",
  },
  ar: {
    title: "المجموعات",
    products: "المنتجات",
    description:
      "طريقة تجميع المنتجات في متجرك، حتى ثلاثة مستويات. اسحب المجموعة لإعادة ترتيبها — واسحبها جانبًا لوضعها داخل المجموعة التي فوقها — أو استخدم الأسهم.",
    newCollection: "مجموعة جديدة",
    empty: "لا توجد مجموعات بعد. أنشئ أول مجموعة.",
    noProducts: "لا توجد منتجات في هذه المجموعة بعد.",
    productCountOne: "منتج واحد",
    productCountOther: "عدد المنتجات: {n}",
    reorder: "إعادة ترتيب {name}",
    moveUp: "تحريك {name} لأعلى",
    moveDown: "تحريك {name} لأسفل",
    indent: "وضع {name} داخل المجموعة التي فوقها",
    outdent: "إخراج {name} مستوى واحدًا",
    orderProducts: "ترتيب منتجات {name}",
    preview: "فتح {name} في المتجر",
    subcategories: "{n} تصنيف فرعي",
    subcategory: "تصنيف فرعي واحد",
    inHeader: "في الهيدر",
    hiddenBadge: "مخفي",
    exportCsv: "تصدير",
    edit: "تعديل {name}",
    delete: "حذف {name}",
    editTitle: "تعديل المجموعة",
    deleteTitle: "حذف “{name}”؟",
    deleteDescription:
      "المجموعة مجرد تجميع في المتجر — حذفها نهائي، لكن المنتجات التي بداخلها لن تتأثر. وتنتقل المجموعات التي بداخلها إلى المستوى الأعلى.",
    deleteConfirm: "حذف المجموعة",
    deleting: "جارٍ الحذف…",
    deletedToast: "تم حذف “{name}”. المنتجات نفسها لم تتغير.",
    name: "الاسم",
    namePlaceholder: "الصيف",
    descriptionLabel: "الوصف",
    descriptionPlaceholder: "اختيارات للجو الحار",
    parent: "داخل",
    topLevel: "المستوى الأعلى",
    parentHint: "يمكن وضع المجموعات بعضها داخل بعض حتى ثلاثة مستويات.",
    image: "الصورة",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    create: "إنشاء",
    savedToast: "تم حفظ المجموعة.",
    createdToast: "تم إنشاء “{name}”.",
    orderSaved: "تم حفظ الترتيب الجديد.",
    orderTitle: "ترتيب المنتجات في “{name}”",
    orderDescription: "يعرض المتجر منتجات هذه المجموعة بهذا الترتيب عند الترتيب حسب «المميزة».",
    moveProductUp: "تحريك {name} لأعلى",
    moveProductDown: "تحريك {name} لأسفل",
    reorderProduct: "إعادة ترتيب {name}",
    saveOrder: "حفظ الترتيب",
    dragStart: "تم التقاط {name}. استخدم مفاتيح الأسهم لتحريكها، والمسافة لإفلاتها، وEscape للإلغاء.",
    dragOver: "{name} فوق {over}.",
    dragEnd: "تم إفلات {name}.",
    dragCancel: "أُلغي النقل.",
    instructions:
      "لالتقاط مجموعة، اضغط المسافة أو Enter. حرّكها بمفتاحي السهم لأعلى ولأسفل، ثم اضغط المسافة أو Enter لإفلاتها، أو Escape للإلغاء.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

const iconButton =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

function productCount(t: Strings, n: number | undefined) {
  if (n === undefined) return null;
  return n === 1 ? t.productCountOne : fmt(t.productCountOther, { n });
}

/** The parents a collection may move under: not itself, not inside itself, and within three levels. */
function parentChoices(flat: FlatNode<CollectionSummary>[], editingId: string | null) {
  let blocked = new Set<string>();
  let height = 0;
  if (editingId) {
    const index = flat.findIndex((n) => n.item.id === editingId);
    if (index >= 0) {
      const [start, end] = subtreeRange(flat, index);
      blocked = new Set(flat.slice(start, end).map((n) => n.item.id));
      for (let i = start; i < end; i += 1) height = Math.max(height, flat[i].depth - flat[start].depth);
    }
  }
  return flat.filter((n) => !blocked.has(n.item.id) && n.depth + 1 + height <= MAX_DEPTH - 1);
}

function CollectionForm({
  collection,
  flat,
  onDone,
  onCancel,
}: {
  collection?: CollectionSummary;
  flat: FlatNode<CollectionSummary>[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [parentId, setParentId] = useState(collection?.parentId ?? "");
  const [imageUrl, setImageUrl] = useState(collection?.imageUrl ?? "");
  // Header menu / hidden (components/CollectionVisibilityFields).
  const [flags, setFlags] = useState(() => catalogCollectionFlags(collection));
  // Search engines and sharing (SPEC §8.9), same keys as a product's.
  const [seo, setSeo] = useState(() => collectionSeoOf(collection));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const choices = useMemo(() => parentChoices(flat, collection?.id ?? null), [flat, collection?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: CreateCollectionPayload = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl || null,
      ...{ showInHeader: flags.showInHeader && !flags.hidden, hidden: flags.hidden },
      seo: collectionSeoPayload(collection, seo),
    };
    // Sent only when it changed, so an edit never moves a collection by accident.
    if (!collection || (collection.parentId ?? "") !== parentId) payload.parentId = parentId || null;
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
      if (Object.keys(fields).length === 0 || fields.parentId) setFormError(errorMessage(err));
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
      <Field label={t.parent} hint={t.parentHint} error={fieldErrors.parentId}>
        {({ id }) => (
          <Select id={id} value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-11">
            <option value="">{t.topLevel}</option>
            {choices.map((n) => (
              <option key={n.item.id} value={n.item.id}>
                {`${"— ".repeat(n.depth)}${n.item.name}`}
              </option>
            ))}
          </Select>
        )}
      </Field>
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
      <ImageField label={t.image} value={imageUrl} onChange={setImageUrl} />
      <CollectionVisibilityFields value={flags} onChange={setFlags} disabled={saving} />
      <CollectionSeoFields value={seo} onChange={setSeo} placeholderTitle={name || t.namePlaceholder} disabled={saving} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="min-h-11">
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0} className="min-h-11">
          {saving ? t.saving : collection ? t.save : t.create}
        </Button>
      </div>
    </form>
  );
}

/** One row of the tree: drag handle, picture, name, and the moves beside it. */
function CollectionRow({
  node,
  depth,
  flat,
  index,
  busy,
  onMove,
  onOrderProducts,
  onEdit,
  onDelete,
}: {
  node: FlatNode<CollectionSummary>;
  depth: number;
  flat: FlatNode<CollectionSummary>[];
  index: number;
  busy: boolean;
  onMove: (next: FlatNode<CollectionSummary>[]) => void;
  onOrderProducts: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(STRINGS);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: node.item.id,
  });
  const c = node.item;
  const label = (key: keyof Strings) => fmt(t[key], { name: c.name });
  const count = productCount(t, c.productCount);
  const children = flat.filter((n) => n.item.parentId === c.id).length;
  const rowFlags = catalogCollectionFlags(c);
  const { currentWorkspace } = useWorkspace();
  const previewHref = currentWorkspace?.slug ? `${storeUrl(currentWorkspace.slug)}/products?collection=${encodeURIComponent(c.slug)}` : null;

  return (
    <li
      ref={setNodeRef}
      // Rows only slide up and down; the sideways pull is read, not drawn.
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null), transition }}
      className={cn("list-none", isDragging && "relative z-10")}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-1 gap-y-1 rounded-[0.5rem] border bg-paper-raised py-1.5 pe-1.5",
          isDragging ? "border-primary shadow-lg" : "border-line"
        )}
        style={{ marginInlineStart: depth * INDENT }}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={label("reorder")}
          className={cn(iconButton, "cursor-grab active:cursor-grabbing")}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {c.imageUrl ? (
          <img src={c.imageUrl} alt="" className="size-10 shrink-0 rounded-[0.375rem] border border-line object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.375rem] bg-paper text-ink-soft" aria-hidden>
            <Folder className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate font-medium text-ink">{c.name}</p>
          <p className="truncate text-xs text-ink-soft">
            <bdi dir="ltr">{c.slug}</bdi>
            {count && <> · {count}</>}
            {children > 0 && <> · {children === 1 ? t.subcategory : fmt(t.subcategories, { n: children })}</>}
          </p>
          {(rowFlags.showInHeader || rowFlags.hidden) && (
            <p className="mt-0.5 flex flex-wrap gap-1">
              {rowFlags.showInHeader && <span className="rounded-full bg-primary-soft px-2 text-xs text-primary">{t.inHeader}</span>}
              {rowFlags.hidden && <span className="rounded-full bg-paper px-2 text-xs text-ink-soft">{t.hiddenBadge}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center">
          <button type="button" className={iconButton} aria-label={label("moveUp")} title={label("moveUp")}
            disabled={busy || !canMoveUp(flat, index)} onClick={() => onMove(moveAmongSiblings(flat, index, -1))}>
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button type="button" className={iconButton} aria-label={label("moveDown")} title={label("moveDown")}
            disabled={busy || !canMoveDown(flat, index)} onClick={() => onMove(moveAmongSiblings(flat, index, 1))}>
            <ArrowDown className="size-4" aria-hidden />
          </button>
          <button type="button" className={iconButton} aria-label={label("indent")} title={label("indent")}
            disabled={busy || !canIndent(flat, index)} onClick={() => onMove(indent(flat, index))}>
            <IndentIncrease className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" className={iconButton} aria-label={label("outdent")} title={label("outdent")}
            disabled={busy || !canOutdent(flat, index)} onClick={() => onMove(outdent(flat, index))}>
            <IndentDecrease className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" className={iconButton} aria-label={label("orderProducts")} title={label("orderProducts")}
            onClick={onOrderProducts}>
            <ListOrdered className="size-4" aria-hidden />
          </button>
          {previewHref && (
            <a href={previewHref} target="_blank" rel="noreferrer" className={iconButton} aria-label={label("preview")} title={label("preview")}>
              <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
          <button type="button" className={iconButton} aria-label={label("edit")} title={label("edit")} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button type="button" className={cn(iconButton, "hover:bg-danger-soft hover:text-danger")}
            aria-label={label("delete")} title={label("delete")} onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/** One product in the ordering dialog. */
function ProductOrderRow({
  product,
  index,
  total,
  onMove,
}: {
  product: CollectionDetail["products"][number];
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });
  const label = (key: keyof Strings) => fmt(t[key], { name: product.name });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null), transition }}
      className={cn(
        "flex items-center gap-1 rounded-[0.5rem] border bg-paper-raised py-1 pe-1",
        isDragging ? "relative z-10 border-primary shadow-lg" : "border-line"
      )}
    >
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={label("reorderProduct")}
        className={cn(iconButton, "cursor-grab active:cursor-grabbing")}>
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="w-6 shrink-0 text-center text-xs tabular-nums text-ink-soft">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <Link to={`/catalog/${product.id}`} className="block truncate text-sm font-medium text-ink hover:text-primary">
          {product.name}
        </Link>
        <p className="text-xs text-ink-soft">{labels.status(product.status)}</p>
      </div>
      <button type="button" className={iconButton} aria-label={label("moveProductUp")} disabled={index === 0}
        onClick={() => onMove(index, index - 1)}>
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} aria-label={label("moveProductDown")} disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}>
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function ProductOrderDialog({ collection, onClose }: { collection: CollectionSummary; onClose: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const detail = useAsync(() => apiClient.getCollection(workspaceId, collection.id), [workspaceId, collection.id]);
  const [order, setOrder] = useState<CollectionDetail["products"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const products = order ?? detail.data?.products ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= products.length) return;
    const next = [...products];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setOrder(next);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(
      products.findIndex((p) => p.id === active.id),
      products.findIndex((p) => p.id === over.id)
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.reorderCollectionProducts(
        workspaceId,
        collection.id,
        products.map((p) => p.id)
      );
      toast.success(t.orderSaved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.orderTitle, { name: collection.name })}
      description={t.orderDescription}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving} className="min-h-11">
            {t.cancel}
          </Button>
          <Button onClick={save} disabled={saving || order === null || products.length === 0} className="min-h-11">
            {saving ? t.saving : t.saveOrder}
          </Button>
        </>
      }
    >
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
      {detail.loading ? (
        <Spinner className="size-5" />
      ) : detail.error ? (
        <Alert variant="danger">{errorMessage(detail.error)}</Alert>
      ) : products.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.noProducts}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ol className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {products.map((product, index) => (
                <ProductOrderRow key={product.id} product={product} index={index} total={products.length} onMove={move} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </Modal>
  );
}

export function CollectionsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  const [flat, setFlat] = useState<FlatNode<CollectionSummary>[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollectionSummary | null>(null);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const [ordering, setOrdering] = useState<CollectionSummary | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  // The server's tree is the truth; a move is shown at once and put back if the save fails.
  const [shown, setShown] = useState<typeof list.data>(null);
  if (list.data && list.data !== shown) {
    setShown(list.data);
    setFlat(flattenTree(list.data));
  }

  const reload = () => list.refresh({ silent: true });
  const rtl = locale === "ar";

  async function commit(next: FlatNode<CollectionSummary>[]) {
    const items = reorderItems(next);
    if (items.length === 0) return;
    const previous = flat;
    setFlat(next);
    setSaving(true);
    setError(null);
    try {
      await apiClient.reorderCollections(workspaceId, items);
      toast.success(t.orderSaved);
      await reload();
    } catch (err) {
      setFlat(previous);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // While a collection is dragged, what is inside it travels with it and is hidden.
  const visible = useMemo(() => {
    if (!activeId) return flat;
    const index = flat.findIndex((n) => n.item.id === activeId);
    if (index < 0) return flat;
    const [start, end] = subtreeRange(flat, index);
    return [...flat.slice(0, start + 1), ...flat.slice(end)];
  }, [flat, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const nameOf = (id: unknown) => flat.find((n) => n.item.id === id)?.item.name ?? "";

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setOffsetX(0);
  }

  function onDragMove({ delta }: DragMoveEvent) {
    setOffsetX(delta.x);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const from = flat.findIndex((n) => n.item.id === active.id);
    const to = over ? flat.findIndex((n) => n.item.id === over.id) : from;
    const depth = from >= 0 ? projectedDepth(flat, from, offsetX, INDENT, rtl) : 0;
    setActiveId(null);
    setOffsetX(0);
    if (from < 0 || to < 0) return;
    void commit(moveSubtree(flat, from, to, depth));
  }

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

  const activeDepth = (node: FlatNode<CollectionSummary>, index: number) => {
    if (node.item.id !== activeId) return node.depth;
    // Shows where the sideways pull would put it, within what is allowed.
    const moved = moveSubtree(flat, index, index, projectedDepth(flat, index, offsetX, INDENT, rtl));
    return moved.find((n) => n.item.id === activeId)?.depth ?? node.depth;
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        back={{ to: "/catalog", label: t.products }}
        description={t.description}
        actions={
          <>
            <Button variant="outline" className="min-h-11" disabled={flat.length === 0} onClick={() => downloadCollectionsCsv(flat)}>
              <Download className="size-4" aria-hidden />
              {t.exportCsv}
            </Button>
            <Button onClick={() => setCreating(true)} className="min-h-11">
              {t.newCollection}
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <DataState
        skeleton={<ListSkeleton />}
        loading={list.loading}
        error={list.error}
        empty={flat.length === 0}
        emptyMessage={t.empty}
        onRetry={() => list.refresh()}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOffsetX(0);
          }}
          accessibility={{
            screenReaderInstructions: { draggable: t.instructions },
            announcements: {
              onDragStart: ({ active }) => fmt(t.dragStart, { name: nameOf(active.id) }),
              onDragOver: ({ active, over }) => (over ? fmt(t.dragOver, { name: nameOf(active.id), over: nameOf(over.id) }) : undefined),
              onDragEnd: ({ active }) => fmt(t.dragEnd, { name: nameOf(active.id) }),
              onDragCancel: () => t.dragCancel,
            },
          }}
        >
          <SortableContext items={visible.map((n) => n.item.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5" aria-busy={saving}>
              {visible.map((node) => {
                const index = flat.findIndex((n) => n.item.id === node.item.id);
                return (
                  <CollectionRow
                    key={node.item.id}
                    node={node}
                    depth={activeDepth(node, index)}
                    flat={flat}
                    index={index}
                    busy={saving}
                    onMove={(next) => void commit(next)}
                    onOrderProducts={() => setOrdering(node.item)}
                    onEdit={() => setEditing(node.item)}
                    onDelete={() => setDeleting(node.item)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.newCollection}>
        <CollectionForm
          flat={flat}
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
            flat={flat}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>

      {ordering && <ProductOrderDialog collection={ordering} onClose={() => setOrdering(null)} />}

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
