import { useEffect, useSyncExternalStore } from "react";
import { dashboardGetHomeShortcuts, type HomeShortcuts } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { onSessionEnd } from "@/lib/requestCache";

/**
 * This member's Home shortcuts row, kept for the session so Home never asks
 * for it: the dashboard bootstrap hands it over when the page starts
 * (lib/bootstrap, `seedHomeShortcuts`), and going back to Home reads what is
 * kept. It is asked for on its own only for a store the bootstrap did not
 * cover, once, or when the merchant opens the row's editor.
 *
 * Until an answer is in — and if none ever comes (an API without the feature,
 * no network) — the row is the one this device last saw this member arrange,
 * or the default one, and it cannot be edited.
 */

/** Null: asked, no answer yet (or none came). */
const kept = new Map<string, HomeShortcuts | null>();
const listeners = new Set<() => void>();
// A read that comes back after the session ended belongs to nobody.
let session = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Keeps `answer` as this member's row in this store: from the bootstrap, or after a save. */
export function seedHomeShortcuts(workspaceId: string, answer: HomeShortcuts) {
  kept.set(workspaceId, answer);
  emit();
}

/** Asks the server. A failed read keeps what was already known; with nothing known, the next visit to Home asks again. */
export async function readHomeShortcuts(workspaceId: string): Promise<void> {
  const asked = session;
  const answer = await dashboardGetHomeShortcuts(apiClient, workspaceId).catch(() => null);
  if (asked !== session) return;
  if (answer) seedHomeShortcuts(workspaceId, answer);
  else if (!kept.get(workspaceId)) kept.delete(workspaceId);
}

/** Forgets every row: the session ended. Also the test seam. */
export function forgetHomeShortcuts() {
  session += 1;
  kept.clear();
  emit();
}

onSessionEnd(forgetHomeShortcuts);

const hintKey = (userId: string, workspaceId: string) => `zimos.homeShortcuts.${userId}.${workspaceId}`;

function readHint(key: string): string[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : null;
  } catch {
    return null;
  }
}

function writeHint(key: string, answer: HomeShortcuts) {
  try {
    if (answer.customized) localStorage.setItem(key, JSON.stringify(answer.shortcuts));
    else localStorage.removeItem(key);
  } catch {
    // Private mode or a full disk: the row just waits for the server's answer on the next visit.
  }
}

export interface HomeShortcutsState {
  /** The server's answer, once there is one. */
  answer: HomeShortcuts | null;
  /** What this device last saw this member arrange, while there is no answer. */
  hint: string[] | null;
}

export function useHomeShortcuts(workspaceId: string | null | undefined, userId: string | null | undefined): HomeShortcutsState {
  const answer = useSyncExternalStore(subscribe, () => (workspaceId ? kept.get(workspaceId) : null)) ?? null;
  const key = workspaceId && userId ? hintKey(userId, workspaceId) : null;

  useEffect(() => {
    if (!workspaceId || kept.has(workspaceId)) return;
    kept.set(workspaceId, null);
    void readHomeShortcuts(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (key && answer) writeHint(key, answer);
  }, [key, answer]);

  return { answer, hint: answer || !key ? null : readHint(key) };
}
