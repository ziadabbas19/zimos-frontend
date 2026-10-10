import { act } from "react";
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import appSource from "../../App.tsx?raw";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts, SHORTCUTS_HELP_EVENT } from "@/components/KeyboardShortcuts";
import { StoreSwitcher } from "@/components/shell/StoreSwitcher";
import { NAV_ITEMS } from "@/lib/navigation";
import { fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";

/** Every address App.tsx has a page for. */
const ROUTES = new Set(Array.from(appSource.matchAll(/path="([^"]+)"/g), (match) => match[1]));

function store() {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role: "owner" });
  workspaceMock.workspaces = [workspaceMock.currentWorkspace];
}

describe("links that used to open nothing", () => {
  it("reads the routes out of App.tsx", () => {
    expect(ROUTES.has("/orders")).toBe(true);
    expect(ROUTES.has("/workspaces")).toBe(true);
  });

  it("has a page behind every entry of the menu", () => {
    const missing = NAV_ITEMS.filter((item) => !ROUTES.has(item.to)).map((item) => item.to);
    expect(missing).toEqual([]);
    for (const gone of ["/affiliates", "/referrals"]) expect(NAV_ITEMS.some((item) => item.to === gone)).toBe(false);
  });

  it("offers no page or action in search that has no page", async () => {
    store();
    const { user } = renderWithProviders(<CommandPalette />);
    await user.click(screen.getByRole("button", { name: "Search" }));
    const list = screen.getByRole("listbox");
    expect(within(list).getByRole("option", { name: /New product/ })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: /All my stores/ })).not.toBeInTheDocument();

    // Typed, the pages are searched by name: neither of the two that had no page comes back.
    await user.type(screen.getByRole("combobox"), "aff");
    expect(within(screen.getByRole("listbox")).queryByRole("option", { name: /Affiliates/ })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "refer");
    expect(within(screen.getByRole("listbox")).queryByRole("option", { name: /Refer & earn/ })).not.toBeInTheDocument();
  });

  it("keeps the store list to the stores and a new one", async () => {
    store();
    const { user } = renderWithProviders(<StoreSwitcher />);
    await user.click(screen.getByRole("button", { name: "Switch store" }));
    const list = await screen.findByTestId("store-switcher-list");
    expect(within(list).queryByRole("button", { name: "All my stores" })).not.toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "New store" }));
    expect(currentPath()).toBe("/workspaces");
  });

  it("lists no keyboard shortcut to a page that is not there", () => {
    store();
    renderWithProviders(<KeyboardShortcuts />);
    act(() => {
      window.dispatchEvent(new Event(SHORTCUTS_HELP_EVENT));
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Orders")).toBeInTheDocument();
    expect(within(dialog).queryByText("Affiliates")).not.toBeInTheDocument();
  });
});
