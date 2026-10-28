/**
 * Real platform-admin API.
 *
 * Every function here maps 1:1 onto a live `/api/v1/admin/...` endpoint. There
 * is no local persistence and no fallback data: when a call fails the error
 * propagates so the page can show it. Anything the backend does not implement
 * is absent from this module rather than simulated; those console areas render
 * `<ComingLater />` and show no data at all.
 */
import type {
  WalletConsoleEntryResult,
  WalletRefundBreakdown,
  WalletRefundStatus,
  AdminWalletRefundPage,
  WalletLedgerPage,
  WalletSummary,
  AdminPaymentMethod,
  AdminPaymentMethods,
  AdminPaymentProofPage,
  AdminPaymentProofReview,
  AdminCharge,
  AdminSpecialTerm,
  AdminSpecialTermsInput,
  AdminStoreAccess,
  AdminRecordPaymentResult,
  AdminReversePaymentResult,
  AdminVoidChargeResult,
  AdminWorkspaceCharges,
  AdminAgentDetail,
  AdminAgentList,
  AdminCommission,
  AdminCommissionPage,
  AdminCommissionParams,
  AdminCreateAgentResult,
  AdminGrantPayload,
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
  AdminRolesResponse,
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminAttentionItem,
  AdminAuditLogPage,
  AdminAuditLogParams,
  AdminBlocklistEntry,
  AdminBlocklistPage,
  AdminBlocklistParams,
  AdminBlocklistUpdate,
  AdminBlockPayload,
  AdminBlockResult,
  AdminCarrierRegistry,
  AdminChartPoint,
  AdminFeatureFlag,
  AdminFeatureFlagInput,
  AdminGrantResult,
  AdminOverview,
  AdminPlan,
  AdminPlansWithCatalog,
  AdminPaymentGatewayRegistry,
  AdminPlanInput,
  AdminPlatformAdmin,
  AdminProviderCheck,
  AdminRiskSignalPage,
  AdminRiskSignalParams,
  AdminServiceReport,
  AdminSupportTicket,
  AdminSupportTicketMessage,
  AdminSupportTicketPage,
  AdminSupportTicketParams,
  AdminSupportTicketThread,
  SupportTicketPriority,
  SupportTicketStatus,
  AdminTemplate,
  AdminTemplateDetail,
  AdminTemplateInput,
  AdminTemplateKind,
  AdminTemplateVersion,
  AdminTemplateVersionInput,
  AdminTemplateVersionSummary,
  AdminServiceStatus,
  AdminServiceTile,
  AdminSubscription,
  AdminWorkspaceOverview,
  AdminUserDetail,
  AdminUserSearchPage,
  HealthProbeResult,
} from "@store-builder/api-client";
import { apiClient } from "./apiClient";
import { ApiError, getErrorMessage } from "./errors";
import { PLATFORM_CURRENCY } from "./format";

/**
 * A workspace overview row joined to its full subscription record.
 *
 * `workspace` already carries a flattened billing summary and the lifetime
 * order count; `subscription` adds the fields only the subscriptions endpoint
 * has (MRR, period start, grace, cancel-at-period-end) and is null when the
 * workspace has never subscribed.
 */
export interface AdminWorkspaceRow {
  workspace: AdminWorkspaceOverview;
  subscription: AdminSubscriptionRow | null;
}

/**
 * A subscription with its plan's currency attached. `mrr` is in the plan's
 * currency, which the subscriptions endpoint doesn't include, so it is looked
 * up from the plan list rather than assumed.
 */
export interface AdminSubscriptionRow extends AdminSubscription {
  currency: string;
}

async function planCurrencies(): Promise<Map<string, string>> {
  const plans = await apiClient.adminListPlans().catch(() => [] as AdminPlan[]);
  return new Map(plans.map((p) => [p.id, p.currency]));
}

function withCurrency(
  subscriptions: AdminSubscription[],
  currencies: Map<string, string>
): AdminSubscriptionRow[] {
  return subscriptions.map((s) => ({
    ...s,
    currency: currencies.get(s.planId) ?? PLATFORM_CURRENCY,
  }));
}

// ------------------------------------------------------------------ workspaces

/**
 * `GET /admin/workspaces` + `GET /admin/subscriptions`, joined on workspaceId.
 *
 * The subscriptions call is allowed to fail on its own: the workspace list is
 * still worth showing without billing columns, so a rejection here degrades to
 * `subscription: null` rather than failing the whole page.
 */
export async function listWorkspaceRows(): Promise<AdminWorkspaceRow[]> {
  const [workspaces, subscriptions, currencies] = await Promise.all([
    apiClient.adminListWorkspaces(),
    apiClient.adminListSubscriptions().catch(() => [] as AdminSubscription[]),
    planCurrencies(),
  ]);

  const byWorkspace = new Map<string, AdminSubscriptionRow>();
  for (const sub of withCurrency(subscriptions, currencies)) {
    // Newest first from the API, so the first one seen is the current record.
    if (!byWorkspace.has(sub.workspaceId)) byWorkspace.set(sub.workspaceId, sub);
  }

  return workspaces.map((workspace) => ({
    workspace,
    subscription: byWorkspace.get(workspace.id) ?? null,
  }));
}

/**
 * Name/address search over the workspace list. The endpoint takes no `search`
 * parameter, so the filtering happens here over the full list.
 */
export async function searchWorkspaces(query: string, limit = 8): Promise<AdminWorkspaceRow[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rows = await listWorkspaceRows();
  return rows
    .filter(
      ({ workspace }) =>
        workspace.name.toLowerCase().includes(q) || workspace.slug.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export async function getWorkspaceRow(workspaceId: string): Promise<AdminWorkspaceRow | null> {
  const rows = await listWorkspaceRows();
  return rows.find((r) => r.workspace.id === workspaceId) ?? null;
}

// ----------------------------------------------------------------------- users

/** `GET /admin/users` — name, username, email, id or a store of theirs. Deleted accounts only with includeDeleted. */
export function searchUsers(params: { q?: string; page?: number; limit?: number; includeDeleted?: boolean }): Promise<AdminUserSearchPage> {
  return apiClient.adminSearchUsers(params);
}

export function getUser(userId: string): Promise<AdminUserDetail> {
  return apiClient.adminGetUser(userId);
}

export function suspendUser(userId: string, reason: string) {
  return apiClient.adminSuspendUser(userId, reason);
}

export function unsuspendUser(userId: string, reason?: string) {
  return apiClient.adminUnsuspendUser(userId, reason);
}

export function deleteUser(userId: string, body: { reason?: string; stores?: "suspend" }) {
  return apiClient.adminDeleteUser(userId, body);
}

// ----------------------------------------------------------------------- plans

export function listPlans(): Promise<AdminPlan[]> {
  return apiClient.adminListPlans();
}

/** The plans in the pricing page's order, with the backend's feature catalogue. */
export function listPlansWithCatalog(): Promise<AdminPlansWithCatalog> {
  return apiClient.adminListPlansWithCatalog();
}

export function savePlan(input: AdminPlanInput): Promise<AdminPlan> {
  return apiClient.adminSavePlan(input);
}

export async function deletePlan(planId: string): Promise<void> {
  await apiClient.adminDeletePlan(planId);
}

// --------------------------------------------------------------- subscriptions

export async function listSubscriptions(
  params: { status?: string } = {}
): Promise<AdminSubscriptionRow[]> {
  const [subscriptions, currencies] = await Promise.all([
    apiClient.adminListSubscriptions(params),
    planCurrencies(),
  ]);
  return withCurrency(subscriptions, currencies);
}

// -------------------------------------------------------------- feature flags

export function listFlags(): Promise<AdminFeatureFlag[]> {
  return apiClient.adminListFeatureFlags();
}

export function saveFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
  return apiClient.adminSaveFeatureFlag(input);
}

export async function deleteFlag(flagId: string): Promise<void> {
  await apiClient.adminDeleteFeatureFlag(flagId);
}

// -------------------------------------------------------------- announcements

export function listAnnouncements(): Promise<AdminAnnouncement[]> {
  return apiClient.adminListAnnouncements();
}

export function saveAnnouncement(input: AdminAnnouncementInput): Promise<AdminAnnouncement> {
  return apiClient.adminSaveAnnouncement(input);
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await apiClient.adminDeleteAnnouncement(announcementId);
}

// ------------------------------------------------------------------ audit log

/**
 * How many entries a single audit-log view asks for.
 *
 * The log is append-only and unbounded, so the page fetches a window rather
 * than the whole table. This is exactly the endpoint's hard ceiling: asking
 * for more is rejected as a 422, not clamped, so raising it here needs the
 * server's cap raised in the same change.
 *
 * How full the window is no longer implies anything — the response carries a
 * `total` for the whole match set, so the page states the real count instead
 * of inferring "there must be more" from a page that came back full.
 */
export const AUDIT_PAGE_SIZE = 200;

/**
 * One window of the audit log, filtered server-side.
 *
 * Every filter in `params` is applied by the endpoint, so the rows that come
 * back need no further narrowing here. Note `workspaceId` and `actorUserId`
 * must be UUIDs — the endpoint validates them and answers 422 on free text.
 */
export function listAuditLog(params: AdminAuditLogParams = {}): Promise<AdminAuditLogPage> {
  return apiClient.adminListAuditLog({ limit: AUDIT_PAGE_SIZE, ...params });
}

// ------------------------------------------------------------------ templates

export function listTemplates(params: { kind?: AdminTemplateKind } = {}): Promise<AdminTemplate[]> {
  return apiClient.adminListTemplates(params);
}

export function getTemplate(templateId: string): Promise<AdminTemplateDetail> {
  return apiClient.adminGetTemplate(templateId);
}

export function saveTemplate(input: AdminTemplateInput): Promise<AdminTemplate> {
  return apiClient.adminSaveTemplate(input);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await apiClient.adminDeleteTemplate(templateId);
}

export function setTemplatePublished(templateId: string, published: boolean): Promise<AdminTemplate> {
  return apiClient.adminSetTemplatePublished(templateId, published);
}

export function getTemplateVersion(templateId: string, versionId: string): Promise<AdminTemplateVersion> {
  return apiClient.adminGetTemplateVersion(templateId, versionId);
}

export function createTemplateVersion(
  templateId: string,
  input: AdminTemplateVersionInput
): Promise<AdminTemplateVersionSummary> {
  return apiClient.adminCreateTemplateVersion(templateId, input);
}

export function setTemplateVersionActive(
  templateId: string,
  versionId: string,
  isActive: boolean
): Promise<AdminTemplateVersionSummary> {
  return apiClient.adminSetTemplateVersionActive(templateId, versionId, isActive);
}

// ----------------------------------------------------------------------- risk

/** How many rows one blocklist or signals view asks for. */
export const RISK_PAGE_SIZE = 50;

export function listBlocklist(params: AdminBlocklistParams = {}): Promise<AdminBlocklistPage> {
  return apiClient.adminListBlocklist({ limit: RISK_PAGE_SIZE, ...params });
}

export function blockIdentifier(payload: AdminBlockPayload): Promise<AdminBlockResult> {
  return apiClient.adminBlockIdentifier(payload);
}

export function updateBlocklistEntry(
  entryId: string,
  payload: AdminBlocklistUpdate
): Promise<AdminBlocklistEntry> {
  return apiClient.adminUpdateBlocklistEntry(entryId, payload);
}

export async function deleteBlocklistEntry(entryId: string): Promise<void> {
  await apiClient.adminDeleteBlocklistEntry(entryId);
}

export function listRiskSignals(params: AdminRiskSignalParams = {}): Promise<AdminRiskSignalPage> {
  return apiClient.adminListRiskSignals({ limit: RISK_PAGE_SIZE, ...params });
}

// ------------------------------------------------- carriers and gateways (read-only)

export function listCarriers(): Promise<AdminCarrierRegistry> {
  return apiClient.adminListCarriers();
}

/** A reachability probe from the server — costs one real request, so click-only. */
export function checkCarrier(code: string): Promise<AdminProviderCheck> {
  return apiClient.adminCheckCarrier(code);
}

export function listPaymentGateways(): Promise<AdminPaymentGatewayRegistry> {
  return apiClient.adminListPaymentGateways();
}

export function checkPaymentGateway(code: string): Promise<AdminProviderCheck> {
  return apiClient.adminCheckPaymentGateway(code);
}

// ------------------------------------------------------------ support tickets

export function listTickets(params: AdminSupportTicketParams = {}): Promise<AdminSupportTicketPage> {
  return apiClient.adminListSupportTickets({ limit: RISK_PAGE_SIZE, ...params });
}

export function getTicket(ticketId: string): Promise<AdminSupportTicketThread> {
  return apiClient.adminGetSupportTicket(ticketId);
}

export function replyTicket(
  ticketId: string,
  payload: { body: string; status?: Exclude<SupportTicketStatus, "closed"> }
): Promise<{ ticket: AdminSupportTicket; message: AdminSupportTicketMessage }> {
  return apiClient.adminReplySupportTicket(ticketId, payload);
}

export function updateTicket(
  ticketId: string,
  payload: { status?: SupportTicketStatus; priority?: SupportTicketPriority }
): Promise<AdminSupportTicket> {
  return apiClient.adminUpdateSupportTicket(ticketId, payload);
}

// ---------------------------------------------------------------- admin users

export function listRoles(): Promise<AdminRolesResponse> {
  return apiClient.adminListRoles();
}

export function listAdmins(): Promise<AdminPlatformAdmin[]> {
  return apiClient.adminListAdmins();
}

export function grantAdmin(payload: AdminGrantPayload): Promise<AdminGrantResult> {
  return apiClient.adminGrantAdmin(payload);
}

export function updateAdmin(
  userId: string,
  payload: { role?: string; permissions?: string[] }
): Promise<AdminPlatformAdmin> {
  return apiClient.adminUpdateAdmin(userId, payload);
}

export async function revokeAdmin(userId: string): Promise<void> {
  await apiClient.adminRevokeAdmin(userId);
}

// --------------------------------------------- agents, codes, commissions

export const COMMISSION_PAGE_SIZE = 50;

export function listAgents(): Promise<AdminAgentList> {
  return apiClient.adminListAgents();
}

export function getAgent(agentId: string): Promise<AdminAgentDetail> {
  return apiClient.adminGetAgent(agentId);
}

export function createAgent(payload: {
  email: string;
  firstCode?: AdminReferralCodeInput & { code: string };
}): Promise<AdminCreateAgentResult> {
  return apiClient.adminCreateAgent(payload);
}

export function createReferralCode(
  agentId: string,
  payload: AdminReferralCodeInput & { code: string }
): Promise<AdminReferralCode> {
  return apiClient.adminCreateReferralCode(agentId, payload);
}

export function updateReferralCode(codeId: string, payload: AdminReferralCodeInput): Promise<AdminReferralCode> {
  return apiClient.adminUpdateReferralCode(codeId, payload);
}

// Agents -> Referral codes (migration 725).
export const REFERRAL_CODE_PAGE_SIZE = 50;

export function listReferralCodes(params: AdminReferralCodeParams = {}): Promise<AdminReferralCodeList> {
  return apiClient.adminListReferralCodes({ limit: REFERRAL_CODE_PAGE_SIZE, ...params });
}

export function createStandaloneReferralCode(payload: AdminReferralCodeInput & { code: string }): Promise<AdminReferralCode> {
  return apiClient.adminCreateStandaloneReferralCode(payload);
}

export function getReferralCode(codeId: string): Promise<AdminReferralCodeDetail> {
  return apiClient.adminGetReferralCode(codeId);
}

export function listCodeRedemptions(codeId: string, params: AdminRedemptionParams = {}): Promise<AdminRedemptionPage> {
  return apiClient.adminListCodeRedemptions(codeId, { limit: REFERRAL_CODE_PAGE_SIZE, ...params });
}

export function simulateReferralCode(payload: Parameters<typeof apiClient.adminSimulateReferralCode>[0]): Promise<AdminReferralSimulation> {
  return apiClient.adminSimulateReferralCode(payload);
}

export function getWorkspaceReferrals(workspaceId: string): Promise<AdminWorkspaceReferrals> {
  return apiClient.adminGetWorkspaceReferrals(workspaceId);
}

export function getUserReferrals(userId: string): Promise<{ redemptions: AdminRedemption[] }> {
  return apiClient.adminGetUserReferrals(userId);
}

export function createAgentLink(workspaceId: string, payload: AdminAgentLinkInput): Promise<AdminAgentLink> {
  return apiClient.adminCreateAgentLink(workspaceId, payload);
}

export function updateAgentLink(linkId: string, payload: Parameters<typeof apiClient.adminUpdateAgentLink>[1]): Promise<AdminAgentLink> {
  return apiClient.adminUpdateAgentLink(linkId, payload);
}

export function endAgentLink(linkId: string, note?: string): Promise<AdminAgentLink> {
  return apiClient.adminEndAgentLink(linkId, note);
}

export function listCommissions(params: AdminCommissionParams): Promise<AdminCommissionPage> {
  return apiClient.adminListCommissions({ limit: COMMISSION_PAGE_SIZE, ...params });
}

export function markCommissionPaid(commissionId: string, note?: string): Promise<AdminCommission> {
  return apiClient.adminMarkCommissionPaid(commissionId, note);
}

// ------------------------------------------- payment methods and transfer proofs

export function getWorkspaceWallet(
  workspaceId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ wallet: WalletSummary; ledger: WalletLedgerPage; refunds?: WalletRefundBreakdown }> {
  return apiClient.adminGetWorkspaceWallet(workspaceId, params);
}

export function grantWalletFreeOrders(
  workspaceId: string,
  body: { count: number; reason: string; requestId: string }
): Promise<WalletConsoleEntryResult> {
  return apiClient.adminGrantWalletFreeOrders(workspaceId, body);
}

export function listWalletRefunds(params: { status?: WalletRefundStatus; page?: number; pageSize?: number } = {}): Promise<AdminWalletRefundPage> {
  return apiClient.adminListWalletRefunds(params);
}

export function approveWalletRefund(refundId: string, note?: string) {
  return apiClient.adminApproveWalletRefund(refundId, note);
}

export function rejectWalletRefund(refundId: string, note: string) {
  return apiClient.adminRejectWalletRefund(refundId, note);
}

export function markWalletRefundPaid(refundId: string, body: { payoutReference: string; note?: string }) {
  return apiClient.adminMarkWalletRefundPaid(refundId, body);
}

export function adjustWallet(
  workspaceId: string,
  body: { amount: number; reason: string; requestId: string; kind?: "correction" | "gift"; notifyMerchant?: boolean }
): Promise<WalletConsoleEntryResult> {
  return apiClient.adminAdjustWallet(workspaceId, body);
}

export function listPaymentMethods(): Promise<AdminPaymentMethods> {
  return apiClient.adminListPaymentMethods();
}

export function updatePaymentMethod(code: string, payload: { enabled?: boolean; labelAr?: string; labelEn?: string }): Promise<AdminPaymentMethod> {
  return apiClient.adminUpdatePaymentMethod(code, payload);
}

export function reorderPaymentMethods(codes: string[]): Promise<AdminPaymentMethods> {
  return apiClient.adminReorderPaymentMethods(codes);
}

export function updatePaymentMethodAccount(
  code: string,
  payload: { accountNumber?: string; paymentLink?: string | null; noteAr?: string; noteEn?: string }
): Promise<AdminPaymentMethod> {
  return apiClient.adminUpdatePaymentMethodAccount(code, payload);
}

export function listPaymentProofs(params: { status?: string; page?: number; pageSize?: number } = {}): Promise<AdminPaymentProofPage> {
  return apiClient.adminListPaymentProofs(params);
}

export function getPaymentProof(proofId: string): Promise<AdminPaymentProofReview> {
  return apiClient.adminGetPaymentProof(proofId);
}

export function approvePaymentProof(proofId: string, receivedAmount: number): Promise<AdminPaymentProofReview> {
  return apiClient.adminApprovePaymentProof(proofId, receivedAmount);
}

export function rejectPaymentProof(proofId: string, note: string): Promise<AdminPaymentProofReview> {
  return apiClient.adminRejectPaymentProof(proofId, note);
}

// ------------------------------------------------------ subscription charges

export function listCharges(workspaceId: string): Promise<AdminWorkspaceCharges> {
  return apiClient.adminListCharges(workspaceId);
}

export function createCharge(workspaceId: string): Promise<{ charge: AdminCharge; created: boolean }> {
  return apiClient.adminCreateCharge(workspaceId);
}

export function recordPayment(
  chargeId: string,
  payload: { amountReceived: number; note?: string; paidAt?: string }
): Promise<AdminRecordPaymentResult> {
  return apiClient.adminRecordPayment(chargeId, payload);
}

export function reversePayment(chargeId: string, reason?: string): Promise<AdminReversePaymentResult> {
  return apiClient.adminReversePayment(chargeId, reason ? { reason } : {});
}

export function voidCharge(chargeId: string, reason: string): Promise<AdminVoidChargeResult> {
  return apiClient.adminVoidCharge(chargeId, reason);
}

export function setBillingCycle(workspaceId: string, billingCycle: "monthly" | "yearly"): Promise<AdminWorkspaceCharges> {
  return apiClient.adminSetBillingCycle(workspaceId, billingCycle);
}

export function grantSpecialTerms(
  workspaceId: string,
  payload: AdminSpecialTermsInput
): Promise<AdminWorkspaceCharges & { term: AdminSpecialTerm }> {
  return apiClient.adminGrantSpecialTerms(workspaceId, payload);
}

// --------------------------------------------------------------- store access

export function getStoreAccess(workspaceId: string): Promise<AdminStoreAccess> {
  return apiClient.adminGetStoreAccess(workspaceId);
}

export function suspendWorkspace(workspaceId: string, reason: string): Promise<AdminStoreAccess> {
  return apiClient.adminSuspendWorkspace(workspaceId, reason);
}

export function reactivateWorkspace(workspaceId: string, reason: string): Promise<AdminStoreAccess> {
  return apiClient.adminReactivateWorkspace(workspaceId, reason);
}

export function getMyReferrals(): Promise<AdminAgentDetail> {
  return apiClient.adminGetMyReferrals();
}

export function listMyCommissions(
  params: Omit<AdminCommissionParams, "agentId" | "workspaceId">
): Promise<AdminCommissionPage> {
  return apiClient.adminListMyCommissions({ limit: COMMISSION_PAGE_SIZE, ...params });
}

// -------------------------------------------------------------- system health

/**
 * `unknown` is the console's own fifth verdict, and is not in the backend's
 * `AdminServiceStatus` union on purpose: the server always knows the outcome
 * of a probe it ran itself. The browser does not — a probe it could not
 * complete may mean the service is down, or merely that CORS blocked the call.
 *
 * The other four come straight from the API, `not_configured` included; it
 * means the integration is switched off in this environment, which is a
 * neutral statement and not a failure.
 */
export type SystemServiceStatus = AdminServiceStatus | "unknown";

export interface SystemService {
  id: string;
  name: string;
  /**
   * What the check actually is, when we know it first-hand. Null for
   * server-sourced tiles: the endpoint reports an outcome, not the probe it
   * ran, and authoring a "GET …" line here would describe a check this
   * console never saw and cannot keep in step with the backend.
   */
  description: string | null;
  status: SystemServiceStatus;
  /** One sentence stating exactly what the reading was, in plain terms. */
  detail: string;
  /** Round trip in ms, HTTP overhead included. Null when nothing came back. */
  latencyMs: number | null;
  checkedAt: string;
  uptime30d: number | null;
  lastIncidentAt: string | null;
  lastIncidentSummary: string | null;
}

export interface SystemHealthReport {
  /** `endpoint` = the server's own per-service report; `probe` = measured here. */
  source: "endpoint" | "probe";
  /** Why the endpoint was not used. Null when `source` is "endpoint". */
  endpointError: string | null;
  /**
   * True when the server replayed a recent reading instead of probing. Always
   * false for a browser-side probe report — that one has no cache to serve
   * from, so it is fresh by construction.
   */
  cached: boolean;
  services: SystemService[];
  checkedAt: string;
}

/**
 * Dependencies `GET /admin/system/services` covers that the browser-side
 * fallback cannot see.
 *
 * Used *only* to name what a probe-sourced report leaves out. Nothing here is
 * ever rendered with a status — the console has no way to observe any of them,
 * and a tile implying otherwise would be an invention.
 *
 * The payment gateways (Paymob, Kashier) are on it: merchants connect their
 * own accounts, and whether online payments are on, whether the credentials
 * key is set, and whether each gateway's API answers are all things only the
 * server can see. Its own report carries them on the payments tile.
 */
export const UNPROBED_DEPENDENCIES = [
  "Object storage (R2/S3)",
  "Email delivery (Brevo/SMTP)",
  "SMS and WhatsApp (Twilio)",
  "Payment gateways (Paymob/Kashier)",
] as const;

/** Reads `{ status: "ok" }`-style fields off an unknown JSON body. */
function bodyField(body: unknown, key: string): string | null {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return null;
}

/**
 * `GET /health` — does the API process answer at all?
 *
 * This tile can never read "down". An unanswered probe from a browser is
 * ambiguous (outage, network, or a CORS allowlist that omits this console's
 * origin), and only the process itself can confirm it is gone.
 */
function apiTile(probe: HealthProbeResult): SystemService {
  const base = {
    id: "api",
    name: "API",
    description: "GET /health — the Express process behind /api/v1.",
    latencyMs: probe.latencyMs,
    checkedAt: probe.checkedAt,
    uptime30d: null,
    lastIncidentAt: null,
    lastIncidentSummary: null,
  };

  if (!probe.reachable) {
    return {
      ...base,
      status: "unknown",
      detail: `No response (${probe.error}). This console cannot tell an outage apart from a blocked request.`,
    };
  }
  // The general rate limiter is mounted ahead of /health, so a throttled probe
  // is still proof of life — the process answered in order to refuse us.
  if (probe.status === 429) {
    return {
      ...base,
      status: "operational",
      detail: "Rate-limited (HTTP 429) — the process answered, so it is running. Refresh less often.",
    };
  }
  if (probe.status === 200 && bodyField(probe.body, "status") === "ok") {
    return { ...base, status: "operational", detail: "Answered 200 with status \u201cok\u201d." };
  }
  if (probe.status === 200) {
    return {
      ...base,
      status: "degraded",
      detail: "Answered 200, but not with the expected {\u00a0status: \u201cok\u201d\u00a0} body.",
    };
  }
  return { ...base, status: "degraded", detail: `Answered HTTP ${probe.status}.` };
}

/**
 * `GET /health/ready` — can the API reach Postgres?
 *
 * Unlike the API tile this one *can* read "down": a 503 here is the API
 * working correctly and reporting that `sequelize.authenticate()` failed. That
 * is a first-hand account from the process that owns the connection, not a
 * guess from the browser.
 */
function databaseTile(probe: HealthProbeResult): SystemService {
  const base = {
    id: "database",
    name: "Database",
    description: "GET /health/ready — Postgres, as reported by the API.",
    latencyMs: probe.latencyMs,
    checkedAt: probe.checkedAt,
    uptime30d: null,
    lastIncidentAt: null,
    lastIncidentSummary: null,
  };

  if (!probe.reachable) {
    return {
      ...base,
      status: "unknown",
      detail: "The API did not answer, so it could not report on the database.",
    };
  }
  if (probe.status === 429) {
    return {
      ...base,
      status: "unknown",
      detail: "Rate-limited (HTTP 429) before the readiness check ran.",
    };
  }
  const database = bodyField(probe.body, "database");
  if (probe.status === 200 && database === "connected") {
    return { ...base, status: "operational", detail: "The API reports the database is connected." };
  }
  if (probe.status === 503) {
    return {
      ...base,
      status: "down",
      detail: "The API reports it cannot reach the database (HTTP 503, not_ready).",
    };
  }
  return { ...base, status: "degraded", detail: `Readiness answered HTTP ${probe.status}.` };
}

/**
 * Maps a server-reported tile onto the console's row shape, widening status.
 *
 * The server's `detail` is the reading itself — what was reached, why a probe
 * failed, or which setting switched an integration off — so it is passed
 * through verbatim rather than being restated as "checked at <time>". When
 * it sends none there is genuinely nothing further to say; the status and the
 * `checkedAt` stamp already carry the whole reading.
 */
function endpointTile(tile: AdminServiceTile): SystemService {
  return {
    id: tile.key,
    name: tile.name,
    description: null,
    status: tile.status,
    detail: tile.detail ?? "Checked on the server, which reported no further detail.",
    latencyMs: tile.latencyMs,
    // Stamped when the probe ran, not when the response was served, so a tile
    // served from the server's cache reports its real age.
    checkedAt: tile.checkedAt,
    uptime30d: tile.uptime30d,
    lastIncidentAt: tile.lastIncidentAt,
    lastIncidentSummary: tile.lastIncidentSummary,
  };
}

/** Probes the two root health endpoints from the browser, in parallel. */
async function probeReport(endpointError: string | null): Promise<SystemHealthReport> {
  const [live, ready] = await Promise.all([
    apiClient.probeHealth("/health"),
    apiClient.probeHealth("/health/ready"),
  ]);
  return {
    source: "probe",
    endpointError,
    // Measured here, this instant. There is no cache in this path to serve from.
    cached: false,
    services: [apiTile(live), databaseTile(ready)],
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Runs one of the two server-side report calls, falling back to browser probes.
 *
 * Both entry points below share this. The fallback is the whole reason it is
 * factored out: whichever call was asked for, a failure to reach the server
 * has to degrade the same way and record the same reason — the page shows it,
 * so an endpoint that starts failing for a *new* reason can't hide behind the
 * fallback.
 */
async function serviceReport(
  load: () => Promise<AdminServiceReport>
): Promise<SystemHealthReport> {
  try {
    const report = await load();
    return {
      source: "endpoint",
      endpointError: null,
      cached: report.cached,
      services: report.services.map(endpointTile),
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    // An authorization failure is about the viewer, not about the platform's
    // health. Falling back here would answer "may I see this?" with a status
    // board, and would swallow the permission message the page otherwise
    // shows. Every other failure falls through to the probes, with the reason
    // carried to the page.
    // The backend guards the whole /admin router before routing, so a
    // non-admin gets 403 even on a path with no route behind it. That is
    // deliberate (it hides which admin routes exist), and it means a 403 here
    // says nothing about whether the endpoint is built.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
    return probeReport(getErrorMessage(err));
  }
}

/**
 * The system health report for a page load, from the best source available.
 *
 * Prefers `GET /admin/system/services`, whose reading the server caches for a
 * short window — so opening and refreshing this page does not fire real
 * requests at Brevo and Twilio every time. `cached` says which it got.
 *
 * Keep the browser-side fallback. It is the only source that still answers
 * when the API itself is the thing that is down, which is exactly when a
 * status board has to work.
 */
export function loadSystemHealth(): Promise<SystemHealthReport> {
  return serviceReport(() => apiClient.adminListSystemServices());
}

/**
 * The report from a fresh server-side probe — what the Re-check button runs.
 *
 * `POST /admin/system/services/check` bypasses the cache the GET serves from,
 * so this is the only call that actually re-probes. Re-running the GET would
 * spin the button and, inside the cache window, hand back the identical
 * reading — a control that claims to check something and doesn't.
 *
 * Costs real third-party requests, so it belongs on an explicit click and
 * never on a timer or a route change.
 */
export function recheckSystemHealth(): Promise<SystemHealthReport> {
  return serviceReport(() => apiClient.adminCheckSystemServices());
}

// ------------------------------------------------------------------- overview

/**
 * A single headline number, which may not exist.
 *
 * `value: null` means this console genuinely cannot compute the metric — not
 * that the metric is zero. The distinction is the whole point of the type: a
 * platform with no orders today and a console that cannot count orders must
 * not render the same tile. `unavailable` carries the reason, so the UI can
 * say why rather than showing a bare dash.
 */
export interface OverviewKpi {
  value: number | null;
  /** Why `value` is null. Null whenever `value` is present, including 0. */
  unavailable: string | null;
}

/** A headline number denominated in a currency. Minor units, as the API sends. */
export interface OverviewMoneyKpi extends OverviewKpi {
  /**
   * ISO code for `value`, or null when there is nothing to denominate — either
   * because the amount is unavailable, or because it is exactly zero and so is
   * zero in every currency.
   */
  currency: string | null;
}

/** A trend series, which may not exist. Same null-vs-empty rule as `OverviewKpi`. */
export interface OverviewSeries {
  /** Null = not computable. An empty array means the window really is empty. */
  points: AdminChartPoint[] | null;
  unavailable: string | null;
}

/**
 * A needs-attention row, phrased for display.
 *
 * The API sends identity and one number per row and deliberately no copy and
 * no route; both are authored here. `kind` stays a plain string rather than
 * the API's union because the server may raise kinds this build has never
 * heard of, and the queue must show them rather than drop or crash on them.
 */
export interface OverviewAttentionRow {
  id: string;
  kind: string;
  severity: "warning" | "danger" | "info";
  workspaceId: string | null;
  workspaceName: string | null;
  title: string;
  detail: string;
  /** In-app destination, or null when the row names no workspace to open. */
  to: string | null;
}

export interface OverviewReport {
  /** `endpoint` = the server's own metrics; `derived` = computed in the browser. */
  source: "endpoint" | "derived";
  /** Why the endpoint was not used. Null when `source` is "endpoint". */
  endpointError: string | null;
  /** When these numbers were computed, ISO. */
  generatedAt: string;
  kpis: {
    activeWorkspaces: OverviewKpi;
    trialing: OverviewKpi;
    pastDue: OverviewKpi;
    mrr: OverviewMoneyKpi;
    gmv30d: OverviewMoneyKpi;
    ordersToday: OverviewKpi;
    /** A 0..1 fraction, not a percentage. */
    deliveryRate: OverviewKpi;
  };
  signupsPerDay: OverviewSeries;
  mrrTrend: OverviewSeries;
  ordersPerDay: OverviewSeries;
  attention: OverviewAttentionRow[];
  /** Newest workspaces first. Always derived from `GET /admin/workspaces`. */
  recentSignups: AdminWorkspaceRow[];
}

const SIGNUP_WINDOW_DAYS = 30;
const RECENT_SIGNUP_COUNT = 8;
const DAY_MS = 86_400_000;

/** A present reading, including a legitimate zero. */
function known(value: number): OverviewKpi {
  return { value, unavailable: null };
}

/** A reading this console cannot take, with the reason shown to the admin. */
function unknown(reason: string): OverviewKpi {
  return { value: null, unavailable: reason };
}

/**
 * Why each metric is missing from a derived report.
 *
 * All of these need aggregation across every workspace's orders, shipments or
 * invoices, and nothing on the admin surface exposes any of that — the
 * workspace list carries a lifetime order count and nothing else. They are
 * the reason the endpoint has to exist.
 */
const NO_ORDER_AGGREGATE = "No admin endpoint exposes platform-wide order data yet.";
const NO_SHIPMENT_AGGREGATE = "No admin endpoint exposes shipment outcomes yet.";
const NO_INVOICE_HISTORY =
  "Needs billing history, which no admin endpoint exposes yet. Projecting today's MRR backwards would draw a flat line, not a trend.";

// ---- UTC day bucketing -----------------------------------------------------
// Every bucket key here is a UTC calendar day, matching how the endpoint
// buckets. Using local days instead would put the browser and the server on
// different boundaries, so the same workspace could land in different columns
// depending on who is looking.

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The last `count` UTC day keys, oldest first, ending with today. */
function recentUtcDays(count: number): string[] {
  const todayUtc = Date.parse(utcDayKey(Date.now()) + "T00:00:00Z");
  return Array.from({ length: count }, (_, i) => utcDayKey(todayUtc - (count - 1 - i) * DAY_MS));
}

/** Whole days elapsed since `iso`; null when there is no date to measure from. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

// ---- phrasing --------------------------------------------------------------

function plural(n: number, noun: string): string {
  return n + " " + noun + (n === 1 ? "" : "s");
}

function humanizeKind(kind: string): string {
  const spaced = kind.replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Phrases one attention row.
 *
 * `value` means something different per kind, so each case reads it on its own
 * terms. An unrecognised kind still produces a usable row: the server can add
 * kinds whenever it likes, and a console that dropped them would quietly hide
 * exactly the problems this queue exists to surface. Its `value` is left
 * unread there — the number's meaning is defined per kind, so there is no
 * honest way to describe one this build does not know.
 */
function attentionRow(item: {
  id: string;
  kind: string;
  severity: "warning" | "danger" | "info";
  workspaceId: string | null;
  workspaceName: string | null;
  value: number | null;
}): OverviewAttentionRow {
  const who = item.workspaceName ?? "A workspace";
  const base = {
    id: item.id,
    kind: item.kind,
    severity: item.severity,
    workspaceId: item.workspaceId,
    workspaceName: item.workspaceName,
    to: item.workspaceId ? "/workspaces/" + item.workspaceId : null,
  };

  switch (item.kind) {
    case "past_due":
      return {
        ...base,
        title: "Payment overdue",
        detail:
          item.value === null
            ? who + " has a failed renewal."
            : who + " — " + plural(item.value, "day") + " past due.",
      };
    case "high_rto":
      return {
        ...base,
        title: "High return rate",
        detail:
          item.value === null
            ? who + " is returning an unusual share of orders."
            : who + " — " + (item.value * 100).toFixed(0) + "% of orders returned.",
      };
    case "unverified_domain":
      return {
        ...base,
        title: "Domain not verified",
        detail:
          item.value === null
            ? who + " has a domain still awaiting verification."
            : who + " — added " + plural(item.value, "day") + " ago, still unverified.",
      };
    case "carrier_error":
      return { ...base, title: "Carrier errors", detail: who + " is seeing carrier failures." };
    default:
      return { ...base, title: humanizeKind(item.kind), detail: who + " needs attention." };
  }
}

/** Newest workspaces first. Ties keep the list's own order, which is stable. */
function recentSignups(rows: AdminWorkspaceRow[]): AdminWorkspaceRow[] {
  return [...rows]
    .sort((a, b) => Date.parse(b.workspace.createdAt) - Date.parse(a.workspace.createdAt))
    .slice(0, RECENT_SIGNUP_COUNT);
}

// ---- derived report --------------------------------------------------------

/**
 * Sums the current monthly run rate across workspaces.
 *
 * Only subscriptions that actually contribute are considered — the API already
 * reports `mrr: 0` for anything not active or past_due. Currencies are never
 * combined: plans carry their own currency, the backend has no FX layer, and
 * adding USD to EGP would produce a confident number that means nothing. When
 * contributors disagree the total is withheld rather than guessed.
 *
 * A total of zero is reported as zero with no currency: there is nothing to
 * denominate, and zero is the same figure in every currency.
 */
function deriveMrr(rows: AdminWorkspaceRow[]): OverviewMoneyKpi {
  const contributors = rows
    .map((r) => r.subscription)
    .filter((s): s is AdminSubscriptionRow => s !== null && s.mrr > 0);

  if (contributors.length === 0) return { value: 0, currency: null, unavailable: null };

  const currencies = new Set(contributors.map((s) => s.currency));
  if (currencies.size > 1) {
    return {
      value: null,
      currency: null,
      unavailable:
        "Paying plans are priced in " +
        currencies.size +
        " currencies (" +
        [...currencies].sort().join(", ") +
        ") and the platform has no conversion layer, so there is no meaningful single total.",
    };
  }
  return {
    value: contributors.reduce((sum, s) => sum + s.mrr, 0),
    currency: [...currencies][0],
    unavailable: null,
  };
}

/** Workspace creation timestamps bucketed into the last 30 UTC days. */
function deriveSignups(rows: AdminWorkspaceRow[]): OverviewSeries {
  const days = recentUtcDays(SIGNUP_WINDOW_DAYS);
  const counts = new Map(days.map((d) => [d, 0]));
  for (const { workspace } of rows) {
    const key = utcDayKey(new Date(workspace.createdAt).getTime());
    // A workspace older than the window has no bucket. Not an error — it is
    // simply outside the 30 days the chart covers.
    const current = counts.get(key);
    if (current !== undefined) counts.set(key, current + 1);
  }
  return {
    points: days.map((label) => ({ label, value: counts.get(label) ?? 0 })),
    unavailable: null,
  };
}

/**
 * Past-due subscriptions, as attention rows.
 *
 * The only kind derivable here. `high_rto` and `unverified_domain` need
 * shipment outcomes and the domain table, neither of which the admin surface
 * exposes; inventing rows for them would be worse than showing fewer.
 */
function deriveAttention(rows: AdminWorkspaceRow[]): OverviewAttentionRow[] {
  return rows
    .filter((r) => r.workspace.subscriptionStatus === "past_due")
    .map(({ workspace, subscription }) =>
      attentionRow({
        id: "past_due:" + workspace.id,
        kind: "past_due",
        severity: "danger",
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        // The period end is when payment was due, so time since it is how long
        // the account has been overdue.
        value: daysSince(subscription?.currentPeriodEnd ?? workspace.currentPeriodEnd),
      })
    );
}

export function deriveReport(
  rows: AdminWorkspaceRow[],
  endpointError: string | null
): OverviewReport {
  const byStatus = (status: string) =>
    rows.filter((r) => r.workspace.subscriptionStatus === status).length;

  return {
    source: "derived",
    endpointError,
    generatedAt: new Date().toISOString(),
    kpis: {
      activeWorkspaces: known(byStatus("active")),
      trialing: known(byStatus("trialing")),
      pastDue: known(byStatus("past_due")),
      mrr: deriveMrr(rows),
      gmv30d: { ...unknown(NO_ORDER_AGGREGATE), currency: null },
      ordersToday: unknown(NO_ORDER_AGGREGATE),
      deliveryRate: unknown(NO_SHIPMENT_AGGREGATE),
    },
    signupsPerDay: deriveSignups(rows),
    mrrTrend: { points: null, unavailable: NO_INVOICE_HISTORY },
    ordersPerDay: { points: null, unavailable: NO_ORDER_AGGREGATE },
    attention: deriveAttention(rows),
    recentSignups: recentSignups(rows),
  };
}

// ---- endpoint report -------------------------------------------------------

/**
 * Wraps a series from the endpoint.
 *
 * A series that is absent or not an array is treated as unavailable rather
 * than dereferenced. The endpoint does not exist yet, so this code has never
 * met a real response: a malformed payload should leave one panel saying so,
 * not take the whole console down with a white screen.
 */
function endpointSeries(
  points: AdminChartPoint[] | null | undefined,
  whenMissing: string
): OverviewSeries {
  if (!Array.isArray(points)) return { points: null, unavailable: whenMissing };
  return { points, unavailable: null };
}

export function endpointReport(
  overview: AdminOverview,
  rows: AdminWorkspaceRow[]
): OverviewReport {
  const { kpis } = overview;
  // The contract pairs each amount with its own currency and sends both as
  // null together when the underlying rows span currencies. Reading one
  // without the other is what would reintroduce the mixed-currency sum.
  const money = (value: number | null, currency: string | null): OverviewMoneyKpi =>
    value === null
      ? {
          value: null,
          currency: null,
          unavailable:
            "The workspaces behind this total are billed in several currencies and the platform has no conversion layer.",
        }
      : { value, currency, unavailable: null };

  return {
    source: "endpoint",
    endpointError: null,
    generatedAt: overview.generatedAt,
    kpis: {
      activeWorkspaces: known(kpis.activeWorkspaces),
      trialing: known(kpis.trialing),
      pastDue: known(kpis.pastDue),
      mrr: money(kpis.mrr, kpis.mrrCurrency),
      gmv30d: money(kpis.gmv30d, kpis.gmv30dCurrency),
      ordersToday: known(kpis.ordersToday),
      // Null means no shipment reached a terminal state, which is not a rate
      // of zero — nothing was measured at all.
      deliveryRate:
        kpis.deliveryRate === null
          ? unknown("No shipment has reached a terminal state in the last 30 days.")
          : known(kpis.deliveryRate),
    },
    signupsPerDay: endpointSeries(overview.signupsPerDay, "The server sent no signup series."),
    // Null here is the server saying it found no paid invoice anywhere in the
    // window, which is not the same as a year of zeros.
    mrrTrend: endpointSeries(overview.mrrTrend, "No paid invoices in the last 12 months."),
    ordersPerDay: endpointSeries(overview.ordersPerDay, "The server sent no orders series."),
    attention: (overview.attention ?? []).map((item: AdminAttentionItem) =>
      attentionRow({
        id: item.id,
        kind: item.kind,
        severity: item.severity,
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName,
        value: item.value,
      })
    ),
    recentSignups: recentSignups(rows),
  };
}

/**
 * The overview, from the best source available.
 *
 * Prefers `GET /admin/metrics/overview`, which does not exist yet, and falls
 * back to computing what the workspace and subscription lists can support.
 * The fallback is honest about its gaps rather than filling them with zeroes:
 * four of the seven KPIs and two of the three charts need order, shipment or
 * invoice aggregation that no admin endpoint exposes, and they come back as
 * explicitly unavailable.
 *
 * The workspace list is fetched either way, because recent signups are derived
 * from it in both modes and the endpoint does not carry them.
 */
export async function loadOverview(): Promise<OverviewReport> {
  // Started before the overview call so the fallback does not pay for a second
  // round trip it could have overlapped. No stray handler is needed to keep
  // this from becoming an unhandled rejection on the rethrow path below, where
  // it is never awaited: `Promise.all` subscribes to every input the moment it
  // is called, so this promise is already observed whichever one rejects first.
  const rowsPromise = listWorkspaceRows();

  try {
    const [overview, rows] = await Promise.all([apiClient.adminGetOverview(), rowsPromise]);
    return endpointReport(overview, rows);
  } catch (err) {
    // As on system health: a 401/403 is a statement about the viewer, not
    // about the platform. Falling back would replace the permission message
    // with a half-filled dashboard, and the fallback's own calls would fail
    // the same way a moment later. The /admin router guards before routing,
    // so a non-admin gets 403 even for endpoints that do not exist.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
    return deriveReport(await rowsPromise, getErrorMessage(err));
  }
}

// --------------------------------------------------------------------- derived

/** Derived from the window alone — the API stores no status column. */
export function announcementStatus(
  a: Pick<AdminAnnouncement, "startsAt" | "endsAt">
): "scheduled" | "live" | "ended" {
  const now = Date.now();
  if (new Date(a.startsAt).getTime() > now) return "scheduled";
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return "ended";
  return "live";
}
