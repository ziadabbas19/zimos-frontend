import { offersStatsGet, type OfferStat, type OfferStats } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    views: "{n} views",
    accepted: "{n} accepted",
    rate: "({rate})",
    revenue: "{amount} added",
    period: "last {days} days",
  },
  ar: {
    views: "{n} مشاهدة",
    accepted: "{n} قبول",
    rate: "({rate})",
    revenue: "{amount} إيراد إضافي",
    period: "آخر {days} يوم",
  },
} satisfies Messages;

/** The offers hub's numbers, once per page (offers/offerStats.js); null while loading or when they fail. */
export function useOfferStats(days = 30): OfferStats | null {
  const workspaceId = useWorkspaceId();
  return useAsync(() => offersStatsGet(apiClient, workspaceId, days).catch(() => null), [workspaceId, days]).data ?? null;
}

/**
 * One offer's line of numbers: views, acceptances (with the
 * rate when it has views) and the revenue it added. Nothing until loaded.
 */
export function OfferNumbers({ stat, days = 30 }: { stat: OfferStat | null | undefined; days?: number }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  if (!stat) return null;
  const currency = (currentWorkspace as { defaultCurrency?: string } | null)?.defaultCurrency ?? "EGP";
  const rate = stat.impressions > 0 ? formatPercentValue(stat.accepted / stat.impressions) : null;
  return (
    <p data-slot="offer-numbers" className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-5 text-ink-soft tabular-nums">
      <span>{fmt(t.views, { n: stat.impressions })}</span>
      <span>
        {fmt(t.accepted, { n: stat.accepted })}
        {rate && (
          <>
            {" "}
            <bdi dir="ltr">{fmt(t.rate, { rate })}</bdi>
          </>
        )}
      </span>
      {stat.revenue !== null && (
        <span className="font-medium text-ink">
          <bdi>{fmt(t.revenue, { amount: formatMoney(stat.revenue, currency) })}</bdi>
        </span>
      )}
      <span>{fmt(t.period, { days })}</span>
    </p>
  );
}
