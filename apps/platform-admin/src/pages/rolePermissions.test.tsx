import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@store-builder/api-client";
import { CanLink } from "@/components/Can";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import * as notificationsApi from "@/lib/notificationsApi";
import { P, hasPermission, type PermissionCheck } from "@/lib/permissions";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminUsersPage } from "./AdminUsersPage";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { BlocklistPage } from "./BlocklistPage";
import { FeatureFlagsPage } from "./FeatureFlagsPage";
import { FraudSignalsPage } from "./FraudSignalsPage";
import { NotificationsPage } from "./NotificationsPage";
import { OverviewPage } from "./OverviewPage";
import { PlansPage } from "./PlansPage";
import { TicketDetailPage } from "./TicketDetailPage";
import { WorkspaceDetailPage } from "./WorkspaceDetailPage";

/**
 * What a limited account sees with the API mocked: a page opens though the
 * lookups beside it are someone else's permission, and what it can't do is not
 * on the page at all, not disabled.
 */

const h = vi.hoisted(() => ({ user: null as AuthUser | null }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: h.user,
    can: (permission: PermissionCheck) => hasPermission(h.user, permission),
  }),
}));

vi.mock("@/lib/adminApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminApi")>();
  return {
    ...actual,
    listFlags: vi.fn(),
    listAnnouncements: vi.fn(),
    listPlans: vi.fn(),
    listPlansWithCatalog: vi.fn(),
    listWorkspaceRows: vi.fn(),
    listBlocklist: vi.fn(),
    listRiskSignals: vi.fn(),
    getTicket: vi.fn(),
    loadOverview: vi.fn(),
    getWorkspaceRow: vi.fn(),
    listAdmins: vi.fn(),
    listRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
  };
});

vi.mock("@/components/storeAccess", () => ({ StoreAccessPanel: () => null }));

vi.mock("@/lib/notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notificationsApi")>();
  return { ...actual, unreadCount: vi.fn(), listNotifications: vi.fn(), getPrefs: vi.fn() };
});

const api = vi.mocked(adminApi);
const notifications = vi.mocked(notificationsApi);

function viewer(permissions: string[], platformRole = "support_desk_a1b2c3") {
  h.user = { id: "me", email: "me@example.com", platformRole, platformPermissions: permissions } as unknown as AuthUser;
}

function show(element: React.ReactNode, path = "/page") {
  render(
    <LocaleProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/page" element={element} />
            <Route path="/page/:id" element={element} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}

const FLAG = {
  id: "f1",
  key: "checkout.one_page",
  description: "One page",
  enabled: true,
  rollout: 40,
  targetWorkspaceIds: [],
  updatedAt: "2026-11-01T00:00:00Z",
};

const ANNOUNCEMENT = {
  id: "a1",
  title: "Scheduled work",
  body: "Tonight",
  severity: "info",
  audience: "all",
  planId: null,
  workspaceId: null,
  workspaceName: null,
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: null,
  dismissible: true,
  createdBy: "Ziad",
};

const ENTRY = {
  id: "e1",
  type: "phone",
  value: "+201000000000",
  label: "01000000000",
  reason: "Refuses orders",
  expiresAt: null,
  createdAt: "2026-11-01T00:00:00Z",
  createdBy: "Ziad",
  status: "active",
};

const SIGNAL = {
  type: "phone",
  value: "+201000000001",
  label: "01000000001",
  workspaces: [{ id: "w1", name: "Nile Store" }],
  workspaceCount: 1,
  orderCount: 3,
  refusedCount: 2,
  refusalRate: 0.66,
  lastSeenAt: "2026-11-01T00:00:00Z",
  reasons: ["high_refusal"],
  blocked: false,
  blocklistEntryId: null,
  block: { type: "phone", phone: "+201000000001" },
};

const THREAD = {
  ticket: {
    id: "t1",
    subject: "The store is down",
    status: "open",
    priority: "normal",
    workspaceId: "w1",
    workspaceName: "Nile Store",
    category: "technical",
    createdAt: "2026-11-01T00:00:00Z",
    createdBy: "Sara",
    createdByEmail: "sara@example.com",
    lastMessageAt: "2026-11-01T00:00:00Z",
  },
  messages: [{ id: "m1", authorType: "merchant", authorName: "Sara", authorEmail: "sara@example.com", body: "Help", createdAt: "2026-11-01T00:00:00Z" }],
};

const ROLES = {
  roles: [
    { key: "creator", name: "Creator", description: null, defaultPermissions: ["*"], builtIn: true, holders: 1 },
    { key: "admin", name: "Admin", description: null, defaultPermissions: [P.PLANS_VIEW], builtIn: true, holders: 0 },
    { key: "agent", name: "Agent", description: null, defaultPermissions: [P.REFERRALS_VIEW_OWN], builtIn: true, holders: 0 },
    { key: "support_desk_a1b2c3", name: "Support desk", description: "Answers merchants", defaultPermissions: [P.SUPPORT_VIEW], builtIn: false, holders: 1 },
    { key: "billing_d4e5f6", name: "Billing", description: null, defaultPermissions: [P.PAYMENTS_RECORD], builtIn: false, holders: 0 },
  ],
  permissions: [P.SUPPORT_VIEW, P.SUPPORT_MANAGE, P.PAYMENTS_RECORD, P.PLANS_VIEW, P.ADMINS_VIEW, P.ADMINS_MANAGE, P.REFERRALS_VIEW_OWN],
};

const ADMINS = [
  { id: "me", email: "me@example.com", fullName: "Me", status: "active", lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", role: "admin", roleName: "Admin", permissions: [P.ADMINS_VIEW, P.ADMINS_MANAGE], isYou: true },
  { id: "c1", email: "boss@example.com", fullName: "Boss", status: "active", lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", role: "creator", roleName: "Creator", permissions: ["*"], isYou: false },
  { id: "o1", email: "other@example.com", fullName: "Other", status: "active", lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", role: "support_desk_a1b2c3", roleName: "Support desk", permissions: [P.SUPPORT_VIEW], isYou: false },
];

beforeEach(() => {
  for (const fn of Object.values(api)) if (vi.isMockFunction(fn)) fn.mockReset();
  api.listFlags.mockResolvedValue([FLAG] as never);
  api.listAnnouncements.mockResolvedValue([ANNOUNCEMENT] as never);
  api.listPlans.mockResolvedValue([]);
  api.listWorkspaceRows.mockResolvedValue([]);
  api.listBlocklist.mockResolvedValue({ entries: [ENTRY], total: 1, limit: 50 } as never);
  api.listRiskSignals.mockResolvedValue({ signals: [SIGNAL], total: 1, limit: 50, thresholds: null } as never);
  api.getTicket.mockResolvedValue(THREAD as never);
  api.listAdmins.mockResolvedValue(ADMINS as never);
  api.listRoles.mockResolvedValue(ROLES as never);
  notifications.unreadCount.mockReset().mockResolvedValue(0);
  notifications.listNotifications.mockReset().mockResolvedValue({ notifications: [], nextCursor: null, unread: 0 } as never);
  notifications.getPrefs.mockReset().mockResolvedValue({ prefs: [], emailDelivery: false } as never);
});
afterEach(cleanup);

describe("a view-only account", () => {
  it("opens the feature flags without the store list, and is offered no change to them", async () => {
    viewer([P.FEATURE_FLAGS_VIEW]);
    show(<FeatureFlagsPage />);

    expect(await screen.findByText("checkout.one_page")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(api.listWorkspaceRows).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /New flag/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Targets/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("opens the announcements without the plans or the store list, and is offered no change to them", async () => {
    viewer([P.ANNOUNCEMENTS_VIEW]);
    show(<AnnouncementsPage />);

    expect(await screen.findByText("Scheduled work")).toBeTruthy();
    expect(api.listPlans).not.toHaveBeenCalled();
    expect(api.listWorkspaceRows).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /New announcement/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit Scheduled work/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete Scheduled work/ })).toBeNull();
  });

  it("reads the blocklist with nothing to press", async () => {
    viewer([P.RISK_VIEW]);
    show(<BlocklistPage />);

    expect(await screen.findByText("Refuses orders")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Block identifier/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Unblock/ })).toBeNull();
  });

  it("reads the fraud signals with nothing to block, and a store it can't open is plain text", async () => {
    viewer([P.RISK_VIEW]);
    show(<FraudSignalsPage />);

    expect(await screen.findByText("Nile Store")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Block/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Nile Store" })).toBeNull();
  });

  it("reads a ticket without the reply box or the status and priority controls", async () => {
    viewer([P.SUPPORT_VIEW]);
    show(<TicketDetailPage />, "/page/t1");

    expect(await screen.findByText("Help")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send reply/ })).toBeNull();
    expect(screen.queryByLabelText("Status")).toBeNull();
    expect(screen.queryByLabelText("Priority")).toBeNull();
    expect(screen.queryByRole("link", { name: "Nile Store" })).toBeNull();
  });

  it("sees the plans with no new, edit or delete", async () => {
    api.listPlansWithCatalog.mockResolvedValue({
      plans: [{ id: "p1", code: "pro", name: "Pro", active: true, isPublic: true, displayOrder: 1, monthlyPrice: 100, yearlyPrice: 1000, currency: "EGP", trialDays: 0, maxStores: 1, maxFunnelsPerMonth: 1, orderQuota: null, transactionFeeBp: 0, codFeeBp: 0, features: [], updatedAt: "2026-11-01T00:00:00Z" }],
      featureCatalog: [],
    } as never);
    viewer([P.PLANS_VIEW]);
    show(<PlansPage />);

    expect(await screen.findByText("Pro")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New plan/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });
});

describe("an account that can edit", () => {
  it("gets the feature flag controls, and the targets only with the store list", async () => {
    viewer([P.FEATURE_FLAGS_VIEW, P.FEATURE_FLAGS_MANAGE]);
    show(<FeatureFlagsPage />);

    expect(await screen.findByRole("button", { name: /New flag/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Delete checkout.one_page/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Targets/ })).toBeNull();
    expect(api.listWorkspaceRows).not.toHaveBeenCalled();
  });

  it("gets the targets too with the store list", async () => {
    viewer([P.FEATURE_FLAGS_VIEW, P.FEATURE_FLAGS_MANAGE, P.WORKSPACES_VIEW]);
    show(<FeatureFlagsPage />);

    expect(await screen.findByRole("button", { name: /Targets/ })).toBeTruthy();
    expect(api.listWorkspaceRows).toHaveBeenCalled();
  });

  it("gets everything as a creator, with no key on the account", async () => {
    viewer([], "creator");
    show(<BlocklistPage />);

    expect(await screen.findByRole("button", { name: /Block identifier/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Unblock/ })).toBeTruthy();
  });
});

describe("the overview", () => {
  it("opens for an account holding only that key, asking for nothing else", async () => {
    api.loadOverview.mockImplementation(async (can) => {
      expect(can(P.WORKSPACES_VIEW)).toBe(false);
      return {
        source: "endpoint",
        endpointError: null,
        kpis: {
          activeWorkspaces: { value: 3 },
          trialing: { value: 1 },
          pastDue: { value: 0 },
          mrr: { value: 0, currency: "EGP" },
          gmv30d: { value: 0, currency: "EGP" },
          ordersToday: { value: 0 },
          deliveryRate: { value: 0 },
        },
        signupsPerDay: { points: [] },
        mrrTrend: { points: [] },
        ordersPerDay: { points: [] },
        attention: [],
        recentSignups: [],
        generatedAt: "2026-11-01T00:00:00Z",
      } as never;
    });
    viewer([P.OVERVIEW_VIEW]);
    show(<OverviewPage />);

    expect(await screen.findByText("Active workspaces")).toBeTruthy();
    expect(screen.queryByText("Recent signups")).toBeNull();
    expect(screen.queryByRole("link", { name: /Active workspaces/ })).toBeNull();
  });
});

describe("a store's page", () => {
  const row = {
    workspace: { id: "w1", name: "Nile Store", slug: "nile", status: "active", defaultCurrency: "EGP", createdAt: "2026-01-01T00:00:00Z", orderCount: 3 },
    subscription: null,
  };

  it("has no subscription tab for an account that can read nothing on it", async () => {
    api.getWorkspaceRow.mockResolvedValue(row as never);
    viewer([P.WORKSPACES_VIEW]);
    show(<WorkspaceDetailPage />, "/page/w1?tab=subscription");

    expect((await screen.findAllByText("Nile Store")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("tab", { name: "Subscription" })).toBeNull();
    expect(screen.queryByText("This workspace has never had a subscription.")).toBeNull();
  });
});

describe("the notifications", () => {
  it("has the bell in the frame for an account with no keys, and asks the API for the count", async () => {
    viewer([]);
    render(
      <LocaleProvider>
        <MemoryRouter>
          <AdminLayout />
        </MemoryRouter>
      </LocaleProvider>
    );

    expect((await screen.findAllByRole("button", { name: "Notifications" })).length).toBeGreaterThan(0);
    await waitFor(() => expect(notifications.unreadCount).toHaveBeenCalled());
    expect(screen.getAllByRole("link", { name: "Notifications" }).length).toBeGreaterThan(0);
  });

  it("offers in the page's filter only the types the API says this account can see", async () => {
    notifications.getPrefs.mockResolvedValue({
      prefs: [
        { type: "support_ticket", enabled: true, email: false },
        { type: "suggestion", enabled: true, email: false },
      ],
      emailDelivery: false,
    } as never);
    viewer([P.SUPPORT_VIEW]);
    show(<NotificationsPage />);

    const filter = await screen.findByRole("combobox", { name: "All types" });
    await waitFor(() => expect(within(filter).getAllByRole("option")).toHaveLength(3));
    expect(notifications.listNotifications).toHaveBeenCalled();
  });
});

describe("CanLink", () => {
  it("is a link for an account that can open the page, and plain words otherwise", () => {
    viewer([P.WORKSPACES_VIEW]);
    render(
      <MemoryRouter>
        <CanLink permission={P.WORKSPACES_VIEW} to="/workspaces/w1" className="font-medium hover:text-primary">
          Open store
        </CanLink>
        <CanLink permission={P.AGENTS_VIEW} to="/agents/a1" className="font-medium hover:text-primary">
          Agent name
        </CanLink>
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Open store" }).getAttribute("href")).toBe("/workspaces/w1");
    expect(screen.queryByRole("link", { name: "Agent name" })).toBeNull();
    const text = screen.getByText("Agent name");
    expect(text.className).toBe("font-medium");
  });
});

describe("admin users and roles", () => {
  const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

  it("offers no action on a row the viewer can't act on, rather than a greyed one", async () => {
    viewer([P.ADMINS_VIEW, P.ADMINS_MANAGE], "admin");
    show(<AdminUsersPage />);

    await screen.findByText("Boss");
    expect(within(rowOf("Boss")).queryByRole("button")).toBeNull();
    expect(within(rowOf("Me")).queryByRole("button")).toBeNull();
    expect(within(rowOf("Other")).getByRole("button", { name: /Edit/ })).toBeTruthy();
    expect(within(rowOf("Other")).getByRole("button", { name: /Revoke/ })).toBeTruthy();
  });

  it("shows a viewer the users and roles with nothing to press", async () => {
    viewer([P.ADMINS_VIEW], "admin");
    show(<AdminUsersPage />);

    await screen.findByText("Boss");
    expect(screen.getByText("Answers merchants")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New role/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Grant access/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  });

  it("creates a role from what the viewer holds, ticking the key that opens the page", async () => {
    api.createRole.mockResolvedValue({ ...ROLES.roles[2], key: "new_key", name: "Desk" } as never);
    viewer([P.ADMINS_VIEW, P.ADMINS_MANAGE, P.SUPPORT_VIEW, P.SUPPORT_MANAGE], "admin");
    show(<AdminUsersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /New role/ }));
    const dialog = await screen.findByRole("dialog");
    // Not a key this person holds: not on offer, so the API has nothing to refuse.
    expect(within(dialog).queryByLabelText(/Subscription charges/)).toBeNull();

    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Desk" } });
    fireEvent.click(within(dialog).getByLabelText(/reply and update/));
    expect((within(dialog).getByLabelText(/Support tickets — view/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));

    await waitFor(() => expect(api.createRole).toHaveBeenCalled());
    const payload = api.createRole.mock.calls[0][0];
    expect(payload.name).toBe("Desk");
    expect([...payload.permissions].sort()).toEqual([P.SUPPORT_MANAGE, P.SUPPORT_VIEW].sort());
  });

  it("offers edit on a custom role, not a seeded one or the viewer's own, and delete only with no holders", async () => {
    viewer([P.ADMINS_VIEW, P.ADMINS_MANAGE, P.SUPPORT_VIEW, P.PAYMENTS_RECORD], "support_desk_a1b2c3");
    show(<AdminUsersPage />);

    await screen.findByRole("button", { name: /New role/ });
    // The roles table comes after the users', whose badges carry the same names.
    const roleRow = (name: string) => (screen.getAllByText(name).at(-1) as HTMLElement).closest("tr") as HTMLElement;
    expect(within(roleRow("Creator")).queryByRole("button")).toBeNull();
    expect(within(roleRow("Admin")).queryByRole("button")).toBeNull();
    expect(within(roleRow("Support desk")).queryByRole("button")).toBeNull();
    expect(within(roleRow("Billing")).getByRole("button", { name: /Edit/ })).toBeTruthy();
    expect(within(roleRow("Billing")).getByRole("button", { name: "Delete Billing" })).toBeTruthy();
  });

  it("offers nothing on a custom role holding a key the viewer doesn't hold", async () => {
    viewer([P.ADMINS_VIEW, P.ADMINS_MANAGE, P.SUPPORT_VIEW], "admin");
    show(<AdminUsersPage />);

    await screen.findByRole("button", { name: /New role/ });
    const billing = screen.getAllByText("Billing").at(-1)?.closest("tr") as HTMLElement;
    expect(within(billing).queryByRole("button")).toBeNull();
  });

  const grantFormOptions = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /Grant access/ }));
    const dialog = await screen.findByRole("dialog");
    const select = within(dialog).getByLabelText("Role", { exact: true }) as HTMLSelectElement;
    return { select, options: within(select).getAllByRole("option").map((o) => o.textContent) };
  };

  it("offers on the grant form only the roles the viewer holds all of, and the agent role", async () => {
    viewer([P.ADMINS_VIEW, P.ADMINS_MANAGE, P.SUPPORT_VIEW], "admin");
    show(<AdminUsersPage />);

    const { select, options } = await grantFormOptions();
    expect(options).toEqual(["Agent", "Support desk"]);
    // The form starts on a role it offers, or it would submit one it doesn't.
    expect(select.value).toBe("agent");
  });

  it("starts the grant form on the admin role for a viewer holding all of it", async () => {
    viewer([P.ADMINS_VIEW, P.ADMINS_MANAGE, P.PLANS_VIEW], "admin");
    show(<AdminUsersPage />);

    const { select, options } = await grantFormOptions();
    expect(options).toEqual(["Admin", "Agent"]);
    expect(select.value).toBe("admin");
  });

  it("offers a creator every role", async () => {
    viewer([], "creator");
    show(<AdminUsersPage />);

    const { select, options } = await grantFormOptions();
    expect(options).toEqual(["Creator", "Admin", "Agent", "Support desk", "Billing"]);
    expect(select.value).toBe("admin");
  });
});
