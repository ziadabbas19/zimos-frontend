import type { PlanLimits } from "@store-builder/api-client";
import { formatDate } from "@/lib/format";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";
import { WalletSection } from "./WalletSection";

/**
 * What the store uses of its plan's limits: stores (across the owner's
 * stores) and funnels created this month, from GET .../billing (`limits`, the
 * backend's entitlementsService). Below them, the prepaid balance while it is
 * switched on (WalletSection).
 */
export function UsageTab({ limits }: { limits: PlanLimits }) {
  const t = useT(SUBSCRIPTION_STRINGS);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageMeter label={t.storesUsage} used={limits.stores.used} max={limits.stores.max} />
        <UsageMeter
          label={t.funnelsUsage}
          used={limits.funnelsThisMonth.used}
          max={limits.funnelsThisMonth.max}
          note={fmt(t.resetsOn, { date: formatDate(limits.funnelsThisMonth.resetsAt) })}
        />
      </div>
      <WalletSection />
    </div>
  );
}

function UsageMeter({ label, used, max, note }: { label: string; used: number; max: number | null; note?: string }) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const { locale } = useLocale();
  const number = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
  const share = max ? Math.min(1, used / max) : 0;
  const full = max !== null && used >= max;
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
      <h3 className="text-sm font-medium text-ink">{label}</h3>
      <p className="tabular mt-2 text-2xl font-semibold text-ink">
        {max === null ? fmt(t.unlimitedUsage, { used: number(used) }) : fmt(t.ofMax, { used: number(used), max: number(max) })}
      </p>
      {max !== null && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={used}
        >
          <div className={full ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
      {note && <p className="mt-2 text-xs text-ink-soft">{note}</p>}
    </section>
  );
}
