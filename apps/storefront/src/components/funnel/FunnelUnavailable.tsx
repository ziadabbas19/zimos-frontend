"use client";

import { useRouter } from "next/navigation";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * A funnel the shopper can't enter: paused by the merchant (410), or not
 * published / not there at all (404). Same shape and tone as the store's 404
 * (NotFoundContent) minus the "404", since a paused funnel isn't missing: the
 * store language first, the other one quietly underneath, and a way back into
 * the store.
 *
 * `error` is the other case — the API couldn't be reached — and offers a retry.
 */
export function FunnelUnavailable({ kind, onRetry }: { kind: "unavailable" | "error"; onRetry?: () => void }) {
  const { t, locale } = useStore();
  const router = useRouter();
  const otherLang = locale === "ar" ? "en" : "ar";
  const other = getDictionary(otherLang).funnel;

  const title = kind === "unavailable" ? t.funnel.unavailableTitle : t.funnel.errorTitle;
  const body = kind === "unavailable" ? t.funnel.unavailableBody : t.funnel.errorBody;
  const secondary =
    kind === "unavailable"
      ? `${other.unavailableTitle} — ${other.unavailableBody}`
      : `${other.errorTitle} — ${other.errorBody}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-medium text-ink">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{body}</p>
      <p lang={otherLang} dir={otherLang === "ar" ? "rtl" : "ltr"} className="mt-4 max-w-md text-xs text-ink-soft">
        {secondary}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {kind === "error" && (
          <button type="button" onClick={() => (onRetry ? onRetry() : router.refresh())} className={btnPrimary}>
            {t.funnel.retry}
          </button>
        )}
        <StoreLink href="/" className={kind === "error" ? btnSecondary : btnPrimary}>
          {t.notFound.cta}
        </StoreLink>
      </div>
    </main>
  );
}
