/**
 * Merchant notifications — the bell in the dashboard header (backend:
 * src/modules/notifications/merchantNotification*.js).
 *
 * Mounted at /workspaces/:workspaceId/notifications. Every active teammate
 * may call these; each sees only their own notifications, and only the types
 * their role may receive. All exported names are prefixed `notifications` /
 * `MerchantNotification`.
 *
 * `title` and `body` are in the store's language (Arabic). `data` carries the
 * values they were built from, so the dashboard can render a known `type` in
 * the viewer's language and fall back to title/body for anything else.
 */
import type { ApiClient } from "../client";

export type MerchantNotificationType =
  | "order.new"
  // The three below exist only while the API's device notifications are on (PUSH_ENABLED).
  | "order.paid" // paid online or by an approved transfer, not cash on delivery
  | "lost_order.new"
  | "whatsapp.message" // device notifications only: never a bell row
  | "order.suspicious"
  | "stock.low"
  | "integration.failed"
  | "export.ready"
  | "shipping.batch_done"
  | "wallet.low"
  | "wallet.limit_reached"
  | "wallet.refund"
  | "wallet.credit"
  | "wallet.fallback"
  | "announcement"
  | "automation";

/** whatsapp: from the platform's number to the teammate's verified phone (off until turned on). */
export type MerchantNotificationChannel = "inApp" | "email" | "push" | "whatsapp";

export interface MerchantNotificationDto {
  id: string;
  /** One of MerchantNotificationType; typed loosely so a newer backend type still renders. */
  type: MerchantNotificationType | (string & {});
  title: string;
  body: string | null;
  /** A dashboard path such as `/orders/<id>`, or null. */
  link: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface MerchantNotificationList {
  notifications: MerchantNotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface MerchantNotificationSummary {
  unreadCount: number;
  /** When the newest new-order notification arrived; the bell rings when this moves forward. */
  latestOrderNotificationAt: string | null;
  soundEnabled: boolean;
}

export interface MerchantNotificationTypePreference {
  type: MerchantNotificationType;
  inApp: boolean;
  email: boolean;
  /** Push to the person's devices (notifications/push). */
  push: boolean;
  /** WhatsApp to the person's verified phone; false until turned on. */
  whatsapp: boolean;
  /** The only channels this type has (`["push"]` for whatsapp.message); absent = every channel. */
  only?: MerchantNotificationChannel[];
}

export interface MerchantNotificationPreferences {
  soundEnabled: boolean;
  channels: MerchantNotificationChannel[];
  /** Only the types this teammate's role may receive. */
  types: MerchantNotificationTypePreference[];
}

export interface MerchantNotificationPreferencesPatch {
  soundEnabled?: boolean;
  types?: Array<{ type: MerchantNotificationType; inApp?: boolean; email?: boolean }>;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/notifications`;

export async function notificationsList(
  client: ApiClient,
  workspaceId: string,
  params: { limit?: number; cursor?: string | null; unread?: boolean } = {}
): Promise<MerchantNotificationList> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.unread) query.set("unread", "true");
  const qs = query.toString();
  return client.request<MerchantNotificationList>(`${base(workspaceId)}${qs ? `?${qs}` : ""}`);
}

export async function notificationsSummary(client: ApiClient, workspaceId: string): Promise<MerchantNotificationSummary> {
  return client.request<MerchantNotificationSummary>(`${base(workspaceId)}/summary`);
}

export async function notificationsMarkRead(
  client: ApiClient,
  workspaceId: string,
  notificationId: string
): Promise<{ notification: MerchantNotificationDto; unreadCount: number }> {
  return client.request(`${base(workspaceId)}/${notificationId}/read`, { method: "POST" });
}

export async function notificationsMarkAllRead(
  client: ApiClient,
  workspaceId: string
): Promise<{ updated: number; unreadCount: number }> {
  return client.request(`${base(workspaceId)}/read-all`, { method: "POST" });
}

export async function notificationsGetPreferences(
  client: ApiClient,
  workspaceId: string
): Promise<MerchantNotificationPreferences> {
  return client.request<MerchantNotificationPreferences>(`${base(workspaceId)}/preferences`);
}

export async function notificationsUpdatePreferences(
  client: ApiClient,
  workspaceId: string,
  patch: MerchantNotificationPreferencesPatch
): Promise<MerchantNotificationPreferences> {
  return client.request<MerchantNotificationPreferences>(`${base(workspaceId)}/preferences`, { method: "PUT", body: patch });
}
