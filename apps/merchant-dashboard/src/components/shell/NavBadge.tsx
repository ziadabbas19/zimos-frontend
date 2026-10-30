import { cn } from "@store-builder/ui";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import type { NavBadge as NavBadgeKind } from "@/lib/navigation";
import { pluralOf } from "@/lib/plural";

const STRINGS = {
  en: {
    over: "{n}+",
    spoken: ", {count}",
    toConfirm_one: "{n} waiting for a call",
    toConfirm_other: "{n} waiting for a call",
    toShip_one: "{n} ready to ship",
    toShip_other: "{n} ready to ship",
    unread_one: "{n} unread message",
    unread_other: "{n} unread messages",
    reviews_one: "{n} review waiting for your approval",
    reviews_other: "{n} reviews waiting for your approval",
  },
  ar: {
    over: "{n}+",
    spoken: "، {count}",
    toConfirm_one: "طلب واحد ينتظر مكالمة",
    toConfirm_two: "طلبان ينتظران مكالمة",
    toConfirm_other: "{n} طلبات تنتظر مكالمة",
    toShip_one: "طلب واحد جاهز للشحن",
    toShip_two: "طلبان جاهزان للشحن",
    toShip_other: "{n} طلبات جاهزة للشحن",
    unread_one: "رسالة واحدة غير مقروءة",
    unread_two: "رسالتان غير مقروءتين",
    unread_few: "{n} رسائل غير مقروءة",
    unread_other: "{n} رسالة غير مقروءة",
    reviews_one: "تقييم واحد ينتظر موافقتك",
    reviews_two: "تقييمان ينتظران موافقتك",
    reviews_few: "{n} تقييمات تنتظر موافقتك",
    reviews_other: "{n} تقييمًا ينتظر موافقتك",
  },
} satisfies Messages;

/** Above this the pill says «٩٩+»: two digits is all it has room for. */
const MAX_SHOWN = 99;

/**
 * The solid look, used when the glass layer is off. With glass on,
 * glass/menu.css tints the pill from `data-tone` instead.
 */
const TONE: Record<NavBadgeKind, string> = {
  // Calls due now: urgent.
  toConfirm: "bg-danger-soft text-danger",
  // Confirmed, no courier booked yet: needs attention.
  toShip: "bg-accent-soft text-accent-dark",
  // Unread messages: the brand's own tint.
  unread: "bg-primary-soft text-primary-dark",
  // Reviews waiting for the merchant's approval: needs attention, not urgent.
  reviews: "bg-accent-soft text-accent-dark",
};

interface NavBadgeProps {
  /** Which queue of work is counted (lib/workCounts.ts). */
  kind: NavBadgeKind;
  /** `null` — this role may not read the queue; `0` — nothing waiting. Neither draws a pill. */
  count: number | null | undefined;
  /** The row is the current one (the filled brand pill): the badge goes translucent on it. */
  onBrand?: boolean;
  className?: string;
}

/**
 * The count of waiting work at the end of a menu row: a small pill with the
 * number in the viewer's digits, and the same count in words for a screen
 * reader, so the row reads as "Confirm orders, 46
 * waiting for a call" and never as a bare number.
 */
export function NavBadge({ kind, count, onBrand = false, className }: NavBadgeProps) {
  const t = useT(STRINGS);
  if (!count || count < 0) return null;
  const shown = count > MAX_SHOWN ? fmt(t.over, { n: MAX_SHOWN }) : new Intl.NumberFormat(getIntlLocale()).format(count);

  return (
    <span
      // A new number is a new pill, so it pops again (glass/menu.css).
      key={shown}
      data-slot="nav-badge"
      data-tone={onBrand ? "on-brand" : kind}
      className={cn(
        "zimos-nav-badge inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums",
        onBrand ? "bg-black/20 text-primary-foreground dark:bg-white/30" : TONE[kind],
        className
      )}
    >
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{fmt(t.spoken, { count: pluralOf(t, kind, count) })}</span>
    </span>
  );
}
