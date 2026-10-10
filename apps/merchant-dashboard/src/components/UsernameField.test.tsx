import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { ApiError, type AuthUser } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { UsernameField, type UsernameStatus } from "./UsernameField";

function Harness({ current = null }: { current?: string | null }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  return (
    <>
      <UsernameField value={value} onChange={setValue} onStatus={setStatus} current={current} />
      <output data-testid="status">{status}</output>
    </>
  );
}

describe("UsernameField", () => {
  it("rejects a malformed name without asking the server", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.type(screen.getByLabelText("Username"), "1abc");
    expect(await screen.findByText(/Not a valid username/)).toBeInTheDocument();
    expect(screen.getByTestId("status")).toHaveTextContent("invalid");
    expect(api.checkUsernameAvailable).not.toHaveBeenCalled();
  });

  it("checks availability once typing pauses, lower-cased", async () => {
    api.checkUsernameAvailable.mockImplementation(async (name: string) =>
      name === "taken.one" ? { available: false, reason: "taken" } : { available: true }
    );
    const { user } = renderWithProviders(<Harness />);
    const input = screen.getByLabelText("Username");
    await user.type(input, "Taken.One");
    expect(input).toHaveValue("taken.one");
    expect(await screen.findByText(/Already taken/)).toBeInTheDocument();
    expect(api.checkUsernameAvailable).toHaveBeenLastCalledWith("taken.one");

    await user.clear(input);
    await user.type(input, "free.one");
    expect(await screen.findByText("Available")).toBeInTheDocument();
    // The field reports its status from an effect, one commit after the hint is drawn.
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("available"));
    expect(input).toHaveAttribute("dir", "ltr");
  });

  it("says when the check is rate limited, and treats one's own name as fine", async () => {
    api.checkUsernameAvailable.mockRejectedValue(new ApiError("slow down", 429, "RATE_LIMITED", null));
    const { user } = renderWithProviders(<Harness current="mine.now" />);
    const input = screen.getByLabelText("Username");
    await user.type(input, "mine.now");
    expect(await screen.findByText(/current username/)).toBeInTheDocument();
    await user.type(input, "x");
    expect(await screen.findByText(/Too many checks/)).toBeInTheDocument();
  });
});

describe("ProtectedRoute and usernames", () => {
  it("sends an account without a username to choose one first", async () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/workspaces" element={<p>picker</p>} />
          <Route path="/choose-username" element={<p>choose</p>} />
        </Route>
      </Routes>,
      { route: "/workspaces", auth: { user: fake<AuthUser>({ id: "u1", username: null, status: "active" }) } }
    );
    await waitFor(() => expect(currentPath()).toBe("/choose-username"));
    expect(screen.getByText("choose")).toBeInTheDocument();
  });

  it("lets an account with a username through", async () => {
    vi.clearAllMocks();
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/workspaces" element={<p>picker</p>} />
        </Route>
      </Routes>,
      { route: "/workspaces", auth: { user: fake<AuthUser>({ id: "u1", username: "amr", status: "active" }) } }
    );
    expect(await screen.findByText("picker")).toBeInTheDocument();
  });
});
