import { STORE_SIDEBAR_ENABLED } from "./features";
import type { HeaderShell } from "./storeShell";

/**
 * Whether this store draws its navigation as a column beside the page on a
 * wide screen (`themeSettings.header.layout: "side"`, the Store look's
 * "Navigation" choice) instead of the bar across the top.
 *
 * The one place that decides it, so the build switch (lib/features
 * STORE_SIDEBAR_ENABLED) has one place to hold: off, every store keeps the
 * top bar whatever it saved. A phone keeps the top bar and its menu sheet in
 * both layouts, and so does anything narrower than `xl`; that part is CSS, not this function.
 */
export function hasSideNav(header: Pick<HeaderShell, "layout">): boolean {
  return STORE_SIDEBAR_ENABLED && header.layout === "side";
}
