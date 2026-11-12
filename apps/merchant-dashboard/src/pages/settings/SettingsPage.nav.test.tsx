import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
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

function store(role: string) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role, themeSettings: {} });
}

function list() {
  return screen.getByRole("navigation", { name: "Settings: sections" });
}

function rowNames(): string[] {
  return within(list())
    .getAllByRole("button")
    .map((row) => row.querySelector("span.truncate")?.textContent ?? "");
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-glass");
});

describe("the settings menu", () => {
  it("lists our sections under their headings, each with its coloured tile", () => {
    store("owner");
    renderWithProviders(<SettingsPage />, { route: "/settings" });

    expect(within(list()).getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "The store",
      "Messages",
      "Team",
      "Plan",
      "My account",
      "For developers",
    ]);
    expect(rowNames()).toEqual([
      "Store identity",
      "Store fonts",
      "Time zone and invoices",
      "Product listing",
      "Offer with the order",
      "WhatsApp message",
      "WhatsApp connection",
      "Order emails",
      "Members and invites",
      "Plan and billing",
      "Profile",
      "Language and look",
      "Notifications",
      // Always listed: the password and signing out of every device (two-step sign-in is its part behind a switch).
      "Security",
      "API keys and webhooks",
    ]);
    const tones = Object.fromEntries(
      within(list())
        .getAllByRole("button")
        .map((row) => [row.dataset.sectionId, row.querySelector('[data-slot="settings-tile"]')?.getAttribute("data-tone")])
    );
    expect(tones).toMatchObject({ members: "blue", billing: "green", profile: "blue", appearance: "purple", notifications: "red", developers: "gray" });
  });

  it("has no screens of his that this API has no route for", () => {
    store("owner");
    renderWithProviders(<SettingsPage />, { route: "/settings" });
    for (const name of ["Groups", "Transfer ownership", "Devices", "My apps", "AI assistants"]) {
      expect(within(list()).queryByRole("button", { name: new RegExp(name) })).not.toBeInTheDocument();
    }
  });

  it("leaves the plan out for a role that cannot open it", () => {
    store("order_operator");
    renderWithProviders(<SettingsPage />, { route: "/settings?tab=billing" });
    expect(rowNames()).not.toContain("Plan and billing");
    expect(screen.queryByRole("link", { name: "Open My Plan" })).not.toBeInTheDocument();
  });

  it("opens Language and look from the list on a phone, with the glass switch in it", async () => {
    store("owner");
    const { user } = renderWithProviders(<SettingsPage />, { route: "/settings" });
    // A phone with nothing chosen: the list is the page.
    expect(screen.queryByRole("heading", { level: 2, name: "Language and look" })).not.toBeInTheDocument();

    await user.click(within(list()).getByRole("button", { name: /Language and look/ }));

    expect(currentPath()).toBe("/settings?tab=appearance");
    expect(screen.getByRole("heading", { level: 2, name: "Language and look" })).toBeInTheDocument();
    const glass = screen.getByRole("switch", { name: "Glass surfaces" });
    expect(glass).toHaveAttribute("aria-checked", "true");
    await user.click(glass);
    expect(document.documentElement).toHaveAttribute("data-glass", "off");
  });

  it("shows the first section on a wide screen, marks it in the list and says so in the address", async () => {
    store("owner");
    desktop();
    renderWithProviders(<SettingsPage />, { route: "/settings" });
    expect(await screen.findByRole("heading", { name: "Store profile" })).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe("/settings?tab=identity"));
    expect(within(list()).getByRole("button", { name: /Store identity/ })).toHaveAttribute("aria-current", "page");
  });

  it("still lands on the right section from a link written before the list (#whatsapp)", async () => {
    store("owner");
    renderWithProviders(<SettingsPage />, { route: "/settings#whatsapp" });
    await waitFor(() => expect(currentPath()).toBe("/settings?tab=whatsapp"));
    expect(screen.getByRole("heading", { level: 2, name: "WhatsApp connection" })).toBeInTheDocument();
  });

  it("finds a section by a word in either language", async () => {
    store("owner");
    const { user } = renderWithProviders(<SettingsPage />, { route: "/settings" });
    await user.type(screen.getByRole("searchbox", { name: "Search the sections" }), "زجاج");
    expect(rowNames()).toEqual(["Language and look"]);
  });

  it("names the sections in formal Arabic", () => {
    store("owner");
    renderWithProviders(<SettingsPage />, { route: "/settings", locale: "ar" });
    const menu = screen.getByRole("navigation", { name: "أقسام الإعدادات" });
    expect(within(menu).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["المتجر", "الرسائل", "الفريق", "الخطة", "حسابي", "للمطوّرين"]);
    expect(within(menu).getByRole("button", { name: /اللغة والشكل/ })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: /الأعضاء والدعوات/ })).toBeInTheDocument();
  });
});
