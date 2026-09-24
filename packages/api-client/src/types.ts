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
  /** Which optional storefront checkout fields are shown/required. Absent keys use the defaults. */
  checkout_settings?: Partial<CheckoutSettings>;
  /** Storefront fraud rules as stored. Absent keys are "off" — see `resolveFraudRules`. */
  fraud_rules?: Partial<FraudRules>;
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

/**
 * Why a store address may not be used. Stable keys straight from the backend
 * (`core/utils/workspaceSlug.js`) — the UI maps them to its own copy.
 */
export type SlugRejectionReason =
  | "invalid_format"
  | "too_short"
  | "too_long"
  | "reserved"
  | "taken";

/** The body of `GET /workspaces/check-slug`. `reason` is set only when taken. */
export interface SlugCheckResult {
  available: boolean;
  reason?: SlugRejectionReason;
}

export interface UpdateWorkspacePayload {
  name?: string;
  /**
   * The store's public address — it is served at `<slug>.zimos.co`. Refused as
   * 422 when malformed or reserved, and 409 when another workspace holds it.
   * Re-sending the address a store already has is a no-op, not a clash.
   */
  slug?: string;
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
    /**
     * Sub-keys merge; `null` on a sub-key restores its default, `null` on the
     * whole object restores every default.
     */
    checkout_settings?: { [K in keyof CheckoutSettings]?: CheckoutSettings[K] | null } | null;
    /**
     * Needs workspace.manage on top of website.edit — any mention of the key,
     * `null` included, is refused with 403 otherwise. Same merge rules as
     * `checkout_settings`; a `null` rule is "off".
     */
    fraud_rules?: { [K in keyof FraudRules]?: FraudRules[K] | null } | null;
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

/** One published snapshot of a website. `revisionNumber` starts at 1. */
export interface WebsiteRevision {
  id: string;
  revisionNumber: number;
  note: string | null;
  createdAt: string;
}

/** GET /workspaces/:workspaceId/websites/:websiteId */
export interface WebsiteDetail {
  website: Website;
  pages: WebsitePage[];
  publishedRevision: WebsiteRevision | null;
}

/** 201 body of POST .../websites/:websiteId/publish */
export interface PublishWebsiteResult {
  website: Website;
  revision: WebsiteRevision;
}

/**
 * One entry of the 422 `error.details[]` a failed publish comes back with.
 * Unlike an ordinary form 422 these are *page*-scoped, not field-scoped —
 * `path` names the offending page (e.g. "/about"), so they can't be fed to
 * `getFieldErrors`; render them as a list instead.
 */
export interface PublishProblem {
  field: string;
  message: string;
  pageId?: string;
  path?: string;
}

/** POST body for a new page. `path` and `title` are required server-side. */
export interface CreateWebsitePagePayload {
  path: string;
  title: string;
  pageType?: WebsitePage["pageType"];
  draftData?: PageTree;
  seo?: Record<string, unknown>;
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
  /** Always fully populated — an unconfigured store gets the defaults. */
  checkout: CheckoutSettings;
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

/**
 * GET /store/:workspaceId/pages — the published render data for one page of the
 * workspace's live website. Mirrors buildRenderData in pagesService.js.
 */
export interface StorefrontPageData {
  page: {
    path: string;
    title: string;
    pageType: WebsitePage["pageType"];
    tree: PageTree | null;
    seo: Record<string, unknown>;
    /** Open Graph tags the backend has already resolved for this page. */
    og: {
      title: string;
      description: string;
      image: string | null;
      url: string;
      type: string;
    };
  };
  site: {
    name: string;
    subdomain: string;
    globalStyles: Record<string, unknown>;
    seo: Record<string, unknown>;
  };
}

/** What `getStorefrontPage` can come back with — see its doc comment. */
export type StorefrontPageResult =
  | { kind: "page"; data: StorefrontPageData }
  | { kind: "redirect"; to: string; statusCode: number }
  | { kind: "notFound" };

export interface StorefrontCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo: Record<string, unknown> | null;
}

/**
 * Public order tracking (GET /store/:workspaceId/orders/track?phone=&number=).
 *
 * Deliberately thin: the shopper proves who they are with phone + order number
 * only, so the response carries what's on their receipt and nothing more — no
 * contact details, no address, no internal order state.
 */
export type TrackStage = 0 | 1 | 2 | 3;

export interface TrackResultItem {
  productNameSnapshot: string;
  quantity: number;
  /** Integer minor units as a string (Postgres BIGINT over JSON). */
  lineTotalAmount: string;
}

export interface TrackResult {
  orderNumber: string;
  /** 0 placed · 1 confirmed · 2 shipped · 3 delivered. */
  stage: TrackStage;
  /** When that stage was reached — not when the row last changed. */
  updatedAt: string | null;
  items: TrackResultItem[];
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  totalAmount: string;
  currency: string;
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
  /** Cash on delivery only: the storefront checkout refuses every other method (422). */
  paymentMethod: "cod";
  discountCode?: string;
  funnelId?: string;
  websiteId?: string;
  notes?: string;
  /**
   * The autosaved checkout session (`captureCheckoutSession`) this checkout
   * came from. A hint only — the server ignores anything it can't use and
   * never fails the order over it.
   */
  checkoutSessionId?: string;
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
  /**
   * The media-library row id. Set on everything uploaded since the library
   * existed; older entries in a product's `media` array may not have it.
   */
  id?: string;
  /** Absolute URL (APP_URL + path). */
  url: string;
  /** Host-relative path, e.g. "/uploads/<workspaceId>/<uuid>.png". */
  path: string;
  mimeType: string;
  size: number;
}

/** Response of POST /workspaces/:workspaceId/media (same shape as one media entry). */
export type MediaUploadResponse = ProductMedia & { id: string };

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
  /**
   * True when archiving the product took this variant down; restoring the
   * product revives only these. A status set by hand clears it.
   */
  archivedWithProduct?: boolean;
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
  /** See Variant.archivedWithProduct. */
  archivedWithProduct?: boolean;
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
  /** One status, or several (sent comma-separated, e.g. "draft,active"). */
  status?: ProductStatus | ProductStatus[];
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
  /**
   * Optional first variant, created with the product in one transaction so a
   * simple product is priced and stocked straight away. Money is integer
   * minor units; initial stock is recorded as a restock movement.
   */
  variant?: CreateProductVariantPayload;
}

export interface CreateProductVariantPayload {
  priceAmount: number;
  compareAtAmount?: number | null;
  sku?: string | null;
  stockOnHand?: number;
  allowOverselling?: boolean;
}

/** POST product — `variant` is present only when the request created one. */
export interface CreateProductResponse {
  product: Product;
  variant?: Variant;
}

/** Variants are edited through their own endpoints, never via PATCH product. */
export type UpdateProductPayload = Partial<Omit<CreateProductPayload, "variant">>;

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
  /**
   * Set only on shipments booked through a connected courier (then
   * `waybillNumber` is the courier's tracking number). Null for manual ones.
   */
  carrierResponse: ShipmentCarrierResponse | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The courier's own view of a shipment, as the backend stores it. */
export interface ShipmentCarrierResponse {
  /** Present on every courier-booked shipment — its presence is what marks one. */
  carrierShipmentId?: string;
  trackingNumber?: string | null;
  labelUrl?: string | null;
  address?: { cityId: string; districtId: string; zoneId: string | null };
  /** The last state the courier reported (sync / webhook). */
  lastCarrierStatus?: CarrierShipmentStatus | null;
  [key: string]: unknown;
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
  /**
   * Derived pipeline stage. Present on the list and on GET one; absent on
   * create/cancel/update responses.
   */
  stage?: OrderStage;
  /** Present on detail (GET one) only. */
  payments?: Payment[];
  shipments?: Shipment[];
}

export interface OrderListResponse {
  orders: Order[];
  nextCursor: string | null;
}

/**
 * The tab an order sits under — derived server-side (orders/orderStage.js),
 * never stored. Listed in the backend's order.
 */
export const ORDER_STAGES = [
  "pending_confirmation",
  "needs_follow_up",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "returned",
  "cancelled",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

/**
 * Search + date range, shared by the list and the tab counts.
 *
 * `q` (2–100 chars after trimming) matches the order number (with or without
 * '#'), the customer's name or email (Arabic letter variants folded), or —
 * only when it holds 10+ digits — the phone, compared on its last 10 digits.
 * `from`/`to` are ISO dates on created_at, in UTC; `to` includes its whole day.
 */
export interface OrderSearchParams {
  q?: string;
  from?: string;
  to?: string;
}

export interface OrderListParams extends OrderSearchParams {
  /** 1–200, default 50. */
  limit?: number;
  /**
   * The previous page's `nextCursor` (an order id). An unknown one is a 422
   * VALIDATION_ERROR with `details[].field === "cursor"`.
   */
  cursor?: string;
  stage?: OrderStage;
  confirmationState?: ConfirmationState;
  financialState?: FinancialState;
  fulfillmentState?: FulfillmentState;
}

/** GET /orders/pipeline — every stage is present, zero-filled. */
export interface OrderPipeline {
  stages: Record<OrderStage, number>;
  total: number;
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
  /**
   * "manual", or a connected courier's code ("bosta") to book it with that
   * courier. A courier code the store has NOT connected is stored as a manual
   * shipment, exactly as before.
   */
  carrierCode: string;
  /** Manual shipments only — a courier assigns its own. */
  waybillNumber?: string;
  trackingUrl?: string;
  /**
   * Courier bookings only: the courier's ids for the drop-off address, sent
   * after a 422 CARRIER_ADDRESS_UNMATCHED.
   */
  carrierAddress?: { cityId: string; districtId: string };
  notes?: string;
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
// Product reviews (staff moderation, /workspaces/:workspaceId/reviews)
// A review is written by a customer who actually received the product, and
// stays `pending` until a staff member approves or rejects it. Only approved
// reviews reach the storefront. One row per (workspace, product, customer) —
// a resubmission updates that row and drops it back to `pending`.
// ---------------------------------------------------------------------

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ReviewProductRef {
  id: string;
  name: string;
}

export interface ReviewCustomerRef {
  id: string;
  fullName: string | null;
}

export interface Review {
  id: string;
  workspaceId: string;
  productId: string;
  customerId: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  /** Joined in by the staff list only — the moderation response returns the
   * bare row, and the join is a LEFT JOIN, so neither is guaranteed. */
  product?: ReviewProductRef | null;
  customer?: ReviewCustomerRef | null;
}

export interface ReviewListParams {
  status?: ReviewStatus;
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

// ---------------------------------------------------------------------------
// Platform admin (/admin/...)
//
// These mirror the serializers in the backend's `platformAdmin` module. Money
// fields are plain numbers in minor units of the platform currency — the
// backend already converts the BIGINT columns for this surface, so the
// `parseMoney` treatment the storefront needs does not apply here.
// ---------------------------------------------------------------------------

/** Feature keys a plan can grant. Mirrors the `plans.features` JSONB. */
export type PlanFeatureKey =
  | "custom_domain"
  | "funnels"
  | "whatsapp_confirmation"
  | "abandoned_cart"
  | "multi_warehouse"
  | "api_access"
  | "staff_accounts"
  | "advanced_analytics"
  | "remove_branding"
  | "priority_support";

/**
 * One row of `GET /admin/workspaces`. This is a purpose-built overview row,
 * not a full `Workspace`: it carries the workspace's identity fields plus a
 * flattened billing summary and a real lifetime order count. Fields a
 * `Workspace` has but this does not (locale, timezone, settings, owner) are
 * simply not served by this endpoint.
 */
export interface AdminWorkspaceOverview {
  id: string;
  name: string;
  slug: string;
  status: string;
  defaultCurrency: string;
  createdAt: string;
  /** Plan name, or "—" when the workspace has no subscription. */
  plan: string;
  planId: string | null;
  billingCycle: BillingCycle | null;
  /** "none" when the workspace has never subscribed. */
  subscriptionStatus: SubscriptionStatus | "none";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Lifetime orders placed in this workspace. */
  orderCount: number;
}

export interface AdminPlan {
  id: string;
  name: string;
  /** The backend column is `key`; this surface calls it `code`. */
  code: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  trialDays: number;
  /** Orders per month; null = unlimited. */
  orderQuota: number | null;
  transactionFeeBp: number;
  codFeeBp: number;
  features: PlanFeatureKey[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AdminPlanInput = Omit<AdminPlan, "id" | "currency" | "createdAt" | "updatedAt"> & {
  id?: string;
  currency?: string;
};

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused";

export type BillingCycle = "monthly" | "yearly";

export interface AdminSubscription {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceSlug: string | null;
  planId: string;
  planName: string | null;
  planCode: string | null;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  externalProvider: string | null;
  /** Monthly run rate in minor units; 0 unless active/past_due. */
  mrr: number;
  createdAt: string;
}

export interface AdminFeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  /** 0–100 percentage of workspaces. */
  rollout: number;
  targetWorkspaceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type AdminFeatureFlagInput = Pick<
  AdminFeatureFlag,
  "key" | "description" | "enabled" | "rollout" | "targetWorkspaceIds"
> & { id?: string };

export type AnnouncementSeverity = "info" | "success" | "warning" | "critical";
export type AnnouncementAudience = "all" | "plan" | "workspace";

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  planId: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  startsAt: string;
  endsAt: string | null;
  dismissible: boolean;
  /** Resolved admin name/email, set server-side. */
  createdBy: string | null;
  createdAt: string;
}

export type AdminAnnouncementInput = Omit<
  AdminAnnouncement,
  "id" | "workspaceName" | "createdBy" | "createdAt"
> & { id?: string };

/**
 * One row of `GET /admin/audit-log`.
 *
 * The columns `audit_logs` stores as nullable stay nullable here: entries
 * written by background jobs carry no actor and no request, so IP and user
 * agent are absent on them. `actorName`, `actorEmail`, `entityLabel` and
 * `workspaceName` are resolved server-side by joining the actor and the
 * target record, and are null when that record no longer exists — the log
 * outlives the things it describes.
 */
export interface AdminAuditEntry {
  id: string;
  /**
   * The acting user's id, or null. Null for background-job entries and for
   * entries whose actor has since been deleted — the FK is ON DELETE SET NULL,
   * so those two cases are genuinely indistinguishable, here and server-side.
   *
   * This is the ONLY way to filter by actor: the endpoint takes `actorUserId`
   * and has no name or email search, so a UI that filters by actor must pick
   * an id rather than accept typed text.
   */
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  /** Entity state around the action; null when the action recorded neither. */
  before: unknown;
  after: unknown;
}

/**
 * Query for `GET /admin/audit-log`. Every filter is applied server-side.
 *
 * `workspaceId` and `actorUserId` must be UUIDs — the endpoint validates them
 * as such and answers 422 otherwise, so neither can carry free text. `action`,
 * `entityType` and `entityId` are exact matches, not substring searches.
 */
export interface AdminAuditLogParams {
  workspaceId?: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  /** ISO timestamps bounding `createdAt`. `to` must not precede `from`. */
  from?: string;
  to?: string;
  /** Server default 50, hard cap 200 — a larger value is rejected, not clamped. */
  limit?: number;
  offset?: number;
}

/** One window of `GET /admin/audit-log`, with the size of the full match set. */
export interface AdminAuditLogPage {
  rows: AdminAuditEntry[];
  /**
   * How many entries match the filters across the WHOLE log, not just this
   * window — so `total > rows.length` means older matches exist beyond it.
   *
   * Null when the server did not report one. That is a real possibility (an
   * older build predating `total`), and it has to stay distinguishable from a
   * genuine 0: callers must fall back to hedged wording rather than claiming a
   * count they were never given.
   */
  total: number | null;
}

// --------------------------------------------------------------- system health

/**
 * Result of a browser-side probe against one of the backend's root-level
 * health endpoints.
 *
 * `reachable` is the load-bearing field. A probe that never got a response
 * cannot tell "the service is down" apart from "the browser refused to make
 * the call" — the health endpoints sit behind the API's CORS allowlist, so a
 * console served from an origin the backend doesn't list gets an opaque
 * network failure that looks exactly like an outage. Callers must render
 * `reachable: false` as *unknown*, never as *down*.
 */
export interface HealthProbeResult {
  /** The response arrived, whatever its status. False = no response at all. */
  reachable: boolean;
  /** HTTP status, or null when the request never completed. */
  status: number | null;
  /** Parsed JSON body when the response carried one. */
  body: unknown;
  /** Round-trip time in ms, measured around the fetch. Null if it never returned. */
  latencyMs: number | null;
  /** Failure reason when `reachable` is false — a network, CORS, or timeout error. */
  error: string | null;
  /** When the probe ran, ISO. */
  checkedAt: string;
}

/**
 * The four verdicts the server can reach about a service it probed itself.
 *
 * `not_configured` is neutral, NOT a failure: the integration is deliberately
 * switched off in this environment (`EMAIL_PROVIDER` is not Brevo, payments
 * run in-process), so there was nothing to reach. Rendering it as an error
 * would report a healthy deployment as broken.
 *
 * `unknown` is deliberately absent — that verdict belongs to the browser-side
 * fallback, which cannot tell a dead service from a blocked request. A probe
 * the server ran always has a real outcome.
 */
export type AdminServiceStatus = "operational" | "degraded" | "down" | "not_configured";

/**
 * One service from `GET /admin/system/services` (and from the POST `/check`).
 *
 * Verified against the implementation: five tiles keyed `postgres`, `storage`,
 * `email`, `sms`, `payments`, each probed in parallel with a 5s timeout.
 *
 * `uptime30d`, `lastIncidentAt` and `lastIncidentSummary` are always null in
 * v1 — there is no `service_checks` table and no recorder, so no history
 * exists to compute them from. The fields are live in the payload and reserve
 * the names. Render them as unavailable: a hardcoded "100%" uptime is worse
 * than an honest blank.
 */
export interface AdminServiceTile {
  /** Stable identifier: "postgres" | "storage" | "email" | "sms" | "payments". */
  key: string;
  name: string;
  status: AdminServiceStatus;
  latencyMs: number | null;
  /**
   * One line about the reading — what was reached ("brevo account …"), why the
   * probe failed, or, for `not_configured`, which setting switched it off.
   * Null when the probe reported nothing beyond its status.
   */
  detail: string | null;
  /** When THIS probe ran, not when the response was served. A cached response repeats the original stamp. */
  checkedAt: string;
  /** Fraction over the trailing 30 days. Null until a check recorder exists. */
  uptime30d: number | null;
  /** Null until a check recorder exists. */
  lastIncidentAt: string | null;
  /** Null until a check recorder exists. */
  lastIncidentSummary: string | null;
}

/** Both system-services endpoints answer with this envelope. */
export interface AdminServiceReport {
  services: AdminServiceTile[];
  /**
   * True when the server replayed a recent reading instead of probing. The GET
   * caches for a short window so a page refresh does not fire real requests at
   * Brevo and Twilio; the POST `/check` always probes and always reports false.
   */
  cached: boolean;
}

// -------------------------------------------------------------------- overview

/**
 * One point on an overview trend series.
 *
 * `label` is a raw ISO bucket key, never a pre-formatted display string:
 * "2026-09-16" for daily series, "2026-09" for monthly. Confirmed with the
 * backend — it keeps the label re-formattable for the console's Arabic mode,
 * which a server-rendered "Sep 16" would not be. Buckets are UTC calendar
 * days/months, so render them in UTC too or the last bar lands on the wrong
 * day for anyone east or west of it.
 */
export interface AdminChartPoint {
  label: string;
  value: number;
}

/**
 * Kinds the needs-attention queue can raise.
 *
 * `carrier_error` is declared but NOT committed for v1 — the backend has no
 * table behind it. Expect three of the four, and treat the union as open:
 * the server may add kinds without a release here, so readers must degrade on
 * an unrecognised kind rather than throw or drop the row.
 */
export type AdminAttentionKind = "past_due" | "high_rto" | "carrier_error" | "unverified_domain";

/**
 * One row of the overview's needs-attention queue.
 *
 * Deliberately carries no route and no prose. The backend declined to encode
 * frontend routes (they break silently on a rename) or to author English copy
 * (it cannot be translated client-side), so it sends the identity and one
 * number and the console phrases the rest.
 *
 * `value`'s meaning is keyed to `kind`:
 * - `past_due` — whole days the subscription is overdue
 * - `high_rto` — return rate as a 0..1 fraction
 * - `unverified_domain` — whole days since the domain was added
 * - anything else — undefined; render the row without interpreting it.
 */
export interface AdminAttentionItem {
  id: string;
  kind: AdminAttentionKind;
  severity: "warning" | "danger" | "info";
  workspaceId: string | null;
  workspaceName: string | null;
  value: number | null;
}

/**
 * `GET /admin/metrics/overview` -> `{ overview: {...} }`.
 *
 * NOT IMPLEMENTED SERVER-SIDE YET — contract confirmed with the backend ahead
 * of the endpoint, with no ETA. Callers must handle its absence and fall back;
 * see `adminApi.loadOverview`.
 *
 * Money (`mrr`, `gmv30d`) is JS numbers in MINOR units — confirmed, not
 * assumed. Postgres hands BIGINT to the driver as a string and there is no
 * type-parser override, but every `/admin` serializer casts with `Number()` on
 * the way out, so these arrive summable. That is specific to `/admin`:
 * order-facing endpoints elsewhere in this API still emit raw BIGINT strings.
 *
 * There is no FX layer anywhere in the backend, so no amount here is ever
 * converted. When the rows behind a total span more than one currency, the
 * amount *and* its currency both come back null rather than as a meaningless
 * sum. Null is load-bearing: render it as unavailable, never as zero.
 */
export interface AdminOverview {
  /** When the server computed this, ISO. Use it to show staleness. */
  generatedAt: string;
  kpis: {
    activeWorkspaces: number;
    trialing: number;
    pastDue: number;
    /** Minor units. Null when contributing plans span several currencies. */
    mrr: number | null;
    /** ISO code for `mrr`, or null alongside a null `mrr`. */
    mrrCurrency: string | null;
    /** Minor units, trailing 30 days. Null on mixed currencies. */
    gmv30d: number | null;
    /** ISO code for `gmv30d`, or null alongside a null `gmv30d`. */
    gmv30dCurrency: string | null;
    /** UTC calendar day, not the viewer's. */
    ordersToday: number;
    /**
     * Delivered / (delivered + failed + returned) over the trailing 30 days —
     * terminal shipments only, so in-flight ones do not drag it down.
     *
     * A FRACTION (0..1), not a percentage. Null when nothing has reached a
     * terminal state, because "nothing delivered" and "nothing shipped" are
     * not the same statement and 0 would conflate them.
     */
    deliveryRate: number | null;
  };
  /** Last 30 days, zero-filled by the server — every bucket is present. */
  signupsPerDay: AdminChartPoint[];
  /**
   * Last 12 months, zero-filled, built from paid invoices bucketed by period
   * start — real history, not today's MRR projected backwards (which would
   * draw a flat line and pass it off as a trend).
   *
   * Null — not `[]`, not twelve zeros — when no paid invoice exists anywhere
   * in the window. Hide the chart rather than drawing an empty one.
   */
  mrrTrend: AdminChartPoint[] | null;
  /** Last 30 days, zero-filled by the server — every bucket is present. */
  ordersPerDay: AdminChartPoint[];
  attention: AdminAttentionItem[];
}

// ---------------------------------------------------------------------
// Storefront checkout settings (workspace.settings.checkout_settings, read
// back publicly as StorefrontMeta.checkout). Backend:
// src/modules/checkout/checkoutSettings.js
// ---------------------------------------------------------------------

export type CheckoutFieldMode = "hidden" | "optional" | "required";
/** A note the shopper never sees can't be demanded of them — no "required". */
export type CheckoutNotesMode = "hidden" | "optional";

/**
 * Keys are named after the request fields they govern on the backend:
 *   email       -> contact.email
 *   postal_code -> shippingAddress.postalCode
 *   notes       -> the order note
 * "required" is enforced server-side (422 VALIDATION_ERROR on that field).
 */
export interface CheckoutSettings {
  email: CheckoutFieldMode;
  postal_code: CheckoutFieldMode;
  notes: CheckoutNotesMode;
}

export const CHECKOUT_SETTINGS_DEFAULTS: CheckoutSettings = {
  email: "optional",
  postal_code: "optional",
  notes: "optional",
};

/** The effective checkout settings for a stored blob — mirrors resolveCheckoutSettings. */
export function resolveCheckoutSettings(
  stored: Partial<CheckoutSettings> | null | undefined
): CheckoutSettings {
  const s = stored ?? {};
  const modes: CheckoutFieldMode[] = ["hidden", "optional", "required"];
  return {
    email: s.email && modes.includes(s.email) ? s.email : CHECKOUT_SETTINGS_DEFAULTS.email,
    postal_code:
      s.postal_code && modes.includes(s.postal_code)
        ? s.postal_code
        : CHECKOUT_SETTINGS_DEFAULTS.postal_code,
    notes: s.notes === "hidden" || s.notes === "optional" ? s.notes : CHECKOUT_SETTINGS_DEFAULTS.notes,
  };
}

// ---------------------------------------------------------------------
// Fraud (auth, /workspaces/:workspaceId/fraud/...). Backend: src/modules/fraud
// Rules live in workspace.settings.fraud_rules (read via GET /workspaces,
// written via PATCH /workspaces/:id — needs workspace.manage).
// ---------------------------------------------------------------------

export type FraudAction = "flag" | "block";

export interface FraudRules {
  /** What a triggered counting rule does. Default "flag". */
  action: FraudAction;
  /** Refuse blacklisted customers whatever `action` says. Default false. */
  block_blacklisted: boolean;
  /** Same customer + any same variant within N minutes (1–10080). null = off. */
  duplicate_window_minutes: number | null;
  /** Customer already has N orders in the last 24h (1–100). null = off. */
  max_orders_per_phone_per_day: number | null;
  /** customer.totalRejectedOrders >= N (1–100). null = off. */
  high_rejection_threshold: number | null;
}

/** The effective rules for a stored blob — mirrors fraudRules.resolveFraudRules. */
export function resolveFraudRules(stored: Partial<FraudRules> | null | undefined): FraudRules {
  const s = stored ?? {};
  return {
    action: s.action === "block" ? "block" : "flag",
    block_blacklisted: s.block_blacklisted === true,
    duplicate_window_minutes: s.duplicate_window_minutes ?? null,
    max_orders_per_phone_per_day: s.max_orders_per_phone_per_day ?? null,
    high_rejection_threshold: s.high_rejection_threshold ?? null,
  };
}

/**
 * Flags an order can carry. `blacklisted_customer` is set on any order from a
 * blacklisted customer; the other three come from the fraud rules.
 */
export type RiskFlag =
  | "blacklisted_customer"
  | "duplicate_order"
  | "phone_daily_limit"
  | "high_rejection_customer";

/** One row of GET /fraud/flagged-orders — a slim projection, not a full Order. */
export interface FlaggedOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  /** Usually RiskFlag values; typed open so an unknown future flag still renders. */
  riskFlags: string[];
  customerName: string | null;
  phone: string | null;
  /** Integer minor units, already a number here. */
  totalAmount: number;
  currency: string;
  confirmationState: ConfirmationState;
  cancelled: boolean;
}

export interface FlaggedOrderListParams {
  /** 1–100, default 30. */
  limit?: number;
  /** The previous page's `nextCursor` (an order id). */
  before?: string;
  /** Default false: only orders still waiting on the COD call. */
  includeResolved?: boolean;
}

export interface FlaggedOrderListResponse {
  orders: FlaggedOrder[];
  nextCursor: string | null;
}

export interface BlocklistEntry {
  customerId: string;
  fullName: string | null;
  phone: string;
  reason: string | null;
  totalOrders: number;
  totalRejectedOrders: number;
  blockedAt: string | null;
}

export interface BlockPhonePayload {
  phone: string;
  /** 2–300 chars. */
  reason: string;
  fullName?: string;
}

/** POST /fraud/blocklist. `created` is false when the phone was already blocked (200, reason updated). */
export interface BlockPhoneResult {
  created: boolean;
  entry: { customerId: string; phone: string; reason: string | null };
}

// ---------------------------------------------------------------------
// Abandoned checkouts. Public autosave: POST /store/:workspaceId/checkout-sessions.
// Merchant: /workspaces/:workspaceId/checkout-sessions.
// Backend: src/modules/checkoutSessions. "abandoned" = no autosave for 60
// minutes, derived server-side at read time.
// ---------------------------------------------------------------------

export interface CaptureCheckoutSessionPayload {
  contact: { phone: string; fullName?: string; email?: string };
  /** 1–20 lines, quantity 1–100. Priced server-side. */
  items: Array<{ variantId: string; offerId?: string; quantity: number }>;
  source?: "store" | "funnel";
  /** 8–64 chars; the upsert key — one open session per visitor. */
  visitorId: string;
}

export type CheckoutSessionStatus = "in_progress" | "abandoned" | "converted";
export type CheckoutRecoveryStatus = "not_contacted" | "contacted" | "recovered" | "lost";

export interface CheckoutSessionItem {
  productId: string;
  variantId: string;
  productName: string;
  options: Record<string, string> | null;
  offerName: string | null;
  quantity: number;
  lineTotalAmount: number;
}

export interface CheckoutSession {
  id: string;
  status: CheckoutSessionStatus;
  recoveryStatus: CheckoutRecoveryStatus;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  items: CheckoutSessionItem[];
  /** Integer minor units, already a number here. */
  subtotalAmount: number;
  currency: string;
  source: "store" | "funnel";
  lastActivityAt: string;
  contactedAt: string | null;
  createdAt: string;
  convertedOrder: { id: string; orderNumber: string } | null;
}

export interface CheckoutSessionListParams {
  /** Default "abandoned". In-progress sessions only show under "all". */
  view?: "abandoned" | "converted" | "all";
  recoveryStatus?: CheckoutRecoveryStatus;
  /** 1–100, default 30. */
  limit?: number;
  /** The previous page's `nextCursor` (a session id). */
  before?: string;
}

export interface CheckoutSessionListResponse {
  sessions: CheckoutSession[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------
// Courier integrations (auth, /workspaces/:workspaceId/carriers).
// Backend: src/modules/shipping. Credentials are write-only — no response
// ever carries them.
// ---------------------------------------------------------------------

export interface CarrierFieldDescriptor {
  key: string;
  label: string;
  secret?: boolean;
  options?: string[];
}

export interface CarrierConnection {
  /** "invalid" once the courier rejected the stored key — reconnect needed. */
  status: "active" | "invalid";
  settings: Record<string, unknown>;
  lastVerifiedAt: string | null;
  connectedAt: string;
  updatedAt: string;
  webhookUrl: string;
}

export interface CarrierInfo {
  code: string;
  name: string;
  webhookSetup: "per_shipment" | "account";
  supportsLabel: boolean;
  credentialFields: CarrierFieldDescriptor[];
  settingFields: CarrierFieldDescriptor[];
  /** null when this workspace hasn't connected it. */
  connection: CarrierConnection | null;
}

/**
 * GET /carriers. Always 200: `configured: false` means the server has no
 * credentials key, and every other carrier call answers 503
 * CARRIERS_NOT_CONFIGURED.
 */
export interface CarrierList {
  configured: boolean;
  carriers: CarrierInfo[];
}

export const BOSTA_PACKAGE_TYPES = ["Parcel", "Document", "Light Bulky", "Heavy Bulky"] as const;
export type BostaPackageType = (typeof BOSTA_PACKAGE_TYPES)[number];

export interface BostaSettings {
  /** A pickup location id from the verification; Bosta's default when empty. */
  businessLocationId?: string | null;
  packageType?: BostaPackageType;
  awbType?: "A4" | "A6";
  awbLang?: "ar" | "en";
}

/**
 * PUT /carriers/:code. `credentials` may be omitted to change only the
 * settings of an existing connection (the stored key is re-verified).
 */
export interface ConnectCarrierPayload {
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface CarrierPickupLocation {
  id: string;
  name: string | null;
  isDefault: boolean;
}

export interface ConnectCarrierResult {
  carrier: CarrierInfo;
  webhook: { url: string; setup: "per_shipment" | "account"; manualSetupRequired: boolean };
  /** Bosta: the account's pickup locations — only obtainable from this call. */
  verification: { pickupLocations?: CarrierPickupLocation[] } & Record<string, unknown>;
}

export interface CarrierDistrict {
  id: string;
  name: string | null;
  nameAr: string | null;
  zoneId: string | null;
  zoneName: string | null;
  zoneNameAr: string | null;
  dropOffAvailable: boolean;
}

export interface CarrierCity {
  id: string;
  name: string | null;
  nameAr: string | null;
  dropOffAvailable: boolean;
  districts: CarrierDistrict[];
}

/** One option in `details.candidates` of a 422 CARRIER_ADDRESS_UNMATCHED. */
export interface CarrierAddressCandidate {
  cityId: string;
  cityName: string | null;
  cityNameAr: string | null;
  /** null at level "city": the candidates are cities, pick a district next. */
  districtId: string | null;
  districtName: string | null;
  districtNameAr: string | null;
  zoneId: string | null;
  zoneName: string | null;
  /** Sorted first; the matcher's best guesses. */
  suggested: boolean;
}

/** `details` of 422 CARRIER_ADDRESS_UNMATCHED. */
export interface CarrierAddressUnmatchedDetails {
  carrierCode: string;
  level: "city" | "district";
  orderAddress: { province: string | null; city: string | null };
  /** Set at level "district": the city that did match. */
  matchedCity: { id: string; name: string | null; nameAr: string | null } | null;
  candidates: CarrierAddressCandidate[];
}

/** `details` of 409 CARRIER_CANCEL_FAILED. */
export interface CarrierCancelFailedDetails {
  shipmentId: string;
  carrierCode: string;
  /** The courier-side failure, e.g. "CARRIER_PERMISSION_DENIED". */
  carrierErrorCode: string | null;
}

export interface CarrierShipmentStatus {
  code: number | null;
  value: string | null;
  type: string | null;
}

/** POST .../shipments/:shipmentId/sync */
export interface ShipmentSyncResult {
  shipment: Shipment;
  /** Whether our shipment status moved. */
  changed: boolean;
  carrierStatus: CarrierShipmentStatus | null;
}
