import { Lock, Plus, Share, SquarePlus } from "lucide-react";
import { useT, type Messages } from "@/i18n/LocaleContext";
import type { Platform } from "@/lib/push/environment";

const STRINGS = {
  en: {
    iosTitle: "Add Zimos to your Home Screen first",
    iosWhy: "On an iPhone or iPad, Apple sends notifications only to apps on the Home Screen, not to a page open in the browser.",
    iosStep1: "Tap Share in the browser's toolbar.",
    iosStep2: "Choose “Add to Home Screen”, then Add.",
    iosStep3: "Open Zimos from the Home Screen, sign in, and turn notifications on there.",
    illustration: "Share, then Add to Home Screen",
    addToHome: "Add to Home Screen",
    blockedTitle: "Notifications are blocked for this site",
    blockedDesktop1: "Click the lock (or the settings icon) at the start of the address bar.",
    blockedDesktop2: "Open “Site settings” or “Permissions”, and set Notifications to Allow.",
    blockedDesktop3: "Reload this page, then turn notifications on here.",
    blockedIos: "On an iPhone or iPad: Settings → Notifications → Zimos → Allow Notifications.",
    blockedMac: "In Safari on a Mac: Safari → Settings → Websites → Notifications, and allow this site.",
    blockedAndroid: "On Android: tap the lock beside the address → Permissions (or Site settings) → Notifications → Allow.",
  },
  ar: {
    iosTitle: "أضف Zimos إلى الشاشة الرئيسية أولًا",
    iosWhy: "على iPhone وiPad لا ترسل Apple الإشعارات إلا للتطبيقات المضافة إلى الشاشة الرئيسية، لا لصفحة مفتوحة في المتصفح.",
    iosStep1: "اضغط زر المشاركة في شريط أدوات المتصفح.",
    iosStep2: "اختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen)، ثم «إضافة».",
    iosStep3: "افتح Zimos من الشاشة الرئيسية، وسجّل الدخول، وفعّل الإشعارات من هناك.",
    illustration: "مشاركة، ثم إضافة إلى الشاشة الرئيسية",
    addToHome: "Add to Home Screen",
    blockedTitle: "الإشعارات محظورة لهذا الموقع",
    blockedDesktop1: "اضغط القفل (أو أيقونة الإعدادات) في بداية شريط العنوان.",
    blockedDesktop2: "افتح «إعدادات الموقع» أو «الأذونات»، واجعل الإشعارات «سماح».",
    blockedDesktop3: "أعد تحميل الصفحة، ثم فعّل الإشعارات من هنا.",
    blockedIos: "على iPhone أو iPad: الإعدادات ← الإشعارات ← Zimos ← السماح بالإشعارات.",
    blockedMac: "في Safari على Mac: Safari ← الإعدادات ← مواقع الويب ← الإشعارات، واسمح لهذا الموقع.",
    blockedAndroid: "على Android: اضغط القفل بجوار العنوان ← الأذونات (أو إعدادات الموقع) ← الإشعارات ← سماح.",
  },
} satisfies Messages;

/** A drawing of the two taps: Share in the toolbar, then "Add to Home Screen" in the sheet. */
function AddToHomeIllustration() {
  const t = useT(STRINGS);
  return (
    <figure aria-label={t.illustration} className="flex items-center gap-3" data-testid="push-ios-illustration">
      <div aria-hidden className="flex h-16 w-28 shrink-0 flex-col justify-end rounded-xl border border-line bg-paper p-1.5">
        <div className="flex items-center justify-around rounded-lg bg-paper-sunken py-1.5 text-ink-soft">
          <span className="size-1.5 rounded-full bg-line-strong" />
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground ring-2 ring-primary/30">
            <Share className="size-3.5" />
          </span>
          <span className="size-1.5 rounded-full bg-line-strong" />
        </div>
      </div>
      <span aria-hidden className="text-ink-soft rtl:-scale-x-100">
        →
      </span>
      <div aria-hidden className="flex h-16 w-40 shrink-0 flex-col justify-center gap-1 rounded-xl border border-line bg-paper p-1.5 text-[11px]">
        <span className="h-2 w-3/4 rounded bg-paper-sunken" />
        <span dir="ltr" className="flex items-center justify-between rounded-md bg-primary-soft px-1.5 py-1 font-medium text-ink ring-2 ring-primary/30">
          {t.addToHome}
          <SquarePlus className="size-3.5" />
        </span>
        <span className="h-2 w-2/3 rounded bg-paper-sunken" />
      </div>
    </figure>
  );
}

/** "Share → Add to Home Screen → open it from there", for an iPhone or iPad in the browser. */
export function IosInstallSteps({ compact = false }: { compact?: boolean }) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-3" data-testid="push-ios-steps">
      {!compact && <p className="text-sm font-medium text-ink">{t.iosTitle}</p>}
      <p className="text-xs text-ink-soft">{t.iosWhy}</p>
      <AddToHomeIllustration />
      <ol className="list-decimal space-y-1 ps-5 text-sm text-ink">
        <li>
          {t.iosStep1} <Share aria-hidden className="inline size-3.5 align-[-2px]" />
        </li>
        <li>
          {t.iosStep2} <Plus aria-hidden className="inline size-3.5 align-[-2px]" />
        </li>
        <li>{t.iosStep3}</li>
      </ol>
    </div>
  );
}

/** How to allow notifications again after they were blocked, for the platform at hand. */
export function BlockedSteps({ platform }: { platform: Platform }) {
  const t = useT(STRINGS);
  return (
    <div role="status" className="space-y-2 rounded-[var(--radius-card)] border border-line bg-paper-sunken p-3" data-testid="push-blocked">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Lock aria-hidden className="size-4 text-ink-soft" />
        {t.blockedTitle}
      </p>
      {platform === "ios" ? (
        <p className="text-sm text-ink">{t.blockedIos}</p>
      ) : (
        <ol className="list-decimal space-y-1 ps-5 text-sm text-ink">
          <li>{platform === "android" ? t.blockedAndroid : t.blockedDesktop1}</li>
          {platform !== "android" && <li>{t.blockedDesktop2}</li>}
          <li>{t.blockedDesktop3}</li>
        </ol>
      )}
      {platform === "mac" && <p className="text-xs text-ink-soft">{t.blockedMac}</p>}
    </div>
  );
}
