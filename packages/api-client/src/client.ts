import { shopperTokenHeaders } from "./shopperToken";
import { createLocalStorageTokenStorage, type TokenStorage } from "./tokenStorage";
import type { TwoFactorChallenge } from "./endpoints/twoFactor";
import type {
  CustomerUpload,
  ShopperManualPayment,
  StorefrontManualMethod,
  CustomizationInput,
  CatalogOptionName,
  CollectionReorderItem,
  StorefrontListing,
  StorefrontListingParams,
  StorefrontSuggestions,
  AddCustomerAddressPayload,
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminAuditEntry,
  AdminAuditLogPage,
  AdminAuditLogParams,
  AdminBlocklistEntry,
  AdminBlocklistPage,
  AdminBlocklistParams,
  AdminBlocklistUpdate,
  AdminBlockPayload,
  AdminBlockResult,
  AdminCarrierRegistry,
  AdminAgentDetail,
  AdminAgentList,
  AdminCharge,
  AdminRecordPaymentResult,
  AdminVoidChargeResult,
  AdminReversePaymentResult,
  AdminSpecialTerm,
  AdminSpecialTermsInput,
  AdminStoreAccess,
  WorkspaceAccess,
  LockedOrdersSummary,
  GoLiveResult,
  SubscriptionPlans,
  PlanSwitchPreview,
  PlanSwitchStartResult,
  PlanSwitchCancelResult,
  PlanSwitchTiming,
  BillingChargeCancelResult,
  ReferralCodePreview,
  MerchantInvoice,
  MerchantInvoicePage,
  PublicPlan,
  SignupOptions,
  VerificationChallenge,
  VerificationChannel,
  VerificationSent,
  EmailCodeSent,
  BillingCycle,
  AdminWorkspaceCharges,
  AdminCommission,
  AdminCommissionPage,
  AdminCommissionParams,
  AdminCreateAgentResult,
  AdminGrantPayload,
  AdminGrantResult,
  AdminPaymentGatewayRegistry,
  AdminPlatformAdmin,
  AdminReferralCode,
  AdminReferralCodeInput,
  AdminReferralCodeList,
  AdminReferralCodeParams,
  AdminReferralCodeDetail,
  AdminRedemption,
  AdminRedemptionPage,
  AdminRedemptionParams,
  AdminReferralSimulation,
  AdminWorkspaceReferrals,
  AdminAgentLink,
  AdminAgentLinkInput,
  ReferralTerms,
  ReferralCommissionBasis,
  AdminRolesResponse,
  WorkspaceBilling,
  OnlinePayment,
  OnlinePaymentResult,
  AdminProviderCheck,
  AdminRiskSignalPage,
  AdminRiskSignalParams,
  AdminTemplate,
  AdminTemplateDetail,
  AdminTemplateInput,
  AdminTemplateKind,
  AdminTemplateVersion,
  AdminTemplateVersionInput,
  AdminTemplateVersionSummary,
  AdminFeatureFlag,
  AdminFeatureFlagInput,
  AdminOverview,
  AdminPlan,
  AdminPlanInput,
  AdminPlansWithCatalog,
  AdminServiceReport,
  AdminServiceTile,
  AdminSupportTicket,
  AdminSupportTicketMessage,
  AdminSupportTicketPage,
  AdminSupportTicketParams,
  AdminSupportTicketThread,
  OpenSupportTicketPayload,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketThread,
  AdminSubscription,
  AdminWorkspaceOverview,
  AdminUserDetail,
  AdminUserModeration,
  AdminUserSearchPage,
  AdminManualSubscription,
  AdminManualActionResult,
  AdminWorkspaceFeatures,
  AdminFeatureOverride,
  PlanFeatureKey,
  AnalyticsSummary,
  AnalyticsSummaryParams,
  FunnelAnalyticsDetail,
  FunnelAnalyticsOverview,
  WebAnalyticsMetricType,
  WebAnalyticsMetrics,
  WebAnalyticsRangeParams,
  WebAnalyticsRealtime,
  WebAnalyticsSeries,
  WebAnalyticsStats,
  WebAnalyticsWeekly,
  ArchivedResponse,
  AuthTokens,
  AuthUser,
  UsernameAvailability,
  BlacklistPayload,
  BlocklistEntry,
  BlockPhonePayload,
  BlockPhoneResult,
  CaptureCheckoutSessionPayload,
  CarrierAddressTree,
  CarrierAreaNode,
  CarrierCity,
  CarrierList,
  CheckoutResult,
  PaymentTimeline,
  Refund,
  ConnectPaymentGatewayPayload,
  PaymentGatewayInfo,
  PaymentGatewayList,
  PaymentMethodList,
  ShopperPaymentStatus,
  StorefrontPaymentMethod,
  Cart,
  CheckoutRecoveryStatus,
  CheckoutSession,
  CheckoutSessionListParams,
  CheckoutSessionListResponse,
  ConnectCarrierPayload,
  ConnectCarrierResult,
  FlaggedOrderListParams,
  FlaggedOrderListResponse,
  CheckoutPayload,
  CollectionDetail,
  CollectionSummary,
  AssignConfirmationTasksResult,
  ConfirmationAssignee,
  ConfirmationChannel,
  ConfirmationQueueCounts,
  ConfirmationQueuePage,
  ConfirmationQueueParams,
  ConfirmationTask,
  CorrectConfirmationOutcomePayload,
  ManualCancelAcknowledgement,
  CreateCollectionPayload,
  CreateDiscountPayload,
  CreateOfferPayload,
  CreateOrderPayload,
  CreateProductPayload,
  CreateProductResponse,
  CreateReturnPayload,
  CreateShipmentPayload,
  ReplaceWeightTiersPayload,
  SetPricingModePayload,
  SetPricingModeResult,
  ShippingQuote,
  ShippingSettings,
  ShippingSettingsResponse,
  UpdateShippingSettingsPayload,
  ShippingQuotePayload,
  WeightTier,
  WeightTierSettings,
  CreateShippingRatePayload,
  CreateShippingZonePayload,
  CreateTaxRatePayload,
  CreateVariantPayload,
  CreateWebsitePagePayload,
  CreateWebsitePayload,
  Customer,
  CustomerAddress,
  CustomerListParams,
  CustomerListResponse,
  DeletedResponse,
  Discount,
  DiscountStatus,
  HealthProbeResult,
  InviteMemberPayload,
  LoginPayload,
  MediaUploadResponse,
  Membership,
  Offer,
  WorkspaceOfferOption,
  Order,
  OrderListParams,
  OrderListResponse,
  OrderPipeline,
  OrderSearchParams,
  Product,
  ProductListParams,
  ProductListResponse,
  PublishWebsiteResult,
  RecordConfirmationOutcomePayload,
  RegisterPayload,
  ReturnListParams,
  ReturnRequest,
  Review,
  ReviewListParams,
  Shipment,
  ShipmentSyncResult,
  ShippingRate,
  ShippingZone,
  StorefrontCollection,
  StorefrontMeta,
  StorefrontProductDetail,
  StorefrontProductList,
  StorefrontPageData,
  StorefrontPageResult,
  SuccessResponse,
  TaxRate,
  TrackResult,
  UpdateCollectionPayload,
  UpdateCustomerAddressPayload,
  UpdateCustomerPayload,
  UpdateDiscountPayload,
  UpdateOfferPayload,
  UpdateOrderPayload,
  UpdateProductPayload,
  UpdateShipmentPayload,
  UpdateShippingRatePayload,
  UpdateShippingZonePayload,
  UpdateTaxRatePayload,
  UpdateVariantPayload,
  UpdateWorkspacePayload,
  SlugCheckResult,
  Variant,
  UpdateWebsitePagePayload,
  Website,
  WebsiteDetail,
  WebsitePage,
  WebsiteTemplateDetail,
  WebsiteTemplateSummary,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
  BillingPaymentMethodList,
  BillingPaymentProof,
  OpenBillingInvoiceResult,
  AdminPaymentMethod,
  AdminPaymentMethods,
  AdminPaymentProofPage,
  AdminPaymentProofReview,
  WalletConsoleEntryResult,
  WalletRefundBreakdown,
  WalletRefundOverview,
  WalletRefundRequest,
  WalletRefundStatus,
  AdminWalletRefund,
  AdminWalletRefundPage,
  WalletLedgerPage,
  WalletSummary,
  AccountChangeRequest,
  AccountSettingsInfo,
  AutomationListResponse,
  AutomationRule,
  AutomationRulePayload,
  AutomationRunListParams,
  AutomationRunListResponse,
  ConnectWhatsappPayload,
  CreateSettlementPayload,
  MediaListParams,
  MediaListResponse,
  OrderExportCatalogue,
  OrderExportParams,
  SendWhatsappPayload,
  SentWhatsappMessage,
  SettlementDetail,
  SettlementListResponse,
  SettlementStatus,
  SettlementSummary,
  UnsettledResponse,
  UpdateSettlementPayload,
  UpdateWorkspaceSettingsPayload,
  WhatsappConversationListParams,
  WhatsappConversationListResponse,
  WhatsappConversationStatus,
  WhatsappIntegration,
  WhatsappMessageListResponse,
} from "./types";

function buildQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  /**
   * Seconds to wait before retrying, from the response's `Retry-After` header.
   * Only the rate limiters (429) set it — undefined on every other failure.
   *
   * Also undefined cross-origin unless the API lists `Retry-After` in its
   * `Access-Control-Expose-Headers`, which it does not today: the header is
   * sent but browsers hide it. Callers must have a message for that case.
   */
  retryAfter?: number;

  constructor(message: string, status: number, code?: string, details?: unknown, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

/**
 * Unwraps `{ <key>: [...] }`, also accepting a bare array.
 *
 * The older admin methods destructure their envelope and fall back to `[]`,
 * which turns an envelope mismatch into an empty screen. For a log or a
 * status board "nothing here" is a meaningful reading, so these throw instead:
 * an admin must never be shown a clean slate that is really a parse failure.
 */
function unwrapList<T>(body: unknown, key: string): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
    // An explicit null is the server stating there are no rows. A key that is
    // ABSENT is an envelope mismatch — the very case this helper exists to
    // catch — so it must fall through to the throw. Reading a missing key as
    // empty is how `{ entries: [...] }` would render as a clean, empty log.
    if (value === null && key in record) return [];
  }
  throw new ApiError(
    `Unexpected response shape: expected an array or { ${key}: [...] }.`,
    500,
    "unexpected_response",
    body
  );
}

/**
 * Reads a boolean flag that sits alongside a payload in the envelope.
 *
 * Unlike `unwrapList` this never throws: the flag is metadata about the
 * payload, not the payload itself, and an older server that omits it must not
 * fail a response whose rows are perfectly readable. Absent or non-boolean
 * reads as false — the conservative direction for a "was this cached?" flag,
 * since it claims less than the server did rather than more.
 */
function readFlag(body: unknown, key: string): boolean {
  if (body && typeof body === "object") {
    return (body as Record<string, unknown>)[key] === true;
  }
  return false;
}

/**
 * Unwraps `{ <key>: {...} }`, requiring the envelope key.
 *
 * Same contract as `unwrapList`, for endpoints that answer with a single
 * record: a dashboard that renders zeroes because the envelope moved is worse
 * than one that says it could not read the response.
 *
 * Deliberately does NOT fall back to treating the whole body as the record.
 * That tolerance looks harmless and is not: under it a renamed envelope
 * (`{ metrics: {...} }`) hands back the envelope itself as though it were the
 * payload, and the caller reads every field as undefined instead of being told
 * the shape was wrong.
 */
function unwrapObject<T>(body: unknown, key: string): T {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  }
  throw new ApiError(
    `Unexpected response shape: expected { ${key}: {...} }.`,
    500,
    "unexpected_response",
    body
  );
}

/**
 * Reads a numeric envelope field, or null when the server sent none.
 *
 * Null rather than 0 on purpose: "the server did not report a total" and "the
 * total is zero" are different statements, and only the second one licenses
 * the UI to print a count.
 */
function numberField(body: unknown, key: string): number | null {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export interface ApiClientOptions {
  /** e.g. http://localhost:4000/api/v1 */
  baseUrl: string;
  tokenStorage?: TokenStorage;
  /** Called whenever refresh fails / the session becomes invalid. */
  onSessionExpired?: () => void;
  /** Sent with every request; a call's own headers win on a clash. */
  defaultHeaders?: Record<string, string>;
  /**
   * Makes the client's requests in place of the global fetch, with the same
   * arguments. The storefront's server passes one that sends a call once more
   * on the public address when its private one can't be reached
   * (apps/storefront/src/lib/serverApiBase.ts).
   */
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // attach Authorization header (default true)
  idempotent?: boolean; // attach a fresh Idempotency-Key header
  signal?: AbortSignal;
  /**
   * Passed straight to fetch. Only the storefront page lookup needs it: that
   * endpoint answers a moved page with a 301 whose Location is a *store* path,
   * which the default "follow" would resolve against the API host and turn into
   * a 404. "manual" keeps the 301 (and its JSON body) intact.
   */
  redirect?: RequestRedirect;
}

/** How long a courier's address tree is reused before it is fetched again. */
const ADDRESS_TREE_TTL_MS = 10 * 60 * 1000;

function findAreaNode(nodes: CarrierAreaNode[], id: string): CarrierAreaNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const below = node.children ? findAreaNode(node.children, id) : null;
    if (below) return below;
  }
  return null;
}

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** The lock the tabs of one site take turns on to refresh their shared tokens. */
const REFRESH_LOCK = "sb.auth.refresh";
/** How long a tab waits for its turn before refreshing anyway, as it did before the lock. */
const REFRESH_LOCK_WAIT_MS = 10_000;

/**
 * Runs `refresh` while no other tab of this site is refreshing (the Web Locks
 * API). Outside a browser, or in one without it, it runs at once. A tab that
 * holds the lock too long (frozen, or a request that never answers) does not
 * hold the others up: after REFRESH_LOCK_WAIT_MS the waiting tab goes ahead.
 */
async function inRefreshTurn<T>(refresh: () => Promise<T>): Promise<T> {
  const locks = typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return refresh();

  const waiting = new AbortController();
  const timer = setTimeout(() => waiting.abort(), REFRESH_LOCK_WAIT_MS);
  let started = false;
  try {
    return await locks.request(REFRESH_LOCK, { signal: waiting.signal }, async () => {
      started = true;
      clearTimeout(timer);
      return refresh();
    });
  } catch (err) {
    // The wait was given up, or the browser refused the lock: refresh without it.
    if (!started) return refresh();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiClient {
  private baseUrl: string;
  private tokenStorage: TokenStorage;
  private onSessionExpired?: () => void;
  private defaultHeaders: Record<string, string>;
  private fetchImpl: (input: string, init: RequestInit) => Promise<Response>;
  private refreshPromise: Promise<boolean> | null = null;
  private addressTrees = new Map<string, { at: number; value: Promise<CarrierAddressTree> }>();

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tokenStorage = options.tokenStorage ?? createLocalStorageTokenStorage();
    this.onSessionExpired = options.onSessionExpired;
    this.defaultHeaders = options.defaultHeaders ?? {};
    // Always called as a plain function: a browser's fetch refuses any other
    // `this`. The global one is looked up on each call, as before.
    const custom = options.fetch;
    this.fetchImpl = custom ? (input, init) => custom(input, init) : (input, init) => fetch(input, init);
  }

  get tokens() {
    return this.tokenStorage.get();
  }

  isAuthenticated(): boolean {
    return Boolean(this.tokenStorage.get().accessToken);
  }

  setTokens(tokens: AuthTokens) {
    this.tokenStorage.set(tokens);
  }

  clearSession() {
    this.tokenStorage.clear();
  }

  /** Low-level request used by every typed method below. Handles one
   * transparent retry after a silent refresh if the server returns 401. */
  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      body,
      headers = {},
      auth = true,
      idempotent = false,
      signal,
      redirect,
    } = opts;

    const doFetch = async (): Promise<Response> => {
      const finalHeaders: Record<string, string> = {
        // Only a request that sends a body says what the body is. A GET or a
        // HEAD with no Content-Type (and no other header of its own) is a
        // "simple" cross-origin request, which the browser sends without
        // asking first (no CORS preflight): the storefront's public reads.
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...this.defaultHeaders,
        ...headers,
      };
      if (auth) {
        const { accessToken } = this.tokenStorage.get();
        if (accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;
      }
      if (idempotent) {
        finalHeaders["Idempotency-Key"] = randomKey();
      }
      return this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: finalHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
        redirect,
      });
    };

    let res = await doFetch();

    if (res.status === 401 && auth) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        res = await doFetch();
      }
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      if (res.status === 401 && auth) {
        this.clearSession();
        this.onSessionExpired?.();
      }
      const message =
        (isJson && payload && (payload.message || payload.error?.message)) ||
        `Request failed with status ${res.status}`;
      const code = isJson && payload ? payload.code || payload.error?.code : undefined;
      // Only ever sent with a 429; `Retry-After` may also be an HTTP date, which
      // Number() rejects — callers then fall back to a generic "try later".
      const retry = Number(res.headers.get("Retry-After"));
      const retryAfter = Number.isFinite(retry) && retry > 0 ? retry : undefined;
      throw new ApiError(message, res.status, code, payload, retryAfter);
    }

    return payload as T;
  }

  /**
   * Swaps the refresh token for a new pair. Only the server refusing it (401)
   * ends the session. A refresh that fails any other way — rate limited, a
   * server error, no network — keeps the session and throws that failure, so
   * the request that needed it fails with it and can be tried again.
   *
   * A refresh token works once: the server takes a second use of it for a
   * stolen copy and ends every session of the account. Two tabs share the
   * stored tokens, so only one of them refreshes at a time (`inRefreshTurn`);
   * the one that waited finds the new pair already stored and uses it.
   */
  private async tryRefresh(): Promise<boolean> {
    const { refreshToken } = this.tokenStorage.get();
    if (!refreshToken) return false;

    // Coalesce concurrent 401s into a single refresh call.
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          return await inRefreshTurn(async () => {
            const stored = this.tokenStorage.get().refreshToken;
            // Signed out in another tab while this one waited.
            if (!stored) return false;
            // Refreshed in another tab while this one waited.
            if (stored !== refreshToken) return true;
            const result = await this.request<AuthTokens>("/auth/refresh", {
              method: "POST",
              body: { refreshToken },
              auth: false,
            });
            this.setTokens(result);
            return true;
          });
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 401)) throw err;
          this.clearSession();
          this.onSessionExpired?.();
          return false;
        } finally {
          this.refreshPromise = null;
        }
      })();
    }
    return this.refreshPromise;
  }

  // ---------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------

  /**
   * Creates the account and keeps its tokens: it is signed in at once, with a
   * code on its way to confirm the email (`emailCode`). While sign-up codes
   * are on, the answer is a `VerificationChallenge` (no tokens) instead:
   * confirm it with `confirmVerificationCode`.
   */
  async register(payload: RegisterPayload) {
    const result = await this.request<
      ({ user: AuthUser; emailCode?: EmailCodeSent } & Partial<AuthTokens>) | VerificationChallenge
    >("/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
    });
    if (!("verificationRequired" in result) && result.accessToken && result.refreshToken) {
      this.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    }
    return result;
  }

  /**
   * Signs in and keeps the tokens — unless the account still has to confirm
   * a code, when the answer is a `VerificationChallenge` and nothing is kept.
   */
  async login(payload: LoginPayload) {
    // An API from before identifier sign-in reads only `email` (and drops the
    // fields it doesn't know), so an identifier that is an email also goes as
    // `email`: the dashboard can deploy before the API.
    const identifier = payload.identifier?.trim();
    const body = identifier && identifier.includes("@") && !payload.email ? { ...payload, email: identifier } : payload;
    const result = await this.request<(AuthTokens & { user: AuthUser }) | VerificationChallenge | TwoFactorChallenge>("/auth/login", {
      method: "POST",
      body,
      auth: false,
    });
    if ("verificationRequired" in result) return result;
    // Two-step sign-in (endpoints/twoFactor.ts): a challenge, no tokens yet.
    if ("twoFactorRequired" in result) return result;
    this.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  }

  /** `GET /auth/signup-options` — public: whether a plan, the terms and a code are required. */
  async getSignupOptions() {
    return this.request<SignupOptions>("/auth/signup-options", { auth: false });
  }

  /** `GET /plans/public` — the plans on offer, in order (prices in minor units). */
  async listPublicPlans() {
    const { plans } = await this.request<{ plans: PublicPlan[] }>("/plans/public", { auth: false });
    return plans;
  }

  /**
   * A new sign-up code by email or SMS. 429 RESEND_TOO_SOON (with
   * details.retryAfterSeconds) / VERIFICATION_LIMIT_REACHED, 422
   * CHANNEL_NOT_AVAILABLE.
   */
  async sendVerificationCode(verificationToken: string, channel: VerificationChannel, locale?: "ar" | "en") {
    return this.request<VerificationSent>("/auth/verify/send", {
      method: "POST",
      body: locale ? { channel, locale } : { channel },
      headers: { Authorization: `Bearer ${verificationToken}` },
      auth: false,
    });
  }

  /**
   * The code from the email or SMS: signs in on success (the tokens are kept).
   * 422 INVALID_CODE (details.attemptsLeft) / CODE_EXPIRED / NO_ACTIVE_CODE,
   * 429 TOO_MANY_ATTEMPTS, 401 VERIFICATION_TOKEN_INVALID.
   */
  async confirmVerificationCode(verificationToken: string, code: string) {
    const result = await this.request<AuthTokens & { user: AuthUser }>("/auth/verify/confirm", {
      method: "POST",
      body: { code },
      headers: { Authorization: `Bearer ${verificationToken}` },
      auth: false,
    });
    this.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  }

  /**
   * A code to confirm the signed-in account's email (the dashboard's banner).
   * 429 RESEND_TOO_SOON (details.retryAfterSeconds) /
   * VERIFICATION_LIMIT_REACHED, 409 ALREADY_VERIFIED, 503 EMAIL_UNAVAILABLE.
   */
  async sendAccountCode(locale?: "ar" | "en") {
    return this.request<VerificationSent>("/auth/me/email/send-code", {
      method: "POST",
      body: locale ? { locale } : {},
    });
  }

  /**
   * Confirms the signed-in account's email with its code; the session goes on
   * as it is. 422 INVALID_CODE (details.attemptsLeft) / CODE_EXPIRED /
   * NO_ACTIVE_CODE, 429 TOO_MANY_ATTEMPTS, 409 ALREADY_VERIFIED.
   */
  async confirmAccountCode(code: string) {
    return this.request<{ user: AuthUser; confirmed: true }>("/auth/me/email/confirm", {
      method: "POST",
      body: { code },
    });
  }

  /** The plan an account made through Google chooses (with the terms, when required). */
  async choosePlan(payload: { planId: string; billingCycle?: BillingCycle; acceptTerms?: boolean }) {
    return this.request<{ user: AuthUser; needsPlan: boolean }>("/auth/me/plan", { method: "POST", body: payload });
  }

  /**
   * Kick off a password reset. The backend deliberately answers with the same
   * `{ success: true }` whether or not the address is registered (account
   * enumeration guard), so a resolved call just means "show the check-your-inbox
   * notice" — it is not a signal that the email exists. `locale` is the
   * language of the email. 503 PASSWORD_RESET_UNAVAILABLE when the server
   * can't build the link; 429 past the per-IP hourly limit.
   */
  async requestPasswordReset(email: string, locale?: "ar" | "en") {
    return this.request<{ success: boolean }>("/auth/password-reset/request", {
      method: "POST",
      body: locale ? { email, locale } : { email },
      auth: false,
    });
  }

  /**
   * Finish a password reset using the token from the emailed link. Rejects with
   * ApiError (e.g. code "INVALID_RESET_TOKEN") when the token is unknown, used,
   * or expired.
   */
  async resetPassword(token: string, newPassword: string) {
    return this.request<{ success: boolean }>("/auth/password-reset/confirm", {
      method: "POST",
      body: { token, newPassword },
      auth: false,
    });
  }

  /**
   * Confirm a newly-registered address from the emailed verification link
   * (`https://app.zimos.co/verify-email?token=<token>`). On success the account
   * is expected to move from `pending_verification` to `active` so the user can
   * sign in.
   *
   * ⚠️ ASSUMPTION — NOT VERIFIED AGAINST THE BACKEND. Written without access to
   * the backend repo; the shape below is inferred from the sibling endpoints in
   * this file (`register`, `resetPassword`) and MUST be diffed against the real
   * route before it is relied on:
   *   • method + path : POST /api/v1/auth/verify-email   (auth: false)
   *   • request body  : { token }
   *   • success body  : { success: boolean }   (could instead be { user })
   *   • failure       : ApiError with code "INVALID_VERIFICATION_TOKEN" for an
   *                     unknown / already-used / expired token — mirrors the
   *                     "INVALID_RESET_TOKEN" code resetPassword documents.
   */
  async verifyEmail(token: string) {
    return this.request<{ success: boolean }>("/auth/verify-email", {
      method: "POST",
      body: { token },
      auth: false,
    });
  }

  /**
   * Re-send the verification email to a `pending_verification` account — used
   * from the login screen when the first link expired. Like
   * `requestPasswordReset`, this is expected to answer with the same
   * `{ success: true }` whether or not the address is registered / already
   * verified (account-enumeration guard), so a resolved call only means "show
   * the check-your-inbox notice".
   *
   *  ASSUMPTION — NOT VERIFIED AGAINST THE BACKEND (no backend repo in this
   * session). Inferred from `requestPasswordReset`:
   *   • method + path : POST /api/v1/auth/verify-email/resend   (auth: false)
   *                     (could instead be /auth/resend-verification)
   *   • request body  : { email }
   *   • success body  : { success: boolean }
   */
  async resendVerification(email: string) {
    return this.request<{ success: boolean }>("/auth/resend-verification", {
      method: "POST",
      body: { email },
      auth: false,
    });
  }

  async logout() {
    const { refreshToken } = this.tokenStorage.get();
    try {
      await this.request("/auth/logout", { method: "POST", body: { refreshToken } });
    } finally {
      this.clearSession();
    }
  }

  /**
   * Signs the account out of every device, this one included
   * (POST /auth/sessions/revoke-all), then forgets the tokens here. Unlike
   * `logout`, a failure keeps the session: nothing was ended, and the caller
   * says so.
   */
  async signOutEverywhere() {
    await this.request("/auth/sessions/revoke-all", { method: "POST" });
    this.clearSession();
  }

  async me() {
    const { user } = await this.request<{ user: AuthUser }>("/auth/me");
    return user;
  }

  /**
   * `/auth/me` whole: the user, whether it must still choose a plan, and
   * whether its email (or phone) is confirmed — until it is, starting a trial
   * and publishing answer 403 EMAIL_NOT_VERIFIED.
   */
  async meDetails() {
    const body = await this.request<{
      user: AuthUser;
      needsPlan?: boolean;
      confirmed?: boolean;
      suggestedUsername?: string;
      account?: AccountSettingsInfo;
    }>("/auth/me");
    return {
      user: body.user,
      needsPlan: Boolean(body.needsPlan),
      // An API from before this field: the user's own dates say the same.
      confirmed: body.confirmed ?? Boolean(body.user.emailVerifiedAt || body.user.phoneVerifiedAt),
      suggestedUsername: body.suggestedUsername ?? null,
      // An API from before account settings: a password account, no phone change.
      account: body.account ?? { hasPassword: true, phoneChange: false },
    };
  }

  // --- Account settings: the signed-in account's own name, email and phone

  async changeName(fullName: string) {
    const { user } = await this.request<{ user: AuthUser }>("/auth/me/name", { method: "PATCH", body: { fullName } });
    return user;
  }

  /** A code to the current email, for an account without a password (409 PASSWORD_REQUIRED otherwise). */
  async sendReauthCode(locale?: "ar" | "en") {
    return this.request<VerificationSent>("/auth/me/reauth-code", { method: "POST", body: locale ? { locale } : {} });
  }

  /**
   * A code to the new email. 422 INVALID_PASSWORD / REAUTH_CODE_REQUIRED /
   * INVALID_CODE / SAME_EMAIL, 429 RESEND_TOO_SOON. An email another account
   * holds gets the same answer.
   */
  async requestEmailChange(payload: AccountChangeRequest & { newEmail: string }) {
    return this.request<VerificationSent>("/auth/me/email-change", { method: "POST", body: payload });
  }

  /**
   * The code from the new email: the email changes, every other session ends,
   * and this client continues on the new session it gets back. 409 EMAIL_TAKEN.
   */
  async confirmEmailChange(code: string) {
    const body = await this.request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/me/email-change/confirm", {
      method: "POST",
      body: { code },
    });
    this.setTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    return body.user;
  }

  async requestPhoneChange(payload: AccountChangeRequest & { newPhone: string }) {
    return this.request<VerificationSent>("/auth/me/phone-change", { method: "POST", body: payload });
  }

  async confirmPhoneChange(code: string) {
    const { user } = await this.request<{ user: AuthUser }>("/auth/me/phone-change/confirm", { method: "POST", body: { code } });
    return user;
  }

  /** A free username to offer an account that has none yet (made through Google); null when it has one. */
  async getUsernameSuggestion() {
    const body = await this.request<{ user: AuthUser; suggestedUsername?: string }>("/auth/me");
    return body.suggestedUsername ?? null;
  }

  /** Public, and tightly rate limited (429) — call it debounced. */
  async checkUsernameAvailable(username: string) {
    return this.request<UsernameAvailability>(`/auth/username-available?u=${encodeURIComponent(username)}`, {
      auth: false,
    });
  }

  /**
   * Choose or change one's username. The first choice is free; after that one
   * change per 30 days (409 USERNAME_CHANGE_TOO_SOON with nextChangeAt).
   */
  async changeUsername(username: string) {
    const { user } = await this.request<{ user: AuthUser }>("/auth/me/username", {
      method: "PATCH",
      body: { username },
    });
    return user;
  }

  // ---------------------------------------------------------------------
  // Workspaces
  // ---------------------------------------------------------------------

  async listWorkspaces() {
    // The API returns { workspaces: [{ workspace, role }] } — flatten to
    // Workspace[] with the role key attached.
    const { workspaces } = await this.request<{
      workspaces: Array<{ workspace: Workspace; role?: { key: string; name: string; permissions?: string[] } }>;
    }>("/workspaces");
    return workspaces.map((entry) => ({
      ...entry.workspace,
      role: entry.role?.key,
      ...(Array.isArray(entry.role?.permissions) ? { permissions: entry.role.permissions } : {}),
    }));
  }

  /**
   * `referralCode` is an agent's code; an unusable one is a 422
   * REFERRAL_CODE_INVALID. `plan` is one of the public plans, read while the
   * server requires plans (422 PLAN_NOT_AVAILABLE / PLAN_REQUIRED); 403
   * PLAN_LIMIT_REACHED past the owner's store or draft limit.
   */
  async createWorkspace(name: string, referralCode?: string, plan?: { planId: string; billingCycle?: BillingCycle }) {
    const { workspace } = await this.request<{ workspace: Workspace }>("/workspaces", {
      method: "POST",
      body: { name, ...(referralCode ? { referralCode } : {}), ...(plan ? plan : {}) },
    });
    return workspace;
  }

  /** A draft store's free trial, from now. 409 TRIAL_NOT_AVAILABLE (details.reason) / NOT_A_DRAFT. */
  async startTrial(workspaceId: string, planId?: string) {
    return this.request<GoLiveResult>(`/workspaces/${workspaceId}/start-trial`, {
      method: "POST",
      ...(planId ? { body: { planId } } : {}),
    });
  }

  /** A draft store on a plan that costs nothing goes live. 409 PLAN_NOT_FREE. */
  async activateFreePlan(workspaceId: string) {
    return this.request<GoLiveResult>(`/workspaces/${workspaceId}/activate-free-plan`, { method: "POST" });
  }

  /** A short-lived X-Store-Preview token: the store as shoppers will see it, even while a draft. */
  async createStorePreviewToken(workspaceId: string) {
    return this.request<{ token: string; expiresAt: string }>(`/workspaces/${workspaceId}/store-preview-token`, {
      method: "POST",
    });
  }

  /** `GET /workspaces/:id/access` — restriction state and billing phase; any member. */
  async getWorkspaceAccess(workspaceId: string): Promise<WorkspaceAccess> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/access`);
    return unwrapObject<WorkspaceAccess>(body, "access");
  }

  /** Monthly or annual, from the next charge. 409 OPEN_CHARGE_EXISTS. */
  async setWorkspaceBillingCycle(workspaceId: string, billingCycle: "monthly" | "yearly"): Promise<WorkspaceBilling> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/billing`, {
      method: "PATCH",
      body: { billingCycle },
    });
    return unwrapObject<WorkspaceBilling>(body, "billing");
  }

  /** `GET /workspaces/:id/billing` — needs billing.manage. */
  async getWorkspaceBilling(workspaceId: string): Promise<WorkspaceBilling> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/billing`);
    return unwrapObject<WorkspaceBilling>(body, "billing");
  }

  /**
   * The Pay button: opens an online checkout for the subscription charge,
   * priced on the server (201; 200 with `reused` for a second press within a
   * minute). 404 ONLINE_BILLING_DISABLED, 503 ONLINE_BILLING_UNAVAILABLE,
   * 409 ONLINE_PAYMENT_CURRENCY_UNSUPPORTED / PAYMENT_STARTING / PLAN_IS_FREE,
   * 502 ONLINE_PAYMENT_START_FAILED.
   */
  async startOnlinePayment(
    workspaceId: string,
    lang: "ar" | "en",
    method?: string
  ): Promise<{ payment: OnlinePayment; reused: boolean }> {
    return this.request<{ payment: OnlinePayment; reused: boolean }>(`/workspaces/${workspaceId}/billing/payments`, {
      method: "POST",
      // Without `method` the API uses Fawaterak, as before payment methods.
      body: method ? { lang, method } : { lang },
    });
  }

  /**
   * A card top-up of the prepaid balance: a checkout for `amount` (minor
   * units) through a gateway the store is offered. 409 WALLET_NOT_ON_PLAN,
   * 422 TOPUP_AMOUNT_OUT_OF_RANGE, 404 WALLET_DISABLED / PAYMENT_METHOD_NOT_AVAILABLE.
   */
  async startWalletTopupOnline(
    workspaceId: string,
    body: { amount: number; lang: "ar" | "en"; method?: string }
  ): Promise<{ payment: OnlinePayment; reused: boolean }> {
    return this.request<{ payment: OnlinePayment; reused: boolean }>(`/workspaces/${workspaceId}/billing/wallet/topups/online`, {
      method: "POST",
      body,
    });
  }

  /** What the store may ask back from its prepaid balance, and its requests (WALLET_ENABLED). */
  async getWalletRefunds(workspaceId: string): Promise<WalletRefundOverview> {
    return this.request<WalletRefundOverview>(`/workspaces/${workspaceId}/billing/wallet/refunds`);
  }

  /**
   * Asks for `amount` (minor units) back; the same `requestId` again is the
   * same request. 422 REFUND_AMOUNT_TOO_LOW / _TOO_HIGH / REFUND_REQUEST_OPEN /
   * WALLET_DEBT_OUTSTANDING, 409 WALLET_NOT_ON_PLAN.
   */
  async requestWalletRefund(
    workspaceId: string,
    body: { amount: number; payoutMethod?: string; payoutAccount?: string; requestId: string }
  ): Promise<{ request: WalletRefundRequest; created: boolean }> {
    return this.request<{ request: WalletRefundRequest; created: boolean }>(`/workspaces/${workspaceId}/billing/wallet/refunds`, {
      method: "POST",
      body,
    });
  }

  /** While it waits for review: the held amount goes back to the balance. */
  async cancelWalletRefund(workspaceId: string, refundId: string): Promise<{ request: WalletRefundRequest; changed: boolean }> {
    return this.request<{ request: WalletRefundRequest; changed: boolean }>(`/workspaces/${workspaceId}/billing/wallet/refunds/${refundId}/cancel`, {
      method: "POST",
      body: {},
    });
  }

  /** The ways this store can pay its charges now (never cached). */
  async getPaymentMethods(workspaceId: string): Promise<BillingPaymentMethodList> {
    return this.request<BillingPaymentMethodList>(`/workspaces/${workspaceId}/billing/payment-methods`);
  }

  /**
   * The charge to pay now: the open one, or the next period's as the server
   * would write it (id "next"), and the ways to pay it. Writes nothing,
   * so the plan can still change. 409 NO_PAYMENT_METHOD (contact support),
   * PLAN_IS_FREE, NO_PLAN.
   */
  async openBillingInvoice(workspaceId: string): Promise<OpenBillingInvoiceResult> {
    return this.request<OpenBillingInvoiceResult>(`/workspaces/${workspaceId}/billing/invoices/open`, { method: "POST", body: {} });
  }

  /**
   * A transfer's proof for a charge (`invoiceId` an open charge's id, or
   * "next": the server writes the charge with the proof): the method,
   * the sender's mobile number and the screenshot. No amount: the server
   * takes the charge's. `expectedAmount`, the amount the merchant was shown,
   * is only compared with it (an API from before ignores it). 409
   * PROOF_IMAGE_DUPLICATE / PROOF_ALREADY_OPEN / TOO_MANY_OPEN_PROOFS /
   * CHARGE_NOT_PENDING / CHARGE_AMOUNT_CHANGED / MANUAL_PAYMENT_CURRENCY_UNSUPPORTED
   * / PLAN_IS_FREE / NO_PLAN, 413 FILE_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE,
   * 422 INVALID_SENDER_PHONE / PAYMENT_METHOD_NOT_AVAILABLE.
   */
  async submitBillingPaymentProof(
    workspaceId: string,
    invoiceId: string,
    {
      methodCode,
      senderPhone,
      file,
      expectedAmount,
    }: { methodCode: string; senderPhone: string; file: File | Blob; expectedAmount?: number }
  ): Promise<{ proof: BillingPaymentProof }> {
    const form = new FormData();
    form.append("methodCode", methodCode);
    form.append("senderPhone", senderPhone);
    if (expectedAmount != null) form.append("expectedAmount", String(expectedAmount));
    form.append("file", file, file instanceof File ? file.name : "transfer");
    const res = await this.rawFetch(`/workspaces/${workspaceId}/billing/invoices/${invoiceId}/payment-proofs`, {
      method: "POST",
      body: form,
    });
    return res.json() as Promise<{ proof: BillingPaymentProof }>;
  }

  // --- the prepaid balance (pay-per-order, WALLET_ENABLED)

  async getWallet(workspaceId: string): Promise<WalletSummary> {
    const { wallet } = await this.request<{ wallet: WalletSummary }>(`/workspaces/${workspaceId}/billing/wallet`);
    return wallet;
  }

  async getWalletLedger(workspaceId: string, { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}): Promise<WalletLedgerPage> {
    return this.request<WalletLedgerPage>(`/workspaces/${workspaceId}/billing/wallet/ledger?page=${page}&pageSize=${pageSize}`);
  }

  /**
   * A top-up transfer's proof: the amount sent (minor units, within the
   * summary's limits), the method, the sender and the screenshot. 404
   * WALLET_DISABLED, 422 TOPUP_AMOUNT_OUT_OF_RANGE, 409 TOO_MANY_OPEN_TOPUPS, and
   * the proof codes of submitBillingPaymentProof.
   */
  async submitWalletTopup(
    workspaceId: string,
    { requestedAmount, methodCode, senderPhone, file }: { requestedAmount: number; methodCode: string; senderPhone: string; file: File | Blob }
  ): Promise<{ proof: BillingPaymentProof }> {
    const form = new FormData();
    form.append("requestedAmount", String(requestedAmount));
    form.append("methodCode", methodCode);
    form.append("senderPhone", senderPhone);
    form.append("file", file, file instanceof File ? file.name : "transfer");
    const res = await this.rawFetch(`/workspaces/${workspaceId}/billing/wallet/topups`, { method: "POST", body: form });
    return res.json() as Promise<{ proof: BillingPaymentProof }>;
  }

  /** Moves a draft or a trial to the pay-per-order plan. 409 PLAN_CHANGE_NEEDS_SUPPORT / OPEN_CHARGE_EXISTS, 404 WALLET_DISABLED. */
  async choosePayPerOrder(workspaceId: string): Promise<{ changed: boolean }> {
    return this.request<{ changed: boolean }>(`/workspaces/${workspaceId}/billing/pay-per-order`, { method: "POST", body: {} });
  }

  /** The store's latest transfer proofs, newest first. */
  async listBillingPaymentProofs(workspaceId: string): Promise<{ proofs: BillingPaymentProof[] }> {
    return this.request<{ proofs: BillingPaymentProof[] }>(`/workspaces/${workspaceId}/billing/payment-proofs`);
  }

  /** An online payment's state; the server asks the gateway while it is in progress. */
  async getOnlinePayment(workspaceId: string, paymentId: string): Promise<OnlinePaymentResult> {
    return this.request<OnlinePaymentResult>(`/workspaces/${workspaceId}/billing/payments/${paymentId}`);
  }

  /**
   * Attaches an agent's referral code to the subscription (201; 200 when it
   * already was). 422 REFERRAL_CODE_INVALID, 409 REFERRAL_CODE_ALREADY_SET.
   */
  /** `GET /workspaces/:id/billing/plans` — the cards of the Subscription section (billing.manage). */
  async getSubscriptionPlans(workspaceId: string): Promise<SubscriptionPlans> {
    return this.request<SubscriptionPlans>(`/workspaces/${workspaceId}/billing/plans`);
  }

  /**
   * What a referral code would take off each plan, before it is attached. 422
   * REFERRAL_CODE_INVALID, and with REFERRAL_CODES_V2_ENABLED the clearer
   * refusals (REFERRAL_CODE_EXPIRED, _ALREADY_USED, _NOT_FOR_PLAN, ...).
   * `plan`: the plan and cycle being chosen with it (its restrictions are judged against them).
   */
  async previewReferralCode(
    workspaceId: string,
    code: string,
    plan?: { planId?: string; billingCycle?: BillingCycle }
  ): Promise<ReferralCodePreview> {
    return this.request<ReferralCodePreview>(`/workspaces/${workspaceId}/billing/code-preview`, {
      method: "POST",
      body: { code, ...(plan?.planId ? { planId: plan.planId } : {}), ...(plan?.billingCycle ? { billingCycle: plan.billingCycle } : {}) },
    });
  }

  /** The store's subscription charges, newest first, a page at a time. */
  async listBillingInvoices(workspaceId: string, { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}) {
    return this.request<MerchantInvoicePage>(`/workspaces/${workspaceId}/billing/invoices?page=${page}&pageSize=${pageSize}`);
  }

  /**
   * Another plan on offer, at once, while nothing is paid (a draft or a
   * trial). 409 PLAN_CHANGE_NEEDS_SUPPORT once paid, OPEN_CHARGE_EXISTS; 422
   * PLAN_NOT_AVAILABLE. Takes no price: the server prices the plan.
   */
  /**
   * A store on pay per order moves to `planId`: one charge for it, and the
   * plan switches when that is paid. 201 created, 200 the same move again;
   * 422 WALLET_DEBT_OUTSTANDING, 409 OPEN_CHARGE_EXISTS / PLAN_CHANGE_NEEDS_SUPPORT.
   */
  async requestPlanMove(workspaceId: string, payload: { planId: string; billingCycle: BillingCycle }) {
    return this.request<{ created: boolean; invoice: MerchantInvoice; plans: SubscriptionPlans }>(`/workspaces/${workspaceId}/billing/plan-move`, {
      method: "POST",
      body: payload,
    });
  }

  /** Drops the move waiting for its payment: its charge is void, the store stays as it is. */
  async cancelPlanMove(workspaceId: string) {
    return this.request<{ cancelled: boolean; plans: SubscriptionPlans }>(`/workspaces/${workspaceId}/billing/plan-move/cancel`, {
      method: "POST",
      body: {},
    });
  }

  /**
   * What switching to `planId` would do, writing nothing (PLAN_SWITCH_ENABLED):
   * its kind, when it takes effect, what is due now and the next renewal.
   * `billingCycle` defaults to the subscription's. 404 PLAN_SWITCH_DISABLED,
   * 422 PLAN_NOT_AVAILABLE, 409 PLAN_CHANGE_NEEDS_SUPPORT / MANUAL_PRICING /
   * SPECIAL_TERMS_ACTIVE.
   */
  /** `referralCode` (REFERRAL_CODES_V2_ENABLED): `preview.referralCode` shows the payment it applies to, before and after. */
  async previewPlanSwitch(workspaceId: string, payload: { planId: string; billingCycle?: BillingCycle; timing?: PlanSwitchTiming; referralCode?: string }) {
    return this.request<{ preview: PlanSwitchPreview }>(`/workspaces/${workspaceId}/billing/plan-switch/preview`, {
      method: "POST",
      body: payload,
    });
  }

  /**
   * Starts the switch the preview showed; `expectedAmount` is its `amountDue`
   * (409 SWITCH_AMOUNT_CHANGED, details { amountDue, currency }, when it no
   * longer is). An upgrade or a move comes back with its charge to pay. 201
   * new, 200 the same one again or nothing changed. Also 409
   * PROOF_UNDER_REVIEW, PLAN_SWITCH_ALREADY_BILLED, NO_PAYMENT_METHOD,
   * PLAN_SWITCH_BUSY, and the preview's refusals.
   */
  async startPlanSwitch(
    workspaceId: string,
    payload: { planId: string; billingCycle?: BillingCycle; timing?: PlanSwitchTiming; expectedAmount?: number; referralCode?: string }
  ) {
    return this.request<PlanSwitchStartResult>(`/workspaces/${workspaceId}/billing/plan-switch`, {
      method: "POST",
      body: payload,
    });
  }

  /**
   * Cancels the switch waiting (its charge void, the store as it is); with
   * none, a pay-per-order move waiting. Works with PLAN_SWITCH_ENABLED off. 409
   * PROOF_UNDER_REVIEW, PLAN_SWITCH_ALREADY_BILLED.
   */
  async cancelPlanSwitch(workspaceId: string) {
    return this.request<PlanSwitchCancelResult>(`/workspaces/${workspaceId}/billing/plan-switch/cancel`, {
      method: "POST",
      body: {},
    });
  }

  /**
   * Cancels a pending charge of the store (a renewal, an upgrade's, a move's):
   * void, and a plan switch waiting for it with it (PLAN_SWITCH_ENABLED). 409
   * PROOF_UNDER_REVIEW, CHARGE_ALREADY_PAID, CHARGE_NOT_PENDING; 404
   * PLAN_SWITCH_DISABLED.
   */
  async cancelBillingCharge(workspaceId: string, chargeId: string) {
    return this.request<BillingChargeCancelResult>(`/workspaces/${workspaceId}/billing/charges/${chargeId}/cancel`, {
      method: "POST",
      body: {},
    });
  }

  async changeSubscriptionPlan(workspaceId: string, payload: { planId: string; billingCycle?: BillingCycle }) {
    return this.request<{ changed: boolean; plans: SubscriptionPlans }>(`/workspaces/${workspaceId}/billing/plan`, {
      method: "POST",
      body: payload,
    });
  }

  async attachReferralCode(workspaceId: string, code: string, plan?: { planId?: string; billingCycle?: BillingCycle }): Promise<WorkspaceBilling> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/billing/referral-code`, {
      method: "POST",
      body: { code, ...(plan?.planId ? { planId: plan.planId } : {}), ...(plan?.billingCycle ? { billingCycle: plan.billingCycle } : {}) },
    });
    return unwrapObject<WorkspaceBilling>(body, "billing");
  }

  /**
   * Whether a store address is free to take, for checking one as it is typed.
   *
   * Always a 200 — an address that is malformed, too short/long or reserved
   * comes back as `{ available: false, reason }` rather than as a validation
   * error, so the caller has one shape to render for every outcome. The
   * backend lowercases and trims before judging, so it agrees with what a
   * later PATCH would store.
   *
   * Pass `signal` to drop a check that a later keystroke has superseded.
   */
  async checkWorkspaceSlug(slug: string, signal?: AbortSignal) {
    return this.request<SlugCheckResult>(
      `/workspaces/check-slug?slug=${encodeURIComponent(slug)}`,
      { signal }
    );
  }

  async listMembers(workspaceId: string) {
    const { members } = await this.request<{ members: Membership[] }>(
      `/workspaces/${workspaceId}/members`
    );
    return members;
  }

  async updateWorkspace(workspaceId: string, payload: UpdateWorkspacePayload) {
    const { workspace } = await this.request<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}`,
      { method: "PATCH", body: payload }
    );
    return workspace;
  }

  async createWebsite(workspaceId: string, payload: CreateWebsitePayload) {
    // Returns both keys — the caller needs the freshly-seeded pages, not just
    // the website row.
    const { website, pages } = await this.request<{ website: Website; pages: WebsitePage[] }>(
      `/workspaces/${workspaceId}/websites`,
      { method: "POST", body: payload }
    );
    return { website, pages };
  }

  async listWebsites(workspaceId: string) {
    const { websites } = await this.request<{ websites: Website[] }>(
      `/workspaces/${workspaceId}/websites`
    );
    return websites;
  }

  /**
   * Permanently removes a site. Its pages, revisions and any bound domain go
   * with it (ON DELETE CASCADE server-side) — there is no undo, and a published
   * site stops serving the moment this returns.
   */
  async deleteWebsite(workspaceId: string, websiteId: string): Promise<void> {
    await this.request<{ deleted: true }>(`/workspaces/${workspaceId}/websites/${websiteId}`, {
      method: "DELETE",
    });
  }

  /**
   * Publishes the site's *saved* draft — it snapshots `draftData` straight from
   * the database, so unsaved editor state is not included. Needs the
   * WEBSITE_PUBLISH permission (stricter than WEBSITE_EDIT) and an active
   * subscription.
   *
   * A site that isn't publishable yet comes back as a 422 whose
   * `error.details[]` lists every problem at once as `PublishProblem`s (missing
   * home page, empty pages) — page-scoped, not field-scoped, so render them as
   * a list rather than passing them through `getFieldErrors`.
   */
  async publishWebsite(workspaceId: string, websiteId: string, note?: string) {
    return this.request<PublishWebsiteResult>(
      `/workspaces/${workspaceId}/websites/${websiteId}/publish`,
      { method: "POST", body: note ? { note } : {} }
    );
  }

  /**
   * The website row plus every one of its pages (each with its full
   * `draftData` tree) — one call is enough to open the editor.
   */
  async getWebsite(workspaceId: string, websiteId: string) {
    return this.request<WebsiteDetail>(`/workspaces/${workspaceId}/websites/${websiteId}`);
  }

  async getWebsitePage(workspaceId: string, websiteId: string, pageId: string) {
    const { page } = await this.request<{ page: WebsitePage }>(
      `/workspaces/${workspaceId}/websites/${websiteId}/pages/${pageId}`
    );
    return page;
  }

  /**
   * Adds a page to a website. `path` must be unique within the website — a
   * clash comes back as a 409. Omitting `draftData` creates an empty page the
   * editor can start filling in.
   */
  async createPage(
    workspaceId: string,
    websiteId: string,
    payload: CreateWebsitePagePayload
  ) {
    const { page } = await this.request<{ page: WebsitePage }>(
      `/workspaces/${workspaceId}/websites/${websiteId}/pages`,
      { method: "POST", body: payload }
    );
    return page;
  }

  /**
   * Removes a page. Note the backend does **not** protect the home page — the
   * editor is what keeps it from being deleted.
   */
  async deletePage(workspaceId: string, websiteId: string, pageId: string) {
    await this.request<void>(
      `/workspaces/${workspaceId}/websites/${websiteId}/pages/${pageId}`,
      { method: "DELETE" }
    );
  }

  /**
   * Saves the page. A `draftData` tree is deep-validated server-side by
   * pageTree.validatePageTree, so a malformed tree comes back as a 422 whose
   * `details[]` names the offending node path (e.g. "data.sections[1].rows").
   */
  async updateWebsitePage(
    workspaceId: string,
    websiteId: string,
    pageId: string,
    payload: UpdateWebsitePagePayload
  ) {
    const { page } = await this.request<{ page: WebsitePage }>(
      `/workspaces/${workspaceId}/websites/${websiteId}/pages/${pageId}`,
      { method: "PATCH", body: payload }
    );
    return page;
  }

  // ---------------------------------------------------------------------
  // Workspace team — members, invites, roles
  // (auth, /workspaces/:workspaceId/members | /invites | /roles)
  // Every response is unwrapped to the row(s) the caller wants. Inviting
  // creates a membership in "invited" state (and, backend-side, sends the
  // email); `resendInvite` re-sends it. Changing a role or removing a
  // member both act on the membership id.
  // ---------------------------------------------------------------------

  async listWorkspaceMembers(workspaceId: string) {
    const { members } = await this.request<{ members: WorkspaceMember[] }>(
      `/workspaces/${workspaceId}/members`
    );
    return members;
  }

  async listPendingInvites(workspaceId: string) {
    const { invites } = await this.request<{ invites: WorkspaceInvite[] }>(
      `/workspaces/${workspaceId}/invites`
    );
    return invites;
  }

  async listWorkspaceRoles(workspaceId: string) {
    const { roles } = await this.request<{ roles: WorkspaceRole[] }>(
      `/workspaces/${workspaceId}/roles`
    );
    return roles;
  }

  async inviteMember(workspaceId: string, payload: InviteMemberPayload) {
    const { membership } = await this.request<{ membership: WorkspaceMember }>(
      `/workspaces/${workspaceId}/members`,
      { method: "POST", body: payload }
    );
    return membership;
  }

  async resendInvite(workspaceId: string, membershipId: string) {
    return this.request<SuccessResponse>(
      `/workspaces/${workspaceId}/invites/${membershipId}/resend`,
      { method: "POST", body: {} }
    );
  }

  async updateMemberRole(workspaceId: string, membershipId: string, roleId: string) {
    const { membership } = await this.request<{ membership: WorkspaceMember }>(
      `/workspaces/${workspaceId}/members/${membershipId}`,
      { method: "PATCH", body: { roleId } }
    );
    return membership;
  }

  async removeMember(workspaceId: string, membershipId: string) {
    return this.request<SuccessResponse>(
      `/workspaces/${workspaceId}/members/${membershipId}`,
      { method: "DELETE" }
    );
  }

  // ---------------------------------------------------------------------
  // Support tickets (/workspaces/:workspaceId/support) — needs workspace.manage
  // ---------------------------------------------------------------------

  async listSupportTickets(workspaceId: string): Promise<SupportTicket[]> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/support/tickets`);
    return unwrapList<SupportTicket>(body, "tickets");
  }

  async openSupportTicket(workspaceId: string, payload: OpenSupportTicketPayload): Promise<SupportTicketThread> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/support/tickets`, {
      method: "POST",
      body: payload,
    });
    return {
      ticket: unwrapObject<SupportTicket>(body, "ticket"),
      messages: unwrapList<SupportTicketMessage>(body, "messages"),
    };
  }

  async getSupportTicket(workspaceId: string, ticketId: string): Promise<SupportTicketThread> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/support/tickets/${ticketId}`);
    return {
      ticket: unwrapObject<SupportTicket>(body, "ticket"),
      messages: unwrapList<SupportTicketMessage>(body, "messages"),
    };
  }

  /** 409 TICKET_CLOSED once the platform has closed the ticket. */
  async replySupportTicket(
    workspaceId: string,
    ticketId: string,
    text: string
  ): Promise<{ ticket: SupportTicket; message: SupportTicketMessage }> {
    const body = await this.request<unknown>(`/workspaces/${workspaceId}/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: { body: text },
    });
    return {
      ticket: unwrapObject<SupportTicket>(body, "ticket"),
      message: unwrapObject<SupportTicketMessage>(body, "message"),
    };
  }

  // ---------------------------------------------------------------------
  // Platform admin
  // ---------------------------------------------------------------------

  // --- Manual subscription and feature overrides (one store) ---------------

  async adminGetManualSubscription(workspaceId: string) {
    return this.request<AdminManualSubscription>(`/admin/workspaces/${workspaceId}/subscription`);
  }

  /**
   * One manual action. `idempotencyKey` should be made once per dialog, so a
   * double click replays the first result (200, replayed) instead of acting twice.
   */
  async adminManualSubscriptionAction(
    workspaceId: string,
    action: "activate" | "change-plan" | "extend" | "end",
    body: Record<string, unknown>,
    idempotencyKey?: string
  ) {
    return this.request<AdminManualActionResult>(`/admin/workspaces/${workspaceId}/subscription/${action}`, {
      method: "POST",
      body,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    });
  }

  async adminListWorkspaceFeatures(workspaceId: string) {
    return this.request<AdminWorkspaceFeatures>(`/admin/workspaces/${workspaceId}/features`);
  }

  async adminAddFeatureOverride(
    workspaceId: string,
    body: { featureKey: PlanFeatureKey; mode: "grant" | "deny"; expiresAt?: string | null; reason: string }
  ) {
    const { override } = await this.request<{ override: AdminFeatureOverride }>(
      `/admin/workspaces/${workspaceId}/feature-overrides`,
      { method: "POST", body }
    );
    return override;
  }

  async adminUpdateFeatureOverride(
    workspaceId: string,
    overrideId: string,
    body: { mode?: "grant" | "deny"; expiresAt?: string | null; reason?: string }
  ) {
    const { override } = await this.request<{ override: AdminFeatureOverride }>(
      `/admin/workspaces/${workspaceId}/feature-overrides/${overrideId}`,
      { method: "PATCH", body }
    );
    return override;
  }

  async adminRevokeFeatureOverride(workspaceId: string, overrideId: string, reason?: string) {
    const { override } = await this.request<{ override: AdminFeatureOverride }>(
      `/admin/workspaces/${workspaceId}/feature-overrides/${overrideId}/revoke`,
      { method: "POST", body: { reason: reason ?? null } }
    );
    return override;
  }

  /** GET /admin/users — one search over name, username, email, id and the user's stores. Deleted accounts only with includeDeleted. */
  async adminSearchUsers(params: { q?: string; page?: number; limit?: number; includeDeleted?: boolean } = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.includeDeleted) query.set("includeDeleted", "true");
    const qs = query.toString();
    return this.request<AdminUserSearchPage>(`/admin/users${qs ? `?${qs}` : ""}`);
  }

  async adminGetUser(userId: string) {
    const { user } = await this.request<{ user: AdminUserDetail }>(`/admin/users/${userId}`);
    return user;
  }

  /** workspaces.manage; a reason is required. 409 USER_ALREADY_SUSPENDED, CANNOT_ACT_ON_SELF. */
  async adminSuspendUser(userId: string, reason: string) {
    const { user } = await this.request<{ user: AdminUserModeration }>(`/admin/users/${userId}/suspend`, { method: "POST", body: { reason, confirm: true } });
    return user;
  }

  /** workspaces.manage. 409 USER_NOT_SUSPENDED, USER_DELETED. */
  async adminUnsuspendUser(userId: string, reason?: string) {
    const { user } = await this.request<{ user: AdminUserModeration }>(`/admin/users/${userId}/unsuspend`, { method: "POST", body: { reason: reason || null, confirm: true } });
    return user;
  }

  /** workspaces.manage. Soft delete; 409 OWNS_STORES unless stores is "suspend". */
  async adminDeleteUser(userId: string, body: { reason?: string; stores?: "suspend" }) {
    const { user } = await this.request<{ user: AdminUserModeration }>(`/admin/users/${userId}/delete`, { method: "POST", body: { ...body, confirm: true } });
    return user;
  }

  async adminListWorkspaces() {
    // The endpoint wraps the rows: { workspaces: [...] }. Unwrap here so every
    // caller gets the array its type promises.
    const { workspaces } = await this.request<{ workspaces: AdminWorkspaceOverview[] }>(
      "/admin/workspaces"
    );
    return workspaces ?? [];
  }

  // --- Plans ---
  async adminListPlans() {
    const { plans } = await this.request<{ plans: AdminPlan[] }>("/admin/plans");
    return plans ?? [];
  }

  /** The plans with the feature catalogue the plan editor ticks from (one request). */
  async adminListPlansWithCatalog(): Promise<AdminPlansWithCatalog> {
    const res = await this.request<Partial<AdminPlansWithCatalog>>("/admin/plans");
    return { plans: res.plans ?? [], featureCatalog: res.featureCatalog ?? [] };
  }

  async adminSavePlan(payload: AdminPlanInput) {
    // One entry point for both create and update: an `id` means PATCH.
    const { id, ...body } = payload;
    const { plan } = await this.request<{ plan: AdminPlan }>(
      id ? `/admin/plans/${id}` : "/admin/plans",
      { method: id ? "PATCH" : "POST", body }
    );
    return plan;
  }

  async adminDeletePlan(planId: string) {
    return this.request<SuccessResponse>(`/admin/plans/${planId}`, { method: "DELETE" });
  }

  // --- Subscriptions ---
  async adminListSubscriptions(params: { status?: string } = {}) {
    const { subscriptions } = await this.request<{ subscriptions: AdminSubscription[] }>(
      `/admin/subscriptions${buildQuery({ ...params })}`
    );
    return subscriptions ?? [];
  }

  // --- Feature flags ---
  async adminListFeatureFlags() {
    const { featureFlags } = await this.request<{ featureFlags: AdminFeatureFlag[] }>(
      "/admin/feature-flags"
    );
    return featureFlags ?? [];
  }

  async adminSaveFeatureFlag(payload: AdminFeatureFlagInput) {
    const { id, ...body } = payload;
    const { featureFlag } = await this.request<{ featureFlag: AdminFeatureFlag }>(
      id ? `/admin/feature-flags/${id}` : "/admin/feature-flags",
      { method: id ? "PATCH" : "POST", body }
    );
    return featureFlag;
  }

  async adminDeleteFeatureFlag(flagId: string) {
    return this.request<SuccessResponse>(`/admin/feature-flags/${flagId}`, { method: "DELETE" });
  }

  // --- Announcements ---
  async adminListAnnouncements() {
    const { announcements } = await this.request<{ announcements: AdminAnnouncement[] }>(
      "/admin/announcements"
    );
    return announcements ?? [];
  }

  async adminSaveAnnouncement(payload: AdminAnnouncementInput) {
    const { id, ...body } = payload;
    const { announcement } = await this.request<{ announcement: AdminAnnouncement }>(
      id ? `/admin/announcements/${id}` : "/admin/announcements",
      { method: id ? "PATCH" : "POST", body }
    );
    return announcement;
  }

  async adminDeleteAnnouncement(announcementId: string) {
    return this.request<SuccessResponse>(`/admin/announcements/${announcementId}`, {
      method: "DELETE",
    });
  }

  // --- Audit log ---
  /**
   * `GET /admin/audit-log` → `{ auditLog, total, limit, offset }`, newest first.
   *
   * Ordered `createdAt DESC, id DESC` server-side. The id tiebreak matters for
   * paging: entries written by one request share a timestamp, so without it a
   * row could shift between windows and be shown twice or skipped.
   *
   * Every filter is applied server-side, so the rows returned are the whole
   * match set narrowed to this window — not a window that still needs
   * filtering. `total` counts the full match set, which is what makes "older
   * entries exist beyond this window" a fact rather than an inference from a
   * full-looking page.
   */
  async adminListAuditLog(params: AdminAuditLogParams = {}): Promise<AdminAuditLogPage> {
    const body = await this.request<unknown>(`/admin/audit-log${buildQuery({ ...params })}`);
    return { rows: unwrapList<AdminAuditEntry>(body, "auditLog"), total: numberField(body, "total") };
  }

  // --- System health ---

  /**
   * Origin the API is served from, i.e. `baseUrl` minus its `/api/vN` suffix.
   *
   * The liveness and readiness probes are mounted at the server root, outside
   * the versioned API, so they can't be reached through `request()`. With the
   * relative `baseUrl` the consoles use in development (`/api/v1`) this is the
   * empty string, making probes same-origin and therefore proxied by the Vite
   * dev server — which is the only reason they work at all, since the backend's
   * CORS allowlist does not include the dev servers.
   *
   * A `baseUrl` with no version suffix is left untouched and probes hang off it
   * directly; that is a guess, and a wrong one shows up as an unreachable probe.
   */
  private get rootUrl(): string {
    return this.baseUrl.replace(/\/api\/v\d+$/, "");
  }

  /**
   * Probes a root-level health endpoint and reports what came back.
   *
   * Deliberately does NOT go through `request()` and never throws: for a status
   * board every outcome is a reading, not an error. A 503 from `/health/ready`
   * is the endpoint working correctly and telling us the database is gone, and
   * treating it as a thrown failure would lose the body that says so.
   *
   * Sends no Authorization header — these endpoints are unauthenticated, and
   * routing them through the authenticated path would let a probe trip the
   * 401-refresh machinery and, on failure, sign the admin out for looking at a
   * status page.
   */
  async probeHealth(
    path: string,
    opts: { timeoutMs?: number } = {}
  ): Promise<HealthProbeResult> {
    const { timeoutMs = 8000 } = opts;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();

    try {
      const res = await this.fetchImpl(`${this.rootUrl}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        // No credentials: a probe must not depend on cookies being allowed.
      });
      const latencyMs = Date.now() - startedAt;
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const body = isJson ? await res.json().catch(() => null) : null;
      return { reachable: true, status: res.status, body, latencyMs, error: null, checkedAt };
    } catch (err) {
      // Includes the CORS case, which surfaces as an opaque TypeError that is
      // indistinguishable from the server being down. Never upgrade this to a
      // "down" verdict — the caller renders it as unknown.
      const aborted = err instanceof DOMException && err.name === "AbortError";
      return {
        reachable: false,
        status: null,
        body: null,
        latencyMs: null,
        error: aborted
          ? `No response within ${timeoutMs} ms.`
          : err instanceof Error
            ? err.message
            : "Request failed.",
        checkedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * `GET /admin/system/services` → `{ services: [...], cached: boolean }`.
   * Implemented server-side; envelope verified against the route.
   *
   * A cache miss probes five dependencies in parallel with a 5s timeout each,
   * so the worst case is one timeout rather than five — but it is still bound
   * by third parties, not by our own database. Expect it to be slower than
   * every other admin call.
   *
   * Keep handling failure: the fallback probes exist precisely for when the
   * API cannot answer this at all.
   */
  async adminListSystemServices(): Promise<AdminServiceReport> {
    const body = await this.request<unknown>("/admin/system/services");
    return {
      services: unwrapList<AdminServiceTile>(body, "services"),
      cached: readFlag(body, "cached"),
    };
  }

  /**
   * `POST /admin/system/services/check` — force a fresh server-side probe,
   * bypassing the GET's cache.
   *
   * Same envelope and same tile shape as the GET, so a caller can reuse one
   * rendering path for both. Always answers `cached: false`.
   */
  async adminCheckSystemServices(): Promise<AdminServiceReport> {
    const body = await this.request<unknown>("/admin/system/services/check", { method: "POST" });
    return {
      services: unwrapList<AdminServiceTile>(body, "services"),
      cached: readFlag(body, "cached"),
    };
  }

  // --- Overview metrics ---

  /**
   * `GET /admin/metrics/overview` → `{ overview: {...} }` (path and envelope
   * both confirmed with the backend, matching plans / subscriptions /
   * featureFlags / announcements).
   *
   * NOT IMPLEMENTED SERVER-SIDE YET (agreed contract, no ETA) — callers must
   * handle a 404 and fall back; `adminApi.loadOverview` derives what it can
   * from the workspace and subscription lists instead.
   */
  async adminGetOverview() {
    const body = await this.request<unknown>("/admin/metrics/overview");
    return unwrapObject<AdminOverview>(body, "overview");
  }

  // --- Platform risk ---

  /**
   * `GET /admin/risk/blocklist` → `{ entries, total, limit, offset }`, newest
   * first, filtered and paged server-side.
   */
  async adminListBlocklist(params: AdminBlocklistParams = {}): Promise<AdminBlocklistPage> {
    const body = await this.request<unknown>(`/admin/risk/blocklist${buildQuery({ ...params })}`);
    return {
      entries: unwrapList<AdminBlocklistEntry>(body, "entries"),
      total: numberField(body, "total") ?? 0,
      limit: numberField(body, "limit") ?? params.limit ?? 50,
      offset: numberField(body, "offset") ?? params.offset ?? 0,
    };
  }

  /**
   * `POST /admin/risk/blocklist` — 201 for a new entry, 200 when the
   * identifier was already listed and only its reason/expiry changed.
   */
  async adminBlockIdentifier(payload: AdminBlockPayload): Promise<AdminBlockResult> {
    const body = await this.request<unknown>("/admin/risk/blocklist", { method: "POST", body: payload });
    return {
      entry: unwrapObject<AdminBlocklistEntry>(body, "entry"),
      created: readFlag(body, "created"),
    };
  }

  async adminUpdateBlocklistEntry(entryId: string, payload: AdminBlocklistUpdate) {
    const body = await this.request<unknown>(`/admin/risk/blocklist/${entryId}`, { method: "PATCH", body: payload });
    return unwrapObject<AdminBlocklistEntry>(body, "entry");
  }

  async adminDeleteBlocklistEntry(entryId: string) {
    return this.request<SuccessResponse>(`/admin/risk/blocklist/${entryId}`, { method: "DELETE" });
  }

  // --- Carriers and payment gateways (read-only) ---

  /** `GET /admin/carriers` → `{ carriers, environment }`. */
  async adminListCarriers(): Promise<AdminCarrierRegistry> {
    const body = await this.request<AdminCarrierRegistry>("/admin/carriers");
    return { ...body, carriers: unwrapList(body, "carriers") };
  }

  /** `POST /admin/carriers/:code/health-check` — reachability only, no merchant account. */
  async adminCheckCarrier(code: string): Promise<AdminProviderCheck> {
    const body = await this.request<unknown>(`/admin/carriers/${encodeURIComponent(code)}/health-check`, {
      method: "POST",
    });
    return unwrapObject<AdminProviderCheck>(body, "check");
  }

  /** `GET /admin/payment-gateways` → `{ gateways, environment }`. */
  async adminListPaymentGateways(): Promise<AdminPaymentGatewayRegistry> {
    const body = await this.request<AdminPaymentGatewayRegistry>("/admin/payment-gateways");
    return { ...body, gateways: unwrapList(body, "gateways") };
  }

  async adminCheckPaymentGateway(code: string): Promise<AdminProviderCheck> {
    const body = await this.request<unknown>(
      `/admin/payment-gateways/${encodeURIComponent(code)}/health-check`,
      { method: "POST" }
    );
    return unwrapObject<AdminProviderCheck>(body, "check");
  }

  // --- Templates ---

  /** `GET /admin/templates` → `{ templates }`, newest first, drafts included. */
  async adminListTemplates(params: { kind?: AdminTemplateKind } = {}): Promise<AdminTemplate[]> {
    const body = await this.request<unknown>(`/admin/templates${buildQuery({ ...params })}`);
    return unwrapList<AdminTemplate>(body, "templates");
  }

  /** `GET /admin/templates/:id` → `{ template, versions }`. */
  async adminGetTemplate(templateId: string): Promise<AdminTemplateDetail> {
    const body = await this.request<unknown>(`/admin/templates/${templateId}`);
    return {
      template: unwrapObject<AdminTemplate>(body, "template"),
      versions: unwrapList<AdminTemplateVersionSummary>(body, "versions"),
    };
  }

  /** Create (no `id`, POST) or partial update (`id`, PATCH). */
  async adminSaveTemplate(payload: AdminTemplateInput): Promise<AdminTemplate> {
    const { id, ...body } = payload;
    const res = await this.request<unknown>(id ? `/admin/templates/${id}` : "/admin/templates", {
      method: id ? "PATCH" : "POST",
      body,
    });
    return unwrapObject<AdminTemplate>(res, "template");
  }

  async adminDeleteTemplate(templateId: string) {
    return this.request<SuccessResponse>(`/admin/templates/${templateId}`, { method: "DELETE" });
  }

  /** `POST /admin/templates/:id/publish` | `/unpublish` — 409 TEMPLATE_HAS_NO_ACTIVE_VERSION. */
  async adminSetTemplatePublished(templateId: string, published: boolean): Promise<AdminTemplate> {
    const body = await this.request<unknown>(
      `/admin/templates/${templateId}/${published ? "publish" : "unpublish"}`,
      { method: "POST" }
    );
    return unwrapObject<AdminTemplate>(body, "template");
  }

  async adminGetTemplateVersion(templateId: string, versionId: string): Promise<AdminTemplateVersion> {
    const body = await this.request<unknown>(`/admin/templates/${templateId}/versions/${versionId}`);
    return unwrapObject<AdminTemplateVersion>(body, "version");
  }

  /** `POST /admin/templates/:id/versions` — the next version number, validated like a website copy. */
  async adminCreateTemplateVersion(
    templateId: string,
    payload: AdminTemplateVersionInput
  ): Promise<AdminTemplateVersionSummary> {
    const body = await this.request<unknown>(`/admin/templates/${templateId}/versions`, {
      method: "POST",
      body: payload,
    });
    return unwrapObject<AdminTemplateVersionSummary>(body, "version");
  }

  /** 409 TEMPLATE_NEEDS_ACTIVE_VERSION for the last active version of a published template. */
  async adminSetTemplateVersionActive(
    templateId: string,
    versionId: string,
    isActive: boolean
  ): Promise<AdminTemplateVersionSummary> {
    const body = await this.request<unknown>(`/admin/templates/${templateId}/versions/${versionId}`, {
      method: "PATCH",
      body: { isActive },
    });
    return unwrapObject<AdminTemplateVersionSummary>(body, "version");
  }

  // --- Support tickets (platform side) ---

  /** `GET /admin/support/tickets` → `{ tickets, total, limit, offset, counts }`. */
  async adminListSupportTickets(params: AdminSupportTicketParams = {}): Promise<AdminSupportTicketPage> {
    const body = await this.request<AdminSupportTicketPage>(`/admin/support/tickets${buildQuery({ ...params })}`);
    return { ...body, tickets: unwrapList<AdminSupportTicket>(body, "tickets") };
  }

  async adminGetSupportTicket(ticketId: string): Promise<AdminSupportTicketThread> {
    const body = await this.request<unknown>(`/admin/support/tickets/${ticketId}`);
    return {
      ticket: unwrapObject<AdminSupportTicket>(body, "ticket"),
      messages: unwrapList<AdminSupportTicketMessage>(body, "messages"),
    };
  }

  /** Default next status is `pending` (waiting on the merchant). 409 TICKET_CLOSED. */
  async adminReplySupportTicket(
    ticketId: string,
    payload: { body: string; status?: Exclude<SupportTicketStatus, "closed"> }
  ): Promise<{ ticket: AdminSupportTicket; message: AdminSupportTicketMessage }> {
    const body = await this.request<unknown>(`/admin/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: payload,
    });
    return {
      ticket: unwrapObject<AdminSupportTicket>(body, "ticket"),
      message: unwrapObject<AdminSupportTicketMessage>(body, "message"),
    };
  }

  async adminUpdateSupportTicket(
    ticketId: string,
    payload: { status?: SupportTicketStatus; priority?: SupportTicketPriority }
  ): Promise<AdminSupportTicket> {
    const body = await this.request<unknown>(`/admin/support/tickets/${ticketId}`, { method: "PATCH", body: payload });
    return unwrapObject<AdminSupportTicket>(body, "ticket");
  }

  // --- Platform users (roles and permissions) ---

  /** `GET /admin/roles` → the role templates and every permission key. */
  async adminListRoles(): Promise<AdminRolesResponse> {
    const body = await this.request<AdminRolesResponse>("/admin/roles");
    return { roles: unwrapList(body, "roles"), permissions: unwrapList(body, "permissions") };
  }

  /** `GET /admin/admins` → `{ admins }`, oldest first. */
  async adminListAdmins(): Promise<AdminPlatformAdmin[]> {
    const body = await this.request<unknown>("/admin/admins");
    return unwrapList<AdminPlatformAdmin>(body, "admins");
  }

  /**
   * `POST /admin/admins` — gives an existing account a role (201; 200 if it
   * already had that role). 403 CREATOR_REQUIRED / PERMISSION_NOT_HELD,
   * 409 ALREADY_PLATFORM_USER / USER_NOT_ACTIVE, 404 USER_NOT_FOUND.
   */
  async adminGrantAdmin(payload: AdminGrantPayload): Promise<AdminGrantResult> {
    const body = await this.request<unknown>("/admin/admins", { method: "POST", body: payload });
    return { admin: unwrapObject<AdminPlatformAdmin>(body, "admin"), granted: readFlag(body, "granted") };
  }

  /**
   * `PATCH /admin/admins/:userId` — a new role (its default set, unless
   * `permissions` is given) and/or a new permission set.
   * 409 CANNOT_EDIT_SELF / LAST_CREATOR, 403 CREATOR_REQUIRED.
   */
  async adminUpdateAdmin(
    userId: string,
    payload: { role?: string; permissions?: string[] }
  ): Promise<AdminPlatformAdmin> {
    const body = await this.request<unknown>(`/admin/admins/${userId}`, { method: "PATCH", body: payload });
    return unwrapObject<AdminPlatformAdmin>(body, "admin");
  }

  /** `DELETE /admin/admins/:userId` — 409 CANNOT_REVOKE_SELF / LAST_CREATOR. */
  async adminRevokeAdmin(userId: string) {
    return this.request<SuccessResponse>(`/admin/admins/${userId}`, { method: "DELETE" });
  }

  // --- Agents, referral codes, commission ledger ---

  async adminListAgents(): Promise<AdminAgentList> {
    const body = await this.request<AdminAgentList>("/admin/agents");
    return { ...body, agents: unwrapList(body, "agents") };
  }

  async adminGetAgent(agentId: string): Promise<AdminAgentDetail> {
    const body = await this.request<AdminAgentDetail>(`/admin/agents/${agentId}`);
    return { ...body, agent: unwrapObject(body, "agent"), merchants: unwrapList(body, "merchants") };
  }

  /** Gives an existing account the agent role and, optionally, its first code. 409 ALREADY_AGENT. */
  async adminCreateAgent(payload: {
    email: string;
    firstCode?: AdminReferralCodeInput & { code: string };
  }): Promise<AdminCreateAgentResult> {
    return this.request<AdminCreateAgentResult>("/admin/agents", { method: "POST", body: payload });
  }

  /** 409 REFERRAL_CODE_TAKEN / NOT_AN_AGENT. */
  async adminCreateReferralCode(
    agentId: string,
    payload: AdminReferralCodeInput & { code: string }
  ): Promise<AdminReferralCode> {
    const body = await this.request<unknown>(`/admin/agents/${agentId}/codes`, { method: "POST", body: payload });
    return unwrapObject<AdminReferralCode>(body, "code");
  }

  /** The code string itself cannot change. */
  async adminUpdateReferralCode(codeId: string, payload: AdminReferralCodeInput): Promise<AdminReferralCode> {
    const body = await this.request<unknown>(`/admin/referral-codes/${codeId}`, { method: "PATCH", body: payload });
    return unwrapObject<AdminReferralCode>(body, "code");
  }

  // Agents -> Referral codes (migration 725).
  async adminListReferralCodes(params: AdminReferralCodeParams = {}): Promise<AdminReferralCodeList> {
    const body = await this.request<AdminReferralCodeList>(`/admin/referral-codes${buildQuery({ ...params })}`);
    return { ...body, codes: unwrapList(body, "codes") };
  }

  /** A code with or without an agent (`agentId` null). */
  async adminCreateStandaloneReferralCode(payload: AdminReferralCodeInput & { code: string }): Promise<AdminReferralCode> {
    const body = await this.request<unknown>("/admin/referral-codes", { method: "POST", body: payload });
    return unwrapObject<AdminReferralCode>(body, "code");
  }

  async adminGetReferralCode(codeId: string): Promise<AdminReferralCodeDetail> {
    const body = await this.request<AdminReferralCodeDetail>(`/admin/referral-codes/${codeId}`);
    return { ...body, code: unwrapObject(body, "code") };
  }

  async adminListCodeRedemptions(codeId: string, params: AdminRedemptionParams = {}): Promise<AdminRedemptionPage> {
    const body = await this.request<AdminRedemptionPage>(`/admin/referral-codes/${codeId}/redemptions${buildQuery({ ...params })}`);
    return { ...body, redemptions: unwrapList(body, "redemptions") };
  }

  /** The simulator: unsaved terms, nothing written. */
  async adminSimulateReferralCode(payload: {
    planId: string;
    billingCycle: BillingCycle;
    terms: ReferralTerms;
    commissionBasis?: ReferralCommissionBasis;
    hasAgent?: boolean;
    payments?: number;
  }): Promise<AdminReferralSimulation> {
    return this.request<AdminReferralSimulation>("/admin/referral-codes/simulate", { method: "POST", body: payload });
  }

  async adminGetWorkspaceReferrals(workspaceId: string): Promise<AdminWorkspaceReferrals> {
    const body = await this.request<AdminWorkspaceReferrals>(`/admin/workspaces/${workspaceId}/referrals`);
    return { ...body, redemptions: unwrapList(body, "redemptions"), links: unwrapList(body, "links") };
  }

  async adminGetUserReferrals(userId: string): Promise<{ redemptions: AdminRedemption[] }> {
    const body = await this.request<{ redemptions: AdminRedemption[] }>(`/admin/users/${userId}/referrals`);
    return { redemptions: unwrapList(body, "redemptions") };
  }

  /** Links a store to an agent by hand; the open link, if any, ends as "replaced". */
  async adminCreateAgentLink(workspaceId: string, payload: AdminAgentLinkInput): Promise<AdminAgentLink> {
    const body = await this.request<unknown>(`/admin/workspaces/${workspaceId}/agent-links`, { method: "POST", body: payload });
    return unwrapObject<AdminAgentLink>(body, "link");
  }

  async adminUpdateAgentLink(linkId: string, payload: Partial<Omit<AdminAgentLinkInput, "agentId" | "startsAt">>): Promise<AdminAgentLink> {
    const body = await this.request<unknown>(`/admin/agent-links/${linkId}`, { method: "PATCH", body: payload });
    return unwrapObject<AdminAgentLink>(body, "link");
  }

  async adminEndAgentLink(linkId: string, note?: string): Promise<AdminAgentLink> {
    const body = await this.request<unknown>(`/admin/agent-links/${linkId}/end`, { method: "POST", body: note ? { note } : {} });
    return unwrapObject<AdminAgentLink>(body, "link");
  }

  async adminListCommissions(params: AdminCommissionParams = {}): Promise<AdminCommissionPage> {
    const body = await this.request<AdminCommissionPage>(`/admin/commissions${buildQuery({ ...params })}`);
    return { ...body, commissions: unwrapList(body, "commissions"), totals: unwrapList(body, "totals") };
  }

  /** The ledger's one write. 409 COMMISSION_ALREADY_MARKED_PAID. */
  async adminMarkCommissionPaid(commissionId: string, note?: string): Promise<AdminCommission> {
    const body = await this.request<unknown>(`/admin/commissions/${commissionId}/mark-paid`, {
      method: "POST",
      body: note ? { note } : {},
    });
    return unwrapObject<AdminCommission>(body, "commission");
  }

  // --- Subscription charges ---

  /** `GET /admin/workspaces/:id/charges` — subscription, next-charge price and every charge. */
  async adminListCharges(workspaceId: string): Promise<AdminWorkspaceCharges> {
    const body = await this.request<AdminWorkspaceCharges>(`/admin/workspaces/${workspaceId}/charges`);
    return { ...body, subscription: unwrapObject(body, "subscription"), charges: unwrapList(body, "charges") };
  }

  /** Prices the next charge (201), or returns the open one (200). 409 PLAN_IS_FREE / NO_PLAN. */
  async adminCreateCharge(workspaceId: string): Promise<{ charge: AdminCharge; created: boolean }> {
    const body = await this.request<unknown>(`/admin/workspaces/${workspaceId}/charges`, { method: "POST" });
    return { charge: unwrapObject<AdminCharge>(body, "charge"), created: readFlag(body, "created") };
  }

  /**
   * Records a payment received outside any gateway, through the same path as
   * the gateway webhook. 409 CHARGE_ALREADY_PAID.
   */
  // --- payment methods and transfer proofs (billing/paymentAdminRoutes)

  /** A store's prepaid balance and its ledger (subscriptions.view). */
  async adminGetWorkspaceWallet(
    workspaceId: string,
    { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}
  ): Promise<{ wallet: WalletSummary; ledger: WalletLedgerPage; refunds?: WalletRefundBreakdown }> {
    return this.request<{ wallet: WalletSummary; ledger: WalletLedgerPage; refunds?: WalletRefundBreakdown }>(
      `/admin/workspaces/${workspaceId}/wallet?page=${page}&pageSize=${pageSize}`
    );
  }

  /** Free orders for one store, with a reason; `requestId` makes a retry write nothing twice. */
  async adminGrantWalletFreeOrders(
    workspaceId: string,
    body: { count: number; reason: string; requestId: string }
  ): Promise<WalletConsoleEntryResult> {
    return this.request<WalletConsoleEntryResult>(`/admin/workspaces/${workspaceId}/wallet/free-orders`, {
      method: "POST",
      body,
    });
  }

  /** The balance corrected by hand, either way (minor units, never 0), with a reason. */
  /** The console's refund requests, newest first (`payments.record`). */
  async adminListWalletRefunds({ status, page = 1, pageSize = 20 }: { status?: WalletRefundStatus; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(status ? { status } : {}) });
    return this.request<AdminWalletRefundPage>(`/admin/wallet-refunds?${query.toString()}`);
  }

  async adminApproveWalletRefund(refundId: string, note?: string) {
    return this.request<{ request: AdminWalletRefund; changed: boolean }>(`/admin/wallet-refunds/${refundId}/approve`, {
      method: "POST",
      body: note ? { note } : {},
    });
  }

  /** The held amount goes back to the store's balance; the note is required and shown to the merchant. */
  async adminRejectWalletRefund(refundId: string, note: string) {
    return this.request<{ request: AdminWalletRefund; changed: boolean }>(`/admin/wallet-refunds/${refundId}/reject`, {
      method: "POST",
      body: { note },
    });
  }

  /** The transfer was made by hand; once only (a second call changes nothing). */
  async adminMarkWalletRefundPaid(refundId: string, body: { payoutReference: string; note?: string }) {
    return this.request<{ request: AdminWalletRefund; changed: boolean }>(`/admin/wallet-refunds/${refundId}/mark-paid`, {
      method: "POST",
      body,
    });
  }

  /** A correction either way (`kind: "correction"`), or a gift that only adds; neither is ever refundable. */
  async adminAdjustWallet(
    workspaceId: string,
    body: { amount: number; reason: string; requestId: string; kind?: "correction" | "gift"; notifyMerchant?: boolean }
  ): Promise<WalletConsoleEntryResult> {
    return this.request<WalletConsoleEntryResult>(`/admin/workspaces/${workspaceId}/wallet/adjustments`, {
      method: "POST",
      body,
    });
  }

  /** Every payment method, and the gateways with an adapter but no row yet (payments.record). */
  async adminListPaymentMethods(): Promise<AdminPaymentMethods> {
    return this.request<AdminPaymentMethods>("/admin/payment-methods");
  }

  /** On or off, and the labels (payment_methods.manage). 409 PAYMENT_METHOD_NEEDS_NUMBER. */
  async adminUpdatePaymentMethod(
    code: string,
    payload: { enabled?: boolean; labelAr?: string; labelEn?: string }
  ): Promise<AdminPaymentMethod> {
    const { method } = await this.request<{ method: AdminPaymentMethod }>(`/admin/payment-methods/${code}`, {
      method: "PATCH",
      body: payload,
    });
    return method;
  }

  /** The order merchants see them in, first first (payment_methods.manage). */
  async adminReorderPaymentMethods(codes: string[]): Promise<AdminPaymentMethods> {
    return this.request<AdminPaymentMethods>("/admin/payment-methods/order", { method: "PUT", body: { codes } });
  }

  /** A manual method's number and note (payment_methods.edit_numbers), audited old and new. */
  async adminUpdatePaymentMethodAccount(
    code: string,
    /** `paymentLink`: optional, https only; empty clears it. */
    payload: { accountNumber?: string; paymentLink?: string | null; noteAr?: string; noteEn?: string }
  ): Promise<AdminPaymentMethod> {
    const { method } = await this.request<{ method: AdminPaymentMethod }>(`/admin/payment-methods/${code}/account`, {
      method: "PATCH",
      body: payload,
    });
    return method;
  }

  async adminListPaymentProofs(params: { status?: string; page?: number; pageSize?: number } = {}): Promise<AdminPaymentProofPage> {
    return this.request<AdminPaymentProofPage>(`/admin/payment-proofs${buildQuery(params)}`);
  }

  async adminGetPaymentProof(proofId: string): Promise<AdminPaymentProofReview> {
    return this.request<AdminPaymentProofReview>(`/admin/payment-proofs/${proofId}`);
  }

  /**
   * The amount that arrived (minor units). For a charge it must be exactly the
   * amount asked: 422 RECEIVED_AMOUNT_MISMATCH, 409 CHARGE_ALREADY_PAID /
   * CHARGE_REPRICED / PROOF_ALREADY_REVIEWED. A second approval is a no-op.
   */
  async adminApprovePaymentProof(proofId: string, receivedAmount: number): Promise<AdminPaymentProofReview> {
    return this.request<AdminPaymentProofReview>(`/admin/payment-proofs/${proofId}/approve`, {
      method: "POST",
      body: { receivedAmount },
    });
  }

  /** The note is required, and the merchant reads it. */
  async adminRejectPaymentProof(proofId: string, note: string): Promise<AdminPaymentProofReview> {
    return this.request<AdminPaymentProofReview>(`/admin/payment-proofs/${proofId}/reject`, {
      method: "POST",
      body: { note },
    });
  }

  async adminRecordPayment(
    chargeId: string,
    payload: { amountReceived: number; note?: string; paidAt?: string }
  ): Promise<AdminRecordPaymentResult> {
    const body = await this.request<unknown>(`/admin/charges/${chargeId}/record-payment`, {
      method: "POST",
      body: payload,
    });
    return { charge: unwrapObject<AdminCharge>(body, "charge"), referralCodeLapsed: readFlag(body, "referralCodeLapsed") };
  }

  /**
   * Undoes a payment recorded by hand: back to pending, ledger row voided.
   * 409 CHARGE_NOT_PAID / PAYMENT_CONFIRMED_BY_GATEWAY / OPEN_CHARGE_EXISTS.
   */
  async adminReversePayment(chargeId: string, payload: { reason?: string } = {}): Promise<AdminReversePaymentResult> {
    const body = await this.request<AdminReversePaymentResult>(`/admin/charges/${chargeId}/reverse-payment`, {
      method: "POST",
      body: payload,
    });
    return {
      charge: unwrapObject<AdminCharge>(body, "charge"),
      voidedCommission: body.voidedCommission ?? null,
      subscriptionStatus: body.subscriptionStatus,
    };
  }

  /**
   * Voids a pending charge with a reason, kept on it and in the audit log
   * (PLAN_SWITCH_ENABLED). 409 CHARGE_ALREADY_PAID / CHARGE_NOT_PENDING /
   * PROOF_UNDER_REVIEW (review the transfer first); 404 PLAN_SWITCH_DISABLED.
   */
  async adminVoidCharge(chargeId: string, reason: string): Promise<AdminVoidChargeResult> {
    const body = await this.request<unknown>(`/admin/charges/${chargeId}/void`, { method: "POST", body: { reason } });
    return { charge: unwrapObject<AdminCharge>(body, "charge") };
  }

  /** Monthly or annual from the next charge (subscriptions.manage). 409 OPEN_CHARGE_EXISTS. */
  async adminSetBillingCycle(workspaceId: string, billingCycle: "monthly" | "yearly"): Promise<AdminWorkspaceCharges> {
    const body = await this.request<AdminWorkspaceCharges>(`/admin/workspaces/${workspaceId}/subscription`, {
      method: "PATCH",
      body: { billingCycle },
    });
    return { ...body, charges: unwrapList(body, "charges"), specialTerms: unwrapList(body, "specialTerms") };
  }

  /** Free months or a price override (subscriptions.manage). 409 SPECIAL_PRICE_ACTIVE / SUBSCRIPTION_CANCELLED. */
  async adminGrantSpecialTerms(
    workspaceId: string,
    payload: AdminSpecialTermsInput
  ): Promise<AdminWorkspaceCharges & { term: AdminSpecialTerm }> {
    const body = await this.request<AdminWorkspaceCharges & { term: AdminSpecialTerm }>(
      `/admin/workspaces/${workspaceId}/special-terms`,
      { method: "POST", body: payload }
    );
    return { ...body, term: unwrapObject(body, "term"), charges: unwrapList(body, "charges"), specialTerms: unwrapList(body, "specialTerms") };
  }

  async adminGetStoreAccess(workspaceId: string): Promise<AdminStoreAccess> {
    const body = await this.request<unknown>(`/admin/workspaces/${workspaceId}/access`);
    return unwrapObject<AdminStoreAccess>(body, "access");
  }

  /** workspaces.manage; a reason is required. 409 WORKSPACE_ALREADY_SUSPENDED. */
  async adminSuspendWorkspace(workspaceId: string, reason: string): Promise<AdminStoreAccess> {
    const body = await this.request<unknown>(`/admin/workspaces/${workspaceId}/suspend`, { method: "POST", body: { reason } });
    return unwrapObject<AdminStoreAccess>(body, "access");
  }

  /** workspaces.manage; a reason is required. 409 WORKSPACE_NOT_SUSPENDED. */
  async adminReactivateWorkspace(workspaceId: string, reason: string): Promise<AdminStoreAccess> {
    const body = await this.request<unknown>(`/admin/workspaces/${workspaceId}/reactivate`, { method: "POST", body: { reason } });
    return unwrapObject<AdminStoreAccess>(body, "access");
  }

  /** An agent's own codes and referred merchants (referrals.view_own). */
  async adminGetMyReferrals(): Promise<AdminAgentDetail> {
    const body = await this.request<AdminAgentDetail>("/admin/my/referrals");
    return { ...body, agent: unwrapObject(body, "agent"), merchants: unwrapList(body, "merchants") };
  }

  async adminListMyCommissions(
    params: Omit<AdminCommissionParams, "agentId" | "workspaceId"> = {}
  ): Promise<AdminCommissionPage> {
    const body = await this.request<AdminCommissionPage>(`/admin/my/commissions${buildQuery({ ...params })}`);
    return { ...body, commissions: unwrapList(body, "commissions"), totals: unwrapList(body, "totals") };
  }

  /** `GET /admin/risk/signals` — one identifier type per call, paged server-side. */
  async adminListRiskSignals(params: AdminRiskSignalParams = {}): Promise<AdminRiskSignalPage> {
    const body = await this.request<AdminRiskSignalPage>(`/admin/risk/signals${buildQuery({ ...params })}`);
    return { ...body, signals: unwrapList(body, "signals") };
  }

  // ---------------------------------------------------------------------
  // Catalog — products, variants, offers, collections
  // (/workspaces/:workspaceId/catalog/...)
  // ---------------------------------------------------------------------

  private catalogBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/catalog`;
  }

  async listProducts(workspaceId: string, params: ProductListParams = {}) {
    const { status, ...rest } = params;
    return this.request<ProductListResponse>(
      `${this.catalogBase(workspaceId)}/products${buildQuery({
        ...rest,
        status: Array.isArray(status) ? status.join(",") || undefined : status,
      })}`
    );
  }

  async getProduct(workspaceId: string, productId: string) {
    const { product } = await this.request<{ product: Product }>(
      `${this.catalogBase(workspaceId)}/products/${productId}`
    );
    return product;
  }

  async createProduct(workspaceId: string, payload: CreateProductPayload) {
    return this.request<CreateProductResponse>(`${this.catalogBase(workspaceId)}/products`, {
      method: "POST",
      body: payload,
    });
  }

  async updateProduct(workspaceId: string, productId: string, payload: UpdateProductPayload) {
    const { product } = await this.request<{ product: Product }>(
      `${this.catalogBase(workspaceId)}/products/${productId}`,
      { method: "PATCH", body: payload }
    );
    return product;
  }

  /** Archives the product (and cascades to its active variants/offers). */
  async deleteProduct(workspaceId: string, productId: string) {
    return this.request<ArchivedResponse>(
      `${this.catalogBase(workspaceId)}/products/${productId}`,
      { method: "DELETE" }
    );
  }

  /**
   * Brings an archived product back as a DRAFT, reviving only the variants and
   * offers its archive took down. 409 PRODUCT_NOT_ARCHIVED otherwise.
   */
  async restoreProduct(workspaceId: string, productId: string) {
    const { product } = await this.request<{ product: Product }>(
      `${this.catalogBase(workspaceId)}/products/${productId}/restore`,
      { method: "POST" }
    );
    return product;
  }

  /**
   * Hard delete. 409 PRODUCT_HAS_ORDERS (archive instead) or
   * PRODUCT_IN_FUNNEL (details[0].funnelIds).
   */
  async deleteProductPermanently(workspaceId: string, productId: string) {
    return this.request<DeletedResponse>(
      `${this.catalogBase(workspaceId)}/products/${productId}/permanent`,
      { method: "DELETE" }
    );
  }

  async getVariant(workspaceId: string, variantId: string) {
    const { variant } = await this.request<{ variant: Variant }>(
      `${this.catalogBase(workspaceId)}/variants/${variantId}`
    );
    return variant;
  }

  async createVariant(workspaceId: string, productId: string, payload: CreateVariantPayload) {
    const { variant } = await this.request<{ variant: Variant }>(
      `${this.catalogBase(workspaceId)}/products/${productId}/variants`,
      { method: "POST", body: payload }
    );
    return variant;
  }

  async updateVariant(workspaceId: string, variantId: string, payload: UpdateVariantPayload) {
    const { variant } = await this.request<{ variant: Variant }>(
      `${this.catalogBase(workspaceId)}/variants/${variantId}`,
      { method: "PATCH", body: payload }
    );
    return variant;
  }

  async deleteVariant(workspaceId: string, variantId: string) {
    return this.request<ArchivedResponse>(
      `${this.catalogBase(workspaceId)}/variants/${variantId}`,
      { method: "DELETE" }
    );
  }

  async listOffers(workspaceId: string, productId: string) {
    const { offers } = await this.request<{ offers: Offer[] }>(
      `${this.catalogBase(workspaceId)}/products/${productId}/offers`
    );
    return offers;
  }

  /** Active offers across the store (product name, then offer name) — for pickers. */
  async listWorkspaceOffers(workspaceId: string, params: { q?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const { offers } = await this.request<{ offers: WorkspaceOfferOption[] }>(
      `${this.catalogBase(workspaceId)}/offers${qs ? `?${qs}` : ""}`
    );
    return offers;
  }

  /** One offer with its lines, whatever its status. 404 when it isn't in the workspace. */
  async getOffer(workspaceId: string, offerId: string) {
    const { offer } = await this.request<{ offer: Offer }>(
      `${this.catalogBase(workspaceId)}/offers/${offerId}`
    );
    return offer;
  }

  async createOffer(workspaceId: string, productId: string, payload: CreateOfferPayload) {
    const { offer } = await this.request<{ offer: Offer }>(
      `${this.catalogBase(workspaceId)}/products/${productId}/offers`,
      { method: "POST", body: payload }
    );
    return offer;
  }

  async updateOffer(workspaceId: string, offerId: string, payload: UpdateOfferPayload) {
    const { offer } = await this.request<{ offer: Offer }>(
      `${this.catalogBase(workspaceId)}/offers/${offerId}`,
      { method: "PATCH", body: payload }
    );
    return offer;
  }

  async deleteOffer(workspaceId: string, offerId: string) {
    return this.request<ArchivedResponse>(`${this.catalogBase(workspaceId)}/offers/${offerId}`, {
      method: "DELETE",
    });
  }

  async listCollections(workspaceId: string) {
    const { collections } = await this.request<{ collections: CollectionSummary[] }>(
      `${this.catalogBase(workspaceId)}/collections`
    );
    return collections;
  }

  async getCollection(workspaceId: string, collectionId: string) {
    const { collection } = await this.request<{ collection: CollectionDetail }>(
      `${this.catalogBase(workspaceId)}/collections/${collectionId}`
    );
    return collection;
  }

  async createCollection(workspaceId: string, payload: CreateCollectionPayload) {
    const { collection } = await this.request<{ collection: CollectionSummary }>(
      `${this.catalogBase(workspaceId)}/collections`,
      { method: "POST", body: payload }
    );
    return collection;
  }

  async updateCollection(
    workspaceId: string,
    collectionId: string,
    payload: UpdateCollectionPayload
  ) {
    const { collection } = await this.request<{ collection: CollectionSummary }>(
      `${this.catalogBase(workspaceId)}/collections/${collectionId}`,
      { method: "PATCH", body: payload }
    );
    return collection;
  }

  /** Rearranges the tree: each listed collection's parent and position, checked as a whole. */
  async reorderCollections(workspaceId: string, items: CollectionReorderItem[]) {
    return this.request<{ changed: number }>(`${this.catalogBase(workspaceId)}/collections/reorder`, {
      method: "POST",
      body: { items },
    });
  }

  /** The products of one collection, first to last; any left out keep their order after these. */
  async reorderCollectionProducts(workspaceId: string, collectionId: string, productIds: string[]) {
    return this.request<{ productIds: string[] }>(
      `${this.catalogBase(workspaceId)}/collections/${collectionId}/products/order`,
      { method: "PUT", body: { productIds } }
    );
  }

  /** Product option names the store's variants use ("Size", "Color"). */
  async listCatalogOptionNames(workspaceId: string) {
    const { options } = await this.request<{ options: CatalogOptionName[] }>(
      `${this.catalogBase(workspaceId)}/option-names`
    );
    return options;
  }

  async deleteCollection(workspaceId: string, collectionId: string) {
    return this.request<DeletedResponse>(
      `${this.catalogBase(workspaceId)}/collections/${collectionId}`,
      { method: "DELETE" }
    );
  }

  async addProductToCollection(workspaceId: string, productId: string, collectionId: string) {
    return this.request<SuccessResponse>(
      `${this.catalogBase(workspaceId)}/products/${productId}/collections/${collectionId}`,
      { method: "POST", body: {} }
    );
  }

  async removeProductFromCollection(workspaceId: string, productId: string, collectionId: string) {
    return this.request<SuccessResponse>(
      `${this.catalogBase(workspaceId)}/products/${productId}/collections/${collectionId}`,
      { method: "DELETE" }
    );
  }

  // ---------------------------------------------------------------------
  // Orders, shipments, returns, waybill
  // (/workspaces/:workspaceId/orders/... and /returns/...)
  // ---------------------------------------------------------------------

  private ordersBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/orders`;
  }

  async listOrders(workspaceId: string, params: OrderListParams = {}) {
    return this.request<OrderListResponse>(
      `${this.ordersBase(workspaceId)}${buildQuery({ ...params })}`
    );
  }

  /**
   * Tab counts for the orders screen. Takes the same q/from/to as the list
   * (never `stage` — this is the answer for every stage at once).
   */
  async getOrderPipeline(workspaceId: string, params: OrderSearchParams = {}, signal?: AbortSignal) {
    return this.request<OrderPipeline>(
      `${this.ordersBase(workspaceId)}/pipeline${buildQuery({ ...params })}`,
      { signal }
    );
  }

  /** `GET /orders/locked-summary` — how many open orders are locked and what they are worth (locked orders on). */
  async getLockedOrdersSummary(workspaceId: string): Promise<LockedOrdersSummary> {
    const { locked } = await this.request<{ locked: LockedOrdersSummary }>(`${this.ordersBase(workspaceId)}/locked-summary`);
    return locked;
  }

  /** `POST /orders/locked/settle` — takes the owed fees of orders paid online while the balance couldn't (orders.manage). */
  async settleLockedOrders(workspaceId: string): Promise<{ settled: number; left: number; locked: LockedOrdersSummary }> {
    // request() serializes the body itself: a string here would go out as the JSON string "{}" (400).
    return this.request<{ settled: number; left: number; locked: LockedOrdersSummary }>(`${this.ordersBase(workspaceId)}/locked/settle`, {
      method: "POST",
      body: {},
    });
  }

  async getOrder(workspaceId: string, orderId: string) {
    const { order } = await this.request<{ order: Order }>(
      `${this.ordersBase(workspaceId)}/${orderId}`
    );
    return order;
  }

  async createOrder(workspaceId: string, payload: CreateOrderPayload) {
    const { order } = await this.request<{ order: Order }>(this.ordersBase(workspaceId), {
      method: "POST",
      body: payload,
      idempotent: true,
    });
    return order;
  }

  /**
   * Cancels the order and its uncollected courier bookings. 409
   * CARRIER_MANUAL_CANCEL_REQUIRED (details.shipments) when a booking's
   * courier has no cancel API: nothing changed; repeat with
   * `acknowledgeManualCancel: true` once the merchant cancelled it there.
   */
  async cancelOrder(
    workspaceId: string,
    orderId: string,
    reason: string,
    options: ManualCancelAcknowledgement = {}
  ) {
    const body = options.acknowledgeManualCancel ? { reason, acknowledgeManualCancel: true } : { reason };
    const { order } = await this.request<{ order: Order }>(
      `${this.ordersBase(workspaceId)}/${orderId}/cancel`,
      { method: "POST", body }
    );
    return order;
  }

  async updateOrder(workspaceId: string, orderId: string, payload: UpdateOrderPayload) {
    const { order } = await this.request<{ order: Order }>(
      `${this.ordersBase(workspaceId)}/${orderId}`,
      { method: "PATCH", body: payload }
    );
    return order;
  }

  async listShipments(workspaceId: string, orderId: string) {
    const { shipments } = await this.request<{ shipments: Shipment[] }>(
      `${this.ordersBase(workspaceId)}/${orderId}/shipments`
    );
    return shipments;
  }

  /**
   * Manual shipment, or a booking with a connected courier. Courier-specific
   * failures: 422 CARRIER_ADDRESS_UNMATCHED (pick the address, resend with
   * `carrierAddress`), CARRIER_BOOKING_NOT_SAVED (424, 502 on older servers:
   * the courier has the booking but it wasn't recorded — cancel it in the
   * courier's dashboard). Match these by code, never by status.
   */
  async createShipment(workspaceId: string, orderId: string, payload: CreateShipmentPayload) {
    const { shipment } = await this.request<{ shipment: Shipment }>(
      `${this.ordersBase(workspaceId)}/${orderId}/shipments`,
      { method: "POST", body: payload }
    );
    return shipment;
  }

  /**
   * Status `cancelled` on a booking whose courier has no cancel API needs
   * `acknowledgeManualCancel` (409 CARRIER_MANUAL_CANCEL_REQUIRED without it).
   */
  async updateShipment(
    workspaceId: string,
    orderId: string,
    shipmentId: string,
    payload: UpdateShipmentPayload
  ) {
    const { shipment } = await this.request<{ shipment: Shipment }>(
      `${this.ordersBase(workspaceId)}/${orderId}/shipments/${shipmentId}`,
      { method: "PATCH", body: payload }
    );
    return shipment;
  }

  /**
   * Pull a courier-booked shipment's status from the courier now. 409
   * SHIPMENT_NOT_CARRIER_MANAGED for manual shipments, 409
   * CARRIER_NOT_CONNECTED once the courier was disconnected.
   */
  async syncShipment(workspaceId: string, orderId: string, shipmentId: string) {
    return this.request<ShipmentSyncResult>(
      `${this.ordersBase(workspaceId)}/${orderId}/shipments/${shipmentId}/sync`,
      { method: "POST" }
    );
  }

  /** The courier's own printable label (AWB) for a courier-booked shipment, as a PDF Blob. */
  async getShipmentLabel(workspaceId: string, orderId: string, shipmentId: string): Promise<Blob> {
    const res = await this.rawFetch(
      `${this.ordersBase(workspaceId)}/${orderId}/shipments/${shipmentId}/label`,
      { headers: { Accept: "application/pdf" } }
    );
    return res.blob();
  }

  async listOrderReturns(workspaceId: string, orderId: string) {
    const { returns } = await this.request<{ returns: ReturnRequest[] }>(
      `${this.ordersBase(workspaceId)}/${orderId}/returns`
    );
    return returns;
  }

  async createReturn(workspaceId: string, orderId: string, payload: CreateReturnPayload) {
    const { return: created } = await this.request<{ return: ReturnRequest }>(
      `${this.ordersBase(workspaceId)}/${orderId}/returns`,
      { method: "POST", body: payload }
    );
    return created;
  }

  async listReturns(workspaceId: string, params: ReturnListParams = {}) {
    const { returns } = await this.request<{ returns: ReturnRequest[] }>(
      `/workspaces/${workspaceId}/returns${buildQuery({ ...params })}`
    );
    return returns;
  }

  async moderateReturn(workspaceId: string, returnId: string, action: "approve" | "reject") {
    const { return: updated } = await this.request<{ return: ReturnRequest }>(
      `/workspaces/${workspaceId}/returns/${returnId}`,
      { method: "PATCH", body: { action } }
    );
    return updated;
  }

  async restockReturn(workspaceId: string, returnId: string) {
    const { return: updated } = await this.request<{ return: ReturnRequest }>(
      `/workspaces/${workspaceId}/returns/${returnId}/restock`,
      { method: "POST" }
    );
    return updated;
  }

  // ---------------------------------------------------------------------
  // Product reviews — staff moderation
  // (/workspaces/:workspaceId/reviews). Shoppers submit through the public
  // storefront route; everything here needs products.manage.
  // ---------------------------------------------------------------------

  async listReviews(workspaceId: string, params: ReviewListParams = {}) {
    const { reviews } = await this.request<{ reviews: Review[] }>(
      `/workspaces/${workspaceId}/reviews${buildQuery({ ...params })}`
    );
    return reviews;
  }

  async moderateReview(workspaceId: string, reviewId: string, action: "approve" | "approve_stars" | "hide" | "reject") {
    const { review } = await this.request<{ review: Review }>(
      `/workspaces/${workspaceId}/reviews/${reviewId}`,
      { method: "PATCH", body: { action } }
    );
    return review;
  }

  // ---------------------------------------------------------------------
  // Confirmation queue (auth, /workspaces/:workspaceId/confirmation-tasks/...)
  // `listConfirmationQueue` pages one tab; `claim` locks a task to the
  // current user (again: extends the lock); `release` hands it back;
  // `recordConfirmationOutcome` records a call; `correctConfirmationOutcome`
  // changes a finished outcome (orders.manage). `confirmOrder` is the order
  // page's Confirm, under the orders routes.
  // ---------------------------------------------------------------------

  private confirmationTasksBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/confirmation-tasks`;
  }

  async listConfirmationQueue(workspaceId: string, params: ConfirmationQueueParams = {}) {
    return this.request<ConfirmationQueuePage>(
      `${this.confirmationTasksBase(workspaceId)}${buildQuery({ ...params })}`
    );
  }

  async getConfirmationQueueCounts(workspaceId: string) {
    const { counts } = await this.request<{ counts: ConfirmationQueueCounts }>(
      `${this.confirmationTasksBase(workspaceId)}/counts`
    );
    return counts;
  }

  /** Members a task may be assigned to (orders.manage). */
  async listConfirmationAssignees(workspaceId: string) {
    const { assignees } = await this.request<{ assignees: ConfirmationAssignee[] }>(
      `${this.confirmationTasksBase(workspaceId)}/assignees`
    );
    return assignees;
  }

  /** Hands one open task to an agent (orders.manage). */
  async assignConfirmationTask(workspaceId: string, taskId: string, userId: string) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/assign`,
      { method: "POST", body: { userId } }
    );
    return task;
  }

  async unassignConfirmationTask(workspaceId: string, taskId: string) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/unassign`,
      { method: "POST", body: {} }
    );
    return task;
  }

  /** One agent for up to 200 tasks; `userId: null` unassigns them. Done tasks are skipped. */
  async assignConfirmationTasks(workspaceId: string, taskIds: string[], userId: string | null) {
    return this.request<AssignConfirmationTasksResult>(`${this.confirmationTasksBase(workspaceId)}/assign`, {
      method: "POST",
      body: { taskIds, userId },
    });
  }

  async claimConfirmationTask(workspaceId: string, taskId: string) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/claim`,
      { method: "POST", body: {} }
    );
    return task;
  }

  async releaseConfirmationTask(workspaceId: string, taskId: string) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/release`,
      { method: "POST", body: {} }
    );
    return task;
  }

  async recordConfirmationOutcome(
    workspaceId: string,
    taskId: string,
    payload: RecordConfirmationOutcomePayload
  ) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/outcome`,
      { method: "POST", body: payload }
    );
    return task;
  }

  async correctConfirmationOutcome(
    workspaceId: string,
    taskId: string,
    payload: CorrectConfirmationOutcomePayload
  ) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/correction`,
      { method: "POST", body: payload }
    );
    return task;
  }

  /** Confirms a COD order from the order page; resolves to the refreshed order detail. */
  async confirmOrder(workspaceId: string, orderId: string, notes?: string, channel?: ConfirmationChannel) {
    return this.request<{ order: Order; task: ConfirmationTask }>(
      `${this.ordersBase(workspaceId)}/${orderId}/confirmation`,
      { method: "POST", body: { ...(notes ? { notes } : {}), ...(channel ? { channel } : {}) } }
    );
  }

  // ---------------------------------------------------------------------
  // Discounts (auth, /workspaces/:workspaceId/discounts/...)
  // `value` is basis points for a percentage discount, integer minor units
  // for a fixed one. DELETE archives (a redeemed discount is financial
  // history), so it resolves to ArchivedResponse.
  // ---------------------------------------------------------------------

  private discountsBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/discounts`;
  }

  async listDiscounts(workspaceId: string) {
    const { discounts } = await this.request<{ discounts: Discount[] }>(
      this.discountsBase(workspaceId)
    );
    return discounts;
  }

  async getDiscount(workspaceId: string, discountId: string) {
    const { discount } = await this.request<{ discount: Discount }>(
      `${this.discountsBase(workspaceId)}/${discountId}`
    );
    return discount;
  }

  async createDiscount(workspaceId: string, payload: CreateDiscountPayload) {
    const { discount } = await this.request<{ discount: Discount }>(this.discountsBase(workspaceId), {
      method: "POST",
      body: payload,
    });
    return discount;
  }

  async updateDiscount(workspaceId: string, discountId: string, payload: UpdateDiscountPayload) {
    const { discount } = await this.request<{ discount: Discount }>(
      `${this.discountsBase(workspaceId)}/${discountId}`,
      { method: "PATCH", body: payload }
    );
    return discount;
  }

  async setDiscountStatus(workspaceId: string, discountId: string, status: DiscountStatus) {
    const { discount } = await this.request<{ discount: Discount }>(
      `${this.discountsBase(workspaceId)}/${discountId}/status`,
      { method: "PATCH", body: { status } }
    );
    return discount;
  }

  async deleteDiscount(workspaceId: string, discountId: string) {
    return this.request<ArchivedResponse>(`${this.discountsBase(workspaceId)}/${discountId}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------
  // Shipping zones + rates (auth, /workspaces/:workspaceId/shipping/...)
  // Hard deletes — an order copies the computed shipping amount, it never
  // references a zone or rate by id. The zone list eager-loads each zone's
  // rates.
  // ---------------------------------------------------------------------

  private shippingBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/shipping`;
  }

  async listShippingZones(workspaceId: string) {
    const { zones } = await this.request<{ zones: ShippingZone[] }>(
      `${this.shippingBase(workspaceId)}/zones`
    );
    return zones;
  }

  async createShippingZone(workspaceId: string, payload: CreateShippingZonePayload) {
    const { zone } = await this.request<{ zone: ShippingZone }>(
      `${this.shippingBase(workspaceId)}/zones`,
      { method: "POST", body: payload }
    );
    return zone;
  }

  async updateShippingZone(workspaceId: string, zoneId: string, payload: UpdateShippingZonePayload) {
    const { zone } = await this.request<{ zone: ShippingZone }>(
      `${this.shippingBase(workspaceId)}/zones/${zoneId}`,
      { method: "PATCH", body: payload }
    );
    return zone;
  }

  async deleteShippingZone(workspaceId: string, zoneId: string) {
    return this.request<DeletedResponse>(`${this.shippingBase(workspaceId)}/zones/${zoneId}`, {
      method: "DELETE",
    });
  }

  async createShippingRate(workspaceId: string, zoneId: string, payload: CreateShippingRatePayload) {
    const { rate } = await this.request<{ rate: ShippingRate }>(
      `${this.shippingBase(workspaceId)}/zones/${zoneId}/rates`,
      { method: "POST", body: payload }
    );
    return rate;
  }

  async updateShippingRate(workspaceId: string, rateId: string, payload: UpdateShippingRatePayload) {
    const { rate } = await this.request<{ rate: ShippingRate }>(
      `${this.shippingBase(workspaceId)}/rates/${rateId}`,
      { method: "PATCH", body: payload }
    );
    return rate;
  }

  async deleteShippingRate(workspaceId: string, rateId: string) {
    return this.request<DeletedResponse>(`${this.shippingBase(workspaceId)}/rates/${rateId}`, {
      method: "DELETE",
    });
  }

  /** Tiers, the zone × tier price grid, the pricing mode and the "no weight" count, in one read. */
  async getWeightTiers(workspaceId: string) {
    return this.request<WeightTierSettings>(`${this.shippingBase(workspaceId)}/weight-tiers`);
  }

  /** Replaces the whole set, in order. An entry with `id` keeps that tier; a left-out tier is deleted with its prices. */
  async replaceWeightTiers(workspaceId: string, payload: ReplaceWeightTiersPayload) {
    const { tiers } = await this.request<{ tiers: WeightTier[] }>(`${this.shippingBase(workspaceId)}/weight-tiers`, {
      method: "PUT",
      body: payload,
    });
    return tiers;
  }

  async getZoneTierPrices(workspaceId: string, zoneId: string) {
    return this.request<{ zoneId: string; prices: Array<{ tierId: string; amount: number }> }>(
      `${this.shippingBase(workspaceId)}/zones/${zoneId}/tier-prices`
    );
  }

  /** Replaces the zone's prices; a tier left out has no price in this zone. */
  async replaceZoneTierPrices(workspaceId: string, zoneId: string, prices: Array<{ tierId: string; amount: number }>) {
    return this.request<{ zoneId: string; prices: Array<{ tierId: string; amount: number }> }>(
      `${this.shippingBase(workspaceId)}/zones/${zoneId}/tier-prices`,
      { method: "PUT", body: { prices } }
    );
  }

  /** The store's default rate, governorate prices, free-shipping threshold and default courier. */
  async getShippingSettings(workspaceId: string) {
    return this.request<ShippingSettingsResponse>(`/workspaces/${workspaceId}/shipping/settings`);
  }

  async updateShippingSettings(workspaceId: string, payload: UpdateShippingSettingsPayload) {
    const { settings } = await this.request<{ settings: ShippingSettings }>(
      `/workspaces/${workspaceId}/shipping/settings`,
      { method: "PATCH", body: payload }
    );
    return settings;
  }

  async setShippingPricingMode(workspaceId: string, payload: SetPricingModePayload) {
    return this.request<SetPricingModeResult>(`${this.shippingBase(workspaceId)}/pricing-mode`, {
      method: "POST",
      body: payload,
    });
  }

  // ---------------------------------------------------------------------
  // Tax rates (auth, /workspaces/:workspaceId/tax-rates/...)
  // `rateBasisPoints` is 100ths of a percent (1000 = 10%). Hard deletes.
  // ---------------------------------------------------------------------

  private taxRatesBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/tax-rates`;
  }

  async listTaxRates(workspaceId: string) {
    const { taxRates } = await this.request<{ taxRates: TaxRate[] }>(this.taxRatesBase(workspaceId));
    return taxRates;
  }

  async createTaxRate(workspaceId: string, payload: CreateTaxRatePayload) {
    const { taxRate } = await this.request<{ taxRate: TaxRate }>(this.taxRatesBase(workspaceId), {
      method: "POST",
      body: payload,
    });
    return taxRate;
  }

  async updateTaxRate(workspaceId: string, taxRateId: string, payload: UpdateTaxRatePayload) {
    const { taxRate } = await this.request<{ taxRate: TaxRate }>(
      `${this.taxRatesBase(workspaceId)}/${taxRateId}`,
      { method: "PATCH", body: payload }
    );
    return taxRate;
  }

  async deleteTaxRate(workspaceId: string, taxRateId: string) {
    return this.request<DeletedResponse>(`${this.taxRatesBase(workspaceId)}/${taxRateId}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------
  // Customers (auth, /workspaces/:workspaceId/customers/...)
  // The list is cursor-paginated on the customer id and returns
  // { customers, nextCursor } — the caller maps it to the shape useCursorList
  // expects.
  // ---------------------------------------------------------------------

  private customersBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/customers`;
  }

  async listCustomers(workspaceId: string, params: CustomerListParams = {}) {
    return this.request<CustomerListResponse>(
      `${this.customersBase(workspaceId)}${buildQuery({ ...params })}`
    );
  }

  async getCustomer(workspaceId: string, customerId: string) {
    const { customer } = await this.request<{ customer: Customer }>(
      `${this.customersBase(workspaceId)}/${customerId}`
    );
    return customer;
  }

  async updateCustomer(workspaceId: string, customerId: string, payload: UpdateCustomerPayload) {
    const { customer } = await this.request<{ customer: Customer }>(
      `${this.customersBase(workspaceId)}/${customerId}`,
      { method: "PATCH", body: payload }
    );
    return customer;
  }

  async setCustomerBlacklist(workspaceId: string, customerId: string, payload: BlacklistPayload) {
    const { customer } = await this.request<{ customer: Customer }>(
      `${this.customersBase(workspaceId)}/${customerId}/blacklist`,
      { method: "PATCH", body: payload }
    );
    return customer;
  }

  async addCustomerAddress(
    workspaceId: string,
    customerId: string,
    payload: AddCustomerAddressPayload
  ) {
    const { address } = await this.request<{ address: CustomerAddress }>(
      `${this.customersBase(workspaceId)}/${customerId}/addresses`,
      { method: "POST", body: payload }
    );
    return address;
  }

  async updateCustomerAddress(
    workspaceId: string,
    customerId: string,
    addressId: string,
    payload: UpdateCustomerAddressPayload
  ) {
    const { address } = await this.request<{ address: CustomerAddress }>(
      `${this.customersBase(workspaceId)}/${customerId}/addresses/${addressId}`,
      { method: "PATCH", body: payload }
    );
    return address;
  }

  // ---------------------------------------------------------------------
  // Fraud (/workspaces/:workspaceId/fraud/...). The rules themselves are
  // workspace settings: read `settings.fraud_rules` from listWorkspaces(),
  // write with updateWorkspace() (needs workspace.manage).
  // ---------------------------------------------------------------------

  private fraudBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/fraud`;
  }

  /** Orders carrying a risk flag, newest first. A stale `before` is a 422 on "before". */
  async listFlaggedOrders(workspaceId: string, params: FlaggedOrderListParams = {}) {
    return this.request<FlaggedOrderListResponse>(
      `${this.fraudBase(workspaceId)}/flagged-orders${buildQuery({ ...params })}`
    );
  }

  /** Clears the order's risk flags and nothing else. Idempotent. */
  async approveFlaggedOrder(workspaceId: string, orderId: string) {
    const { order } = await this.request<{ order: { id: string; riskFlags: string[] } }>(
      `${this.fraudBase(workspaceId)}/flagged-orders/${orderId}/approve`,
      { method: "POST" }
    );
    return order;
  }

  /**
   * Every blacklisted customer (capped at 500 by the server, not paged).
   * Unblocking is setCustomerBlacklist(…, { isBlacklisted: false }).
   */
  async listBlocklist(workspaceId: string) {
    const body = await this.request<unknown>(`${this.fraudBase(workspaceId)}/blocklist`);
    return unwrapList<BlocklistEntry>(body, "entries");
  }

  /**
   * Blocks a phone, whether or not it has ever ordered. Re-blocking only
   * updates the reason (`created: false`). 422 INVALID_PHONE for a phone that
   * doesn't normalize.
   */
  async blockPhone(workspaceId: string, payload: BlockPhonePayload): Promise<BlockPhoneResult> {
    const res = await this.rawFetch(`${this.fraudBase(workspaceId)}/blocklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const { entry } = (await res.json()) as { entry: BlockPhoneResult["entry"] };
    return { created: res.status === 201, entry };
  }

  // ---------------------------------------------------------------------
  // Abandoned checkouts (/workspaces/:workspaceId/checkout-sessions)
  // ---------------------------------------------------------------------

  async listCheckoutSessions(workspaceId: string, params: CheckoutSessionListParams = {}) {
    return this.request<CheckoutSessionListResponse>(
      `/workspaces/${workspaceId}/checkout-sessions${buildQuery({ ...params })}`
    );
  }

  /**
   * Record the merchant's follow-up. "contacted" stamps contactedAt the first
   * time; an order from that shopper later turns "contacted" into
   * "recovered" on its own.
   */
  async updateCheckoutSessionRecovery(
    workspaceId: string,
    sessionId: string,
    recoveryStatus: CheckoutRecoveryStatus
  ) {
    const { session } = await this.request<{ session: CheckoutSession }>(
      `/workspaces/${workspaceId}/checkout-sessions/${sessionId}`,
      { method: "PATCH", body: { recoveryStatus } }
    );
    return session;
  }

  // ---------------------------------------------------------------------
  // Courier integrations (/workspaces/:workspaceId/carriers)
  // Reads: shipping.manage OR orders.manage. Connect/disconnect: shipping.manage.
  // ---------------------------------------------------------------------

  private carriersBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/carriers`;
  }

  /** Always 200 — check `configured` before offering to connect anything. */
  async listCarriers(workspaceId: string) {
    return this.request<CarrierList>(this.carriersBase(workspaceId));
  }

  /**
   * Connect, or change the settings of an existing connection (omit
   * `credentials` to keep the stored key — it is re-verified either way).
   * Nothing is stored when verification fails.
   */
  async connectCarrier(workspaceId: string, code: string, payload: ConnectCarrierPayload) {
    return this.request<ConnectCarrierResult>(`${this.carriersBase(workspaceId)}/${code}`, {
      method: "PUT",
      body: payload,
    });
  }

  async disconnectCarrier(workspaceId: string, code: string) {
    return this.request<{ disconnected: boolean }>(`${this.carriersBase(workspaceId)}/${code}`, {
      method: "DELETE",
    });
  }

  /**
   * The courier's city → district list (cached ~1h server-side). Pass
   * `cityId` for just that city — 404 NOT_FOUND if it isn't in the list.
   * City/district couriers only; see `listCarrierAddressTree` for the rest.
   */
  async listCarrierCities(workspaceId: string, code: string, cityId?: string) {
    const body = await this.request<unknown>(
      `${this.carriersBase(workspaceId)}/${code}/cities${buildQuery({ cityId })}`
    );
    return unwrapList<CarrierCity>(body, "cities");
  }

  /**
   * A courier's whole address tree, for couriers whose levels are not
   * city/district: GET /carriers/:code/cities answers `{ levels, cities }`
   * with each node's `children`. The server has no per-parent endpoint, so
   * the tree is fetched once and kept here briefly (the server caches it
   * ~1h); `listCarrierAreas` walks it.
   */
  async listCarrierAddressTree(workspaceId: string, code: string): Promise<CarrierAddressTree> {
    const key = `${workspaceId}:${code}`;
    const hit = this.addressTrees.get(key);
    if (hit && Date.now() - hit.at < ADDRESS_TREE_TTL_MS) return hit.value;
    const pending = this.request<{ levels?: string[]; cities?: CarrierAreaNode[] }>(
      `${this.carriersBase(workspaceId)}/${code}/cities`
    ).then((body) => {
      const nodes = unwrapList<CarrierAreaNode>(body, "cities");
      return { levels: Array.isArray(body.levels) ? body.levels : [], nodes };
    });
    this.addressTrees.set(key, { at: Date.now(), value: pending });
    // A failure is not remembered: the next call asks again.
    pending.catch(() => {
      if (this.addressTrees.get(key)?.value === pending) this.addressTrees.delete(key);
    });
    return pending;
  }

  /**
   * One level of a courier's address tree: the top level without
   * `parentId`, else the children of that node (by id, at any depth).
   * [] for a leaf; 404-style ApiError NOT_FOUND for an id not in the tree.
   */
  async listCarrierAreas(workspaceId: string, code: string, parentId?: string): Promise<CarrierAreaNode[]> {
    const { nodes } = await this.listCarrierAddressTree(workspaceId, code);
    if (!parentId) return nodes;
    const parent = findAreaNode(nodes, parentId);
    if (!parent) throw new ApiError("Area not found in the courier's list", 404, "NOT_FOUND");
    return parent.children ?? [];
  }

  /** Forgets the cached address trees (after a reconnect, or for tests). */
  clearCarrierAddressTrees() {
    this.addressTrees.clear();
  }

  /** Attempts, gateway events, refunds and what can still be refunded (orders.view). */
  async getPaymentTimeline(workspaceId: string, orderId: string) {
    const { timeline } = await this.request<{ timeline: PaymentTimeline }>(
      `/workspaces/${workspaceId}/orders/${orderId}/payment-timeline`
    );
    return timeline;
  }

  /** "Sync payment status": ask the gateway now (orders.manage). */
  async syncOrderPayments(workspaceId: string, orderId: string) {
    const { timeline } = await this.request<{ timeline: PaymentTimeline }>(
      `/workspaces/${workspaceId}/orders/${orderId}/payments/sync`,
      { method: "POST", body: {} }
    );
    return timeline;
  }

  /**
   * Refund (refunds.manage). Gateway-paid orders: `status` may come back
   * 'pending' (the gateway has not finished) or 'failed' (with failureReason);
   * `paymentId` picks which payment when there are several.
   */
  async refundOrder(workspaceId: string, orderId: string, body: { amount: number; reason?: string; paymentId?: string }) {
    const { refund } = await this.request<{ refund: Refund }>(`/workspaces/${workspaceId}/orders/${orderId}/refunds`, {
      method: "POST",
      body,
    });
    return refund;
  }

  // ---------------------------------------------------------------------
  // Online payments: merchant settings (owner / workspace manager only)
  // ---------------------------------------------------------------------

  private paymentsBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/payments`;
  }

  /** Always 200: check `configured` before offering to connect anything. */
  async listPaymentGateways(workspaceId: string) {
    return this.request<PaymentGatewayList>(`${this.paymentsBase(workspaceId)}/gateways`);
  }

  /** Connect, or update settings (omit `credentials` to keep the stored keys). Keys are never returned. */
  async connectPaymentGateway(workspaceId: string, code: string, payload: ConnectPaymentGatewayPayload) {
    return this.request<PaymentGatewayInfo>(`${this.paymentsBase(workspaceId)}/gateways/${code}`, {
      method: "PUT",
      body: payload,
    });
  }

  /** 409 GATEWAY_HAS_PENDING_PAYMENTS while an order still waits on a payment through it. */
  async disconnectPaymentGateway(workspaceId: string, code: string) {
    return this.request<{ disconnected: boolean }>(`${this.paymentsBase(workspaceId)}/gateways/${code}`, {
      method: "DELETE",
    });
  }

  async listPaymentMethods(workspaceId: string) {
    return this.request<PaymentMethodList>(`${this.paymentsBase(workspaceId)}/methods`);
  }

  /** The full ordered list. 422 when no available method would stay on. */
  async updatePaymentMethods(workspaceId: string, methods: Array<{ id: string; enabled: boolean }>) {
    return this.request<PaymentMethodList>(`${this.paymentsBase(workspaceId)}/methods`, {
      method: "PUT",
      body: { methods },
    });
  }

  /** A 2-hour token that shows test-mode methods on this store's own storefront. */
  async createPaymentPreviewToken(workspaceId: string) {
    return this.request<{ token: string; expiresAt: string }>(`${this.paymentsBase(workspaceId)}/preview-token`, {
      method: "POST",
      body: {},
    });
  }

  /**
   * Fetch a path with the Bearer token attached, one transparent retry after a
   * silent refresh on 401, and the standard error envelope turned into ApiError.
   * Used for non-JSON requests (binary download, multipart upload) that the
   * JSON-oriented `request()` can't express. `init.headers` must not set
   * Content-Type for a FormData body — the browser adds the multipart boundary.
   */
  private async rawFetch(path: string, init: RequestInit): Promise<Response> {
    const doFetch = () => {
      const headers = new Headers(this.defaultHeaders);
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      const { accessToken } = this.tokens;
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      return this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    };

    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) res = await doFetch();
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const message =
        (payload && (payload.message || payload.error?.message)) ||
        `Request failed with status ${res.status}`;
      const code = payload ? payload.code || payload.error?.code : undefined;
      throw new ApiError(message, res.status, code, payload);
    }
    return res;
  }

  /** Waybill is a binary PDF, not JSON — fetch it directly and return a Blob. */
  async getWaybillPdf(workspaceId: string, orderId: string): Promise<Blob> {
    const res = await this.rawFetch(`${this.ordersBase(workspaceId)}/${orderId}/waybill`, {
      headers: { Accept: "application/pdf" },
    });
    return res.blob();
  }

  /**
   * Upload one image (PNG/JPEG/GIF/WEBP, max 5MB — enforced by the backend on
   * the raw bytes). Returns the stored media object; push it onto a product's
   * `media` array and PATCH the product to attach it.
   */
  async uploadMedia(workspaceId: string, file: File | Blob): Promise<MediaUploadResponse> {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "upload");
    const res = await this.rawFetch(`/workspaces/${workspaceId}/media`, {
      method: "POST",
      body: form,
    });
    return res.json() as Promise<MediaUploadResponse>;
  }

  // ---------------------------------------------------------------------
  // Public storefront — no auth, safe to call from the server or browser
  // ---------------------------------------------------------------------

  async getStorefrontMeta(workspaceId: string) {
    const { store } = await this.request<{ store: StorefrontMeta }>(`/store/${workspaceId}`, {
      auth: false,
    });
    return store;
  }

  async listStorefrontProducts(
    workspaceId: string,
    params: { collectionId?: string; tag?: string; search?: string; limit?: number; cursor?: string } = {}
  ) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const qs = query.toString();
    return this.request<StorefrontProductList>(`/store/${workspaceId}/products${qs ? `?${qs}` : ""}`, {
      auth: false,
    });
  }

  /**
   * The searchable, filterable listing. Sends the new parameters, so the
   * backend answers with page / total / facets rather than a cursor.
   */
  async searchStorefrontProducts(workspaceId: string, params: StorefrontListingParams = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.collection) query.set("collection", params.collection);
    for (const tag of params.tags ?? []) query.append("tag", tag);
    if (params.minPrice !== undefined) query.set("minPrice", String(params.minPrice));
    if (params.maxPrice !== undefined) query.set("maxPrice", String(params.maxPrice));
    for (const [name, values] of Object.entries(params.options ?? {})) {
      for (const value of values) query.append(`option[${name}]`, value);
    }
    query.set("sort", params.sort ?? "newest");
    query.set("page", String(params.page ?? 1));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.facets) query.set("facets", "true");
    return this.request<StorefrontListing>(`/store/${workspaceId}/products?${query.toString()}`, { auth: false });
  }

  /** Suggestions for the search box, while the shopper types. */
  async suggestStorefrontProducts(workspaceId: string, q: string, init?: { signal?: AbortSignal }) {
    return this.request<StorefrontSuggestions>(
      `/store/${workspaceId}/products/suggest?q=${encodeURIComponent(q)}`,
      { auth: false, ...(init?.signal ? { signal: init.signal } : {}) }
    );
  }

  async getStorefrontProduct(workspaceId: string, idOrSlug: string) {
    const { product } = await this.request<{ product: StorefrontProductDetail }>(
      `/store/${workspaceId}/products/${idOrSlug}`,
      { auth: false }
    );
    return product;
  }

  async listStorefrontCollections(workspaceId: string) {
    const { collections } = await this.request<{ collections: StorefrontCollection[] }>(
      `/store/${workspaceId}/collections`,
      { auth: false }
    );
    return collections;
  }

  /**
   * The published content of one page of the workspace's live website, as
   * built in the merchant's website editor.
   *
   * Reads only the frozen snapshot of the published revision, so an unpublished
   * draft can never leak. Three outcomes, all normal:
   *
   *  - `page`      — render `data.page.tree` with the storefront's PageRenderer.
   *  - `redirect`  — the page moved (its path was renamed); send the visitor on.
   *  - `notFound`  — no such path, *or* this workspace has no published site at
   *                  all. The API can't tell those apart, and callers generally
   *                  don't need to.
   *
   * `path` is sent as a query parameter rather than as `/pages/:slug` so nested
   * paths ("/help/shipping") work — `:slug` only matches a single segment.
   */
  async getStorefrontPage(workspaceId: string, path = "/"): Promise<StorefrontPageResult> {
    try {
      const data = await this.request<StorefrontPageData>(
        `/store/${workspaceId}/pages?path=${encodeURIComponent(path)}`,
        { auth: false, redirect: "manual" }
      );
      return { kind: "page", data };
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.status === 404) return { kind: "notFound" };
      if (err.status >= 300 && err.status < 400) {
        const body = err.details as { redirect?: { to?: string; statusCode?: number } } | undefined;
        const to = body?.redirect?.to;
        if (typeof to === "string") {
          return { kind: "redirect", to, statusCode: body?.redirect?.statusCode ?? err.status };
        }
      }
      throw err;
    }
  }

  /**
   * Look up one order for the shopper who placed it. Both values are required
   * and both are matched inside this workspace.
   *
   * A miss is `null`, not a 404: the API answers 200 `{ result: null }` for a
   * wrong phone and an unknown order number alike, so a guesser can't learn
   * which half they got right. Callers should show one "not found" either way.
   *
   * `phone` may be local or international (`01012345678`, `201012345678`) —
   * the API normalizes it — but must be 10–15 digits with no `+` or spaces,
   * and `number` 3–40 of `[A-Za-z0-9-]`; anything else is a 422. The endpoint
   * is rate limited per phone + order number (429), not per IP.
   */
  async trackOrder(workspaceId: string, phone: string, number: string): Promise<TrackResult | null> {
    const qs = new URLSearchParams({ phone, number }).toString();
    const { result } = await this.request<{ result: TrackResult | null }>(
      `/store/${workspaceId}/orders/track?${qs}`,
      { auth: false }
    );
    return result;
  }

  // ---------------------------------------------------------------------
  // Storefront cart + guest checkout — no auth. Cart identity travels in
  // the X-Cart-Token header (never the body), always workspace-scoped. The
  // cart mutation endpoints each return the whole recomputed cart, and the
  // cart body is the object itself — not wrapped in { cart: ... }.
  // ---------------------------------------------------------------------

  /**
   * Resolve the guest's cart, creating a fresh one when `cartToken` is missing
   * or doesn't match an active cart in this workspace. Read `guestToken` off
   * the result and send it as `cartToken` on every later call.
   */
  async getOrCreateCart(workspaceId: string, cartToken?: string) {
    return this.request<Cart>(`/store/${workspaceId}/cart`, {
      method: "POST",
      body: {},
      auth: false,
      headers: cartToken ? { "X-Cart-Token": cartToken } : {},
    });
  }

  async getCart(workspaceId: string, cartToken: string) {
    return this.request<Cart>(`/store/${workspaceId}/cart`, {
      auth: false,
      headers: { "X-Cart-Token": cartToken },
    });
  }

  /**
   * `customizations` answers the product's custom fields; a photo answer is
   * the id of an upload this visitor made (uploadCustomerPhoto), so send the
   * same `visitorId` with both.
   */
  async addCartItem(
    workspaceId: string,
    cartToken: string,
    payload: {
      /** Not needed for a combo. */
      variantId?: string;
      offerId?: string;
      quantity?: number;
      customizations?: CustomizationInput;
      options?: import("./endpoints/menuOptions").MenuOptionsInput;
      /** A whole combo on one line (endpoints/combos.ts). */
      comboId?: string;
      comboSelection?: Array<{ itemId: string; variantId: string }>;
    },
    opts: { visitorId?: string } = {}
  ) {
    return this.request<Cart>(`/store/${workspaceId}/cart/items`, {
      method: "POST",
      body: payload,
      auth: false,
      headers: { "X-Cart-Token": cartToken, ...(opts.visitorId ? { "X-Visitor-Id": opts.visitorId } : {}) },
    });
  }

  /**
   * A shopper's photo for a product's image field. The server re-encodes it
   * (upright, no metadata, ≤ 5 MB) and keeps it for 48 hours unless an order
   * takes it. 413 over 15 MB, 415 for anything but JPEG / PNG / WebP, 422 when
   * it cannot be read, 429 when too many are waiting or too many were sent.
   */
  async uploadCustomerPhoto(workspaceId: string, file: File | Blob, opts: { visitorId: string; productId?: string }) {
    const form = new FormData();
    form.append("file", file, file instanceof File ? file.name : "photo");
    if (opts.productId) form.append("productId", opts.productId);
    // Multipart, so the raw path; no Content-Type here — the browser adds the boundary.
    const res = await this.rawFetch(`/store/${workspaceId}/uploads`, {
      method: "POST",
      body: form,
      headers: { "X-Visitor-Id": opts.visitorId },
    });
    const { upload } = (await res.json()) as { upload: CustomerUpload };
    return upload;
  }

  /** The active manual methods (InstaPay, a wallet) the checkout lists next to cash on delivery. */
  async getStoreManualPaymentMethods(workspaceId: string) {
    const res = await this.request<{ methods: StorefrontManualMethod[] }>(`/store/${workspaceId}/manual-payment-methods`, { auth: false });
    return res.methods;
  }

  /** The shopper's view of an order paid by a manual method; 404 for a wrong token. */
  async getShopperManualPayment(workspaceId: string, orderId: string, paymentToken: string) {
    const res = await this.request<{ manualPayment: ShopperManualPayment }>(`/store/${workspaceId}/orders/${orderId}/manual-payment`, {
      auth: false,
      headers: { "X-Payment-Token": paymentToken },
    });
    return res.manualPayment;
  }

  /**
   * The shopper's proof: the number they paid from and a screenshot (JPEG /
   * PNG / WebP, up to 15 MB). 409 while one is under review or approved.
   */
  async submitManualPaymentProof(
    workspaceId: string,
    orderId: string,
    paymentToken: string,
    { payerNumber, file }: { payerNumber: string; file: File | Blob }
  ) {
    const form = new FormData();
    form.append("payerNumber", payerNumber);
    form.append("file", file, file instanceof File ? file.name : "proof");
    const res = await this.rawFetch(`/store/${workspaceId}/orders/${orderId}/manual-payment/proof`, {
      method: "POST",
      body: form,
      headers: { "X-Payment-Token": paymentToken },
    });
    const { manualPayment } = (await res.json()) as { manualPayment: ShopperManualPayment };
    return manualPayment;
  }

  async updateCartItem(
    workspaceId: string,
    cartToken: string,
    itemId: string,
    quantity: number
  ) {
    return this.request<Cart>(`/store/${workspaceId}/cart/items/${itemId}`, {
      method: "PATCH",
      body: { quantity },
      auth: false,
      headers: { "X-Cart-Token": cartToken },
    });
  }

  async removeCartItem(workspaceId: string, cartToken: string, itemId: string) {
    return this.request<Cart>(`/store/${workspaceId}/cart/items/${itemId}`, {
      method: "DELETE",
      auth: false,
      headers: { "X-Cart-Token": cartToken },
    });
  }

  /**
   * Guest checkout (no login). Pass `cartToken` to build the order from that
   * cart's lines; omit it and put a single `item` in the payload for a "Buy
   * Now". The server replies with `{ order }` — unwrapped here like createOrder.
   */
  async checkout(
    workspaceId: string,
    payload: CheckoutPayload,
    cartToken?: string,
    opts: { visitorId?: string; shopperToken?: string | null } = {}
  ) {
    const { order } = await this.request<{ order: Order }>(`/store/${workspaceId}/checkout`, {
      method: "POST",
      body: payload,
      auth: false,
      idempotent: true,
      headers: {
        ...(cartToken ? { "X-Cart-Token": cartToken } : {}),
        // Whose uploaded photos the order may take (custom fields).
        ...(opts.visitorId ? { "X-Visitor-Id": opts.visitorId } : {}),
        // The signed-in shopper, when there is one: their points, credit, level and invite.
        ...shopperTokenHeaders(opts.shopperToken),
      },
    });
    return order;
  }

  /**
   * Checkout, full answer. For an online method the body also carries
   * `payment` (send the shopper to `payment.redirectUrl`) and `paymentToken`
   * (keep it: it is the only key to the order's payment endpoints).
   * `previewToken` (X-Store-Preview) unlocks test-mode methods.
   */
  async placeCheckout(
    workspaceId: string,
    payload: CheckoutPayload,
    opts: { cartToken?: string; previewToken?: string; visitorId?: string; shopperToken?: string | null } = {}
  ) {
    // The signed-in shopper, when there is one: their level and invite price the order.
    const headers: Record<string, string> = { ...shopperTokenHeaders(opts.shopperToken) };
    if (opts.cartToken) headers["X-Cart-Token"] = opts.cartToken;
    if (opts.previewToken) headers["X-Store-Preview"] = opts.previewToken;
    // Whose uploaded photos the order may take (custom fields).
    if (opts.visitorId) headers["X-Visitor-Id"] = opts.visitorId;
    return this.request<CheckoutResult>(`/store/${workspaceId}/checkout`, {
      method: "POST",
      body: payload,
      auth: false,
      idempotent: true,
      headers,
    });
  }

  /** The methods the checkout offers (always at least cash on delivery). */
  async getStorefrontPaymentMethods(workspaceId: string, previewToken?: string) {
    return this.request<{ methods: StorefrontPaymentMethod[]; preview: boolean }>(
      `/store/${workspaceId}/payment-methods`,
      { auth: false, headers: previewToken ? { "X-Store-Preview": previewToken } : {} }
    );
  }

  private shopperPaymentHeaders(paymentToken: string, previewToken?: string) {
    const headers: Record<string, string> = { "X-Payment-Token": paymentToken };
    if (previewToken) headers["X-Store-Preview"] = previewToken;
    return headers;
  }

  /** An unpaid online order, for the shopper. `refresh` asks the gateway (throttled server-side). */
  async getOrderPayment(
    workspaceId: string,
    orderId: string,
    paymentToken: string,
    opts: { refresh?: boolean; previewToken?: string } = {}
  ) {
    const { payment } = await this.request<{ payment: ShopperPaymentStatus }>(
      `/store/${workspaceId}/orders/${orderId}/payment${opts.refresh ? "?refresh=1" : ""}`,
      { auth: false, headers: this.shopperPaymentHeaders(paymentToken, opts.previewToken) }
    );
    return payment;
  }

  /** The shopper is back from the gateway: forward its query string, signed or not. */
  async returnFromPayment(
    workspaceId: string,
    orderId: string,
    paymentToken: string,
    query: Record<string, string>,
    previewToken?: string
  ) {
    const { payment } = await this.request<{ payment: ShopperPaymentStatus }>(
      `/store/${workspaceId}/orders/${orderId}/payment/return`,
      { method: "POST", body: { query }, auth: false, headers: this.shopperPaymentHeaders(paymentToken, previewToken) }
    );
    return payment;
  }

  async retryOrderPayment(
    workspaceId: string,
    orderId: string,
    paymentToken: string,
    body: { paymentMethod?: "card" | "wallet"; paymentProvider?: string; returnUrl?: string },
    previewToken?: string
  ) {
    const { payment } = await this.request<{ payment: ShopperPaymentStatus }>(
      `/store/${workspaceId}/orders/${orderId}/payment/retry`,
      { method: "POST", body, auth: false, headers: this.shopperPaymentHeaders(paymentToken, previewToken) }
    );
    return payment;
  }

  /**
   * A store may want the phone verified first: 428 OTP_REQUIRED (details:
   * CheckoutOtpChallenge) and a code is sent to the order's phone; send it
   * back here as `otpCode`. 422 INVALID_CODE / EXPIRED, 429 TOO_MANY_ATTEMPTS.
   */
  async switchOrderToCod(workspaceId: string, orderId: string, paymentToken: string, previewToken?: string, otpCode?: string) {
    const { payment } = await this.request<{ payment: ShopperPaymentStatus }>(
      `/store/${workspaceId}/orders/${orderId}/payment/switch-to-cod`,
      { method: "POST", body: otpCode ? { otpCode } : {}, auth: false, headers: this.shopperPaymentHeaders(paymentToken, previewToken) }
    );
    return payment;
  }

  /**
   * The shipping line a checkout would get (no auth). Send `items`, or omit
   * them and pass `cartToken` to quote that cart. Read-only.
   */
  async getShippingQuote(workspaceId: string, payload: ShippingQuotePayload, cartToken?: string) {
    const { quote } = await this.request<{ quote: ShippingQuote }>(`/store/${workspaceId}/shipping-quote`, {
      method: "POST",
      body: payload,
      auth: false,
      headers: cartToken ? { "X-Cart-Token": cartToken } : {},
    });
    return quote;
  }

  /**
   * Checkout-form autosave for abandoned-checkout recovery (no auth). An
   * upsert keyed on `visitorId`, so replays are harmless. Returns the session
   * id to send as `checkoutSessionId` with the order. Callers treat a failure
   * as silent — it must never block the checkout.
   */
  async captureCheckoutSession(workspaceId: string, payload: CaptureCheckoutSessionPayload) {
    const { session } = await this.request<{ session: { id: string } }>(
      `/store/${workspaceId}/checkout-sessions`,
      { method: "POST", body: payload, auth: false }
    );
    return session;
  }

  // ---------------------------------------------------------------------
  // Store analytics — /workspaces/:ws/analytics/* (analytics.view)
  // Computed on every call (orders, funnel sessions and the storefront's
  // own events), so a wide range is a slower request, not a cached one.
  // ---------------------------------------------------------------------

  async getAnalyticsSummary(workspaceId: string, params: AnalyticsSummaryParams = {}) {
    const { summary } = await this.request<{ summary: AnalyticsSummary }>(
      `/workspaces/${workspaceId}/analytics/summary${buildQuery({ ...params })}`
    );
    return summary;
  }

  // Funnel analytics — every funnel's sessions, orders and revenue for a
  // range, and one funnel's step-by-step drop-off, sources and daily series.
  async getFunnelAnalytics(workspaceId: string, params: AnalyticsSummaryParams = {}) {
    return this.request<FunnelAnalyticsOverview>(
      `/workspaces/${workspaceId}/analytics/funnels${buildQuery({ ...params })}`
    );
  }

  async getFunnelAnalyticsDetail(workspaceId: string, funnelId: string, params: AnalyticsSummaryParams = {}) {
    return this.request<FunnelAnalyticsDetail>(
      `/workspaces/${workspaceId}/analytics/funnels/${funnelId}${buildQuery({ ...params })}`
    );
  }

  // Web analytics — Umami-style stats over the store's own page views.
  private webAnalyticsBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/analytics/web`;
  }

  async getWebAnalyticsStats(workspaceId: string, params: WebAnalyticsRangeParams = {}) {
    return this.request<WebAnalyticsStats>(`${this.webAnalyticsBase(workspaceId)}/stats${buildQuery({ ...params })}`);
  }

  async getWebAnalyticsSeries(workspaceId: string, params: WebAnalyticsRangeParams = {}) {
    return this.request<WebAnalyticsSeries>(`${this.webAnalyticsBase(workspaceId)}/series${buildQuery({ ...params })}`);
  }

  async getWebAnalyticsMetrics(
    workspaceId: string,
    type: WebAnalyticsMetricType,
    params: WebAnalyticsRangeParams & { limit?: number } = {}
  ) {
    return this.request<WebAnalyticsMetrics>(
      `${this.webAnalyticsBase(workspaceId)}/metrics${buildQuery({ ...params, type })}`
    );
  }

  async getWebAnalyticsWeekly(workspaceId: string, params: WebAnalyticsRangeParams = {}) {
    return this.request<WebAnalyticsWeekly>(`${this.webAnalyticsBase(workspaceId)}/weekly${buildQuery({ ...params })}`);
  }

  async getWebAnalyticsRealtime(workspaceId: string, params: { tz?: string } = {}) {
    return this.request<WebAnalyticsRealtime>(`${this.webAnalyticsBase(workspaceId)}/realtime${buildQuery({ ...params })}`);
  }

  // ---------------------------------------------------------------------
  // Website templates — public catalogue
  // Unlike every other method in this file these take no workspaceId and
  // send no Authorization header: the endpoints live at /api/v1/templates
  // and are open to anonymous callers, so they pass `auth: false`.
  // ---------------------------------------------------------------------

  async listWebsiteTemplates() {
    const { templates } = await this.request<{ templates: WebsiteTemplateSummary[] }>("/templates", {
      auth: false,
    });
    return templates;
  }

  async getWebsiteTemplate(id: string) {
    const { template } = await this.request<{ template: WebsiteTemplateDetail }>(
      `/templates/${id}`,
      { auth: false }
    );
    return template;
  }


  async getSettlementSummary(workspaceId: string) {
    const { summary } = await this.request<{ summary: SettlementSummary }>(
      `/workspaces/${workspaceId}/settlements/summary`
    );
    return summary;
  }

  /** Delivered COD orders with money still due, grouped by delivering carrier. */
  async listUnsettledOrders(workspaceId: string, params: { carrierCode?: string } = {}) {
    return this.request<UnsettledResponse>(
      `/workspaces/${workspaceId}/settlements/unsettled${buildQuery({ ...params })}`
    );
  }

  async listSettlements(
    workspaceId: string,
    params: { status?: SettlementStatus; limit?: number; before?: string } = {}
  ) {
    return this.request<SettlementListResponse>(
      `/workspaces/${workspaceId}/settlements${buildQuery({ ...params })}`
    );
  }

  async getSettlement(workspaceId: string, settlementId: string) {
    const { settlement } = await this.request<{ settlement: SettlementDetail }>(
      `/workspaces/${workspaceId}/settlements/${settlementId}`
    );
    return settlement;
  }

  /** 422 ORDER_NOT_SETTLEABLE / DUPLICATE_ORDER / COLLECTED_EXCEEDS_DUE. */
  async createSettlement(workspaceId: string, payload: CreateSettlementPayload) {
    const { settlement } = await this.request<{ settlement: SettlementDetail }>(
      `/workspaces/${workspaceId}/settlements`,
      { method: "POST", body: payload }
    );
    return settlement;
  }

  /** Drafts only — 409 SETTLEMENT_CONFIRMED once it has been confirmed. */
  async updateSettlement(
    workspaceId: string,
    settlementId: string,
    payload: UpdateSettlementPayload
  ) {
    const { settlement } = await this.request<{ settlement: SettlementDetail }>(
      `/workspaces/${workspaceId}/settlements/${settlementId}`,
      { method: "PATCH", body: payload }
    );
    return settlement;
  }

  /** Drafts only — 409 SETTLEMENT_CONFIRMED. */
  async deleteSettlement(workspaceId: string, settlementId: string) {
    return this.request<{ deleted: boolean; id: string }>(
      `/workspaces/${workspaceId}/settlements/${settlementId}`,
      { method: "DELETE" }
    );
  }

  /**
   * Irreversible: records a captured COD payment on every order in the
   * settlement, moves each to paid / partially_paid, and locks the row.
   * 422 SETTLEMENT_EMPTY when it has no lines.
   */
  async confirmSettlement(workspaceId: string, settlementId: string) {
    const { settlement } = await this.request<{ settlement: SettlementDetail }>(
      `/workspaces/${workspaceId}/settlements/${settlementId}/confirm`,
      { method: "POST" }
    );
    return settlement;
  }

  /** Answers `{ connected: false }` when the workspace has no integration. */
  async getWhatsappIntegration(workspaceId: string) {
    const { integration } = await this.request<{ integration: WhatsappIntegration }>(
      `/workspaces/${workspaceId}/whatsapp/integration`
    );
    return integration;
  }

  /**
   * Verifies the credentials with Meta before storing them, so this is slow
   * and can fail on Meta's side: 422 WHATSAPP_AUTH_FAILED / WHATSAPP_API_ERROR,
   * 502 WHATSAPP_UNREACHABLE. 422 WHATSAPP_APP_SECRET_REQUIRED without an App
   * Secret given or saved; 403 PLAN_FEATURE_REQUIRED for a first connection on
   * a plan without whatsapp_confirmation (the plan gate on). Needs workspace:manage.
   */
  async connectWhatsapp(workspaceId: string, payload: ConnectWhatsappPayload) {
    const { integration } = await this.request<{ integration: WhatsappIntegration }>(
      `/workspaces/${workspaceId}/whatsapp/integration`,
      { method: "PUT", body: payload }
    );
    return integration;
  }

  /** Drops the credentials. Stored conversations and messages are kept. */
  async disconnectWhatsapp(workspaceId: string) {
    return this.request<{ disconnected: boolean }>(
      `/workspaces/${workspaceId}/whatsapp/integration`,
      { method: "DELETE" }
    );
  }

  async listWhatsappConversations(
    workspaceId: string,
    params: WhatsappConversationListParams = {}
  ) {
    return this.request<WhatsappConversationListResponse>(
      `/workspaces/${workspaceId}/whatsapp/conversations${buildQuery({ ...params })}`
    );
  }

  /** Oldest -> newest. Reading a conversation also marks it read server-side. */
  async listWhatsappMessages(
    workspaceId: string,
    conversationId: string,
    params: { limit?: number; before?: string } = {}
  ) {
    return this.request<WhatsappMessageListResponse>(
      `/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}/messages${buildQuery({ ...params })}`
    );
  }

  async setWhatsappConversationStatus(
    workspaceId: string,
    conversationId: string,
    status: WhatsappConversationStatus
  ) {
    const { conversation } = await this.request<{
      conversation: { id: string; status: WhatsappConversationStatus };
    }>(`/workspaces/${workspaceId}/whatsapp/conversations/${conversationId}`, {
      method: "PATCH",
      body: { status },
    });
    return conversation;
  }

  /**
   * 422 WHATSAPP_WINDOW_CLOSED when free text is sent more than 24h after the
   * customer's last message — send an approved template instead. Also 422
   * WHATSAPP_NOT_CONNECTED and INVALID_PHONE.
   */
  async sendWhatsappMessage(workspaceId: string, payload: SendWhatsappPayload) {
    const { message } = await this.request<{ message: SentWhatsappMessage }>(
      `/workspaces/${workspaceId}/whatsapp/messages`,
      { method: "POST", body: payload }
    );
    return message;
  }

  /** Rules plus the server's trigger and token vocabularies. */
  async listAutomations(workspaceId: string) {
    return this.request<AutomationListResponse>(`/workspaces/${workspaceId}/automations`);
  }

  async createAutomation(workspaceId: string, payload: AutomationRulePayload) {
    const { rule } = await this.request<{ rule: AutomationRule }>(
      `/workspaces/${workspaceId}/automations`,
      { method: "POST", body: payload }
    );
    return rule;
  }

  async updateAutomation(
    workspaceId: string,
    ruleId: string,
    payload: Partial<AutomationRulePayload>
  ) {
    const { rule } = await this.request<{ rule: AutomationRule }>(
      `/workspaces/${workspaceId}/automations/${ruleId}`,
      { method: "PATCH", body: payload }
    );
    return rule;
  }

  /** The rule's past runs stay in the log. */
  async deleteAutomation(workspaceId: string, ruleId: string) {
    return this.request<{ deleted: boolean; id: string }>(
      `/workspaces/${workspaceId}/automations/${ruleId}`,
      { method: "DELETE" }
    );
  }

  async listAutomationRuns(workspaceId: string, params: AutomationRunListParams = {}) {
    return this.request<AutomationRunListResponse>(
      `/workspaces/${workspaceId}/automations/runs${buildQuery({ ...params })}`
    );
  }

  /** Partial merge: omitted keys keep their stored value, `null` clears one. */
  async updateWorkspaceSettings(workspaceId: string, settings: UpdateWorkspaceSettingsPayload) {
    const { workspace } = await this.request<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}`,
      { method: "PATCH", body: { settings } }
    );
    return workspace;
  }

  /** Newest first. */
  async listMedia(workspaceId: string, params: MediaListParams = {}) {
    return this.request<MediaListResponse>(
      `/workspaces/${workspaceId}/media${buildQuery({ ...params })}`
    );
  }

  /** Removes the asset from the library. */
  async deleteMedia(workspaceId: string, mediaId: string) {
    return this.request<{ deleted: boolean; id: string }>(
      `/workspaces/${workspaceId}/media/${mediaId}`,
      { method: "DELETE" }
    );
  }

  /** The columns a file can carry, and the default set for each row mode. */
  async getOrderExportColumns(workspaceId: string) {
    return this.request<OrderExportCatalogue>(`${this.ordersBase(workspaceId)}/export/columns`);
  }

  /** The file itself (UTF-8 with a BOM, so Excel reads Arabic). */
  async exportOrdersCsv(workspaceId: string, params: OrderExportParams = {}): Promise<Blob> {
    const { columns, ...rest } = params;
    const query = buildQuery({ ...rest, columns: columns && columns.length > 0 ? columns.join(",") : undefined });
    const res = await this.rawFetch(`${this.ordersBase(workspaceId)}/export${query}`, {
      headers: { Accept: "text/csv" },
    });
    return res.blob();
  }
}
