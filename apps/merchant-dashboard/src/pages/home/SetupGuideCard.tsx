import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Card, cn } from "@store-builder/ui";
import { dashboardSetupGuide, type SetupStepKey } from "@store-builder/api-client";
import { CUSTOM_DOMAINS_ENABLED } from "@/lib/features";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Get your store ready",
    progress: "{completed} of {total} steps done",
    optional: "Optional",
    hide: "Hide the setup guide",
    go: "Set up",
    product: "Add your first product",
    productHint: "A name, a price and a photo are enough to start.",
    website: "Publish your store",
    websiteHint: "Pick a template, adjust it and publish.",
    payment: "Choose how customers pay",
    paymentHint: "Cash on delivery works from day one; add a gateway for cards.",
    shipping: "Set up shipping",
    shippingHint: "Connect a courier or set a delivery price per governorate.",
    domain: "Connect your own domain",
    domainHint: "Sell on yourstore.com instead of the Zimos address.",
    pixel: "Add an ad pixel",
    pixelHint: "So Meta, TikTok or Snapchat can measure your campaigns.",
    order: "Receive your first order",
    orderHint: "Place a test order from your storefront to see the whole flow.",
  },
  ar: {
    title: "جهّز متجرك",
    progress: "تم {completed} من {total} خطوات",
    optional: "اختياري",
    hide: "إخفاء دليل الإعداد",
    go: "ابدأ",
    product: "أضف أول منتج",
    productHint: "اسم وسعر وصورة يكفون للبداية.",
    website: "انشر متجرك",
    websiteHint: "اختر قالبًا، عدّله ثم انشره.",
    payment: "حدّد طرق الدفع",
    paymentHint: "الدفع عند الاستلام يعمل من أول يوم؛ أضف بوابة دفع للبطاقات.",
    shipping: "جهّز الشحن",
    shippingHint: "اربط شركة شحن أو حدّد سعر التوصيل لكل محافظة.",
    domain: "اربط دومينك الخاص",
    domainHint: "بِع على yourstore.com بدل عنوان زيموس.",
    pixel: "أضف بيكسل إعلانات",
    pixelHint: "حتى تقيس ميتا أو تيك توك أو سناب شات حملاتك.",
    order: "استقبل أول طلب",
    orderHint: "اعمل طلبًا تجريبيًا من متجرك لترى الدورة كاملة.",
  },
} satisfies Messages;

const STEP_LINK: Record<SetupStepKey, string> = {
  product: "/catalog/new",
  website: "/website",
  payment: "/payments",
  shipping: "/shipping",
  domain: "/settings",
  pixel: "/marketing",
  order: "/orders",
};

const hiddenKey = (workspaceId: string) => `zimos.setupGuide.hidden.${workspaceId}`;

/**
 * Setup guide (SPEC §18.6): the launch checklist on the home page, ticked from
 * what the store really has. It leaves on its own once every required step is
 * done, and can be hidden before that.
 */
export function SetupGuideCard() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const guide = useAsync(() => dashboardSetupGuide(apiClient, workspaceId), [workspaceId]);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hiddenKey(workspaceId)) === "1";
    } catch {
      return false;
    }
  });

  // The home page already has its own loading and error states; the guide is
  // an extra, so it only appears once it has something to say.
  if (hidden || !guide.data || guide.data.done) return null;
  const { completed, total, percent } = guide.data;
  // The own-domain step (optional) only while merchant domains are switched on.
  const steps = guide.data.steps.filter((step) => CUSTOM_DOMAINS_ENABLED || step.key !== "domain");

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(workspaceId), "1");
    } catch {
      /* private mode — hidden for this visit only */
    }
  }

  return (
    <Card className="mb-8 gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{fmt(t.progress, { completed, total })}</p>
        </div>
        <span className="tabular-nums text-2xl font-semibold text-primary">{percent}%</span>
        <button type="button" onClick={hide} aria-label={t.hide} title={t.hide} className="cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={t.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              to={STEP_LINK[step.key]}
              className={cn(
                "flex h-full items-start gap-3 rounded-[0.5rem] border border-line p-3 transition-colors hover:border-primary/40",
                step.done && "bg-paper"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
              )}
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium text-ink", step.done && "text-ink-soft line-through")}>
                  {t[step.key]}
                  {step.optional && <span className="ms-2 text-xs font-normal text-ink-soft no-underline">({t.optional})</span>}
                </span>
                {!step.done && <span className="mt-0.5 block text-xs text-ink-soft">{t[`${step.key}Hint`]}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
