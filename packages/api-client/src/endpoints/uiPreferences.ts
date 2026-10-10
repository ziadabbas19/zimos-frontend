/**
 * How the dashboard looks, kept on the signed-in account so it follows its
 * owner from one device to another (backend: src/modules/auth/uiPreferences.js,
 * uiPreferencesService.js). About the signed-in person, no workspace.
 *
 *   GET   /auth/me/ui-preferences   { uiPreferences }: null until the account saves something
 *   PATCH /auth/me/ui-preferences   { appearance }: replaces the appearance part, whole
 *
 * An API from before this answers 404 ROUTE_NOT_FOUND to both. A save is
 * refused with 422 VALIDATION_ERROR for a key it does not know (`updatedAt`
 * among them: the server sets it), a number or a boolean sent as text, or a
 * colour that is not `#rrggbb`; 413 PAYLOAD_TOO_LARGE over 1024 bytes; 429
 * past 120 saves an hour for the account.
 */
import type { ApiClient } from "../client";

export type UiLook = "light" | "black" | "dark";

/** What a save sends: every key, each time. */
export interface UiAppearanceInput {
  /** null while the dashboard follows the device. */
  look: UiLook | null;
  /** 0 (midnight) to 100 (slate), a whole number. */
  darkTone: number;
  /** The glass surfaces are on. */
  glass: boolean;
  /** `#rrggbb`; null for the colours the backdrop has by itself. */
  glowLeft: string | null;
  glowRight: string | null;
  /** 0 to 100, a whole number. */
  glowIntensity: number;
}

/** What the account holds. A key is null only when it was never saved. */
export interface UiAppearance {
  look: UiLook | null;
  darkTone: number | null;
  glass: boolean | null;
  glowLeft: string | null;
  glowRight: string | null;
  glowIntensity: number | null;
  /** When it was last saved, by the server's clock (ISO 8601). */
  updatedAt: string | null;
}

export interface UiPreferences {
  appearance: UiAppearance;
}

const PATH = "/auth/me/ui-preferences";

/** null for an account that never saved a look. */
export async function uiPreferencesGet(client: ApiClient): Promise<UiPreferences | null> {
  const body = await client.request<{ uiPreferences?: UiPreferences | null }>(PATH);
  return body?.uiPreferences ?? null;
}

export async function uiPreferencesSaveAppearance(client: ApiClient, appearance: UiAppearanceInput): Promise<UiPreferences> {
  const { uiPreferences } = await client.request<{ uiPreferences: UiPreferences }>(PATH, { method: "PATCH", body: { appearance } });
  return uiPreferences;
}
