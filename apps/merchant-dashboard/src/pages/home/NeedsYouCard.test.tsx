import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SYSTEM_ROLE_PERMISSIONS } from "@/test/systemRoles";
import { NeedsYouCard } from "./NeedsYouCard";

function store(role: string) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role, permissions: SYSTEM_ROLE_PERMISSIONS[role] });
}

function waiting(counts: { toConfirm: number; toShip: number; unread: number }) {
  api.getConfirmationQueueCounts.mockResolvedValue(fake({ pendingDue: counts.toConfirm }));
  api.getOrderPipeline.mockResolvedValue(fake({ stages: { ready_to_ship: counts.toShip } }));
  api.request.mockImplementation(((path: string) =>
    String(path).includes("/inbox/")
      ? Promise.resolve({ conversations: [], nextCursor: null, counts: { unread: counts.unread } })
      : new Promise<never>(() => undefined)) as never);
}

describe("NeedsYouCard", () => {
  it("shows each queue's count large, in words beside it, with the way to it", async () => {
    store("owner");
    waiting({ toConfirm: 4, toShip: 12, unread: 0 });
    renderWithProviders(<NeedsYouCard />, { route: "/" });
    const card = await screen.findByRole("region", { name: "Needs you now" });
    const calls = await within(card).findByRole("link", { name: /Waiting for a call/ });
    expect(calls).toHaveAttribute("href", "/confirmation-queue");
    expect(calls).toHaveTextContent("4");
    expect(within(card).getByRole("link", { name: /Ready to ship/ })).toHaveAttribute("href", "/orders?stage=ready_to_ship");
  });

  it("says nothing is waiting in one line when every queue is empty", async () => {
    store("owner");
    waiting({ toConfirm: 0, toShip: 0, unread: 0 });
    renderWithProviders(<NeedsYouCard />, { route: "/" });
    expect(await screen.findByText("Nothing is waiting for you. Well done.")).toBeInTheDocument();
  });
});
