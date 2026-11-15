import { useT } from "@/i18n/LocaleContext";
import { NAV_GROUP_LABELS, NAV_LABELS } from "@/lib/navigation";
import type { Place } from "@/lib/places";

/** A place's name: the main page by its own name, every other place by its group's heading. */
export function usePlaceName() {
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  return (place: Place) => (place.group.labelKey ? groupLabels[place.group.labelKey] : navLabels.overview);
}
