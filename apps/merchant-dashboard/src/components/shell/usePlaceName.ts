import { useT, type Messages } from "@/i18n/LocaleContext";
import { NAV_GROUP_LABELS, NAV_LABELS } from "@/lib/navigation";
import type { Place, PlaceId } from "@/lib/places";

/** The dock's own, shorter names where a heading is too long to sit under a tile. */
const SHORT = {
  en: { store: "Store", money: "Money" },
  ar: { store: "المتجر", money: "الفلوس" },
} satisfies Messages;

/**
 * A place's name: the main page by its own name, every other place by its
 * group's heading. `short`: the dock's name under its tile, shorter where the
 * heading is long ("Money & shipping" is "Money" there).
 */
export function usePlaceName({ short = false }: { short?: boolean } = {}) {
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const shortLabels = useT(SHORT);
  return (place: Place) => {
    if (short && place.id in shortLabels) return shortLabels[place.id as Extract<PlaceId, keyof typeof shortLabels>];
    return place.group.labelKey ? groupLabels[place.group.labelKey] : navLabels.overview;
  };
}
