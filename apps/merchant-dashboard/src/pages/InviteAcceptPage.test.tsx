import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type AuthUser } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { authMock, fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { readPendingInvite, rememberPendingInvite } from "@/lib/pendingInvite";
import { InviteAcceptPage } from "./InviteAcceptPage";

const TOKEN = "ab".repeat(32);
const route = `/invites?token=${TOKEN}`;

const pending = (email = "agent@zimos.test") => ({
  invite: { state: "pending", workspace: { name: "Nile Store" }, role: { key: "order_operator", name: "Order Operator" }, email, expiresAt: "2026-11-04T00:00:00.000Z" },
});
const joined = { workspace: { id: "ws_9", name: "Nile Store", slug: "nile" }, role: { key: "order_operator", name: "Order Operator" } };

function render(path = route) {
  return renderWithProviders(<InviteAcceptPage />, { route: path, path: "/invites" });
}

beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

describe("the invite page, signed out", () => {
  beforeEach(() => Object.assign(authMock, { status: "guest", user: null }));

  it("names the store, the role and the address, and sends the invitee to sign in with the link kept", async () => {
    fakeBackend({ [`GET /invites/${TOKEN}`]: pending("new@zimos.test") });
    const { user } = render();

    expect(await screen.findByRole("heading", { name: "Join Nile Store" })).toBeInTheDocument();
    expect(screen.getByText("You're invited as Order operator.")).toBeInTheDocument();
    expect(screen.getByText("The invitation was sent to new@zimos.test.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I have an account — sign in" }));
    expect(currentPath()).toBe("/login");
    expect(readPendingInvite()).toEqual({ token: TOKEN, email: "new@zimos.test" });
  });

  it("sends a new invitee to sign up, with the address kept for the form", async () => {
    fakeBackend({ [`GET /invites/${TOKEN}`]: pending("new@zimos.test") });
    const { user } = render();
    await user.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(currentPath()).toBe("/register");
    expect(readPendingInvite()?.email).toBe("new@zimos.test");
  });

  it("says when the link is incomplete, without asking the server", async () => {
    const calls = fakeBackend({});
    render("/invites");
    expect(await screen.findByRole("heading", { name: "This invitation link is incomplete" })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it.each([
    ["expired", { invite: { ...pending().invite, state: "expired" } }, "This invitation has expired"],
    ["accepted", { invite: { ...pending().invite, state: "accepted", email: null } }, "This invitation was already accepted"],
    ["unknown", new ApiError("Not valid", 404, "INVITE_INVALID"), "This invitation link isn't valid"],
  ])("explains a link that cannot be used (%s) and forgets it", async (_name, answer, heading) => {
    rememberPendingInvite({ token: TOKEN, email: "agent@zimos.test" });
    fakeBackend({ [`GET /invites/${TOKEN}`]: answer });
    render();
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in|Accept/ })).not.toBeInTheDocument();
    expect(readPendingInvite()).toBeNull();
  });
});

describe("the invite page, signed in", () => {
  beforeEach(() => Object.assign(authMock, { status: "authenticated", user: fake<AuthUser>({ id: "user_1", email: "Agent@Zimos.test", fullName: "Amr" }) }));

  it("accepts with a press for the invited address (in any case), opens the store and forgets the link", async () => {
    const calls = fakeBackend({ [`GET /invites/${TOKEN}`]: pending(), [`POST /invites/${TOKEN}/accept`]: joined });
    const { user } = render();

    await user.click(await screen.findByRole("button", { name: "Accept the invitation" }));
    await waitFor(() => expect(currentPath()).toBe("/"));
    expect(callsTo(calls, "POST", `/invites/${TOKEN}/accept`)).toHaveLength(1);
    expect(workspaceMock.refresh).toHaveBeenCalled();
    expect(workspaceMock.selectWorkspace).toHaveBeenCalledWith("ws_9");
    expect(readPendingInvite()).toBeNull();
  });

  it("accepts on its own when the invitee comes back from signing in or up here", async () => {
    rememberPendingInvite({ token: TOKEN, email: "agent@zimos.test" });
    const calls = fakeBackend({ [`GET /invites/${TOKEN}`]: pending(), [`POST /invites/${TOKEN}/accept`]: joined });
    render();
    await waitFor(() => expect(callsTo(calls, "POST", `/invites/${TOKEN}/accept`)).toHaveLength(1));
    await waitFor(() => expect(currentPath()).toBe("/"));
  });

  it("tells another account to sign out first, and accepts nothing", async () => {
    const calls = fakeBackend({ [`GET /invites/${TOKEN}`]: pending("someone@else.test") });
    const { user } = render();

    expect(await screen.findByText("You're signed in with another account")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept the invitation" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(authMock.logout).toHaveBeenCalled();
    expect(callsTo(calls, "POST", `/invites/${TOKEN}/accept`)).toHaveLength(0);
  });

  it("says so when the account is already a member", async () => {
    fakeBackend({
      [`GET /invites/${TOKEN}`]: pending(),
      [`POST /invites/${TOKEN}/accept`]: new ApiError("Already a member", 409, "ALREADY_MEMBER"),
    });
    const { user } = render();
    await user.click(await screen.findByRole("button", { name: "Accept the invitation" }));
    expect(await screen.findByText("You're already a member of this store.")).toBeInTheDocument();
    expect(currentPath()).toBe(route);
  });

  it("reads the invite again when it was accepted or expired meanwhile", async () => {
    let state = "pending";
    const calls = fakeBackend({
      [`GET /invites/${TOKEN}`]: () => ({ invite: { ...pending().invite, state } }),
      [`POST /invites/${TOKEN}/accept`]: () => {
        state = "expired";
        return new ApiError("Expired", 410, "INVITE_EXPIRED");
      },
    });
    const { user } = render();
    await user.click(await screen.findByRole("button", { name: "Accept the invitation" }));
    expect(await screen.findByRole("heading", { name: "This invitation has expired" })).toBeInTheDocument();
    expect(callsTo(calls, "GET", `/invites/${TOKEN}`)).toHaveLength(2);
  });
});

describe("the invite page in Arabic", () => {
  it("names the role in formal Arabic", async () => {
    Object.assign(authMock, { status: "guest", user: null });
    fakeBackend({ [`GET /invites/${TOKEN}`]: pending("new@zimos.test") });
    renderWithProviders(<InviteAcceptPage />, { route, path: "/invites", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "انضم إلى Nile Store" })).toBeInTheDocument();
    expect(screen.getByText("دُعيت بدور مسؤول الطلبات.")).toBeInTheDocument();
  });
});
