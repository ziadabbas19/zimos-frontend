import { Alert, cn } from "@store-builder/ui";
import type { EmailCampaignOverview } from "@store-builder/api-client";
import { formatCount } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CAMPAIGN_STRINGS } from "./campaignStrings";

/**
 * This month's campaign emails against the plan, and today's against the
 * store's daily limit: a labelled meter a screen reader reads as a number.
 */
export function QuotaMeter({ overview, className }: { overview: EmailCampaignOverview; className?: string }) {
  const t = useT(CAMPAIGN_STRINGS);
  const { monthly, daily } = overview.quota;
  const unlimited = monthly.max === null;
  const ratio = unlimited || !monthly.max ? 0 : Math.min(1, monthly.used / monthly.max);
  const tone = ratio >= 0.9 ? "bg-danger" : ratio >= 0.7 ? "bg-accent" : "bg-primary";
  const text = unlimited
    ? fmt(t.quotaUnlimited, { used: formatCount(monthly.used) })
    : fmt(t.quotaUsed, { used: formatCount(monthly.used), max: formatCount(monthly.max) });

  return (
    <section aria-label={t.quota} className={cn("rounded-xl border border-line bg-paper-raised p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t.quota}</h2>
        <p className="text-xs text-ink-soft">{fmt(t.quotaResets, { date: formatDate(monthly.resetsAt) })}</p>
      </div>
      {monthly.max === 0 ? (
        <p className="mt-2 text-sm text-ink">{t.quotaNone}</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-ink tabular-nums">{text}</p>
          {!unlimited && (
            <div
              role="meter"
              aria-label={t.quota}
              aria-valuemin={0}
              aria-valuemax={monthly.max ?? 0}
              aria-valuenow={monthly.used}
              aria-valuetext={text}
              className="mt-2 h-2 overflow-hidden rounded-full bg-line"
            >
              <div className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300", tone)} style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-xs text-ink-soft tabular-nums">{fmt(t.dailyCap, { used: formatCount(daily.used), cap: formatCount(daily.cap) })}</p>
      {!overview.provider.ready && (
        <Alert variant="info" className="mt-3 text-sm">
          {t.providerOff}
        </Alert>
      )}
    </section>
  );
}
