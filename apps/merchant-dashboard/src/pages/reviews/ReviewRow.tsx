import type { Review } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconCamera, IconCheck, IconDelete, IconEye, IconEyeOff, IconProduct, IconQuickLook } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { FactChip, ReviewSourceBadge, Stars } from "./ReviewBits";
import { REVIEW_STATUS_TONE, REVIEW_WORDS, isMerchantAdded, photosOf, reviewAuthor, type ModerateAction } from "./reviewModel";

const STRINGS = {
  en: {
    peek: "Preview the review of {product} by {who}",
    menuLabel: "Actions for this review",
    menuPeek: "Quick look",
    menuProduct: "Open the product",
    openProduct: "Open {product}",
  },
  ar: {
    peek: "معاينة تقييم {product} من {who}",
    menuLabel: "إجراءات التقييم",
    menuPeek: "معاينة سريعة",
    menuProduct: "فتح المنتج",
    openProduct: "فتح {product}",
  },
} satisfies Messages;

/** The columns of the reviews sheet: the product and who wrote, what they said, where it stands, since when, what to do. */
export const REVIEW_COLUMNS = "grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_max-content_max-content_max-content]";

export interface ReviewRowProps {
  review: Review;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** The move on its way to the server for this review, if any. */
  busy: ModerateAction | null;
  /** Its preview is open. */
  current: boolean;
  onPeek: () => void;
  onModerate: (action: ModerateAction) => void;
  onDelete: () => void;
}

/**
 * One review in the list: the product and its stars first, then where it
 * stands, who wrote it and the ONE move its status allows — approve a waiting
 * review, hide a live one, show a hidden one. A press anywhere else opens
 * Quick Look (Space too; Enter opens the product). Everything else — the other
 * move of a waiting review, delete for a review the store added — is in «…»
 * and in the menu of the row (right-click, a long press, Shift+F10).
 */
export function ReviewRow({ review, compact, busy, current, onPeek, onModerate, onDelete }: ReviewRowProps) {
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  const navigate = useViewNavigate();

  const product = review.product ?? null;
  const productName = product?.name || words.unknownProduct;
  const productPath = product ? `/catalog/${product.id}` : null;
  const author = reviewAuthor(review, words.unknownCustomer);
  const photos = photosOf(review).length;
  const comment = review.comment?.trim() || "";
  const acting = busy !== null;
  const peekLabel = fmt(t.peek, { product: productName, who: author });
  const keys = rowKeyProps(onPeek, productPath ? () => navigate(productPath) : undefined);

  const menu: ContextMenuItem[] = [{ id: "peek", label: t.menuPeek, icon: IconQuickLook, onSelect: onPeek }];
  if (productPath) menu.push({ id: "product", label: t.menuProduct, icon: IconProduct, onSelect: () => navigate(productPath) });
  if (review.status !== "approved") {
    menu.push({
      id: "approve",
      label: review.status === "rejected" ? words.show : words.approve,
      icon: review.status === "rejected" ? IconEye : IconCheck,
      separatorBefore: true,
      disabled: acting,
      onSelect: () => onModerate("approve"),
    });
  }
  if (review.status !== "rejected") {
    menu.push({
      id: "hide",
      label: words.hide,
      icon: IconEyeOff,
      separatorBefore: review.status === "approved",
      disabled: acting,
      onSelect: () => onModerate("reject"),
    });
  }
  if (isMerchantAdded(review)) {
    menu.push({ id: "delete", label: words.remove, icon: IconDelete, destructive: true, separatorBefore: true, disabled: acting, onSelect: onDelete });
  }

  // The ONE move of the row: the brand pill while a decision is due, a quiet pane once it was made.
  const action =
    review.status === "pending" ? (
      <RowAction label={words.approve} icon={IconCheck} busy={busy === "approve"} disabled={acting} onClick={() => onModerate("approve")} />
    ) : review.status === "approved" ? (
      <RowAction tone="quiet" label={words.hide} icon={compact ? undefined : IconEyeOff} busy={busy === "reject"} disabled={acting} onClick={() => onModerate("reject")} />
    ) : (
      <RowAction tone="quiet" label={words.show} icon={compact ? undefined : IconEye} busy={busy === "approve"} disabled={acting} onClick={() => onModerate("approve")} />
    );

  const status = <StatusBadge value={review.status} tone={REVIEW_STATUS_TONE[review.status]} text={words[`status_${review.status}`]} />;
  const age = (
    <time dateTime={review.createdAt} title={formatDateTime(review.createdAt)}>
      {formatRelativeTime(review.createdAt)}
    </time>
  );
  const facts = (
    <>
      <ReviewSourceBadge review={review} />
      {photos > 0 && (
        <FactChip>
          <IconCamera className="size-3.5 shrink-0" aria-hidden />
          {pluralOf(words, "photos", photos)}
        </FactChip>
      )}
    </>
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={<bdi className={product ? undefined : "font-medium text-ink-soft"}>{productName}</bdi>}
            amount={<Stars rating={review.rating} size="sm" />}
            status={status}
            meta={
              <>
                <bdi>{author}</bdi> · {age}
              </>
            }
            action={action}
            footer={
              <>
                {/* dir="auto": the words are the shopper's own, in whatever language they wrote them. */}
                {comment && (
                  <p dir="auto" className="line-clamp-2 basis-full text-[13px] leading-5 wrap-anywhere text-ink">
                    {comment}
                  </p>
                )}
                {facts}
              </>
            }
            onOpen={onPeek}
            openLabel={peekLabel}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          {/* The name is the way to the product's page; the row itself opens the preview. */}
          {productPath ? (
            <ViewLink
              to={productPath}
              aria-label={fmt(t.openProduct, { product: productName })}
              className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <bdi>{productName}</bdi>
            </ViewLink>
          ) : (
            <span className="text-ink-soft">{productName}</span>
          )}
        </p>
        <p className="truncate text-xs leading-5 text-ink-soft">
          <bdi>{author}</bdi>
        </p>
      </div>

      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-6">
          <Stars rating={review.rating} />
          {facts}
        </p>
        <p dir={comment ? "auto" : undefined} className={comment ? "line-clamp-2 text-sm leading-5 wrap-anywhere text-ink" : "text-sm leading-5 text-ink-soft"}>
          {comment || words.noComment}
        </p>
      </div>

      <div className="flex items-center">{status}</div>

      <div className="text-xs whitespace-nowrap text-ink-soft">{age}</div>

      <div className="flex items-center justify-end gap-1">
        {action}
        <ItemMenu items={menu} label={t.menuLabel} />
      </div>
    </DeskRow>
  );
}
