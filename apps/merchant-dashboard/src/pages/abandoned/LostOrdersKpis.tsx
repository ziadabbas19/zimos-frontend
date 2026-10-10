import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { LostOrderStats } from "@store-builder/api-client";
import { IconCoins, IconLostOrders, IconTrendDown } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatMinorMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";

const STRINGS = {
  en: {
    label: "Lost orders this month",
    lost: "Lost",
    lostHint: "This month",
    rate: "Lost rate",
    rateHint: "Per {n} visits",
    rateNone: "No visits yet",
    recovered: "Won back",
    back_zero: "Nothing back yet",
    back_one: "{n} order came back",
    back_two: "{n} orders came back",
    back_few: "{n} orders came back",
    back_many: "{n} orders came back",
    back_other: "{n} orders came back",
  },
  ar: {
    label: "الطلبات المفقودة هذا الشهر",
    lost: "مفقود",
    lostHint: "هذا الشهر",
    rate: "نسبة المفقود",
    rateHint: "من كل {n} زيارة",
    rateNone: "لا توجد زيارات بعد",
    recovered: "تم استرجاعه",
    back_zero: "لم يُسترجع شيء بعد",
    back_one: "طلب واحد استُرجع",
    back_two: "طلبان استُرجعا",
    back_few: "{n} طلبات استُرجعت",
    back_many: "{n} طلبًا استُرجع",
    back_other: "{n} طلب استُرجع",
  },
} satisfies Messages;

/**
 * One card of the strip. On a phone each has the width its figure needs (a
 * count is narrow, an amount is wide) and snaps into place: two show and the
 * third peeks in, which says the row scrolls. From sm the three share the row.
 */
function Slot({ stat, width, children }: { stat: "lost" | "recovered" | "rate"; width: string; children: ReactNode }) {
  return (
    <div data-stat={stat} className={cn("shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1", width)}>
      {children}
    </div>
  );
}

/**
 * This calendar month in three figures (GET /checkout-sessions/stats; the
 * filters of the list do not change them): how many were lost, what was won
 * back, and how many of every 100 visits are lost. ONE row: it scrolls
 * sideways on a phone and takes 120px, instead of three cards stacked. While
 * the figures load the cards hold their own shape, so nothing moves when they
 * arrive. Material (the tinted icon chips, the faded edges) is in
 * glass/recovery.css.
 */
export function LostOrdersKpis({ stats, loading }: { stats: LostOrderStats | null; loading: boolean }) {
  const t = useT(STRINGS);
  // The stats could not be read (the list says why): no strip rather than three dashes.
  if (!stats && !loading) return null;
  const busy = !stats;

  return (
    <section
      aria-label={t.label}
      data-slot="lost-kpis"
      // The padding is room for the cards' shadow and focus ring, which the scroll box would cut; the top margin takes it back.
      className="-mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-3 [scrollbar-width:none] max-sm:-mx-4 max-sm:scroll-px-4 max-sm:px-4 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      <Slot stat="lost" width="w-32">
        <KpiCard
          label={t.lost}
          value={stats ? fmt("{n}", { n: stats.lost }) : ""}
          hint={t.lostHint}
          loading={busy}
          icon={<IconLostOrders />}
        />
      </Slot>
      <Slot stat="recovered" width="w-48">
        <KpiCard
          label={t.recovered}
          value={stats ? formatMinorMoney(stats.recoveredAmount, stats.currency) : ""}
          hint={stats ? (stats.recovered === 0 ? t.back_zero : pluralOf(t, "back", stats.recovered)) : t.back_zero}
          loading={busy}
          icon={<IconCoins />}
        />
      </Slot>
      <Slot stat="rate" width="w-40">
        <KpiCard
          label={t.rate}
          value={stats && stats.lostRate !== null ? fmt("{n}", { n: stats.lostRate }) : "—"}
          hint={stats && stats.lostRate === null ? t.rateNone : fmt(t.rateHint, { n: 100 })}
          loading={busy}
          icon={<IconTrendDown />}
        />
      </Slot>
    </section>
  );
}
