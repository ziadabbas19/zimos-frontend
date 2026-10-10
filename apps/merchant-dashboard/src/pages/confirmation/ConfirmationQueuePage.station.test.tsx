import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { ConfirmationQueueCounts, ConfirmationTask, Workspace } from "@store-builder/api-client";
import { api, authMock, fake, testUser, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ConfirmationQueuePage } from "./ConfirmationQueuePage";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  CONFIRMATION_STATION_ENABLED: true,
}));

/** With its switch on, a role that takes calls works the waiting tab one order at a time. */

const counts: ConfirmationQueueCounts = {
  pending: 1,
  pendingDue: 1,
  inProgress: 0,
  inProgressMine: 0,
  done: 0,
  assignedToMe: 0,
  unassigned: 1,
};

function task(overrides: Partial<ConfirmationTask> = {}): ConfirmationTask {
  return fake<ConfirmationTask>({
    id: "task_1",
    orderId: "o1",
    status: "queued",
    lockedByUserId: null,
    lockedAt: null,
    lockedBy: null,
    lockExpiresAt: null,
    assignedToUserId: null,
    assignedTo: null,
    assignedAt: null,
    attemptCount: 0,
    nextRetryAt: null,
    attempts: [],
    correctable: false,
    order: {
      id: "o1",
      customerId: "c1",
      orderNumber: "ORD-1001",
      totalAmount: "25000",
      currency: "EGP",
      paymentMethod: "cod",
      riskFlags: [],
      items: [{ id: "i1", productNameSnapshot: "Mug", quantity: 2, variantOptionsSnapshot: null }],
      contactSnapshot: { fullName: "Mona Ali", phone: "01012345678" },
      shippingAddressSnapshot: { province: "Cairo", city: "Nasr City", addressLine: "1 Nile St" },
      confirmationState: "pending",
      createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      completedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    },
    ...overrides,
  });
}

const claimed = () =>
  task({
    status: "in_progress",
    lockedByUserId: testUser.id,
    lockedBy: { id: testUser.id, fullName: testUser.fullName },
    lockedAt: new Date().toISOString(),
    lockExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });

function open() {
  authMock.user = testUser;
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner", settings: {} });
  window.localStorage.removeItem("zimos.confirmation.view");
  api.getConfirmationQueueCounts.mockResolvedValue(counts);
  api.listConfirmationAssignees.mockResolvedValue([]);
  api.listConfirmationQueue.mockResolvedValue({ tasks: [task()], nextCursor: null });
  api.claimConfirmationTask.mockResolvedValue(claimed());
  return renderWithProviders(<ConfirmationQueuePage />);
}

describe("ConfirmationQueuePage calling station", () => {
  it("shows one order with the result of the call as one press: the claim, then the result", async () => {
    api.recordConfirmationOutcome.mockResolvedValue(task({ status: "done", outcome: "confirmed" }));
    const { user } = open();

    const card = await screen.findByRole("article", { name: "Order ORD-1001 from Mona Ali" });
    expect(within(card).getByText("010 1234 5678")).toBeInTheDocument();
    expect(screen.getByText("One by one")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Confirmed" }));
    await waitFor(() =>
      expect(api.recordConfirmationOutcome).toHaveBeenCalledWith("ws_1", "task_1", { outcome: "confirmed", channel: "call" })
    );
    expect(api.claimConfirmationTask).toHaveBeenCalledWith("ws_1", "task_1");
    expect(api.claimConfirmationTask.mock.invocationCallOrder[0]).toBeLessThan(
      api.recordConfirmationOutcome.mock.invocationCallOrder[0]
    );
  });

  it("'Call later' offers no date or time and sends none", async () => {
    api.recordConfirmationOutcome.mockResolvedValue(task({ nextRetryAt: new Date(Date.now() + 24 * 3600_000).toISOString() }));
    const { user } = open();

    const card = await screen.findByRole("article", { name: "Order ORD-1001 from Mona Ali" });
    await user.click(within(card).getByRole("button", { name: "Call later" }));
    const sheet = await screen.findByRole("dialog", { name: "Call later" });
    expect(within(sheet).getByText("The order comes back to the queue in 24 hours.")).toBeInTheDocument();
    expect(document.querySelector('input[type="datetime-local"], input[type="date"], input[type="time"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save & next" }));
    // Exactly these keys: no callback time travels with the result.
    await waitFor(() =>
      expect(api.recordConfirmationOutcome).toHaveBeenCalledWith("ws_1", "task_1", { outcome: "postponed", channel: "call" })
    );
  });

  it("switches back to the list, where the orders can be ticked", async () => {
    const { user } = open();

    await screen.findByRole("article", { name: "Order ORD-1001 from Mona Ali" });
    await user.click(screen.getByText("List"));
    expect(await screen.findByRole("checkbox", { name: "Select ORD-1001" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Order ORD-1001 from Mona Ali" })).not.toBeInTheDocument();
  });
});
