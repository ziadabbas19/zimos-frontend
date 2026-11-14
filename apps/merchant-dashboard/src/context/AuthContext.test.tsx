import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, TwoFactorRequiredError, type AuthUser } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";

/**
 * The real AuthProvider (setup.ts mocks the module for screen tests), over
 * the mocked API client. Only a 401 from /auth/me — or from /auth/refresh
 * behind it, which the client turns into the same 401 — makes the user a
 * guest. A 429, a 5xx or no network keeps the session: "unavailable" with a
 * retry on a page load, nothing at all once the page is showing.
 */
const { AuthProvider, useAuth } = await vi.importActual<typeof import("@/context/AuthContext")>("@/context/AuthContext");

const user = fake<AuthUser>({ id: "user_1", email: "owner@zimos.test", fullName: "Mona Adel", status: "active" });
// `account` is what a newer API adds to /auth/me (account settings); harmless before it.
const me = { user, needsPlan: false, confirmed: true, suggestedUsername: null, account: { hasPassword: true, phoneChange: false } };

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="user">{auth.user?.email ?? ""}</p>
      <button onClick={() => void auth.retry()}>retry</button>
      <button onClick={() => void auth.refreshUser()}>reload</button>
      <button onClick={() => void auth.logout().catch(() => undefined)}>logout</button>
      <button
        onClick={() =>
          void auth.signOutEverywhere().catch(() => {
            document.title = "everywhere failed";
          })
        }
      >
        everywhere
      </button>
      <button
        onClick={() =>
          void auth.login({ identifier: "owner@zimos.test", password: "x" }).catch((err: unknown) => {
            document.title = err instanceof TwoFactorRequiredError ? `challenge:${err.challenge.challengeToken}` : "other";
          })
        }
      >
        login
      </button>
    </div>
  );
}

function renderProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  return userEvent.setup();
}

const status = () => screen.getByTestId("status").textContent;

beforeEach(() => {
  api.isAuthenticated.mockReturnValue(true);
});

describe("an explicit 401 signs out", () => {
  it("from /auth/me (or the refresh behind it) on a page load", async () => {
    api.meDetails.mockRejectedValue(new ApiError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN"));
    renderProvider();

    await waitFor(() => expect(status()).toBe("guest"));
  });

  it("from a later re-read of the account", async () => {
    api.meDetails.mockResolvedValueOnce(me).mockRejectedValueOnce(new ApiError("Account is not active", 401, "ACCOUNT_INACTIVE"));
    const u = renderProvider();
    await waitFor(() => expect(status()).toBe("authenticated"));

    await u.click(screen.getByRole("button", { name: "reload" }));

    await waitFor(() => expect(status()).toBe("guest"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
  });
});

describe("a 429, a 5xx or no network keeps the session", () => {
  it.each([
    ["rate limited (429)", () => new ApiError("Too many requests", 429, "RATE_LIMITED")],
    ["a server error (500)", () => new ApiError("Boom", 500, "INTERNAL_SERVER_ERROR")],
    ["unavailable (503)", () => new ApiError("Request failed with status 503", 503)],
    ["no network", () => new TypeError("Failed to fetch")],
  ])("%s on a page load: unavailable, then a retry signs in", async (_label, failure) => {
    api.meDetails.mockRejectedValueOnce(failure()).mockResolvedValueOnce(me);
    const u = renderProvider();

    await waitFor(() => expect(status()).toBe("unavailable"));
    expect(api.clearSession).not.toHaveBeenCalled();
    expect(api.logout).not.toHaveBeenCalled();

    await u.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("owner@zimos.test");
  });

  it("once the page is showing, a failed re-read changes nothing", async () => {
    api.meDetails.mockResolvedValueOnce(me).mockRejectedValueOnce(new ApiError("Too many requests", 429, "RATE_LIMITED"));
    const u = renderProvider();
    await waitFor(() => expect(status()).toBe("authenticated"));

    await u.click(screen.getByRole("button", { name: "reload" }));

    await waitFor(() => expect(api.meDetails).toHaveBeenCalledTimes(2));
    expect(status()).toBe("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("owner@zimos.test");
  });

  it("coming back online tries again by itself", async () => {
    api.meDetails.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(me);
    renderProvider();
    await waitFor(() => expect(status()).toBe("unavailable"));

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(status()).toBe("authenticated"));
  });

  it("coming back online the moment the read failed, before the page shows it, still tries again", async () => {
    // Back online a few microtasks after the read failed: the provider has taken the failure
    // in, but React draws "unavailable" (and runs its effects) only in a later task.
    const failed = Promise.reject(new TypeError("Failed to fetch"));
    let shownWhenOnline: string | null = null;
    void failed.catch(async () => {
      for (let i = 0; i < 10; i++) await null;
      shownWhenOnline = status();
      window.dispatchEvent(new Event("online"));
    });
    api.meDetails.mockReturnValueOnce(failed).mockResolvedValueOnce(me);
    renderProvider();

    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(shownWhenOnline).toBe("loading");
    expect(api.meDetails).toHaveBeenCalledTimes(2);
  });
});

it("signing out ends the session here even when the server can't be told", async () => {
  api.meDetails.mockResolvedValue(me);
  api.logout.mockRejectedValue(new TypeError("Failed to fetch"));
  const u = renderProvider();
  await waitFor(() => expect(status()).toBe("authenticated"));

  await u.click(screen.getByRole("button", { name: "logout" }));

  await waitFor(() => expect(status()).toBe("guest"));
  expect(api.logout).toHaveBeenCalledTimes(1);
});

describe("signing out of all devices", () => {
  it("makes this device a guest once the server has ended the sessions (the sign-in page follows)", async () => {
    api.meDetails.mockResolvedValue(me);
    api.signOutEverywhere.mockResolvedValue(undefined);
    const u = renderProvider();
    await waitFor(() => expect(status()).toBe("authenticated"));

    await u.click(screen.getByRole("button", { name: "everywhere" }));

    await waitFor(() => expect(status()).toBe("guest"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
    expect(api.signOutEverywhere).toHaveBeenCalledTimes(1);
    expect(api.logout).not.toHaveBeenCalled();
  });

  it("stays signed in, and says it failed, when the server could not be told", async () => {
    document.title = "";
    api.meDetails.mockResolvedValue(me);
    api.signOutEverywhere.mockRejectedValue(new TypeError("Failed to fetch"));
    const u = renderProvider();
    await waitFor(() => expect(status()).toBe("authenticated"));

    await u.click(screen.getByRole("button", { name: "everywhere" }));

    await waitFor(() => expect(document.title).toBe("everywhere failed"));
    expect(status()).toBe("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("owner@zimos.test");
  });
});

describe("a sign-in that needs its second step", () => {
  it("is not signed in: the challenge is handed to the login page", async () => {
    api.isAuthenticated.mockReturnValue(false);
    api.login.mockResolvedValue({ twoFactorRequired: true, challengeToken: "c1", channel: "totp" });
    const u = renderProvider();
    await waitFor(() => expect(status()).toBe("guest"));

    await u.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(document.title).toBe("challenge:c1"));
    expect(status()).toBe("guest");
    expect(api.meDetails).not.toHaveBeenCalled();
  });
});
