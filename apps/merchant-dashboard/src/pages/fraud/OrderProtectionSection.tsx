import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@store-builder/ui";
import { protectionAddBlocked, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { RiskBadge, useRiskReasonLabel, type OrderRiskFields } from "./RiskBadge";

const STRINGS = {
  en: {
    title: "Risk and origin",
    risk: "Risk",
    points: "{n} points",
    noReasons: "Nothing suspicious was found.",
    ip: "IP address",
    country: "Country",
    browser: "Browser",
    unknown: "Unknown",
    blockIp: "Block IP",
    device: "Device",
    blockDevice: "Block device",
    blockDeviceTitle: "Block this device?",
    blockDeviceDescription: "Orders placed from this browser will be flagged as blocked (or refused, if your rules say so), whatever number or address they use.",
    deviceBlocked: "The device is now blocked.",
    blockTitle: "Block {ip}?",
    blockDescription: "Orders from this address will be flagged as blocked (or refused, if your rules say so), and it will no longer see your store.",
    blocking: "Blocking…",
    cancel: "Cancel",
    blocked: "{ip} is now blocked.",
    blockReason: "Blocked from order {number}",
  },
  ar: {
    title: "الخطورة والمصدر",
    risk: "الخطورة",
    points: "{n} نقطة",
    noReasons: "لم يُعثر على شيء مريب.",
    ip: "عنوان IP",
    country: "الدولة",
    browser: "المتصفح",
    unknown: "غير معروف",
    blockIp: "حظر الـ IP",
    device: "الجهاز",
    blockDevice: "حظر الجهاز",
    blockDeviceTitle: "حظر هذا الجهاز؟",
    blockDeviceDescription: "الأوردرات من هذا المتصفح ستُميَّز كمحظورة (أو تُرفض إذا كانت قواعدك تقول ذلك) مهما كان الرقم أو العنوان المستخدم.",
    deviceBlocked: "تم حظر الجهاز.",
    blockTitle: "حظر {ip}؟",
    blockDescription: "الأوردرات من هذا العنوان ستُميَّز كمحظورة (أو تُرفض إذا كانت قواعدك تقول ذلك)، ولن يرى متجرك بعد الآن.",
    blocking: "جارٍ الحظر…",
    cancel: "إلغاء",
    blocked: "تم حظر {ip}.",
    blockReason: "حُظر من الأوردر {number}",
  },
} satisfies Messages;

/** What the protection layer recorded on an order; not in the shared Order type yet. */
interface OrderVisitorFields {
  ipAddress?: string | null;
  ipCountry?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
}

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Order page → the order's risk score with its reasons, and the shopper's
 * IP, country and browser with "Block IP". Renders nothing for an order that
 * has neither (staff orders, older ones). No delivery rate across stores or
 * "Report as spam": the server has neither (fraud/capabilities.js
 * networkDeliveryRate is unavailable), so nothing is asked for them.
 */
export function OrderProtectionSection({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const reasonLabel = useRiskReasonLabel();
  const [confirming, setConfirming] = useState(false);
  const [blockingDevice, setBlockingDevice] = useState(false);
  const extra = order as Order & OrderVisitorFields & OrderRiskFields;
  const ip: string = extra.ipAddress ?? "";
  const scored = Boolean(extra.riskLevel);
  if (!ip && !scored) return null;
  const locale = typeof document !== "undefined" && document.documentElement.lang ? document.documentElement.lang : "en";
  const reasons = extra.riskReasons ?? [];

  async function block() {
    try {
      await protectionAddBlocked(apiClient, workspaceId, {
        type: "ip",
        value: ip,
        scopes: ["orders", "visit"],
        reason: fmt(t.blockReason, { number: order.orderNumber }),
      });
    } catch (err) {
      // ConfirmDialog shows a thrown Error's message as-is.
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.blocked, { ip }));
    setConfirming(false);
  }

  async function blockDevice() {
    if (!extra.deviceId) return;
    try {
      await protectionAddBlocked(apiClient, workspaceId, {
        type: "device",
        value: extra.deviceId,
        scopes: ["orders"],
        reason: fmt(t.blockReason, { number: order.orderNumber }),
      });
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.deviceBlocked);
    setBlockingDevice(false);
  }

  return (
    <Section
      title={t.title}
      actions={
        ip ? (
          <Button variant="outline" size="sm" className="min-h-9" onClick={() => setConfirming(true)}>
            <Ban className="size-4" aria-hidden />
            {t.blockIp}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {scored && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-ink-soft">{t.risk}</span>
              <RiskBadge order={order} showLow />
              <span className="text-ink-soft">{fmt(t.points, { n: extra.riskScore ?? 0 })}</span>
            </div>
            {reasons.length > 0 ? (
              <ul className="list-disc space-y-0.5 ps-5 text-sm text-ink">
                {reasons.map((reason) => (
                  <li key={reason}>{reasonLabel(reason)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">{t.noReasons}</p>
            )}
          </div>
        )}
        {ip && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-soft">{t.ip}</dt>
              <dd className="font-medium text-ink">
                <bdi dir="ltr">{ip}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">{t.country}</dt>
              <dd className="font-medium text-ink">{extra.ipCountry ? countryName(extra.ipCountry, locale) : t.unknown}</dd>
            </div>
            {extra.deviceId && (
              <div className="min-w-0">
                <dt className="text-xs text-ink-soft">{t.device}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <bdi dir="ltr" className="truncate text-ink" title={extra.deviceId}>
                    {extra.deviceId.slice(0, 13)}…
                  </bdi>
                  <Button variant="outline" size="sm" className="min-h-8" onClick={() => setBlockingDevice(true)}>
                    {t.blockDevice}
                  </Button>
                </dd>
              </div>
            )}
            <div className="min-w-0">
              <dt className="text-xs text-ink-soft">{t.browser}</dt>
              <dd className="truncate text-ink" dir="ltr" title={extra.userAgent ?? undefined}>
                {extra.userAgent || t.unknown}
              </dd>
            </div>
          </dl>
        )}
      </div>
      <ConfirmDialog
        open={blockingDevice}
        title={t.blockDeviceTitle}
        description={t.blockDeviceDescription}
        confirmLabel={t.blockDevice}
        busyLabel={t.blocking}
        cancelLabel={t.cancel}
        onCancel={() => setBlockingDevice(false)}
        onConfirm={blockDevice}
      />
      <ConfirmDialog
        open={confirming}
        title={fmt(t.blockTitle, { ip })}
        description={t.blockDescription}
        confirmLabel={t.blockIp}
        busyLabel={t.blocking}
        cancelLabel={t.cancel}
        onCancel={() => setConfirming(false)}
        onConfirm={block}
      />
    </Section>
  );
}
