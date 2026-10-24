/**
 * Developer settings — API keys and outbound webhooks (backend:
 * src/modules/apiKeys and src/modules/webhooks; the keys are used against the
 * public API, documented in the backend's docs/public-api.md).
 *
 * Mounted at /workspaces/:workspaceId/api-keys (api_keys.manage) and
 * /workspaces/:workspaceId/webhooks (webhooks.manage). All exported names in
 * this file are prefixed with `developers` / `Developer`, or name an API key
 * or webhook type.
 *
 * Secrets: an API key's full value is only ever in the answer to
 * developersCreateApiKey (`secret`), and a webhook's signing secret only in
 * the answers to developersCreateWebhook and developersRotateWebhookSecret
 * (`signingSecret`). Every other read carries a prefix or a hint.
 *
 * Notable codes: WEBHOOK_ENDPOINT_LIMIT (409 — ten endpoints per store),
 * VALIDATION_ERROR (422 — including a webhook URL that is not public https;
 * the message says which rule it broke).
 */
import type { ApiClient } from "../client";

// ------------------------------------------------------------------ types --

export type ApiKeyScope =
  // Also the accepted-orders feed and this key's receipts of it (PUBLIC_API_ACK_ENABLED).
  | "orders:read"
  // A till / kitchen system's status for an order: a note, never the order's stage.
  | "orders:pos_status"
  // Create + update + delete in one, from before the three were told apart.
  | "orders:write"
  | "orders:create"
  | "orders:update"
  | "orders:delete"
  | "products:read"
  | "products:create"
  | "products:update"
  | "products:delete"
  | "categories:read"
  | "categories:create"
  | "categories:update"
  | "categories:delete"
  | "customers:read"
  | "discounts:read"
  | "discounts:write"
  | "shipping_areas:read"
  | "shipping_areas:write"
  | "webhooks:write"
  | "analytics:read";

export interface ApiKeyDto {
  id: string;
  name: string;
  /** First 12 characters of the key (`zk_…`), shown so keys can be told apart. */
  keyPrefix: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName?: string };
}

export interface ApiKeyCreatePayload {
  name: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute?: number;
}

export interface ApiKeyCreated {
  apiKey: ApiKeyDto;
  /** The full key. Shown once; the server keeps only its hash. */
  secret: string;
}

// The server's catalogue (GET …/webhooks → events) is the list to show; the
// two below are the ones the order change detector has always sent.
export type WebhookEventName = "order.created" | "order.status_changed" | (string & {});

export interface WebhookEventInfo {
  name: WebhookEventName;
  description: string;
}

export interface WebhookEndpointDto {
  id: string;
  url: string;
  /** Event names, or `["*"]` for every event. */
  events: string[];
  isActive: boolean;
  /** `whsec_…abcd` — never the secret itself; null when the server cannot read a sealed secret. */
  secretHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpointList {
  endpoints: WebhookEndpointDto[];
  events: WebhookEventInfo[];
  wildcard: string;
  /** Events "*" does not bring (order.accepted): listed by name, beside "*" if wanted. Absent on older servers. */
  explicitOnly?: string[];
}

export interface WebhookEndpointCreated {
  endpoint: WebhookEndpointDto;
  signingSecret: string;
}

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "exhausted";

export interface WebhookDeliveryDto {
  id: string;
  eventId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastResponseStatus: number | null;
  lastError: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------- api keys --

const keysBase = (workspaceId: string) => `/workspaces/${workspaceId}/api-keys`;

export async function developersListApiKeys(
  client: ApiClient,
  workspaceId: string
): Promise<{ apiKeys: ApiKeyDto[]; scopes: ApiKeyScope[] }> {
  return client.request<{ apiKeys: ApiKeyDto[]; scopes: ApiKeyScope[] }>(keysBase(workspaceId));
}

export async function developersCreateApiKey(
  client: ApiClient,
  workspaceId: string,
  payload: ApiKeyCreatePayload
): Promise<ApiKeyCreated> {
  return client.request<ApiKeyCreated>(keysBase(workspaceId), { method: "POST", body: payload });
}

export async function developersRevokeApiKey(client: ApiClient, workspaceId: string, keyId: string): Promise<ApiKeyDto> {
  const { apiKey } = await client.request<{ apiKey: ApiKeyDto }>(`${keysBase(workspaceId)}/${keyId}`, {
    method: "DELETE",
  });
  return apiKey;
}

// -------------------------------------------------------------- webhooks --

const hooksBase = (workspaceId: string) => `/workspaces/${workspaceId}/webhooks`;

export async function developersListWebhooks(client: ApiClient, workspaceId: string): Promise<WebhookEndpointList> {
  return client.request<WebhookEndpointList>(hooksBase(workspaceId));
}

export async function developersCreateWebhook(
  client: ApiClient,
  workspaceId: string,
  payload: { url: string; events: string[] }
): Promise<WebhookEndpointCreated> {
  return client.request<WebhookEndpointCreated>(hooksBase(workspaceId), { method: "POST", body: payload });
}

export async function developersUpdateWebhook(
  client: ApiClient,
  workspaceId: string,
  endpointId: string,
  payload: { url?: string; events?: string[]; isActive?: boolean }
): Promise<WebhookEndpointDto> {
  const { endpoint } = await client.request<{ endpoint: WebhookEndpointDto }>(`${hooksBase(workspaceId)}/${endpointId}`, {
    method: "PATCH",
    body: payload,
  });
  return endpoint;
}

export async function developersDeleteWebhook(
  client: ApiClient,
  workspaceId: string,
  endpointId: string
): Promise<{ deleted: boolean }> {
  return client.request<{ deleted: boolean }>(`${hooksBase(workspaceId)}/${endpointId}`, { method: "DELETE" });
}

export async function developersRotateWebhookSecret(
  client: ApiClient,
  workspaceId: string,
  endpointId: string
): Promise<WebhookEndpointCreated> {
  return client.request<WebhookEndpointCreated>(`${hooksBase(workspaceId)}/${endpointId}/rotate-secret`, {
    method: "POST",
  });
}

/** Sends a `webhook.test` event now; the answer says how the receiver responded. */
export async function developersTestWebhook(
  client: ApiClient,
  workspaceId: string,
  endpointId: string
): Promise<WebhookDeliveryDto> {
  const { delivery } = await client.request<{ delivery: WebhookDeliveryDto }>(
    `${hooksBase(workspaceId)}/${endpointId}/test`,
    { method: "POST" }
  );
  return delivery;
}

export async function developersListWebhookDeliveries(
  client: ApiClient,
  workspaceId: string,
  endpointId: string,
  opts: { limit?: number; status?: WebhookDeliveryStatus } = {}
): Promise<WebhookDeliveryDto[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.status) params.set("status", opts.status);
  const query = params.toString();
  const { deliveries } = await client.request<{ deliveries: WebhookDeliveryDto[] }>(
    `${hooksBase(workspaceId)}/${endpointId}/deliveries${query ? `?${query}` : ""}`
  );
  return deliveries;
}

export async function developersRedeliverWebhook(
  client: ApiClient,
  workspaceId: string,
  endpointId: string,
  deliveryId: string
): Promise<WebhookDeliveryDto> {
  const { delivery } = await client.request<{ delivery: WebhookDeliveryDto }>(
    `${hooksBase(workspaceId)}/${endpointId}/deliveries/${deliveryId}/redeliver`,
    { method: "POST" }
  );
  return delivery;
}
