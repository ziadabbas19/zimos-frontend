import { useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronDown, ChevronUp, Star, Trash2, Upload } from "lucide-react";
import { Alert, Button, Card, CardContent, Spinner, cn } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { useToast } from "@/components/Toast";
import { ProductImage } from "@/components/ProductImage";

const STRINGS = {
  en: {
    title: "Images",
    discard: "Discard",
    saving: "Saving…",
    save: "Save images",
    savedToast: "Images saved.",
    help:
      "PNG, JPEG, GIF or WEBP. Anything over 5\u00a0MB is resized automatically before upload. The first image is the primary one shown in the catalog and storefront.",
    drop: "Drop images here or click to choose",
    multiple: "Multiple files supported",
    preparingOne: "Preparing 1 image…",
    preparingMany: "Preparing {n} images…",
    uploadingOne: "Uploading 1 image…",
    uploadingMany: "Uploading {n} images…",
    imageAlt: "Image {n}",
    primary: "Primary",
    moveEarlier: "Move image earlier",
    moveLater: "Move image later",
    remove: "Remove image",
    empty: "No images yet.",
  },
  ar: {
    title: "الصور",
    discard: "تجاهل",
    saving: "جارٍ الحفظ…",
    save: "حفظ الصور",
    savedToast: "تم حفظ الصور.",
    help:
      "PNG أو JPEG أو GIF أو WEBP. أي صورة أكبر من 5\u00a0ميجابايت يتم تصغيرها تلقائيًا قبل الرفع. الصورة الأولى هي الصورة الرئيسية في الكتالوج والمتجر.",
    drop: "اسحب الصور هنا أو اضغط للاختيار",
    multiple: "يمكن رفع أكثر من ملف",
    preparingOne: "جارٍ تجهيز صورة واحدة…",
    preparingMany: "جارٍ تجهيز {n} صور…",
    uploadingOne: "جارٍ رفع صورة واحدة…",
    uploadingMany: "جارٍ رفع {n} صور…",
    imageAlt: "صورة {n}",
    primary: "رئيسية",
    moveEarlier: "نقل الصورة للأمام",
    moveLater: "نقل الصورة للخلف",
    remove: "إزالة الصورة",
    empty: "لا توجد صور بعد.",
  },
} satisfies Messages;

/**
 * Two modes:
 *  - "edit": self-contained — keeps its own draft, has Save/Discard, PATCHes the product.
 *  - "create": fully controlled by the parent (the New Product form). It just uploads
 *    files and reports the media array up via onChange; the parent sends it in the
 *    single create payload. `error` shows the parent's "image required" message.
 */
type Props =
  | {
      mode: "edit";
      productId: string;
      media: ProductMedia[];
      onChanged: () => void;
      error?: undefined;
      onUploadingChange?: undefined;
    }
  | {
      mode: "create";
      value: ProductMedia[];
      onChange: (media: ProductMedia[]) => void;
      error?: string;
      onUploadingChange?: (count: number) => void;
    };

export function ProductImagesSection(props: Props) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  // Edit mode keeps a local draft synced from the saved prop; create mode is
  // fully controlled, so `items` is read straight from props.value.
  const savedMedia = props.mode === "edit" ? props.media : [];
  const [editItems, setEditItems] = useState<ProductMedia[]>(savedMedia);
  const savedJson = props.mode === "edit" ? JSON.stringify(savedMedia) : "";
  useEffect(() => {
    if (props.mode === "edit") setEditItems(savedMedia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson]);

  const [uploading, setUploading] = useState(0);
  const [preparing, setPreparing] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const items = props.mode === "create" ? props.value : editItems;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Let the parent (create flow) disable "Create product" while uploads run.
  useEffect(() => {
    if (props.mode === "create") props.onUploadingChange?.(uploading + preparing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, preparing]);

  function commit(next: ProductMedia[]) {
    if (props.mode === "create") props.onChange(next);
    else setEditItems(next);
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Shrink anything over the 5 MB cap before it reaches validateImageFile, so
    // a large camera photo uploads instead of being rejected outright. Done one
    // at a time to keep several full-size bitmaps out of memory at once.
    setPreparing(files.length);
    const prepared: File[] = [];
    try {
      for (const file of files) {
        prepared.push(await compressImageIfNeeded(file));
        setPreparing((n) => n - 1);
      }
    } finally {
      setPreparing(0);
    }

    const nextErrors: string[] = [];
    const valid: File[] = [];
    for (const file of prepared) {
      const err = validateImageFile(file);
      if (err) nextErrors.push(err);
      else valid.push(file);
    }
    setErrors(nextErrors);
    if (valid.length === 0) return;

    setUploading((n) => n + valid.length);
    const settled = await Promise.all(
      valid.map(async (file) => {
        try {
          const uploaded = await apiClient.uploadMedia(workspaceId, file);
          setUploading((n) => n - 1);
          return { ok: true as const, uploaded };
        } catch (err) {
          setUploading((n) => n - 1);
          return { ok: false as const, msg: `${file.name}: ${errorMessage(err)}` };
        }
      })
    );
    const uploaded = settled.flatMap((s) => (s.ok ? [s.uploaded] : []));
    const failed = settled.flatMap((s) => (s.ok ? [] : [s.msg]));
    if (failed.length) setErrors((prev) => [...prev, ...failed]);
    // Single race-free commit off the freshest items.
    if (uploaded.length) commit([...itemsRef.current, ...uploaded]);
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function remove(index: number) {
    commit(items.filter((_, i) => i !== index));
  }

  const dirty = props.mode === "edit" && JSON.stringify(editItems) !== savedJson;

  async function save() {
    if (props.mode !== "edit") return;
    setSaving(true);
    try {
      await apiClient.updateProduct(workspaceId, props.productId, { media: editItems });
      toast.success(t.savedToast);
      props.onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-ink">
            {t.title}{props.mode === "create" && <span className="text-danger"> *</span>}
          </h2>
          {dirty && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditItems(savedMedia)} disabled={saving}>
                {t.discard}
              </Button>
              <Button size="sm" onClick={save} disabled={saving || uploading > 0 || preparing > 0}>
                {saving ? t.saving : t.save}
              </Button>
            </div>
          )}
        </div>
        <p className="mb-4 text-sm text-ink-soft">{t.help}</p>

        {props.mode === "create" && props.error && (
          <Alert variant="danger" className="mb-4">
            {props.error}
          </Alert>
        )}

        {errors.length > 0 && (
          <Alert variant="danger" className="mb-4">
            <ul className="list-disc space-y-0.5 ps-4">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[0.5rem] border-2 border-dashed px-4 py-8 text-center text-sm transition-colors",
            dragOver ? "border-primary bg-primary-soft" : "border-line hover:border-primary/60"
          )}
        >
          <Upload className="size-5 text-ink-soft" aria-hidden />
          <span className="font-medium text-ink">{t.drop}</span>
          <span className="text-xs text-ink-soft">{t.multiple}</span>
          <input
            type="file"
            accept={ACCEPTED_IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {preparing > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <Spinner className="size-4" />{" "}
            {preparing === 1 ? t.preparingOne : fmt(t.preparingMany, { n: preparing })}
          </p>
        )}

        {uploading > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <Spinner className="size-4" />{" "}
            {uploading === 1 ? t.uploadingOne : fmt(t.uploadingMany, { n: uploading })}
          </p>
        )}

        {items.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((m, i) => (
              <li
                key={m.path || m.url}
                className="group relative overflow-hidden rounded-[0.5rem] border border-line"
              >
                <ProductImage media={m} alt={fmt(t.imageAlt, { n: i + 1 })} className="aspect-square w-full" />
                {i === 0 && (
                  <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">
                    <Star className="size-3" aria-hidden /> {t.primary}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={t.moveEarlier}
                      className="cursor-pointer rounded p-1 text-white hover:bg-white/20 disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label={t.moveLater}
                      className="cursor-pointer rounded p-1 text-white hover:bg-white/20 disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" aria-hidden />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={t.remove}
                    className="cursor-pointer rounded p-1 text-white hover:bg-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          uploading === 0 &&
          preparing === 0 && <p className="mt-4 text-sm text-ink-soft">{t.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
