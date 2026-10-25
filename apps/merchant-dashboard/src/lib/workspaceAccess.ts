import { useSyncExternalStore } from "react";
import type { WorkspaceAccess, WalletState } from "@store-builder/api-client";

/**
 * The last GET /workspaces/:id/access the AccessBanner read (it re-reads on
 * every page change), shared with the toolbar's balance and the locked-orders
 * banner so they cost no request of their own.
 */

type Snapshot = { workspaceId: string; access: WorkspaceAccess } | null;

let snapshot: Snapshot = null;
const listeners = new Set<() => void>();

export function publishWorkspaceAccess(workspaceId: string, access: WorkspaceAccess): void {
  snapshot = { workspaceId, access };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): Snapshot => snapshot;

/** The current store's access, once read; null before (or for another store). */
export function useWorkspaceAccess(workspaceId: string | undefined): WorkspaceAccess | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return current && workspaceId && current.workspaceId === workspaceId ? current.access : null;
}

/**
 * Orders the balance still pays for: the free orders left, then whole fees in
 * the balance. With locked orders on, nothing is confirmed below zero.
 */
export function ordersCovered(wallet: Pick<WalletState, "balance" | "fee" | "freeOrdersLeft">): number {
  const free = wallet.freeOrdersLeft ?? 0;
  if (!wallet.fee) return free;
  return free + Math.floor(Math.max(0, wallet.balance) / wallet.fee);
}

/** Below this many orders the toolbar's balance turns to a warning (the brief's 10). */
export const LOW_ORDERS = 10;
