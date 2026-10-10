import type { ReactNode } from "react";
import type { Review } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { IconCheck, IconDelete, IconEye, IconEyeOff } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { InlineBone, RowAction } from "@/pages/returns/rowkit/RowBits";
import { ReviewPhotos, ReviewSourceBadge, Stars } from "./ReviewBits";
import { MAX_RATING, REVIEW_STATUS_TONE, REVIEW_WORDS, isMerchantAdded, photosOf, reviewAuthor, type ModerateAction } from "./reviewModel";

const STRINGS = {
  en: {
    openProduct: "Open the product",
    openProducts: "Open the products",
    written: "Written {when}",
    rating: "Rating",
    said: "What they said",
    photos: "Photos",
    who: "Who wrote it",
    openCustomer: "Open the customer's page",
    openOrder: "Open the order they reviewed",
    hintPending: "Approve it and it shows on the product's page. Hide it and it stays between you and the customer.",
    hintApproved: "Shoppers see this review on the product's page.",
    hintRejected: "Hidden: shoppers don't see this review.",
    addedNote: "You added this review, so it shows without the “verified buyer” badge.",
    remove: "Delete this review",
  },
  ar: {
    openProduct: "فتح المنتج",
    openProducts: "فتح المنتجات",
    written: "كُتب {when}",
    rating: "التقييم",
    said: "ماذا قال",
    photos: "الصور",
    who: "من كتبه",
    openCustomer: "فتح صفحة العميل",
    openOrder: "فتح الطلب الذي قيّمه",
    hintPending: "وافق عليه ليظهر في صفحة المنتج. أخفِه ليبقى بينك وبين العميل.",
    hintApproved: "يرى العملاء هذا التقييم في صفحة المنتج.",
    hintRejected: "مخفي: لا يرى العملاء هذا التقييم.",
    addedNote: "هذا التقييم أضفته أنت، لذلك يظهر بدون علامة «مشترٍ موثّق».",
    remove: "حذف هذا التقييم",
  },
} satisfies Messages;

/** A footer pill takes its share of the row on a phone and its own width from sm. */
const FOOTER_PILL = "max-sm:flex-1";

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

const QUIET_LINK =
  "inline-flex min-h-11 items-center rounded-full text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-9";

/**
 * The customer behind a review, one tap from a call or a WhatsApp message —
 * the way to answer a review today, as a store's reply is not something the
 * API keeps. The number is read only while the preview is open; a role that
 * may not read customers simply sees the name and the link.
 */
function ReviewerContact({ customerId, name }: { customerId: string; name: string }) {
  const workspaceId = useWorkspaceId();
  const customer = useCachedAsync(`review-customer:${workspaceId}:${customerId}`, () => apiClient.getCustomer(workspaceId, customerId), [
    workspaceId,
    customerId,
  ]);
  if (customer.loading) return <InlineBone className="w-28" />;
  // A masked number (010****665) is not one to dial: nothing is offered for it.
  const phone = dialablePhone(customer.data?.phoneRaw ?? customer.data?.phoneNormalized);
  if (!phone) return null;
  return <ContactActions phone={phone} name={name} />;
}

export interface ReviewQuickLookProps {
  /** The review being looked at. Null draws nothing (keep the last one while the panel closes). */
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The move on its way to the server for this review, if any. */
  busy: ModerateAction | null;
  onModerate: (action: ModerateAction) => void;
  onDelete: () => void;
}

/**
 * A review at a glance, without leaving the list: the stars, the shopper's own
 * words in full, the photos, who wrote it and how to reach them — and the
 * decision in the footer. "Open fully" goes to the product, which is the page
 * a review belongs to.
 */
export function ReviewQuickLook({ review, open, onOpenChange, busy, onModerate, onDelete }: ReviewQuickLookProps) {
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  if (!review) return null;

  const product = review.product ?? null;
  const author = reviewAuthor(review, words.unknownCustomer);
  const added = isMerchantAdded(review);
  const comment = review.comment?.trim() || "";
  const acting = busy !== null;
  const hint = review.status === "pending" ? t.hintPending : review.status === "approved" ? t.hintApproved : t.hintRejected;

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{product?.name || words.unknownProduct}</bdi>}
      status={<StatusBadge value={review.status} tone={REVIEW_STATUS_TONE[review.status]} text={words[`status_${review.status}`]} />}
      // A product that was deleted has no page: the way out is the list of products.
      to={product ? `/catalog/${product.id}` : "/catalog"}
      openLabel={product ? t.openProduct : t.openProducts}
      actions={
        <>
          {review.status !== "rejected" && (
            <RowAction
              className={FOOTER_PILL}
              tone="quiet"
              label={words.hide}
              icon={IconEyeOff}
              busy={busy === "reject"}
              disabled={acting}
              onClick={() => onModerate("reject")}
            />
          )}
          {review.status !== "approved" && (
            <RowAction
              className={FOOTER_PILL}
              tone={review.status === "pending" ? "primary" : "quiet"}
              label={review.status === "rejected" ? words.show : words.approve}
              icon={review.status === "rejected" ? IconEye : IconCheck}
              busy={busy === "approve"}
              disabled={acting}
              onClick={() => onModerate("approve")}
            />
          )}
        </>
      }
    >
      <div data-slot="review-peek" className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={review.createdAt} title={formatDateTime(review.createdAt)}>
            {fmt(t.written, { when: formatRelativeTime(review.createdAt) })}
          </time>
          <span aria-hidden>·</span>
          <span>{formatDate(review.createdAt)}</span>
          <ReviewSourceBadge review={review} />
        </p>

        <section>
          <BlockLabel>{t.rating}</BlockLabel>
          <p className="flex items-center gap-3">
            <Stars rating={review.rating} size="lg" />
            <span aria-hidden className="text-[15px] leading-6 font-semibold text-ink tabular-nums">
              <bdi dir="ltr">{fmt("{n} / {max}", { n: review.rating, max: MAX_RATING })}</bdi>
            </span>
          </p>
        </section>

        <section>
          <BlockLabel>{t.said}</BlockLabel>
          {comment ? (
            // Its own block, with dir="auto": the words are the shopper's own, not necessarily in the dashboard's language.
            <blockquote dir="auto" data-slot="review-note" className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm leading-6 whitespace-pre-line wrap-anywhere text-ink">
              {comment}
            </blockquote>
          ) : (
            <p className="text-sm leading-6 text-ink-soft">{words.noComment}</p>
          )}
        </section>

        {photosOf(review).length > 0 && (
          <section>
            <BlockLabel>{t.photos}</BlockLabel>
            <ReviewPhotos review={review} />
          </section>
        )}

        <div role="separator" data-slot="review-peek-rule" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.who}</BlockLabel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink">
              <bdi>{author}</bdi>
            </p>
            {/* Mounted with the preview only: the number is asked for when someone is looking. */}
            {open && !added && review.customerId && <ReviewerContact customerId={review.customerId} name={author} />}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4">
            {!added && review.customerId && (
              <ViewLink to={`/customers/${review.customerId}`} className={QUIET_LINK}>
                {t.openCustomer}
              </ViewLink>
            )}
            {review.orderId && (
              <ViewLink to={`/orders/${review.orderId}`} className={QUIET_LINK}>
                {t.openOrder}
              </ViewLink>
            )}
          </div>
        </section>

        <p data-slot="review-hint" className="text-[13px] leading-5 text-ink-soft">
          {hint}
          {added && <> {t.addedNote}</>}
        </p>

        {added && (
          <button
            type="button"
            disabled={acting}
            onClick={onDelete}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-danger transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.97] motion-reduce:transition-none"
          >
            <IconDelete className="size-4" aria-hidden />
            {t.remove}
          </button>
        )}
      </div>
    </QuickLook>
  );
}
