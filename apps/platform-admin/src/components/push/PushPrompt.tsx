import { useEffect, useMemo, useState } from "react";
import { BellRing, Share } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { pushListDevices, pushSendTest } from "@store-builder/api-client";
import { promptDue, pushSupport, readFacts, readPromptMemory, snoozePrompt } from "@store-builder/ui/push";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/errors";
import { enablePushHere, isOnHere } from "@/lib/push/pushClient";
import { permissionNow, usePushConfig } from "@/lib/push/usePush";

// The console's Arabic is Modern Standard Arabic, as the dashboard's.
const STRINGS = {
  en: {
    text: "Turn on device notifications on this phone or computer to hear of sign-ups, payments and tickets the moment they come in.",
    enable: "Turn on notifications",
    notNow: "Not now",
    enabled: "Notifications are on.",
    ios: "On an iPhone or iPad (iOS 16.4 or later): tap Share, then “Add to Home Screen”, and open Zimos Admin from there to turn notifications on.",
  },
  ar: {
    text: "فعّل إشعارات الجهاز على هذا الهاتف أو الكمبيوتر لتصلك التسجيلات والمدفوعات والتذاكر فور وصولها.",
    enable: "فعّل الإشعارات",
    notNow: "ليس الآن",
    enabled: "تم تفعيل الإشعارات.",
    ios: "على iPhone أو iPad (iOS 16.4 أو أحدث): اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتح Zimos Admin من هناك لتفعيل الإشعارات.",
  },
} satisfies Messages;

/**
 * At the top of the account's first page only: the merchant dashboard's offer
 * of device notifications (its components/push/PushPrompt.tsx), in one press.
 *
 * Shown when push is on (VITE_CONSOLE_PUSH_ENABLED and the API's
 * /me/push/config), the browser can receive pushes, this browser is not
 * subscribed for this account yet and the browser has not been asked
 * (permission "default"). On an iPhone or iPad in the browser it shows how to
 * add the console to the Home Screen instead, unless an Apple device of theirs
 * already receives them.
 *
 * The browser's permission is asked for only from "Turn on notifications",
 * through the same enablePushHere as the Notifications page. Allowed: the card
 * goes, a toast says so and a test notification is sent. Refused: the card goes
 * for good (the browser no longer says "default"; the Notifications page
 * explains how to unblock). "Not now" (or closing the browser's own prompt)
 * hides it for 7 days on this device; after the third it is not offered again.
 */
export function PushPrompt({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const { locale } = useLocale();
  const { user, status } = useAuth();
  const config = usePushConfig();
  const support = useMemo(() => pushSupport(readFacts()), []);
  // Read once, when the page opens: storage works, and "Not now" is not holding it back.
  const [due] = useState(() => promptDue(readPromptMemory(), Date.now()));
  const [subscribedHere, setSubscribedHere] = useState<boolean | null>(null);
  const [appleOn, setAppleOn] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const userId = status === "authenticated" ? (user?.id ?? null) : null;
  const relevant = config.status === "on" && Boolean(userId) && due;

  // This browser already receives this account's notifications?
  useEffect(() => {
    if (!relevant || support !== "ready" || !userId) return;
    let live = true;
    isOnHere(userId).then(
      (on) => live && setSubscribedHere(on),
      () => live && setSubscribedHere(true)
    );
    return () => {
      live = false;
    };
  }, [relevant, support, userId]);

  // On an iPhone in the browser: the Home Screen app may already receive them.
  useEffect(() => {
    if (!relevant || support !== "ios-install") return;
    let live = true;
    pushListDevices(apiClient, "console").then(
      ({ subscriptions }) => live && setAppleOn(subscriptions.some((device) => device.pushService === "apple" && device.enabled)),
      () => live && setAppleOn(true)
    );
    return () => {
      live = false;
    };
  }, [relevant, support]);

  function notNow() {
    snoozePrompt(Date.now());
    setHidden(true);
  }

  async function enable() {
    if (config.status !== "on" || !userId) return;
    setBusy(true);
    try {
      const result = await enablePushHere(config.config, { userId, locale });
      if (result.outcome === "on") {
        setHidden(true);
        toast.success(t.enabled);
        // The device that was just subscribed says it works (POST /me/push/test). Best effort.
        void pushSendTest(apiClient).catch(() => undefined);
      } else if (result.outcome === "denied") {
        // The browser says "denied" from now on: the card does not come back.
        setHidden(true);
      } else {
        notNow();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (hidden || !relevant) return null;
  const ios = support === "ios-install";
  if (ios ? appleOn !== false : support !== "ready" || subscribedHere !== false || permissionNow() !== "default") return null;

  return (
    <div
      role="region"
      aria-label={t.enable}
      data-testid="push-prompt"
      className={cn("flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-ink", className)}
    >
      <BellRing className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">
        {ios ? (
          <>
            {t.ios} <Share aria-hidden className="inline size-3.5 align-[-2px]" />
          </>
        ) : (
          t.text
        )}
      </p>
      <div className="flex w-full gap-2 sm:w-auto">
        {!ios && (
          <Button size="sm" className="min-h-11 flex-1 sm:flex-none" disabled={busy} onClick={() => void enable()}>
            {t.enable}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="min-h-11 flex-1 sm:flex-none" disabled={busy} onClick={notNow}>
          {t.notNow}
        </Button>
      </div>
    </div>
  );
}
