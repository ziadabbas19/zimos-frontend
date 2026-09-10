/**
 * Brand colours live in the workspace's `themeSettings` JSONB blob, which the
 * backend treats as opaque — these two keys are the contract between this
 * dashboard and the storefront's `.brand-theme` CSS.
 */
export const DEFAULT_PRIMARY = "#1F5D5B";
export const DEFAULT_SECONDARY = "#E2A33D";

/** Presets that read well as a storefront brand colour, light and dark. */
export const BRAND_COLOR_PRESETS = [
  "#1F5D5B", // teal — the platform default primary
  "#1E40AF", // indigo
  "#0F766E", // emerald
  "#B45309", // amber
  "#BE123C", // rose
  "#6D28D9", // violet
  "#0E7490", // cyan
  "#1F2937", // slate
];

/** Normalises "1e40af" / "#1E40AF" / "#abc" to "#1E40AF"; null if unparseable. */
export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return /^[0-9a-f]{6}$/i.test(expanded) ? `#${expanded.toUpperCase()}` : null;
}

/** Reads one colour key out of a themeSettings blob, falling back if unset/invalid. */
export function readThemeColor(
  themeSettings: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  const raw = themeSettings?.[key];
  return (typeof raw === "string" && normalizeHex(raw)) || fallback;
}
