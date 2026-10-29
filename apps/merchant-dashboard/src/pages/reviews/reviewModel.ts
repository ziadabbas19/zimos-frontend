import type { CatalogReviewExtras, Review, ReviewKind, ReviewPurchaseState, ReviewStatus } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * What the Reviews page knows about a review beyond the row the API types:
 * where it came from, who wrote it, its photos — and the words every piece of
 * the page says the same way (the status, the two moves, the source).
 */

/** A staff review row with the fields reviews added by the store carry. */
export type ReviewRecord = Review & CatalogReviewExtras;
export type ReviewSource = "customer" | "manual" | "import";
/** The moves the API has: approve shows a review with its words, approve_stars shows its stars alone, reject (hide) keeps it out. */
export type ModerateAction = "approve" | "approve_stars" | "reject";

export const REVIEW_STATUSES: readonly ReviewStatus[] = ["pending", "approved", "rejected"];
export const REVIEW_SOURCES: readonly ReviewSource[] = ["customer", "manual", "import"];

export function sourceOf(review: Review): ReviewSource {
  return (review as ReviewRecord).source ?? "customer";
}

/** Added by the store — typed in or imported: named by hand, deletable, never "verified". */
export function isMerchantAdded(review: Review): boolean {
  return sourceOf(review) !== "customer";
}

export function photosOf(review: Review): string[] {
  return (review as ReviewRecord).photos ?? [];
}

/** Who wrote it: the typed name for a review the store added; the reviewer's own name, else their customer's. */
export function reviewAuthor(review: Review, fallback: string): string {
  const row = review as ReviewRecord;
  return (isMerchantAdded(review) ? row.authorName : row.authorName || review.customer?.fullName) || fallback;
}

export function kindOf(review: Review): ReviewKind {
  return review.kind ?? "product";
}

/** Published with its stars alone: the words and photos stay here. */
export function isStarsOnly(review: Review): boolean {
  return review.status === "approved" && review.showText === false;
}

/** Where the reviewer's order stands; null for a review the store added (no order to speak of). */
export function purchaseOf(review: Review): ReviewPurchaseState | null {
  if (isMerchantAdded(review)) return null;
  return review.purchase?.state ?? null;
}

/** Where a move lands. */
export function statusAfter(action: ModerateAction): ReviewStatus {
  return action === "reject" ? "rejected" : "approved";
}

/** The move that takes a review to `status`; a waiting review has none (the API cannot put one back in the queue). */
export function actionTo(status: ReviewStatus): ModerateAction | null {
  return status === "approved" ? "approve" : status === "rejected" ? "reject" : null;
}

/** Lower case, and Arabic-Indic digits as Latin ones, so a search does not care how a number was typed. */
export function fold(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export const REVIEW_WORDS = {
  en: {
    status_pending: "Waiting for you",
    status_approved: "In the store",
    status_rejected: "Hidden",
    status_stars: "Stars only",
    approve: "Approve",
    approveStars: "Publish the stars only",
    storeReview: "Your store",
    purchase_delivered: "Bought — delivered",
    purchase_ordered: "Ordered — not delivered yet",
    purchase_cancelled: "Ordered — cancelled",
    purchase_returned: "Ordered — returned",
    purchase_none: "Did not buy",
    counted: "Counts in your stars",
    hide: "Hide",
    show: "Show",
    remove: "Delete",
    source_customer: "From a customer",
    source_manual: "Added by you",
    source_import: "Imported",
    unknownProduct: "Deleted product",
    unknownCustomer: "Unnamed customer",
    noComment: "Rated without a comment.",
    ratingOf: "{n} out of {max}",
    photos_one: "1 photo",
    photos_other: "{n} photos",
  },
  ar: {
    status_pending: "ينتظر موافقتك",
    status_approved: "ظاهر في المتجر",
    status_rejected: "مخفي",
    status_stars: "النجوم فقط",
    approve: "موافقة",
    approveStars: "نشر النجوم فقط",
    storeReview: "متجرك",
    purchase_delivered: "اشترى — تم التسليم",
    purchase_ordered: "طلب ولم يصله بعد",
    purchase_cancelled: "طلب ثم أُلغي",
    purchase_returned: "طلب ثم أرجعه",
    purchase_none: "لم يشترِ",
    counted: "يدخل في متوسط نجومك",
    hide: "إخفاء",
    show: "إظهار",
    remove: "حذف",
    source_customer: "من عميل",
    source_manual: "أضفته أنت",
    source_import: "مستورد",
    unknownProduct: "منتج محذوف",
    unknownCustomer: "عميل بدون اسم",
    noComment: "قيّم بدون تعليق.",
    ratingOf: "{n} من {max}",
    photos_one: "صورة واحدة",
    photos_two: "صورتان",
    photos_few: "{n} صور",
    photos_other: "{n} صورة",
  },
} satisfies Messages;

/** The top of the scale: a review is one to five stars. */
export const MAX_RATING = 5;

export type ReviewWords = Record<keyof (typeof REVIEW_WORDS)["en"], string>;

/** The badge tone of a status: waiting asks for attention, live is good news, hidden is quiet. */
/** The tone of the purchase fact: a delivered order is the good kind, the rest are said quietly. */
export const PURCHASE_TONE: Record<ReviewPurchaseState, "success" | "warning" | "neutral"> = {
  delivered: "success",
  ordered: "warning",
  cancelled: "neutral",
  returned: "neutral",
  none: "neutral",
};

export const REVIEW_STATUS_TONE: Record<ReviewStatus, "warning" | "success" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "neutral",
};
