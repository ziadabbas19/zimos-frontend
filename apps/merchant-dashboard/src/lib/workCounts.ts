import { useEffect, useSyncExternalStore } from "react";
import { apiErrorCode, inboxListConversations, reviewsSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/**
 * The counts of work waiting, shared by the side menu, the phone dock and
 * home: calls due now, confirmed orders with no courier booked, unread
 * messages, reviews waiting for the merchant's approval. One poll per store for the whole shell, every minute while the
 * tab is visible. A count the role may not read (403) is `null`, and the row
 * shows no badge rather than a zero.
 */
export interface WorkCounts {
  toConfirm: number | null;
  toShip: number | null;
  unread: number | null;
  reviews: number | null;
}

const EMPTY: WorkCounts = { toConfirm: null, toShip: null, unread: null, reviews: null };
const REFRESH_MS = 60_000;

let state: { workspaceId: string | null; counts: WorkCounts } = { workspaceId: null, counts: EMPTY };
const listeners = new Set<() => void>();
let timer: number | undefined;
let inFlight: Promise<void> | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const snapshot = () => state.counts;

// Stores whose plan lacks reviews (403 PLAN_FEATURE_REQUIRED): not asked again until the dashboard reloads.
const reviewsLocked = new Set<string>();

function setReviews(workspaceId: string, reviews: number | null) {
  if (state.workspaceId !== workspaceId || state.counts.reviews === reviews) return;
  state = { workspaceId, counts: { ...state.counts, reviews } };
  emit();
}

async function load(workspaceId: string) {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    // Reviews waiting are asked alongside and written when they come: a slow answer never holds back the other counts.
    if (!reviewsLocked.has(workspaceId)) {
      void reviewsSummary(apiClient, workspaceId).then(
        (counts) => setReviews(workspaceId, counts?.pending ?? null),
        (err: unknown) => {
          if (apiErrorCode(err) === "PLAN_FEATURE_REQUIRED") reviewsLocked.add(workspaceId);
          setReviews(workspaceId, null);
        }
      );
    }
    const [confirm, pipeline, inbox] = await Promise.allSettled([
      apiClient.getConfirmationQueueCounts(workspaceId),
      apiClient.getOrderPipeline(workspaceId),
      inboxListConversations(apiClient, workspaceId, { status: "open", unread: true, limit: 1 }),
    ]);
    if (state.workspaceId !== workspaceId) return;
    const next: WorkCounts = {
      toConfirm: confirm.status === "fulfilled" ? (confirm.value?.pendingDue ?? null) : null,
      toShip: pipeline.status === "fulfilled" ? (pipeline.value?.stages?.ready_to_ship ?? null) : null,
      unread: inbox.status === "fulfilled" ? (inbox.value?.counts?.unread ?? null) : null,
      reviews: state.counts.reviews,
    };
    const prev = state.counts;
    if (prev.toConfirm !== next.toConfirm || prev.toShip !== next.toShip || prev.unread !== next.unread || prev.reviews !== next.reviews) {
      state = { workspaceId, counts: next };
      emit();
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function start(workspaceId: string) {
  if (state.workspaceId !== workspaceId) {
    state = { workspaceId, counts: EMPTY };
    emit();
  }
  void load(workspaceId);
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (document.visibilityState === "visible" && state.workspaceId) void load(state.workspaceId);
  }, REFRESH_MS);
}

/** Ask for fresh counts now — after confirming an order, booking a courier, reading a thread. */
export function refreshWorkCounts() {
  if (state.workspaceId) void load(state.workspaceId);
}

/**
 * The counts for `workspaceId`. The first caller starts the poll; every
 * caller shares the same numbers, so the dock and the side menu never
 * disagree.
 */
export function useWorkCounts(workspaceId: string | null | undefined): WorkCounts {
  const counts = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  useEffect(() => {
    if (!workspaceId) return;
    start(workspaceId);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshWorkCounts();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [workspaceId]);
  return workspaceId && state.workspaceId === workspaceId ? counts : EMPTY;
}
