import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { StoreDesignPage } from "./StoreDesignPage";

describe("Store settings while the ported features are off", () => {
  it("has no Gift options, Redirects or Customer accounts section", async () => {
    fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings", path: "/store-settings" });
    const tabs = await screen.findByRole("navigation", { name: "Store settings: sections" });
    expect(tabs).toHaveTextContent("General");
    expect(tabs).not.toHaveTextContent("Gift options");
    expect(tabs).not.toHaveTextContent("Redirects");
    expect(tabs).not.toHaveTextContent("Customer accounts");
  });

  it("opens no section of its own for one that is switched off, and asks the API nothing about it", async () => {
    const calls = fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/redirects", path: "/store-settings/:tab" });
    // The address names no section of this store: the list is the page (a desktop opens the first section, General).
    const tabs = await screen.findByRole("navigation", { name: "Store settings: sections" });
    expect(within(tabs).queryByRole("button", { current: "page" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Redirects" })).not.toBeInTheDocument();
    expect(callsTo(calls, "GET", "/redirects")).toHaveLength(0);
    expect(callsTo(calls, "GET", "/gift-options")).toHaveLength(0);
  });

  it("does the same for the customer accounts address, and never reads the store's accounts", async () => {
    const calls = fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/customer-accounts", path: "/store-settings/:tab" });
    const tabs = await screen.findByRole("navigation", { name: "Store settings: sections" });
    expect(within(tabs).queryByRole("button", { current: "page" })).not.toBeInTheDocument();
    expect(callsTo(calls, "GET", "/shopper-accounts")).toHaveLength(0);
  });

  it("finds a section by what it holds, and opens it at the address it always had", async () => {
    fakeBackend({});
    const { user } = renderWithProviders(<StoreDesignPage />, { route: "/store-settings", path: "/store-settings/:tab?" });
    const tabs = await screen.findByRole("navigation", { name: "Store settings: sections" });

    await user.type(screen.getByRole("searchbox", { name: "Search the sections" }), "google");
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringContaining("SEO")]);

    await user.click(within(tabs).getByRole("button", { name: /SEO/ }));
    expect(currentPath()).toBe("/store-settings/seo");
    expect(await screen.findByRole("heading", { name: "SEO" })).toBeInTheDocument();
  });

  it("shows the published store on request, beside nothing: the settings keep the width", async () => {
    fakeBackend({});
    const { user } = renderWithProviders(<StoreDesignPage />, { route: "/store-settings/seo", path: "/store-settings/:tab" });

    await user.click(await screen.findByRole("button", { name: "See the store" }));
    expect(await screen.findByRole("dialog", { name: "Your published store" })).toBeInTheDocument();
  });
});
