export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "pending_verification" | "active" | string;
  platformAdmin: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  /** The current user's role key in this workspace (e.g. "owner"), when known. */
  role?: string;
  status?: string;
  defaultCurrency?: string;
  ownerUserId: string;
  defaultLocale?: string;
  timezone?: string;
  settings?: Record<string, unknown>;
  logoUrl?: string | null;
  tagline?: string | null;
  themeSettings?: Record<string, unknown>;
  updatedAt?: string;
}

export interface Membership {
  id: string;
  workspaceId: string;
  role: string;
  status: "active" | "invited" | string;
}

export interface UpdateWorkspacePayload {
  name?: string;
  logoUrl?: string | null;
  tagline?: string | null;
  themeSettings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------
// Website templates + websites
// Templates are the public catalogue (GET /templates); websites are the
// per-workspace sites built from a template version
// (/workspaces/:workspaceId/websites).
// ---------------------------------------------------------------------

export interface WebsiteTemplateSummary {
  id: string;
  name: string;
  category: string | null;
  thumbnailUrl: string | null;
  templateVersionId: string;
}

export interface WebsiteTemplateDetail extends WebsiteTemplateSummary {
  isPublished: boolean;
  version: number;
  globalStyles: Record<string, unknown>;
  pages: Array<{
    path: string;
    title: string;
    pageType: string;
    builderData: unknown;
    seo: Record<string, unknown>;
  }>;
  sections: unknown[];
}

export interface Website {
  id: string;
  workspaceId: string;
  sourceTemplateVersionId: string | null;
  name: string;
  subdomain: string;
  status: "draft" | "published" | "suspended";
  globalStyles: Record<string, unknown>;
  seo: Record<string, unknown>;
  publishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebsitePage {
  id: string;
  workspaceId: string;
  websiteId: string;
  path: string;
  title: string;
  pageType: "home" | "product" | "collection" | "static" | "blog_post" | "cart" | "custom";
  draftData: unknown;
  publishedData: unknown | null;
  seo: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebsitePayload {
  name: string;
  subdomain?: string;
  templateVersionId?: string;
  globalStyles?: Record<string, unknown>;
  seo?: Record<string, unknown>;
}

// ---------------------------------------------------------------------
// Public storefront (GET /store/:workspaceId/...)
// Shapes mirror src/modules/storefront/storefrontService.js exactly.
// ---------------------------------------------------------------------

export interface StorefrontMeta {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  /** Opaque per-theme blob — the frontend owns its shape, backend just stores it. */
  themeSettings: Record<string, unknown>;
  currency: string;
}

export interface StorefrontVariant {
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  priceAmount: number; // integer minor units (piastres)
  compareAtAmount: number | null;
  currency: string;
  weightGrams: number | null;
  inStock: boolean;
}

export interface StorefrontOfferLine {
  variantId: string;
  quantity: number;
}

export interface StorefrontOffer {
  id: string;
  name: string;
  pricingMode: string;
  priceAmount: number;
  currency: string;
  badge: string | null;
  isDefault: boolean;
  lines: StorefrontOfferLine[];
}

export interface StorefrontProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productType: string;
  media: unknown;
  tags: string[];
  seo: Record<string, unknown> | null;
  variants: StorefrontVariant[];
  offers: StorefrontOffer[];
}

export interface StorefrontProductDetail extends StorefrontProduct {
  rating: number | null;
  reviews: unknown[];
}

export interface StorefrontProductList {
  products: StorefrontProduct[];
  nextCursor: string | null;
}

export interface StorefrontCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------
// Merchant Catalog (auth, /workspaces/:workspaceId/catalog/...)
// Shapes mirror src/modules/catalog/* and the DB models exactly.
// Money amounts (`*Amount`) are integer minor units (piastres) but arrive
// as strings because Postgres BIGINT serializes to string over JSON.
// ---------------------------------------------------------------------

export type ProductStatus = "draft" | "active" | "archived";
export type ProductType = "physical" | "digital" | "service";
export type CatalogEntityStatus = "active" | "archived";
export type OfferPricingMode = "fixed" | "computed";

export interface ProductOption {
  name: string;
  values: string[];
}

/**
 * One entry in a product's `media` array. This is exactly the object returned
 * by POST /workspaces/:workspaceId/media — the backend stores `media` as a
 * freeform JSONB array but the catalog schema requires each entry to be an
 * object (an array of bare URL strings is rejected). The frontend owns the
 * shape; the first entry is treated as the primary image.
 */
export interface ProductMedia {
  /** Absolute URL (APP_URL + path). */
  url: string;
  /** Host-relative path, e.g. "/uploads/<workspaceId>/<uuid>.png". */
  path: string;
  mimeType: string;
  size: number;
}

/** Response of POST /workspaces/:workspaceId/media (same shape as one media entry). */
export type MediaUploadResponse = ProductMedia;

export interface Variant {
  id: string;
  workspaceId: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  optionValues: Record<string, string>;
  priceAmount: string;
  compareAtAmount: string | null;
  costAmount: string | null;
  currency: string;
  stockOnHand: number;
  reservedStock: number;
  allowOverselling: boolean;
  weightGrams: number | null;
  dimensions: Record<string, unknown> | null;
  status: CatalogEntityStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfferLine {
  id?: string;
  offerId?: string;
  variantId: string;
  quantity: number;
}

export interface Offer {
  id: string;
  workspaceId: string;
  productId: string;
  name: string;
  pricingMode: OfferPricingMode;
  priceAmount: string | null;
  currency: string;
  badge: string | null;
  isDefault: boolean;
  shippingOverride: Record<string, unknown> | null;
  status: CatalogEntityStatus;
  lines: OfferLine[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionSummary {
  id: string;
  workspaceId?: string;
  name: string;
  slug: string;
  description: string | null;
  rules: Record<string, unknown> | null;
  seo: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  workspaceId: string;
  websiteId: string | null;
  /**
   * Server-assigned 9-digit code, distinct from the UUID `id` and shown to
   * merchants. Optional here so display code degrades gracefully if a response
   * predates the backend field.
   */
  productCode?: string;
  name: string;
  slug: string;
  description: string | null;
  productType: ProductType;
  status: ProductStatus;
  options: ProductOption[];
  media: ProductMedia[];
  tags: string[];
  seo: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Present on list + detail. */
  variants?: Variant[];
  offers?: Offer[];
  /** Present on detail only. */
  collections?: CollectionSummary[];
}

export interface CollectionProductRef {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
}

export interface CollectionDetail extends CollectionSummary {
  products: CollectionProductRef[];
}

export interface ProductListResponse {
  products: Product[];
  nextCursor: string | null;
}

export interface ProductListParams {
  status?: ProductStatus;
  collectionId?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateProductPayload {
  name: string;
  slug?: string;
  description?: string;
  productType?: ProductType;
  status?: ProductStatus;
  tags?: string[];
  options?: ProductOption[];
  media?: ProductMedia[];
  seo?: Record<string, unknown>;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface CreateVariantPayload {
  sku?: string | null;
  barcode?: string | null;
  optionValues?: Record<string, string>;
  priceAmount: number;
  compareAtAmount?: number | null;
  costAmount?: number | null;
  currency?: string;
  allowOverselling?: boolean;
  weightGrams?: number | null;
  /** Initial stock — only settable at creation; later changes go through inventory. */
  stockOnHand?: number;
}

export interface UpdateVariantPayload {
  sku?: string | null;
  barcode?: string | null;
  priceAmount?: number;
  compareAtAmount?: number | null;
  costAmount?: number | null;
  allowOverselling?: boolean;
  status?: CatalogEntityStatus;
}

export interface CreateOfferPayload {
  name: string;
  pricingMode?: OfferPricingMode;
  /** Required when pricingMode is "fixed". */
  priceAmount?: number;
  currency?: string;
  badge?: string | null;
  isDefault?: boolean;
  lines: OfferLine[];
}

export interface UpdateOfferPayload {
  name?: string;
  pricingMode?: OfferPricingMode;
  priceAmount?: number | null;
  currency?: string;
  badge?: string | null;
  isDefault?: boolean;
  status?: CatalogEntityStatus;
  /** Passing lines replaces the whole bundle composition. */
  lines?: OfferLine[];
}

export interface CreateCollectionPayload {
  name: string;
  slug?: string;
  description?: string;
  rules?: Record<string, unknown> | null;
  seo?: Record<string, unknown>;
}

export type UpdateCollectionPayload = Partial<CreateCollectionPayload>;

/** DELETE product/variant/offer — soft delete (archived). */
export interface ArchivedResponse {
  archived: true;
  id: string;
}

/** DELETE collection — hard delete. */
export interface DeletedResponse {
  deleted: true;
  id: string;
}

export interface SuccessResponse {
  success: true;
}

// ---------------------------------------------------------------------
// Orders (auth, /workspaces/:workspaceId/orders/...)
// ---------------------------------------------------------------------

export type ConfirmationState = "pending" | "confirmed" | "rejected" | "unreachable" | "postponed";
export type FinancialState =
  | "pending"
  | "partially_paid"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";
export type FulfillmentState = "unfulfilled" | "partially_fulfilled" | "fulfilled" | "returned";
export type PaymentMethod = "cod" | "card" | "wallet" | "bank_transfer";

export interface OrderContactSnapshot {
  fullName?: string;
  phone?: string;
  alternatePhone?: string | null;
  email?: string | null;
}

export interface OrderAddressSnapshot {
  country?: string;
  province?: string | null;
  city?: string;
  addressLine?: string;
  postalCode?: string | null;
  notes?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  offerId: string | null;
  productNameSnapshot: string;
  variantOptionsSnapshot: Record<string, string> | null;
  skuSnapshot: string | null;
  offerNameSnapshot: string | null;
  quantity: number;
  unitPriceAmount: string;
  unitCostAmount: string | null;
  lineDiscountAmount: string;
  lineTotalAmount: string;
  isOrderBump: boolean;
  isUpsell: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | "initialized"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "partially_refunded";

export interface Payment {
  id: string;
  orderId: string;
  workspaceId: string;
  providerCode: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  providerReference: string | null;
  maskedDisplay: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentStatus =
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled";

export interface Shipment {
  id: string;
  orderId: string;
  workspaceId: string;
  trackingCode: string;
  carrierCode: string;
  waybillNumber: string | null;
  status: ShipmentStatus;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded";
export type ReturnReasonCode =
  | "damaged"
  | "defective"
  | "wrong_item"
  | "not_as_described"
  | "no_longer_wanted"
  | "arrived_late"
  | "other";

export interface ReturnItemLine {
  orderItemId: string;
  quantity: number;
}

export interface ReturnRequest {
  id: string;
  workspaceId: string;
  orderId: string;
  reason: string;
  status: ReturnStatus;
  items: ReturnItemLine[];
  restockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  workspaceId: string;
  websiteId: string | null;
  funnelId: string | null;
  customerId: string;
  orderNumber: string;
  confirmationState: ConfirmationState;
  financialState: FinancialState;
  fulfillmentState: FulfillmentState;
  paymentMethod: PaymentMethod;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountRefunded: string;
  contactSnapshot: OrderContactSnapshot;
  shippingAddressSnapshot: OrderAddressSnapshot | null;
  discountsSnapshot: Array<Record<string, unknown>>;
  notes: string | null;
  riskFlags: string[];
  cancelledAt: string | null;
  cancellationReason: string | null;
  linkedFromOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  /** Present on detail (GET one) only. */
  payments?: Payment[];
  shipments?: Shipment[];
}

export interface OrderListResponse {
  orders: Order[];
  nextCursor: string | null;
}

export interface OrderListParams {
  limit?: number;
  cursor?: string;
  confirmationState?: ConfirmationState;
  financialState?: FinancialState;
  fulfillmentState?: FulfillmentState;
}

export interface OrderAddressInput {
  country: string;
  province?: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  notes?: string;
}

export interface CreateOrderItemInput {
  variantId: string;
  offerId?: string;
  quantity: number;
}

export interface CreateOrderPayload {
  items: CreateOrderItemInput[];
  contact: { fullName: string; phone: string; alternatePhone?: string; email?: string };
  shippingAddress?: OrderAddressInput;
  paymentMethod: PaymentMethod;
  discountCode?: string;
  notes?: string;
}

export interface UpdateOrderPayload {
  shippingAddress?: OrderAddressInput;
  notes?: string;
}

export interface CreateShipmentPayload {
  carrierCode: string;
  waybillNumber?: string;
  trackingUrl?: string;
}

export interface UpdateShipmentPayload {
  status?: ShipmentStatus;
  waybillNumber?: string;
  trackingUrl?: string;
}

export interface CreateReturnPayload {
  reasonCode: ReturnReasonCode;
  reasonDetail?: string;
  items: ReturnItemLine[];
}

export interface ReturnListParams {
  status?: ReturnStatus;
}
