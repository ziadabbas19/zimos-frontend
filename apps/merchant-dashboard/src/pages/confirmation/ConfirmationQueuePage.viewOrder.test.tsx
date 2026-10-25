import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { ConfirmationQueueCounts, ConfirmationTask, Workspace } from "@store-builder/api-client";
import { api, authMock, fake, testUser, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { ConfirmationQueuePage } from "./ConfirmationQueuePage";
import { DoneCard } from "./cards/DoneCard";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  CONFIRMATION_STATION_ENABLED: true,
}));

/** «View order» on every card of the list and on the station card: the order's page, in the same tab. */

const counts: ConfirmationQueueCounts = {
  pending: 2,
  pendingDue: 1,
  inProgress: 0,
  inProgressMine: 0,
  done: 0,
  assignedToMe: 0,
  unassigned: 2,
};

function task(id: string, number: string, overrides: Partial<ConfirmationTask> = {}): ConfirmationTask {
  return fake<ConfirmationTask>({
    id,
    orderId: `o_${id}`,
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
      id: `o_${id}`,
      customerId: "c1",
      orderNumber: number,
      totalAmount: "25000",
      currency: "EGP",
      paymentMethod: "cod",
      riskFlags: [],
      items: [{ id: `i_${id}`, productNameSnapshot: "Mug", quantity: 2, variantOptionsSnapshot: null }],
      contactSnapshot: { fullName: "Mona Ali", phone: "01012345678" },
      shippingAddressSnapshot: { province: "Cairo", city: "Nasr City", addressLine: "1 Nile St" },
      confirmationState: "pending",
      createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    },
    ...overrides,
  });
}

const due = () => task("task_1", "ORD-1001");
/** A funnel order still in its offer window: listed, nothing to act on yet. */
const waiting = () => task("task_2", "ORD-1002", { availableAt: new Date(Date.now() + 10 * 60_000).toISOString() });
const claimed = () =>
  task("task_1", "ORD-1001", {
    status: "in_progress",
    lockedByUserId: testUser.id,
    lockedBy: { id: testUser.id, fullName: testUser.fullName },
    lockedAt: new Date().toISOString(),
    lockExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });

function open(view: "list" | "station") {
  authMock.user = testUser;
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner", settings: {} });
  window.localStorage.setItem("zimos.confirmation.view", view);
  api.getConfirmationQueueCounts.mockResolvedValue(counts);
  api.listConfirmationAssignees.mockResolvedValue([]);
  api.listConfirmationQueue.mockResolvedValue({ tasks: view === "list" ? [due(), waiting()] : [due()], nextCursor: null });
  api.claimConfirmationTask.mockResolvedValue(claimed());
  return renderWithProviders(<ConfirmationQueuePage />, { route: "/confirmation", path: "/confirmation" });
}

const viewOrder = (number: string) => screen.getByRole("link", { name: `View order ${number}` });

describe("ConfirmationQueuePage «View order»", () => {
  it("puts the button on every card of the list, the waiting one too", async () => {
    open("list");

    await screen.findByRole("checkbox", { name: "Select ORD-1001" });
    for (const [number, id] of [
      ["ORD-1001", "o_task_1"],
      ["ORD-1002", "o_task_2"],
    ]) {
      const link = viewOrder(number);
      expect(link).toHaveAttribute("href", `/orders/${id}`);
      // The same tab: no target, no window.
      expect(link).not.toHaveAttribute("target");
      expect(link).toHaveTextContent("View order");
    }
  });

  it("leaves the tick box and «Claim» alone, and is not opened by them", async () => {
    const { user } = open("list");

    const box = await screen.findByRole("checkbox", { name: "Select ORD-1001" });
    await user.click(box);
    expect(box).toBeChecked();
    expect(currentPath()).toBe("/confirmation");

    await user.click(screen.getByRole("button", { name: "Claim" }));
    await waitFor(() => expect(api.claimConfirmationTask).toHaveBeenCalledWith("ws_1", "task_1"));
    expect(currentPath()).toBe("/confirmation");
    // Holding the claim, the card still has it, beside «Save & next» and «Release».
    expect(await screen.findByRole("button", { name: "Save & next" })).toBeInTheDocument();
    expect(viewOrder("ORD-1001")).toBeInTheDocument();
  });

  it("opens the order's page in the same tab without claiming or ticking it", async () => {
    const open_ = vi.spyOn(window, "open");
    const { user } = open("list");

    await screen.findByRole("checkbox", { name: "Select ORD-1001" });
    await user.click(viewOrder("ORD-1001"));

    expect(currentPath()).toBe("/orders/o_task_1");
    expect(api.claimConfirmationTask).not.toHaveBeenCalled();
    expect(open_).not.toHaveBeenCalled();
    open_.mockRestore();
  });

  it("is on the station card, One by one, and opens the order without claiming it", async () => {
    const { user } = open("station");

    const card = await screen.findByRole("article", { name: "Order ORD-1001 from Mona Ali" });
    const link = within(card).getByRole("link", { name: "View order ORD-1001" });
    expect(link).toHaveAttribute("href", "/orders/o_task_1");

    // Another button of the card does its own thing only.
    await user.click(within(card).getByRole("button", { name: "Note" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(currentPath()).toBe("/confirmation");
    await user.keyboard("{Escape}");

    await user.click(link);
    expect(currentPath()).toBe("/orders/o_task_1");
    expect(api.claimConfirmationTask).not.toHaveBeenCalled();
  });

  it("speaks Arabic: «عرض الطلب»", async () => {
    authMock.user = testUser;
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner", settings: {} });
    window.localStorage.setItem("zimos.confirmation.view", "list");
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationAssignees.mockResolvedValue([]);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [due()], nextCursor: null });
    renderWithProviders(<ConfirmationQueuePage />, { locale: "ar" });

    expect(await screen.findByRole("link", { name: "عرض الطلب ORD-1001" })).toHaveAttribute("href", "/orders/o_task_1");
  });
});

describe("DoneCard «View order»", () => {
  it("is beside «Correct outcome» on a finished order", () => {
    authMock.user = testUser;
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner", settings: {} });
    const done = task("task_3", "ORD-1003", { status: "done", outcome: "confirmed", correctable: true, completedAt: new Date().toISOString() });
    renderWithProviders(<DoneCard task={done} now={Date.now()} onChanged={() => undefined} />);

    expect(viewOrder("ORD-1003")).toHaveAttribute("href", "/orders/o_task_3");
    expect(screen.getByRole("button", { name: "Correct outcome" })).toBeInTheDocument();
  });
});
