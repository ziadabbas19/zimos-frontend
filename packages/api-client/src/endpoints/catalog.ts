/**
 * Catalog additions (backend: src/modules/catalog/productPage.js and
 * the catalog routes): the product's display priority, special-offer line,
 * external references, option display types, product page settings and
 * structured content (features, testimonials, FAQs).
 *
 * The fields ride on the existing product endpoints
 * (/workspaces/:workspaceId/catalog/products/:productId, products.manage) and
 * on the public product (/store/:workspaceId/products/:idOrSlug). All exported
 * names here start with `catalog` / `Catalog`, or name a product-page type.
 *
 * `pageSettings` keeps the backend's snake_case keys. The server stores only
 * what was sent and fills the rest with defaults on the public product, so a
 * PATCH should send the whole object.
 */
import type { ApiClient } from "../client";
import type { Product, ProductStatus, StorefrontProduct } from "../types";

// ------------------------------------------------------------------ types --

export type ProductOptionDisplayType = "buttons" | "dropdown" | "color" | "image";

export const PRODUCT_OPTION_DISPLAY_TYPES: ProductOptionDisplayType[] = ["buttons", "dropdown", "color", "image"];

export interface ProductOptionDisplay {
  name: string;
  values?: string[];
  displayType?: ProductOptionDisplayType;
  /** value → `#rrggbb`, for displayType "color". */
  swatches?: Record<string, string>;
  /** value → image URL, for displayType "image". */
  images?: Record<string, string>;
}

export interface ProductPageSettings {
  /** The first in-stock variant starts chosen; false: the shopper picks every option first. */
  auto_select_variant: boolean;
  /** "Buy now" goes straight to the checkout instead of the cart. */
  skip_cart: boolean;
  buy_now_text: string | null;
  sticky_buy_button: boolean;
  /** The order form inside the product page. */
  inline_checkout: boolean;
  checkout_before_description: boolean;
  reviews_enabled: boolean;
  hide_header: boolean;
  hide_quantity_selector: boolean;
  /** Left out of every listing; opens by its link only. */
  hidden: boolean;
  hide_related_products: boolean;
  landing_page_id: string | null;
  /** A real deadline: after it the server sells at the compare-at price. */
  countdown: { ends_at: string } | null;
}

export const PRODUCT_PAGE_SETTINGS_DEFAULTS: ProductPageSettings = {
  auto_select_variant: true,
  skip_cart: false,
  buy_now_text: null,
  sticky_buy_button: true,
  inline_checkout: true,
  checkout_before_description: true,
  reviews_enabled: true,
  hide_header: false,
  hide_quantity_selector: false,
  hidden: false,
  hide_related_products: false,
  landing_page_id: null,
  countdown: null,
};

export interface ProductCmsFeature {
  title: string;
  description?: string;
  image?: string | null;
}

export interface ProductCmsTestimonial {
  name: string;
  text: string;
  image?: string | null;
  rating?: number | null;
}

export interface ProductCmsFaq {
  question: string;
  answer: string;
}

export interface ProductCms {
  features: ProductCmsFeature[];
  testimonials: ProductCmsTestimonial[];
  faqs: ProductCmsFaq[];
}

export interface ProductExternalRef {
  platform: string;
  code: string;
}

/** What added to the staff product. Absent on a response from before the fields. */
export interface CatalogProductExtras {
  priority?: number;
  specialOfferText?: string | null;
  externalRefs?: ProductExternalRef[];
  pageSettings?: Partial<ProductPageSettings>;
  cms?: Partial<ProductCms>;
}

export type CatalogProduct = Omit<Product, "options"> & CatalogProductExtras & { options: ProductOptionDisplay[] };

export interface CatalogProductPatch extends CatalogProductExtras {
  options?: ProductOptionDisplay[];
}

/** The public product with the page fields the storefront draws from. */
export interface StorefrontProductPage {
  options: ProductOptionDisplay[];
  priority: number;
  specialOfferText: string | null;
  shippingMode: string;
  pageSettings: ProductPageSettings;
  cms: ProductCms;
}

// ---------------------------------------------------------------- helpers --

export function resolveProductPageSettings(stored: Partial<ProductPageSettings> | null | undefined): ProductPageSettings {
  const out = { ...PRODUCT_PAGE_SETTINGS_DEFAULTS };
  if (!stored) return out;
  for (const key of Object.keys(out) as (keyof ProductPageSettings)[]) {
    const value = stored[key];
    if (value !== undefined && value !== "") (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function resolveProductCms(stored: Partial<ProductCms> | null | undefined): ProductCms {
  return {
    features: Array.isArray(stored?.features) ? stored.features : [],
    testimonials: Array.isArray(stored?.testimonials) ? stored.testimonials : [],
    faqs: Array.isArray(stored?.faqs) ? stored.faqs : [],
  };
}

/** Reads the page fields off a public product, with defaults for an older response. */
export function storefrontProductPage(product: StorefrontProduct): StorefrontProductPage {
  const raw = product as StorefrontProduct & Partial<StorefrontProductPage>;
  return {
    options: Array.isArray(raw.options) ? raw.options : [],
    priority: raw.priority ?? 0,
    specialOfferText: raw.specialOfferText ?? null,
    shippingMode: raw.shippingMode ?? "standard",
    pageSettings: resolveProductPageSettings(raw.pageSettings),
    cms: resolveProductCms(raw.cms),
  };
}

// -------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/catalog`;

export async function catalogGetProduct(client: ApiClient, workspaceId: string, productId: string): Promise<CatalogProduct> {
  const { product } = await client.request<{ product: CatalogProduct }>(`${base(workspaceId)}/products/${productId}`);
  return product;
}

export async function catalogUpdateProduct(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  patch: CatalogProductPatch
): Promise<CatalogProduct> {
  const { product } = await client.request<{ product: CatalogProduct }>(`${base(workspaceId)}/products/${productId}`, {
    method: "PATCH",
    body: patch,
  });
  return product;
}

// ------------------------------------------------- bulk edit and duplicate --

export type CatalogBulkPrice =
  | { mode: "set"; value: number }
  | { mode: "increase_percent" | "decrease_percent"; value: number };

export interface CatalogBulkChanges {
  status?: "draft" | "active" | "archived";
  /** "extra_fee" needs an amount per product, so it is not a bulk choice. */
  shippingMode?: "standard" | "free";
  collection?: { id: string; action: "add" | "remove" };
  /** Applied to every active variant of the selected products (minor units for "set"). */
  price?: CatalogBulkPrice;
}

export interface CatalogBulkResult {
  updated: number;
  variantsRepriced: number;
}

/** One row of the variant table: the variant and only the fields that changed. */
export interface CatalogVariantRowPatch {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  priceAmount?: number;
  compareAtAmount?: number | null;
  costAmount?: number | null;
  /** The count on hand; the server records the difference as an adjustment. */
  stockOnHand?: number;
  allowOverselling?: boolean;
  status?: "active" | "archived";
}

/** 422 PRODUCT_NOT_FOUND when an id is not in this store — nothing is changed then. */
export async function catalogBulkEditProducts(
  client: ApiClient,
  workspaceId: string,
  productIds: string[],
  changes: CatalogBulkChanges
): Promise<CatalogBulkResult> {
  return client.request<CatalogBulkResult>(`${base(workspaceId)}/products/bulk`, {
    method: "POST",
    body: { productIds, changes },
  });
}

/** A draft copy with the variants (no stock, no SKU), offers and collections. */
export async function catalogDuplicateProduct(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  name?: string
): Promise<CatalogProduct> {
  const { product } = await client.request<{ product: CatalogProduct }>(
    `${base(workspaceId)}/products/${productId}/duplicate`,
    { method: "POST", body: name ? { name } : {} }
  );
  return product;
}

/** 409 DUPLICATE_RESOURCE when a SKU is already used by another variant. */
export async function catalogBulkUpdateVariants(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  variants: CatalogVariantRowPatch[]
): Promise<{ updated: number }> {
  return client.request<{ updated: number }>(`${base(workspaceId)}/products/${productId}/variants/bulk`, {
    method: "PATCH",
    body: { variants },
  });
}

// ----------------------------------------------------------------- reviews --

/** An approved review as the storefront shows it. */
export interface StorefrontReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** The reviewer's first name only. */
  authorName: string | null;
  photos: string[];
  /** True when the reviewer's order of this store was delivered (the reviews that move the stars). */
  verified: boolean;
}

export interface StorefrontRatingSummary {
  average: number | null;
  count: number;
  /** How many counted reviews gave each number of stars, keys "1".."5". */
  distribution: Record<string, number>;
}

/** Reads the review block off a public product, tolerating an older response. */
export function storefrontProductReviews(product: unknown): { rating: StorefrontRatingSummary; reviews: StorefrontReview[] } {
  const raw = (product ?? {}) as { rating?: Partial<StorefrontRatingSummary> | number | null; reviews?: unknown };
  const rating = raw.rating && typeof raw.rating === "object" ? raw.rating : {};
  const reviews = Array.isArray(raw.reviews) ? (raw.reviews as Partial<StorefrontReview>[]) : [];
  return {
    rating: { average: rating.average ?? null, count: rating.count ?? 0, distribution: rating.distribution ?? {} },
    reviews: reviews.map((r, i) => ({
      id: r.id ?? String(i),
      rating: r.rating ?? 0,
      comment: r.comment ?? null,
      createdAt: r.createdAt ?? "",
      authorName: r.authorName ?? null,
      photos: Array.isArray(r.photos) ? r.photos : [],
      verified: r.verified ?? false,
    })),
  };
}

/** Kept for older imports: sending a review is storefrontSendProductReview (endpoints/reviews.ts). */
export type { StorefrontReviewInput as StorefrontReviewSubmission } from "./reviews";

export interface ManualReviewPayload {
  productId: string;
  authorName: string;
  rating: number;
  comment?: string | null;
  photos?: string[];
  status?: "approved" | "pending";
}

/** A staff review row with the fields manual reviews added. */
export interface CatalogReviewExtras {
  authorName?: string | null;
  photos?: string[];
  source?: "customer" | "manual" | "import";
}

/** Adds a real review that reached the merchant through another channel (products.manage). */
export async function catalogCreateManualReview<T = unknown>(
  client: ApiClient,
  workspaceId: string,
  payload: ManualReviewPayload
): Promise<T> {
  const { review } = await client.request<{ review: T }>(`/workspaces/${workspaceId}/reviews`, {
    method: "POST",
    body: payload,
  });
  return review;
}

/** Deletes any review: one added by hand or a shopper's (reviewsDelete is the same call). */
export async function catalogDeleteManualReview(client: ApiClient, workspaceId: string, reviewId: string): Promise<void> {
  await client.request(`/workspaces/${workspaceId}/reviews/${reviewId}`, { method: "DELETE" });
}

// ------------------------------------------------------- import and export --

export type CatalogImportKind = "json" | "sheet" | "shopify_link";
export type CatalogImportStatus = "queued" | "running" | "done" | "failed";

export interface CatalogImportError {
  /** Line in the sheet (or position in the JSON file); null for a general failure. */
  row: number | null;
  name: string;
  message: string;
}

export interface CatalogImport {
  id: string;
  kind: CatalogImportKind;
  status: CatalogImportStatus;
  sourceName: string | null;
  total: number;
  createdCount: number;
  failedCount: number;
  errors: CatalogImportError[];
  createdAt: string;
  finishedAt: string | null;
}

/**
 * `ApiClient.rawFetch` (token, refresh, ApiError) is what multipart uploads and
 * non-JSON downloads go through; it is private to the class, and this module
 * may not edit client.ts, so it is reached through this one typed cast.
 */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

/** Every product that is not archived, as the JSON document the import accepts. */
export async function catalogExportProducts(client: ApiClient, workspaceId: string): Promise<Blob> {
  const document = await client.request<unknown>(`${base(workspaceId)}/products/export.json`);
  return new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
}

/** The sheet's columns with two example rows (CSV, opens in Excel). */
export async function catalogImportTemplate(client: ApiClient, workspaceId: string): Promise<Blob> {
  const res = await rawFetch(client, `${base(workspaceId)}/products/import-template.csv`, { headers: { Accept: "text/csv" } });
  return res.blob();
}

/** `signal` gives up on the request (a timeout, or the dialog closed). */
export interface CatalogRequestOptions {
  signal?: AbortSignal;
}

/**
 * Starts an import from a file: .json (a ZIMOS export), .csv or .xlsx. 422
 * VALIDATION_ERROR when the file cannot be read at all; otherwise the import
 * runs in the background — poll catalogGetImport for its report.
 */
export async function catalogImportFile(
  client: ApiClient,
  workspaceId: string,
  file: File,
  opts: CatalogRequestOptions = {}
): Promise<CatalogImport> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await rawFetch(client, `${base(workspaceId)}/products/import`, { method: "POST", body: form, signal: opts.signal });
  const body = (await res.json()) as { import: CatalogImport };
  return body.import;
}

/** Starts an import of one product from its Shopify page link. 422 IMPORT_SOURCE_UNREACHABLE when it cannot be read. */
export async function catalogImportFromLink(
  client: ApiClient,
  workspaceId: string,
  url: string,
  opts: CatalogRequestOptions = {}
): Promise<CatalogImport> {
  const body = await client.request<{ import: CatalogImport }>(`${base(workspaceId)}/products/import`, {
    method: "POST",
    body: { url },
    signal: opts.signal,
  });
  return body.import;
}

export async function catalogGetImport(
  client: ApiClient,
  workspaceId: string,
  importId: string,
  opts: CatalogRequestOptions = {}
): Promise<CatalogImport> {
  const body = await client.request<{ import: CatalogImport }>(`${base(workspaceId)}/imports/${importId}`, {
    signal: opts.signal,
  });
  return body.import;
}

/** The last twenty imports, newest first. */
export async function catalogListImports(client: ApiClient, workspaceId: string): Promise<CatalogImport[]> {
  const body = await client.request<{ imports: CatalogImport[] }>(`${base(workspaceId)}/imports`);
  return body.imports;
}

// ------------------------------------------------------------- bulk delete --

/** The product list's filters, as GET /products, the count and the bulk delete take them. */
export interface CatalogProductFilters {
  status?: ProductStatus | ProductStatus[];
  collectionId?: string;
  q?: string;
  sku?: string;
  productType?: string;
  stock?: string;
}

function filterQuery(filters: CatalogProductFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const text = Array.isArray(value) ? value.join(",") : value;
    if (text) query.set(key, String(text));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/**
 * How many products the list's filters match across every page, and `asOf`,
 * the moment they were counted: send it back as `filter.createdBefore` to
 * delete all of them without taking a product added since.
 */
export async function catalogCountProducts(
  client: ApiClient,
  workspaceId: string,
  filters: CatalogProductFilters = {}
): Promise<{ count: number; asOf: string }> {
  return client.request<{ count: number; asOf: string }>(`${base(workspaceId)}/products/count${filterQuery(filters)}`);
}

export type CatalogBulkDeleteMode = "archive" | "permanent";
export type CatalogBulkDeleteSkipReason = "has_orders" | "in_funnel" | "not_found" | "already_archived";

export interface CatalogBulkDeleteSkip {
  id: string;
  /** null for a product that is not in this store (any more). */
  name: string | null;
  reason: CatalogBulkDeleteSkipReason;
  /** in_funnel: the funnels that sell it. */
  funnelIds?: string[];
}

export interface CatalogBulkDeleteResult {
  mode: CatalogBulkDeleteMode;
  /** Archived (mode archive) or removed for good (mode permanent). */
  deleted: number;
  skipped: CatalogBulkDeleteSkip[];
  /** Send it back as `cursor` for the next chunk of a filter; null after the last. */
  nextCursor: string | null;
}

export type CatalogBulkDeleteRequest =
  | { mode: CatalogBulkDeleteMode; productIds: string[] }
  | { mode: CatalogBulkDeleteMode; filter: CatalogProductFilters & { createdBefore: string }; cursor?: string };

/** The most product ids one bulk-delete request takes, and the size of a filter's chunk. */
export const CATALOG_BULK_DELETE_CHUNK = 100;

/**
 * Archives or deletes for good one chunk of products, by the single delete's
 * rules: a product with orders, or sold in a funnel, is skipped with the
 * reason. 429 when sent faster than 30 a minute: wait `retryAfter`, send again.
 */
export async function catalogBulkDeleteProducts(
  client: ApiClient,
  workspaceId: string,
  body: CatalogBulkDeleteRequest,
  opts: CatalogRequestOptions = {}
): Promise<CatalogBulkDeleteResult> {
  return client.request<CatalogBulkDeleteResult>(`${base(workspaceId)}/products/bulk-delete`, {
    method: "POST",
    body,
    signal: opts.signal,
  });
}

// ------------------------------------------------------------- collections --

/** Where a collection shows up in the store; sent with the collection create/update body. */
export interface CatalogCollectionFlags {
  showInHeader: boolean;
  /** Left out of every public list; its own link still opens. */
  hidden: boolean;
}

/** Reads the flags off a staff collection, false on a response from before them. */
export function catalogCollectionFlags(collection: unknown): CatalogCollectionFlags {
  const raw = (collection ?? {}) as Partial<CatalogCollectionFlags>;
  return { showInHeader: Boolean(raw.showInHeader), hidden: Boolean(raw.hidden) };
}

export interface StorefrontHeaderCollection {
  id: string;
  name: string;
  slug: string;
}

/** The collections the merchant put in the header menu, read off the public store. */
export function storefrontHeaderCollections(store: unknown): StorefrontHeaderCollection[] {
  const list = (store as { headerCollections?: unknown } | null)?.headerCollections;
  return Array.isArray(list) ? (list as StorefrontHeaderCollection[]) : [];
}
