"use client";

import { useId } from "react";
import { pickText, type Locale } from "@/lib/i18n";

const COPY = {
  en: {
    label: (store: string) => `Email me offers and news from ${store}`,
    hint: "You can unsubscribe from any email, in one click.",
  },
  ar: {
    label: (store: string) => `ابعتلي العروض والأخبار من ${store} على الإيميل`,
    hint: "تقدر تلغي الاشتراك من أي رسالة بضغطة واحدة.",
  },
  fr: {
    label: (store: string) => `Recevoir par e-mail les offres et nouveautés de ${store}`,
    hint: "Désabonnement en un clic depuis chaque e-mail.",
  },
};

/**
 * "Email me offers" at checkout (NEXT_PUBLIC_EMAIL_CAMPAIGNS_ENABLED): unticked
 * until the shopper ticks it — consent is never assumed. Ticked, the order
 * carries `marketingConsent: true` and the store may include them in its email
 * campaigns (backend emailCampaigns/consent.js). Shown only where the form
 * asks for an email address.
 */
export function MarketingConsentField({
  checked,
  onChange,
  storeName,
  locale,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  storeName: string;
  locale: Locale;
}) {
  const t = pickText(COPY, locale);
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="mt-4">
      {/* The whole line is the label, at least 44px tall, so the box is easy to hit. */}
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={hintId}
          className="h-5 w-5 shrink-0 cursor-pointer accent-primary"
        />
        <span className="min-w-0">{t.label(storeName)}</span>
      </label>
      <p id={hintId} className="ps-8 text-xs text-ink-soft">
        {t.hint}
      </p>
    </div>
  );
}
