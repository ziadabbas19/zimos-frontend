import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUserDetail } from "@store-builder/api-client";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import { UserDetailPage } from "./UserDetailPage";
import { WorkspacesPage } from "./WorkspacesPage";

/**
 * A person's page and the store list with the API mocked: the location the
 * marketing site kept, the phone's verification, and every store's link (new
 * tab, never a row click) and owner. Fields an older API does not send leave
 * their rows out.
 */

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ can: () => false, user: { id: "me" } }),
}));

vi.mock("@/lib/adminApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminApi")>();
  return { ...actual, getUser: vi.fn(), listWorkspaceRows: vi.fn() };
});

const mocked = vi.mocked(adminApi);

const USER: AdminUserDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "mona",
  fullName: "Mona Owner",
  email: "mona@example.com",
  status: "active",
  platformRole: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  lastLoginAt: null,
  emailVerified: true,
  phone: "+201000000001",
  phoneVerified: true,
  usernameChangedAt: null,
  acquisition: null,
  location: { country: "EG", governorate: "giza", source: "signup_visit", seenAt: "2026-09-01T09:55:00.000Z" },
  workspaces: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Mona Store",
      slug: "mona-store",
      status: "active",
      role: "owner",
      matched: false,
      createdAt: "2026-09-02T10:00:00.000Z",
      storeUrl: "https://shop.mona-example.com",
      subscription: { status: "active", phase: "active", plan: "Growth", planId: "p1", currentPeriodEnd: "2026-11-02T10:00:00.000Z" },
    },
  ],
};

function row(overrides: Partial<AdminWorkspaceRow["workspace"]> = {}): AdminWorkspaceRow {
  return {
    workspace: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Sara Store",
      slug: "sara-store",
      status: "active",
      defaultCurrency: "EGP",
      createdAt: "2026-09-03T10:00:00.000Z",
      plan: "—",
      planId: null,
      billingCycle: null,
      subscriptionStatus: "none",
      trialEndsAt: null,
      currentPeriodEnd: null,
      orderCount: 4,
      owner: { id: "44444444-4444-4444-8444-444444444444", username: "sara", fullName: "Sara Founder", email: "sara@example.com" },
      storeUrl: "https://sara-store.zimos.co",
      ...overrides,
    },
    subscription: null,
  };
}

function renderAt(path: string) {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/users/:id" element={<UserDetailPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/workspaces/:id" element={<p>store detail page</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mocked.getUser.mockReset();
  mocked.listWorkspaceRows.mockReset();
});
afterEach(cleanup);

describe("the user page", () => {
  it("shows the sign-up location, the phone's verification and each store's created date and link", async () => {
    mocked.getUser.mockResolvedValue(USER);
    renderAt(`/users/${USER.id}`);

    const location = (await screen.findByText("Location")).parentElement as HTMLElement;
    expect(location.textContent).toContain("Giza, Egypt");
    expect(location.textContent).toContain("approximate, at sign-up");

    const phone = screen.getByText("Phone").parentElement as HTMLElement;
    expect(within(phone).getByText("+201000000001")).toBeTruthy();
    expect(within(phone).getByText("Verified")).toBeTruthy();

    const link = screen.getByRole("link", { name: "Open Mona Store in a new tab" });
    expect(link.getAttribute("href")).toBe("https://shop.mona-example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toBe("shop.mona-example.com");
    expect(screen.getByRole("columnheader", { name: "Created" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mona Store" }).getAttribute("href")).toBe(`/workspaces/${USER.workspaces[0].id}`);
  });

  it("says so when no location was kept, and an unverified phone", async () => {
    mocked.getUser.mockResolvedValue({ ...USER, location: null, phoneVerified: false });
    renderAt(`/users/${USER.id}`);
    const location = (await screen.findByText("Location")).parentElement as HTMLElement;
    expect(location.textContent).toContain("Not recorded");
    expect(within(screen.getByText("Phone").parentElement as HTMLElement).getByText("Not verified")).toBeTruthy();
  });

  it("leaves out what an older API does not send, and any link that is not http(s)", async () => {
    const { location: _location, phoneVerified: _verified, ...older } = USER;
    mocked.getUser.mockResolvedValue({
      ...older,
      workspaces: [{ ...USER.workspaces[0], storeUrl: "javascript:alert(1)", createdAt: undefined }],
    });
    renderAt(`/users/${USER.id}`);
    const phone = (await screen.findByText("Phone")).parentElement as HTMLElement;
    expect(screen.queryByText("Location")).toBeNull();
    expect(within(phone).queryByText(/verified/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /in a new tab/ })).toBeNull();
  });
});

describe("the store list", () => {
  it("gives each store its link and its owner, who links to their page", async () => {
    mocked.listWorkspaceRows.mockResolvedValue([row()]);
    renderAt("/workspaces");

    const link = await screen.findByRole("link", { name: "Open Sara Store in a new tab" });
    expect(link.getAttribute("href")).toBe("https://sara-store.zimos.co");
    expect(link.getAttribute("target")).toBe("_blank");
    const owner = screen.getByRole("link", { name: "Sara Founder" });
    expect(owner.getAttribute("href")).toBe("/users/44444444-4444-4444-8444-444444444444");
    expect(screen.getByText("sara@example.com")).toBeTruthy();

    // The row opens the store's page; its link opens the store and nothing else.
    fireEvent.click(link);
    expect(screen.queryByText("store detail page")).toBeNull();
  });

  it("names the link in Arabic, and shows no link when the API sent none", async () => {
    localStorage.setItem("zimos.console.locale", "ar");
    mocked.listWorkspaceRows.mockResolvedValue([row(), row({ id: "55555555-5555-4555-8555-555555555555", name: "Old Store", storeUrl: undefined })]);
    renderAt("/workspaces");
    expect(await screen.findByRole("link", { name: "فتح Sara Store في تبويب جديد" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Old Store في تبويب جديد/ })).toBeNull();
  });
});
