import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { entriesInScope, isEntryShown } from "@/lib/search/siteIndex";
import { StoreDesignPage } from "@/pages/storeDesign/StoreDesignPage";
import { SettingsPage } from "./SettingsPage";

/** A wide screen: the list and the section stand side by side. */
function desktop() {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function store(role = "owner") {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role, themeSettings: {} });
}

function list(name = "Settings: sections") {
  return screen.getByRole("navigation", { name });
}

function rowNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole("button")
    .map((row) => row.querySelector("span.truncate")?.textContent ?? "");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the search of a settings list", () => {
  it("finds a single setting inside a section, and says which", async () => {
    desktop();
    store();
    const { user } = renderWithProviders(<SettingsPage />, { route: "/settings?tab=identity" });
    await user.type(screen.getByRole("searchbox", { name: "Search the sections" }), "access token");
    expect(rowNames(list())).toEqual(["WhatsApp connection"]);
    const row = within(list()).getByRole("button", { name: /WhatsApp connection/ });
    expect(row).toHaveTextContent("WhatsApp access token");
    await user.click(row);
    await waitFor(() => expect(currentPath()).toBe("/settings?tab=whatsapp"));
  });

  it("brings the setting into view and marks it", async () => {
    desktop();
    store();
    const { user } = renderWithProviders(<SettingsPage />, { route: "/settings?tab=identity" });
    await user.type(screen.getByRole("searchbox", { name: "Search the sections" }), "store name");
    expect(rowNames(list())[0]).toBe("Store identity");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(document.querySelector('[data-search-anchor="store-name"]')).toHaveAttribute("data-search-hit"));
  });

  it("ranks the closest first, in either language, with the marks and hamzas forgiven", async () => {
    desktop();
    store();
    const { user } = renderWithProviders(<SettingsPage />, { route: "/settings?tab=identity", locale: "ar" });
    const search = screen.getByRole("searchbox", { name: "ابحث في الأقسام" });
    await user.type(search, "الأمان");
    expect(rowNames(list("أقسام الإعدادات"))[0]).toBe("الأمان");
    await user.clear(search);
    await user.type(search, "security");
    expect(rowNames(list("أقسام الإعدادات"))[0]).toBe("الأمان");
    await user.clear(search);
    await user.type(search, "اضافي");
    expect(rowNames(list("أقسام الإعدادات"))).toContain("عرض مع الطلب");
  });

  it("finds the store's tab icon in Store settings", async () => {
    desktop();
    store();
    const { user } = renderWithProviders(<StoreDesignPage />, { route: "/store-settings/seo", path: "/store-settings/:tab" });
    await user.type(screen.getByRole("searchbox", { name: "Search the sections" }), "favicon");
    const nav = list("Store settings: sections");
    expect(rowNames(nav)[0]).toBe("General");
    expect(within(nav).getByRole("button", { name: /General/ })).toHaveTextContent("Tab icon (favicon)");
    await user.click(within(nav).getByRole("button", { name: /General/ }));
    await waitFor(() => expect(currentPath()).toBe("/store-settings/general"));
  });
});

describe("every section the search opens", () => {
  it("lands on that section of Settings", async () => {
    desktop();
    store();
    const sections = entriesInScope("settings").filter((entry) => entry.kind === "section" && isEntryShown(entry, "owner"));
    expect(sections.length).toBeGreaterThan(10);
    for (const entry of sections) {
      const { unmount } = renderWithProviders(<SettingsPage />, { route: entry.to });
      expect(within(list()).getByRole("button", { name: new RegExp(`^${entry.title.en}`) }), entry.to).toHaveAttribute("aria-current", "page");
      unmount();
    }
  });

  it("lands on that section of Store settings", async () => {
    desktop();
    store();
    const sections = entriesInScope("store-settings").filter((entry) => entry.kind === "section");
    for (const entry of sections) {
      const { unmount } = renderWithProviders(<StoreDesignPage />, { route: entry.to, path: "/store-settings/:tab" });
      expect(within(list("Store settings: sections")).getByRole("button", { name: new RegExp(`^${entry.title.en}`) }), entry.to).toHaveAttribute("aria-current", "page");
      unmount();
    }
  });
});
