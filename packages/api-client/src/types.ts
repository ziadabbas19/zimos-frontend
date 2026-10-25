export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  /**
   * Public handle, lower-case. Null only for an account made through Google
   * until its owner picks one (the dashboard asks before anything else).
   */
  username?: string | null;
  /** The owner's last change (null until they change it once; the first choice doesn't count). */
  usernameChangedAt?: string | null;
  phone: string | null;
  status: "pending_verification" | "active" | string;
  /** May sign in to the platform console: true for any platform role. */
  platformAdmin: boolean;
  /** Platform-console role, null for everyone else. */
  platformRole?: string | null;
  /** Platform-console permission keys (`*` = all). */
  platformPermissions?: string[];
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  /** The plan chosen at sign-up, applied to the first store. */
  selectedPlanId?: string | null;
  selectedBillingCycle?: BillingCycle | null;
  /** A Google account made while a plan was required, still to choose one. */
  requiresPlanSelection?: boolean;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  /** The email or the username, as typed (either is case-insensitive). */
  identifier?: string;
  /** What clients from before usernames send; give `identifier` instead. */
  email?: string;
  password: string;
  /** The language of a sign-up code sent to an account not confirmed yet. */
  locale?: "ar" | "en";
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  /** 3–30 of a–z 0–9 _ . — 409 USERNAME_TAKEN, 422 when invalid or reserved. */
  username?: string;
  /** A public plan (GET /plans/public); required while the server asks for one (signup options). */
  planId?: string;
  billingCycle?: BillingCycle;
  /** "I accept the terms, the refund policy and the privacy policy." */
  acceptTerms?: boolean;
  /** The language of the sign-up code email/SMS. */
  locale?: "ar" | "en";
  /** The marketing-site session (?sv= on the sign-up link); 8–64 of A–Z a–z 0–9 -. Ignored while site analytics is off. */
  siteSessionId?: string;
}

export type VerificationChannel = "email" | "sms";

/**
 * The answer to a sign-up, or a sign-in to an account not confirmed yet,
 * while sign-up codes are on: no tokens, a code on its way (`codeSent`), and a
 * short-lived token that only the two /auth/verify endpoints accept.
 */
export interface VerificationChallenge {
  verificationRequired: true;
  verificationToken: string;
  channels: VerificationChannel[];
  /** Masked: { email: "a***@gmail.com", sms?: "01******234" }. */
  targets: { email: string; sms?: string };
  codeSent: boolean;
  channel: VerificationChannel | null;
  expiresAt: string | null;
  resendAvailableAt: string | null;
}

/** POST /auth/verify/send */
export interface VerificationSent {
  sent: true;
  channel: VerificationChannel;
  /** Masked. */
  target: string;
  expiresAt: string;
  resendAvailableAt: string;
}

/** What the account settings can offer (`GET /auth/me`'s `account`). */
export interface AccountSettingsInfo {
  /** Changes are confirmed with the current password; without one (Google), with a code to the current email. */
  hasPassword: boolean;
  /** PHONE_CHANGE_ENABLED: the phone number can be changed by an SMS code. */
  phoneChange: boolean;
}

/** Confirming an email or phone change: who you are, then where the new code goes. */
export interface AccountChangeRequest {
  currentPassword?: string;
  /** For an account without a password: the code sent to its current email. */
  reauthCode?: string;
  locale?: "ar" | "en";
}

/**
 * The code a new account gets to confirm its email while sign-up codes are
 * off (it is signed in at once). `sent: false` when none could go out — the
 * dashboard's banner offers to send one.
 */
export type EmailCodeSent = { sent: false } | ({ sent: true } & Omit<VerificationSent, "sent">);

/** GET /auth/signup-options — what the sign-up form must ask for right now. */
export interface SignupOptions {
  planRequired: boolean;
  termsRequired: boolean;
  termsVersion: string;
  verificationRequired: boolean;
}

/** One plan on offer (GET /plans/public). Prices in minor units; null limits are unlimited. */
export interface PublicPlan {
  id: string;
  name: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  maxStores: number | null;
  maxFunnelsPerMonth: number | null;
  softOrderQuota: number | null;
  features: PlanFeatureKey[];
}

/** Why a username can't be had (GET /auth/username-available). */
export type UsernameUnavailableReason = "invalid" | "reserved" | "taken";

export interface UsernameAvailability {
  available: boolean;
  reason?: UsernameUnavailableReason;
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
  /**
   * Grams standing in for a product with no weight (tier pricing, courier
   * parcel weight). Required while `shipping_pricing_mode` is "weight_tiers";
   * clearing it then is refused with 422 DEFAULT_ITEM_WEIGHT_REQUIRED.
   */
  default_item_weight_grams?: number | null;
  /** Read-only here — changed through POST /shipping/pricing-mode. Absent = "rates". */
  shipping_pricing_mode?: ShippingPricingMode;
  /**
   * Read-only here — changed through PATCH /shipping/settings. The merchant's
   * price per governorate code (rate pricing only); absent = the default rate.
   */
  shipping_governorate_rates?: Record<string, number>;
  /** Read-only here — PATCH /shipping/settings. "manual" or a courier code, preselected when booking. */
  default_carrier_code?: string;
  /**
   * The text the confirmation queue's WhatsApp button opens with. Absent uses
   * the dashboard's built-in message. Placeholders: {store} {orderNumber}
   * {items} {total} {customerName}.
   */
  confirmation_whatsapp_template?: string;
  /**
   * Funnel upsells join the checkout order while it waits in its offer
   * window, instead of becoming orders of their own. Off unless true.
   */
  funnel_upsell_merge?: boolean;
  /** How long a funnel order waits for its offers at most. Absent = 15. */
  funnel_offer_window_minutes?: number;
  /** The store checkout's order bump as stored — see OrderBumpSettings. */
  order_bump?: OrderBumpSettings;
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
    /** Grams; null clears it (refused with 422 while tier pricing is on). */
    default_item_weight_grams?: number | null;
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
    /** Sent whole; `null` goes back to the defaults. */
    storefront_catalog?: StorefrontCatalogSettings | null;
    /**
     * Sent whole; `null` removes it. Switching it on with an offer that cannot
     * be a bump (archived, unpriced, a product with custom fields, another
     * store's) is refused with 422.
     */
    order_bump?: OrderBumpSettings | null;
    /** Needs orders.manage on top of website.edit. */
    funnel_upsell_merge?: boolean | null;
    /** 1–120; needs orders.manage. `null` goes back to 15. */
    funnel_offer_window_minutes?: number | null;
    /** Needs orders.manage on top of website.edit. `null` goes back to the built-in message. */
    confirmation_whatsapp_template?: string | null;
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
  /** The template's accent (its column, else its current version's globalStyles). */
  primaryColor?: string | null;
  /** A right-to-left (Arabic) template. */
  rtl?: boolean;
  tags?: string[];
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
  "shoppable_image",
  "product_list",
  "collection_list",
  "cart",
  // Immersive sections (backend pageTree.js accepts these too).
  "shader_hero",
  "product_3d",
  "orbit_gallery",
  "scroll_story",
  // Storefront sections (backend pageTree.js accepts these too).
  "marquee",
  "comparison",
  // Builder elements of SPEC §9.3 (backend pageTree.js accepts these too).
  "text_link",
  "tabs",
  "toggle",
  "carousel",
  "stars_display",
  "price",
  "reviews_list",
  "cod_form",
  "checkout_summary",
  "order_summary",
  "upsell_accept_button",
  "upsell_decline_link",
  // SPEC §9.4: one block per item of a product list.
  "repeater",
  // Showcase sections — full-width storefront bands (backend showcaseElements.js).
  "hero_slider",
  "category_tiles",
  "trust_strip",
  "bundle_cards",
  "need_picker",
  "product_rail",
  "video_reels",
  "product_shelf",
  "product_cards",
  "image_banner",
  // Bands in the look of an imported template (storefront page-renderer/xs). The
  // backend's allowlist (src/modules/pages/pageTree.js) has to name them too before
  // a page holding one can be saved.
  "xs_slider",
  "xs_banners",
  "xs_products",
  "xs_title",
  "xs_story",
  "xs_contact",
  "xs_hero",
  "xs_showcase",
  "xs_features",
  "xs_split",
  "xs_minis",
  "xs_quotes",
  "xs_gallery",
  "xs_newsletter",
  "xs_team",
  "xs_video",
  "xs_posts",
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
  /**
   * Free-form look settings the backend stores and passes through untouched
   * (pageTree.js validates node structure, never this). Optional everywhere:
   * a section without it renders the way sections always have.
   */
  settings?: Record<string, unknown>;
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
  /** The product listing's sidebar and default sort; always populated. */
  catalog?: StorefrontCatalogSettings;
  /** The store checkout's order bump; null when none is set or it can't be sold right now. */
  orderBump?: StorefrontOrderBump | null;
}

/**
 * settings.order_bump: the offer the store's checkout (product page and cart
 * checkout) offers as an "add to your order" tick box. The offer id is kept
 * while it is switched off.
 */
export interface OrderBumpSettings {
  enabled: boolean;
  offer_id: string | null;
  /** Replaces the card's "Add to your order" heading. */
  title?: string | null;
  description?: string | null;
}

/**
 * An order bump as the storefront shows it (store.orderBump, or a funnel
 * checkout step's `bump`). Ticking it sends `orderBump: { offerId }` with the
 * checkout; the server builds the line from the offer itself.
 */
export interface StorefrontOrderBump {
  offerId: string;
  /** The offer's first line — what the order line is filed under (and what a shipping quote needs). */
  variantId: string;
  productId: string;
  productSlug: string | null;
  /** The merchant's heading, or null for the default one. */
  title: string | null;
  /** The offer's name. */
  name: string;
  productName: string;
  description: string | null;
  imageUrl: string | null;
  priceAmount: number;
  /** What the offer's contents cost one by one, when that is more than its price. */
  compareAtAmount: number | null;
  currency: string;
  lines: Array<{ variantId: string; quantity: number }>;
}

/** How a product listing may be sorted. "relevance" only means something with a search. */
export type StorefrontSort = "relevance" | "newest" | "price_asc" | "price_desc" | "name" | "position";
export type CatalogDefaultSort = Exclude<StorefrontSort, "relevance">;

/**
 * One sidebar filter, in order: the collection tree, a price range, tags,
 * every product option ("options"), or one option by name.
 */
export type CatalogFilter =
  | { key: "collections" }
  | { key: "price" }
  | { key: "tags" }
  | { key: "options" }
  | { key: "option"; name: string };

/** settings.storefront_catalog — sent whole on save; the storefront reads it as store.catalog. */
export interface StorefrontCatalogSettings {
  sidebar_enabled: boolean;
  default_sort: CatalogDefaultSort;
  filters: CatalogFilter[];
}

export const DEFAULT_CATALOG_SETTINGS: StorefrontCatalogSettings = {
  sidebar_enabled: true,
  default_sort: "newest",
  filters: [{ key: "collections" }, { key: "price" }, { key: "options" }, { key: "tags" }],
};

/** Query for the searchable, filterable listing (GET /store/:id/products). */
export interface StorefrontListingParams {
  search?: string;
  /** A collection id or slug; its sub-collections are included. */
  collection?: string;
  tags?: string[];
  /** Minor units. */
  minPrice?: number;
  maxPrice?: number;
  /** Option name → accepted values, e.g. { Size: ["M", "L"] }. */
  options?: Record<string, string[]>;
  sort?: StorefrontSort;
  page?: number;
  limit?: number;
  facets?: boolean;
}

export interface StorefrontFacets {
  collections: Array<{ id: string; name: string; slug: string; parentId: string | null; count: number }>;
  tags: Array<{ value: string; count: number }>;
  options: Array<{ name: string; values: Array<{ value: string; count: number }> }>;
  price: { min: number | null; max: number | null };
}

export interface StorefrontListing extends StorefrontProductList {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sort: StorefrontSort;
  /** Set when filtering by a collection. */
  collection?: StorefrontCollection & { parentId: string | null; imageUrl: string | null };
  /** From the top level down to the collection, inclusive. */
  breadcrumbs?: Array<{ id: string; name: string; slug: string }>;
  /** With a search: the same as `products`. */
  matches?: StorefrontProduct[];
  /** With a search, first page only: close products that did not match, never repeating one. */
  related?: StorefrontProduct[];
  facets?: StorefrontFacets;
}

/** GET /store/:id/products/suggest — at most eight rows, collections first. */
export interface StorefrontSuggestions {
  query: string;
  collections: Array<{ id: string; name: string; slug: string; imageUrl: string | null }>;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    priceAmount: string | null;
    currency: string | null;
  }>;
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
  /** Fields the shopper fills in when ordering; absent on older responses. */
  customFields?: CustomField[];
  /** Menu options (Size, Extras): active groups and choices; absent on older responses. */
  optionGroups?: import("./endpoints/menuOptions").StorefrontOptionGroup[];
  /** Whether it has menu options to pick (lists carry this, not the groups); absent on older responses. */
  hasOptionGroups?: boolean;
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
  /** Null for a top-level collection. */
  parentId?: string | null;
  position?: number;
  imageUrl?: string | null;
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
  /** The shopper's answers to the product's custom fields; null when none. */
  customizations?: Customization[] | null;
  /** The menu options picked, with current names and prices; null when none. */
  options?: import("./endpoints/menuOptions").MenuOptionsSnapshot | null;
}

// ---------------------------------------------------------------------
// Product custom fields — what the shopper fills in when ordering.
// ---------------------------------------------------------------------

export type CustomFieldType = "text" | "textarea" | "image";

/** A merchant's field definition; at most five per product. */
export interface CustomField {
  /** Stable key the answers are stored under: lowercase letters, digits, - and _. */
  id: string;
  type: CustomFieldType;
  /** At least one of the two is set. */
  label: { ar?: string; en?: string };
  placeholder?: { ar?: string; en?: string };
  required?: boolean;
  /** Text and textarea only: text ≤ 200, textarea ≤ 2000 (defaults 100 / 500). */
  maxLength?: number;
}

export const CUSTOM_FIELD_LIMITS = {
  maxFields: 5,
  text: { default: 100, max: 200 },
  textarea: { default: 500, max: 2000 },
} as const;

/** One answer as stored on a cart or order line, with the field's label as it was then. */
export interface Customization {
  fieldId: string;
  type: CustomFieldType;
  label: { ar: string; en: string };
  /** Text answers. */
  value?: string;
  /** Photo answers: the customer upload. */
  uploadId?: string;
  /** Staff responses only: a signed link that works for a few minutes. */
  url?: string | null;
  urlExpiresAt?: string;
  width?: number | null;
  height?: number | null;
  /** The photo is gone from storage. */
  missing?: boolean;
}

/** What the shopper sends: field id → text, or the id of an uploaded photo. */
export type CustomizationInput = Record<string, string>;

/** POST /store/:id/uploads — a shopper's photo, processed and waiting for an order. */
export interface CustomerUpload {
  uploadId: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  expiresAt: string;
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
  /** "pickup" when the store offers it: no address and no shipping fee (server-enforced). */
  deliveryMethod?: "delivery" | "pickup";
  /** The store's delivery area while it prices by zones; the fee comes from the server. */
  deliveryZoneId?: string;
  /**
   * 'card' / 'wallet' only when the store offers them (getStorefrontPaymentMethods);
   * otherwise 422 PAYMENT_METHOD_UNAVAILABLE, or VALIDATION_ERROR while online
   * payments are switched off platform-wide.
   */
  paymentMethod: "cod" | OnlineMethod | "bank_transfer";
  /** With "bank_transfer": which of the store's manual methods (getStoreManualPaymentMethods). */
  manualPaymentMethodId?: string;
  /** Which gateway, when more than one offers the method. */
  paymentProvider?: string;
  /** Online methods: where the gateway sends the shopper back to. */
  returnUrl?: string;
  /** The shopper agreed to keep the card (card payments; the gateway keeps it once paid). */
  saveCard?: boolean;
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
  item?: { variantId: string; offerId?: string; quantity?: number; customizations?: CustomizationInput; options?: import("./endpoints/menuOptions").MenuOptionsInput };
  /**
   * The shopper ticked the order bump. Accepted only when it is the bump this
   * checkout offers (422 ORDER_BUMP_INVALID otherwise); 409
   * ORDER_BUMP_UNAVAILABLE when it has just sold out or been withdrawn.
   */
  orderBump?: { offerId: string };
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
  /** Shipping weight in grams; null = not set ("No weight"). 0 is a real weight. */
  weightGrams: number | null;
  dimensions: VariantDimensions | null;
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

/** Why an offer can't be an order bump (GET /catalog/offers → bumpProblem). */
export type OrderBumpProblem = "not_found" | "inactive" | "no_price" | "no_lines" | "custom_fields";

/** One active offer of the store, for pickers (GET /catalog/offers). */
export interface WorkspaceOfferOption {
  id: string;
  name: string;
  priceAmount: string | null;
  currency: string;
  isDefault: boolean;
  productId: string;
  productName: string;
  imageUrl: string | null;
  lines: Array<{ variantId: string; quantity: number }>;
  /** null when it can be an order bump. */
  bumpProblem: OrderBumpProblem | null;
}

export interface CollectionSummary {
  id: string;
  workspaceId?: string;
  name: string;
  slug: string;
  description: string | null;
  rules: Record<string, unknown> | null;
  seo: Record<string, unknown>;
  /** The tree: null is a top-level collection (at most three levels). */
  parentId: string | null;
  /** Order among siblings, lowest first. */
  position: number;
  imageUrl: string | null;
  /** Products directly in it (list only). */
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductShippingMode = "standard" | "free" | "extra_fee";

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
  /**
   * How the product ships: the store's rates ("standard"), free, or the
   * store's rate plus `shippingExtraAmount` per unit ("extra_fee"). Optional
   * so a response from before the field reads as "standard".
   */
  shippingMode?: ProductShippingMode;
  /** Minor units, per unit shipped; set exactly when shippingMode is "extra_fee". */
  shippingExtraAmount?: string | number | null;
  /** Fields the shopper fills in when ordering; [] (or absent on older responses) for none. */
  customFields?: CustomField[];
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
  media?: ProductMedia[];
  /** The product's place in this collection, lowest first. */
  collectionPosition?: number;
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
  /** See Product.shippingMode. An extra fee needs "extra_fee"; other modes clear it. */
  shippingMode?: ProductShippingMode;
  shippingExtraAmount?: number | null;
  /** Sent whole; [] removes them all. A malformed or sixth field is refused (422). */
  customFields?: CustomField[];
  /**
   * Optional first variant, created with the product in one transaction so a
   * simple product is priced and stocked straight away. Money is integer
   * minor units; initial stock is recorded as a restock movement.
   */
  variant?: CreateProductVariantPayload;
}

/** Package dimensions in centimetres — all three or none. */
export interface VariantDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** Largest weight the API accepts, in grams (1 tonne). */
export const MAX_WEIGHT_GRAMS = 1_000_000;

export interface CreateProductVariantPayload {
  priceAmount: number;
  compareAtAmount?: number | null;
  sku?: string | null;
  stockOnHand?: number;
  allowOverselling?: boolean;
  weightGrams?: number | null;
  dimensions?: VariantDimensions | null;
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
  dimensions?: VariantDimensions | null;
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
  /** null clears the weight. */
  weightGrams?: number | null;
  dimensions?: VariantDimensions | null;
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
  /** Null or absent: a top-level collection. A cycle or a fourth level is refused (422). */
  parentId?: string | null;
  /** Absent: after its siblings. */
  position?: number;
  imageUrl?: string | null;
}

/** POST /collections/reorder — each listed collection's parent and position. */
export interface CollectionReorderItem {
  id: string;
  parentId?: string | null;
  position?: number;
}

/** GET /catalog/option-names — option names in use, most used first. */
export interface CatalogOptionName {
  name: string;
  productCount: number;
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
/** Paid through the store's gateway: valU installments and kiosk (Aman / Masary cash) besides card and wallet. */
export type OnlineMethod = "card" | "wallet" | "valu" | "kiosk";
export type PaymentMethod = "cod" | OnlineMethod | "bank_transfer";

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
  /** One unit of the line (one bundle for an offer); null when unknown or placed before weights were stored. */
  unitWeightGrams?: number | null;
  /** The shopper's answers to the product's custom fields; photos carry a short-lived `url` for staff. */
  customizations?: Customization[] | null;
  /** The menu options the line was sold with: names and prices as charged. */
  optionsSnapshot?: import("./endpoints/menuOptions").MenuOptionsSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | "initialized"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "partially_refunded"
  /** Online attempt: the order's payment window closed first. */
  | "expired"
  /** Online attempt: replaced by a retry, or the shopper switched to COD. */
  | "cancelled";

/** One payment attempt (online) or payment record (COD / manual). */
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
  /** Gateway attempts only. */
  method?: OnlineMethod | null;
  mode?: GatewayMode | null;
  providerOrderId?: string | null;
  providerTransactionId?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  lastInquiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RefundStatus = "pending" | "processed" | "failed";

export interface Refund {
  id: string;
  orderId: string;
  workspaceId: string;
  paymentId: string | null;
  amount: string;
  reason: string | null;
  /** pending: sent to the gateway, the answer is not final yet. */
  status: RefundStatus;
  /** 'gateway': made in the gateway's own dashboard, reported by webhook. */
  source: "merchant" | "gateway";
  providerRefundReference: string | null;
  failureReason: string | null;
  /**
   * A stable reason for a failed gateway refund, when there is one:
   * REFUND_INSUFFICIENT_GATEWAY_BALANCE — the gateway pays refunds from the
   * merchant's available balance there (Kashier) and it could not cover this.
   */
  failureCode: string | null;
  processedAt: string | null;
  creditNoteId: string | null;
  processedByUserId: string | null;
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
  /**
   * The merchant's courier account a booking went through. Null for manual
   * shipments and once that account is disconnected.
   */
  carrierAccountId?: string | null;
  /**
   * How a courier-booked shipment was cancelled: "api" (the courier's cancel
   * call), "manual_ack" (the courier has no cancel API; the merchant
   * cancelled it in the courier's dashboard and said so). Null otherwise.
   */
  cancelMode?: ShipmentCancelMode | null;
  /** manual_ack only: the user id that made the statement, and when. */
  cancelAcknowledgedBy?: string | null;
  cancelAcknowledgedAt?: string | null;
  /** When the status job next reads it from the courier; null: never. */
  nextPollAt?: string | null;
  /** The last successful scheduled read from the courier. */
  lastPolledAt?: string | null;
  /** Consecutive failed scheduled reads. */
  pollFailures?: number;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentCancelMode = "api" | "manual_ack";

/** The courier's own view of a shipment, as the backend stores it. */
export interface ShipmentCarrierResponse {
  /** Present on every courier-booked shipment — its presence is what marks one. */
  carrierShipmentId?: string;
  trackingNumber?: string | null;
  labelUrl?: string | null;
  /**
   * The drop-off address as the courier's ids: city/district couriers keep
   * `{ cityId, districtId, zoneId }`, any other courier `{ path }`, one id
   * per address level, top first. `{ names }` when the merchant typed the
   * courier's names (the courier has no address list for this account).
   */
  address?:
    | { cityId: string; districtId: string; zoneId: string | null }
    | { path: string[] }
    | { names: string[] };
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

export type ManualMethodKind = "instapay" | "wallet";
export type ManualPaymentStatus = "awaiting_proof" | "submitted" | "approved" | "rejected";

/** One of the store's own manual methods, as the merchant manages it. */
export interface StoreManualPaymentMethod {
  id: string;
  kind: ManualMethodKind;
  label: string;
  accountNumber: string;
  /** Null when the merchant left it empty: show nothing link-related. */
  paymentLink: string | null;
  instructions: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** An active manual method as the checkout lists it. */
export type StorefrontManualMethod = Pick<StoreManualPaymentMethod, "id" | "kind" | "label" | "accountNumber" | "paymentLink" | "instructions">;

/** The shopper's view of their order's manual payment (X-Payment-Token). */
export interface ShopperManualPayment {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
  status: ManualPaymentStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  /** True while a (new) proof may be sent. */
  canSubmit: boolean;
  method: Omit<StorefrontManualMethod, "id">;
}

/** Staff view: on the order and on its confirmation task. */
export interface OrderManualPayment {
  id: string;
  status: ManualPaymentStatus;
  /** A proof waits for approve / reject. */
  awaitingReview: boolean;
  kind: ManualMethodKind;
  label: string;
  accountNumber: string;
  payerNumber: string | null;
  /** A short-lived signed link to the screenshot. */
  proofUrl: string | null;
  proofUrlExpiresAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  rejectionReason: string | null;
}

export interface Order {
  id: string;
  /** Paid by one of the store's manual methods (paymentMethod "bank_transfer"); absent otherwise. */
  manualPayment?: OrderManualPayment | null;
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
  /** 'pickup': collected from the store (no address, no fee); null/absent = delivered. */
  deliveryMethod?: "delivery" | "pickup" | null;
  discountsSnapshot: Array<Record<string, unknown>>;
  notes: string | null;
  riskFlags: string[];
  cancelledAt: string | null;
  cancellationReason: string | null;
  linkedFromOrderId: string | null;
  /** Weight at checkout. null on older orders, or when an item had no weight and no default applied. */
  totalWeightGrams?: number | null;
  /** The weight tier at checkout; null when the store had no tiers. */
  weightTierSnapshot?: OrderWeightTier | null;
  /** True when some item's weight came from the store's default item weight. */
  weightEstimated?: boolean;
  /** How shippingAmount was reached; null on orders placed before it was recorded. */
  shippingSnapshot?: OrderShippingSnapshot | null;
  /** When the current confirmation happened; null while not confirmed (and on unconfirmed older orders). */
  confirmedAt?: string | null;
  /**
   * The gateway an online (card / wallet) order is paid through — its latest
   * attempt's provider. null for cash on delivery. On the list and on GET one.
   */
  paymentProvider?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  /**
   * Derived pipeline stage. Present on the list and on GET one; absent on
   * create/cancel/update responses.
   */
  stage?: OrderStage;
  /** When the order became a sale (invoice, discount, customer count). null while an online order is unpaid. */
  completedAt?: string | null;
  /** Unpaid online order: when it stops holding stock. */
  paymentExpiresAt?: string | null;
  /** Present on detail (GET one) only, oldest first. */
  payments?: Payment[];
  refunds?: Refund[];
  shipments?: Shipment[];
  /** Present on detail (GET one) only; null for an order that never had a task (prepaid). */
  confirmationTask?: OrderConfirmationTaskSummary | null;
  /** Detail only: funnel offers taken after this order's offer window closed, placed as their own orders. */
  linkedOrders?: LinkedOrderSummary[];
  /** Detail only: the order this one is a late funnel offer of. */
  linkedFromOrder?: { id: string; orderNumber: string } | null;
  /**
   * Locked orders on: true when the customer's details (name, phones, email,
   * the address below the governorate, notes) come hidden as "••••" until the
   * store renews or tops up. Absent while the switch is off.
   */
  contactLocked?: boolean;
  lockReason?: OrderLockReason;
}

/** What a hidden customer field reads ("••••"): shown as hidden, never as empty. */
export const LOCKED_MASK = "••••";

export interface LinkedOrderSummary {
  id: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
}

/** Which shipping rule priced an order or a quote (backend shipping/shippingRules.js). */
export type ShippingRule =
  | "no_destination"
  | "offer_override"
  | "all_items_free"
  | "free_threshold"
  | "governorate_rate"
  | "zone_rate"
  | "zone_tier_price"
  | "default_rate"
  | "no_rate";

export interface OrderShippingSnapshot {
  rule: ShippingRule;
  pricingMode: ShippingPricingMode;
  /** The destination's rate, before extra fees. */
  baseAmount: number;
  /** The sum of the order's "extra fee" products. */
  extraFeesAmount: number;
  /** The governorate code a governorate price matched, else null. */
  governorate: string | null;
  freeShippingThresholdAmount: number | null;
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
  "awaiting_payment",
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

/** Server-side sorts for the orders list (and, with "default", the queue). */
export const ORDER_SORTS = ["newest", "oldest", "total_desc", "total_asc"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export interface OrderListParams extends OrderSearchParams {
  /** 1–200, default 50. */
  limit?: number;
  /** Default "newest". A cursor only pages the sort it came from. */
  sort?: OrderSort;
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
   * after a 422 CARRIER_ADDRESS_UNMATCHED (or when the merchant picks it);
   * or the courier's names as typed, after a 422
   * CARRIER_ADDRESS_NAMES_REQUIRED.
   */
  carrierAddress?: CarrierAddressInput;
  notes?: string;
  /** Courier bookings only: book as this weight tier instead of the order's. */
  tierId?: string;
}

/**
 * The drop-off address in the courier's own ids. `{ cityId, districtId }`
 * for a city/district courier; `{ path }` — one id per address level, top
 * first, exactly `addressLevels.length` of them — for any courier.
 * `{ names }` — the courier's own names as the merchant typed them, one per
 * level, top first — only for a courier with `typedAddressNames` whose
 * connection has `verification.locationList: "unavailable"` (anywhere else
 * it is 422 VALIDATION_ERROR). Sent as typed; the courier checks them.
 */
export type CarrierAddressInput =
  | { cityId: string; districtId: string }
  | { path: string[] }
  | { names: string[] };

export interface UpdateShipmentPayload {
  status?: ShipmentStatus;
  waybillNumber?: string;
  trackingUrl?: string;
  /**
   * With status "cancelled" on a booking whose courier has no cancel API:
   * the merchant cancelled it in the courier's dashboard. Without it that
   * PATCH is refused with 409 CARRIER_MANUAL_CANCEL_REQUIRED.
   */
  acknowledgeManualCancel?: boolean;
}

/** Options shared by the requests that may cancel a courier booking. */
export interface ManualCancelAcknowledgement {
  /**
   * The merchant cancelled the order's booking(s) in the courier's own
   * dashboard (couriers without a cancel API). Send only after a 409
   * CARRIER_MANUAL_CANCEL_REQUIRED and the merchant's explicit confirmation.
   */
  acknowledgeManualCancel?: boolean;
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
// A work queue for phone-confirming COD orders before fulfilment.
//
//   queued ─claim─▶ in_progress ─outcome─▶ done      (confirmed / rejected)
//                        └──────outcome─▶ queued    (unreachable / postponed,
//                                                    `nextRetryAt` set)
//
// A claim locks the task to one agent until `lockExpiresAt`
// (CONFIRMATION_LOCK_TTL_MINUTES on the server, 15 by default). An expired
// lock returns the task to Pending on the next read; the holder or a manager
// can also release it. A done task can be corrected (confirmed ⇄ rejected)
// by a manager while the order hasn't shipped — `correctable` says whether
// that will succeed. Each task carries its `order` with the order's `items`:
// the bare order row, no `stage`, `payments` or `shipments`.
// ---------------------------------------------------------------------

export type ConfirmationOutcome = "confirmed" | "rejected" | "unreachable" | "postponed";
export type ConfirmationTaskStatus = "queued" | "in_progress" | "done";
/** The queue's tabs. `pending` lists `queued` tasks, due callbacks first. */
export type ConfirmationQueueTab = "pending" | "in_progress" | "done";
/** "default" is each tab's own order; the rest sort the tab by its orders. */
export type ConfirmationQueueSort = "default" | OrderSort;

/** The queue's assignment filter: tasks assigned to me, to nobody, or to one member (a user id). */
export type ConfirmationAssigneeFilter = "me" | "unassigned" | (string & {});

export interface ConfirmationQueueParams {
  status?: ConfirmationQueueTab;
  mine?: boolean;
  assignedTo?: ConfirmationAssigneeFilter;
  cursor?: string;
  limit?: number;
  sort?: ConfirmationQueueSort;
}
/** Where an outcome was recorded. */
export type ConfirmationAttemptSource = "queue" | "order_page" | "correction";
/** How the customer was reached on an attempt. */
export type ConfirmationChannel = "call" | "whatsapp" | "other";

export interface ConfirmationUser {
  id: string;
  fullName: string;
}

export interface ConfirmationAttempt {
  id: string;
  taskId: string;
  agentUserId: string;
  agent: ConfirmationUser | null;
  outcome: ConfirmationOutcome;
  notes: string | null;
  source: ConfirmationAttemptSource;
  /** On a correction, the outcome it replaced. */
  previousOutcome: ConfirmationOutcome | null;
  /** Null on attempts recorded before channels existed, or when none was picked. */
  channel: ConfirmationChannel | null;
  createdAt: string;
}

export interface ConfirmationTask {
  id: string;
  workspaceId: string;
  orderId: string;
  status: ConfirmationTaskStatus;
  lockedByUserId: string | null;
  lockedAt: string | null;
  /** Who holds the lock; set while the task is in progress. */
  lockedBy: ConfirmationUser | null;
  /** When the lock lapses; null unless in progress. May be in the past until the next read. */
  lockExpiresAt: string | null;
  /** The agent a manager handed the task to; only they (or a manager) may claim it. Null is open to all. */
  assignedToUserId: string | null;
  assignedTo: ConfirmationUser | null;
  assignedAt: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  /**
   * A funnel order's task waits until its offer window closes (the shopper may
   * still add to the order); null is available at once.
   */
  availableAt?: string | null;
  /** True while availableAt lies ahead: listed, but nobody can claim it yet. */
  waitingForOffers?: boolean;
  outcome: ConfirmationOutcome | null;
  rejectionReason: string | null;
  /** When the task reached `done`. */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Oldest first. */
  attempts: ConfirmationAttempt[];
  /** A done task whose outcome a manager may still correct. */
  correctable: boolean;
  order: ConfirmationTaskOrder;
}

/** The order on a confirmation task: the order row plus its items. */
export type ConfirmationTaskOrder = Omit<Order, "stage" | "payments" | "shipments" | "confirmationTask">;

export interface ConfirmationQueuePage {
  tasks: ConfirmationTask[];
  /** Pass back as `cursor` for the next page; null on the last one. */
  nextCursor: string | null;
}

export interface ConfirmationQueueCounts {
  pending: number;
  /** Pending tasks with no callback scheduled, or one that is due. */
  pendingDue: number;
  /** Pending funnel orders still in their offer window. */
  waitingForOffers?: number;
  inProgress: number;
  inProgressMine: number;
  done: number;
  /** Open tasks (pending or in progress) assigned to the viewer. */
  assignedToMe: number;
  /** Open tasks nobody is assigned to. */
  unassigned: number;
}

/** A member a confirmation task may be assigned to (their role can confirm orders). */
export interface ConfirmationAssignee {
  id: string;
  fullName: string;
  email: string;
  role: { key: string; name: string };
}

/** POST /confirmation-tasks/assign — the tasks now carrying the assignment, and the ones left alone. */
export interface AssignConfirmationTasksResult {
  assignedTo: ConfirmationUser | null;
  tasks: ConfirmationTask[];
  skipped: Array<{ taskId: string; code: "NOT_FOUND" | "TASK_ALREADY_DONE" }>;
}

/** One attempt as the order page lists it. */
export interface OrderConfirmationAttempt {
  id: string;
  outcome: ConfirmationOutcome;
  channel: ConfirmationChannel | null;
  source: ConfirmationAttemptSource;
  notes: string | null;
  createdAt: string;
  agent: ConfirmationUser | null;
}

/** GET order detail: the order's current confirmation task, if it has one. */
export interface OrderConfirmationTaskSummary {
  id: string;
  status: ConfirmationTaskStatus;
  outcome: ConfirmationOutcome | null;
  attemptCount: number;
  nextRetryAt: string | null;
  availableAt?: string | null;
  waitingForOffers?: boolean;
  completedAt: string | null;
  /** Set only while another claim is live. */
  lockedBy: ConfirmationUser | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  assignedTo?: ConfirmationUser | null;
  assignedAt?: string | null;
  /** Oldest first. */
  attempts?: OrderConfirmationAttempt[];
}

export interface RecordConfirmationOutcomePayload {
  outcome: ConfirmationOutcome;
  notes?: string;
  rejectionReason?: string;
  channel?: ConfirmationChannel;
}

export interface CorrectConfirmationOutcomePayload {
  outcome: "confirmed" | "rejected";
  /** Why the outcome changed; also the rejection reason when correcting to rejected. */
  reason: string;
  notes?: string;
  /**
   * Correcting to rejected cancels the order's courier booking; for a courier
   * without a cancel API the merchant confirms they cancelled it there.
   */
  acknowledgeManualCancel?: boolean;
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

// ---------------------------------------------------------------------
// Weight tiers + tier pricing (auth, /workspaces/:workspaceId/shipping/...)
// Grams everywhere. A tier covers (fromGrams, upToGrams]; the first starts
// at 0; only the last may be open-ended (upToGrams null).
// ---------------------------------------------------------------------

export type ShippingPricingMode = "rates" | "weight_tiers";

export interface WeightTier {
  id: string;
  position: number;
  fromGrams: number;
  upToGrams: number | null;
}

/** Stored on an order at checkout. */
export interface OrderWeightTier extends WeightTier {
  /** "weight_over_last_tier" when the weight was above a closed last tier (charged as that tier). */
  flags: string[];
}

export interface ZoneTierPrice {
  zoneId: string;
  tierId: string;
  amount: number;
}

/** GET /shipping/weight-tiers */
export interface WeightTierSettings {
  pricingMode: ShippingPricingMode;
  defaultItemWeightGrams: number | null;
  tiers: WeightTier[];
  prices: ZoneTierPrice[];
  /** Active variants of live physical products with no weight set. */
  variantsWithoutWeight: number;
}

/** PUT /shipping/weight-tiers — the whole set, in order. Keep `id` to keep a tier. */
export interface ReplaceWeightTiersPayload {
  tiers: Array<{ id?: string; upToGrams: number | null }>;
}

export interface TierPriceProposal extends ZoneTierPrice {
  /** "rates": from the zone's current rates; "default_rate": the store's default rate. */
  basis: "rates" | "default_rate";
}

export interface SetPricingModePayload {
  mode: ShippingPricingMode;
  defaultItemWeightGrams?: number;
  /** Fill empty zone × tier cells from the current rates (default true). */
  prefill?: boolean;
  /** Only return the proposals; nothing is written. */
  dryRun?: boolean;
}

export interface SetPricingModeResult {
  pricingMode: ShippingPricingMode;
  defaultItemWeightGrams: number | null;
  dryRun: boolean;
  /** dryRun only. */
  proposals?: TierPriceProposal[];
  /** Cells actually filled by the switch. */
  prefilled?: TierPriceProposal[];
}

/** POST /store/:ws/shipping-quote — `items`, or the cart named by X-Cart-Token. */
export interface ShippingQuotePayload {
  /** Defaults to "EG". */
  country?: string;
  /** The same province string the checkout sends in shippingAddress.province. */
  governorate?: string | null;
  items?: Array<{ variantId: string; offerId?: string; quantity?: number }>;
}

export interface FreeShippingProgress {
  thresholdAmount: number;
  /** How much more subtotal ships free; 0 once qualified. */
  remainingAmount: number;
  qualified: boolean;
}

export interface ShippingQuote {
  pricingMode: ShippingPricingMode;
  amount: number;
  currency: string;
  subtotal: number;
  weightGrams: number | null;
  weightEstimated: boolean;
  tier: OrderWeightTier | null;
  /*
   * The fields below are newer than the quote itself; optional so a
   * storefront deployed before the backend still reads an older answer.
   */
  /** Which rule priced it. */
  rule?: ShippingRule;
  baseAmount?: number;
  extraFeesAmount?: number;
  governorate?: string | null;
  /** null when the store has no free-shipping threshold. */
  freeShipping?: FreeShippingProgress | null;
  /** The amount depends on the governorate — say so until one is chosen. */
  destinationRequired?: boolean;
  /** false: the store prices no shipping (every order is charged 0). */
  configured?: boolean;
}

/** GET/PATCH /shipping/settings — the store's prices and default courier. */
export interface ShippingSettings {
  pricingMode: ShippingPricingMode;
  defaultRateAmount: number | null;
  freeShippingThresholdAmount: number | null;
  /** Governorate code -> price. Rate pricing only. */
  governorateRates: Record<string, number>;
  /** "manual" or a courier code; null = no preference. */
  defaultCarrierCode: string | null;
  /** The only governorates the store delivers to; [] = everywhere. Older servers leave it out. */
  servedGovernorates?: string[];
  /** Pickup from the store; enabled false = off. Older servers leave it out. */
  storePickup?: StorePickupSettings;
  /** Checkout prices delivery by the store's delivery zones. Older servers leave it out. */
  deliveryZonesEnabled?: boolean;
  /** Opening hours in Africa/Cairo. Older servers leave it out. */
  storeHours?: StoreHoursSettings;
  /** The usual delivery time in minutes; null = not shown. */
  deliveryEtaMinutes?: number | null;
}

export interface StoreHoursSettings {
  enabled: boolean;
  /** The "accepting orders" switch. */
  override: "auto" | "open" | "closed";
  /**
   * Sunday first; a close at or before the open runs past midnight. `periods`:
   * up to 3 a day (open/close mirror the first); older servers leave it out.
   */
  days: Array<{ closed: boolean; open: string; close: string; periods?: StoreHoursPeriod[] }>;
  message: string;
}

export interface StoreHoursPeriod {
  open: string;
  close: string;
}

export interface StorePickupSettings {
  enabled: boolean;
  address: string;
  phone: string;
  note: string;
}

export interface ShippingGovernorate {
  code: string;
  ar: string;
  en: string;
}

export interface ShippingSettingsResponse {
  settings: ShippingSettings;
  governorates: ShippingGovernorate[];
  /** Couriers this store may choose, and whether each is connected. */
  carriers: Array<{ code: string; name: string; connected: boolean }>;
}

/** Every field optional; null clears; `governorateRates` replaces the whole map. */
export type UpdateShippingSettingsPayload = Partial<{
  defaultRateAmount: number | null;
  freeShippingThresholdAmount: number | null;
  governorateRates: Record<string, number>;
  defaultCarrierCode: string | null;
  /** [] or null = deliver everywhere. */
  servedGovernorates: string[] | null;
  storePickup: StorePickupSettings | null;
  deliveryZonesEnabled: boolean | null;
  storeHours: StoreHoursSettings | null;
  deliveryEtaMinutes: number | null;
}>;

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
  /** Locked orders on: every order this customer placed is locked, so their details come "••••" and can't be edited. */
  contactLocked?: boolean;
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

/** Feature keys a plan can grant. Mirrors the `plans.features` JSONB and the backend's billing/featureCatalog.js. */
export type PlanFeatureKey =
  | "custom_domain"
  | "funnels"
  | "whatsapp_confirmation"
  | "abandoned_cart"
  | "multi_warehouse"
  | "api_access"
  | "staff_accounts"
  | "advanced_analytics"
  // On top of advanced_analytics: the Visitors section's visits, campaigns and governorates.
  | "visitor_insights"
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
  /** Not subscribed yet, while subscriptions are required to go live. */
  draft?: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Lifetime orders placed in this workspace. */
  orderCount: number;
  /** Suspended by a platform admin (independent of billing). */
  suspended?: boolean;
  suspendedAt?: string | null;
  billingPhase?: BillingPhase;
  /** Storefront unavailable and new products/funnels blocked, for either reason. */
  restricted?: boolean;
  /** Who owns it. */
  owner?: { id: string; username: string | null; fullName: string; email: string } | null;
}

/** What set a store's current subscription period. */
export type AdminPeriodSource = "manual_admin" | "payment" | "special_terms" | "trial" | "other" | "draft";

export type AdminManualAction = "activate" | "change_plan" | "extend" | "end_now";

export interface AdminManualChange {
  id: string;
  action: AdminManualAction;
  source: "manual_admin";
  planBefore: { id: string; name: string | null } | null;
  planAfter: { id: string; name: string | null } | null;
  statusBefore: string | null;
  statusAfter: string | null;
  periodStartBefore: string | null;
  periodEndBefore: string | null;
  periodStartAfter: string | null;
  periodEndAfter: string | null;
  note: string;
  actor: { id: string; fullName: string } | null;
  createdAt: string;
}

/** GET /admin/workspaces/:id/subscription */
export interface AdminManualSubscription {
  subscription: {
    id: string;
    plan: { id: string; name: string; code: string } | null;
    /** As the lifecycle sees it (a lapsed period counts as past_due). */
    status: string;
    storedStatus: string;
    phase: BillingPhase | string;
    billingCycle: BillingCycle;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    restrictsAt: string | null;
    source: AdminPeriodSource;
    /** Not subscribed yet: Activate takes it live. */
    draft?: boolean;
    /** What one period costs the merchant (backend billing/manualPricing). */
    pricingKind?: SubscriptionPricingKind;
    discountPercent?: number | null;
    priceOverrideAmount?: number | null;
    /** One billing period at the price above, minor units. */
    effectivePrice?: number;
    currency?: string | null;
    /** A free or discounted period that ran out (moved to past_due, not renewed). */
    pricingExpiredAt?: string | null;
  };
  /** The owner's stores and this store's funnels this month, against the plan. */
  limits?: PlanLimits;
  /** A charge already open — manual actions leave it alone. */
  openCharge: { id: string; amount: string | number; currency: string; periodStart: string; periodEnd: string } | null;
  history: AdminManualChange[];
}

/** POST …/subscription/{activate|change-plan|extend|end} */
export interface AdminManualActionResult extends AdminManualSubscription {
  change: AdminManualChange;
  /** True when an Idempotency-Key replayed an earlier identical request. */
  replayed: boolean;
}

export type AdminDuration = { months: number } | { days: number };

export interface AdminActivateSubscriptionInput {
  planId: string;
  startsAt?: string;
  duration?: AdminDuration;
  endsAt?: string;
  billingCycle?: BillingCycle;
  note: string;
}

export interface AdminFeatureOverride {
  id: string;
  featureKey: PlanFeatureKey;
  mode: "grant" | "deny";
  value: unknown;
  expiresAt: string | null;
  reason: string;
  grantedBy: { id: string; fullName: string } | null;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: { id: string; fullName: string } | null;
  revokeReason: string | null;
  state: "active" | "expired" | "revoked";
}

/**
 * One entry of the backend's feature catalogue (billing/featureCatalog.js),
 * served to the console with the plans: the key, its names, and whether the
 * feature exists today. An unavailable one can't be added to a plan (422
 * PLAN_FEATURE_NOT_AVAILABLE) and is never shown to merchants or visitors.
 */
export interface PlanFeatureCatalogEntry {
  key: PlanFeatureKey;
  type: "boolean";
  available: boolean;
  label: { en: string; ar: string };
}

/** `GET /admin/plans`: every plan in the pricing page's order, and the catalogue. */
export interface AdminPlansWithCatalog {
  plans: AdminPlan[];
  featureCatalog: PlanFeatureCatalogEntry[];
}

/** 403 PLAN_FEATURE_REQUIRED's details: the feature the store's plan lacks. */
export interface PlanFeatureRequiredDetails {
  feature: PlanFeatureKey;
  label: { en: string; ar: string };
}

/** One catalogue feature for a store: enabled or not, and why. */
export interface AdminWorkspaceFeature {
  key: PlanFeatureKey;
  type: "boolean";
  /** From the catalogue (servers from before it omit them). */
  available?: boolean;
  label?: { en: string; ar: string };
  inPlan: boolean;
  enabled: boolean;
  source: "plan" | "override" | "none";
  override: AdminFeatureOverride | null;
  expiredOverride: AdminFeatureOverride | null;
}

export interface AdminWorkspaceFeatures {
  features: AdminWorkspaceFeature[];
  /** Every override the store has had, newest first. */
  overrides: AdminFeatureOverride[];
}

/** A store in a user search row: theirs, or one they belong to. */
export interface AdminUserStore {
  id: string;
  name: string;
  slug: string;
  status: string;
  /** "owner", or the member's role key. */
  role: string;
  /** This store is what matched the search. */
  matched: boolean;
  subscription: {
    status: string;
    phase: BillingPhase | string;
    plan: string | null;
    planId: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

/** One account in GET /admin/users. */
export interface AdminUserRow {
  id: string;
  username: string | null;
  fullName: string;
  email: string;
  status: string;
  platformRole: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerified: boolean;
  /** Soft-deleted from the console (anonymised, status suspended). */
  deleted?: boolean;
  workspaces: AdminUserStore[];
}

export interface AdminUserSearchPage {
  users: AdminUserRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/** Where an account came from: the first marketing-site visit of the session it signed up from. */
export interface AdminUserAcquisition {
  landingPath: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  firstVisitAt: string;
  signedUpAt: string;
  secondsBeforeSignup: number;
}

/** GET /admin/users/:id */
export interface AdminUserDetail extends AdminUserRow {
  phone: string | null;
  usernameChangedAt: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  deletedAt?: string | null;
  /** Null when the account signed up without a tracked site visit (or before site analytics). */
  acquisition?: AdminUserAcquisition | null;
}

/** POST /admin/users/:id/{suspend,unsuspend,delete} */
export interface AdminUserModeration {
  id: string;
  status: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  suspendedStores?: string[];
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
  /** Stores one owner may have; null = unlimited. */
  maxStores: number | null;
  /** Funnels one store may make a month (Cairo time); null = unlimited. */
  maxFunnelsPerMonth: number | null;
  /** On the marketing site and at sign-up. */
  isPublic: boolean;
  displayOrder: number;
  /** The pay-per-order fee for one order, minor units; 0 = none. An API from before it sends nothing. */
  perOrderFee?: number;
  /** Pay per order: orders free before any fee (0 = none). */
  walletFreeOrders?: number;
  /** Pay per order: how far below zero the balance may go, minor units; null = the fixed overdraft (the store stops). */
  walletDebtLimit?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminPlanInput = Omit<
  AdminPlan,
  | "id"
  | "currency"
  | "createdAt"
  | "updatedAt"
  | "maxStores"
  | "maxFunnelsPerMonth"
  | "isPublic"
  | "displayOrder"
  | "perOrderFee"
  | "walletFreeOrders"
  | "walletDebtLimit"
> & {
  id?: string;
  currency?: string;
  maxStores?: number | null;
  maxFunnelsPerMonth?: number | null;
  isPublic?: boolean;
  displayOrder?: number;
  /** Only on a plan priced 0 a month, in EGP (422 PER_ORDER_FEE_NOT_ALLOWED). */
  perOrderFee?: number;
  walletFreeOrders?: number;
  walletDebtLimit?: number | null;
};

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused"
  | "draft";

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
  /** paid (plan price), free (a gift) or discounted — set with a manual Activate. */
  pricingKind?: SubscriptionPricingKind;
  discountPercent?: number | null;
  priceOverrideAmount?: number | null;
  /** One billing period as the merchant pays it, minor units. */
  effectivePrice?: number;
  pricingExpiredAt?: string | null;
  /** Monthly run rate in minor units at the effective price; 0 unless active/past_due, 0 when free. */
  mrr: number;
  createdAt: string;
}

export type SubscriptionPricingKind = "paid" | "free" | "discounted";

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

// ---------------------------------------------------------------------------
// Platform admin — risk (/admin/risk/*)
// ---------------------------------------------------------------------------

/** An identifier kind the platform blocklist and the risk signals know. */
export type AdminRiskIdentifierType = "phone" | "email" | "address";

/** The address an address block is fingerprinted from. */
export interface AdminRiskAddress {
  country: string;
  province?: string | null;
  city: string;
  addressLine: string;
}

/**
 * One platform blocklist entry. `value` is the normalized identifier order
 * creation compares against (digits for a phone, lowercase for an email, a
 * 32-hex fingerprint for an address); `label` is the human-readable form.
 */
export interface AdminBlocklistEntry {
  id: string;
  type: AdminRiskIdentifierType;
  value: string;
  label: string;
  reason: string;
  /** Null = never expires. */
  expiresAt: string | null;
  /** Derived from `expiresAt` on the server. An expired entry no longer matches. */
  status: "active" | "expired";
  createdById: string | null;
  /** The author's name (or email), null when the user has since been deleted. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBlocklistParams {
  type?: AdminRiskIdentifierType;
  status?: "active" | "expired" | "all";
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AdminBlocklistPage {
  entries: AdminBlocklistEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * `POST /admin/risk/blocklist`. A phone or an email goes in `value`, an
 * address in `address`. Blocking an identifier that is already listed
 * updates its reason and expiry (the response then has `created: false`).
 */
export interface AdminBlockPayload {
  type: AdminRiskIdentifierType;
  value?: string;
  address?: AdminRiskAddress;
  reason: string;
  expiresAt?: string | null;
  source?: "manual" | "signal";
}

export interface AdminBlockResult {
  entry: AdminBlocklistEntry;
  created: boolean;
}

export interface AdminBlocklistUpdate {
  reason?: string;
  expiresAt?: string | null;
}

export type AdminRiskSignalReason = "multi_store" | "high_refusal";

export interface AdminRiskSignal {
  type: AdminRiskIdentifierType;
  /** The normalized identifier (same form as a blocklist entry's `value`). */
  value: string;
  /** A phone as last typed, an email, or an address in words. */
  label: string;
  /** Exactly what to POST (plus a reason) to block this identifier. */
  block: { type: AdminRiskIdentifierType; value?: string; address?: AdminRiskAddress };
  workspaceCount: number;
  orderCount: number;
  cancelledCount: number;
  returnedCount: number;
  refusedCount: number;
  /** refusedCount / orderCount, 0..1. */
  refusalRate: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  reasons: AdminRiskSignalReason[];
  /** Up to ten of the workspaces it ordered in. `name` is null for a deleted workspace. */
  workspaces: Array<{ id: string; name: string | null }>;
  blocked: boolean;
  blocklistEntryId: string | null;
}

export interface AdminRiskSignalParams {
  type?: AdminRiskIdentifierType;
  windowDays?: number;
  minWorkspaces?: number;
  minRefused?: number;
  limit?: number;
  offset?: number;
}

export interface AdminRiskSignalPage {
  signals: AdminRiskSignal[];
  total: number;
  limit: number;
  offset: number;
  thresholds: {
    type: AdminRiskIdentifierType;
    windowDays: number;
    minWorkspaces: number;
    minRefused: number;
    /** A fraction, 0..1. */
    minRefusalRate: number;
  };
}

// ---------------------------------------------------------------------------
// Platform admin — carrier and payment gateway registry (read-only)
// ---------------------------------------------------------------------------

/** 'present' | 'missing' | 'invalid' (set, but not 32 bytes of base64). Never the key. */
export type AdminCredentialsKeyState = "present" | "missing" | "invalid";

export interface AdminProviderConnections {
  /** Distinct workspaces with an account for this provider. */
  workspaces: number;
  active: number;
  invalid: number;
}

export interface AdminProviderHealthTarget {
  /** False when no API host is known — the check would answer `not_checkable`. */
  checkable: boolean;
  /** The host a check would reach, e.g. "app.bosta.co". */
  target: string | null;
}

export interface AdminCarrier {
  code: string;
  name: string;
  /** False for accounts whose adapter is no longer in the code. */
  registered: boolean;
  /** As CARRIERS_ENABLED / CARRIERS_BETA decide it on this server. */
  rollout: "enabled" | "beta" | "off";
  rolloutDetail: string;
  /** The adapter contract's capabilities; null for an unregistered code. */
  capabilities: {
    cancel: "api" | "manual";
    label: boolean;
    webhook: "per_shipment" | "account" | "none";
    webhookRefetch: boolean;
    polling: boolean;
    bulkStatus: boolean;
    addressLevels: string[];
    reserveNameWhenUnconnected: boolean;
    typedAddressNames: boolean;
    sandbox: boolean;
  } | null;
  connections: AdminProviderConnections;
  healthCheck: AdminProviderHealthTarget;
}

export interface AdminCarrierRegistry {
  carriers: AdminCarrier[];
  environment: {
    enabled: string[];
    beta: string[];
    betaWorkspaces: string[];
    /** Problems in the rollout variables, as the boot log reports them. */
    warnings: string[];
    credentialsKey: AdminCredentialsKeyState;
  };
}

export interface AdminPaymentGateway {
  code: string;
  name: string;
  registered: boolean;
  /**
   * Server-wide — there is no per-gateway switch:
   *   enabled       PAYMENTS_ONLINE_ENABLED on and the credentials key present
   *   connect_only  key present, online payments off (merchants may connect)
   *   off           no usable GATEWAY_CREDENTIALS_KEY
   */
  availability: "enabled" | "connect_only" | "off";
  availabilityDetail: string;
  capabilities: {
    methods: string[];
    currencies: string[];
    refunds: boolean;
    statusInquiry: boolean;
    webhook: { automatic: boolean } | null;
    methodsFromAccount: boolean;
  } | null;
  connections: AdminProviderConnections & { live: number; test: number };
  healthCheck: AdminProviderHealthTarget;
}

export interface AdminPaymentGatewayRegistry {
  gateways: AdminPaymentGateway[];
  environment: {
    onlineEnabled: boolean;
    credentialsKey: AdminCredentialsKeyState;
  };
}

// ---------------------------------------------------------------------------
// Platform admin — admin users (/admin/admins)
// ---------------------------------------------------------------------------

/**
 * A platform-console permission key (`overview.view`, `admins.manage`, …), or
 * `*` — every key, held by the creator role only. The full list comes from
 * `GET /admin/roles`; the backend's canonical list is
 * `core/security/platformPermissions.js`.
 */
export type PlatformPermission = string;

/** A platform role (`platform_roles`): data, not a fixed set. */
export interface AdminPlatformRole {
  key: string;
  name: string;
  description: string | null;
  /** Copied onto an account when the role is assigned. */
  defaultPermissions: PlatformPermission[];
}

export interface AdminRolesResponse {
  roles: AdminPlatformRole[];
  /** Every permission key, `*` excluded. */
  permissions: PlatformPermission[];
}

/** An account with a platform role. */
export interface AdminPlatformAdmin {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "suspended" | "pending_verification";
  lastLoginAt: string | null;
  createdAt: string;
  role: string;
  roleName: string;
  /** What the account can actually do; checks never look at the role. */
  permissions: PlatformPermission[];
  /** The signed-in viewer — who cannot edit or revoke themselves. */
  isYou: boolean;
}

export interface AdminGrantPayload {
  email: string;
  role: string;
  /** Omit for the role's default set. */
  permissions?: PlatformPermission[];
}

export interface AdminGrantResult {
  admin: AdminPlatformAdmin;
  /** False when the account already had that role (nothing changed). */
  granted: boolean;
}

// ---------------------------------------------------------------------------
// Platform admin — agents, referral codes, commissions (/admin/agents, ...)
// ---------------------------------------------------------------------------

export type ReferralDiscountType = "none" | "percentage" | "fixed";

/**
 * Where a subscription stands against its period end
 * (workspaces/workspaceAccessService):
 *   ok           more than 3 days left
 *   expiring     3 days or less left
 *   payment_due  past due while the period still runs
 *   grace        the period ended unpaid, less than a day ago
 *   restricted   more than a day past the period end, unpaid
 */
export type BillingPhase = "ok" | "expiring" | "payment_due" | "grace" | "restricted" | "draft";

/** A draft store's plan, and whether its owner can still take that plan's trial. */
export interface DraftPlan {
  planId: string | null;
  planName: string | null;
  trial: { eligible: boolean; days: number };
}

/** A plan's limits against what is used (null max = unlimited). */
export interface PlanLimits {
  stores: { used: number; max: number | null };
  funnelsThisMonth: { used: number; max: number | null; resetsAt: string };
}

/** `GET /workspaces/:id/access` — any member. */
export interface WorkspaceAccess {
  /** Storefront unavailable and new products/funnels blocked. */
  restricted: boolean;
  /**
   * Why: a manual suspension, an unpaid subscription past its grace day, or
   * (pay-per-order) a balance that can't pay the next order's fee.
   */
  reasons: Array<"suspended" | "billing" | "balance">;
  billing: {
    phase: BillingPhase;
    status: SubscriptionStatus | null;
    trialing: boolean;
    periodEnd: string | null;
    /** periodEnd + 1 day: when an unpaid store becomes restricted. */
    restrictsAt: string | null;
    /** False when billing restrictions only warn (BILLING_RESTRICTIONS=warn). */
    enforced: boolean;
  };
  suspension: { suspended: boolean; since: string | null };
  /** Made while subscriptions are required to go live, and not subscribed yet. */
  draft?: boolean;
  /** Only on a draft. */
  draftPlan?: DraftPlan;
  /** The pay-per-order balance; null (or absent, from an older API) when the store pays no order fee. */
  wallet?: WalletState | null;
  /**
   * Locked orders are on (ORDERS_LOCK_ENABLED): an unpaid subscription or an
   * empty balance hides new orders' customer details instead of closing the
   * store. Absent from an API from before it (= off).
   */
  ordersLock?: boolean;
  /** Whether shoppers get the "unavailable" page; false while the store still sells despite `restricted`. */
  storefrontClosed?: boolean;
}

/** Why an order's customer details are hidden: the subscription lapsed, or the balance can't pay the fee. */
export type OrderLockReason = "subscription" | "balance";

/** `GET /workspaces/:id/orders/locked-summary` (orders.view). Amounts in minor units. */
export interface LockedOrdersSummary {
  enabled: boolean;
  /** open: nothing is locked; pay_per_order: by the balance; lapsed: by the subscription. */
  mode: "open" | "pay_per_order" | "lapsed";
  reason: OrderLockReason | null;
  /** Pay per order: a free order is left or the balance holds one fee. */
  canPay: boolean;
  /** Open orders whose customer details are hidden now. */
  count: number;
  /** Of them, paid online with their fee still owed: POST /orders/locked/settle takes it once the balance can. */
  due: number;
  totals: Array<{ currency: string; amount: number; count: number }>;
  fee?: number;
  balance?: number;
  freeLeft?: number;
  currency?: string;
}

/** Where a pay-per-order balance stands against the fee. Amounts in minor units. */
export interface WalletState {
  /** low: fewer than 20 orders before the overdraft; overdraft: at or below zero; exhausted: the next order is refused. */
  phase: "ok" | "low" | "overdraft" | "exhausted";
  balance: number;
  fee: number | null;
  ordersLeft: number | null;
  ordersBeforeOverdraft: number | null;
  overdraft: number;
  /** What the balance owes below zero (0 when it's positive). */
  debt?: number;
  /** Free orders still to use before any fee. */
  freeOrdersLeft?: number;
  /** overdraft: the fixed overdraft and the store stops; debt_limit: the plan's own limit, new orders refused (422). */
  policy?: "overdraft" | "debt_limit";
  currency: string;
}

/** `GET /workspaces/:id/billing/wallet` — the Usage tab's balance. */
export interface WalletSummary extends WalletState {
  /** WALLET_ENABLED: off, there is no balance to top up or spend. */
  enabled: boolean;
  onFeePlan: boolean;
  totalToppedUp: number;
  /** This calendar month in Cairo: fees net of those given back, and the orders behind them. */
  month: { fees: number; orders: number; timeZone: string };
  limits: { minTopup: number; maxTopup: number; maxOpenTopups: number; lowOrders: number };
  /** The plan's free orders, the console's grants, those used and those left (an API from before has none). */
  freeOrders?: { allowance: number; granted: number; used: number; left: number };
  /** The plan's own debt limit in minor units; null = the fixed overdraft. */
  debtLimit?: number | null;
  /** Something was ever written to this store's balance. */
  hasEntries?: boolean;
  /** The latest card top-ups, newest first. */
  onlineTopups?: OnlinePayment[];
}

export type WalletEntryType =
  | "topup"
  | "order_fee"
  | "order_fee_reversal"
  | "order_fee_recharge"
  | "free_orders_grant"
  | "adjustment"
  | "gift"
  | "refund_hold"
  | "refund_release"
  | "refund_paid"
  | "move_payment_credit"
  /** The fee taken once when an order is confirmed (locked orders on). */
  | "order_confirm_fee";

/** One paid top-up and how much of it can still come back as a refund. */
export interface WalletRefundTopup {
  entryId: string;
  amount: number;
  /** The most it gives back (its share, 75% by default). */
  ceiling: number;
  refunded: number;
  held: number;
  remaining: number;
  source: "transfer" | "card";
  createdAt: string;
}

export type WalletRefundStatus = "requested" | "approved" | "rejected" | "cancelled" | "paid";

/** A refund request of the prepaid balance. */
export interface WalletRefundRequest {
  id: string;
  amount: number;
  currency: string;
  status: WalletRefundStatus;
  /** Where the merchant asked for it to go. */
  payoutMethod: string | null;
  payoutAccount: string | null;
  /** The console's reference for the transfer it made. */
  payoutReference: string | null;
  adminNote: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  paidAt: string | null;
}

/** What may be asked for now (minor units). */
export interface WalletRefundQuote {
  balance: number;
  debt: number;
  /** What the paid top-ups' ceilings still allow, before the balance. */
  refundableFromTopups: number;
  max: number;
  min: number;
  /** Each top-up's share that can come back (7500 = 75%). */
  ceilingBp: number;
  allocation: "newest_first" | "oldest_first";
  currency: string;
  open: boolean;
  canRequest: boolean;
}

/** `GET /workspaces/:id/billing/wallet/refunds`. */
export interface WalletRefundOverview {
  /** On pay per order, or holding a balance. */
  eligible: boolean;
  quote: WalletRefundQuote;
  requests: WalletRefundRequest[];
}

/** A refund request as the console sees it. */
export interface AdminWalletRefund extends WalletRefundRequest {
  workspaceId: string;
  workspace: { id: string; name: string; slug: string } | null;
  allocations: { topupEntryId: string; amount: number }[];
}

export interface AdminWalletRefundPage {
  requests: AdminWalletRefund[];
  page: number;
  pageSize: number;
  total: number;
}

/** The console's view of a store's refund room (`GET /admin/workspaces/:id/wallet` → refunds). */
export interface WalletRefundBreakdown {
  ceilingBp: number;
  allocation: "newest_first" | "oldest_first";
  topups: WalletRefundTopup[];
  lifetimeToppedUp: number;
  refundable: number;
  refunded: number;
  pending: number;
}

/** The console's own entry: free orders granted, or the balance corrected by hand. */
export interface WalletConsoleEntryResult {
  entry: WalletLedgerEntry;
  /** The same requestId was sent before: nothing was written again. */
  replayed: boolean;
}

export interface WalletLedgerEntry {
  id: string;
  type: WalletEntryType;
  /** Signed: a fee is negative. */
  amount: number;
  /** Free orders taken (-1), given back (+1) or granted (+n); 0 or missing otherwise. */
  freeOrders?: number;
  balanceAfter: number;
  currency: string;
  orderId: string | null;
  orderNumber?: string | null;
  paymentProofId: string | null;
  note: string | null;
  createdAt: string;
}

export interface WalletLedgerPage {
  entries: WalletLedgerEntry[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * `GET /workspaces/:id/billing` — the merchant's own subscription summary. The
 * referral code shows its discount only, never the agent or its label.
 */
export interface WorkspaceBilling {
  subscription: {
    status: SubscriptionStatus;
    billingCycle: "monthly" | "yearly";
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    plan: {
      id: string;
      name: string;
      currency: string;
      monthlyPrice: number;
      yearlyPrice: number;
      trialDays?: number;
      maxStores?: number | null;
      maxFunnelsPerMonth?: number | null;
      softOrderQuota?: number | null;
      features?: PlanFeatureKey[];
    } | null;
  };
  referralCode: {
    code: string;
    discountType: ReferralDiscountType;
    discountValue: number | null;
    discountCurrency: string | null;
    active: boolean;
    attachedAt: string;
  } | null;
  /** What the next charge would be, in minor units; null on a free plan. */
  nextCharge: { grossAmount: number; discountAmount: number; amount: number; currency: string } | null;
  features?: PlanFeatureKey[];
  trialEndsAt?: string | null;
  limits?: PlanLimits;
  draft?: boolean;
  /** Only on a draft: its trial, whether its plan is free, and how to pay by hand. */
  goLive?: {
    trial: { eligible: boolean; days: number };
    free: boolean;
    paymentInstructions: { ar: string | null; en: string | null } | null;
  } | null;
  /**
   * Paying the charge online (Fawaterak). `enabled` is false while the
   * platform has it off, or the plan isn't priced in `currency`.
   */
  onlinePayment?: {
    enabled: boolean;
    currency: string;
    latest: OnlinePayment | null;
  };
}

/** A price on a plan card, in minor units: the plan's, the referral code's discount, and what is paid. */
export interface PlanPrice {
  gross: number;
  discount: number;
  net: number;
}

/** A referral code as the merchant sees it: the discount, never the agent. */
export interface MerchantReferralCode {
  code: string;
  discountType: ReferralDiscountType;
  discountValue: number | null;
  discountCurrency: string | null;
  active: boolean;
}

/** One card of the Subscription section. Prices come from the server; annual is 10 × monthly. */
export interface SubscriptionPlan extends PublicPlan {
  isCurrent: boolean;
  /** False only for the store's own plan when it isn't on offer: shown, never chosen. */
  isPublic: boolean;
  prices: { monthly: PlanPrice; yearly: PlanPrice };
}

/** `GET /workspaces/:id/billing/plans` (billing.manage). */
export interface SubscriptionPlans {
  subscription: {
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    planId: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string;
    /** Not subscribed yet (REQUIRE_SUBSCRIPTION_TO_GO_LIVE on). */
    draft: boolean;
  };
  /** A trial starts only from a draft, once per account. */
  trial: { available: boolean; used: boolean };
  /** "immediate" while nothing is paid (a draft or a trial); "support" once paid. */
  planChange: "immediate" | "support";
  referralCode: MerchantReferralCode | null;
  plans: SubscriptionPlan[];
  /** The pay-per-order card: `available` while it can be chosen; `current` when the store is on it. Absent from an older API. */
  payPerOrder?: { available: boolean; current: boolean; plan: { id: string; name: string; fee: number; currency: string } | null };
  /** A store on pay per order moving to one of `plans` by itself; null for any other store, absent from an older API. */
  move?: PlanMove | null;
  /** Changing plan by itself (`/billing/plan-switch`, PLAN_SWITCH_ENABLED). Absent from an older API. */
  planSwitch?: PlanSwitchSummary;
}

/**
 * How this subscription changes plan (`GET /workspaces/:id/billing/plans`):
 * `switch` a paid subscription, by itself (`/billing/plan-switch`);
 * `immediate` a draft or a trial (`POST /billing/plan`); `move` pay per
 * order (`/billing/plan-move`); `support` through Zimos support, `reason`
 * saying why; null while PLAN_SWITCH_ENABLED is off. `open` is the switch
 * waiting (also while the flag is off, so it can be cancelled).
 */
export interface PlanSwitchSummary {
  enabled: boolean;
  mode: "switch" | "immediate" | "move" | "support" | null;
  reason: PlanSwitchSupportReason | null;
  open: PlanSwitch | null;
}

/** Why a plan is changed through Zimos support. */
export type PlanSwitchSupportReason = "PLAN_CHANGE_NEEDS_SUPPORT" | "MANUAL_PRICING" | "SPECIAL_TERMS_ACTIVE";

/**
 * upgrade: the new plan's full price for a full period from its payment (an
 * older API: the difference for the days left); move: a full period (from a
 * free plan); scheduled: at the end of the paid period (a downgrade, an
 * upgrade left for then, pay per order); immediate: at once, nothing to pay.
 */
export type PlanSwitchKind = "upgrade" | "move" | "scheduled" | "immediate";

/** When an upgrade takes effect: "now" (on its payment) or "period_end" (when the paid period ends). */
export type PlanSwitchTiming = "now" | "period_end";

/** One timing of a switch, as the preview shows it (PlanSwitchPreview.options). */
export interface PlanSwitchOption {
  effective: "on_payment" | "period_end" | "now" | null;
  effectiveAt: string | null;
  /** Due now, minor units. */
  amountDue: number;
  currency: string;
  chargeExpiry: { hours: number; expiresAt: string } | null;
  nextRenewal: { at: string | null; amount: number; currency: string; billingCycle: BillingCycle } | null;
  payable: boolean | null;
  blockedBy: PlanSwitchBlock | null;
}

/** pending (its charge waits) and scheduled are open; the rest are final. */
export type PlanSwitchStatus = "pending" | "scheduled" | "applied" | "cancelled" | "replaced" | "expired" | "dropped";

/** What a preview says would stop starting the switch now. */
export type PlanSwitchBlock = "PROOF_UNDER_REVIEW" | "PLAN_SWITCH_ALREADY_BILLED" | "NO_PAYMENT_METHOD";

/** What an upgrade's charge is for, in minor units: the days left and the two prices per period. */
export interface PlanSwitchProration {
  remainingDays: number;
  cycleDays: number;
  fromPrice: number;
  toPrice: number;
  amount: number;
  currency: string;
}

/** A merchant's plan switch as the dashboard sees it. */
export interface PlanSwitch {
  id: string;
  kind: PlanSwitchKind;
  status: PlanSwitchStatus;
  from: { planId: string | null; planName: string | null; billingCycle: BillingCycle };
  to: { planId: string | null; planName: string | null; billingCycle: BillingCycle };
  /**
   * Why it is this kind: downgrade, cycle_change, currency, upgrade (an
   * upgrade, now or left for the period's end), to_pay_per_order,
   * period_ended, …; null otherwise. Absent from an older API.
   */
  reason?: string | null;
  /** An upgrade: "now" (its charge) or "period_end" (scheduled); null for any other switch. Absent from an older API. */
  timing?: PlanSwitchTiming | null;
  /** A scheduled switch: when it takes effect (the end of the paid period). */
  effectiveAt: string | null;
  appliedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  /** An upgrade or a move: the charge to pay (the usual Pay dialog pays it). */
  invoiceId: string | null;
  amountDue: number | null;
  currency: string | null;
  /** A pending switch: when its unpaid charge is voided by itself. */
  expiresAt: string | null;
  /**
   * A transfer's proof for its charge is with the console: cancelling or
   * replacing it is refused (409 PROOF_UNDER_REVIEW) and it doesn't expire
   * until reviewed. Always false for a scheduled switch. Absent from an older API.
   */
  proofUnderReview?: boolean;
  proration: PlanSwitchProration | null;
  createdAt: string;
}

/** `POST /workspaces/:id/billing/plan-switch/preview` — what switching would do; nothing is written. */
export interface PlanSwitchPreview {
  kind: PlanSwitchKind | "trial_change" | "none";
  reason:
    | "downgrade"
    | "cycle_change"
    | "currency"
    | "period_ended"
    | "no_plan"
    | "free_plan"
    | "same_price"
    | "nothing_due"
    | "from_free"
    | "pay_per_order"
    | "upgrade"
    | "to_pay_per_order"
    | null;
  /** The timing described by the fields below: the one asked, else "now" or the only one. Absent from an older API. */
  timing?: PlanSwitchTiming;
  /** The timings on offer: ["now", "period_end"] for an upgrade inside a paid period, one otherwise. Absent from an older API. */
  timings?: PlanSwitchTiming[];
  /** Each timing's own terms; `timing` is the one copied to the top level. Absent from an older API. */
  options?: Partial<Record<PlanSwitchTiming, PlanSwitchOption>>;
  /** The paid period running now ("N days left, ends on …"); null for a free plan or pay per order. Absent from an older API. */
  currentPeriod?: { endsAt: string; remainingDays: number } | null;
  /** on_payment (upgrade, move), period_end (scheduled), now (immediate, trial_change), null (none). */
  effective: "on_payment" | "period_end" | "now" | null;
  effectiveAt: string | null;
  from: { planId: string; planName: string; billingCycle: BillingCycle; currency: string } | null;
  to: { planId: string; planName: string; billingCycle: BillingCycle; currency: string };
  /** Due now, minor units: 0 for anything but an upgrade "now" or a move. */
  amountDue: number;
  currency: string;
  /** An older API's upgrade, priced for the days left; null now (the full price is due). */
  proration: (PlanSwitchProration & { periodCycle: BillingCycle; standardPeriod: boolean; difference: number }) | null;
  trial: boolean;
  /**
   * How long the charge it writes would live unpaid if started now: an
   * upgrade or a move. null when it writes none (and for a pay-per-order
   * move while the prepaid balance is off: that charge never expires by
   * itself). The hourly job voids it at its first run after `expiresAt`.
   * Absent from an older API.
   */
  chargeExpiry?: { hours: number; expiresAt: string } | null;
  /** null when the new plan is free; `at` is null only for a move (its period starts when it is paid). */
  nextRenewal: { at: string | null; amount: number; currency: string; billingCycle: BillingCycle } | null;
  /** null with nothing due; otherwise whether the store can pay `currency` itself. */
  payable: boolean | null;
  blockedBy: PlanSwitchBlock | null;
  /** What starting it would cancel: the switch waiting, or (kind "renewal") a renewal charge nobody is paying. */
  replaces: {
    switchId: string | null;
    kind: PlanSwitchKind | "renewal";
    status: string;
    toPlanId: string | null;
    toBillingCycle: BillingCycle | null;
    invoiceId: string | null;
  } | null;
}

/** `POST /workspaces/:id/billing/plan-switch` — 201 with a new switch, 200 otherwise. */
export interface PlanSwitchStartResult {
  kind: PlanSwitchPreview["kind"];
  created: boolean;
  changed: boolean;
  switch: PlanSwitch | null;
  /** An upgrade's or a move's charge. */
  invoice: MerchantInvoice | null;
  plans: SubscriptionPlans;
}

/** `POST /workspaces/:id/billing/plan-switch/cancel`. */
export interface PlanSwitchCancelResult {
  cancelled: boolean;
  switch: PlanSwitch | null;
  plans: SubscriptionPlans;
}

/** The move off pay per order (`POST /workspaces/:id/billing/plan-move`). */
export interface PlanMove {
  available: boolean;
  /** Always false: a move never starts a free trial. */
  trial: boolean;
  /** The prepaid balance (minor units, may be below zero); it stays in the wallet. */
  balance: number;
  /** What the balance owes below zero; it must be cleared before a move. */
  debt: number;
  currency: string;
  /** The move waiting for its charge to be paid; the plan switches only then. */
  pending: {
    invoiceId: string;
    planId: string;
    planName: string | null;
    billingCycle: BillingCycle;
    amountDue: number;
    currency: string;
    createdAt: string;
  } | null;
  /** Another charge (not a move) is open and must be settled first. */
  otherChargeOpen: boolean;
}

/** `POST /workspaces/:id/billing/code-preview` — what a code would take off each listed plan. */
export interface ReferralCodePreview {
  code: MerchantReferralCode;
  plans: { planId: string; prices: { monthly: PlanPrice; yearly: PlanPrice } }[];
}

/**
 * Why a charge stopped asking for money: cancelled, replaced or expired (a
 * plan change's), cancelled_by_merchant, voided_by_admin, payment_failed.
 */
export type ChargeVoidReason = "cancelled" | "replaced" | "expired" | "cancelled_by_merchant" | "voided_by_admin" | "payment_failed";

/** A subscription charge as the merchant sees it. */
export interface MerchantInvoice {
  id: string;
  /** "void": a charge that no longer asks for money (see voidReason). */
  status: "pending" | "paid" | "failed" | "void";
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  discountAmount: number;
  amountDue: number;
  amountPaid: number | null;
  currency: string;
  paidAt: string | null;
  paymentSource: "gateway" | "manual" | null;
  createdAt: string;
  /** A pay-per-order store's move: the plan and cycle it switches to when paid. */
  targetPlanId?: string | null;
  targetBillingCycle?: BillingCycle | null;
  /** Why a void charge stopped asking for money. */
  voidReason?: ChargeVoidReason | null;
  /**
   * The merchant may cancel it (POST .../billing/charges/:id/cancel):
   * PLAN_SWITCH_ENABLED, pending, no transfer for it being checked. Only in
   * the invoices list; absent from an older API (then never offered).
   */
  cancellable?: boolean;
}

/** `POST /workspaces/:id/billing/charges/:chargeId/cancel` — the charge, now void, and the plans list. */
export interface BillingChargeCancelResult {
  invoice: MerchantInvoice;
  plans: SubscriptionPlans;
}

/** `GET /workspaces/:id/billing/invoices` — newest first. */
export interface MerchantInvoicePage {
  invoices: MerchantInvoice[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * An online checkout's state:
 *   created / open / pending  in progress (pending: an async method such as a
 *                             Fawry reference, awaiting the payment)
 *   paid                      confirmed, and the charge settled
 *   paid_duplicate            paid on a charge already paid: refunded by hand
 *   mismatch                  paid with an unexpected amount: under review
 *   failed / expired / superseded / error   not paid
 */
export type OnlinePaymentStatus =
  | "created"
  | "open"
  | "pending"
  | "paid"
  | "paid_duplicate"
  | "mismatch"
  | "failed"
  | "expired"
  | "superseded"
  | "error";

/** One online checkout of the merchant's subscription charge. Amounts in minor units. */
export interface OnlinePayment {
  id: string;
  /** invoice: a subscription charge; topup: the prepaid balance (an API from before sends nothing). */
  purpose?: "invoice" | "topup";
  status: OnlinePaymentStatus;
  amount: number;
  currency: string;
  /** Fawaterak's hosted page; only while the payment is in progress. */
  checkoutUrl: string | null;
  paymentMethod: string | null;
  /** An async method's reference (a Fawry code). */
  referenceNumber: string | null;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
}

/** `GET /workspaces/:id/billing/payments/:paymentId`. */
export interface OnlinePaymentResult {
  payment: OnlinePayment;
  /** null for a top-up, which has no charge: its payment's status says whether the balance was credited. */
  chargeStatus: "pending" | "paid" | "failed" | null;
}

/**
 * A way to pay Zimos (`GET /workspaces/:id/billing/payment-methods`):
 *   manual   a transfer to `accountNumber`, then a proof with a screenshot
 *   gateway  a hosted checkout (`startOnlinePayment` with its `code`)
 */
export interface BillingPaymentMethod {
  code: string;
  kind: "manual" | "gateway";
  label: { ar: string; en: string };
  /** Manual only: where the money goes, and how to send it. */
  accountNumber?: string;
  /** Manual only, optional (https): shown as a button only when set. */
  paymentLink?: string | null;
  note?: { ar: string | null; en: string | null };
}

export interface BillingPaymentMethodList {
  methods: BillingPaymentMethod[];
  currency: string;
  /** No method is offered: the merchant contacts support. */
  contactSupport: boolean;
}

/**
 * `POST /workspaces/:id/billing/invoices/open` — the charge to pay now and the
 * ways to pay it, written nowhere: `invoice.id` is the open charge's, or
 * "next" while none is open (the proof sent for it writes the charge;
 * `createdAt` is null until then). An API from before wrote the charge here
 * (201, `created`), always with its id, and sends no `written` or `methods`.
 */
export interface OpenBillingInvoiceResult {
  invoice: Omit<MerchantInvoice, "createdAt"> & { createdAt: string | null };
  created: boolean;
  /** Whether `invoice` is a charge already written (absent from an API from before: it always is). */
  written?: boolean;
  methods?: BillingPaymentMethod[];
}

export type BillingPaymentProofStatus = "pending" | "approved" | "rejected";

/** A transfer's proof, as its store sees it. The amount is the server's. */
export interface BillingPaymentProof {
  id: string;
  purpose: "invoice" | "topup";
  invoiceId: string | null;
  method: { code: string; label: { ar: string; en: string } | null };
  senderPhone: string;
  amount: number;
  currency: string;
  status: BillingPaymentProofStatus;
  /** A rejection's reason; null otherwise. */
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** A payment method as the console sees it (`GET /admin/payment-methods`). */
export interface AdminPaymentMethod {
  id: string;
  code: string;
  kind: "manual" | "gateway";
  labelAr: string;
  labelEn: string;
  sortOrder: number;
  enabled: boolean;
  /** Manual only. */
  accountNumber?: string | null;
  /** Manual only, optional (https). Null = no link. */
  paymentLink?: string | null;
  noteAr?: string | null;
  noteEn?: string | null;
  /** Gateway only: its adapter and environment, by variable names (never a value). */
  gateway?: { name: string | null; adapterInstalled: boolean; configured: boolean; missing: string[]; currencies: string[] };
  /** Whether merchants are offered it right now. */
  offered: boolean;
  updatedAt: string;
}

export interface AdminPaymentMethods {
  methods: AdminPaymentMethod[];
  /** Gateways this server has an adapter for, with no row yet. */
  gatewaysNotAdded: Array<{ code: string; name: string; configured: boolean; missing: string[]; currencies: string[] }>;
}

/** A transfer's proof as the console sees it. Amounts in minor units. */
export interface AdminPaymentProof {
  id: string;
  purpose: "invoice" | "topup";
  workspace: { id: string; name?: string; slug?: string };
  invoiceId: string | null;
  method: { code: string; labelAr: string | null; labelEn: string | null };
  /** The number the money was sent to, as it was when the proof was sent. */
  receivingNumber: string;
  senderPhone: string;
  requestedAmount: number;
  receivedAmount: number | null;
  currency: string;
  status: BillingPaymentProofStatus;
  reviewNote: string | null;
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  submittedBy: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

export interface AdminPaymentProofPage {
  proofs: AdminPaymentProof[];
  page: number;
  pageSize: number;
  total: number;
}

/** `GET /admin/payment-proofs/:id` — with the image behind a five-minute signed link. */
export interface AdminPaymentProofReview {
  proof: AdminPaymentProof;
  invoice: {
    id: string;
    status: "pending" | "paid" | "failed" | "void";
    amountDue: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    paidAt: string | null;
  } | null;
  /** Why an approval would be refused now (e.g. CHARGE_ALREADY_PAID); empty when it can go through. */
  approvalBlockers: string[];
  /** A top-up: the store's balance now. */
  wallet?: { balance: number; currency: string } | null;
  image: { url: string; expiresAt: string; mime: string };
  alreadyApproved?: boolean;
  alreadyRejected?: boolean;
}

/** POST /workspaces/:id/start-trial and /activate-free-plan. */
export interface GoLiveResult {
  billing: WorkspaceBilling;
  access: WorkspaceAccess;
  /** False when it had already happened (a repeated click). */
  started: boolean;
}

export interface AdminReferralCode {
  id: string;
  agentId: string;
  /** Uppercase; what merchants type. Never changes once created. */
  code: string;
  label: string | null;
  discountType: ReferralDiscountType;
  /** Basis points for a percentage, minor units for a fixed amount. */
  discountValue: number | null;
  /** Only for a fixed amount. */
  discountCurrency: string | null;
  /** The code's own override, or null for the platform default. */
  commissionRateBp: number | null;
  effectiveCommissionRateBp: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReferralCodeInput {
  code?: string;
  label?: string | null;
  discountType?: ReferralDiscountType;
  discountValue?: number | null;
  discountCurrency?: string | null;
  commissionRateBp?: number | null;
  active?: boolean;
}

/** Suggested commission for one currency. Currencies are never added together. */
export interface AdminCommissionTotals {
  currency: string;
  pending: number;
  markedPaid: number;
  amountPaid: number;
  payments: number;
}

export interface AdminReferralCodeWithStats extends AdminReferralCode {
  /** Subscriptions this code is attached to. */
  merchantsReferred: number;
  commission: AdminCommissionTotals[];
}

export interface AdminAgent {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "suspended" | "pending_verification";
  /** False once the role was changed or revoked; codes and ledger remain. */
  isAgent: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  codes: AdminReferralCodeWithStats[];
  merchantsReferred: number;
  commission: AdminCommissionTotals[];
}

export interface AdminAgentList {
  agents: AdminAgent[];
  defaultCommissionRateBp: number;
}

export interface AdminReferredMerchant {
  workspace: { id: string; name: string | null };
  code: { id: string; code: string };
  attachedAt: string;
  subscriptionStatus: SubscriptionStatus;
  planName: string | null;
  billingCycle: "monthly" | "yearly";
}

export interface AdminAgentDetail {
  agent: AdminAgent;
  merchants: AdminReferredMerchant[];
  defaultCommissionRateBp: number;
}

export interface AdminCreateAgentResult {
  agent: Omit<AdminAgent, "codes" | "merchantsReferred" | "commission">;
  code: AdminReferralCode | null;
}

export type CommissionPayoutStatus = "pending" | "marked_paid";

// ---------------------------------------------------------------------------
// Platform admin — subscription charges (/admin/workspaces/:id/charges)
// ---------------------------------------------------------------------------

export type AdminChargeStatus = "pending" | "paid" | "failed" | "void";

/**
 * One subscription charge (a billing invoice). Amounts in minor units of
 * `currency`. `amountDue` is re-priced when the charge is paid, because the
 * referral code is re-checked then.
 */
export interface AdminCharge {
  id: string;
  status: AdminChargeStatus;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  discountAmount: number;
  amountDue: number;
  /** What was actually received; null until paid. */
  amountPaid: number | null;
  currency: string;
  referralCode: { id: string; code: string } | null;
  /** When the money arrived: the gateway's time, or the date entered by hand. */
  paidAt: string | null;
  /** Only a "manual" payment can be reversed. */
  paymentSource: "gateway" | "manual" | null;
  /** When a manual payment was recorded; may be later than paidAt. */
  paymentRecordedAt: string | null;
  /** Priced with this special-terms price override. */
  specialTermsId: string | null;
  /** A pay-per-order store's move: the plan (and cycle) it switches to when this is paid. */
  targetPlanId?: string | null;
  targetBillingCycle?: "monthly" | "yearly" | null;
  targetPlanName?: string | null;
  /** A charge that no longer asks for money, why, and the console's reason when it voided it. */
  voidedAt?: string | null;
  voidReason?: ChargeVoidReason | null;
  voidNote?: string | null;
  /** The console's Void applies: PLAN_SWITCH_ENABLED, pending, no transfer for it waiting. Absent from an older API. */
  voidable?: boolean;
  failureReason: string | null;
  externalReference: string | null;
  paymentNote: string | null;
  /** Who recorded the payment by hand; null for a gateway payment. */
  recordedBy: { id: string; fullName: string } | null;
  commission: { id: string; suggestedCommission: number; payoutStatus: CommissionPayoutStatus } | null;
  /** For an unpaid charge: what it comes to if paid now (the code re-checked). */
  payableNow: {
    discountAmount: number;
    amountDue: number;
    referralCodeApplies: boolean;
    /** It was priced with a code that is no longer active. */
    codeLapsed: boolean;
  } | null;
  /** The merchant's online checkouts of this charge, newest first. */
  onlinePayments?: AdminOnlinePayment[];
  /** The merchant may be paying online right now: recording by hand supersedes it. */
  onlinePaymentInProgress?: boolean;
  createdAt: string;
}

/** An online checkout (Fawaterak) of a charge, as the console sees it. */
export interface AdminOnlinePayment {
  id: string;
  provider: string;
  status: OnlinePaymentStatus;
  /** The price frozen when the merchant pressed Pay, in minor units. */
  amount: number;
  currency: string;
  /** What Fawaterak reported as paid. */
  verifiedAmount: number | null;
  verifiedCurrency: string | null;
  providerTransactionId: number | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  /** Refunds Fawaterak reported as approved; nothing was changed for them. */
  refundsReported: Array<{ amount: string | null; currency: string | null; approvedAt: string | null; reportedAt: string }>;
}

export interface AdminWorkspaceCharges {
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: "monthly" | "yearly";
    planName: string | null;
    currentPeriodEnd: string;
    referralCode: {
      id: string;
      code: string;
      active: boolean;
      discountType: ReferralDiscountType;
      discountValue: number | null;
      discountCurrency: string | null;
      agent: { id: string; fullName: string } | null;
      attachedAt: string;
    } | null;
    /** One period's price on each cycle; annual is always 10 × monthly. */
    planPrices: { monthly: number; yearly: number; currency: string } | null;
  };
  /** The next charge's price; null while one is open or the plan is free. */
  nextCharge: { grossAmount: number; discountAmount: number; amount: number; currency: string } | null;
  /** Newest first. */
  charges: AdminCharge[];
  /** Every special-terms grant, newest first; `active` marks those in effect. */
  specialTerms: AdminSpecialTerm[];
}

export type SpecialTermsKind = "free_months" | "price_override";

/** A grant of non-standard terms (a comp, a bundle price). */
export interface AdminSpecialTerm {
  id: string;
  kind: SpecialTermsKind;
  active: boolean;
  /** free_months: the comped window. */
  months: number | null;
  startsAt: string | null;
  endsAt: string | null;
  /** price_override: the price, in minor units of `currency`, for the next N charges. */
  priceAmount: number | null;
  currency: string | null;
  chargesTotal: number | null;
  chargesUsed: number;
  chargesLeft: number | null;
  /** What was agreed and why. */
  note: string;
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
}

export type AdminSpecialTermsInput =
  | { kind: "free_months"; months: number; note: string }
  | { kind: "price_override"; priceAmount: number; charges: number; note: string };

/** The console's view of a store's access: manual suspension and billing side by side. */
export interface AdminStoreAccess extends Omit<WorkspaceAccess, "suspension"> {
  suspension: {
    status: "active" | "suspended" | "closed";
    suspended: boolean;
    suspendedAt: string | null;
    /** The admin's note; never shown to the merchant. */
    suspensionReason: string | null;
    suspendedBy: { id: string; fullName: string } | null;
  };
}

/** `POST /admin/charges/:chargeId/void` — the charge, now void. */
export interface AdminVoidChargeResult {
  charge: AdminCharge;
}

export interface AdminRecordPaymentResult {
  charge: AdminCharge;
  /** The charge was priced with a code that had lapsed by the time it was paid. */
  referralCodeLapsed: boolean;
}

export interface AdminReversePaymentResult {
  /** Back to pending. */
  charge: AdminCharge;
  /** The ledger row voided by the reversal; payoutStatus "marked_paid" means the agent was already paid for it. */
  voidedCommission: { id: string; suggestedCommission: number; payoutStatus: CommissionPayoutStatus } | null;
  /** `to` is past_due when this payment is what had made the subscription active. */
  subscriptionStatus: { from: SubscriptionStatus; to: SubscriptionStatus };
}

/** One ledger row: one paid subscription charge that carried a code. */
export interface AdminCommission {
  id: string;
  agentId: string;
  /** Absent in the agent's own view. */
  agentName?: string;
  code: { id: string; code?: string; label?: string | null };
  workspace: { id: string; name?: string };
  billingInvoiceId: string;
  amountPaid: number;
  currency: string;
  paidAt: string;
  commissionRateBp: number;
  suggestedCommission: number;
  /** The subscription's first paid charge (false = a renewal). */
  isFirstPayment: boolean;
  payoutStatus: CommissionPayoutStatus;
  payoutNote: string | null;
  markedPaidAt: string | null;
  /** Null in the agent's own view. */
  markedPaidBy: { id: string; fullName: string } | null;
  /**
   * Set when the payment behind the row was reversed. A voided row never
   * counts in totals and can't be marked paid; its payoutStatus is kept, so
   * "marked_paid" here means the agent was paid for a reversed payment.
   */
  voidedAt: string | null;
  voidReason: string | null;
  /** Null in the agent's own view. */
  voidedBy: { id: string; fullName: string } | null;
}

/** The ledger filter: the two payout states count live rows only. */
export type CommissionListStatus = CommissionPayoutStatus | "voided";

export interface AdminCommissionParams {
  agentId?: string;
  codeId?: string;
  workspaceId?: string;
  status?: CommissionListStatus;
  limit?: number;
  offset?: number;
}

export interface AdminCommissionPage {
  commissions: AdminCommission[];
  total: number;
  limit: number;
  offset: number;
  /** Over every row the filter matches, not just this page. */
  totals: AdminCommissionTotals[];
}

// ---------------------------------------------------------------------------
// Platform admin — templates (/admin/templates)
// ---------------------------------------------------------------------------

export type AdminTemplateKind = "store" | "funnel" | "landing";

/** One row of the admin template library — drafts and version-less ones included. */
export interface AdminTemplate {
  id: string;
  /** Exactly what the public gallery shows: published AND an active version. */
  inGallery: boolean;
  name: string;
  category: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  kind: AdminTemplateKind;
  /** Minor units. */
  priceAmount: number;
  isFree: boolean;
  /** The raw column — no fallback to the version's styles. */
  primaryColor: string | null;
  tags: string[];
  rtl: boolean;
  versionCount: number;
  /** The version number the gallery offers, or null when none is active. */
  activeVersion: number | null;
  templateVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Create (no `id`) or partial update (with `id`). */
export type AdminTemplateInput = Partial<
  Pick<
    AdminTemplate,
    "name" | "category" | "thumbnailUrl" | "isPublished" | "kind" | "priceAmount" | "isFree" | "primaryColor" | "tags" | "rtl"
  >
> & { id?: string };

export interface AdminTemplateVersionSummary {
  id: string;
  version: number;
  isActive: boolean;
  pageCount: number;
  pagePaths: string[];
  sectionCount: number;
  primaryColor: string | null;
  /** Merchant websites created from this version. */
  websiteCount: number;
  createdAt: string;
}

export interface AdminTemplateVersionPage {
  path: string;
  title?: string;
  pageType?: string;
  builderData?: Record<string, unknown>;
  seo?: Record<string, unknown>;
}

export interface AdminTemplateVersion extends AdminTemplateVersionSummary {
  globalStyles: Record<string, unknown>;
  pages: AdminTemplateVersionPage[];
  sections: Array<Record<string, unknown>>;
}

export interface AdminTemplateDetail {
  template: AdminTemplate;
  /** Newest first. */
  versions: AdminTemplateVersionSummary[];
}

export interface AdminTemplateVersionInput {
  globalStyles?: Record<string, unknown>;
  pages: AdminTemplateVersionPage[];
  sections?: Array<Record<string, unknown>>;
  /** Default true: becomes the version the gallery offers. */
  activate?: boolean;
}

// ---------------------------------------------------------------------------
// Support tickets — merchant (/workspaces/:id/support) and admin (/admin/support)
// ---------------------------------------------------------------------------

/**
 *   open      waiting on the platform team
 *   pending   waiting on the merchant (the platform replied)
 *   resolved  answered; a merchant reply re-opens it
 *   closed    finished; nobody can reply
 */
export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketCategory =
  | "general"
  | "billing"
  | "orders"
  | "shipping"
  | "payments"
  | "technical"
  | "account";

export interface SupportTicket {
  id: string;
  workspaceId: string;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  /** Who opened it (name or email); null if that account is gone. */
  createdBy: string | null;
  lastMessageAt: string;
  lastMessageBy: "merchant" | "admin";
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketMessage {
  id: string;
  authorType: "merchant" | "admin";
  /** For the merchant, platform replies are always signed "Zimos support". */
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface SupportTicketThread {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

export interface OpenSupportTicketPayload {
  subject: string;
  body: string;
  category?: SupportTicketCategory;
}

/** The admin view adds the workspace and the real author behind each reply. */
export interface AdminSupportTicket extends SupportTicket {
  workspaceName: string | null;
  workspaceSlug: string | null;
  createdByEmail?: string;
}

export interface AdminSupportTicketMessage extends SupportTicketMessage {
  authorEmail?: string;
}

export interface AdminSupportTicketThread {
  ticket: AdminSupportTicket;
  messages: AdminSupportTicketMessage[];
}

export interface AdminSupportTicketParams {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  workspaceId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AdminSupportTicketPage {
  tickets: AdminSupportTicket[];
  total: number;
  limit: number;
  offset: number;
  /** Per status, under the same non-status filters — for the tab badges. */
  counts: Record<SupportTicketStatus, number>;
}

/** A reachability probe: one unauthenticated GET, no merchant credentials. */
export interface AdminProviderCheck {
  code: string;
  status: "operational" | "degraded" | "down" | "not_checkable";
  httpStatus: number | null;
  latencyMs: number | null;
  target: string | null;
  detail: string;
  checkedAt: string;
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
  | "high_rejection_customer"
  // online payments (payments/onlinePaymentService.js)
  | "test_payment"
  | "duplicate_payment"
  | "paid_after_expiry"
  | "paid_after_cancel"
  | "paid_after_cod_switch"
  | "payment_amount_mismatch"
  // couriers (shipping/carrierShipmentService.js): a booking the merchant
  // said they cancelled in the courier's dashboard still shows as moving there
  | "carrier_cancel_unconfirmed";

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
  /** A name or a phone, at least one. A save without a phone keeps the one already saved. */
  contact: { phone?: string; fullName?: string; email?: string };
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
  /** "tier_map": not a plain field — edited as a tier → package mapping. */
  kind?: "tier_map";
  packageTypes?: string[];
  parcelSizes?: string[];
}

export interface CarrierConnection {
  /** "invalid" once the courier rejected the stored key — reconnect needed. */
  status: "active" | "invalid";
  settings: Record<string, unknown>;
  lastVerifiedAt: string | null;
  connectedAt: string;
  updatedAt: string;
  webhookUrl: string;
  /**
   * Which of the courier's systems the stored credentials point at, for a
   * courier with an `environment` credential field (J&T). NOT sent by the
   * backend yet: credentials are write-only and describeConnection leaves it
   * out, so the dashboard falls back to what it last connected with.
   */
  environment?: "production" | "sandbox";
  /**
   * Present only when the last connect (or a later booking) could not check
   * everything; each mark is dropped once it no longer holds.
   * `customerCredentials: "unverified"`: J&T let us check the API account
   * but not the customer code and password; the first booking does.
   * `locationList: "unavailable"`: the courier refuses this account its
   * address list, so the pickup address was saved unchecked and bookings
   * send typed names (`carrierAddress.names`, see `typedAddressNames`).
   */
  verification?: CarrierConnectionVerification;
}

export interface CarrierConnectionVerification {
  customerCredentials?: "unverified";
  locationList?: "unavailable";
}

/**
 * How the courier's status webhook is set up: sent with every booking
 * ("per_shipment", nothing to paste), pasted once into the courier's
 * dashboard ("account"), or not offered ("none").
 */
export type CarrierWebhookSetup = "per_shipment" | "account" | "none";

/**
 * What a courier adapter can do (Backend carriers/adapterContract.js). The
 * backend fills in defaults, so every field is present on GET /carriers —
 * except `bulkStatus`, which the adapter declares but the list does not
 * send (it only affects the server's status job).
 */
export interface CarrierCapabilities {
  /** "api": cancelled through the courier. "manual": the merchant cancels it in the courier's dashboard. */
  cancel: "api" | "manual";
  /** Printable AWB via GET .../shipments/:id/label. */
  label: boolean;
  webhook: CarrierWebhookSetup;
  /** The server's status job reads open shipments on a schedule. */
  polling: boolean;
  bulkStatus?: boolean;
  /**
   * The courier's address levels, top first (1–3 of them). Exactly
   * ["city", "district"] keeps the city/district API; anything else is a
   * tree picked level by level and booked with `carrierAddress.path`.
   */
  addressLevels: string[];
  /**
   * When the courier refuses the account its address list
   * (`connection.verification.locationList: "unavailable"`), a booking takes
   * the courier's names as typed (`carrierAddress.names`). Absent on servers
   * older than it: treat as false.
   */
  typedAddressNames?: boolean;
}

/**
 * The two-level city/district model the original carrier API is built on
 * (Backend adapterContract.isCityDistrict). Such a courier keeps the
 * `{ cityId, districtId }` payload and the city/district unmatched body.
 */
export function isCityDistrictLevels(levels: readonly string[] | undefined): boolean {
  // A server older than the generic layer sends no levels: that was Bosta's model.
  if (!levels) return true;
  return levels.length === 2 && levels[0] === "city" && levels[1] === "district";
}

export interface CarrierInfo {
  code: string;
  name: string;
  webhookSetup: CarrierWebhookSetup;
  supportsLabel: boolean;
  credentialFields: CarrierFieldDescriptor[];
  settingFields: CarrierFieldDescriptor[];
  /** Absent only on a server older than the generic carrier layer. */
  capabilities?: CarrierCapabilities;
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

export const BOSTA_PARCEL_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type BostaParcelSize = (typeof BOSTA_PARCEL_SIZES)[number];

/** A Parcel needs a size; other package types take none. */
export interface BostaTierPackage {
  packageType: BostaPackageType;
  size?: BostaParcelSize;
}

export interface BostaSettings {
  /** A pickup location id from the verification; Bosta's default when empty. */
  businessLocationId?: string | null;
  /** Used when there is no tierMap, and for orders placed before the store had tiers. */
  packageType?: BostaPackageType;
  /**
   * Weight tier id -> package. With a map, booking an unmapped tier is
   * refused with 422 CARRIER_TIER_UNMAPPED ({ tierId }).
   */
  tierMap?: Record<string, BostaTierPackage>;
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
  /** `manualSetupRequired`: paste `url` into the courier's dashboard (setup "account"). */
  webhook: { url: string; setup: CarrierWebhookSetup; manualSetupRequired: boolean };
  /**
   * Bosta: the account's pickup locations — only obtainable from this call.
   * J&T: `customerCredentials: "unverified"` when the account can't call the
   * credential check; the connection is saved and the customer code and
   * password are first checked on a booking. Absent means checked (or n/a).
   */
  verification: {
    pickupLocations?: CarrierPickupLocation[];
  } & CarrierConnectionVerification &
    Record<string, unknown>;
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

/**
 * One node of a courier's address tree (couriers whose levels are not
 * city/district). Depth = `addressLevels.length`; leaves are bookable.
 */
export interface CarrierAreaNode {
  id: string;
  name: string | null;
  nameAr: string | null;
  /** false: the courier doesn't deliver there. Absent means it does. */
  dropOffAvailable?: boolean;
  aliases?: string[];
  meta?: Record<string, unknown>;
  children?: CarrierAreaNode[];
}

/**
 * GET /carriers/:code/cities for a courier whose levels are not
 * city/district: the whole tree, each node with its `children`.
 */
export interface CarrierAddressTree {
  levels: string[];
  nodes: CarrierAreaNode[];
}

/** A node as the address errors name it. */
export interface CarrierPlaceRef {
  id: string;
  name: string | null;
  nameAr: string | null;
}

/** One option in `details.candidates` of a 422 CARRIER_ADDRESS_UNMATCHED (city/district couriers). */
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

/**
 * `details` of 422 CARRIER_ADDRESS_UNMATCHED from a city/district courier
 * (Bosta) — the original body, unchanged.
 */
export interface CarrierAddressUnmatchedDetails {
  carrierCode: string;
  level: "city" | "district";
  orderAddress: { province: string | null; city: string | null };
  /** Set at level "district": the city that did match. */
  matchedCity: CarrierPlaceRef | null;
  candidates: CarrierAddressCandidate[];
}

/** One option in `details.candidates` of a 422 CARRIER_ADDRESS_UNMATCHED (level-tree couriers). */
export interface CarrierAreaCandidate extends CarrierPlaceRef {
  /** Root first, ending with this node. */
  path: CarrierPlaceRef[];
  /** No levels below it. */
  leaf: boolean;
  /** Sorted first; the matcher's best guesses. */
  suggested: boolean;
}

/**
 * `details` of 422 CARRIER_ADDRESS_UNMATCHED from a courier whose levels
 * are not city/district. The candidates are nodes of level `levelIndex`;
 * `matchedPath` is what already matched above it. Resend with
 * `carrierAddress.path`, one id per level.
 */
export interface CarrierAreaUnmatchedDetails {
  carrierCode: string;
  level: string;
  levelIndex: number;
  levels: string[];
  orderAddress: { province: string | null; city: string | null };
  /** The top-level node that matched, or null. */
  matchedCity: CarrierPlaceRef | null;
  matchedPath: CarrierPlaceRef[];
  candidates: CarrierAreaCandidate[];
}

/** Either body of a 422 CARRIER_ADDRESS_UNMATCHED; `levels` tells them apart. */
export type AnyCarrierAddressUnmatchedDetails = CarrierAddressUnmatchedDetails | CarrierAreaUnmatchedDetails;

export function isAreaUnmatchedDetails(
  details: AnyCarrierAddressUnmatchedDetails
): details is CarrierAreaUnmatchedDetails {
  return Array.isArray((details as CarrierAreaUnmatchedDetails).levels);
}

/** One shipment in `details.shipments` of a 409 CARRIER_MANUAL_CANCEL_REQUIRED. */
export interface ManualCancelShipment {
  shipmentId: string;
  carrierCode: string;
  carrierName: string;
  waybillNumber: string | null;
}

/**
 * `details` of 409 CARRIER_MANUAL_CANCEL_REQUIRED (order cancel, correction
 * to rejected, PATCH shipment to cancelled). Nothing was changed; repeat the
 * same request with `acknowledgeManualCancel: true` once the merchant has
 * cancelled these in the courier's dashboard.
 */
export interface ManualCancelRequiredDetails {
  shipments: ManualCancelShipment[];
}

/**
 * `details` of CARRIER_BOOKING_NOT_SAVED (424; 502 on older servers): the
 * courier created the booking but we could not record it, and the courier
 * has no cancel API —
 * the merchant must cancel `trackingNumber` in the courier's dashboard.
 */
export interface CarrierBookingNotSavedDetails {
  carrierCode: string;
  trackingNumber: string;
  manualCancelRequired: boolean;
}

/**
 * `details[0]` of 422 CARRIER_ADDRESS_NAMES_REQUIRED: the courier refuses
 * this account its address list. Resend with `carrierAddress: { names }`,
 * one name per entry of `levels`, top first.
 */
export interface CarrierAddressNamesRequiredDetail {
  field: "carrierAddress.names";
  message: string;
  levels: string[];
}

/**
 * `details[0]` of 422 CARRIER_ADDRESS_REJECTED: the courier refused one
 * level of the drop-off address (`field` "carrierAddress.names.1",
 * `level` "city") or the whole of it (`field` "carrierAddress.names",
 * `level` null). `carrierAddress.path…` when the address was picked.
 * The error message names it; with the pickup address unchecked it also
 * says the courier may mean that one.
 */
export interface CarrierAddressRejectedDetail {
  field: string;
  message: string;
  level: string | null;
  carrierErrorCode: string;
}

/**
 * `details` of CARRIER_ERROR (424): the courier's own code, its message
 * (credential values cut out, at most 300 characters) and HTTP status,
 * when the courier sent them.
 */
export interface CarrierErrorDetails {
  carrierErrorCode?: string | null;
  carrierMessage?: string | null;
  httpStatus?: number;
  [key: string]: unknown;
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

// ---------------------------------------------------------------------
// Online payments (merchant's own gateway account: Paymob, Kashier, Fawaterak)
// ---------------------------------------------------------------------

export type GatewayMode = "test" | "live";
export type LocalizedText = { en: string; ar: string };

export interface GatewayFieldDescriptor {
  key: string;
  label: LocalizedText;
  /** Credentials: typed into a password field, never shown again. */
  secret?: boolean;
  placeholder?: string;
  /** Settings: the payment method this field turns on. */
  method?: OnlineMethod;
  type?: "integer";
}

export interface PaymentGatewayConnection {
  /** "invalid" once the gateway refused the stored keys. */
  status: "active" | "invalid";
  /** From the keys (Kashier: which host accepts them): test-mode methods only show in the store preview. */
  mode: GatewayMode;
  settings: Record<string, unknown>;
  /** The methods these settings can take. */
  methods: Array<OnlineMethod>;
  /**
   * Warning codes about the connected account. "customer_pays_fees": the
   * gateway adds its fees to what the shopper pays (Fawaterak). Older servers
   * leave it out.
   */
  notices?: string[];
  /** Paste into each gateway integration (see webhookSetup). */
  webhookUrl: string;
  lastVerifiedAt: string | null;
  /** The last signed callback received; null until the first one. */
  lastWebhookAt: string | null;
  connectedAt: string;
  updatedAt: string;
}

export interface PaymentGatewayInfo {
  code: string;
  name: string;
  methods: Array<OnlineMethod>;
  currencies: string[];
  credentialFields: GatewayFieldDescriptor[];
  settingFields: GatewayFieldDescriptor[];
  setupSteps: { en: string[]; ar: string[] };
  helpLinks: Array<{ label: LocalizedText; url: string }>;
  /**
   * Where the merchant pastes our webhook URL. `automatic`: the gateway is
   * given the URL with every payment (Kashier), so pasting it is optional —
   * it only adds refunds made in the gateway's own dashboard.
   */
  webhookSetup: { field: string; perIntegration: boolean; automatic?: boolean };
  /**
   * true: the gateway's methods come from its own account (Kashier) —
   * settingFields is empty and the connect form is just the keys.
   */
  methodsFromAccount: boolean;
  /**
   * true: refunds of this gateway's payments are made in its own dashboard,
   * never from ours (Fawaterak). Older servers leave it out.
   */
  refundsInGatewayDashboard?: boolean;
  connection: PaymentGatewayConnection | null;
}

/**
 * GET /payments/gateways. `configured: false`: the server has no
 * GATEWAY_CREDENTIALS_KEY and every gateway call answers 503
 * GATEWAYS_NOT_CONFIGURED. `onlineEnabled: false`: shoppers only see cash on
 * delivery for now, whatever is connected here.
 */
export interface PaymentGatewayList {
  configured: boolean;
  onlineEnabled: boolean;
  gateways: PaymentGatewayInfo[];
}

export interface ConnectPaymentGatewayPayload {
  /** Required on first connect; omit to keep (and re-verify) the stored keys. */
  credentials?: Record<string, string>;
  settings?: Record<string, unknown>;
}

/**
 * 'cod' or '<gateway>:<method>', e.g. 'paymob:card'. At most one gateway per
 * method may be enabled (PUT /payments/methods answers 422 otherwise); a
 * gateway connected later is added switched off for a method already taken.
 */
export interface PaymentMethodEntry {
  id: string;
  provider: string | null;
  method: "cod" | OnlineMethod;
  enabled: boolean;
  /** false: its gateway is not connected (or cannot take it). Kept in the list, never offered. */
  available: boolean;
  mode: GatewayMode | null;
}

export interface PaymentMethodList {
  onlineEnabled: boolean;
  methods: PaymentMethodEntry[];
}

/** What a shopper is offered at checkout, in the merchant's order. */
export interface StorefrontPaymentMethod {
  id: string;
  provider: string | null;
  method: "cod" | OnlineMethod;
  mode: GatewayMode;
}

/** POST /store/:id/checkout with an online method. */
export interface CheckoutResult {
  order: Order;
  payment?: {
    id: string;
    status: PaymentStatus;
    provider: string;
    method: OnlineMethod;
    mode: GatewayMode;
    /** Send the shopper here. null when the gateway could not start the payment. */
    redirectUrl: string | null;
    failureReason: string | null;
    expiresAt: string | null;
  };
  /** Shown once: the shopper's key to the payment status / retry / switch-to-COD endpoints. */
  paymentToken?: string;
  /** A manual method (InstaPay, a wallet): where to pay and the proof's status. */
  manualPayment?: ShopperManualPayment;
}

export type ShopperPaymentState = "awaiting_payment" | "paid" | "expired" | "cancelled" | "cod";

export interface ShopperPaymentStatus {
  orderId: string;
  orderNumber: string;
  status: ShopperPaymentState;
  financialState: FinancialState;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  expiresAt: string | null;
  testMode: boolean;
  attempt: {
    id: string;
    status: PaymentStatus;
    provider: string;
    method: OnlineMethod | null;
    mode: GatewayMode | null;
    redirectUrl: string | null;
    failureReason: string | null;
    createdAt: string;
  } | null;
  canRetry: boolean;
  retriesLeft: number;
  canSwitchToCod: boolean;
  /** Online methods a retry may use. */
  methods: StorefrontPaymentMethod[];
}

/** One gateway callback / redirect / inquiry answer recorded against the order. */
export interface PaymentEventEntry {
  id: string;
  source: "webhook" | "redirect" | "inquiry";
  kind: "payment" | "refund" | "void" | null;
  providerCode: string;
  providerTransactionId: string | null;
  paymentId: string | null;
  /** e.g. paid, failed, pending, duplicate, refund_processed, gateway_refund_recorded, error */
  outcome: string | null;
  error: string | null;
  processedAt: string | null;
  createdAt: string;
}

/** GET /orders/:id/payment-timeline (and POST .../payments/sync). Amounts are numbers, minor units. */
export interface PaymentTimeline {
  orderId: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  pendingRefunds: number;
  /** What a new refund may be, at most (the server enforces the same rule). */
  refundable: number;
  /** 'gateway': refunds go back through the gateway; 'manual': recorded only (COD / manual). */
  refundVia: "gateway" | "manual";
  /**
   * Gateway payments that can still give money back. A refund draws on exactly one.
   * `refundInGatewayDashboard`: refunded in the gateway's own dashboard, never
   * from here (Fawaterak); POST /refunds answers 422 REFUND_IN_GATEWAY_DASHBOARD.
   */
  perPayment: Array<{ paymentId: string; refundable: number; refundInGatewayDashboard?: boolean }>;
  /** Payment risk flags needing the merchant: duplicate_payment, paid_after_expiry, test_payment, ... */
  alerts: string[];
  paymentExpiresAt: string | null;
  attempts: Payment[];
  events: PaymentEventEntry[];
  refunds: Refund[];
  /** Sync only: true when the gateway could not be reached for an open attempt. */
  unreachable?: boolean;
}

// ---------------------------------------------------------------------------
// Store analytics — /workspaces/:ws/analytics/summary (analytics.view)
// Orders, revenue and profit are computed from real orders in the range;
// `traffic` from the events the storefront's own tracker sends
// (POST /store/:ws/events). Money is integer minor units, rates are
// percentages (12.5 = 12.5%) and are `null` when the denominator is zero.
// ---------------------------------------------------------------------------

export interface AnalyticsSummaryParams {
  /** ISO date. Defaults to 30 days back; a range over 366 days is clamped. */
  from?: string;
  /** ISO date, exclusive. Defaults to now. */
  to?: string;
}

export interface AnalyticsOrderCounts {
  placed: number;
  pending: number;
  confirmed: number;
  rejected: number;
  unreachable: number;
  postponed: number;
  cancelled: number;
  /** Orders whose fulfilment state is `fulfilled`. */
  delivered: number;
  returned: number;
}

export interface AnalyticsRates {
  /** Confirmed / decided (confirmed + rejected + unreachable). */
  confirmation: number | null;
  /** Delivered / confirmed. */
  delivery: number | null;
  /** Returned / (delivered + returned). */
  return: number | null;
}

export interface AnalyticsRevenue {
  /** Total of non-cancelled, non-rejected orders. */
  gross: number;
  /** Total of delivered orders. */
  delivered: number;
  collected: number;
  refunded: number;
  /** Shipping charged to customers on delivered orders (courier cost is unknown). */
  shippingCharged: number;
  /** Discounts given on delivered orders. */
  discounts: number;
  averageOrderValue: number;
}

export interface AnalyticsProfit {
  deliveredItemsRevenue: number;
  discounts: number;
  /** From the cost snapshot on each order item. */
  productCost: number;
  refunded: number;
  /** deliveredItemsRevenue - discounts - productCost - refunded. */
  grossProfit: number;
  /**
   * Share of delivered quantity that had a cost recorded, as a percentage.
   * Anything under 100 means `productCost` — and so `grossProfit` — is partial.
   */
  costCoverage: number | null;
}

/** One day of the range. Every day is present, zero-filled. */
export interface AnalyticsSeriesPoint {
  /** YYYY-MM-DD in the workspace's timezone. */
  date: string;
  orders: number;
  revenue: number;
  delivered: number;
  /** Distinct storefront sessions that started that day; absent on older backends. */
  sessions?: number;
}

/**
 * Storefront visits, from the events the store's own tracker sends
 * (page views, product views, add to cart, checkout, purchase).
 */
export interface AnalyticsTraffic {
  sessions: number;
  visitors: number;
  pageViews: number;
  productViews: number;
  /** Distinct sessions that added to cart / reached checkout. */
  addToCart: number;
  checkouts: number;
  purchases: number;
  /** Sessions that placed an order ÷ sessions, as a percentage; null when there were no sessions. */
  conversionRate: number | null;
  addToCartRate: number | null;
  checkoutRate: number | null;
  byDevice: Array<{ device: "mobile" | "desktop" | "tablet" | "unknown"; sessions: number }>;
  bySource: Array<{ source: string; medium: string | null; sessions: number; orders: number }>;
  topPages: Array<{ path: string; views: number }>;
}

export interface AnalyticsTopProduct {
  productId: string | null;
  name: string | null;
  quantity: number;
  revenue: number;
}

export interface AnalyticsSummary {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  orders: AnalyticsOrderCounts;
  rates: AnalyticsRates;
  revenue: AnalyticsRevenue;
  profit: AnalyticsProfit;
  series: AnalyticsSeriesPoint[];
  /** Top 5 by quantity, from non-cancelled, non-rejected orders. */
  topProducts: AnalyticsTopProduct[];
  newCustomers: number;
  /** Absent on a backend without the storefront events endpoint. */
  traffic?: AnalyticsTraffic;
}

// ---------------------------------------------------------------------------
// Web analytics — /workspaces/:ws/analytics/web/*
// Umami-style page analytics over the storefront's own events: views are
// page_view events, visitors are distinct sessions, visits are 30-minute
// slices of a session, a bounce is a visit with one view and no event.
// ---------------------------------------------------------------------------

export type WebAnalyticsUnit = "minute" | "hour" | "day" | "month";
export type WebAnalyticsCompare = "prev" | "yoy";

export type WebAnalyticsFilterKey =
  | "url"
  | "referrer"
  | "title"
  | "browser"
  | "os"
  | "device"
  | "country"
  | "region"
  | "city"
  | "language"
  | "screen"
  | "event"
  | "hostname"
  | "tag"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term";

export type WebAnalyticsFilters = Partial<Record<WebAnalyticsFilterKey, string>>;

export interface WebAnalyticsRangeParams extends WebAnalyticsFilters {
  from?: string;
  to?: string;
  compare?: WebAnalyticsCompare;
  unit?: WebAnalyticsUnit;
  tz?: string;
}

export interface WebAnalyticsStatsValues {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  /** Seconds, summed across visits. */
  totaltime: number;
  bounceRate: number | null;
  /** Seconds. */
  avgVisitTime: number | null;
}

export interface WebAnalyticsStats extends WebAnalyticsStatsValues {
  comparison?: WebAnalyticsStatsValues;
}

export interface WebAnalyticsSeriesPoint {
  /** Bucket start, ISO. */
  t: string;
  pageviews: number;
  visitors: number;
}

export interface WebAnalyticsSeries {
  unit: WebAnalyticsUnit;
  series: WebAnalyticsSeriesPoint[];
  comparison?: WebAnalyticsSeriesPoint[];
}

export type WebAnalyticsMetricType =
  | "path"
  | "fullPath"
  | "entry"
  | "exit"
  | "title"
  | "query"
  | "referrer"
  | "channel"
  | "hostname"
  | "tag"
  | "browser"
  | "os"
  | "device"
  | "screen"
  | "language"
  | "country"
  | "region"
  | "city"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "event";

export interface WebAnalyticsMetricRow {
  x: string;
  y: number;
}

export interface WebAnalyticsMetrics {
  type: WebAnalyticsMetricType;
  rows: WebAnalyticsMetricRow[];
}

export interface WebAnalyticsWeekly {
  rows: Array<{ dow: number; hour: number; visitors: number }>;
}

export interface WebAnalyticsRealtimeActivity {
  sessionId: string;
  visitId: string | null;
  type: "pageview" | "event";
  eventName: string | null;
  urlPath: string | null;
  referrerDomain: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  createdAt: string;
}

export interface WebAnalyticsRealtime {
  totals: { views: number; visitors: number; events: number; countries: number };
  series: WebAnalyticsSeriesPoint[];
  activity: WebAnalyticsRealtimeActivity[];
  urls: WebAnalyticsMetricRow[];
  referrers: WebAnalyticsMetricRow[];
  countries: WebAnalyticsMetricRow[];
  activeVisitors: number;
  /** Server time the snapshot was taken, ISO. */
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Funnel analytics — /workspaces/:ws/analytics/funnels[/:funnelId]
// Sessions come from the funnel session log the storefront writes as a
// visitor moves through a funnel; orders are the real orders placed inside
// it. Rates are percentages, null when the denominator is zero.
// ---------------------------------------------------------------------------

export interface FunnelAnalyticsTotals {
  /** Funnel sessions started in the range. */
  sessions: number;
  /** Sessions in which a checkout was completed. */
  completed: number;
  /** Non-cancelled, non-rejected orders placed inside the funnel. */
  orders: number;
  revenue: number;
  /** Follow-on orders from accepted upsells/downsells, and their revenue. */
  upsellOrders: number;
  upsellRevenue: number;
  /** completed ÷ sessions. */
  conversionRate: number | null;
}

export interface FunnelAnalyticsRow extends FunnelAnalyticsTotals {
  id: string;
  name: string;
  subdomain: string | null;
  status: string;
}

export interface FunnelAnalyticsOverview {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  totals: FunnelAnalyticsTotals;
  funnels: FunnelAnalyticsRow[];
}

export interface FunnelAnalyticsStep {
  key: string;
  name: string;
  stepType: string;
  /** Sessions that got to this step. */
  reached: number;
  /** Sessions still sitting on this step that never moved on. */
  dropped: number;
  /** reached ÷ sessions. */
  reachRate: number | null;
}

export interface FunnelAnalyticsSource {
  source: string;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  completed: number;
  orders: number;
  revenue: number;
}

export interface FunnelAnalyticsSeriesPoint {
  date: string;
  sessions: number;
  orders: number;
  revenue: number;
}

export interface FunnelAnalyticsDetail extends FunnelAnalyticsTotals {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  funnel: { id: string; name: string; subdomain: string | null; status: string };
  steps: FunnelAnalyticsStep[];
  sources: FunnelAnalyticsSource[];
  series: FunnelAnalyticsSeriesPoint[];
}

// ===========================================================================
// Merchant operations added on top of upstream: COD settlements, WhatsApp
// Cloud API, order automations, browser ad pixels and the media library list.
// Backend: src/modules/{settlements,whatsapp,automations,media} and the
// `tracking_pixels` key of PATCH /workspaces/:id.
// ===========================================================================

// ---------------------------------------------------------------------------
// COD settlements — /workspaces/:ws/settlements
//
// Every amount here is an integer in MINOR units (piastres), like the rest of
// the order money in this file. `netAmount` is `collectedAmount - feesAmount`,
// computed by the server from the lines — never recompute it client-side.
// ---------------------------------------------------------------------------

export type SettlementStatus = "draft" | "confirmed";

/** `GET /settlements/summary` -> `{ summary: {...} }`. */
export interface SettlementSummary {
  unsettledOrders: number;
  /** Still owed by couriers across every delivered, unsettled COD order. */
  dueFromCouriers: number;
  /** Net of confirmed settlements only — drafts record nothing. */
  received: number;
  courierFees: number;
  draftSettlements: number;
}

/** One delivered COD order that is not on any settlement yet. */
export interface UnsettledOrder {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  /** Carrier of the delivering shipment, which is how rows are grouped. */
  carrierCode: string;
  shipmentId: string | null;
  waybillNumber: string | null;
  deliveredAt: string | null;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  /** `totalAmount - amountPaid`, floored at 0. The default collected amount. */
  dueAmount: number;
}

export interface UnsettledCarrier {
  carrierCode: string;
  /** One of the store's own couriers; carrierCode is then their name. */
  courierId?: string | null;
  orders: number;
  dueAmount: number;
}

export interface UnsettledResponse {
  orders: UnsettledOrder[];
  carriers: UnsettledCarrier[];
}

export interface SettlementListItem {
  id: string;
  carrierCode: string;
  reference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: SettlementStatus;
  /**
   * Absent on rows the server stored before it recorded one. Fall back to the
   * workspace currency rather than assuming EGP at the call site.
   */
  currency?: string;
  collectedAmount: number;
  feesAmount: number;
  netAmount: number;
  confirmedAt: string | null;
  createdAt: string;
}

export interface SettlementLine {
  orderId: string;
  /** Null when the order behind the line has since been removed. */
  orderNumber: string | null;
  customerName: string | null;
  orderTotal: number | null;
  financialState: string | null;
  collectedAmount: number;
  feeAmount: number;
}

export interface SettlementDetail extends SettlementListItem {
  notes: string | null;
  lines: SettlementLine[];
}

export interface SettlementListResponse {
  settlements: SettlementListItem[];
  nextCursor: string | null;
}

export interface SettlementLinePayload {
  orderId: string;
  /** Omit to settle the order's full `dueAmount`. Never more than it (422). */
  collectedAmount?: number;
  feeAmount: number;
}

export interface CreateSettlementPayload {
  carrierCode: string;
  /** The store's own courier whose cash this is. */
  courierId?: string | null;
  reference?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
  lines: SettlementLinePayload[];
}

/** Drafts only. Sending `lines` replaces every line on the settlement. */
export type UpdateSettlementPayload = Partial<CreateSettlementPayload>;

// ---------------------------------------------------------------------------
// WhatsApp Cloud API — /workspaces/:ws/whatsapp
// ---------------------------------------------------------------------------

export type WhatsappIntegrationStatus = "connected" | "error";

export interface WhatsappIntegrationConnected {
  connected: true;
  status: WhatsappIntegrationStatus;
  phoneNumberId: string;
  businessAccountId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  /** Masked — the real token never leaves the server. */
  accessTokenMask: string | null;
  /** False means inbound webhook signatures cannot be verified. */
  appSecretSet: boolean;
  webhook: { url: string; verifyToken: string };
  lastVerifiedAt: string | null;
  lastError: string | null;
}

/**
 * A workspace with no integration row answers the bare `{ connected: false }`,
 * so narrow on `connected` before reading any other field.
 */
export type WhatsappIntegration = { connected: false } | WhatsappIntegrationConnected;

export interface ConnectWhatsappPayload {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
  appSecret?: string;
}

export type WhatsappConversationStatus = "open" | "closed";

export interface WhatsappConversation {
  id: string;
  /** Normalized, digits only, with country code. */
  phone: string;
  customerName: string | null;
  customerId: string | null;
  status: WhatsappConversationStatus;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  /**
   * Whether the customer messaged within the last 24 hours. False means
   * WhatsApp only allows an approved template, not free text.
   */
  canReply: boolean;
}

export interface WhatsappConversationListParams {
  status?: WhatsappConversationStatus;
  search?: string;
  limit?: number;
  before?: string;
}

export interface WhatsappConversationListResponse {
  conversations: WhatsappConversation[];
  nextCursor: string | null;
}

export type WhatsappMessageStatus = "received" | "sent" | "delivered" | "read" | "failed";

export interface WhatsappMessage {
  id: string;
  direction: "in" | "out";
  /** "text" for anything renderable; the raw Meta type otherwise. */
  type: string;
  body: string | null;
  templateName: string | null;
  status: WhatsappMessageStatus;
  error: string | null;
  createdAt: string;
}

/** Messages come back oldest -> newest; `nextCursor` pages further back. */
export interface WhatsappMessageListResponse {
  messages: WhatsappMessage[];
  nextCursor: string | null;
}

export interface WhatsappTemplatePayload {
  /** The approved template name in Meta: lowercase, digits, underscores. */
  name: string;
  language: string;
  /** Fills the template's numbered placeholders, in order. */
  params: string[];
}

/** Exactly one of `text` / `template` — the API rejects both or neither. */
export type SendWhatsappPayload =
  | { to: string; text: string }
  | { to: string; template: WhatsappTemplatePayload };

export interface SentWhatsappMessage {
  id: string;
  conversationId: string;
  direction: "in" | "out";
  type: string;
  body: string | null;
  status: WhatsappMessageStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Order automations — /workspaces/:ws/automations
// ---------------------------------------------------------------------------

export type AutomationTrigger =
  | "order.created"
  | "order.confirmed"
  | "order.rejected"
  | "order.cancelled"
  | "order.shipped"
  | "order.out_for_delivery"
  | "order.delivered";

export type AutomationPaymentMethod = PaymentMethod;

/** An empty object means the rule fires on every order for its trigger. */
export interface AutomationConditions {
  paymentMethod?: AutomationPaymentMethod | null;
  /** Minor units. */
  minTotalAmount?: number | null;
}

export interface AutomationWhatsappAction {
  type: "whatsapp_template";
  template: string;
  language: string;
  /** Each entry may carry `{{token}}` placeholders the engine renders. */
  params: string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  isActive: boolean;
  conditions: AutomationConditions;
  actions: AutomationWhatsappAction[];
  createdAt: string;
  updatedAt: string;
  stats: { sent: number; skipped: number; failed: number; lastRunAt: string | null };
}

/**
 * `triggers` and `tokens` are the server's own vocabularies, sent alongside
 * the rules so a new trigger needs no release here. Treat both as open sets.
 */
export interface AutomationListResponse {
  rules: AutomationRule[];
  triggers: AutomationTrigger[];
  tokens: string[];
}

export interface AutomationRulePayload {
  name: string;
  trigger: AutomationTrigger;
  isActive?: boolean;
  conditions?: AutomationConditions;
  actions: AutomationWhatsappAction[];
}

export type AutomationRunStatus = "sent" | "skipped" | "failed";

export interface AutomationRun {
  id: string;
  ruleId: string;
  trigger: AutomationTrigger;
  status: AutomationRunStatus;
  /** Why it skipped, or the send error. */
  detail: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string | null } | null;
}

export interface AutomationRunListParams {
  ruleId?: string;
  status?: AutomationRunStatus;
  limit?: number;
  before?: string;
}

export interface AutomationRunListResponse {
  runs: AutomationRun[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Browser ad pixels — the `tracking_pixels` key of workspace settings
// ---------------------------------------------------------------------------

/**
 * Browser ad pixels loaded on the public store. IDs only, never secrets — the
 * storefront echoes them back in its public `tracking` block. The backend
 * validates each against the network's own format and rejects anything else
 * with a 422, so a typo fails the save rather than silently breaking tracking.
 */
export interface TrackingPixels {
  /** Meta (Facebook) pixel ID — 5–20 digits. */
  meta?: string | null;
  /** TikTok pixel ID — 10–30 upper-case letters and digits. */
  tiktok?: string | null;
  /** Snapchat pixel ID — a UUID-shaped string. */
  snapchat?: string | null;
  /** Google tag — `G-`, `AW-` or `GT-` followed by 4–20 characters. */
  google_tag?: string | null;
}

/**
 * Settings keys written by updateWorkspaceSettings. Sent as a partial merge:
 * an omitted key keeps its stored value, `null` clears it.
 */
export interface UpdateWorkspaceSettingsPayload {
  tracking_pixels?: TrackingPixels | null;
}

// ---------------------------------------------------------------------------
// Media library — GET/DELETE /workspaces/:ws/media
// `uploadMedia` adds to the same library. Deleting removes the library entry.
// ---------------------------------------------------------------------------

export interface MediaAsset {
  id: string;
  /** Absolute URL. */
  url: string;
  mimeType: string;
  /** Bytes. */
  size: number;
  createdAt: string;
}

export interface MediaListParams {
  /** 1–100. */
  limit?: number;
  /** The `nextCursor` of the previous page (the id of its last asset). */
  before?: string;
}

export interface MediaListResponse {
  media: MediaAsset[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Orders export — GET /workspaces/:ws/orders/export(.columns)
// ---------------------------------------------------------------------------

export interface OrderExportColumn {
  key: string;
  label: { en: string; ar: string };
  /** Only meaningful on a one-row-per-item file. */
  perItem: boolean;
}

export interface OrderExportCatalogue {
  columns: OrderExportColumn[];
  /** The columns a file gets when none are named, per row mode. */
  defaults: { order: string[]; item: string[] };
  /** A file stops after this many orders; narrow the dates to get the rest. */
  maxOrders: number;
}

/** The orders list's own filters, plus what the file should look like. */
export interface OrderExportParams extends OrderSearchParams {
  sort?: OrderSort;
  stage?: OrderStage;
  confirmationState?: ConfirmationState;
  financialState?: FinancialState;
  fulfillmentState?: FulfillmentState;
  columns?: string[];
  /** One row per order (default) or one per order line. */
  rowPer?: "order" | "item";
  /** Language of the header row and the status words. */
  lang?: "en" | "ar";
}
