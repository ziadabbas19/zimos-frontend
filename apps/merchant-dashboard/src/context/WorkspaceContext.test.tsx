import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, authMock, fake, type ListedWorkspace } from "@/test/mocks";

// setup.ts swaps this module for a test double on every screen; here it is the thing under test.
const { WorkspaceProvider, useWorkspace } =
  await vi.importActual<typeof import("./WorkspaceContext")>("./WorkspaceContext");

function renderWorkspace() {
  return renderWorkspaceHook().result;
}

function renderWorkspaceHook() {
  const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider>{children}</WorkspaceProvider>;
  return renderHook(() => useWorkspace(), { wrapper });
}

describe("WorkspaceProvider on a page load", () => {
  it("asks for the store list while the account is still being read, and uses that answer once it is known", async () => {
    authMock.status = "loading";
    api.isAuthenticated.mockReturnValue(true);
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", name: "Nile Store", role: "owner" })]);
    const { result, rerender } = renderWorkspaceHook();

    // Sent before /auth/me has answered, while the screen still waits.
    await waitFor(() => expect(api.listWorkspaces).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);

    authMock.status = "authenticated";
    rerender();
    await waitFor(() => expect(result.current.currentWorkspace?.id).toBe("ws_1"));
    expect(result.current.loading).toBe(false);
    // The early answer was used: not asked again.
    expect(api.listWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("drops the early answer when the account turns out to be signed out", async () => {
    authMock.status = "loading";
    api.isAuthenticated.mockReturnValue(true);
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", name: "Nile Store", role: "owner" })]);
    const { result, rerender } = renderWorkspaceHook();
    await waitFor(() => expect(api.listWorkspaces).toHaveBeenCalledTimes(1));

    authMock.status = "guest";
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.currentWorkspace).toBeNull();
  });

  it("asks nothing early without a session on this device", async () => {
    authMock.status = "loading";
    api.isAuthenticated.mockReturnValue(false);
    renderWorkspaceHook();
    await Promise.resolve();
    expect(api.listWorkspaces).not.toHaveBeenCalled();
  });
});

describe("WorkspaceProvider applySavedWorkspace", () => {
  it("replaces the saved store in the list, keeping the role the list read gave", async () => {
    api.listWorkspaces.mockResolvedValue([
      fake<ListedWorkspace>({ id: "ws_1", name: "Nile Store", role: "owner", themeSettings: { primaryColor: "#1F5D5B" } }),
      fake<ListedWorkspace>({ id: "ws_2", name: "Delta Store", role: "editor", themeSettings: {} }),
    ]);
    const result = renderWorkspace();
    await waitFor(() => expect(result.current.currentWorkspace?.id).toBe("ws_1"));

    // A PATCH reply: no role.
    act(() =>
      result.current.applySavedWorkspace(
        fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: { primaryColor: "#BE123C", storeTheme: "warm" } })
      )
    );

    expect(result.current.currentWorkspace).toMatchObject({
      id: "ws_1",
      role: "owner",
      themeSettings: { primaryColor: "#BE123C", storeTheme: "warm" },
    });
    expect(result.current.workspaces[1]).toMatchObject({ id: "ws_2", role: "editor", themeSettings: {} });
    // Applied in place: no re-read, so `loading` never flipped.
    expect(result.current.loading).toBe(false);
    expect(api.listWorkspaces).toHaveBeenCalledTimes(1);
  });
});
