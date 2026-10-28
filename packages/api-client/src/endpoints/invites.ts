/**
 * The link in a team invite email (backend: src/modules/workspaces/
 * inviteAcceptance.js), opened on the dashboard's /invites?token=… page.
 *
 *   GET  /invites/:token          no account needed: the store, the role, the address
 *   POST /invites/:token/accept   signed in with that address: joins the store
 *
 * Errors: 404 INVITE_INVALID (unknown, or replaced by a newer link), 410
 * INVITE_EXPIRED, 409 INVITE_ALREADY_ACCEPTED, 403 INVITE_EMAIL_MISMATCH,
 * 409 ALREADY_MEMBER.
 */
import type { ApiClient } from "../client";

export type InviteState = "pending" | "expired" | "accepted";

export interface InviteDetails {
  state: InviteState;
  workspace: { name: string };
  role: { key: string; name: string };
  /** The invited address; null once the invite was accepted. */
  email: string | null;
  expiresAt: string | null;
}

export interface AcceptedInvite {
  workspace: { id: string; name: string; slug: string };
  role: { key: string; name: string };
}

export async function getInvite(client: ApiClient, token: string): Promise<InviteDetails> {
  const { invite } = await client.request<{ invite: InviteDetails }>(`/invites/${encodeURIComponent(token)}`);
  return invite;
}

export function acceptInvite(client: ApiClient, token: string): Promise<AcceptedInvite> {
  return client.request<AcceptedInvite>(`/invites/${encodeURIComponent(token)}/accept`, { method: "POST", body: {} });
}
