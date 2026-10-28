import { useState } from "react";
import { BellRing, Download, Monitor, Send, Smartphone, Trash2 } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { ApiError, pushRemoveDevice, pushSendTest, pushSetDeviceEnabled, type PushConfig, type PushDevice, type PushTestResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatRelativeTime } from "@/lib/relativeTime";
import { BlockedSteps, IosInstallSteps } from "@/components/push/PushHelp";
import { disablePushHere, enablePushHere } from "@/lib/push/pushClient";
import { useInstallPrompt } from "@/lib/push/installPrompt";
import { usePushConfig, usePushHere } from "@/lib/push/usePush";

const STRINGS = {
  en: {
    title: "Notifications on this device",
    description: "New orders and alerts reach this device even while the dashboard is closed. Choose which ones under “My notifications” below.",
    turnOn: "Turn on for this device",
    turningOn: "Turning on…",
    on: "On for this device.",
    turnOff: "Turn off for this device",
    test: "Try a notification",
    testSent: "Test notification sent. It should appear within a few seconds.",
    testGone: "This device no longer receives notifications, so it was removed.",
    testFailed: "The notification could not be delivered. Try again later.",
    dismissed: "Notifications were not allowed. Turn them on again when you are ready.",
    iosOld: "This iPhone or iPad cannot receive device notifications: they need iOS 16.4 or later.",
    unsupported: "This browser cannot receive device notifications. Use Chrome, Edge, Firefox or Safari (not a browser inside another app).",
    installTip: "Tip: install the dashboard as an app, to open it in one tap.",
    install: "Install the app",
    devices: "My devices",
    devicesHint: "Every browser where you turned notifications on, for this account.",
    noDevices: "No device yet.",
    unknownDevice: "Unknown device",
    thisDevice: "This device",
    lastSent: "Last notification: {when}",
    neverSent: "No notification yet",
    deviceOn: "Notifications on {device}",
    remove: "Remove",
    removeLabel: "Remove {device}",
    testLabel: "Try a notification on {device}",
    removed: "Device removed.",
  },
  ar: {
    title: "إشعارات الجهاز",
    description: "تصلك الطلبات الجديدة والتنبيهات على هذا الجهاز حتى لو كانت لوحة التحكم مغلقة. اختر ما يصلك منها في «إشعاراتي» بالأسفل.",
    turnOn: "تفعيل على هذا الجهاز",
    turningOn: "جارٍ التفعيل…",
    on: "مفعّلة على هذا الجهاز.",
    turnOff: "إيقاف على هذا الجهاز",
    test: "جرّب إشعارًا",
    testSent: "أُرسل إشعار تجريبي. سيظهر خلال ثوانٍ.",
    testGone: "لم يعد هذا الجهاز يستقبل الإشعارات، فأُزيل.",
    testFailed: "تعذّر توصيل الإشعار. حاول مرة أخرى لاحقًا.",
    dismissed: "لم يُسمح بالإشعارات. فعّلها مرة أخرى عندما تكون مستعدًا.",
    iosOld: "هذا الجهاز لا يدعم إشعارات الجهاز: تحتاج إلى iOS 16.4 أو أحدث.",
    unsupported: "هذا المتصفح لا يستقبل إشعارات الجهاز. استخدم Chrome أو Edge أو Firefox أو Safari (وليس متصفحًا داخل تطبيق آخر).",
    installTip: "نصيحة: ثبّت لوحة التحكم كتطبيق لتفتحها بضغطة واحدة.",
    install: "ثبّت التطبيق",
    devices: "أجهزتي",
    devicesHint: "كل متصفح فعّلت عليه الإشعارات لهذا الحساب.",
    noDevices: "لا توجد أجهزة بعد.",
    unknownDevice: "جهاز غير معروف",
    thisDevice: "هذا الجهاز",
    lastSent: "آخر إشعار: {when}",
    neverSent: "لم يصل إشعار بعد",
    deviceOn: "الإشعارات على {device}",
    remove: "إزالة",
    removeLabel: "إزالة {device}",
    testLabel: "جرّب إشعارًا على {device}",
    removed: "أُزيل الجهاز.",
  },
} satisfies Messages;

/**
 * Settings → My notifications: device notifications for this browser (turn
 * on / off, a test, the install advice, how to unblock them) and "My devices".
 * Nothing at all while VITE_PUSH_ENABLED is off or the API's /me/push/config
 * answers 404. Which notification types reach a device is the "Push" column
 * of the section below it (per store).
 */
export function PushDeviceSection() {
  const config = usePushConfig();
  if (config.status !== "on") return null;
  return <PushDeviceView config={config.config} />;
}

function PushDeviceView({ config }: { config: PushConfig }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { locale } = useLocale();
  const { user } = useAuth();
  const here = usePushHere(user?.id ?? null, true);
  const installPrompt = useInstallPrompt();
  const [busy, setBusy] = useState<string | null>(null);

  const thisDevice = here.devices?.find((device) => device.current) ?? null;
  const on = here.on === true;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
      await here.refresh();
    }
  }

  const turnOn = () =>
    run("on", async () => {
      if (!user) return;
      const result = await enablePushHere(config, { userId: user.id, locale });
      if (result.outcome === "denied") here.setPermission("denied");
      else if (result.outcome === "dismissed") toast.error(t.dismissed);
    });

  const turnOff = () => run("off", () => disablePushHere(thisDevice?.id ?? null));

  function tellTest(result: PushTestResult) {
    const outcome = result.results[0]?.outcome;
    if (result.sent > 0) toast.success(t.testSent);
    else if (outcome === "gone") toast.error(t.testGone);
    else toast.error(t.testFailed);
  }

  const test = (id?: string) =>
    run(`test:${id ?? "here"}`, async () => {
      tellTest(await pushSendTest(apiClient, id));
    });

  const remove = (device: PushDevice) =>
    run(`remove:${device.id}`, async () => {
      if (device.current) await disablePushHere(device.id);
      else
        await pushRemoveDevice(apiClient, device.id).catch((err: unknown) => {
          if (!(err instanceof ApiError && err.status === 404)) throw err;
        });
      toast.success(t.removed);
    });

  const toggle = (device: PushDevice) =>
    run(`toggle:${device.id}`, async () => {
      await pushSetDeviceEnabled(apiClient, device.id, !device.enabled);
    });

  const labelOf = (device: PushDevice) => device.deviceLabel ?? t.unknownDevice;
  const blocked = here.permission === "denied";
  const showInstallTip = !on && !here.standalone && installPrompt.available && (here.platform === "android" || here.platform === "windows");

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5" data-testid="push-device-section">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink">
        <BellRing aria-hidden className="size-5 text-primary" />
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 space-y-4">
        {here.support === "ios-old" && <p className="text-sm text-ink">{t.iosOld}</p>}
        {here.support === "unsupported" && <p className="text-sm text-ink">{t.unsupported}</p>}
        {here.support === "ios-install" && <IosInstallSteps />}

        {here.support === "ready" && here.on !== null && (
          <div className="space-y-3">
            {on ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="me-auto text-sm font-medium text-ink">{t.on}</p>
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void test()}>
                  <Send aria-hidden />
                  {t.test}
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void turnOff()}>
                  {t.turnOff}
                </Button>
              </div>
            ) : blocked ? (
              <BlockedSteps platform={here.platform} />
            ) : (
              <Button className="min-h-11 w-full sm:w-auto" disabled={busy !== null} onClick={() => void turnOn()}>
                <BellRing aria-hidden />
                {busy === "on" ? t.turningOn : t.turnOn}
              </Button>
            )}
          </div>
        )}

        {showInstallTip && (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-paper-sunken p-3 text-sm text-ink" data-testid="push-install-tip">
            <p className="min-w-0 flex-1">{t.installTip}</p>
            <Button size="sm" variant="outline" onClick={() => void installPrompt.install()}>
              <Download aria-hidden />
              {t.install}
            </Button>
          </div>
        )}

        {here.devices && (
          <div>
            <h3 className="text-sm font-medium text-ink">{t.devices}</h3>
            <p className="text-xs text-ink-soft">{t.devicesHint}</p>
            {here.devices.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">{t.noDevices}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line" data-testid="push-devices">
                {here.devices.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    label={labelOf(device)}
                    busy={busy !== null}
                    onToggle={() => void toggle(device)}
                    onTest={() => void test(device.id)}
                    onRemove={() => void remove(device)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DeviceRow({
  device,
  label,
  busy,
  onToggle,
  onTest,
  onRemove,
}: {
  device: PushDevice;
  label: string;
  busy: boolean;
  onToggle: () => void;
  onTest: () => void;
  onRemove: () => void;
}) {
  const t = useT(STRINGS);
  const Icon = /Android|iOS/.test(label) ? Smartphone : Monitor;
  const fill = (template: string) => template.replace("{device}", label);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-testid="push-device">
      <Icon aria-hidden className="size-5 shrink-0 text-ink-soft" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span dir="ltr">{label}</span>
          {device.current && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-dark">{t.thisDevice}</span>}
        </p>
        <p className="text-xs text-ink-soft">
          {device.lastSuccessAt ? t.lastSent.replace("{when}", formatRelativeTime(device.lastSuccessAt)) : t.neverSent}
        </p>
      </div>
      <Button size="sm" variant="ghost" disabled={busy || !device.enabled} aria-label={fill(t.testLabel)} onClick={onTest}>
        <Send aria-hidden />
        <span className="sr-only sm:not-sr-only">{t.test}</span>
      </Button>
      <button
        type="button"
        role="switch"
        aria-checked={device.enabled}
        aria-label={fill(t.deviceOn)}
        disabled={busy}
        onClick={onToggle}
        className="group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden
          className={cn(
            "relative h-6 w-11 rounded-full border transition-colors motion-reduce:transition-none",
            "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
            device.enabled ? "border-primary bg-primary" : "border-line-strong bg-paper"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start] motion-reduce:transition-none",
              device.enabled ? "start-[1.375rem]" : "start-0.5"
            )}
          />
        </span>
      </button>
      <Button size="sm" variant="ghost" disabled={busy} aria-label={fill(t.removeLabel)} onClick={onRemove}>
        <Trash2 aria-hidden />
        <span className="sr-only sm:not-sr-only">{t.remove}</span>
      </Button>
    </li>
  );
}
