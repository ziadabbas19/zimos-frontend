import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  catalogCreateManualReview,
  reviewsUpdateContent,
  type ManualReviewPayload,
  type Review,
  type ReviewExternalSource,
  type ReviewKind,
} from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { IconInfo, IconPlus, IconStar } from "@/components/icons";
import { FilterChoice } from "@/components/list";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ImageUrlInput } from "../catalog/components/ImageUrlInput";
import { EXTERNAL_SOURCES, MAX_RATING, REVIEW_WORDS, isExternal, kindOf, photosOf, writtenOnOf, type ReviewRecord } from "./reviewModel";

/**
 * A review from another site: a real review a customer left on Facebook,
 * Google, Instagram, WhatsApp or elsewhere, brought into the store by the
 * merchant with where it was written, a link to it and the day. The store
 * shows it apart from its customers' reviews, with that source; it is never
 * a verified buyer and never counts in the stars.
 *
 * The same form edits a review the merchant added. An older one added by hand
 * (before reviews had a source) may be given its source here, which turns it
 * into a review from another site; leaving the source empty keeps it as it is.
 */

const MAX_PHOTOS = 6;
const MAX_SOURCE_NAME = 60;
const MAX_LINK = 1000;
const FORM_ID = "review-form";

const STRINGS = {
  en: {
    title: "Add a review from another site",
    editTitle: "Edit the review",
    description: "These reviews show apart from your customers' reviews, with their source, and don't count in your stars.",
    notice: "Add only real reviews that actually reached you from your customers.",
    source: "Where was it written?",
    sourceHint: "Your store shows it with the review.",
    legacyHint: "Choose where it was written to turn it into a review from another site, shown apart with its source.",
    sourceRequired: "Choose where it was written.",
    sourceForExtras: "Choose where it was written to keep its link and date.",
    site_facebook: "Facebook",
    site_google: "Google",
    site_instagram: "Instagram",
    site_whatsapp: "WhatsApp",
    site_other: "Other",
    sourceName: "Its name",
    sourceNameHint: "Up to {n} characters: a site's or a group's name.",
    sourceNameRequired: "Write where it was written.",
    link: "Link to the review",
    linkHint: "Optional. Where it can be seen on that site.",
    linkInvalid: "Write a full web address, like https://…",
    about: "What is it about?",
    aboutProduct: "A product",
    aboutStore: "The whole store",
    product: "Product",
    chooseProduct: "Choose a product",
    productRequired: "Choose the product this review is about.",
    productsFailed: "We couldn't load your products.",
    retry: "Try again",
    name: "Reviewer's name",
    nameHint: "As it appears where they wrote it.",
    nameRequired: "Write the name of the person who wrote it.",
    rating: "Stars",
    comment: "What they wrote",
    commentHint: "Optional. Their own words, as they wrote them.",
    date: "When they wrote it",
    dateHint: "Optional. The day it was written there.",
    dateFuture: "The date can't be in the future.",
    photos: "Photos",
    photosHint: "Optional. Up to {n} photos.",
    addPhoto: "Add a photo",
    publish: "Show it in the store now",
    publishHint: "Off: it waits with the reviews to approve.",
    cancel: "Cancel",
    add: "Add review",
    adding: "Adding…",
    added: "Review added.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Review saved.",
  },
  ar: {
    title: "إضافة تقييم من مصدر خارجي",
    editTitle: "تعديل التقييم",
    description: "تظهر هذه التقييمات منفصلة عن تقييمات عملائك مع مصدرها، ولا تدخل في متوسط نجومك.",
    notice: "أضف آراء حقيقية وصلتك فعلًا من عملائك.",
    source: "أين كُتب؟",
    sourceHint: "يظهر المصدر مع التقييم في متجرك.",
    legacyHint: "اختر مصدره ليتحول إلى تقييم من مصدر خارجي يظهر منفصلًا مع مصدره.",
    sourceRequired: "اختر أين كُتب هذا التقييم.",
    sourceForExtras: "اختر مصدره ليُحفظ رابطه وتاريخه.",
    site_facebook: "فيسبوك",
    site_google: "جوجل",
    site_instagram: "إنستجرام",
    site_whatsapp: "واتساب",
    site_other: "مصدر آخر",
    sourceName: "اسم المصدر",
    sourceNameHint: "حتى {n} حرفًا: اسم موقع أو مجموعة.",
    sourceNameRequired: "اكتب اسم المصدر.",
    link: "رابط التقييم",
    linkHint: "اختياري. مكانه على ذلك الموقع.",
    linkInvalid: "اكتب رابطًا كاملًا، مثل https://…",
    about: "عن ماذا التقييم؟",
    aboutProduct: "منتج",
    aboutStore: "المتجر كله",
    product: "المنتج",
    chooseProduct: "اختر منتجًا",
    productRequired: "اختر المنتج الذي يخصه هذا التقييم.",
    productsFailed: "تعذّر تحميل منتجاتك.",
    retry: "إعادة المحاولة",
    name: "اسم صاحب التقييم",
    nameHint: "كما يظهر في المكان الذي كتب فيه.",
    nameRequired: "اكتب اسم صاحب التقييم.",
    rating: "النجوم",
    comment: "ما كتبه",
    commentHint: "اختياري. كلامه كما كتبه.",
    date: "تاريخ كتابته",
    dateHint: "اختياري. اليوم الذي كُتب فيه هناك.",
    dateFuture: "لا يمكن أن يكون التاريخ في المستقبل.",
    photos: "الصور",
    photosHint: "اختياري. حتى {n} صور.",
    addPhoto: "إضافة صورة",
    publish: "إظهاره في المتجر الآن",
    publishHint: "إذا كان مغلقًا: ينتظر مع التقييمات التي تنتظر موافقتك.",
    cancel: "إلغاء",
    add: "إضافة التقييم",
    adding: "جارٍ الإضافة…",
    added: "تمت إضافة التقييم.",
    save: "حفظ التغييرات",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ التقييم.",
  },
} satisfies Messages;

/** The fields that can be refused, in the order the form shows them: the first one wrong gets the cursor. */
const FIELD_ORDER = ["source", "sourceName", "link", "product", "name", "date"] as const;
type FieldKey = (typeof FIELD_ORDER)[number];
type Errors = Partial<Record<FieldKey, string>>;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The latest day a review can say it was written: today, or the UTC day when
 * that is earlier — the server refuses a day after its own (UTC) now.
 */
function latestWrittenOn(now = new Date()): string {
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const utc = now.toISOString().slice(0, 10);
  return local < utc ? local : utc;
}

/**
 * The link as the server takes it: a web address (http or https), with
 * https:// put before a bare "facebook.com/…". "" for no link, null for one
 * that is not a web address.
 */
function readLink(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text);
  // Another scheme (mailto:, javascript:…) is refused; "site.com:8080" is a host and a port, not a scheme.
  if (!withScheme && /^[a-z][a-z\d+.-]*:(?!\d)/i.test(text)) return null;
  try {
    const url = new URL(withScheme ? text : `https://${text}`);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) return null;
    return url.href.length <= MAX_LINK ? url.href : null;
  } catch {
    return null;
  }
}

export function AddReviewDialog({
  open,
  productId: fixedProductId,
  review: editing = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Set when a new review is added from a product: the choice of what it is about is skipped. */
  productId?: string;
  /** The review being edited (one the merchant added); absent for a new one. */
  review?: Review | null;
  onClose: () => void;
  onSaved: (review: Review) => void;
}) {
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const fixed = editing ? undefined : fixedProductId;
  // An older review added by hand: its source may stay empty (it then stays as it is).
  const legacy = editing !== null && !isExternal(editing);

  // Asked for once the sheet is first opened, not with the page.
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  const products = useAsync(
    () => (fixed || !wanted ? Promise.resolve(null) : apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 })),
    [workspaceId, fixed, wanted]
  );

  const [source, setSource] = useState<ReviewExternalSource | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [link, setLink] = useState("");
  const [kind, setKind] = useState<ReviewKind>("product");
  const [productId, setProductId] = useState(fixed ?? "");
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(MAX_RATING);
  const [comment, setComment] = useState("");
  const [writtenOn, setWrittenOn] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fields = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const hold = (key: FieldKey) => (node: HTMLElement | null) => {
    fields.current[key] = node;
  };

  // Every opening starts from the review being edited, or from an empty form.
  useEffect(() => {
    if (!open) return;
    const row = editing as ReviewRecord | null;
    const site = row && isExternal(row) ? (row.externalSource ?? "other") : null;
    setSource(site);
    setSourceName(site === "other" ? (row?.externalSourceLabel ?? "") : "");
    setLink(row?.externalUrl ?? "");
    setKind(row ? kindOf(row) : "product");
    setProductId(row ? (row.productId ?? "") : (fixed ?? ""));
    setAuthorName(row?.authorName ?? "");
    setRating(row?.rating ?? MAX_RATING);
    setComment(row?.comment ?? "");
    setWrittenOn(row ? (writtenOnOf(row) ?? "") : "");
    setPhotos(row ? photosOf(row) : []);
    setPublish(true);
    setBusy(false);
    setErrors({});
    setFormError(null);
  }, [open, fixed, editing]);

  function clear(key: FieldKey) {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const today = latestWrittenOn();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const cleanLink = readLink(link);
    const found: Errors = {};
    if (!source) {
      if (!legacy) found.source = t.sourceRequired;
      // A link or a day is kept only with a source: nothing typed is dropped without a word.
      else if (cleanLink || writtenOn) found.source = t.sourceForExtras;
    }
    if (source === "other" && !sourceName.trim()) found.sourceName = t.sourceNameRequired;
    if (cleanLink === null) found.link = t.linkInvalid;
    if (kind === "product" && !productId) found.product = t.productRequired;
    if (!authorName.trim()) found.name = t.nameRequired;
    if (writtenOn && writtenOn > today) found.date = t.dateFuture;
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      // The first field that needs fixing, on screen and under the cursor (the first pill of a choice).
      const node = fields.current[first];
      const target = node?.matches("input, select, textarea") ? node : node?.querySelector<HTMLElement>("button");
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
      return;
    }

    // Every new review carries its source; an edit sends it when one is chosen.
    const external: Partial<ManualReviewPayload> = source
      ? {
          externalSource: source,
          externalSourceLabel: source === "other" ? sourceName.trim() : null,
          externalUrl: cleanLink || null,
          reviewedAt: writtenOn || null,
        }
      : {};
    const keptPhotos = photos.filter(Boolean);
    // An edit leaves the photos alone unless they changed: what is stored goes back untouched.
    const samePhotos = editing !== null && keptPhotos.join("\n") === photosOf(editing).join("\n");
    const content = {
      kind,
      ...(kind === "product" ? { productId } : {}),
      authorName: authorName.trim(),
      rating,
      comment: comment.trim() || null,
      ...(samePhotos ? {} : { photos: keptPhotos }),
      ...external,
    };

    setBusy(true);
    setFormError(null);
    try {
      const saved = editing
        ? await reviewsUpdateContent(apiClient, workspaceId, editing.id, content)
        : await catalogCreateManualReview<Review>(apiClient, workspaceId, { ...content, status: publish ? "approved" : "pending" });
      toast.success(editing ? t.saved : t.added);
      onSaved(saved);
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  const listed = products.data?.products ?? [];
  // A review on a product the list does not carry (archived, or past the first 200) keeps it as a choice.
  const ownProduct = editing?.product && !listed.some((product) => product.id === editing.product?.id) ? editing.product : null;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={editing ? t.editTitle : t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={FORM_ID} className="rounded-full px-5" disabled={busy}>
            {editing ? (busy ? t.saving : t.save) : busy ? t.adding : t.add}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate className="space-y-4" onSubmit={(event) => void submit(event)}>
        {formError && <Alert variant="danger">{formError}</Alert>}

        {!editing && (
          <p data-slot="review-honesty" className="flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-sm leading-6 font-medium text-ink">
            <IconInfo className="mt-1 size-4 shrink-0 text-accent-dark" aria-hidden />
            {t.notice}
          </p>
        )}

        <div ref={hold("source")} className="space-y-1.5">
          <p className="text-sm font-medium text-ink">
            {t.source}
            {!legacy && <span className="text-danger"> *</span>}
          </p>
          <FilterChoice
            label={t.source}
            // An older review may go back to having no source.
            allowClear={legacy}
            value={source}
            onChange={(next) => {
              setSource(next);
              clear("source");
              if (next !== "other") clear("sourceName");
            }}
            options={EXTERNAL_SOURCES.map((site) => ({ value: site, label: t[`site_${site}`] }))}
          />
          {errors.source ? (
            <p className="text-xs font-medium text-danger">{errors.source}</p>
          ) : (
            <p className="text-xs text-ink-soft">{legacy ? t.legacyHint : t.sourceHint}</p>
          )}
        </div>

        {source === "other" && (
          <Field label={t.sourceName} required hint={fmt(t.sourceNameHint, { n: MAX_SOURCE_NAME })} error={errors.sourceName}>
            {({ id, ...aria }) => (
              <Input
                ref={hold("sourceName")}
                id={id}
                {...aria}
                dir="auto"
                maxLength={MAX_SOURCE_NAME}
                autoComplete="off"
                value={sourceName}
                disabled={busy}
                onChange={(event) => {
                  setSourceName(event.target.value);
                  clear("sourceName");
                }}
              />
            )}
          </Field>
        )}

        <Field label={t.link} hint={t.linkHint} error={errors.link}>
          {({ id, ...aria }) => (
            <Input
              ref={hold("link")}
              id={id}
              {...aria}
              type="url"
              inputMode="url"
              // An address reads left to right in both languages.
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
              maxLength={MAX_LINK}
              value={link}
              disabled={busy}
              onChange={(event) => {
                setLink(event.target.value);
                clear("link");
                if (errors.source && legacy) clear("source");
              }}
            />
          )}
        </Field>

        {!fixed && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">{t.about}</p>
            <Segmented
              label={t.about}
              value={kind}
              onChange={(next) => {
                setKind(next);
                clear("product");
              }}
              options={[
                { value: "product", label: t.aboutProduct },
                { value: "store", label: t.aboutStore },
              ]}
              className="w-full"
            />
          </div>
        )}

        {!fixed && kind === "product" && (
          <Field label={t.product} required error={errors.product}>
            {({ id, ...aria }) => (
              <>
                <Select
                  ref={hold("product")}
                  id={id}
                  {...aria}
                  value={productId}
                  disabled={busy || products.loading}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    clear("product");
                  }}
                >
                  <option value="">{t.chooseProduct}</option>
                  {ownProduct && <option value={ownProduct.id}>{ownProduct.name}</option>}
                  {listed.map((product) => (
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
              ref={hold("name")}
              id={id}
              {...aria}
              dir="auto"
              maxLength={120}
              autoComplete="off"
              value={authorName}
              disabled={busy}
              onChange={(event) => {
                setAuthorName(event.target.value);
                clear("name");
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

        <Field label={t.date} hint={t.dateHint} error={errors.date}>
          {({ id, ...aria }) => (
            <Input
              ref={hold("date")}
              id={id}
              {...aria}
              type="date"
              max={today}
              value={writtenOn}
              disabled={busy}
              className="max-w-56"
              onChange={(event) => {
                setWrittenOn(event.target.value);
                clear("date");
                if (errors.source && legacy) clear("source");
              }}
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

        {/* Whether it shows is decided once, here; after that it is the list's approve and hide. */}
        {!editing && (
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
        )}
      </form>
    </Modal>
  );
}
