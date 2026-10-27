import { apiClient } from "@/lib/apiClient";

/** The console's notifications (backend platformAdmin/platformNotificationService). */
export type NotificationType =
  | "user_signup"
  | "workspace_created"
  | "subscription_activated"
  | "subscription_expiring"
  | "subscription_expired"
  | "payment_proof_submitted"
  | "payment_failed"
  | "support_ticket"
  | "referral_signup"
  | "user_suspended"
  | "suggestion"
  | "wallet_fallback"
  // A store went over its daily analytics limit (Store traffic, protection tab).
  | "traffic_cap"
  // The platform, or one store, reached its daily SMS cap (SMS_PLATFORM_DAILY_CAP / SMS_STORE_DAILY_CAP).
  | "sms_cap";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "user_signup",
  "workspace_created",
  "subscription_activated",
  "subscription_expiring",
  "subscription_expired",
  "payment_proof_submitted",
  "payment_failed",
  "support_ticket",
  "referral_signup",
  "user_suspended",
  "suggestion",
  "wallet_fallback",
  "traffic_cap",
  "sms_cap",
];

export interface ConsoleNotification {
  id: string;
  type: NotificationType;
  /** English fallback; the console shows its own label for the type. */
  title: string;
  body: string | null;
  /** A console path, e.g. /workspaces/<id>. */
  link: string | null;
  data: Record<string, unknown>;
  workspaceId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  notifications: ConsoleNotification[];
  nextCursor: string | null;
  unread: number;
}

export interface NotificationPref {
  type: NotificationType;
  enabled: boolean;
  email: boolean;
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q ? `?${q}` : "";
}

export function listNotifications(params: { type?: NotificationType; unread?: boolean; cursor?: string; limit?: number } = {}) {
  return apiClient.request<NotificationPage>(`/admin/notifications${query(params)}`);
}

export async function unreadCount() {
  return (await apiClient.request<{ unread: number }>("/admin/notifications/unread-count")).unread;
}

export function markRead(body: { ids: string[] } | { all: true }) {
  return apiClient.request<{ unread: number }>("/admin/notifications/read", { method: "POST", body });
}

export function getPrefs() {
  return apiClient.request<{ prefs: NotificationPref[]; emailDelivery: boolean }>("/admin/notification-prefs");
}

export function savePrefs(prefs: NotificationPref[]) {
  return apiClient.request<{ prefs: NotificationPref[]; emailDelivery: boolean }>("/admin/notification-prefs", { method: "PUT", body: { prefs } });
}
