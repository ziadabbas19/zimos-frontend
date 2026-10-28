import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  notificationsGetPreferences,
  notificationsUpdatePreferences,
  type MerchantNotificationChannel,
  type MerchantNotificationPreferences,
  type MerchantNotificationType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { NOTIFICATION_STRINGS, notificationTypeLabel } from "@/lib/notificationText";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { usePushConfig } from "@/lib/push/usePush";

const STRINGS = {
  en: {
    title: "My notifications",
    description: "Choose what you are told about in this store and where. These choices are yours alone — each teammate sets their own.",
    type: "Notify me about",
    inApp: "In the dashboard",
    email: "By email",
    push: "Push",
    whatsapp: "WhatsApp",
    whatsappHint: "WhatsApp messages go to your verified phone number.",
    whatsappNoPhone: "Verify your phone number under “Your account” to get notifications on WhatsApp.",
    sound: "Play a sound when a new order arrives",
    soundHint: "Rings while the dashboard is open in a browser tab.",
    saved: "Notification settings saved.",
    channelFor: "{channel}: {type}",
  },
  ar: {
    title: "إشعاراتي",
    description: "اختر ما تريد أن يصلك في هذا المتجر وأين. هذه الاختيارات تخصك وحدك، ولكل عضو في الفريق اختياراته.",
    type: "أبلغني عن",
    inApp: "داخل لوحة التحكم",
    email: "بالبريد الإلكتروني",
    push: "إشعار على الجهاز",
    whatsapp: "واتساب",
    whatsappHint: "رسائل واتساب تصل إلى رقم هاتفك المؤكد.",
    whatsappNoPhone: "أكّد رقم هاتفك من «حسابك» لتصلك الإشعارات على واتساب.",
    sound: "تشغيل صوت عند وصول طلب جديد",
    soundHint: "يعمل طالما لوحة التحكم مفتوحة في المتصفح.",
    saved: "تم حفظ إعدادات الإشعارات.",
    channelFor: "{channel}: {type}",
  },
} satisfies Messages;

/** Settings → "My notifications": per-teammate types × channels and the new-order sound. */
export function NotificationPreferencesSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const location = useLocation();
  const ref = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);

  const { data, error, loading, refresh, setData } = useAsync<MerchantNotificationPreferences>(
    () => notificationsGetPreferences(apiClient, workspaceId),
    [workspaceId]
  );

  // The bell's "Notification settings" link lands here.
  useEffect(() => {
    if (location.hash === "#notifications" && !loading) ref.current?.scrollIntoView({ block: "start" });
  }, [location.hash, loading]);

  async function save(patch: Parameters<typeof notificationsUpdatePreferences>[2], optimistic: MerchantNotificationPreferences) {
    const previous = data;
    setData(optimistic);
    setSaving(true);
    try {
      setData(await notificationsUpdatePreferences(apiClient, workspaceId, patch));
      toast.success(t.saved);
    } catch (err) {
      if (previous) setData(previous);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function toggle(type: MerchantNotificationType, channel: MerchantNotificationChannel, value: boolean) {
    if (!data) return;
    void save(
      { types: [{ type, [channel]: value }] },
      { ...data, types: data.types.map((row) => (row.type === type ? { ...row, [channel]: value } : row)) }
    );
  }

  const channelLabel = (channel: MerchantNotificationChannel) =>
    channel === "inApp" ? t.inApp : channel === "push" ? t.push : channel === "whatsapp" ? t.whatsapp : t.email;
  const { user } = useAuth();
  const phoneVerified = Boolean(user?.phoneVerifiedAt);
  // The "Push" column only while device notifications are on here (VITE_PUSH_ENABLED)
  // and at the API (/me/push/config): an API that offers it before this dashboard can
  // turn them on would show a column with no way to use it.
  const pushConfig = usePushConfig();
  const channels = (data?.channels ?? []).filter((channel) => channel !== "push" || pushConfig.status === "on");

  return (
    <section ref={ref} id="notifications" className="scroll-mt-6 rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <div className="mt-4">
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {data && (
            <div className="space-y-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-ink-soft">
                      <th scope="col" className="py-2 pe-3 text-start font-medium">
                        {t.type}
                      </th>
                      {channels.map((channel) => (
                        <th key={channel} scope="col" className="px-3 py-2 text-center font-medium">
                          {channelLabel(channel)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.types.map((row) => {
                      const label = notificationTypeLabel(nt, row.type);
                      return (
                        <tr key={row.type}>
                          <th scope="row" className="py-3 pe-3 text-start font-normal text-ink">
                            {label}
                          </th>
                          {channels.map((channel) => (
                            <td key={channel} className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                className="size-4 cursor-pointer accent-primary"
                                checked={row[channel]}
                                disabled={saving}
                                aria-label={t.channelFor.replace("{channel}", channelLabel(channel)).replace("{type}", label)}
                                onChange={(e) => toggle(row.type, channel, e.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.channels.includes("whatsapp") && (
                <p className="text-xs text-ink-soft">{phoneVerified ? t.whatsappHint : t.whatsappNoPhone}</p>
              )}

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 cursor-pointer accent-primary"
                  checked={data.soundEnabled}
                  disabled={saving}
                  onChange={(e) => void save({ soundEnabled: e.target.checked }, { ...data, soundEnabled: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{t.sound}</span>
                  <span className="block text-xs text-ink-soft">{t.soundHint}</span>
                </span>
              </label>
            </div>
          )}
        </DataState>
      </div>
    </section>
  );
}
