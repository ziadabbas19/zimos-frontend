import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { Review } from "@store-builder/api-client";
import { IconStar } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { MAX_RATING, REVIEW_WORDS, isMerchantAdded, photosOf, sourceOf } from "./reviewModel";

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

/** «ضفته إنت» / «مستورد» on a review the store added; nothing on a customer's own. */
export function ReviewSourceBadge({ review }: { review: Review }) {
  const words = useT(REVIEW_WORDS);
  if (!isMerchantAdded(review)) return null;
  const source = sourceOf(review);
  return <StatusBadge value={source} tone="neutral" text={source === "manual" ? words.source_manual : words.source_import} />;
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
