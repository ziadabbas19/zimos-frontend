import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ApiError,
  shoppableImagesCreate,
  shoppableImagesUpdate,
  type ShoppableHotspot,
  type ShoppableImage,
} from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { IconClose, IconImageAdd, IconSpinner, IconUpload } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

const STRINGS = {
  en: {
    createTitle: "New shoppable image",
    editTitle: "Edit shoppable image",
    description: "Tap the picture where a product is, then choose the product.",
    name: "Title",
    nameHint: "Shown over the picture on its page in your store.",
    nameRequired: "Write a title for the picture.",
    image: "Picture",
    upload: "Upload a picture",
    change: "Change the picture",
    uploading: "Uploading…",
    imageUrl: "Picture link",
    imageUrlHint: "Or paste the link of a picture that is already online.",
    imageRequired: "Upload a picture, or paste its link.",
    imageBadLink: "The link must start with https:// (or http://).",
    noImage: "Add a picture first, then mark the products on it.",
    canvasLabel: "The picture: tap where a product is to add a point",
    pointsTitle: "Products on the picture",
    pointsEmpty: "No points yet. Tap the picture where a product is.",
    pointsCount: "{n} of {max} points",
    point: "Point {n}",
    pointProduct: "Product of point {n}",
    goToPoint: "Point {n}: choose its product",
    chooseProduct: "Choose a product",
    unknownProduct: "A product that isn't in your store anymore",
    removePoint: "Remove point {n}",
    maxPoints: "A picture holds up to {max} points. Remove one to add another.",
    needProduct: "Choose a product for this point, or remove the point.",
    productsFailed: "We couldn't load your products.",
    retry: "Try again",
    shown: "Shown in the store",
    shownHint: "Off: its public page and any page block that uses it stop showing.",
    saved: "Shoppable image saved.",
    productMissing: "A point is linked to a product that no longer exists. Choose another product for it.",
  },
  ar: {
    createTitle: "صورة تفاعلية جديدة",
    editTitle: "تعديل الصورة التفاعلية",
    description: "اضغط على مكان المنتج في الصورة ثم اختر المنتج.",
    name: "العنوان",
    nameHint: "يظهر فوق الصورة في صفحتها في متجرك.",
    nameRequired: "اكتب عنوانًا للصورة.",
    image: "الصورة",
    upload: "رفع صورة",
    change: "تغيير الصورة",
    uploading: "جارٍ الرفع…",
    imageUrl: "رابط الصورة",
    imageUrlHint: "أو الصق رابط صورة موجودة على الإنترنت.",
    imageRequired: "ارفع صورة، أو الصق رابطها.",
    imageBadLink: "يجب أن يبدأ الرابط بـ https:// (أو http://).",
    noImage: "أضف صورة أولًا، ثم حدّد المنتجات عليها.",
    canvasLabel: "الصورة: اضغط على مكان المنتج لإضافة نقطة",
    pointsTitle: "المنتجات الموجودة على الصورة",
    pointsEmpty: "لا توجد نقاط بعد. اضغط على مكان المنتج في الصورة.",
    pointsCount: "{n} من {max} نقطة",
    point: "نقطة {n}",
    pointProduct: "منتج النقطة {n}",
    goToPoint: "النقطة {n}: اختر منتجها",
    chooseProduct: "اختر منتجًا",
    unknownProduct: "منتج لم يعد في متجرك",
    removePoint: "حذف النقطة {n}",
    maxPoints: "الصورة تحمل {max} نقطة كحد أقصى. احذف نقطة لتضيف غيرها.",
    needProduct: "اختر منتجًا لهذه النقطة، أو احذف النقطة.",
    productsFailed: "تعذّر تحميل منتجاتك.",
    retry: "إعادة المحاولة",
    shown: "ظاهرة في المتجر",
    shownHint: "إذا كانت مغلقة: لا تظهر صفحتها العامة ولا أي عنصر يستخدمها في الصفحات.",
    saved: "تم حفظ الصورة التفاعلية.",
    productMissing: "توجد نقطة مربوطة بمنتج لم يعد موجودًا. اختر لها منتجًا آخر.",
  },
} satisfies Messages;

export const MAX_POINTS = 20;
const FORM_ID = "shoppable-image-form";

interface DraftPoint {
  x: number;
  y: number;
  productId: string;
}

const pointFieldId = (index: number) => `shoppable-point-${index}`;

/**
 * Create or edit one shoppable image, in a sheet over the gallery: its title,
 * the picture (uploaded or by link), the points — a tap on the picture adds
 * one, and each gets its product from the list under it — and whether it shows
 * in the store. Mistakes are said under the field they belong to, and the
 * first one is brought into view. Closing with something typed asks first
 * (components/Modal.tsx).
 */
export function LookEditor({
  image,
  open,
  onClose,
  onSaved,
}: {
  /** The image being edited, or "new". It stays here while the sheet closes. */
  image: ShoppableImage | "new" | null;
  open: boolean;
  onClose: () => void;
  onSaved: (saved: ShoppableImage) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = image && image !== "new" ? image : null;

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; image?: string }>({});
  // After a save attempt, every point without a product says so.
  const [reveal, setReveal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const urlField = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  /**
   * A point added or removed, a picture uploaded: none of them is typing, so the sheet would not know
   * there is something to lose. An `input` event from the form tells it, the way a keystroke does.
   */
  function markEdited() {
    form.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // The products to choose from: asked for once the sheet is first opened, then kept for the session.
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  const products = useCachedAsync(
    wanted ? `shoppable-products:${workspaceId}` : null,
    async () => (wanted ? (await apiClient.listProducts(workspaceId, { limit: 200 })).products : []),
    [workspaceId, wanted]
  );
  const options = products.data ?? [];

  const existingId = existing?.id;
  // Every opening starts from the image as it is saved (or from an empty form).
  useEffect(() => {
    if (!open) return;
    setTitle(existing?.title ?? "");
    setImageUrl(existing?.imageUrl ?? "");
    setPoints(existing?.hotspots ?? []);
    setIsActive(existing?.isActive ?? true);
    setBusy(false);
    setUploading(false);
    setErrors({});
    setReveal(false);
    setNotice(null);
    setFormError(null);
    // `existing` is read when the sheet opens for this image, not followed while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErrors((prev) => ({ ...prev, image: undefined }));
    try {
      const media = await apiClient.uploadMedia(workspaceId, file);
      setImageUrl(media.url);
      markEdited();
    } catch (err) {
      setErrors((prev) => ({ ...prev, image: errorMessage(err) }));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addPoint(event: MouseEvent<HTMLDivElement>) {
    if (busy) return;
    if (points.length >= MAX_POINTS) {
      setNotice(fmt(t.maxPoints, { max: MAX_POINTS }));
      return;
    }
    // The picture is laid out left-to-right in every language, so x is measured from its left edge.
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100));
    const index = points.length;
    setPoints((prev) => [...prev, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, productId: "" }]);
    markEdited();
    // With a mouse the new point's product list takes the focus; under a finger that would open the picker over the picture.
    if (window.matchMedia?.("(pointer: fine)").matches) window.requestAnimationFrame(() => focusPoint(index));
  }

  function focusPoint(index: number) {
    const field = document.getElementById(pointFieldId(index));
    field?.scrollIntoView({ block: "nearest" });
    field?.focus({ preventScroll: true });
  }

  function removePoint(index: number) {
    setPoints((prev) => prev.filter((_, i) => i !== index));
    setNotice(null);
    markEdited();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    const found: { title?: string; image?: string } = {};
    const link = imageUrl.trim();
    if (!title.trim()) found.title = t.nameRequired;
    if (!link) found.image = t.imageRequired;
    else if (!/^https?:\/\//i.test(link)) found.image = t.imageBadLink;
    const missing = points.findIndex((p) => !p.productId);
    setErrors(found);
    setReveal(true);
    if (found.title || found.image || missing >= 0) {
      // The first field that needs fixing, on screen and under the cursor.
      if (found.title || found.image) {
        const first = found.title ? titleField.current : urlField.current;
        first?.scrollIntoView({ block: "center" });
        first?.focus({ preventScroll: true });
      } else {
        focusPoint(missing);
      }
      return;
    }
    setBusy(true);
    setFormError(null);
    const hotspots: ShoppableHotspot[] = points.map((p) => ({ x: p.x, y: p.y, productId: p.productId }));
    try {
      const saved = existing
        ? await shoppableImagesUpdate(apiClient, workspaceId, existing.id, { title: title.trim(), imageUrl: link, hotspots, isActive })
        : await shoppableImagesCreate(apiClient, workspaceId, { title: title.trim(), imageUrl: link, hotspots, isActive });
      toast.success(t.saved);
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof ApiError && err.code === "PRODUCT_NOT_FOUND" ? t.productMissing : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const hasPicture = imageUrl.trim() !== "";

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={existing ? t.editTitle : t.createTitle}
      description={t.description}
      className="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full px-5" disabled={busy || uploading}>
            {busy ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <form ref={form} id={FORM_ID} noValidate className="space-y-4" onSubmit={(event) => void submit(event)}>
        {formError && <Alert variant="danger">{formError}</Alert>}

        <Field label={t.name} required hint={t.nameHint} error={errors.title}>
          {({ id, ...aria }) => (
            <Input
              ref={titleField}
              id={id}
              {...aria}
              dir="auto"
              maxLength={200}
              value={title}
              disabled={busy}
              onChange={(event) => {
                setTitle(event.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
            />
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
          <div className="min-w-0 space-y-3">
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
            {hasPicture ? (
              // A plain press target, not a button: the points drawn on it are buttons of their own.
              <div
                dir="ltr"
                role="group"
                aria-label={t.canvasLabel}
                onClick={addPoint}
                data-slot="look-canvas"
                className="zimos-look-canvas relative cursor-crosshair overflow-hidden rounded-[1.25rem] bg-paper-sunken ring-1 ring-line"
              >
                <img src={imageUrl} alt="" className="block h-auto w-full select-none" draggable={false} />
                {points.map((point, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={fmt(t.goToPoint, { n: index + 1 })}
                    data-missing={reveal && !point.productId ? "" : undefined}
                    onClick={(event) => {
                      // A press on a point is about that point: it must not add another under it.
                      event.stopPropagation();
                      focusPoint(index);
                    }}
                    className="zimos-look-point absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground tabular-nums shadow-[0_2px_8px_rgb(0_0_0/0.45)] transition-[scale] duration-[var(--dur-pop)] ease-[var(--ease-pop)] before:absolute before:-inset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[missing]:bg-danger motion-safe:starting:scale-0 motion-reduce:transition-none"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  >
                    {fmt("{n}", { n: index + 1 })}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-line-strong/60 px-4 py-6 text-center">
                <IconImageAdd className="size-10 text-ink-soft" aria-hidden />
                <p className="max-w-xs text-sm leading-6 text-ink-soft">{t.noImage}</p>
              </div>
            )}

            <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 pointer-fine:min-h-10" disabled={busy || uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? (
                <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <IconUpload className="size-4" aria-hidden />
              )}
              {uploading ? t.uploading : hasPicture ? t.change : t.upload}
            </Button>

            <Field label={t.imageUrl} required hint={t.imageUrlHint} error={errors.image}>
              {({ id, ...aria }) => (
                <Input
                  ref={urlField}
                  id={id}
                  {...aria}
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  maxLength={1000}
                  placeholder="https://"
                  value={imageUrl}
                  disabled={busy || uploading}
                  onChange={(event) => {
                    setImageUrl(event.target.value);
                    if (errors.image) setErrors((prev) => ({ ...prev, image: undefined }));
                  }}
                />
              )}
            </Field>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-sm font-medium text-ink">{t.pointsTitle}</h3>
              <p className="text-xs text-ink-soft tabular-nums">{fmt(t.pointsCount, { n: points.length, max: MAX_POINTS })}</p>
            </div>
            {notice && (
              <p role="status" className="rounded-2xl bg-accent-soft px-3.5 py-2.5 text-[13px] leading-5 text-accent-dark">
                {notice}
              </p>
            )}
            {Boolean(products.error) && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs leading-5 text-danger">
                {t.productsFailed}
                <button
                  type="button"
                  onClick={() => void products.refresh()}
                  className="min-h-11 cursor-pointer rounded-full px-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-8"
                >
                  {t.retry}
                </button>
              </p>
            )}
            {points.length === 0 ? (
              <p className="text-sm leading-6 text-ink-soft">{t.pointsEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {points.map((point, index) => {
                  const error = reveal && !point.productId ? t.needProduct : undefined;
                  const known = !point.productId || options.some((product) => product.id === point.productId);
                  return (
                    <li key={index}>
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums"
                        >
                          {fmt("{n}", { n: index + 1 })}
                        </span>
                        <Select
                          id={pointFieldId(index)}
                          aria-label={fmt(t.pointProduct, { n: index + 1 })}
                          aria-invalid={error ? true : undefined}
                          className="min-w-0 flex-1"
                          value={point.productId}
                          disabled={busy}
                          onChange={(event) => setPoints((prev) => prev.map((p, i) => (i === index ? { ...p, productId: event.target.value } : p)))}
                        >
                          <option value="">{t.chooseProduct}</option>
                          {/* The product a point already names, also while the list loads or when it is no longer there. */}
                          {!known && <option value={point.productId}>{products.loading ? "…" : t.unknownProduct}</option>}
                          {options.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </Select>
                        <button
                          type="button"
                          aria-label={fmt(t.removePoint, { n: index + 1 })}
                          title={fmt(t.removePoint, { n: index + 1 })}
                          disabled={busy}
                          onClick={() => removePoint(index)}
                          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.97] motion-reduce:transition-none"
                        >
                          <IconClose className="size-4" aria-hidden />
                        </button>
                      </div>
                      {error && <p className="mt-1 ps-9 text-xs font-medium text-danger">{error}</p>}
                    </li>
                  );
                })}
              </ul>
            )}

            <div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  role="switch"
                  className="size-5 shrink-0 cursor-pointer accent-primary"
                  checked={isActive}
                  disabled={busy}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                {t.shown}
              </label>
              <p className="text-xs leading-5 text-ink-soft">{t.shownHint}</p>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
