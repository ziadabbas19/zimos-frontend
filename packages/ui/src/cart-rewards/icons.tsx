import type { ReactNode } from "react";
import type { RewardIconName } from "./iconNames";

/**
 * The rewards bar's icons, drawn inline (no icon font, nothing fetched): one
 * small set shared by the store's bar and the dashboard's picker. Each comes
 * as an outline and as a filled shape, so a reached reward reads as reached
 * by its shape too, not only by its colour.
 *
 * The truck, the percent sign and the tag are the bar's icons as they always
 * were (same paths, same strokes): a store that picks nothing sees no change.
 */

type Fill = "currentColor" | undefined;

const SHAPES: Record<RewardIconName, { width: number; flip?: boolean; noJoin?: boolean; draw: (fill: Fill) => ReactNode }> = {
  truck: {
    width: 2,
    // Drives towards the end of the line: mirrored in Arabic.
    flip: true,
    draw: (fill) => (
      <>
        <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" fill={fill} />
        <circle cx="7" cy="17" r="1.6" fill={fill} />
        <circle cx="17" cy="17" r="1.6" fill={fill} />
      </>
    ),
  },
  percent: {
    width: 2.2,
    noJoin: true,
    draw: (fill) => (
      <>
        <path d="M18 6 6 18" />
        <circle cx="7.5" cy="7.5" r="2" fill={fill} />
        <circle cx="16.5" cy="16.5" r="2" fill={fill} />
      </>
    ),
  },
  tag: {
    width: 2,
    draw: (fill) => (
      <>
        <path d="M3 12V4h8l9 9-8 8z" fill={fill} />
        {/* The hole stays open when filled. */}
        <circle cx="7.5" cy="7.5" r="1.4" fill={fill ? "var(--reward-icon-hole, #fff)" : undefined} />
      </>
    ),
  },
  gift: {
    width: 2,
    draw: (fill) => (
      <>
        <rect x="4" y="8" width="16" height="4" rx="1" fill={fill} />
        <path d="M5.5 12v7a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-7" fill={fill} />
        <path d="M12 8v12.5M12 8S10.5 3.5 8 3.5a2.25 2.25 0 0 0 0 4.5M12 8s1.5-4.5 4-4.5a2.25 2.25 0 0 1 0 4.5" />
      </>
    ),
  },
  star: {
    width: 2,
    draw: (fill) => <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill={fill} />,
  },
  heart: {
    width: 2,
    draw: (fill) => <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill={fill} />,
  },
  crown: {
    width: 2,
    draw: (fill) => <path d="M3.5 8l4.3 3.8L12 5l4.2 6.8L20.5 8l-1.8 10.5H5.3z" fill={fill} />,
  },
  bolt: {
    width: 2,
    draw: (fill) => <path d="M13.5 2.5 4.5 14h6.5l-1 7.5 9-11.5h-6.5z" fill={fill} />,
  },
  check: {
    width: 2,
    draw: (fill) =>
      !fill ? (
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      ) : (
        <>
          <circle cx="12" cy="12" r="9" fill="currentColor" />
          <path d="m7.5 12.5 3 3 6-6.5" stroke="var(--reward-icon-hole, #fff)" />
        </>
      ),
  },
};

/**
 * One reward icon. Decorative (the label under the marker says what it is):
 * hidden from screen readers. `filled` draws the solid shape.
 */
export function RewardIcon({ name, size = 14, filled = false, className = "" }: { name: RewardIconName; size?: number; filled?: boolean; className?: string }) {
  const shape = SHAPES[name] ?? SHAPES.gift;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={shape.width}
      strokeLinecap="round"
      strokeLinejoin={shape.noJoin ? undefined : "round"}
      aria-hidden="true"
      data-reward-icon={name}
      data-filled={filled ? "" : undefined}
      className={`${shape.flip ? "rtl:-scale-x-100 " : ""}${className}`.trim() || undefined}
    >
      {shape.draw(filled ? "currentColor" : undefined)}
    </svg>
  );
}
