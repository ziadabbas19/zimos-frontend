"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { marketingUnsubscribe } from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, container } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { StorePageLoader } from "@/components/StoreLoader";

const COPY = {
  en: {
    title: "Stop marketing messages",
    body: (store: string) => `You won't get offers or reminders from ${store} any more, by email or WhatsApp. Messages about your orders still reach you.`,
    confirm: "Unsubscribe",
    working: "Unsubscribing…",
    doneTitle: "You're unsubscribed",
    doneBody: "We won't send you marketing messages again. Signing up to the store's newsletter turns them back on.",
    badTitle: "This link is not valid",
    badBody: "Open the link from the email again, or contact the store.",
    failed: "That didn't work. Try again.",
    toStore: "Back to the store",
  },
  ar: {
    title: "إيقاف الرسائل التسويقية",
    body: (store: string) => `مش هتوصلك عروض أو تذكيرات من ${store} تاني، لا على الإيميل ولا على واتساب. رسائل أوردراتك هتفضل توصلك.`,
    confirm: "إلغاء الاشتراك",
    working: "جارٍ الإلغاء…",
    doneTitle: "اتلغى اشتراكك",
    doneBody: "مش هنبعتلك رسائل تسويقية تاني. لو اشتركت في نشرة المتجر هترجع توصلك.",
    badTitle: "الرابط ده مش صالح",
    badBody: "افتح الرابط من الإيميل تاني، أو كلّم المتجر.",
    failed: "محصلش. حاول تاني.",
    toStore: "ارجع للمتجر",
  },
  fr: {
    title: "Arrêter les messages marketing",
    body: (store: string) => `Vous ne recevrez plus d'offres ni de rappels de ${store}, ni par e-mail ni sur WhatsApp. Les messages sur vos commandes continuent.`,
    confirm: "Se désabonner",
    working: "Désabonnement…",
    doneTitle: "Vous êtes désabonné",
    doneBody: "Nous ne vous enverrons plus de messages marketing. Vous inscrire à la newsletter de la boutique les réactive.",
    badTitle: "Ce lien n'est pas valide",
    badBody: "Rouvrez le lien depuis l'e-mail, ou contactez la boutique.",
    failed: "Cela n'a pas marché. Réessayez.",
    toStore: "Retour à la boutique",
  },
};

/**
 * The unsubscribe link of a marketing email (backend:
 * notifications/marketingUnsubscribe.js). One button rather than on opening:
 * mail scanners open links too.
 */
function UnsubscribePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useSearchParams().get("t") ?? "";
  const { locale, store } = useStore();
  const t = pickText(COPY, locale);
  const [state, setState] = useState<"ready" | "working" | "done" | "invalid" | "failed">(token ? "ready" : "invalid");

  async function confirm() {
    setState("working");
    try {
      await marketingUnsubscribe(createStorefrontApiClient(), workspaceId, token);
      setState("done");
    } catch (err) {
      setState((err as { status?: number })?.status === 404 ? "invalid" : "failed");
    }
  }

  return (
    <main className={`${container} flex-1 py-16`}>
      <div className={`${card} mx-auto max-w-md p-6 text-center`} aria-live="polite">
        {state === "done" ? (
          <>
            <p className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckIcon />
            </p>
            <h1 className="mt-4 font-display text-xl font-bold text-ink">{t.doneTitle}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t.doneBody}</p>
            <StoreLink href="/" className={`${btnSecondary} mt-6`}>
              {t.toStore}
            </StoreLink>
          </>
        ) : state === "invalid" ? (
          <>
            <h1 className="font-display text-xl font-bold text-ink">{t.badTitle}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t.badBody}</p>
            <StoreLink href="/" className={`${btnSecondary} mt-6`}>
              {t.toStore}
            </StoreLink>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold text-ink">{t.title}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t.body(store?.name ?? "")}</p>
            <button type="button" onClick={() => void confirm()} disabled={state === "working"} className={`${btnPrimary} mt-6`}>
              {state === "working" ? t.working : t.confirm}
            </button>
            {state === "failed" && (
              <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {t.failed}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<StorePageLoader />}>
      <UnsubscribePage />
    </Suspense>
  );
}
