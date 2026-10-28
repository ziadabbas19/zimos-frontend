/**
 * Device notifications (Web Push) — the signed-in account's own browsers
 * (backend: src/modules/notifications/push/, mounted at /me/push, in no store).
 *
 * The whole route answers 404 while the API runs without PUSH_ENABLED and a
 * VAPID pair: treat a 404 from `pushGetConfig` as "push is off". Endpoints and
 * keys go up once and never come back down. All exported names are prefixed
 * `push` / `Push`.
 */
import type { ApiClient } from "../client";

/** Which site the browser subscribed from: the dashboard, or the console (console accounts only). */
export type PushApp = "dashboard" | "console";

export interface PushConfig {
  enabled: true;
  /** The VAPID public key (base64url) to subscribe with. */
  publicKey: string;
}

/** One of my devices. Never carries the endpoint or the keys. */
export interface PushDevice {
  id: string;
  app: PushApp;
  /** e.g. "Chrome on Windows", from the user agent; null when it could not be told. */
  deviceLabel: string | null;
  pushService: "fcm" | "mozilla" | "apple" | "windows";
  locale: "ar" | "en";
  /** Off by the person, or after five failed sends in a row. */
  enabled: boolean;
  /** Subscribed under the session that is asking: this browser. */
  current: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastSeenAt: string;
  createdAt: string;
}

/** What PushSubscription.toJSON() gives, as the API takes it. */
export interface PushSubscriptionInput {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
}

export type PushTestOutcome = "sent" | "gone" | "retry" | "failed" | "off" | "disabled";

export interface PushTestResult {
  sent: number;
  results: Array<{ id: string; outcome: PushTestOutcome }>;
}

export async function pushGetConfig(client: ApiClient): Promise<PushConfig> {
  return client.request<PushConfig>("/me/push/config");
}

/** This browser subscribed (again): refreshes its keys and binds it to this session. */
export async function pushSubscribe(
  client: ApiClient,
  body: { app: PushApp; subscription: PushSubscriptionInput; locale: "ar" | "en" }
): Promise<{ subscription: PushDevice }> {
  return client.request("/me/push/subscriptions", { method: "PUT", body });
}

export async function pushListDevices(client: ApiClient, app?: PushApp): Promise<{ subscriptions: PushDevice[] }> {
  return client.request(`/me/push/subscriptions${app ? `?app=${app}` : ""}`);
}

export async function pushSetDeviceEnabled(client: ApiClient, id: string, enabled: boolean): Promise<{ subscription: PushDevice }> {
  return client.request(`/me/push/subscriptions/${encodeURIComponent(id)}`, { method: "PATCH", body: { enabled } });
}

export async function pushRemoveDevice(client: ApiClient, id: string): Promise<{ success: true }> {
  return client.request(`/me/push/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** A test notification to one of my devices (`id`), or to this browser. 5 a minute. */
export async function pushSendTest(client: ApiClient, id?: string): Promise<PushTestResult> {
  return client.request("/me/push/test", { method: "POST", body: id ? { id } : {} });
}
