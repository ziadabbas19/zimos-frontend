import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORBIDDEN_EVENT } from "@/lib/apiClient";
import { P } from "@/lib/permissions";
import { AuthProvider, useAuth } from "./AuthContext";

/**
 * A change to someone's role reaches their open console with no sign-out: on a
 * timer, on coming back to the tab, and on the first refused request.
 */

const h = vi.hoisted(() => ({
  me: vi.fn(),
  clearSession: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

vi.mock("@/lib/apiClient", () => ({
  FORBIDDEN_EVENT: "zimos:forbidden",
  apiClient: { me: h.me, clearSession: h.clearSession, isAuthenticated: h.isAuthenticated },
}));

const account = (permissions: string[], platformAdmin = true) => ({
  id: "u1",
  platformAdmin,
  platformRole: platformAdmin ? "support_desk_a1b2c3" : null,
  platformPermissions: permissions,
});

function Probe() {
  const { status, can } = useAuth();
  return (
    <p>
      {status}: {can(P.PLANS_VIEW) ? "plans" : "no plans"}
    </p>
  );
}

async function mount() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  h.me.mockReset();
  h.clearSession.mockReset();
  h.isAuthenticated.mockReset().mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the signed-in account", () => {
  it("is read again every minute, and a permission taken away is gone with no sign-out", async () => {
    h.me.mockResolvedValue(account([P.PLANS_VIEW]));
    await mount();
    expect(screen.getByText("authenticated: plans")).toBeTruthy();

    h.me.mockResolvedValue(account([]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByText("authenticated: no plans")).toBeTruthy();
  });

  it("is read again on coming back to the tab, and a permission given shows at once", async () => {
    h.me.mockResolvedValue(account([]));
    await mount();
    expect(screen.getByText("authenticated: no plans")).toBeTruthy();

    h.me.mockResolvedValue(account([P.PLANS_VIEW]));
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(screen.getByText("authenticated: plans")).toBeTruthy();
  });

  it("is read again on a refused request, once however many were refused together", async () => {
    h.me.mockResolvedValue(account([P.PLANS_VIEW]));
    await mount();
    h.me.mockClear();

    h.me.mockResolvedValue(account([]));
    window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    await flush();
    expect(h.me).toHaveBeenCalledTimes(1);
    expect(screen.getByText("authenticated: no plans")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    await flush();
    expect(h.me.mock.calls.length).toBeGreaterThan(1);
  });

  it("ends the session when the role itself is gone", async () => {
    h.me.mockResolvedValue(account([P.PLANS_VIEW]));
    await mount();

    h.me.mockResolvedValue(account([], false));
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(h.clearSession).toHaveBeenCalled();
    expect(screen.getByText("guest: no plans")).toBeTruthy();
  });

  it("keeps what is on screen when a read fails for another reason", async () => {
    h.me.mockResolvedValue(account([P.PLANS_VIEW]));
    await mount();

    h.me.mockRejectedValue(new Error("network down"));
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(screen.getByText("authenticated: plans")).toBeTruthy();
  });
});
