import { useState } from "react";
import { Card } from "@store-builder/ui";
import { protectionStats, type ProtectionStats } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { IconBlock, IconCoins, IconHot, IconProtection, IconShield, IconUserBlocked } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { Segmented } from "@/components/Segmented";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatMinorMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useOrderLabels } from "@/pages/orders/orderLabels";

const PERIODS = ["7", "30", "90"] as const;
type Period = (typeof PERIODS)[number];

const STRINGS = {
  en: {
    periodLabel: "Period",
    last: "Last {days}",
    prevented: "Orders prevented",
    preventedHint: "Refused at checkout by a rule, the blocked list or bot protection",
    blockedCancelled: "Blocked and cancelled",
    blockedCancelledHint: "Orders you blocked from the flagged list",
    saved: "Estimated money saved",
    savedHint: "{count} orders × a round trip at your average shipping fee ({fee})",
    savedNoFee: "Needs orders with a shipping fee to estimate",
    flagged: "Orders flagged",
    flaggedHint: "Placed, and marked for review",
    highRisk: "High-risk orders",
    highRiskHint: "Out of {orders} orders in the period",
    entries: "Blocked entries",
    entriesHint: "Phones, IPs, emails, devices and names on your blocked list",
    reasonsTitle: "Why orders were refused",
    reasonsEmpty: "No order was refused in this period.",
    reason_bot_honeypot: "Bot: filled the hidden field",
    reason_bot_token: "Bot: no valid page token",
    reason_bot_too_fast: "Bot: ordered within three seconds",
    reason_bot_captcha: "Bot: failed the challenge",
  },
  ar: {
    periodLabel: "الفترة",
    last: "آخر {days}",
    prevented: "طلبات تم منعها",
    preventedHint: "رُفضت عند الطلب بقاعدة أو بقائمة الحظر أو بالحماية من البوتات",
    blockedCancelled: "تم حظرها وإلغاؤها",
    blockedCancelledHint: "طلبات حظرتها من قائمة المشتبه بها",
    saved: "المبلغ التقديري الذي تم توفيره",
    savedHint: "{count} طلب × شحن ذهاب وعودة بمتوسط مصاريف شحنك ({fee})",
    savedNoFee: "يحتاج طلبات عليها مصاريف شحن لحساب التقدير",
    flagged: "طلبات مشتبه بها",
    flaggedHint: "سُجّلت وتم تمييزها للمراجعة",
    highRisk: "طلبات عالية الخطورة",
    highRiskHint: "من أصل {orders} طلب في الفترة",
    entries: "المحظورون",
    entriesHint: "أرقام وعناوين IP وعناوين بريد إلكتروني وأجهزة وأسماء في قائمة الحظر",
    reasonsTitle: "أسباب رفض الطلبات",
    reasonsEmpty: "لم يُرفض أي طلب في هذه الفترة.",
    reason_bot_honeypot: "بوت: ملأ الحقل المخفي",
    reason_bot_token: "بوت: بدون رمز صفحة صحيح",
    reason_bot_too_fast: "بوت: طلب خلال ثلاث ثوانٍ",
    reason_bot_captcha: "بوت: فشل في التحدي",
  },
} satisfies Messages;

/**
 * Fraud protection → Statistics: what the protection layer stopped in the
 * period, and what that saved. Six figures — the two that are lists open
 * their list — and the reasons orders were refused for, as bars. While a
 * period loads, each card holds its own shape, so nothing moves when the
 * numbers arrive.
 */
export function ProtectionStatsTab() {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const [period, setPeriod] = useState<Period>("30");
  const stats = useAsync<ProtectionStats>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(period) * 24 * 60 * 60 * 1000);
    return protectionStats(apiClient, workspaceId, { from: from.toISOString(), to: to.toISOString() });
  }, [workspaceId, period]);
  const data = stats.data;
  const loading = stats.loading || !data;

  const reasonLabel = (flag: string) => (t as Record<string, string>)[`reason_${flag}`] ?? labels.riskFlag(flag);
  const reasons = data ? Object.entries(data.preventedByReason).sort((a, b) => b[1] - a[1]) : [];
  const top = reasons.length ? reasons[0][1] : 0;
  const count = (n: number | undefined) => fmt("{n}", { n: n ?? 0 });

  return (
    <div className="space-y-4">
      <div className="flex">
        <Segmented
          size="sm"
          value={period}
          onChange={setPeriod}
          label={t.periodLabel}
          options={PERIODS.map((value) => ({ value, label: fmt(t.last, { days: countOf("day", Number(value)) }) }))}
        />
      </div>

      {/* The cards are their own skeletons, so only a failure replaces them. */}
      <DataState loading={false} error={stats.error} onRetry={() => void stats.refresh()}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard loading={loading} icon={<IconShield />} label={t.prevented} value={count(data?.prevented)} hint={t.preventedHint} />
            <KpiCard
              loading={loading}
              icon={<IconBlock />}
              label={t.blockedCancelled}
              value={count(data?.blockedCancelled)}
              hint={t.blockedCancelledHint}
            />
            <KpiCard
              loading={loading}
              icon={<IconCoins />}
              label={t.saved}
              value={data ? formatMinorMoney(data.estimatedSavedAmount, data.currency) : ""}
              hint={
                data && Number(data.averageShippingAmount) > 0
                  ? fmt(t.savedHint, {
                      count: data.prevented + data.blockedCancelled,
                      fee: formatMinorMoney(data.averageShippingAmount, data.currency),
                    })
                  : t.savedNoFee
              }
            />
            <KpiCard
              loading={loading}
              icon={<IconProtection />}
              label={t.flagged}
              value={count(data?.flagged)}
              hint={t.flaggedHint}
              to="/fraud?tab=flagged"
            />
            <KpiCard
              loading={loading}
              icon={<IconHot />}
              label={t.highRisk}
              value={count(data?.highRisk)}
              hint={fmt(t.highRiskHint, { orders: data?.orders ?? 0 })}
            />
            <KpiCard
              loading={loading}
              icon={<IconUserBlocked />}
              label={t.entries}
              value={count(data?.blockedEntries)}
              hint={t.entriesHint}
              to="/fraud?tab=blocklist"
            />
          </div>

          <Card className="gap-0 p-5">
            <h2 className="font-display text-lg font-medium text-ink">{t.reasonsTitle}</h2>
            {loading ? (
              <div aria-hidden className="mt-4 space-y-4">
                {["w-2/3", "w-1/2", "w-1/3"].map((width) => (
                  <div key={width} className={`h-2 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none ${width}`} />
                ))}
              </div>
            ) : reasons.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">{t.reasonsEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {reasons.map(([flag, n]) => (
                  <li key={flag} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-ink">{reasonLabel(flag)}</span>
                      <span className="shrink-0 font-semibold text-ink tabular-nums">{count(n)}</span>
                    </div>
                    {/* How this reason compares with the commonest one: the words and the figure above carry the number. */}
                    <div aria-hidden data-slot="stat-bar" className="h-2 overflow-hidden rounded-full bg-line">
                      <div data-slot="stat-bar-fill" className="h-full rounded-full bg-primary" style={{ width: `${top ? Math.round((n / top) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </DataState>
    </div>
  );
}
