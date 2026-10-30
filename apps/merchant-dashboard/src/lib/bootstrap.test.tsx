import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  dashboardGetShortcuts,
  inboxListConversations,
  notificationsSummary,
  uiPreferencesGet,
  workspacePlanFeatures,
  type ApiClient,
  type DashboardBootstrap,
} from "@store-builder/api-client";
import { bootstrapPaths, resetBootstrap, startBootstrap } from "@/lib/bootstrap";
import { CURRENT_WORKSPACE_KEY } from "@/lib/currentWorkspace";
import { resetRequestCache } from "@/lib/requestCache";
import { INBOX_UNREAD_PARAMS } from "@/lib/workCounts";

/**
 * The bootstrap over the real client (lib/apiClient; setup.ts mocks it for
 * screens): one request answers the frame's first reads, exactly the reads
 * the screens make, and nothing else changes.
 */
const { apiClient: client } = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");

const WS = "8a1f0d6e-2b3c-4d5e-8f90-1a2b3c4d5e6f";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function boot(overrides: Partial<DashboardBootstrap> = {}): DashboardBootstrap {
  return {
    me: { user: { id: "user_1", email: "owner@zimos.test", status: "active", username: "owner" }, needsPlan: false, confirmed: true },
    uiPreferences: { appearance: null },
    workspaces: [{ workspace: { id: WS, name: "Nile Store", slug: "nile" }, role: { key: "owner", name: "Owner", permissions: ["*"] } }],
    access: { restricted: false, draft: false, warnings: [] },
    planFeatures: { features: ["api_access"], enforced: false },
    notifications: { unreadCount: 2, latestOrderNotificationAt: null, soundEnabled: true },
    shortcuts: ["/orders"],
    confirmationCounts: { pending: 1, pendingDue: 1, inProgress: 0 },
    inboxUnread: { conversations: [], counts: { unread: 4 } },
    ...overrides,
  };
}

let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;
const paths = () => fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/api\/v1/, ""));

/** The reads the frame makes on a page load, as the screens make them. */
function frameReads(api: ApiClient) {
  return Promise.all([
    api.meDetails(),
    uiPreferencesGet(api),
    api.listWorkspaces(),
    api.getWorkspaceAccess(WS),
    workspacePlanFeatures(api, WS),
    notificationsSummary(api, WS),
    dashboardGetShortcuts(api, WS),
    api.getConfirmationQueueCounts(WS),
    api.getOrderPipeline(WS),
    inboxListConversations(api, WS, INBOX_UNREAD_PARAMS),
  ]);
}

/** Answers the bootstrap with `body` (or `status`), anything else with `{}` plus what the typed methods unwrap. */
function serve(bootstrap: () => Response) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = String(url).replace(/^.*\/api\/v1/, "");
    if (path === `/workspaces/${WS}/bootstrap`) return bootstrap();
    if (path === "/auth/me") return json(200, { user: { id: "user_1" } });
    if (path === "/workspaces") return json(200, { workspaces: [] });
    if (path.endsWith("/access")) return json(200, { access: { restricted: false } });
    if (path.endsWith("/plan-features")) return json(200, { planFeatures: { features: [], enforced: false } });
    if (path.endsWith("/shortcuts")) return json(200, { shortcuts: [] });
    if (path.endsWith("/counts")) return json(200, { counts: { pending: 0 } });
    return json(200, {});
  });
}

beforeEach(() => {
  resetRequestCache();
  resetBootstrap();
  localStorage.setItem("sb.accessToken", "access-1");
  localStorage.setItem("sb.refreshToken", "refresh-1");
  localStorage.setItem(CURRENT_WORKSPACE_KEY, WS);
  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("the dashboard bootstrap", () => {
  it("answers every read of the frame with the one request, but the order pipeline", async () => {
    serve(() => json(200, { bootstrap: boot() }));
    await startBootstrap(client);
    const [me, , list, access, plan, summary, shortcuts, counts, , inbox] = await frameReads(client);

    // The pipeline counts every order of the store: it is asked for on its own, alongside.
    expect(paths()).toEqual([`/workspaces/${WS}/bootstrap`, `/workspaces/${WS}/orders/pipeline`]);
    expect(me.user.id).toBe("user_1");
    expect(list.map((w) => [w.id, w.role])).toEqual([[WS, "owner"]]);
    expect(access).toEqual({ restricted: false, draft: false, warnings: [] });
    expect(plan.features).toEqual(["api_access"]);
    expect(summary.unreadCount).toBe(2);
    expect(shortcuts).toEqual(["/orders"]);
    expect(counts.pendingDue).toBe(1);
    expect(inbox.counts?.unread).toBe(4);
  });

  it("names exactly the paths the screens read", () => {
    expect(new Set(bootstrapPaths(WS)).size).toBe(9);
    expect(bootstrapPaths(WS)).toContain(`/workspaces/${WS}/inbox/conversations?status=open&unread=true&limit=1`);
  });

  it("makes a read that comes first wait for it instead of asking twice", async () => {
    let answer!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)));
    const started = startBootstrap(client);
    const me = client.meDetails();
    const list = client.listWorkspaces();
    await Promise.resolve();
    answer(json(200, { bootstrap: boot() }));
    await started;
    expect((await me).user.id).toBe("user_1");
    expect(await list).toHaveLength(1);
    expect(paths()).toEqual([`/workspaces/${WS}/bootstrap`]);
  });

  it("leaves a part the role may not read to its own endpoint, which answers as before", async () => {
    serve(() => json(200, { bootstrap: boot({ confirmationCounts: null, inboxUnread: null }) }));
    await startBootstrap(client);
    await frameReads(client);
    expect(paths().sort()).toEqual(
      [
        `/workspaces/${WS}/bootstrap`,
        `/workspaces/${WS}/confirmation-tasks/counts`,
        `/workspaces/${WS}/orders/pipeline`,
        `/workspaces/${WS}/inbox/conversations?status=open&unread=true&limit=1`,
      ].sort()
    );
  });

  it("falls back to every endpoint when the API has no bootstrap", async () => {
    serve(() => json(404, { error: { code: "NOT_FOUND", message: "Route not found" } }));
    await startBootstrap(client);
    await frameReads(client);
    expect(paths()).toHaveLength(11);
  });

  it("asks the server again after a save", async () => {
    serve(() => json(200, { bootstrap: boot() }));
    await startBootstrap(client);
    await client.request(`/workspaces/${WS}/shortcuts`, { method: "PUT", body: { shortcuts: [] } });
    await client.getWorkspaceAccess(WS);
    expect(paths()).toEqual([`/workspaces/${WS}/bootstrap`, `/workspaces/${WS}/shortcuts`, `/workspaces/${WS}/access`]);
  });

  it("sends nothing while signed out or before a store was opened on this device", () => {
    localStorage.removeItem(CURRENT_WORKSPACE_KEY);
    expect(startBootstrap(client)).toBeNull();
    localStorage.setItem(CURRENT_WORKSPACE_KEY, WS);
    localStorage.removeItem("sb.accessToken");
    expect(startBootstrap(client)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is sent once for a page load, however many times it is asked for", async () => {
    serve(() => json(200, { bootstrap: boot() }));
    await Promise.all([startBootstrap(client), startBootstrap(client)]);
    expect(paths()).toEqual([`/workspaces/${WS}/bootstrap`]);
  });
});
