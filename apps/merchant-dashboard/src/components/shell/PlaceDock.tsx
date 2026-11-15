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
 * A tile goes to its place's first page; its name shows above it on hover and
 * on keyboard focus and is its accessible name. The place you are in has a
 * dot under its tile and `aria-current`; another place carries the count of
 * its most urgent waiting work. On a phone the tab bar (MobileTabBar) is the
 * dock. Sticky at the end of the page column, so the page ends above it.
 */
export function PlaceDock() {
  const t = useT(STRINGS);
  const placeName = usePlaceName();
  const { currentWorkspace } = useWorkspace();
  const plan = usePlanFeatures();
  const counts = useWorkCounts(currentWorkspace?.id);
  const here = placeOf(useLocation().pathname);
  const places = placesFor(currentWorkspace?.permissions, plan.gated);
  if (places.length < 2) return null;
  const digits = new Intl.NumberFormat(getIntlLocale());

  return (
    <nav aria-label={t.label} data-slot="dock" className="pointer-events-none sticky bottom-3 z-30 hidden justify-center px-3 pb-3 md:flex">
      <ul className="zimos-glass zimos-place-dock pointer-events-auto flex items-end gap-1.5 rounded-[1.25rem] px-2 pt-2 pb-1 lg:gap-2">
        {places.map((place) => {
          const name = placeName(place);
          const current = place.id === here;
          const badge = current ? null : placeBadge(place, counts);
          return (
            <li key={place.id} className="flex flex-col items-center">
              <ViewLink
                to={place.to}
                aria-current={current ? "page" : undefined}
                data-dock-place={place.id}
                className="group/tile relative block size-10 rounded-[26%] outline-none transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:size-11"
              >
                <PlaceTile place={place.id} className="size-full" />
                <span className="sr-only">{name}</span>
                {/* The name above the tile, for the eye, on hover and keyboard focus. */}
                <span
                  aria-hidden
                  className="pointer-events-none invisible absolute bottom-[calc(100%+10px)] start-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-paper-raised shadow-md group-hover/tile:visible group-focus-visible/tile:visible rtl:translate-x-1/2"
                >
                  {name}
                </span>
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
              </ViewLink>
              <span aria-hidden className={cn("mt-1 size-1 rounded-full", current ? "bg-ink" : "bg-transparent")} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
