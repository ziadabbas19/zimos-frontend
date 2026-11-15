import { useLocation } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { placeBadge, placeOf, placesFor } from "@/lib/places";
import { usePlanFeatures } from "@/lib/usePlanFeatures";
import { useWorkCounts } from "@/lib/workCounts";
import { PlaceTile } from "./PlaceTile";
import { usePlaceName } from "./usePlaceName";

const STRINGS = {
  en: { label: "Places", over: "{n}+" },
  ar: { label: "الأقسام", over: "{n}+" },
} satisfies Messages;

/** Above this a tile's count says «٩٩+». */
const MAX_SHOWN = 99;

/**
 * The dock (from `md` up): every place of the dashboard as an app tile in its
 * own colour, in the side menu's order, floating over the bottom of the page.
 * A tile goes to its place's first page; its name is written under it,
 * centred (owner, 2026-11-15), and is its accessible name. The place you are
 * in has its name in bold ink and `aria-current`; another place carries the
 * count of its most urgent waiting work. On a phone the tab bar (MobileTabBar) is the
 * dock. Sticky at the end of the page column, so the page ends above it.
 */
export function PlaceDock() {
  const t = useT(STRINGS);
  const placeName = usePlaceName({ short: true });
  const { currentWorkspace } = useWorkspace();
  const plan = usePlanFeatures();
  const counts = useWorkCounts(currentWorkspace?.id);
  const here = placeOf(useLocation().pathname);
  const places = placesFor(currentWorkspace?.permissions, plan.gated);
  if (places.length < 2) return null;
  const digits = new Intl.NumberFormat(getIntlLocale());

  return (
    <nav aria-label={t.label} data-slot="dock" className="pointer-events-none sticky bottom-3 z-30 hidden justify-center px-3 pb-3 md:flex">
      <ul className="zimos-glass zimos-place-dock pointer-events-auto flex items-start gap-1 rounded-[1.25rem] px-2 pt-2 pb-1.5 lg:gap-1.5">
        {places.map((place) => {
          const name = placeName(place);
          const current = place.id === here;
          const badge = current ? null : placeBadge(place, counts);
          return (
            <li key={place.id}>
              <ViewLink
                to={place.to}
                aria-current={current ? "page" : undefined}
                data-dock-place={place.id}
                className="group/tile flex w-[3.25rem] flex-col items-center gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary lg:w-[3.75rem]"
              >
                <span className="relative block size-9 transition-transform duration-150 ease-out group-hover/tile:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/tile:translate-y-0 lg:size-10">
                  <PlaceTile place={place.id} className="size-full" />
                  {badge && (
                    <span
                      aria-hidden
                      className={cn(
                        "tabular absolute -end-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] leading-none font-semibold ring-2 ring-paper-raised",
                        badge.kind === "toConfirm" ? "bg-danger text-white" : "bg-ink text-paper-raised"
                      )}
                    >
                      {badge.count > MAX_SHOWN ? t.over.replace("{n}", digits.format(MAX_SHOWN)) : digits.format(badge.count)}
                    </span>
                  )}
                </span>
                {/* The name under the tile, centred: the place you are in in bold ink. */}
                <span
                  data-dock-label=""
                  className={cn(
                    "block max-w-full truncate text-center text-[10.5px] leading-tight lg:text-[11px]",
                    current ? "font-bold text-ink" : "font-medium text-ink-soft group-hover/tile:text-ink"
                  )}
                >
                  {name}
                </span>
              </ViewLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
