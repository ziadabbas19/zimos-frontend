import { CalendarDays } from "lucide-react";
import { cn } from "@store-builder/ui";
import { Select } from "@/components/Select";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/lib/analytics";

const STRINGS = {
  en: {
    label: "Date range",
    yesterday: "Yesterday",
    last365: "Last 365 days",
    compare: "Compare: previous period",
  },
  ar: {
    label: "الفترة",
    yesterday: "أمس",
    last365: "آخر 365 يومًا",
    compare: "المقارنة: الفترة السابقة",
  },
} satisfies Messages;

/**
 * The date-range control above the analytics and funnel screens: the presets
 * in a native select (the dashboard's own control — it also keeps the menu
 * library out of every page that shows this), next to the comparison chip —
 * left out (`compare={false}`) on a screen that does not compare periods.
 */
export function RangeSwitch({
  value,
  onChange,
  className,
  compare = true,
}: {
  value: AnalyticsRange;
  onChange: (value: AnalyticsRange) => void;
  className?: string;
  compare?: boolean;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const labels: Record<AnalyticsRange, string> = {
    today: common.today,
    yesterday: t.yesterday,
    "7d": common.last7,
    "30d": common.last30,
    "90d": common.last90,
    "365d": t.last365,
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
        <Select
          aria-label={t.label}
          value={value}
          onChange={(e) => onChange(e.target.value as AnalyticsRange)}
          className="h-9 w-auto ps-9 font-medium"
        >
          {ANALYTICS_RANGES.map((range) => (
            <option key={range} value={range}>
              {labels[range]}
            </option>
          ))}
        </Select>
      </div>
      {compare && (
        <span className="inline-flex h-9 items-center rounded-[0.5rem] border border-line bg-paper-raised px-3 text-sm font-medium text-ink-soft">
          {t.compare}
        </span>
      )}
    </div>
  );
}
