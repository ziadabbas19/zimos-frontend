import { useEffect, useMemo, useState } from "react";
import { BellRing, Share } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { pushListDevices, pushSendTest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useErrorMessage } from "@/lib/errorMessages";
import { pushSupport, readFacts } from "@/lib/push/environment";
import { enablePushHere, isOnHere } from "@/lib/push/pushClient";
import { promptDue, readPromptMemory, snoozePrompt } from "@/lib/push/promptMemory";
import { permissionNow, usePushConfig } from "@/lib/push/usePush";

// The dashboard's Arabic is Modern Standard Arabic.
const STRINGS = {
  en: {
    text: "Turn on device notifications to get new orders the moment they arrive.",
    enable: "Turn on notifications",
    notNow: "Not now",
    enabled: "Notifications are on.",
    ios: "On an iPhone or iPad (iOS 16.4 or later): tap Share, then “Add to Home Screen”, and open Zimos from there to turn notifications on.",
  },
  ar: {
    text: "فعّل إشعارات الجهاز لتصلك الطلبات الجديدة فورًا.",
    enable: "فعّل الإشعارات",
    notNow: "ليس الآن",
    enabled: "تم تفعيل الإشعارات.",
    ios: "على iPhone أو iPad (iOS 16.4 أو أحدث): اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتح Zimos من هناك لتفعيل الإشعارات.",
  },
} satisfies Messages;

/**
 * At the top of the home page only: a small card that offers device
 * notifications in one press, so nobody has to find them in Settings.
 *
 * Shown when push is on (VITE_PUSH_ENABLED and the API's /me/push/config),
 * the person is in a store (as Settings → My notifications is), the browser
 * can receive pushes, this browser is not subscribed for them yet and the
 * browser has not been asked (permission "default"). On an iPhone or iPad in
 * the browser it shows how to add Zimos to the Home Screen instead, unless an
 * Apple device of theirs already receives them.
 *
 * The browser's permission is asked for only from "Turn on notifications",
 * through the same enablePushHere as Settings. Allowed: the card goes, a toast
 * says so and a test notification is sent. Refused: the card goes for good
 * (the browser no longer says "default"; Settings explains how to unblock).
 * "Not now" (or closing the browser's own prompt) hides it for 7 days on this
 * device; after the third it is not offered again. Turning on from Settings
 * stays available whatever happens here.
 */
export function PushPrompt({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { locale } = useLocale();
  const { user, status } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const config = usePushConfig();
  const support = useMemo(() => pushSupport(readFacts()), []);
  // Read once, when the page opens: storage works, and "Not now" is not holding it back.
  const [due] = useState(() => promptDue(readPromptMemory(), Date.now()));
  const [subscribedHere, setSubscribedHere] = useState<boolean | null>(null);
  const [appleOn, setAppleOn] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const userId = status === "authenticated" ? (user?.id ?? null) : null;
  const relevant = config.status === "on" && Boolean(userId) && Boolean(currentWorkspace) && due;

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
    pushListDevices(apiClient, "dashboard").then(
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
      toast.error(errorMessage(err));
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
