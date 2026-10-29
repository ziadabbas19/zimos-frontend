import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { Review } from "@store-builder/api-client";
import { IconCalendar, IconExternal, IconStar } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate } from "@/lib/format";
import {
  MAX_RATING,
  PURCHASE_TONE,
  REVIEW_STATUS_TONE,
  REVIEW_WORDS,
  externalLinkOf,
  isExternal,
  isStarsOnly,
  photosOf,
  purchaseOf,
  sourceOf,
  sourceText,
  writtenOnOf,
} from "./reviewModel";

const STRINGS = {
  en: { photo: "Photo {n} of {total} — opens in a new tab" },
  ar: { photo: "الصورة {n} من {total} — تُفتح في تبويب جديد" },
} satisfies Messages;

const STAR_SIZE = { sm: "size-3.5", md: "size-4", lg: "size-6" } as const;

/**
 * Five stars, `rating` of them filled. One name for the whole group, so a
 * screen reader says «٤ من ٥» and not five icons. A star is not a direction:
 * the row is never mirrored.
 */
export function Stars({ rating, size = "md", className }: { rating: number; size?: keyof typeof STAR_SIZE; className?: string }) {
  const words = useT(REVIEW_WORDS);
  return (
    <span
      role="img"
      aria-label={fmt(words.ratingOf, { n: rating, max: MAX_RATING })}
      data-slot="review-stars"
      className={cn("inline-flex items-center gap-0.5 align-middle", className)}
    >
      {Array.from({ length: MAX_RATING }, (_, index) => {
        const lit = index < rating;
        return (
          <IconStar
            key={index}
            aria-hidden
            data-lit={lit ? "" : undefined}
            className={cn("zimos-review-star shrink-0", STAR_SIZE[size], lit ? "text-accent" : "text-line-strong")}
          />
        );
      })}
    </span>
  );
}

/** A small quiet pill for a fact of the row: how many photos it has. */
export function FactChip({ children }: { children: ReactNode }) {
  return (
    <span
      data-slot="review-fact"
      className="inline-flex items-center gap-1 rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-soft"
    >
      {children}
    </span>
  );
}

/**
 * Where a review the store added came from: «من فيسبوك», «من جوجل», «من <the
 * name the merchant typed>» for one brought from another site, «أضفته أنت» /
 * «مستورد» for an older one added by hand. Nothing on a customer's own.
 */
export function ReviewSourceBadge({ review }: { review: Review }) {
  const words = useT(REVIEW_WORDS);
  const text = sourceText(review, words);
  if (!text) return null;
  return <StatusBadge value={sourceOf(review)} tone={isExternal(review) ? "info" : "neutral"} text={text} />;
}

/** The day a review was written on the other site, as a quiet fact; nothing when it was not given. */
export function ReviewWrittenOn({ review }: { review: Review }) {
  const words = useT(REVIEW_WORDS);
  const day = writtenOnOf(review);
  if (!day) return null;
  return (
    <FactChip>
      <IconCalendar className="size-3.5 shrink-0" aria-hidden />
      {/* Noon of that day, read as local time: the day stays the same day in every time zone. */}
      <time dateTime={day}>{fmt(words.writtenOn, { date: formatDate(`${day}T12:00:00`) })}</time>
    </FactChip>
  );
}

/**
 * The review where it was written, in a new tab. `size="row"` is the small pill
 * of a list row; `"block"` is a full 44px link for Quick Look.
 */
export function ReviewOriginalLink({ review, size = "row" }: { review: Review; size?: "row" | "block" }) {
  const words = useT(REVIEW_WORDS);
  const href = externalLinkOf(review);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={words.originalLabel}
      data-slot="review-original"
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        size === "row" ? "bg-paper-sunken px-2.5 py-0.5 text-xs pointer-coarse:min-h-8 pointer-coarse:py-1.5" : "min-h-11 text-sm pointer-fine:min-h-9"
      )}
    >
      {words.original}
      {/* An arrow out of the page: it points the same way in both languages. */}
      <IconExternal className="size-3.5 shrink-0" aria-hidden />
    </a>
  );
}

/** Whether the reviewer bought, and where their order stands; nothing on a review the store added. */
export function PurchaseBadge({ review }: { review: Review }) {
  const words = useT(REVIEW_WORDS);
  const state = purchaseOf(review);
  if (!state) return null;
  return <StatusBadge value={state} tone={PURCHASE_TONE[state]} text={words[`purchase_${state}`]} />;
}

/** Where a review stands, «النجوم فقط» for one published without its words. */
export function ReviewStatusBadge({ review }: { review: Review }) {
  const words = useT(REVIEW_WORDS);
  if (isStarsOnly(review)) return <StatusBadge value="stars" tone="success" text={words.status_stars} />;
  return <StatusBadge value={review.status} tone={REVIEW_STATUS_TONE[review.status]} text={words[`status_${review.status}`]} />;
}

/** The photos of a review: each opens whole in a new tab. */
export function ReviewPhotos({ review, className }: { review: Review; className?: string }) {
  const t = useT(STRINGS);
  const photos = photosOf(review);
  if (photos.length === 0) return null;
  return (
    <ul data-slot="review-photos" className={cn("flex flex-wrap gap-2", className)}>
      {photos.map((url, index) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={fmt(t.photo, { n: index + 1, total: photos.length })}
            className="zimos-review-photo block size-20 overflow-hidden rounded-2xl bg-paper-sunken ring-1 ring-line transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
          >
            <img src={url} alt="" loading="lazy" className="size-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
