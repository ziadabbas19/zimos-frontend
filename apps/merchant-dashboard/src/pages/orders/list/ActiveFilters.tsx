import { IconClose } from "@/components/icons";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Filters in effect",
    remove: "Remove the filter: {name}",
    clearAll: "Clear all",
  },
  ar: {
    label: "الفلاتر المفعّلة",
    remove: "إزالة الفلتر: {name}",
    clearAll: "مسح الكل",
  },
} satisfies Messages;

export interface ActiveFilterChip {
  id: string;
  /** What the filter is, in words: «التاريخ: النهارده», «المحافظة: القاهرة». */
  label: string;
  onRemove: () => void;
}

/**
 * The filters in effect, as a row of chips under the toolbar — there only
 * while any is set. A chip is one button: pressing it anywhere takes its
 * filter off (44px under a finger). «امسح الكل» ends the row. On a phone the
 * row scrolls sideways and runs to the screen edges, like the stage chips, so
 * it never pushes the orders further down than one line.
 *
 * Material (the tinted pane of a chip) is in glass/orders.css; without the
 * glass layer a chip is a soft brand pill with a hairline.
 */
export function ActiveFilters({ chips, onClearAll }: { chips: readonly ActiveFilterChip[]; onClearAll: () => void }) {
  const t = useT(STRINGS);
  if (chips.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={t.label}
      data-slot="active-filters"
      className="-my-1 flex items-center gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] max-sm:-mx-4 max-sm:px-4 sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          aria-label={fmt(t.remove, { name: chip.label })}
          title={fmt(t.remove, { name: chip.label })}
          className="zimos-filter-chip inline-flex h-9 max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft ps-3.5 pe-2.5 text-[13px] font-medium text-primary-dark ring-1 ring-primary/25 transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11 dark:text-primary"
        >
          <span className="max-w-60 truncate">{chip.label}</span>
          <IconClose className="size-3.5 shrink-0" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium text-ink-soft transition-[scale,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11"
      >
        {t.clearAll}
      </button>
    </div>
  );
}
