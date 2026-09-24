/**
 * Public funnel runtime (backend: src/modules/funnels/funnelsPublicRoutes.js,
 * funnelsService start/getSessionStep/advanceSession). No staff auth.
 * Mounted at /store/:workspaceId/funnels — the workspace may be a UUID or the
 * store slug. All exported names in this file are prefixed with
 * `funnelRuntime` / `FunnelRuntime`.
 *
 * Notable codes: STEP_MISMATCH (409 — `fromStepKey` is no longer the
 * session's step; the error carries no step, so resync with
 * funnelRuntimeGetStep), FUNNEL_PAUSED (410), NOT_FOUND (404 — unpublished
 * funnel, unknown session), VALIDATION_ERROR (422 — e.g. accepting an upsell
 * before any checkout on this session).
 */
import type { ApiClient } from "../client";
import type { FunnelStepTypeDto } from "./funnels";
import type { PageTree } from "../types";

// ------------------------------------------------------------------ types --

export interface FunnelRuntimeSession {
  id: string;
  currentStepKey: string;
  /** Keys of the steps already passed through, oldest first. */
  path: string[];
  status: "active" | "completed";
  /** The order placed on this session's checkout step, once there is one. */
  orderId: string | null;
}

/** The published snapshot of one step — `tree` is the same page tree as website pages. */
export interface FunnelRuntimeStep {
  key: string;
  name: string;
  stepType: FunnelStepTypeDto;
  tree: PageTree | null;
  seo: Record<string, unknown>;
}

/** Present on upsell/downsell steps that have an active offer. */
export interface FunnelRuntimeOffer {
  id: string;
  name: string;
  /** Integer minor units — BIGINT, so it may arrive as a string. */
  priceAmount: string | number;
  currency: string;
  badge: string | null;
  lines: Array<{ variantId: string; quantity: number }>;
}

/**
 * What every runtime call answers with. `done: true` means the journey is
 * over — and it may still carry `step`, which is then the thank-you page the
 * visitor must see. `done` with no `step` means there is nothing left to
 * render (a republish removed that step).
 */
export interface FunnelRuntimeState {
  done?: boolean;
  session: FunnelRuntimeSession;
  step?: FunnelRuntimeStep;
  offer?: FunnelRuntimeOffer;
}

export interface FunnelRuntimeStartResult extends FunnelRuntimeState {
  funnel: { id: string; name: string; subdomain: string | null };
}

export interface FunnelRuntimeFollowOnOrder {
  id: string;
  orderNumber: string;
  totalAmount: string | number;
  linkedFromOrderId: string;
}

export interface FunnelRuntimeAdvanceResult extends FunnelRuntimeState {
  /** Set when an accepted upsell/downsell created a linked order. */
  followOnOrder?: FunnelRuntimeFollowOnOrder;
}

export type FunnelRuntimeOutcomeType =
  | "completed_checkout"
  | "accepted_offer"
  | "declined_offer"
  | "clicked_through";

export interface FunnelRuntimeAdvancePayload {
  /**
   * The step this outcome was produced on. Always send it: a stale tab or a
   * double submit then fails with 409 STEP_MISMATCH instead of routing the
   * visitor from the wrong place.
   */
  fromStepKey?: string;
  outcome: {
    type: FunnelRuntimeOutcomeType;
    /** completed_checkout: the order just placed on this step. */
    orderId?: string;
  };
}

// ------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/store/${encodeURIComponent(workspaceId)}/funnels`;

/**
 * Enter (or resume) a funnel by id or subdomain. An active session for the
 * same `visitorId` is resumed; a completed one starts over.
 */
export async function funnelRuntimeStart(
  client: ApiClient,
  workspaceId: string,
  funnelRef: string,
  payload: { visitorId: string; attribution?: Record<string, unknown> }
): Promise<FunnelRuntimeStartResult> {
  return client.request<FunnelRuntimeStartResult>(
    `${base(workspaceId)}/${encodeURIComponent(funnelRef)}/sessions`,
    { method: "POST", body: payload, auth: false }
  );
}

/** The session's current step — also the resync after a STEP_MISMATCH. */
export async function funnelRuntimeGetStep(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string
): Promise<FunnelRuntimeState> {
  return client.request<FunnelRuntimeState>(
    `${base(workspaceId)}/${funnelId}/sessions/${sessionId}/step`,
    { auth: false }
  );
}

/** Report the outcome of the current step and move to the next one. */
export async function funnelRuntimeAdvance(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string,
  payload: FunnelRuntimeAdvancePayload
): Promise<FunnelRuntimeAdvanceResult> {
  return client.request<FunnelRuntimeAdvanceResult>(
    `${base(workspaceId)}/${funnelId}/sessions/${sessionId}/advance`,
    { method: "POST", body: payload, auth: false }
  );
}
