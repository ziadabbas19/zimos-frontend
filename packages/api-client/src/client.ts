import { createLocalStorageTokenStorage, type TokenStorage } from "./tokenStorage";
import type {
  AddCustomerAddressPayload,
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminAuditEntry,
  AdminAuditLogPage,
  AdminAuditLogParams,
  AdminFeatureFlag,
  AdminFeatureFlagInput,
  AdminOverview,
  AdminPlan,
  AdminPlanInput,
  AdminServiceReport,
  AdminServiceTile,
  AdminSubscription,
  AdminWorkspaceOverview,
  ArchivedResponse,
  AuthTokens,
  AuthUser,
  BlacklistPayload,
  BlocklistEntry,
  BlockPhonePayload,
  BlockPhoneResult,
  CaptureCheckoutSessionPayload,
  CarrierCity,
  CarrierList,
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
  ConfirmationQueueCounts,
  ConfirmationQueuePage,
  ConfirmationQueueTab,
  ConfirmationTask,
  CorrectConfirmationOutcomePayload,
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

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class ApiClient {
  private baseUrl: string;
  private tokenStorage: TokenStorage;
  private onSessionExpired?: () => void;
  private defaultHeaders: Record<string, string>;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tokenStorage = options.tokenStorage ?? createLocalStorageTokenStorage();
    this.onSessionExpired = options.onSessionExpired;
    this.defaultHeaders = options.defaultHeaders ?? {};
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
        "Content-Type": "application/json",
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
      return fetch(`${this.baseUrl}${path}`, {
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

  private async tryRefresh(): Promise<boolean> {
    const { refreshToken } = this.tokenStorage.get();
    if (!refreshToken) return false;

    // Coalesce concurrent 401s into a single refresh call.
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const result = await this.request<AuthTokens>("/auth/refresh", {
            method: "POST",
            body: { refreshToken },
            auth: false,
          });
          this.setTokens(result);
          return true;
        } catch {
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

  async register(payload: RegisterPayload) {
    return this.request<{ user: AuthUser }>("/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
    });
  }

  async login(payload: LoginPayload) {
    const result = await this.request<AuthTokens & { user: AuthUser }>("/auth/login", {
      method: "POST",
      body: payload,
      auth: false,
    });
    this.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  }

  /**
   * Kick off a password reset. The backend deliberately answers with the same
   * `{ success: true }` whether or not the address is registered (account
   * enumeration guard), so a resolved call just means "show the check-your-inbox
   * notice" — it is not a signal that the email exists.
   */
  async requestPasswordReset(email: string) {
    return this.request<{ success: boolean }>("/auth/password-reset/request", {
      method: "POST",
      body: { email },
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

  async me() {
    const { user } = await this.request<{ user: AuthUser }>("/auth/me");
    return user;
  }

  // ---------------------------------------------------------------------
  // Workspaces
  // ---------------------------------------------------------------------

  async listWorkspaces() {
    // The API returns { workspaces: [{ workspace, role }] } — flatten to
    // Workspace[] with the role key attached.
    const { workspaces } = await this.request<{
      workspaces: Array<{ workspace: Workspace; role?: { key: string; name: string } }>;
    }>("/workspaces");
    return workspaces.map((entry) => ({ ...entry.workspace, role: entry.role?.key }));
  }

  async createWorkspace(name: string) {
    const { workspace } = await this.request<{ workspace: Workspace }>("/workspaces", {
      method: "POST",
      body: { name },
    });
    return workspace;
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
  // Platform admin
  // ---------------------------------------------------------------------

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
      const res = await fetch(`${this.rootUrl}${path}`, {
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

  async cancelOrder(workspaceId: string, orderId: string, reason: string) {
    const { order } = await this.request<{ order: Order }>(
      `${this.ordersBase(workspaceId)}/${orderId}/cancel`,
      { method: "POST", body: { reason } }
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

  async createShipment(workspaceId: string, orderId: string, payload: CreateShipmentPayload) {
    const { shipment } = await this.request<{ shipment: Shipment }>(
      `${this.ordersBase(workspaceId)}/${orderId}/shipments`,
      { method: "POST", body: payload }
    );
    return shipment;
  }

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

  async moderateReview(workspaceId: string, reviewId: string, action: "approve" | "reject") {
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

  async listConfirmationQueue(
    workspaceId: string,
    params: { status?: ConfirmationQueueTab; mine?: boolean; cursor?: string; limit?: number } = {}
  ) {
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
  async confirmOrder(workspaceId: string, orderId: string, notes?: string) {
    return this.request<{ order: Order; task: ConfirmationTask }>(
      `${this.ordersBase(workspaceId)}/${orderId}/confirmation`,
      { method: "POST", body: notes ? { notes } : {} }
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
   */
  async listCarrierCities(workspaceId: string, code: string, cityId?: string) {
    const body = await this.request<unknown>(
      `${this.carriersBase(workspaceId)}/${code}/cities${buildQuery({ cityId })}`
    );
    return unwrapList<CarrierCity>(body, "cities");
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
      return fetch(`${this.baseUrl}${path}`, { ...init, headers });
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

  async addCartItem(
    workspaceId: string,
    cartToken: string,
    payload: { variantId: string; offerId?: string; quantity?: number }
  ) {
    return this.request<Cart>(`/store/${workspaceId}/cart/items`, {
      method: "POST",
      body: payload,
      auth: false,
      headers: { "X-Cart-Token": cartToken },
    });
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
  async checkout(workspaceId: string, payload: CheckoutPayload, cartToken?: string) {
    const { order } = await this.request<{ order: Order }>(`/store/${workspaceId}/checkout`, {
      method: "POST",
      body: payload,
      auth: false,
      idempotent: true,
      headers: cartToken ? { "X-Cart-Token": cartToken } : {},
    });
    return order;
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
}
