import { useEffect, useSyncExternalStore } from "react";
import type { HomeShortcuts } from "@store-builder/api-client";
import { onSessionEnd } from "@/lib/requestCache";

/**
 * A row a member arranges for themselves in a store (the Home shortcuts, the
 * phone's bottom bar), kept for the session so the screens that show it never
 * ask: the dashboard bootstrap hands it over when the page starts (lib/bootstrap),
 * and what is kept is read again on every visit. It is asked for on its own
 * only for a store the bootstrap did not cover, once, or when its editor opens.
 *
 * Until an answer is in — and if none ever comes (an API without the feature,
 * no network) — the row is the one this device last saw this member arrange,
 * or the default one, and it cannot be edited.
 */
export interface RowState {
  /** The server's answer, once there is one. */
  answer: HomeShortcuts | null;
  /** What this device last saw this member arrange, while there is no answer. */
  hint: string[] | null;
}

export interface RowStore {
  /** Keeps `answer` as this member's row in this store: from the bootstrap, or after a save. */
  seed: (workspaceId: string, answer: HomeShortcuts) => void;
  /** Asks the server. A failed read keeps what was already known; with nothing known, the next visit asks again. */
  read: (workspaceId: string) => Promise<void>;
  /** Forgets every row: the session ended. Also the test seam. */
  forget: () => void;
  useRow: (workspaceId: string | null | undefined, userId: string | null | undefined) => RowState;
}

/** `load` reads the row from the server; `hintName` names this device's copy ("homeShortcuts": zimos.homeShortcuts.<user>.<store>). */
export function createRowStore(load: (workspaceId: string) => Promise<HomeShortcuts>, hintName: string): RowStore {
  /** Null: asked, no answer yet (or none came). */
  const kept = new Map<string, HomeShortcuts | null>();
  const listeners = new Set<() => void>();
  // A read that comes back after the session ended belongs to nobody.
  let session = 0;

  const emit = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function seed(workspaceId: string, answer: HomeShortcuts) {
    kept.set(workspaceId, answer);
    emit();
  }

  async function read(workspaceId: string): Promise<void> {
    const asked = session;
    const answer = await load(workspaceId).catch(() => null);
    if (asked !== session) return;
    if (answer) seed(workspaceId, answer);
    else if (!kept.get(workspaceId)) kept.delete(workspaceId);
  }

  function forget() {
    session += 1;
    kept.clear();
    emit();
  }

  onSessionEnd(forget);

  const hintKey = (userId: string, workspaceId: string) => `zimos.${hintName}.${userId}.${workspaceId}`;

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

  function useRow(workspaceId: string | null | undefined, userId: string | null | undefined): RowState {
    const answer = useSyncExternalStore(subscribe, () => (workspaceId ? kept.get(workspaceId) : null)) ?? null;
    const key = workspaceId && userId ? hintKey(userId, workspaceId) : null;

    useEffect(() => {
      if (!workspaceId || kept.has(workspaceId)) return;
      kept.set(workspaceId, null);
      void read(workspaceId);
    }, [workspaceId]);

    useEffect(() => {
      if (key && answer) writeHint(key, answer);
    }, [key, answer]);

    return { answer, hint: answer || !key ? null : readHint(key) };
  }

  return { seed, read, forget, useRow };
}
