import { useMemo, useState } from "react";
import { Button } from "@store-builder/ui";
import { shoppableImagesDelete, shoppableImagesList, shoppableImagesUpdate, type ShoppableImage } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconDelete, IconEdit, IconExternal, IconEye, IconEyeOff, IconLink, IconPlus, IconSearch, IconShoppableImages } from "@/components/icons";
import { ChipRow, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { LookCard } from "./LookCard";
import { LookEditor } from "./LookEditor";

const STRINGS = {
  en: {
    title: "Shoppable images",
    description: "One picture, several products: put a point on each product and customers tap it to buy.",
    add: "New image",
    emptyTitle: "No shoppable images yet",
    emptyDescription: "Upload a picture of your products in use — a room, an outfit, a table — and mark each product on it.",
    searchLabel: "Search the shoppable images",
    searchPlaceholder: "Search by title",
    chipsLabel: "Shoppable images by visibility",
    tabAll: "All",
    tabShown: "In the store",
    tabHidden: "Hidden",
    noMatch: "No image matches",
    noMatchHint: "Try another word, or look in all of them.",
    showAll: "Show all images",
    edit: "Edit",
    view: "View in store",
    copyLink: "Copy its link",
    copyId: "Copy its ID for the page builder",
    linkCopied: "The link is copied",
    idCopied: "The ID is copied — paste it in the page builder's block",
    hide: "Hide from the store",
    show: "Show in the store",
    toastHidden: "“{title}” is off your store.",
    toastShown: "“{title}” shows in your store.",
    remove: "Delete",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "Its public page stops working, and any page block that uses it disappears.",
    deleting: "Deleting…",
    deleted: "Shoppable image deleted.",
  },
  ar: {
    title: "الصور التفاعلية",
    description: "صورة واحدة وعدة منتجات: ضع نقطة على كل منتج والعميل يضغط عليها ليشتري.",
    add: "صورة جديدة",
    emptyTitle: "لا توجد صور تفاعلية بعد",
    emptyDescription: "ارفع صورة لمنتجاتك وهي مستخدمة — غرفة، طقم ملابس، سفرة — وحدّد كل منتج عليها.",
    searchLabel: "ابحث في الصور التفاعلية",
    searchPlaceholder: "ابحث بالعنوان",
    chipsLabel: "الصور التفاعلية حسب ظهورها",
    tabAll: "الكل",
    tabShown: "ظاهرة في المتجر",
    tabHidden: "مخفية",
    noMatch: "لا توجد صورة مطابقة",
    noMatchHint: "جرّب كلمة أخرى، أو ابحث في كل الصور.",
    showAll: "عرض كل الصور",
    edit: "تعديل",
    view: "عرضها في المتجر",
    copyLink: "نسخ الرابط",
    copyId: "نسخ المعرّف لمحرر الصفحات",
    linkCopied: "تم نسخ الرابط",
    idCopied: "تم نسخ المعرّف — الصقه في العنصر داخل محرر الصفحات",
    hide: "إخفاؤها من المتجر",
    show: "إظهارها في المتجر",
    toastHidden: "أُخفيت «{title}» من متجرك.",
    toastShown: "أصبحت «{title}» ظاهرة في متجرك.",
    remove: "حذف",
    deleteTitle: "حذف «{name}»؟",
    deleteDescription: "تتوقف صفحتها العامة عن العمل، ويختفي أي عنصر في الصفحات يستخدمها.",
    deleting: "جارٍ الحذف…",
    deleted: "تم حذف الصورة التفاعلية.",
  },
} satisfies Messages;

type Visibility = "all" | "shown" | "hidden";

/** From this many images up, a search by title is worth its row. */
const SEARCH_FROM = 8;

/** The gallery while it loads: tiles in the shape of the cards, so nothing jumps when they arrive. */
function GallerySkeleton() {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <li key={index} className="overflow-hidden rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
          <SkeletonBar className="aspect-[4/3] h-auto w-full rounded-none" />
          <div className="space-y-2 px-3.5 py-3">
            <SkeletonBar className="h-3.5 w-3/5" />
            <SkeletonBar className="h-2.5 w-2/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shoppable images: pictures with product points. The gallery
 * shows each picture with its points where they are; a card opens its editor
 * in a sheet, and «…» holds the public link, the ID for the page builder,
 * show / hide (taken at once, undone from the toast) and delete.
 */
export function ShoppableImagesPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const copy = useCopy();
  const phone = useIsPhone();

  const list = useCachedAsync<ShoppableImage[]>(`shoppable:${workspaceId}`, () => shoppableImagesList(apiClient, workspaceId), [workspaceId]);
  const images = useMemo(() => list.data ?? [], [list.data]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Visibility>("all");
  // The image being edited (or "new"), and the one being deleted: each stays here while its sheet closes.
  const [editing, setEditing] = useState<{ image: ShoppableImage | "new"; open: boolean } | null>(null);
  const [removing, setRemoving] = useState<{ image: ShoppableImage; open: boolean } | null>(null);
  const [busy, setBusy] = useState<Record<string, true>>({});

  const hiddenCount = images.filter((image) => !image.isActive).length;
  const query = search.trim().toLowerCase();
  const visible = images.filter((image) => {
    if (tab === "shown" && !image.isActive) return false;
    if (tab === "hidden" && image.isActive) return false;
    return !query || image.title.toLowerCase().includes(query);
  });

  function patchImage(id: string, patch: Partial<ShoppableImage>) {
    list.setData((prev) => (prev ?? []).map((image) => (image.id === id ? { ...image, ...patch } : image)));
  }

  /** The request alone: the card already shows where it is going, and goes back if the server says no. */
  async function setShown(image: ShoppableImage, isActive: boolean) {
    patchImage(image.id, { isActive });
    try {
      const saved = await shoppableImagesUpdate(apiClient, workspaceId, image.id, { isActive });
      patchImage(image.id, saved);
    } catch (err) {
      patchImage(image.id, { isActive: !isActive });
      throw err;
    }
  }

  /** Show or hide, at once. The toast is the way back. */
  function toggleShown(image: ShoppableImage) {
    if (busy[image.id]) return;
    const next = !image.isActive;
    setBusy((prev) => ({ ...prev, [image.id]: true }));
    void setShown(image, next)
      .then(() => toast.undo(fmt(next ? t.toastShown : t.toastHidden, { title: image.title }), () => setShown(image, !next)))
      .catch((err: unknown) => toast.error(errorMessage(err)))
      .finally(() => {
        setBusy((prev) => {
          const rest = { ...prev };
          delete rest[image.id];
          return rest;
        });
      });
  }

  function menuFor(image: ShoppableImage): ContextMenuItem[] {
    const link = `${STOREFRONT_URL}/store/${workspaceId}/looks/${image.slug}`;
    const items: ContextMenuItem[] = [{ id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing({ image, open: true }) }];
    // A hidden image has no public page to open.
    if (image.isActive) {
      items.push({ id: "view", label: t.view, icon: IconExternal, onSelect: () => window.open(link, "_blank", "noopener,noreferrer") });
    }
    items.push(
      { id: "copy-link", label: t.copyLink, icon: IconLink, separatorBefore: true, onSelect: () => copy(link, t.linkCopied) },
      { id: "copy-id", label: t.copyId, icon: IconCopy, onSelect: () => copy(image.id, t.idCopied) },
      {
        id: "toggle",
        label: image.isActive ? t.hide : t.show,
        icon: image.isActive ? IconEyeOff : IconEye,
        separatorBefore: true,
        disabled: Boolean(busy[image.id]),
        onSelect: () => toggleShown(image),
      },
      { id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving({ image, open: true }) }
    );
    return items;
  }

  const chips: ChipItem<Visibility>[] = [
    { value: "all", label: t.tabAll, count: images.length },
    { value: "shown", label: t.tabShown, count: images.length - hiddenCount },
    { value: "hidden", label: t.tabHidden, count: hiddenCount },
  ];

  const addButton = (
    <Button className="min-h-11 rounded-full px-5" onClick={() => setEditing({ image: "new", open: true })}>
      <IconPlus className="size-4" aria-hidden />
      {t.add}
    </Button>
  );

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the pictures: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        primaryAction={addButton}
      />

      <DataState
        loading={list.loading}
        // A refresh that failed behind pictures already on screen leaves them there.
        error={images.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<GallerySkeleton />}
      >
        {images.length === 0 ? (
          <EmptyState
            icon={<IconShoppableImages aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button className="rounded-full px-5" onClick={() => setEditing({ image: "new", open: true })}>
                <IconPlus className="size-4" aria-hidden />
                {t.add}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* A handful of pictures needs no tools over it: the search comes with a long gallery, the chips with a hidden image. */}
            {images.length >= SEARCH_FROM && (
              <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
            )}
            {(hiddenCount > 0 || tab !== "all") && <ChipRow items={chips} value={tab} onChange={setTab} label={t.chipsLabel} collapseEmpty={false} />}

            {visible.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.noMatch}
                description={t.noMatchHint}
                action={
                  <Button
                    variant="outline"
                    className="rounded-full px-5"
                    onClick={() => {
                      setSearch("");
                      setTab("all");
                    }}
                  >
                    {t.showAll}
                  </Button>
                }
              />
            ) : (
              <ul aria-label={t.title} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((image) => (
                  <LookCard key={image.id} image={image} menu={menuFor(image)} busy={Boolean(busy[image.id])} onOpen={() => setEditing({ image, open: true })} />
                ))}
              </ul>
            )}
          </div>
        )}
      </DataState>

      <LookEditor
        image={editing?.image ?? null}
        open={Boolean(editing?.open)}
        onClose={() => setEditing((current) => (current ? { ...current, open: false } : current))}
        onSaved={(saved) => {
          setEditing((current) => (current ? { ...current, open: false } : current));
          // In the gallery at once — a new one first, as the list gives them — and then as the server has it.
          list.setData((prev) => {
            const rows = prev ?? [];
            return rows.some((row) => row.id === saved.id) ? rows.map((row) => (row.id === saved.id ? saved : row)) : [saved, ...rows];
          });
          void list.refresh({ silent: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={removing ? fmt(t.deleteTitle, { name: removing.image.title }) : ""}
        description={t.deleteDescription}
        confirmLabel={common.delete}
        busyLabel={t.deleting}
        cancelLabel={common.cancel}
        destructive
        onCancel={() => setRemoving((current) => (current ? { ...current, open: false } : current))}
        onConfirm={async () => {
          if (!removing) return;
          const id = removing.image.id;
          try {
            await shoppableImagesDelete(apiClient, workspaceId, id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          toast.success(t.deleted);
          list.setData((prev) => (prev ?? []).filter((row) => row.id !== id));
          setRemoving((current) => (current ? { ...current, open: false } : current));
        }}
      />
    </div>
  );
}
