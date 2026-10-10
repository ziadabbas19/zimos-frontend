import { forwardRef } from "react";
import type { Icon, IconProps } from "@/components/icons";

/**
 * The three corner choices drawn as what they are — one corner of a card —
 * for the Corners segmented control. Shaped like the icon set's own glyphs
 * (a forwardRef svg taking `className` and `weight`), so `Segmented` takes
 * them as any other icon; the chosen one is drawn with a heavier stroke
 * where a Phosphor glyph would be filled.
 */
function cornerIcon(name: string, path: string): Icon {
  const Corner = forwardRef<SVGSVGElement, IconProps>(function Corner(props, ref) {
    const { color, children, className, style, strokeWidth } = props;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke={color ?? "currentColor"}
        strokeWidth={strokeWidth ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden={props["aria-hidden"]}
      >
        <path d={path} />
        {children}
      </svg>
    );
  });
  Corner.displayName = name;
  // The same call shape as a Phosphor icon; only the generic wrapper type differs.
  return Corner as unknown as Icon;
}

/** A square corner. */
export const IconCornerSharp = cornerIcon("IconCornerSharp", "M5 20V5h15");
/** A gently rounded corner. */
export const IconCornerSoft = cornerIcon("IconCornerSoft", "M5 20v-9a6 6 0 0 1 6-6h9");
/** A fully rounded corner. */
export const IconCornerRound = cornerIcon("IconCornerRound", "M5 20v-3A12 12 0 0 1 17 5h3");
