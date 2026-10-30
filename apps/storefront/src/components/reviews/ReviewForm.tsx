"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  ApiError,
  apiErrorCode,
  apiFieldProblems,
  storefrontSendProductReview,
  storefrontSendStoreReview,
  type StorefrontReviewInput,
} from "@store-builder/api-client";
import { compressImageIfNeeded } from "@store-builder/image-tools";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getDeviceId } from "@/lib/botGuard";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { getVisitorId } from "@/lib/visitorId";
import { btnGhost, btnPrimary, btnSecondary, focusRing, input, label as labelClass } from "../ui";
import { REVIEW_COMMENT_MAX, REVIEW_MAX_PHOTOS, REVIEW_NAME_MAX, REVIEW_TEXT, type ReviewText } from "./reviewText";

/**
 * A shopper's review of a product or of the whole store (backend:
 * modules/reviews). The stars are required; a name, words and up to four
 * photos are not. The phone ties the review to the shopper's orders, unless
 * the review came from the store's own request (`?review=<token>`), which
 * names the order. Every review waits for the merchant, so the thank-you says
 * so; every refusal is said in the shopper's words.
 *
 * The form is offered only while the store takes reviews
 * (`store.reviews.open`, useReviewsOpen); the callers check it.
 */

// The product photo field's rules (components/product/CustomFieldInputs): same types, same size, same shrink.
const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const RAW_LIMIT = 15 * 1024 * 1024;
const COMPRESS = { maxBytes: 4 * 1024 * 1024, maxEdgeSteps: [2400, 2000, 1600, 1200], qualitySteps: [0.85, 0.75, 0.65] };

/** Whether shoppers may send reviews now (GET /store/:ws `reviews.open`); false on an older API. */
export function useReviewsOpen(): boolean {
  const { store } = useStore();
  return store?.reviews?.open === true;
}

const noSubscribe = () => () => {};
const TOKEN_SHAPE = /^[A-Za-z0-9._~-]{8,200}$/;

function readReviewToken(): string {
  try {
    const value = new URLSearchParams(window.location.search).get("review")?.trim() ?? "";
    return TOKEN_SHAPE.test(value) ? value : "";
  } catch {
    return "";
  }
}

/**
 * The order link of the store's review request (`…?review=<token>#reviews`),
 * read in the browser only: "" on the server and while hydrating.
 */
export function useReviewLinkToken(): string {
  return useSyncExternalStore(noSubscribe, readReviewToken, () => "");
}

type Photo = { key: string; preview: string; status: "uploading" | "done" | "error"; uploadId?: string; message?: string };

/** Photos picked one by one, shrunk when that helps, uploaded at once as this visitor's (no product: a review's). */
function useReviewPhotos(workspaceId: string) {
  const { t } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const patch = (key: string, next: Partial<Photo>) => setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)));

  function uploadMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 413) return t.custom.tooLarge;
      if (err.status === 415) return t.custom.wrongType;
      if (err.status === 422) return t.custom.unreadable;
      if (err.status === 429) return apiErrorCode(err) === "TOO_MANY_PENDING_UPLOADS" ? t.custom.tooMany : t.custom.rateLimited;
    }
    return t.custom.failed;
  }

  function pick(file: File) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    const typeOk = ACCEPTED.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    setPhotos((list) => [...list, { key, preview, status: typeOk ? "uploading" : "error", message: typeOk ? undefined : t.custom.wrongType }]);
    if (!typeOk) return;
    void (async () => {
      try {
        const prepared = await compressImageIfNeeded(file, COMPRESS);
        if (prepared.size > RAW_LIMIT) throw new ApiError("too large", 413, "FILE_TOO_LARGE", null);
        const upload = await client.uploadCustomerPhoto(workspaceId, prepared, { visitorId: getVisitorId(workspaceId) });
        patch(key, { status: "done", uploadId: upload.uploadId });
      } catch (err) {
        patch(key, { status: "error", message: uploadMessage(err) });
      }
    })();
  }

  return {
    photos,
    pick,
    remove: (key: string) => setPhotos((list) => list.filter((p) => p.key !== key)),
    clear: () => setPhotos([]),
    ids: photos.filter((p) => p.status === "done" && p.uploadId).map((p) => p.uploadId as string),
    uploading: photos.some((p) => p.status === "uploading"),
    full: photos.length >= REVIEW_MAX_PHOTOS,
  };
}

/** 1–5 stars as a radio group: Tab reaches it, the arrow keys move the choice, Space picks. */
function StarInput({
  name,
  value,
  onChange,
  text,
  error,
  errorId,
  disabled,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
  text: ReviewText;
  error?: string;
  errorId: string;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className={labelClass}>
        {text.rating}
        <span className="text-danger" aria-hidden>
          {" "}
          *
        </span>
      </legend>
      {/* Left to right like the stars in the list, so a choice reads the same once published. */}
      <div dir="ltr" className="flex flex-wrap gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => setHover(n)}
            className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-3xl leading-none transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
              n <= shown ? "text-primary" : "text-line-strong"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              disabled={disabled}
              aria-label={text.stars(n)}
              className="sr-only"
            />
            <span aria-hidden>★</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

type Errors = { rating?: string; phone?: string; photos?: string; form?: string };

export interface ReviewFormProps {
  /** The store as the route names it (UUID or slug). */
  workspaceId: string;
  /** A product's review; without it, a review of the store. */
  productId?: string;
  /** The order link of the store's review request: the phone is then optional. */
  orderToken?: string;
  /** The phone to start with (the thank-you page's own order). */
  defaultPhone?: string;
  /** Stars, words and the phone only: no name, no photos. */
  compact?: boolean;
  title?: string;
  /** The title's level in the page around it. */
  headingLevel?: "h2" | "h3";
  /** The review went through (201). */
  onSent?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({
  workspaceId,
  productId,
  orderToken = "",
  defaultPhone = "",
  compact = false,
  title,
  headingLevel = "h3",
  onSent,
  onCancel,
}: ReviewFormProps) {
  const { t, locale } = useStore();
  const text = pickText(REVIEW_TEXT, locale);
  const uid = useId();
  const [client] = useState(() => createStorefrontApiClient());
  const photos = useReviewPhotos(workspaceId);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const Heading = headingLevel;
  const phoneOptional = Boolean(orderToken);

  const ids = {
    title: `${uid}-title`,
    stars: `${uid}-stars`,
    starsError: `${uid}-stars-error`,
    name: `${uid}-name`,
    nameHint: `${uid}-name-hint`,
    phone: `${uid}-phone`,
    phoneHint: `${uid}-phone-hint`,
    phoneError: `${uid}-phone-error`,
    comment: `${uid}-comment`,
    commentCount: `${uid}-comment-count`,
    photos: `${uid}-photos`,
    photosError: `${uid}-photos-error`,
    formError: `${uid}-form-error`,
  };

  useEffect(() => {
    if (sent) thanksRef.current?.focus();
  }, [sent]);

  function focusFirst(next: Errors) {
    const target = next.rating
      ? document.querySelector<HTMLInputElement>(`input[name="${ids.stars}"]`)
      : next.phone
        ? document.getElementById(ids.phone)
        : next.photos
          ? document.getElementById(ids.photos)
          : next.form
            ? document.getElementById(ids.formError)
            : null;
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView?.({ block: "center" });
    target.focus({ preventScroll: true });
  }

  /** A refused send, in the shopper's words. */
  function explain(err: unknown): Errors {
    const code = err instanceof ApiError ? err.code : undefined;
    switch (code) {
      case "ALREADY_REVIEWED":
        return { form: productId ? text.alreadyProduct : text.alreadyStore };
      case "INVALID_PHONE":
        // Empty only when the order link did not hold (another product's, or no longer valid): the phone is needed after all.
        return { phone: phone.trim() ? text.invalidPhone : text.phoneRequired };
      case "INVALID_PHOTOS":
        // Past its time, or uploaded by another visitor: picked again.
        photos.clear();
        return { photos: text.photoExpired };
      case "TOO_MANY_PHOTOS":
        return { photos: text.tooManyPhotos(REVIEW_MAX_PHOTOS) };
      case "TOO_MANY_REQUESTS":
        return { form: text.tooFast };
      case "NOT_FOUND":
        // The store stopped taking reviews since this page loaded.
        return { form: text.closed };
      case "VALIDATION_ERROR": {
        const next: Errors = {};
        for (const problem of apiFieldProblems(err)) {
          if (problem.field === "rating") next.rating = text.ratingRequired;
          else if (problem.field === "phone") next.phone = text.invalidPhone;
          else if (problem.field.startsWith("photoUploadIds")) next.photos = text.tooManyPhotos(REVIEW_MAX_PHOTOS);
          else if (problem.field === "comment" || problem.field === "name") next.form = text.tooLong;
        }
        return Object.keys(next).length > 0 ? next : { form: text.invalid };
      }
    }
    if (err instanceof ApiError && err.status === 429) return { form: text.tooFast };
    return { form: text.failed };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Errors = {};
    if (rating < 1 || rating > 5) next.rating = text.ratingRequired;
    if (!phoneOptional && !phone.trim()) next.phone = text.phoneRequired;
    if (photos.uploading) next.photos = text.waitPhotos;
    setErrors(next);
    if (Object.keys(next).length > 0) return focusFirst(next);

    const body: StorefrontReviewInput = {
      rating,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(!compact && name.trim() ? { name: name.trim().slice(0, REVIEW_NAME_MAX) } : {}),
      ...(comment.trim() ? { comment: comment.trim().slice(0, REVIEW_COMMENT_MAX) } : {}),
      ...(!compact && photos.ids.length > 0 ? { photoUploadIds: photos.ids } : {}),
      ...(orderToken ? { orderToken } : {}),
      // The same device id the checkout sends (lib/botGuard): one review per device.
      deviceId: getDeviceId(),
    };
    setBusy(true);
    try {
      // The visitor that uploaded the photos sends the review.
      const visitorId = getVisitorId(workspaceId);
      if (productId) await storefrontSendProductReview(client, workspaceId, productId, body, visitorId);
      else await storefrontSendStoreReview(client, workspaceId, body, visitorId);
      setRating(0);
      setName("");
      setPhone(defaultPhone);
      setComment("");
      photos.clear();
      setErrors({});
      setSent(true);
      onSent?.();
    } catch (err) {
      const explained = explain(err);
      setErrors(explained);
      focusFirst(explained);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p ref={thanksRef} role="status" tabIndex={-1} className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success outline-none">
        {text.thanks}
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={ids.title}
      className={compact ? "space-y-4" : "space-y-5 rounded-2xl border border-line bg-paper p-4 sm:p-5"}
    >
      <div>
        <Heading id={ids.title} className="text-base font-semibold text-ink">
          {title ?? (productId ? text.formTitle : text.storeFormTitle)}
        </Heading>
        <p className="mt-0.5 text-sm text-ink-soft">{text.formHint}</p>
      </div>

      <StarInput
        name={ids.stars}
        value={rating}
        onChange={(n) => {
          setRating(n);
          setErrors((prev) => ({ ...prev, rating: undefined }));
        }}
        text={text}
        error={errors.rating}
        errorId={ids.starsError}
        disabled={busy}
      />

      {!compact && (
        <div>
          <label htmlFor={ids.name} className={labelClass}>
            {text.name} <span className="font-normal text-ink-soft">({t.common.optional})</span>
          </label>
          <input
            id={ids.name}
            type="text"
            value={name}
            maxLength={REVIEW_NAME_MAX}
            autoComplete="name"
            dir="auto"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={ids.nameHint}
            className={input}
          />
          <p id={ids.nameHint} className="mt-1 text-xs text-ink-soft">
            {text.nameHint}
          </p>
        </div>
      )}

      <div>
        <label htmlFor={ids.phone} className={labelClass}>
          {text.phone}
          {phoneOptional ? (
            <span className="ms-1 font-normal text-ink-soft">({t.common.optional})</span>
          ) : (
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          )}
        </label>
        <input
          id={ids.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={phone}
          maxLength={32}
          disabled={busy}
          onChange={(e) => {
            setPhone(e.target.value);
            setErrors((prev) => ({ ...prev, phone: undefined }));
          }}
          aria-required={!phoneOptional || undefined}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={`${ids.phoneHint}${errors.phone ? ` ${ids.phoneError}` : ""}`}
          className={`${input} text-start rtl:text-end`}
        />
        <p id={ids.phoneHint} className="mt-1 text-xs text-ink-soft">
          {text.phoneHint}
        </p>
        {errors.phone && (
          <p id={ids.phoneError} className="mt-1 text-xs font-medium text-danger">
            {errors.phone}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.comment} className={labelClass}>
          {productId ? text.comment : text.commentStore} <span className="font-normal text-ink-soft">({t.common.optional})</span>
        </label>
        <textarea
          id={ids.comment}
          value={comment}
          maxLength={REVIEW_COMMENT_MAX}
          rows={compact ? 3 : 4}
          dir="auto"
          disabled={busy}
          onChange={(e) => setComment(e.target.value.slice(0, REVIEW_COMMENT_MAX))}
          aria-describedby={ids.commentCount}
          className={`${input} min-h-24 resize-y`}
        />
        <p id={ids.commentCount} className="mt-1 text-end text-xs text-ink-soft tabular-nums">
          {t.custom.counter(comment.length, REVIEW_COMMENT_MAX)}
        </p>
      </div>

      {!compact && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">
            {text.photos} <span className="font-normal text-ink-soft">({t.common.optional})</span>
          </p>
          {photos.photos.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {photos.photos.map((photo, i) => (
                <li key={photo.key} className="w-20 space-y-1">
                  {/* Previewed from the device; the store gets the server's re-encoded copy. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt={text.yourPhoto(i + 1)}
                    className={`size-20 rounded-xl border border-line object-cover ${photo.status === "uploading" ? "opacity-60" : ""}`}
                  />
                  {photo.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => photos.remove(photo.key)}
                      disabled={busy}
                      aria-label={text.removePhoto(i + 1)}
                      className={`block min-h-11 w-full rounded-lg text-xs font-medium text-ink-soft hover:text-danger ${focusRing}`}
                    >
                      {t.custom.removePhoto}
                    </button>
                  )}
                  <p aria-live="polite" className="text-xs empty:hidden">
                    {photo.status === "uploading" && <span className="text-ink-soft">{t.custom.uploading}</span>}
                    {photo.status === "error" && <span className="font-medium text-danger">{photo.message}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!photos.full && (
            <label className={`${btnSecondary} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
              <input
                id={ids.photos}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={busy}
                aria-invalid={errors.photos ? true : undefined}
                aria-describedby={errors.photos ? ids.photosError : undefined}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    photos.pick(file);
                    setErrors((prev) => ({ ...prev, photos: undefined }));
                  }
                }}
              />
              {text.addPhoto}
            </label>
          )}
          <p className="text-xs text-ink-soft">
            {t.custom.photoHint} {text.photoLimit(REVIEW_MAX_PHOTOS)}
          </p>
          {errors.photos && (
            <p id={ids.photosError} role="alert" className="text-sm font-medium text-danger">
              {errors.photos}
            </p>
          )}
        </div>
      )}

      {errors.form && (
        <p id={ids.formError} role="alert" tabIndex={-1} className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger outline-none">
          {errors.form}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={busy} aria-busy={busy} className={`${btnPrimary} w-full sm:w-auto`}>
          {busy ? text.sending : text.submit}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className={`${btnGhost} w-full sm:w-auto`}>
            {text.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
