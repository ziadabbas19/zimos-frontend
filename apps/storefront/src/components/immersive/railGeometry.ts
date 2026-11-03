import type { GarmentKind } from "@/lib/railGarment";

/** The box every piece is drawn in (viewBox units), and where its hook starts. */
export const VB_W = 200;
export const VB_H = 310;
export const HOOK_TOP = 4;

/** How each kind of garment rests side-on: its hem, long sleeves or not, a hood, how wide it shows. */
export const SIDE = {
  tee: { hem: 240, long: false, hood: false, width: 0.23 },
  knit: { hem: 232, long: true, hood: false, width: 0.25 },
  hoodie: { hem: 234, long: true, hood: true, width: 0.33 },
  shirt: { hem: 244, long: true, hood: false, width: 0.25 },
  jacket: { hem: 234, long: true, hood: false, width: 0.27 },
  coat: { hem: 296, long: true, hood: false, width: 0.27 },
} as const satisfies Record<GarmentKind, { hem: number; long: boolean; hood: boolean; width: number }>;

export function mix(color: string, amount: number) {
  if (amount === 0) return color;
  const keep = Math.round((1 - Math.min(1, Math.abs(amount))) * 1000) / 10;
  return `color-mix(in oklab, ${color} ${keep}%, ${amount > 0 ? "white" : "black"})`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
