import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import {
  ApiError,
  type ConfirmationAssignee,
  type ConfirmationQueueCounts,
  type ConfirmationTask,
  type Workspace,
} from "@store-builder/api-client";
import { api, authMock, fake, testUser, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ConfirmationQueuePage } from "./ConfirmationQueuePage";

const counts: ConfirmationQueueCounts = {
  pending: 1,
  pendingDue: 1,
  inProgress: 0,
  inProgressMine: 0,
  done: 0,
  assignedToMe: 0,
  unassigned: 0,
};

function task(overrides: Partial<ConfirmationTask> = {}): ConfirmationTask {
  const id = overrides.id ?? "task_1";
  const number = id === "task_1" ? "ORD-1001" : `ORD-${id}`;
  return fake<ConfirmationTask>({
    id,
    orderId: `o_${id}`,
    status: "queued",
    lockedByUserId: null,
    lockedAt: null,
    lockedBy: null,
    lockExpiresAt: null,
    assignedToUserId: "agent_2",
    assignedTo: { id: "agent_2", fullName: "Bassem" },
    assignedAt: "2026-09-30T10:00:00Z",
    attemptCount: 0,
    nextRetryAt: null,
    attempts: [],
    correctable: false,
    order: {
      id: `o_${id}`,
      orderNumber: number,
      totalAmount: "25000",
      currency: "EGP",
      riskFlags: [],
      items: [{ id: `i_${id}`, productNameSnapshot: "Mug", quantity: 2, variantOptionsSnapshot: null }],
      contactSnapshot: { fullName: "Mona Ali", phone: "010 1234 5678" },
      shippingAddressSnapshot: { city: "Cairo", addressLine: "1 Nile St" },
      confirmationState: "pending",
      createdAt: "2026-09-30T09:00:00Z",
    },
    ...overrides,
  });
}

/** An order nobody was handed. */
const free = (id: string, overrides: Partial<ConfirmationTask> = {}) =>
  task({ id, assignedTo: null, assignedToUserId: null, assignedAt: null, ...overrides });

const agent = (id: string, fullName: string): ConfirmationAssignee => ({
  id,
  fullName,
  email: `${id}@x.test`,
  role: { key: "confirmation_agent", name: "Confirmation Agent" },
});
const me: ConfirmationAssignee = { id: testUser.id, fullName: testUser.fullName, email: testUser.email, role: { key: "owner", name: "Owner" } };

function asRole(role: string) {
  authMock.user = testUser;
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role, settings: {} });
}

function queueOf(tasks: ConfirmationTask[], team: ConfirmationAssignee[] = [me]) {
  api.getConfirmationQueueCounts.mockResolvedValue({ ...counts, pending: tasks.length, pendingDue: tasks.length });
  api.listConfirmationAssignees.mockResolvedValue(team);
  api.listConfirmationQueue.mockResolvedValue({ tasks, nextCursor: null });
}

const NOTE = "Recorded for several orders at once from the confirmation queue.";
const bar = () => screen.getByRole("toolbar", { name: "Actions for what you selected" });

describe("ConfirmationQueuePage assignment", () => {
  it("shows who a task is assigned to, and keeps an agent off another agent's task", async () => {
    asRole("confirmation_agent");
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [task()], nextCursor: null });
    renderWithProviders(<ConfirmationQueuePage />);

    expect(await screen.findByText("Assigned to Bassem")).toBeInTheDocument();
    expect(screen.getByText("Assigned to Bassem. Only they or a manager can take it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Claim/ })).not.toBeInTheDocument();
    // An agent never assigns, and has nothing to tick.
    expect(api.listConfirmationAssignees).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("asks the server for the assignment chosen in the filters", async () => {
    asRole("confirmation_agent");
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [], nextCursor: null });
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    await waitFor(() => expect(api.listConfirmationQueue).toHaveBeenCalled());
    expect(api.listConfirmationQueue.mock.calls[0][1]).not.toHaveProperty("assignedTo");
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.click(await screen.findByRole("button", { name: "Assigned to me" }));
    await waitFor(() =>
      expect(api.listConfirmationQueue).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ assignedTo: "me" }))
    );
  });

  it("lets a manager with a team hand over one order, and a selection of them", async () => {
    asRole("order_operator");
    queueOf([free("task_1")], [agent("agent_1", "Amal"), agent("agent_2", "Bassem")]);
    api.assignConfirmationTask.mockResolvedValue(task({ assignedTo: { id: "agent_1", fullName: "Amal" } }));
    api.assignConfirmationTasks.mockResolvedValue({
      assignedTo: { id: "agent_2", fullName: "Bassem" },
      tasks: [task()],
      skipped: [],
    });
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    await user.click(await screen.findByRole("button", { name: "Assign" }));
    const single = screen.getByLabelText("Assign ORD-1001 to");
    await user.selectOptions(single, "agent_1");
    await waitFor(() => expect(api.assignConfirmationTask).toHaveBeenCalledWith("ws_1", "task_1", "agent_1"));

    await user.click(screen.getByRole("checkbox", { name: "Select ORD-1001" }));
    // A role that manages orders but takes no calls gets the assignment actions only.
    expect(within(bar()).queryByRole("button", { name: "Accept all selected" })).not.toBeInTheDocument();
    await user.click(within(bar()).getByRole("button", { name: "Assign to…" }));
    await user.click(await screen.findByRole("button", { name: /Bassem/ }));
    await waitFor(() => expect(api.assignConfirmationTasks).toHaveBeenCalledWith("ws_1", ["task_1"], "agent_2"));
    expect(await screen.findByText("1 order assigned to Bassem.")).toBeInTheDocument();
  });

  it("offers Remove assignment only for orders that are assigned, and says how many it was taken off", async () => {
    asRole("order_operator");
    const mine = task({ id: "t1" });
    queueOf([mine, free("t2")], [agent("agent_1", "Amal"), agent("agent_2", "Bassem")]);
    api.assignConfirmationTasks.mockResolvedValue({
      assignedTo: null,
      // The server answers with every open task it was sent, changed or not.
      tasks: [free("t1"), free("t2")],
      skipped: [],
    });
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    // Nobody was handed this order: there is nothing to remove, and the button says so instead of "updating" it.
    await user.click(await screen.findByRole("checkbox", { name: "Select ORD-t2" }));
    const off = within(bar()).getByRole("button", { name: "Remove assignment" });
    expect(off).toHaveAttribute("aria-disabled", "true");
    expect(off).toHaveAttribute("title", "None of the selected orders is assigned to anyone, so there is nothing to remove.");
    await user.click(off);
    expect(api.assignConfirmationTasks).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: "Select ORD-t1" }));
    await user.click(within(bar()).getByRole("button", { name: "Remove assignment" }));
    await waitFor(() => expect(api.assignConfirmationTasks).toHaveBeenCalledWith("ws_1", ["t1", "t2"], null));
    // One of the two had an assignment to lose.
    expect(await screen.findByText("Assignment removed from 1 order. Any agent can take them now.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Select ORD-t1" })).not.toBeChecked());
    expect(screen.getByText("ORD-t1")).toBeInTheDocument();
    expect(screen.getByText("ORD-t2")).toBeInTheDocument();
  });
});

describe("ConfirmationQueuePage selection", () => {
  it("clears the selection without touching the orders", async () => {
    asRole("owner");
    queueOf([free("t1"), free("t2")]);
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    const one = await screen.findByRole("checkbox", { name: "Select ORD-t1" });
    const two = screen.getByRole("checkbox", { name: "Select ORD-t2" });
    await user.click(one);
    await user.click(two);
    expect(one).toBeChecked();
    expect(two).toBeChecked();
    expect(within(bar()).getByText("2 selected")).toBeInTheDocument();
    const reads = api.listConfirmationQueue.mock.calls.length;

    await user.click(within(bar()).getByRole("button", { name: "Clear selection" }));

    // Unticked, both of them; the bar leaves; nothing was asked of the server and both orders are still listed.
    expect(one).not.toBeChecked();
    expect(two).not.toBeChecked();
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Actions for what you selected" })).not.toBeInTheDocument());
    expect(screen.getByText("ORD-t1")).toBeInTheDocument();
    expect(screen.getByText("ORD-t2")).toBeInTheDocument();
    expect(api.listConfirmationQueue.mock.calls.length).toBe(reads);
    for (const call of [
      api.assignConfirmationTasks,
      api.claimConfirmationTask,
      api.releaseConfirmationTask,
      api.recordConfirmationOutcome,
      api.unassignConfirmationTask,
    ]) {
      expect(call).not.toHaveBeenCalled();
    }

    // And the cards can be ticked again afterwards.
    await user.click(one);
    expect(one).toBeChecked();
    expect(within(bar()).getByText("1 selected")).toBeInTheDocument();
  });

  it("gives a store with one person the two results for a selection, and no assignment", async () => {
    asRole("owner");
    queueOf([free("t1")]);
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select ORD-t1" }));
    expect(within(bar()).getByRole("button", { name: "Accept all selected" })).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Cancel all selected" })).toBeInTheDocument();
    expect(within(bar()).queryByRole("button", { name: "Assign to…" })).not.toBeInTheDocument();
    expect(screen.queryByText("Remove assignment")).not.toBeInTheDocument();
    // The station stays behind its switch: no way to it here.
    expect(screen.queryByText("One by one")).not.toBeInTheDocument();
  });

  it("accepts every selected order only after the question was answered twice", async () => {
    asRole("owner");
    queueOf([free("t1"), free("t2"), free("t3")]);
    api.claimConfirmationTask.mockImplementation(async (_ws, id) => free(id, { status: "in_progress", lockedByUserId: testUser.id }));
    api.recordConfirmationOutcome.mockImplementation(async (_ws, id) => free(id, { status: "done", outcome: "confirmed" }));
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select ORD-t1" }));
    await user.click(screen.getByRole("checkbox", { name: "Select ORD-t2" }));
    await user.click(within(bar()).getByRole("button", { name: "Accept all selected" }));

    // First: how many, and what happens to them.
    const first = await screen.findByRole("dialog", { name: "Accept 2 orders?" });
    expect(within(first).getByText(/recorded as Confirmed and moves on to fulfilment/)).toBeInTheDocument();
    expect(api.claimConfirmationTask).not.toHaveBeenCalled();
    await user.click(within(first).getByRole("button", { name: "Continue" }));

    // Second: asked again, with the number again. Going back sends nothing.
    const second = await screen.findByRole("dialog", { name: "Are you sure?" });
    expect(within(second).getByText(/2 orders will be confirmed now, in one go/)).toBeInTheDocument();
    await user.click(within(second).getByRole("button", { name: "Back" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Accept 2 orders?" })).getByRole("button", { name: "Continue" }));
    expect(api.claimConfirmationTask).not.toHaveBeenCalled();
    expect(api.recordConfirmationOutcome).not.toHaveBeenCalled();

    await user.click(within(await screen.findByRole("dialog", { name: "Are you sure?" })).getByRole("button", { name: "Yes, accept 2 orders" }));

    await waitFor(() => expect(api.recordConfirmationOutcome).toHaveBeenCalledTimes(2));
    // Each order as a single one goes in the list: claimed, then its result saved.
    expect(api.claimConfirmationTask.mock.calls.map((call) => call[1])).toEqual(["t1", "t2"]);
    expect(api.recordConfirmationOutcome).toHaveBeenNthCalledWith(1, "ws_1", "t1", { outcome: "confirmed", channel: "other", notes: NOTE });
    expect(api.recordConfirmationOutcome).toHaveBeenNthCalledWith(2, "ws_1", "t2", { outcome: "confirmed", channel: "other", notes: NOTE });
    expect(await screen.findByText("2 orders accepted.")).toBeInTheDocument();
    // The two leave the tab; the one that was not ticked stays, unticked.
    await waitFor(() => expect(screen.queryByText("ORD-t1")).not.toBeInTheDocument());
    expect(screen.queryByText("ORD-t2")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-t3")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closing the first question leaves everything as it was", async () => {
    asRole("owner");
    queueOf([free("t1")]);
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    const box = await screen.findByRole("checkbox", { name: "Select ORD-t1" });
    await user.click(box);
    await user.click(within(bar()).getByRole("button", { name: "Cancel all selected" }));
    const first = await screen.findByRole("dialog", { name: "Cancel 1 order?" });
    await user.click(within(first).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(box).toBeChecked();
    expect(api.claimConfirmationTask).not.toHaveBeenCalled();
    expect(api.recordConfirmationOutcome).not.toHaveBeenCalled();
  });

  it("cancels every selected order with the reason, and lists the ones it had to leave", async () => {
    asRole("owner");
    queueOf([free("t1"), free("t2"), free("t3")]);
    api.claimConfirmationTask.mockImplementation(async (_ws, id) => {
      if (id === "t2") {
        throw new ApiError("Locked", 409, "TASK_ALREADY_LOCKED", {
          error: { details: { lockedBy: { id: "agent_2", fullName: "Bassem" }, lockExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() } },
        });
      }
      return free(id, { status: "in_progress", lockedByUserId: testUser.id });
    });
    api.recordConfirmationOutcome.mockImplementation(async (_ws, id) => {
      if (id === "t3") throw new ApiError("This order is cancelled", 409, "ORDER_CANCELLED", {});
      return free(id, { status: "done", outcome: "rejected" });
    });
    api.releaseConfirmationTask.mockImplementation(async (_ws, id) => free(id));
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    for (const id of ["t1", "t2", "t3"]) await user.click(await screen.findByRole("checkbox", { name: `Select ORD-${id}` }));
    await user.click(within(bar()).getByRole("button", { name: "Cancel all selected" }));

    const first = await screen.findByRole("dialog", { name: "Cancel 3 orders?" });
    expect(within(first).getByText(/recorded as Rejected: it is not shipped/)).toBeInTheDocument();
    // The server keeps a reason on every rejected order: no reason, no second question.
    expect(within(first).getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.type(within(first).getByLabelText(/Reason for the cancellation/), "Out of stock");
    await user.click(within(first).getByRole("button", { name: "Continue" }));
    const second = await screen.findByRole("dialog", { name: "Are you sure?" });
    expect(api.claimConfirmationTask).not.toHaveBeenCalled();
    const reads = api.listConfirmationQueue.mock.calls.length;
    await user.click(within(second).getByRole("button", { name: "Yes, cancel 3 orders" }));

    const result = await screen.findByRole("dialog", { name: "Finished" });
    expect(api.recordConfirmationOutcome).toHaveBeenCalledWith("ws_1", "t1", {
      outcome: "rejected",
      channel: "other",
      notes: NOTE,
      rejectionReason: "Out of stock",
    });
    expect(within(result).getByText("1 order cancelled.")).toBeInTheDocument();
    expect(within(result).getByText("2 orders left as they were:")).toBeInTheDocument();
    expect(within(result).getByText("ORD-t2").closest("li")).toHaveTextContent(/Bassem is already on this call/);
    expect(within(result).getByText("ORD-t3").closest("li")).toHaveTextContent(/ORD-t3: /);
    // A teammate's order was never claimed; the one whose result was refused is handed back to the queue.
    expect(api.recordConfirmationOutcome.mock.calls.map((call) => call[1])).toEqual(["t1", "t3"]);
    expect(api.releaseConfirmationTask.mock.calls.map((call) => call[1])).toEqual(["t3"]);
    // Something was left: the tab is read again, so its cards say what is true now.
    await waitFor(() => expect(api.listConfirmationQueue.mock.calls.length).toBeGreaterThan(reads));

    await user.click(within(result).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("leaves a teammate's live call out of the count before anything is asked", async () => {
    asRole("owner");
    const held = free("t2", {
      status: "in_progress",
      lockedByUserId: "agent_2",
      lockedBy: { id: "agent_2", fullName: "Bassem" },
      lockedAt: new Date().toISOString(),
      lockExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    queueOf([free("t1"), held]);
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select ORD-t1" }));
    await user.click(screen.getByRole("checkbox", { name: "Select ORD-t2" }));
    await user.click(within(bar()).getByRole("button", { name: "Accept all selected" }));

    const first = await screen.findByRole("dialog", { name: "Accept 1 order?" });
    expect(within(first).getByText("Left as they are")).toBeInTheDocument();
    expect(within(first).getByText("1 order a teammate is on right now")).toBeInTheDocument();
  });
});

describe("ConfirmationQueuePage channel", () => {
  it("offers WhatsApp beside the phone, and picks it for the outcome once opened during the claim", async () => {
    asRole("confirmation_agent");
    const claimed = task({
      status: "in_progress",
      assignedTo: null,
      assignedToUserId: null,
      lockedByUserId: testUser.id,
      lockedBy: { id: testUser.id, fullName: testUser.fullName },
      lockedAt: new Date().toISOString(),
      lockExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    api.getConfirmationQueueCounts.mockResolvedValue(counts);
    api.listConfirmationQueue.mockResolvedValue({ tasks: [claimed], nextCursor: null });
    api.recordConfirmationOutcome.mockResolvedValue(task({ status: "done" }));
    const { user } = renderWithProviders(<ConfirmationQueuePage />);

    const link = await screen.findByRole("link", { name: /Message Mona Ali on WhatsApp/ });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/201012345678\?text=/);
    expect(screen.getByRole("radio", { name: "Call" })).toBeChecked();

    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeChecked();

    // "Postponed" offers no date or time: the order comes back after the server's own delay.
    await user.click(screen.getByRole("button", { name: "Postponed" }));
    expect(screen.queryByText(/tomorrow/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="datetime-local"], input[type="date"], input[type="time"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "Confirmed" }));
    await user.click(screen.getByRole("button", { name: "Save & next" }));
    await waitFor(() =>
      expect(api.recordConfirmationOutcome).toHaveBeenCalledWith("ws_1", "task_1", { outcome: "confirmed", channel: "whatsapp" })
    );
  });
});

describe("ConfirmationQueuePage offers window", () => {
  it("lists a funnel order still in its offers window without letting anyone take it", async () => {
    asRole("owner");
    api.getConfirmationQueueCounts.mockResolvedValue({ ...counts, pendingDue: 0, waitingForOffers: 1 });
    api.listConfirmationQueue.mockResolvedValue({
      tasks: [
        task({
          assignedToUserId: null,
          assignedTo: null,
          availableAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          waitingForOffers: true,
        }),
      ],
      nextCursor: null,
    });
    api.listConfirmationAssignees.mockResolvedValue([]);
    renderWithProviders(<ConfirmationQueuePage />);

    expect(await screen.findByText("Waiting for the offers window")).toBeInTheDocument();
    expect(screen.getByText(/opens for confirmation in 10 minutes/)).toBeInTheDocument();
    expect(screen.getByText("ORD-1001")).toBeInTheDocument();
    // Nothing to act on, nothing to tick, and no customer details yet.
    expect(screen.queryByRole("button", { name: /^Claim/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Mona Ali")).not.toBeInTheDocument();
  });
});
