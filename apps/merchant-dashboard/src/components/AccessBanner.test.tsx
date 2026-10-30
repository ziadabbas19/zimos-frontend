import { describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import type { Workspace, WorkspaceAccess } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AccessBanner } from "./AccessBanner";

const access = (billing: Partial<WorkspaceAccess["billing"]>) =>
  fake<WorkspaceAccess>({
    restricted: false,
    reasons: [],
    billing: { phase: "ok", status: "trialing", trialing: true, periodEnd: "2030-01-01", restrictsAt: null, enforced: false, ...billing },
    suspension: { suspended: false, since: null },
    wallet: null,
  });

describe("AccessBanner and paying", () => {
  it("sends an ending trial to the invoices, where the Pay button is", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_trial", name: "Nile Store", role: "owner" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "expiring" }));
    renderWithProviders(<AccessBanner />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Your free trial ends on");
    expect(within(banner).getByRole("link", { name: "My Plan" })).toHaveAttribute("href", "/subscription?tab=invoices");
  });

  it("sends a lapsed subscription to the invoices too, in Arabic", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_lapsed", name: "Nile Store", role: "accountant" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "restricted", status: "past_due", trialing: false, enforced: true }));
    renderWithProviders(<AccessBanner />, { locale: "ar" });
    const banner = await screen.findByRole("alert");
    expect(within(banner).getByRole("link", { name: "خطتي" })).toHaveAttribute("href", "/subscription?tab=invoices");
  });

  it("shows no link to whoever can't manage billing", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_staff", name: "Nile Store", role: "order_operator" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "expiring" }));
    renderWithProviders(<AccessBanner />);
    const banner = await screen.findByRole("status");
    expect(within(banner).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("AccessBanner coming back to the tab", () => {
  it("reads the store's access again once the merchant returns, not on a mere focus at load", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_back", name: "Nile Store", role: "owner" });
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "expiring" }));
    renderWithProviders(<AccessBanner />);
    await screen.findByRole("status");
    expect(api.getWorkspaceAccess).toHaveBeenCalledTimes(1);

    // A focus with no time away first asks nothing.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(api.getWorkspaceAccess).toHaveBeenCalledTimes(1);

    // Away (another window), then back: one new read.
    api.getWorkspaceAccess.mockResolvedValue(access({ phase: "ok" }));
    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(api.getWorkspaceAccess).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
