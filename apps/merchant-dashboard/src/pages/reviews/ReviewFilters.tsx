import type { Review, ReviewKind } from "@store-builder/api-client";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import type { ActiveFilter } from "@/pages/returns/rowkit/ActiveFilters";
import { REVIEW_SOURCES, REVIEW_WORDS, kindOf, photosOf, sourceOf, type ReviewSource } from "./reviewModel";

const STRINGS = {
  en: {
    kind: "Reviewing",
    kindLabel: "Reviews by what they review",
    kind_product: "A product",
    kind_store: "Your store",
    chipKind: "Reviewing: {value}",
    source: "Where it came from",
    sourceHint: "A customer's own review, one you typed in, or one that came with an import.",
    rating: "Rating",
    ratingLabel: "Reviews by rating",
    rating_high: "{a} and {b} stars",
    rating_mid: "{a} stars",
    rating_low: "{a} and {b} stars",
    content: "What it has",
    contentLabel: "Reviews by what they have",
    withPhotos: "With photos",
    withComment: "With a comment",
    chipSource: "Source: {value}",
    chipRating: "Rating: {value}",
    show_one: "Show 1 review",
    show_other: "Show {n} reviews",
  },
  ar: {
    kind: "موضوع التقييم",
    kindLabel: "التقييمات حسب موضوعها",
    kind_product: "منتج",
    kind_store: "متجرك",
    chipKind: "الموضوع: {value}",
    source: "المصدر",
    sourceHint: "تقييم كتبه العميل، أو أضفته أنت، أو جاء مع استيراد.",
    rating: "التقييم",
    ratingLabel: "التقييمات حسب عدد النجوم",
    rating_high: "{a} و{b} نجوم",
    rating_mid: "{a} نجوم",
    rating_low: "نجمة ونجمتان",
    content: "المحتوى",
    contentLabel: "التقييمات حسب محتواها",
    withPhotos: "به صور",
    withComment: "به تعليق",
    chipSource: "المصدر: {value}",
    chipRating: "التقييم: {value}",
    show_zero: "لا توجد تقييمات بهذه الفلاتر",
    show_one: "عرض تقييم واحد",
    show_two: "عرض تقييمين",
    show_few: "عرض {n} تقييمات",
    show_other: "عرض {n} تقييمًا",
  },
} satisfies Messages;

export type RatingBand = "high" | "mid" | "low";
export type ContentFilter = "photos" | "comment";

const RATING_BANDS: readonly RatingBand[] = ["high", "mid", "low"];
/** The stars each band covers, written into its label through `fmt` so the digits follow the language. */
const BAND_STARS: Record<RatingBand, { a: number; b: number }> = { high: { a: 4, b: 5 }, mid: { a: 3, b: 3 }, low: { a: 1, b: 2 } };

/** What narrows the list besides the status chips and the search. `null` = that filter is off. */
export interface ReviewFilterState {
  kind: ReviewKind | null;
  source: ReviewSource | null;
  rating: RatingBand | null;
  content: ContentFilter | null;
}

export const NO_REVIEW_FILTERS: ReviewFilterState = { kind: null, source: null, rating: null, content: null };

export function isReviewKind(value: string | null): value is ReviewKind {
  return value === "product" || value === "store";
}

export function isReviewSource(value: string | null): value is ReviewSource {
  return value !== null && (REVIEW_SOURCES as readonly string[]).includes(value);
}

export function countReviewFilters(filters: ReviewFilterState): number {
  return (filters.kind ? 1 : 0) + (filters.source ? 1 : 0) + (filters.rating ? 1 : 0) + (filters.content ? 1 : 0);
}

function inBand(rating: number, band: RatingBand): boolean {
  if (band === "high") return rating >= 4;
  if (band === "mid") return rating === 3;
  return rating <= 2;
}

export function matchesReviewFilters(review: Review, filters: ReviewFilterState): boolean {
  if (filters.kind && kindOf(review) !== filters.kind) return false;
  if (filters.source && sourceOf(review) !== filters.source) return false;
  if (filters.rating && !inBand(review.rating, filters.rating)) return false;
  if (filters.content === "photos" && photosOf(review).length === 0) return false;
  if (filters.content === "comment" && !review.comment?.trim()) return false;
  return true;
}

/** The filters in effect as removable chips, for the row under the toolbar. */
export function useReviewFilterChips(filters: ReviewFilterState, onChange: (next: ReviewFilterState) => void): ActiveFilter[] {
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  const chips: ActiveFilter[] = [];
  if (filters.kind) {
    chips.push({ id: "kind", label: fmt(t.chipKind, { value: t[`kind_${filters.kind}`] }), onRemove: () => onChange({ ...filters, kind: null }) });
  }
  if (filters.source) {
    chips.push({
      id: "source",
      label: fmt(t.chipSource, { value: words[`source_${filters.source}`] }),
      onRemove: () => onChange({ ...filters, source: null }),
    });
  }
  if (filters.rating) {
    chips.push({
      id: "rating",
      label: fmt(t.chipRating, { value: fmt(t[`rating_${filters.rating}`], BAND_STARS[filters.rating]) }),
      onRemove: () => onChange({ ...filters, rating: null }),
    });
  }
  if (filters.content) {
    chips.push({
      id: "content",
      label: filters.content === "photos" ? t.withPhotos : t.withComment,
      onRemove: () => onChange({ ...filters, content: null }),
    });
  }
  return chips;
}

/**
 * The one place the reviews are filtered beyond their status: where a review
 * came from, how many stars it gave and whether it carries photos or words.
 * The list is read whole, so every choice answers at once behind the sheet.
 */
export function ReviewFilterSheet({
  open,
  onOpenChange,
  value,
  onChange,
  matching,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ReviewFilterState;
  onChange: (next: ReviewFilterState) => void;
  /** How many reviews the list shows now: said on the button that closes the sheet. */
  matching: number;
}) {
  const t = useT(STRINGS);
  const words = useT(REVIEW_WORDS);
  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      activeCount={countReviewFilters(value)}
      onReset={() => onChange(NO_REVIEW_FILTERS)}
      applyLabel={pluralOf(t, "show", matching)}
    >
      <FilterGroup label={t.kind}>
        <FilterChoice
          label={t.kindLabel}
          allowClear
          value={value.kind}
          onChange={(kind) => onChange({ ...value, kind })}
          options={(["product", "store"] as const).map((kind) => ({ value: kind, label: t[`kind_${kind}`] }))}
        />
      </FilterGroup>
      <FilterGroup label={t.source} hint={t.sourceHint}>
        <FilterChoice
          label={t.source}
          allowClear
          value={value.source}
          onChange={(source) => onChange({ ...value, source })}
          options={REVIEW_SOURCES.map((source) => ({ value: source, label: words[`source_${source}`] }))}
        />
      </FilterGroup>
      <FilterGroup label={t.rating}>
        <FilterChoice
          label={t.ratingLabel}
          allowClear
          value={value.rating}
          onChange={(rating) => onChange({ ...value, rating })}
          options={RATING_BANDS.map((band) => ({ value: band, label: fmt(t[`rating_${band}`], BAND_STARS[band]) }))}
        />
      </FilterGroup>
      <FilterGroup label={t.content}>
        <FilterChoice
          label={t.contentLabel}
          allowClear
          value={value.content}
          onChange={(content) => onChange({ ...value, content })}
          options={[
            { value: "photos", label: t.withPhotos },
            { value: "comment", label: t.withComment },
          ]}
        />
      </FilterGroup>
    </FilterSheet>
  );
}
