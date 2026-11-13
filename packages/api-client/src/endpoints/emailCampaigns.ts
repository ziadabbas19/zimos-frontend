/**
 * Email campaigns: a store emails its own customers who agreed to marketing
 * (backend: src/modules/emailCampaigns, EMAIL_CAMPAIGNS_ENABLED — every route
 * answers 404 while off). Staff routes at
 * /workspaces/:workspaceId/email-campaigns need discounts.manage and, with
 * GROWTH_REQUIRE_PLAN_FEATURE, the plan's `email_campaigns` (403
 * PLAN_FEATURE_REQUIRED). All exported names in this file are prefixed with
 * `emailCampaign` / `EmailCampaign`.
 *
 * The email is built from blocks and rendered by the server (escaped, http(s)
 * links only); it goes out from the platform's address under the store's
 * name, with the store's Reply-To.
 *
 * Codes: 422 EMAIL_QUOTA_EXCEEDED (details: needed, remaining, max, used,
 * resetsAt), 422 NO_RECIPIENTS, 422 CAMPAIGN_INCOMPLETE (details.field),
 * 409 CAMPAIGN_LOCKED / CAMPAIGN_NOT_SENDABLE / CAMPAIGN_NOT_CANCELLABLE,
 * 503 EMAIL_PROVIDER_NOT_CONFIGURED, 429 on too many writes or test emails.
 */
import type { ApiClient } from "../client";

export type EmailCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
export type EmailCampaignLocale = "ar" | "en";
export type EmailCampaignAlign = "start" | "center" | "end";

export type EmailCampaignBlock =
  | { type: "heading"; text: string; size?: "lg" | "md"; align?: EmailCampaignAlign }
  | { type: "text"; text: string; align?: EmailCampaignAlign }
  | { type: "image"; url: string; alt?: string; link?: string | null; width?: number; align?: EmailCampaignAlign }
  | { type: "button"; label: string; url: string; color?: string; align?: EmailCampaignAlign }
  | { type: "products"; productIds: string[]; showPrice?: boolean }
  | { type: "divider" };

export type EmailCampaignBlockType = EmailCampaignBlock["type"];

export const EMAIL_CAMPAIGN_RFM_LABELS = [
  "champions",
  "cant_lose",
  "at_risk",
  "loyal",
  "new",
  "potential",
  "lost",
  "hibernating",
  "need_attention",
] as const;
export type EmailCampaignRfmLabel = (typeof EMAIL_CAMPAIGN_RFM_LABELS)[number];

export interface EmailCampaignRules {
  minOrders?: number;
  maxOrders?: number;
  /** Minor units. */
  minSpent?: number;
  maxSpent?: number;
  lastOrderWithinDays?: number;
  lastOrderOlderThanDays?: number;
}

export type EmailCampaignAudience =
  | { type: "all" }
  | { type: "segment"; segmentId: string }
  | { type: "rfm"; labels: EmailCampaignRfmLabel[] }
  | { type: "rules"; rules: EmailCampaignRules };

export interface EmailCampaignStats {
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  blocks: EmailCampaignBlock[];
  locale: EmailCampaignLocale;
  replyTo: string | null;
  audience: EmailCampaignAudience;
  status: EmailCampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  /** Sending waits until then: the store's daily cap was reached. */
  pausedUntil: string | null;
  /** quota_exceeded | no_recipients | incomplete | plan_feature | all_failed | start_failed */
  failureReason: string | null;
  stats: EmailCampaignStats;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaignDraft {
  name?: string;
  subject?: string;
  preheader?: string | null;
  blocks?: EmailCampaignBlock[];
  locale?: EmailCampaignLocale;
  replyTo?: string | null;
  audience?: EmailCampaignAudience;
}

export interface EmailCampaignQuota {
  /** null = unlimited. */
  monthly: { max: number | null; used: number; remaining: number | null; resetsAt: string };
  daily: { cap: number; used: number; remaining: number; resetsAt: string };
}

export interface EmailCampaignOverview {
  quota: EmailCampaignQuota;
  sender: { fromName: string; fromAddress: string; replyTo: string | null };
  /** reportsEngagement: opens and clicks are reported (else only sent, failed and unsubscribed are known). */
  provider: { ready: boolean; reportsDelivery: boolean; reportsEngagement: boolean };
  locale: EmailCampaignLocale;
  audiences: { segments: Array<{ id: string; name: string }>; rfm: boolean };
}

export interface EmailCampaignProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
}

export interface EmailCampaignRecipient {
  id: string;
  email: string;
  status: "queued" | "sending" | "sent" | "failed" | "skipped" | "cancelled";
  error: string | null;
  attempts: number;
  sentAt: string | null;
  deliveryStatus: "delivered" | "bounced" | "complained" | "undelivered" | null;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/email-campaigns`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function emailCampaignOverview(client: ApiClient, workspaceId: string) {
  return client.request<EmailCampaignOverview>(`${base(workspaceId)}/overview`);
}

export function emailCampaignList(client: ApiClient, workspaceId: string, params: { status?: EmailCampaignStatus; cursor?: string; limit?: number } = {}) {
  return client.request<{ campaigns: EmailCampaign[]; nextCursor: string | null }>(`${base(workspaceId)}${query(params)}`);
}

export async function emailCampaignGet(client: ApiClient, workspaceId: string, campaignId: string): Promise<EmailCampaign> {
  const { campaign } = await client.request<{ campaign: EmailCampaign }>(`${base(workspaceId)}/${campaignId}`);
  return campaign;
}

export async function emailCampaignCreate(client: ApiClient, workspaceId: string, body: EmailCampaignDraft & { name: string }): Promise<EmailCampaign> {
  const { campaign } = await client.request<{ campaign: EmailCampaign }>(base(workspaceId), { method: "POST", body });
  return campaign;
}

export async function emailCampaignUpdate(client: ApiClient, workspaceId: string, campaignId: string, body: EmailCampaignDraft): Promise<EmailCampaign> {
  const { campaign } = await client.request<{ campaign: EmailCampaign }>(`${base(workspaceId)}/${campaignId}`, { method: "PATCH", body });
  return campaign;
}

export function emailCampaignDelete(client: ApiClient, workspaceId: string, campaignId: string) {
  return client.request<{ deleted: true }>(`${base(workspaceId)}/${campaignId}`, { method: "DELETE" });
}

/** How many addresses the audience reaches now, and how many subscribed customers the store has. */
export function emailCampaignAudienceCount(client: ApiClient, workspaceId: string, audience: EmailCampaignAudience) {
  return client.request<{ count: number; subscribed: number }>(`${base(workspaceId)}/audience`, { method: "POST", body: { audience } });
}

export async function emailCampaignPreview(
  client: ApiClient,
  workspaceId: string,
  body: { subject?: string; preheader?: string | null; blocks: EmailCampaignBlock[]; locale?: EmailCampaignLocale }
): Promise<{ subject: string; html: string; text: string }> {
  const { preview } = await client.request<{ preview: { subject: string; html: string; text: string } }>(`${base(workspaceId)}/preview`, { method: "POST", body });
  return preview;
}

/** The draft to the signed-in teammate's own address (never anyone else's); outside the quota. */
export function emailCampaignSendTest(
  client: ApiClient,
  workspaceId: string,
  body: { subject: string; preheader?: string | null; blocks: EmailCampaignBlock[]; locale?: EmailCampaignLocale; replyTo?: string | null }
) {
  return client.request<{ sent: true; to: string }>(`${base(workspaceId)}/test`, { method: "POST", body });
}

async function act(client: ApiClient, workspaceId: string, campaignId: string, action: string, body?: object): Promise<EmailCampaign> {
  const { campaign } = await client.request<{ campaign: EmailCampaign }>(`${base(workspaceId)}/${campaignId}/${action}`, { method: "POST", body: body ?? {} });
  return campaign;
}

export const emailCampaignSend = (client: ApiClient, workspaceId: string, campaignId: string) => act(client, workspaceId, campaignId, "send");
export const emailCampaignSchedule = (client: ApiClient, workspaceId: string, campaignId: string, scheduledAt: string) =>
  act(client, workspaceId, campaignId, "schedule", { scheduledAt });
export const emailCampaignUnschedule = (client: ApiClient, workspaceId: string, campaignId: string) => act(client, workspaceId, campaignId, "unschedule");
export const emailCampaignCancel = (client: ApiClient, workspaceId: string, campaignId: string) => act(client, workspaceId, campaignId, "cancel");

export function emailCampaignRecipients(
  client: ApiClient,
  workspaceId: string,
  campaignId: string,
  params: { status?: EmailCampaignRecipient["status"]; cursor?: string; limit?: number } = {}
) {
  return client.request<{ recipients: EmailCampaignRecipient[]; nextCursor: string | null }>(`${base(workspaceId)}/${campaignId}/recipients${query(params)}`);
}

export async function emailCampaignProducts(client: ApiClient, workspaceId: string, q = ""): Promise<EmailCampaignProduct[]> {
  const { products } = await client.request<{ products: EmailCampaignProduct[] }>(`${base(workspaceId)}/products${query({ q })}`);
  return products;
}
