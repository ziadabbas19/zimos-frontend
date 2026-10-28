import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { PUSH_ENABLED } from "@/lib/features";
import { attachManifest, listenToWorker, loadPushConfig, removeStaleWorker, syncPushHere } from "@/lib/push/pushClient";
// The browser's install offer is fired once, early: listened for from the start.
import "@/lib/push/installPrompt";

/**
 * Device notifications in the dashboard's frame; renders nothing.
 *
 *  - VITE_PUSH_ENABLED off: a notifications worker kept from an earlier build
 *    is unregistered, and nothing else happens.
 *  - On, once the API's /me/push/config answers: the app manifest is linked;
 *    this browser's subscription, if it has one, is sent again (the current
 *    session, the language of the texts, a renewed key); a clicked
 *    notification opens its page here (public/sw.js posts it), and a renewed
 *    subscription is sent again.
 */
export function PushBridge() {
  const { user, status } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const userId = status === "authenticated" ? (user?.id ?? null) : null;

  useEffect(() => {
    if (!PUSH_ENABLED) {
      void removeStaleWorker().catch(() => undefined);
      return;
    }
    if (!userId) return;
    let live = true;
    const sync = () => void syncPushHere({ userId, locale }).catch(() => undefined);
    loadPushConfig().then(
      (config) => {
        if (live && config) attachManifest();
      },
      () => undefined
    );
    sync();
    const stop = listenToWorker({ open: (url) => navigate(url), changed: sync });
    return () => {
      live = false;
      stop();
    };
  }, [userId, locale, navigate]);

  return null;
}
