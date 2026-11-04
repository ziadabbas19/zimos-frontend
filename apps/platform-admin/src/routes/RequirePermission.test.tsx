import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { ANY_CONSOLE_ACCOUNT, P, hasPermission, type PermissionCheck } from "@/lib/permissions";
import { RequirePermission } from "./RequirePermission";

/** An address the account can't open leads to the first page it can. */

const h = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    can: (permission: PermissionCheck) =>
      hasPermission({ platformRole: "admin", platformPermissions: h.permissions } as never, permission),
  }),
}));

function Where() {
  return <p>at {useLocation().pathname}</p>;
}

function renderAt(path: string) {
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<RequirePermission permission={P.OVERVIEW_VIEW}>overview page</RequirePermission>} />
          <Route path="/plans" element={<RequirePermission permission={P.PLANS_VIEW}>plans page</RequirePermission>} />
          <Route path="/notifications" element={<RequirePermission permission={ANY_CONSOLE_ACCOUNT}>notifications page</RequirePermission>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  );
}

beforeEach(() => {
  h.permissions = [];
});
afterEach(cleanup);

describe("RequirePermission", () => {
  it("shows the page to an account holding the key", () => {
    h.permissions = [P.PLANS_VIEW];
    renderAt("/plans");
    expect(screen.getByText("plans page")).toBeTruthy();
  });

  it("sends anyone else to their first allowed page, with no message and nothing of the page", () => {
    h.permissions = [P.SUPPORT_VIEW];
    renderAt("/plans");
    expect(screen.getByText("at /tickets")).toBeTruthy();
    expect(screen.queryByText("plans page")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends a sign-in that lands on the overview there too, when the overview isn't theirs", () => {
    h.permissions = [P.TEMPLATES_VIEW];
    renderAt("/");
    expect(screen.getByText("at /templates")).toBeTruthy();
  });

  it("opens the notifications to an account with no keys", () => {
    renderAt("/notifications");
    expect(screen.getByText("notifications page")).toBeTruthy();
  });

  it("says so, without a redirect, when the account can open nothing else", () => {
    renderAt("/plans");
    expect(screen.queryByText("plans page")).toBeNull();
    expect(screen.getByText(/doesn't include any section/)).toBeTruthy();
  });
});
