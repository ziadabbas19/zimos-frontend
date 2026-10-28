/**
 * The team invite being accepted (pages/InviteAcceptPage), kept for this tab
 * while its owner leaves the page to sign in, sign up or go through Google:
 * every sign-in path lands on afterSignInPath(), which brings them back to
 * the invite instead of the store picker. sessionStorage: the token belongs
 * to this tab only, and is forgotten once the invite is accepted or is no
 * longer usable. Storage that throws (private mode, blocked) just means the
 * invitee opens the email link again after signing in.
 */

const KEY = "zimos.pendingInvite";
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export interface PendingInvite {
  token: string;
  /** The invited address, to fill in the sign-up form. */
  email: string | null;
}

export const isInviteToken = (value: string | null | undefined): value is string => Boolean(value && TOKEN_PATTERN.test(value));

export function invitePath(token: string): string {
  return `/invites?token=${encodeURIComponent(token)}`;
}

export function rememberPendingInvite(invite: PendingInvite): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(invite));
  } catch {
    // Not kept: the email link still works after signing in.
  }
}

export function readPendingInvite(): PendingInvite | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingInvite>;
    if (!isInviteToken(value.token)) return null;
    return { token: value.token, email: typeof value.email === "string" ? value.email : null };
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}

/** Where a sign-in or sign-up goes next: back to the invite being accepted, else the store picker. */
export function afterSignInPath(): string {
  const pending = readPendingInvite();
  return pending ? invitePath(pending.token) : "/workspaces";
}
