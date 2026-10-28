import { useEffect, useMemo, useState } from "react";
import { BellRing, Share, X } from "lucide-react";
import { Button } from "@store-builder/ui";
import { pushListDevices } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { pushSupport, readFacts } from "@/lib/push/environment";
import { usePushConfig } from "@/lib/push/usePush";
import { IosInstallSteps } from "./PushHelp";

const STRINGS = {
  en: {
    text: "Get new orders on this iPhone or iPad: tap Share, then “Add to Home Screen”, and turn notifications on in the app.",
    how: "Show me how",
    hide: "Hide the steps",
    dismiss: "Dismiss",
  },
  ar: {
    text: "لتصلك الطلبات الجديدة على هذا الجهاز: اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وفعّل الإشعارات من التطبيق.",
    how: "اعرض الخطوات",
    hide: "إخفاء الخطوات",
    dismiss: "إغلاق",
  },
} satisfies Messages;

export const INSTALL_HINT_KEY = "zimos.push.installHint";

function dismissedBefore(): boolean {
  try {
    return localStorage.getItem(INSTALL_HINT_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/**
 * Above every dashboard page, on an iPhone or iPad in the browser only (where
 * Apple sends no notifications): how to add Zimos to the Home Screen. Closed
 * once, it stays closed on this device. Not shown when device notifications
 * are off (VITE_PUSH_ENABLED or the API), or when one of this account's Apple
 * devices already receives them (the app on the Home Screen).
 */
export function PushInstallBanner() {
  const config = usePushConfig();
  const support = useMemo(() => pushSupport(readFacts()), []);
  const [dismissed, setDismissed] = useState(dismissedBefore);
  const relevant = config.status === "on" && support === "ios-install" && !dismissed;
  if (!relevant) return null;
  return (
    <InstallBanner
      onDismiss={() => {
        try {
          localStorage.setItem(INSTALL_HINT_KEY, "dismissed");
        } catch {
          /* private mode: closed for this visit only */
        }
        setDismissed(true);
      }}
    />
  );
}

function InstallBanner({ onDismiss }: { onDismiss: () => void }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  // Already on in the Home Screen app: nothing to ask for.
  const [appHasIt, setAppHasIt] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    pushListDevices(apiClient, "dashboard").then(
      ({ subscriptions }) => live && setAppHasIt(subscriptions.some((device) => device.pushService === "apple" && device.enabled)),
      () => live && setAppHasIt(false)
    );
    return () => {
      live = false;
    };
  }, []);
  if (appHasIt !== false) return null;

  return (
    <div
      role="status"
      data-testid="push-install-banner"
      className="mb-4 rounded-[var(--radius-card)] border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-ink"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1">
          {t.text} <Share aria-hidden className="inline size-3.5 align-[-2px]" />
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.dismiss}
          className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <Button size="sm" variant="link" className="mt-1 px-0" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? t.hide : t.how}
      </Button>
      {open && (
        <div className="mt-2">
          <IosInstallSteps compact />
        </div>
      )}
    </div>
  );
}
