import { Link } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { IconCaretLeft, IconCaretRight, IconChat, IconConfirm, IconReviews, IconShipping, IconSuccess, IconTray, type IconComponent } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getIntlLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { findNavItem, isNavItemVisible } from "@/lib/navigation";
import { PLACE_COLOR, placeOf } from "@/lib/places";
import { useWorkCounts, type WorkCounts } from "@/lib/workCounts";

const STRINGS = {
  en: {
    title: "Needs you now",
    toConfirm: "Waiting for a call",
    toShip: "Ready to ship",
    unread: "Unread messages",
    reviews: "Reviews to approve",
    allClear: "Nothing is waiting for you. Well done.",
  },
  ar: {
    title: "يحتاجك الآن",
    toConfirm: "تنتظر مكالمة",
    toShip: "جاهزة للشحن",
    unread: "رسائل غير مقروءة",
    reviews: "تقييمات تنتظر موافقتك",
    allClear: "لا شيء ينتظرك الآن. كل شيء تمام.",
  },
} satisfies Messages;

/** Each queue of waiting work: where it is worked, and its glyph. The tile takes the colour of the place it belongs to. */
const QUEUES: Array<{ kind: keyof WorkCounts; to: string; icon: IconComponent }> = [
  { kind: "toConfirm", to: "/confirmation-queue", icon: IconConfirm },
  { kind: "toShip", to: "/orders?stage=ready_to_ship", icon: IconShipping },
  { kind: "unread", to: "/inbox", icon: IconChat },
  { kind: "reviews", to: "/reviews", icon: IconReviews },
];

/**
 * What is waiting for the merchant, as numbers to see rather than sentences to
 * read: one tile per queue of work — calls due, orders ready to ship, unread
 * messages, reviews to approve — each in the colour of its place, with its
 * count large, and the way to it. A queue this role cannot read is left out;
 * with nothing waiting anywhere, the card says so in one line.
 */
export function NeedsYouCard({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const counts = useWorkCounts(currentWorkspace?.id);
  const digits = new Intl.NumberFormat(getIntlLocale());
  const Chevron = locale === "ar" ? IconCaretLeft : IconCaretRight;

  const queues = QUEUES.filter(({ kind, to }) => {
    const item = findNavItem(to.split("?")[0]);
    return counts[kind] !== null && (!item || isNavItemVisible(item, currentWorkspace?.permissions));
  });
  if (queues.length === 0) return null;
  const waiting = queues.some(({ kind }) => (counts[kind] ?? 0) > 0);

  return (
    <section aria-labelledby="needs-you-title" data-slot="needs-you" className={cn("rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 sm:p-5", className)}>
      <h2 id="needs-you-title" className="flex items-center gap-2 text-base font-semibold text-ink">
        <span className="grid size-8 place-items-center rounded-[10px] bg-paper-sunken text-ink-soft [&>svg]:size-4">
          <IconTray aria-hidden />
        </span>
        {t.title}
      </h2>
      {waiting ? (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {queues.map(({ kind, to, icon: Icon }) => {
            const count = counts[kind] ?? 0;
            const place = placeOf(to.split("?")[0]);
            const color = place ? PLACE_COLOR[place] : PLACE_COLOR.main;
            return (
              <li key={kind}>
                <Link
                  to={to}
                  data-queue={kind}
                  className={cn(
                    "group/queue flex h-full items-center gap-3 rounded-2xl border border-line p-3 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    count === 0 && "opacity-60"
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                  >
                    <Icon strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="tabular-nums block text-2xl leading-tight font-bold text-ink">{digits.format(count)}</span>
                    <span className="block text-xs leading-snug text-ink-soft">{t[kind]}</span>
                  </span>
                  <Chevron className="size-4 shrink-0 text-ink-soft transition-transform group-hover/queue:translate-x-[-2px] ltr:group-hover/queue:translate-x-[2px]" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
          <IconSuccess className="size-5 text-success" aria-hidden />
          {t.allClear}
        </p>
      )}
    </section>
  );
}
