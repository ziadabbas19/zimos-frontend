import { dashboardBootstrap, type ApiClient, type DashboardBootstrap } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { storedWorkspaceId } from "@/lib/currentWorkspace";
import { coverWhile, prime } from "@/lib/requestCache";

/**
 * The dashboard's frame in one request (GET /workspaces/:id/bootstrap) instead
 * of a chain of them: the account, then the store list, then the banner, the
 * bell, the menu's counts and shortcuts, each a round trip of its own.
 *
 * Sent as soon as the page starts (main.tsx) and again after a sign-in, when
 * this device holds a session and the store last opened here. Each part is
 * then handed to the read that would have asked for it (lib/requestCache):
 * nothing in the screens changes, they just get their first answer without a
 * request. A read that comes while the bootstrap is on its way waits for it.
 *
 * When it cannot be had (an API without it, a store no longer this account's,
 * no network) nothing is primed and every screen asks its own endpoint, as
 * before. A part the role may not read is null and is not primed: that screen
 * asks, and is refused, as before.
 */

/** The inbox read behind the menu's unread badge (lib/workCounts), as the bootstrap answers it. */
export const INBOX_UNREAD_PATH = (workspaceId: string) => `/workspaces/${workspaceId}/inbox/conversations?status=open&unread=true&limit=1`;

/** Each part beside the GET it answers and the body that GET returns. */
export function bootstrapAnswers(workspaceId: string, boot: DashboardBootstrap): Array<[string, unknown]> {
  const ws = `/workspaces/${workspaceId}`;
  const answers: Array<[string, unknown]> = [
    ["/auth/me", boot.me],
    ["/auth/me/ui-preferences", { uiPreferences: boot.uiPreferences }],
    ["/workspaces", { workspaces: boot.workspaces }],
    [`${ws}/access`, { access: boot.access }],
    [`${ws}/plan-features`, { planFeatures: boot.planFeatures }],
    [`${ws}/notifications/summary`, boot.notifications],
    [`${ws}/shortcuts`, { shortcuts: boot.shortcuts }],
  ];
  if (boot.confirmationCounts) answers.push([`${ws}/confirmation-tasks/counts`, { counts: boot.confirmationCounts }]);
  if (boot.orderPipeline) answers.push([`${ws}/orders/pipeline`, boot.orderPipeline]);
  if (boot.inboxUnread) answers.push([INBOX_UNREAD_PATH(workspaceId), boot.inboxUnread]);
  return answers.filter(([, body]) => body !== undefined && body !== null);
}

/** Every GET the bootstrap may answer, known before it is sent. */
export function bootstrapPaths(workspaceId: string): string[] {
  const ws = `/workspaces/${workspaceId}`;
  return [
    "/auth/me",
    "/auth/me/ui-preferences",
    "/workspaces",
    `${ws}/access`,
    `${ws}/plan-features`,
    `${ws}/notifications/summary`,
    `${ws}/shortcuts`,
    `${ws}/confirmation-tasks/counts`,
    `${ws}/orders/pipeline`,
    INBOX_UNREAD_PATH(workspaceId),
  ];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A bootstrap answered this long ago is not sent again for the same store and session.
const REUSE_MS = 10_000;

let last: { key: string; at: number; done: Promise<void> } | null = null;

/**
 * Sends the bootstrap for the store kept on this device, unless one was just
 * sent for it. Resolves once its parts are primed, or once it has failed
 * (never rejects). Null when there is nothing to ask for: signed out, or no
 * store opened here yet.
 */
export function startBootstrap(client: ApiClient = apiClient): Promise<void> | null {
  if (!client.isAuthenticated()) return null;
  const workspaceId = storedWorkspaceId();
  if (!workspaceId || !UUID.test(workspaceId)) return null;
  const key = `${workspaceId}:${client.tokens.refreshToken ?? ""}`;
  if (last && last.key === key && Date.now() - last.at < REUSE_MS) return last.done;

  const done = dashboardBootstrap(client, workspaceId).then(
    (boot) => {
      for (const [path, body] of bootstrapAnswers(workspaceId, boot)) prime(path, body);
    },
    () => {
      // Every screen asks its own endpoint, as it did before the bootstrap.
    }
  );
  coverWhile(bootstrapPaths(workspaceId), done);
  last = { key, at: Date.now(), done };
  return done;
}

/** Test seam. */
export function resetBootstrap(): void {
  last = null;
}
