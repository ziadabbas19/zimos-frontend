import { cache } from "react";
import type { CSSProperties } from "react";
import { ApiError, type StorefrontMeta } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "./serverApiClient";

/**
 * Store metadata, deduped per request. The layout needs it for the brand
 * colours and every page under it needs the name/currency, so `cache()` keeps
 * that to a single API call per render instead of one per component.
 *
 * Returns null for an unknown workspace so callers can `notFound()`.
 */
export const getStoreMeta = cache(async (workspaceId: string): Promise<StorefrontMeta | null> => {
  const client = await createServerStorefrontApiClient();
  try {
    return await client.getStorefrontMeta(workspaceId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

/** Matches the keys the dashboard's Settings page writes into themeSettings. */
const HEX = /^#[0-9a-f]{6}$/i;

function hex(themeSettings: Record<string, unknown> | undefined, key: string): string | null {
  const raw = themeSettings?.[key];
  return typeof raw === "string" && HEX.test(raw.trim()) ? raw.trim() : null;
}

/**
 * Inline custom properties for the store wrapper. Anything the merchant has not
 * set is left out entirely, so the stylesheet's own default palette (which is
 * light/dark aware) still applies — a single inline hex could not be.
 */
export function brandStyle(themeSettings: Record<string, unknown> | undefined): CSSProperties {
  const style: Record<string, string> = {};
  const primary = hex(themeSettings, "primaryColor");
  const secondary = hex(themeSettings, "secondaryColor");
  if (primary) style["--brand-primary"] = primary;
  if (secondary) style["--brand-secondary"] = secondary;
  return style as CSSProperties;
}
