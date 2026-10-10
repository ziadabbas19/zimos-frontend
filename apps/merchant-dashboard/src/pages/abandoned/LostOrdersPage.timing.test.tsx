import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LostOrdersPage } from "./LostOrdersPage";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  LOST_ORDER_TIMING_ENABLED: true,
}));

/** With its switch on, the Tools menu offers "When a checkout counts as lost". */

const stats = {
  from: "2026-10-01",
  to: "2026-10-31",
  lost: 0,
  byReason: {},
  visits: 0,
  lostRate: null,
  recovered: 0,
  recoveredAmount: "0",
  currency: "EGP",
  abandonedAfterMinutes: 15,
};

function serve(extra: Record<string, unknown> = {}) {
  api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
  api.getWhatsappIntegration.mockResolvedValue(fake({ connected: false }));
  return fakeBackend({
    "GET /checkout-sessions": { sessions: [], nextCursor: null, abandonedAfterMinutes: 15 },
    "GET /checkout-sessions/stats": stats,
    ...extra,
  });
}

describe("the abandon-after tool", () => {
  it("saves the minutes on the store's settings, and nothing else", async () => {
    Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, role: "owner", slug: "nile", settings: {} } });
    const calls = serve({
      "PATCH /workspaces/ws_1": { workspace: { settings: { fraud_rules: { abandoned_after_minutes: 30 } } } },
    });
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });
    await screen.findByRole("heading", { name: "Lost orders" });
    await waitFor(() => expect(callsTo(calls, "GET", "/checkout-sessions/stats")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /Tools/ }));
    await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: /When a checkout counts as lost/ }));

    const sheet = await screen.findByRole("dialog", { name: "When does a checkout count as lost?" });
    const field = within(sheet).getByLabelText(/Minutes without activity/);
    await user.clear(field);
    await user.type(field, "30");
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PATCH", "/workspaces/ws_1")).toHaveLength(1));
    expect(callsTo(calls, "PATCH", "/workspaces/ws_1")[0].body).toEqual({ settings: { fraud_rules: { abandoned_after_minutes: 30 } } });
  });

  it("only shows the value to a role that may not change it", async () => {
    Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, role: "order_operator", slug: "nile", settings: {} } });
    const calls = serve();
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });
    await screen.findByRole("heading", { name: "Lost orders" });
    await waitFor(() => expect(callsTo(calls, "GET", "/checkout-sessions/stats")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /Tools/ }));
    await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: /When a checkout counts as lost/ }));

    const sheet = await screen.findByRole("dialog", { name: "When does a checkout count as lost?" });
    expect(within(sheet).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(sheet).queryByLabelText(/Minutes without activity/)).not.toBeInTheDocument();
  });
});
