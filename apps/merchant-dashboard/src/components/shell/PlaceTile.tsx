import { cn } from "@store-builder/ui";
import { PLACE_COLOR, type PlaceId } from "@/lib/places";
import { PLACE_GLYPHS } from "./placeGlyphs";

/**
 * A place's face, as an iPhone app icon: its colour as a rounded square with a
 * faint light from the top, and its filled glyph in white. Decorative: the
 * link around it carries the place's name. The size comes from the caller
 * (`className`), the glyph keeps its share of it. `onBrand`: white, the glyph
 * in the place's colour, for a tile on the brand fill. Forced colours draw it
 * in the system's own colours.
 */
export function PlaceTile({ place, onBrand = false, className }: { place: PlaceId; onBrand?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      data-place-tile={place}
      // On the brand fill (the current row) the tile turns white with its glyph in the place's colour, or it would vanish.
      style={onBrand ? { backgroundColor: "#ffffff", color: PLACE_COLOR[place] } : { backgroundColor: PLACE_COLOR[place] }}
      className={cn(
        "grid shrink-0 place-items-center rounded-[26%] bg-[linear-gradient(180deg,rgb(255_255_255/0.2)_0%,rgb(255_255_255/0)_55%)]",
        !onBrand && "text-white",
        "shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.14),0_1px_2px_rgb(0_0_0/0.16)] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
        className
      )}
    >
      {/* Trusted markup: the glyphs are generated from the icon package (placeGlyphs.ts), shapes only. */}
      <svg viewBox="0 0 56 56" className="size-[58%]" dangerouslySetInnerHTML={{ __html: PLACE_GLYPHS[place] }} />
    </span>
  );
}
