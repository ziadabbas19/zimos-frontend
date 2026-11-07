import { dashboardGetHomeShortcuts } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { createRowStore, type RowState } from "@/lib/shortcutRows";

/**
 * This member's Home shortcuts row, kept for the session so Home never asks
 * for it (lib/shortcutRows): the dashboard bootstrap hands it over when the
 * page starts (lib/bootstrap, `seedHomeShortcuts`), and going back to Home
 * reads what is kept. It is asked for on its own only for a store the
 * bootstrap did not cover, once, or when the merchant opens the row's editor.
 */
const store = createRowStore((workspaceId) => dashboardGetHomeShortcuts(apiClient, workspaceId), "homeShortcuts");

export const seedHomeShortcuts = store.seed;
export const readHomeShortcuts = store.read;
export const forgetHomeShortcuts = store.forget;
export const useHomeShortcuts = store.useRow;
export type HomeShortcutsState = RowState;
