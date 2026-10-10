import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import { catalogCreateManualReview, type Review } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { IconPlus, IconStar } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ImageUrlInput } from "../catalog/components/ImageUrlInput";
import { MAX_RATING, REVIEW_WORDS } from "./reviewModel";

/**
 * Adding a review by hand: a real review that reached the
 * merchant on WhatsApp, in comments or in person. It goes live at once and
 * never carries the "verified buyer" badge.
 */

const MAX_PHOTOS = 6;
const FORM_ID = "add-review-form";

const STRINGS = {
  en: {
    title: "Add a review",
    description: "For a real review you got somewhere else — WhatsApp, comments, a call. It shows without the “verified buyer” badge.",
    product: "Product",
    chooseProduct: "Choose a product",
    productRequired: "Choose the product this review is about.",
    productsFailed: "We couldn't load your products.",
    retry: "Try again",
    name: "Customer's name",
    nameHint: "Shown beside the review in your store.",
    nameRequired: "Write the name of the customer who said it.",
    rating: "Rating",
    comment: "What they said",
    commentHint: "Optional. Their own words, as they wrote them.",
    photos: "Photos",
    photosHint: "Optional. Up to {n} photos.",
    addPhoto: "Add a photo",
    publish: "Show it in the store now",
    publishHint: "Off: it waits with the reviews to approve.",
    cancel: "Cancel",
    add: "Add review",
    adding: "Adding…",
    added: "Review added.",
  },
  ar: {
    title: "إضافة تقييم",
    description: "لتقييم حقيقي وصلك من مكان آخر — واتساب، تعليقات، مكالمة. يظهر بدون علامة «مشترٍ موثّق».",
    product: "المنتج",
    chooseProduct: "اختر منتجًا",
    productRequired: "اختر المنتج الذي يخصه هذا التقييم.",
    productsFailed: "تعذّر تحميل منتجاتك.",
    retry: "إعادة المحاولة",
    name: "اسم العميل",
    nameHint: "يظهر بجانب التقييم في متجرك.",
    nameRequired: "اكتب اسم العميل صاحب هذا الكلام.",
    rating: "التقييم",
    comment: "ماذا قال",
    commentHint: "اختياري. كلامه كما كتبه.",
    photos: "الصور",
    photosHint: "اختياري. حتى {n} صور.",
    addPhoto: "إضافة صورة",
    publish: "إظهاره في المتجر الآن",
    publishHint: "إذا كان مغلقًا: ينتظر مع التقييمات التي تنتظر موافقتك.",
    cancel: "إلغاء",
    add: "إضافة التقييم",
    adding: "جارٍ الإضافة…",
    added: "تمت إضافة التقييم.",
  },
} satisfies Messages;

export function AddReviewDialog({
  open,
  productId: fixedProductId,
  onClose,
  onAdded,
}: {
  open: boolean;
  /** Set when opened from a product: the picker is skipped. */
  productId?: string;
  onClose: () => void;
  onAdded: (review: Review) => void;
}) {
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Asked for once the sheet is first opened, not with the page.
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  const products = useAsync(
    () =>
      fixedProductId || !wanted
        ? Promise.resolve(null)
        : apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }),
    [workspaceId, fixedProductId, wanted]
  );

  const [productId, setProductId] = useState(fixedProductId ?? "");
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(MAX_RATING);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ product?: string; name?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const productField = useRef<HTMLSelectElement>(null);
  const nameField = useRef<HTMLInputElement>(null);

  // Every opening starts from an empty form.
  useEffect(() => {
    if (!open) return;
    setProductId(fixedProductId ?? "");
    setAuthorName("");
    setRating(MAX_RATING);
    setComment("");
    setPhotos([]);
    setPublish(true);
    setBusy(false);
    setErrors({});
    setFormError(null);
  }, [open, fixedProductId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: { product?: string; name?: string } = {};
    if (!productId) found.product = t.productRequired;
    if (!authorName.trim()) found.name = t.nameRequired;
    setErrors(found);
    if (found.product || found.name) {
      // The first field that needs fixing, on screen and under the cursor.
      const first = found.product ? productField.current : nameField.current;
      first?.scrollIntoView({ block: "center" });
      first?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const review = await catalogCreateManualReview<Review>(apiClient, workspaceId, {
        productId,
        authorName: authorName.trim(),
        rating,
        comment: comment.trim() || null,
        photos: photos.filter(Boolean),
        status: publish ? "approved" : "pending",
      });
      toast.success(t.added);
      onAdded(review);
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full px-5" disabled={busy}>
            {busy ? t.adding : t.add}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate className="space-y-4" onSubmit={(event) => void submit(event)}>
        {formError && <Alert variant="danger">{formError}</Alert>}

        {!fixedProductId && (
          <Field label={t.product} required error={errors.product}>
            {({ id, ...aria }) => (
              <>
                <Select
                  ref={productField}
                  id={id}
                  {...aria}
                  value={productId}
                  disabled={busy || products.loading}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    if (errors.product) setErrors((prev) => ({ ...prev, product: undefined }));
                  }}
                >
                  <option value="">{t.chooseProduct}</option>
                  {(products.data?.products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
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
              </>
            )}
          </Field>
        )}

        <Field label={t.name} required hint={t.nameHint} error={errors.name}>
          {({ id, ...aria }) => (
            <Input
              ref={nameField}
              id={id}
              {...aria}
              dir="auto"
              maxLength={120}
              autoComplete="off"
              value={authorName}
              disabled={busy}
              onChange={(event) => {
                setAuthorName(event.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
          )}
        </Field>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-ink">{t.rating}</legend>
          {/* A row of five 44px targets; a star is not a direction, so the row is never mirrored. */}
          <div className="-mx-1.5 flex items-center">
            {Array.from({ length: MAX_RATING }, (_, index) => {
              const value = index + 1;
              const lit = value <= rating;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={fmt(words.ratingOf, { n: value, max: MAX_RATING })}
                  aria-pressed={rating === value}
                  disabled={busy}
                  onClick={() => setRating(value)}
                  className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed motion-safe:active:scale-[0.9] motion-reduce:transition-none"
                >
                  <IconStar
                    data-lit={lit ? "" : undefined}
                    className={cn("zimos-review-star size-7", lit ? "text-accent" : "text-line-strong")}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label={t.comment} hint={t.commentHint}>
          {({ id, ...aria }) => (
            <Textarea
              id={id}
              {...aria}
              dir="auto"
              rows={3}
              maxLength={2000}
              value={comment}
              disabled={busy}
              onChange={(event) => setComment(event.target.value)}
            />
          )}
        </Field>

        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-ink">{t.photos}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{fmt(t.photosHint, { n: MAX_PHOTOS })}</p>
          </div>
          {photos.map((url, index) => (
            <ImageUrlInput
              key={index}
              value={url}
              disabled={busy}
              onChange={(next) =>
                setPhotos((current) => (next ? current.map((p, i) => (i === index ? next : p)) : current.filter((_, i) => i !== index)))
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full px-4 pointer-fine:min-h-10"
            disabled={busy || photos.length >= MAX_PHOTOS || photos.some((p) => !p)}
            onClick={() => setPhotos((current) => [...current, ""])}
          >
            <IconPlus className="size-4" aria-hidden />
            {t.addPhoto}
          </Button>
        </div>

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              role="switch"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={publish}
              disabled={busy}
              onChange={(event) => setPublish(event.target.checked)}
            />
            {t.publish}
          </label>
          <p className="text-xs leading-5 text-ink-soft">{t.publishHint}</p>
        </div>
      </form>
    </Modal>
  );
}
