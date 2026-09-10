import { createLocalStorageTokenStorage, type TokenStorage } from "./tokenStorage";
import type {
  AddCustomerAddressPayload,
  ArchivedResponse,
  AuthTokens,
  AuthUser,
  BlacklistPayload,
  Cart,
  CheckoutPayload,
  CollectionDetail,
  CollectionSummary,
  ConfirmationTask,
  ConfirmationTaskStatus,
  CreateCollectionPayload,
  CreateDiscountPayload,
  CreateOfferPayload,
  CreateOrderPayload,
  CreateProductPayload,
  CreateReturnPayload,
  CreateShipmentPayload,
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
  InviteMemberPayload,
  LoginPayload,
  MediaUploadResponse,
  Membership,
  Offer,
  Order,
  OrderListParams,
  OrderListResponse,
  Product,
  ProductListParams,
  ProductListResponse,
  RecordConfirmationOutcomePayload,
  RegisterPayload,
  ReturnListParams,
  ReturnRequest,
  Shipment,
  ShippingRate,
  ShippingZone,
  StorefrontCollection,
  StorefrontMeta,
  StorefrontProductDetail,
  StorefrontProductList,
  SuccessResponse,
  TaxRate,
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

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClientOptions {
  /** e.g. http://localhost:4000/api/v1 */
  baseUrl: string;
  tokenStorage?: TokenStorage;
  /** Called whenever refresh fails / the session becomes invalid. */
  onSessionExpired?: () => void;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // attach Authorization header (default true)
  idempotent?: boolean; // attach a fresh Idempotency-Key header
  signal?: AbortSignal;
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
  private refreshPromise: Promise<boolean> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tokenStorage = options.tokenStorage ?? createLocalStorageTokenStorage();
    this.onSessionExpired = options.onSessionExpired;
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
    const { method = "GET", body, headers = {}, auth = true, idempotent = false, signal } = opts;

    const doFetch = async (): Promise<Response> => {
      const finalHeaders: Record<string, string> = {
        "Content-Type": "application/json",
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
      throw new ApiError(message, res.status, code, payload);
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
    return this.request<Workspace[]>("/admin/workspaces");
  }

  // ---------------------------------------------------------------------
  // Catalog — products, variants, offers, collections
  // (/workspaces/:workspaceId/catalog/...)
  // ---------------------------------------------------------------------

  private catalogBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/catalog`;
  }

  async listProducts(workspaceId: string, params: ProductListParams = {}) {
    return this.request<ProductListResponse>(
      `${this.catalogBase(workspaceId)}/products${buildQuery({ ...params })}`
    );
  }

  async getProduct(workspaceId: string, productId: string) {
    const { product } = await this.request<{ product: Product }>(
      `${this.catalogBase(workspaceId)}/products/${productId}`
    );
    return product;
  }

  async createProduct(workspaceId: string, payload: CreateProductPayload) {
    const { product } = await this.request<{ product: Product }>(
      `${this.catalogBase(workspaceId)}/products`,
      { method: "POST", body: payload }
    );
    return product;
  }

  async updateProduct(workspaceId: string, productId: string, payload: UpdateProductPayload) {
    const { product } = await this.request<{ product: Product }>(
      `${this.catalogBase(workspaceId)}/products/${productId}`,
      { method: "PATCH", body: payload }
    );
    return product;
  }

  async deleteProduct(workspaceId: string, productId: string) {
    return this.request<ArchivedResponse>(
      `${this.catalogBase(workspaceId)}/products/${productId}`,
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
  // Confirmation queue (auth, /workspaces/:workspaceId/confirmation-tasks/...)
  // `listConfirmationQueue` returns the tasks still needing a call; `claim`
  // locks one to the current user; `recordConfirmationOutcome` closes it.
  // Every response is unwrapped to the row(s) the caller wants.
  // ---------------------------------------------------------------------

  private confirmationTasksBase(workspaceId: string) {
    return `/workspaces/${workspaceId}/confirmation-tasks`;
  }

  async listConfirmationQueue(
    workspaceId: string,
    params: { status?: ConfirmationTaskStatus; limit?: number } = {}
  ) {
    const { tasks } = await this.request<{ tasks: ConfirmationTask[] }>(
      `${this.confirmationTasksBase(workspaceId)}${buildQuery({ ...params })}`
    );
    return tasks;
  }

  async claimConfirmationTask(workspaceId: string, taskId: string) {
    const { task } = await this.request<{ task: ConfirmationTask }>(
      `${this.confirmationTasksBase(workspaceId)}/${taskId}/claim`,
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

  /**
   * Fetch a path with the Bearer token attached, one transparent retry after a
   * silent refresh on 401, and the standard error envelope turned into ApiError.
   * Used for non-JSON requests (binary download, multipart upload) that the
   * JSON-oriented `request()` can't express. `init.headers` must not set
   * Content-Type for a FormData body — the browser adds the multipart boundary.
   */
  private async rawFetch(path: string, init: RequestInit): Promise<Response> {
    const doFetch = () => {
      const headers = new Headers(init.headers);
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
