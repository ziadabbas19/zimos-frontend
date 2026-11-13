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
 * "Email me offers": the box at checkout, in a product page's quick order
 * form and in the cart (NEXT_PUBLIC_EMAIL_CAMPAIGNS_ENABLED, where the
 * merchant switched each on — lib/emailSignup.ts). It starts as the merchant
 * chose for that place (unticked unless they said otherwise), and whatever it
 * shows when the order is placed is what is sent: ticked, the order carries
 * `marketingConsent: true` and the store may include the shopper in its email
 * campaigns (backend emailCampaigns/consent.js). Shown only where the form
 * asks for an email address.
 *
 * `label`, `privacy` and `incentive` are the merchant's own words; empty, the
 * built-in ones are used.
 */
export function MarketingConsentField({
  checked,
  onChange,
  storeName,
  locale,
  label,
  privacy,
  incentive,
  className = "mt-4",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  storeName: string;
  locale: Locale;
  label?: string | null;
  privacy?: string | null;
  incentive?: string | null;
  className?: string;
}) {
  const t = pickText(COPY, locale);
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
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
        <span className="min-w-0">
          {label?.trim() || t.label(storeName)}
          {incentive?.trim() && (
            <>
              {" "}
              <span className="font-semibold text-primary">{incentive.trim()}</span>
            </>
          )}
        </span>
      </label>
      <p id={hintId} className="ps-8 text-xs text-ink-soft">
        {privacy?.trim() || t.hint}
      </p>
    </div>
  );
}
