import type { CatalogReviewExtras, Review, ReviewExternalSource, ReviewKind, ReviewPurchaseState, ReviewStatus } from "@store-builder/api-client";
import { fmt, type Messages } from "@/i18n/LocaleContext";

/**
 * What the Reviews page knows about a review beyond the row the API types:
 * where it came from, who wrote it, its photos — and the words every piece of
 * the page says the same way (the status, the two moves, the source).
 */

/** A staff review row with the fields reviews added by the store carry. */
export type ReviewRecord = Review & CatalogReviewExtras;
/** external = brought by the merchant from another site; manual and import = added by hand before reviews had a source. */
export type ReviewSource = "customer" | "manual" | "import" | "external";
/**
 * Where a review comes from, as the filter groups it: a customer's own, one
 * brought from another site, or one added by hand before sources existed
 * (typed in or imported).
 */
export type ReviewOrigin = "customer" | "external" | "added";
/** The moves the API has: approve shows a review with its words, approve_stars shows its stars alone, reject (hide) keeps it out. */
export type ModerateAction = "approve" | "approve_stars" | "reject";

export const REVIEW_STATUSES: readonly ReviewStatus[] = ["pending", "approved", "rejected"];
export const REVIEW_ORIGINS: readonly ReviewOrigin[] = ["customer", "external", "added"];
/** The sites a review can be brought from, in the order the form offers them. */
export const EXTERNAL_SOURCES: readonly ReviewExternalSource[] = ["facebook", "google", "instagram", "whatsapp", "other"];

export function sourceOf(review: Review): ReviewSource {
  return (review as ReviewRecord).source ?? "customer";
}

export function originOf(review: Review): ReviewOrigin {
  const source = sourceOf(review);
  return source === "customer" || source === "external" ? source : "added";
}

/** Added by the store — typed in, imported or brought from another site: named by hand, editable, deletable, never "verified". */
export function isMerchantAdded(review: Review): boolean {
  return sourceOf(review) !== "customer";
}

/** Brought from another site: shown apart in the store, with its source, never in the stars. */
export function isExternal(review: Review): boolean {
  return sourceOf(review) === "external";
}

/** Added by hand before reviews had a source: editing it can give it one. */
export function isLegacyAdded(review: Review): boolean {
  return originOf(review) === "added";
}

/** The day it was written on the other site (YYYY-MM-DD), or null. */
export function writtenOnOf(review: Review): string | null {
  const day = review.reviewedAt?.slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** The link to the review on the other site — http(s) only, so nothing else ever lands in an href. */
export function externalLinkOf(review: Review): string | null {
  const raw = review.externalUrl?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
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
    from_facebook: "From Facebook",
    from_google: "From Google",
    from_instagram: "From Instagram",
    from_whatsapp: "From WhatsApp",
    from_other: "From {name}",
    from_otherUnnamed: "From another site",
    writtenOn: "Written {date}",
    original: "Original review",
    originalLabel: "Open the original review — opens in a new tab",
    edit: "Edit",
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
    from_facebook: "من فيسبوك",
    from_google: "من جوجل",
    from_instagram: "من إنستجرام",
    from_whatsapp: "من واتساب",
    from_other: "من {name}",
    from_otherUnnamed: "من موقع آخر",
    writtenOn: "كُتب في {date}",
    original: "التقييم الأصلي",
    originalLabel: "فتح التقييم الأصلي — يُفتح في تبويب جديد",
    edit: "تعديل",
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

/** What a source badge says: «من فيسبوك», «من <the name the merchant typed>», «أضفته أنت»; null for a customer's own review. */
export function sourceText(review: Review, words: ReviewWords): string | null {
  const source = sourceOf(review);
  if (source === "customer") return null;
  if (source === "manual") return words.source_manual;
  if (source === "import") return words.source_import;
  const site = review.externalSource;
  if (site === "other" || !site) {
    const name = site === "other" ? review.externalSourceLabel?.trim() : "";
    return name ? fmt(words.from_other, { name }) : words.from_otherUnnamed;
  }
  return words[`from_${site}`];
}

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
