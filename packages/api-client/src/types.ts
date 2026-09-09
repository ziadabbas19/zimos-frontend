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

/**
 * Merchant-tunable knobs stored in the workspace's `settings` JSONB blob and
 * read/written through `PATCH /workspaces/:id`. Amounts are integer minor
 * currency units (piastres/cents). The backend merges only the keys it knows
 * (see below) and leaves anything else in the blob untouched, hence the open
 * index signature.
 */
export interface WorkspaceSettings {
  /** Order subtotal at/above which shipping is free. `null`/absent = disabled. */
  free_shipping_threshold_amount?: number | null;
  /** Fallback shipping charge when no active zone/rate matches. `null`/absent = free. */
  default_shipping_rate_amount?: number | null;
  /** Whether tax rates are applied at checkout. Defaults to false. */
  tax_enabled?: boolean;
  [key: string]: unknown;
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
  settings?: WorkspaceSettings;
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
  /**
   * Partial merge into the workspace's `settings` JSONB. Only these keys are
   * honoured. Send a key as `null` to clear it back to "not configured";
   * omitting a key leaves its stored value untouched — that is NOT the same as
   * sending 0. Amounts are integer minor currency units.
   */
  settings?: {
    free_shipping_threshold_amount?: number | null;
    default_shipping_rate_amount?: number | null;
    tax_enabled?: boolean;
  };
}

// ---------------------------------------------------------------------
// Workspace team — members, invites, roles
// (auth, /workspaces/:workspaceId/members | /invites | /roles)
// A membership is "active" once the invited person has joined; until then
// it is "invited" and carries no linked `user`. Roles are the assignable
// permission sets — the `isSystem` ones (owner/admin/…) ship with every
// workspace and can't be edited.
// ---------------------------------------------------------------------

export interface WorkspaceMemberUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
}

export interface WorkspaceMemberRole {
  id: string;
  key: string;
  name: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  status: "active" | "invited";
  user: WorkspaceMemberUser | null;
  role: WorkspaceMemberRole;
}

/**
 * A still-pending invitation. Same row as a member minus the `user` link
 * (the invitee has no account attached yet), plus the address it was sent
 * to so the list can identify it.
 */
export interface WorkspaceInvite extends Omit<WorkspaceMember, "user"> {
  invitedEmail: string | null;
}

export interface WorkspaceRole {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

export interface InviteMemberPayload {
  email: string;
  roleId: string;
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

/**
 * Page content is a strict 4-level tree, not raw HTML — the backend validates
 * every write against it (modules/pages/pageTree.js) and rejects anything else:
 *
 *   PageTree -> sections[] -> rows[] -> columns[] -> elements[]
 *
 * Only `elements` carry a meaningful `type`; sections/rows/columns are pure
 * containers whose `type` is always the literal "section"/"row"/"column".
 */
export const PAGE_ELEMENT_TYPES = [
  "heading",
  "text",
  "rich_text",
  "image",
  "gallery",
  "button",
  "video",
  "embed",
  "spacer",
  "divider",
  "icon",
  "list",
  "accordion",
  "faq",
  "testimonial",
  "countdown",
  "form",
  "map",
  "social_icons",
  "product_card",
  "product_list",
  "collection_list",
  "cart",
] as const;

/** The backend's ALLOWED_ELEMENT_TYPES allowlist — anything else is a 422. */
export type PageElementType = (typeof PAGE_ELEMENT_TYPES)[number];

export interface PageElement {
  id: string;
  type: PageElementType;
  props?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface PageColumn {
  id: string;
  type: "column";
  /** 1-12; the backend caps it at 12. */
  span?: number;
  elements: PageElement[];
}

export interface PageRow {
  id: string;
  type: "row";
  columns: PageColumn[];
}

export interface PageSection {
  id: string;
  type: "section";
  rows: PageRow[];
}

export interface PageTree {
  version?: number;
  globalStyles?: Record<string, unknown>;
  sections: PageSection[];
}

export interface WebsitePage {
  id: string;
  workspaceId: string;
  websiteId: string;
  path: string;
  title: string;
  pageType: "home" | "product" | "collection" | "static" | "blog_post" | "cart" | "custom";
  draftData: PageTree | null;
  publishedData: PageTree | null;
  seo: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Present on list/get/update responses: true once the page has been published. */
  isLive?: boolean;
}

/** GET /workspaces/:workspaceId/websites/:websiteId */
export interface WebsiteDetail {
  website: Website;
  pages: WebsitePage[];
  publishedRevision: {
    id: string;
    revisionNumber: number;
    note: string | null;
    createdAt: string;
  } | null;
}

/** PATCH body for a page. `.min(1)` server-side — send at least one key. */
export interface UpdateWebsitePagePayload {
  path?: string;
  title?: string;
  pageType?: WebsitePage["pageType"];
  draftData?: PageTree;
  seo?: Record<string, unknown>;
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
// Storefront cart + guest checkout (POST /store/:workspaceId/cart/...,
// POST /store/:workspaceId/checkout — all no-auth). Cart identity travels
// in the X-Cart-Token header, always workspace-scoped: a token from one
// workspace resolves to nothing in another. Line/cart totals are recomputed
// from live catalog prices on every read; `unitPriceSnapshot` is kept only
// so the UI can flag "price changed since you added this". Snapshot and
// current prices are integer minor units serialized as strings (Postgres
// BIGINT over JSON); the computed `lineTotal`/`subtotal` come back as numbers.
// ---------------------------------------------------------------------

export interface CartLine {
  id: string;
  variantId: string;
  offerId: string | null;
  quantity: number;
  unitPriceSnapshot: string;
  currentUnitPrice: string;
  priceChanged: boolean;
  lineTotal: number;
  variant: StorefrontVariant | null;
  isOrderBump: boolean;
}

export interface Cart {
  id: string;
  guestToken: string;
  currency: string;
  status: string;
  items: CartLine[];
  subtotal: number;
}

export interface CheckoutContact {
  fullName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
}

export interface CheckoutAddress {
  country: string;
  province?: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  notes?: string;
}

export interface CheckoutPayload {
  contact: CheckoutContact;
  shippingAddress?: CheckoutAddress;
  paymentMethod: "cod" | "card" | "wallet" | "bank_transfer";
  discountCode?: string;
  funnelId?: string;
  websiteId?: string;
  notes?: string;
  /** "Buy Now" — a single item straight to an order, no cart. Ignored when a cart token is sent. */
  item?: { variantId: string; offerId?: string; quantity?: number };
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

// ---------------------------------------------------------------------
// Confirmation queue (auth, /workspaces/:workspaceId/confirmation-tasks/...)
// A work queue for phone-confirming orders before fulfilment. A `queued`
// task is claimed (locked to the caller) and then closed by recording an
// outcome; `attemptCount` / `nextRetryAt` track call-backs after an
// unreachable/postponed result. Each task carries its full `order`.
// ---------------------------------------------------------------------

export type ConfirmationOutcome = "confirmed" | "rejected" | "unreachable" | "postponed";
export type ConfirmationTaskStatus = "queued" | "in_progress" | "done";

export interface ConfirmationTask {
  id: string;
  workspaceId: string;
  orderId: string;
  status: ConfirmationTaskStatus;
  lockedByUserId: string | null;
  lockedAt: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  outcome: ConfirmationOutcome | null;
  rejectionReason: string | null;
  order: Order;
}

export interface RecordConfirmationOutcomePayload {
  outcome: ConfirmationOutcome;
  notes?: string;
  rejectionReason?: string;
}

// ---------------------------------------------------------------------
// Discounts (auth, /workspaces/:workspaceId/discounts/...)
// Shapes mirror src/modules/discounts/* and the Discount model exactly.
// `value` and `minimumSubtotal` are BIGINT columns → strings over JSON.
// `value` is basis points for a percentage discount (1000 = 10%), integer
// minor units (piastres) for a fixed one, and null for free_shipping /
// buy_x_get_y.
// ---------------------------------------------------------------------

export type DiscountType = "percentage" | "fixed" | "free_shipping" | "buy_x_get_y";
export type DiscountStatus = "active" | "disabled" | "archived";

export interface Discount {
  id: string;
  workspaceId: string;
  code: string | null;
  type: DiscountType;
  value: string | null;
  buyXGetYConfig: Record<string, unknown> | null;
  minimumSubtotal: string | null;
  productRestrictions: string[];
  collectionRestrictions: string[];
  customerRestrictions: string[];
  funnelRestrictions: string[];
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  stackable: boolean;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors discountValidation.create — `value`/`minimumSubtotal` are integers. */
export interface CreateDiscountPayload {
  code?: string;
  type: DiscountType;
  value?: number;
  buyXGetYConfig?: Record<string, unknown>;
  minimumSubtotal?: number;
  productRestrictions?: string[];
  collectionRestrictions?: string[];
  customerRestrictions?: string[];
  funnelRestrictions?: string[];
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  stackable?: boolean;
}

/** Mirrors discountValidation.update — every field optional, most nullable. */
export interface UpdateDiscountPayload {
  code?: string | null;
  type?: DiscountType;
  value?: number | null;
  buyXGetYConfig?: Record<string, unknown> | null;
  minimumSubtotal?: number | null;
  productRestrictions?: string[];
  collectionRestrictions?: string[];
  customerRestrictions?: string[];
  funnelRestrictions?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  stackable?: boolean;
  status?: DiscountStatus;
}

// ---------------------------------------------------------------------
// Shipping zones + rates (auth, /workspaces/:workspaceId/shipping/...)
// Shapes mirror src/modules/shipping/*. `rate.config` is a freeform JSONB
// blob whose shape depends on `rateType` (money amounts inside are integer
// minor units), e.g.
//   flat:               { amount }
//   weight_based:        { tiers: [{ upToGrams, amount }], overflowAmount }
//   quantity_based:      { tiers: [{ upToQuantity, amount }], overflowAmount }
//   order_value_based:   { tiers: [{ minSubtotal, amount }] }
//   free:                {}
// ---------------------------------------------------------------------

export type ShippingRateType =
  | "flat"
  | "weight_based"
  | "quantity_based"
  | "order_value_based"
  | "free";

export interface ShippingRate {
  id: string;
  workspaceId: string;
  zoneId: string;
  name: string;
  rateType: ShippingRateType;
  config: Record<string, unknown>;
  carrierCode: string | null;
  /** Inactive rates stay in the CRUD but are skipped when pricing checkout. */
  isActive: boolean;
  /**
   * Optional delivery-time estimate in whole days, surfaced at checkout. No
   * effect on the priced amount. Either bound may be null independently.
   */
  estimatedDeliveryMinDays: number | null;
  estimatedDeliveryMaxDays: number | null;
}

export interface ShippingZone {
  id: string;
  workspaceId: string;
  name: string;
  countries: string[];
  regions: string[];
  excludedRegions: string[];
  /** Inactive zones stay in the CRUD but are skipped when pricing checkout. */
  isActive: boolean;
  /** Present on the list endpoint — rates are eager-loaded per zone. */
  rates?: ShippingRate[];
}

export interface CreateShippingZonePayload {
  name: string;
  countries?: string[];
  regions?: string[];
  excludedRegions?: string[];
  isActive?: boolean;
}

export type UpdateShippingZonePayload = Partial<CreateShippingZonePayload>;

export interface CreateShippingRatePayload {
  name: string;
  rateType: ShippingRateType;
  config?: Record<string, unknown>;
  carrierCode?: string | null;
  isActive?: boolean;
  /** Whole days; send `null` to leave unset (or to clear on update). */
  estimatedDeliveryMinDays?: number | null;
  estimatedDeliveryMaxDays?: number | null;
}

export interface UpdateShippingRatePayload {
  name?: string;
  rateType?: ShippingRateType;
  config?: Record<string, unknown>;
  carrierCode?: string | null;
  isActive?: boolean;
  /** Whole days; send `null` to clear a previously set estimate. */
  estimatedDeliveryMinDays?: number | null;
  estimatedDeliveryMaxDays?: number | null;
}

// ---------------------------------------------------------------------
// Tax rates (auth, /workspaces/:workspaceId/tax-rates/...)
// Shapes mirror src/modules/tax/*. `rateBasisPoints` is 100ths of a
// percent (1000 = 10%), an integer.
// ---------------------------------------------------------------------

export interface TaxRate {
  id: string;
  workspaceId: string;
  name: string;
  country: string | null;
  region: string | null;
  rateBasisPoints: number;
  appliesToShipping: boolean;
  pricesIncludeTax: boolean;
  productId: string | null;
}

export interface CreateTaxRatePayload {
  name: string;
  country?: string | null;
  region?: string | null;
  rateBasisPoints: number;
  appliesToShipping?: boolean;
  pricesIncludeTax?: boolean;
  productId?: string | null;
}

export interface UpdateTaxRatePayload {
  name?: string;
  country?: string | null;
  region?: string | null;
  rateBasisPoints?: number;
  appliesToShipping?: boolean;
  pricesIncludeTax?: boolean;
  productId?: string | null;
}

// ---------------------------------------------------------------------
// Customers (auth, /workspaces/:workspaceId/customers/...)
// Shapes mirror src/modules/customers/* and the Customer / CustomerAddress
// models. Identity is keyed on the normalized phone; list pagination is
// cursor-based on the customer id.
// ---------------------------------------------------------------------

export interface CustomerAddress {
  id: string;
  country: string;
  province: string | null;
  city: string;
  addressLine: string;
  postalCode: string | null;
  notes: string | null;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  workspaceId: string;
  phoneNormalized: string;
  phoneRaw: string | null;
  alternatePhone: string | null;
  email: string | null;
  fullName: string | null;
  marketingConsent: boolean;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  segments: string[];
  reliabilityScore: number;
  totalOrders: number;
  totalRejectedOrders: number;
  /** Present on the detail endpoint only. */
  addresses?: CustomerAddress[];
}

export interface CustomerListParams {
  limit?: number;
  cursor?: string;
  blacklistedOnly?: boolean;
}

export interface CustomerListResponse {
  customers: Customer[];
  nextCursor: string | null;
}

export interface UpdateCustomerPayload {
  fullName?: string | null;
  email?: string | null;
  phone?: string;
  alternatePhone?: string | null;
  marketingConsent?: boolean;
}

export interface BlacklistPayload {
  isBlacklisted: boolean;
  /** Required by the backend when isBlacklisted is true. */
  reason?: string;
}

export interface AddCustomerAddressPayload {
  country: string;
  province?: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  notes?: string;
  isDefault?: boolean;
}

export interface UpdateCustomerAddressPayload {
  country?: string;
  province?: string | null;
  city?: string;
  addressLine?: string;
  postalCode?: string | null;
  notes?: string | null;
  isDefault?: boolean;
}
