import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { StoreDesignPage } from "./StoreDesignPage";

// The page builds its list of sections once from the switches: this file runs with them on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  GIFT_OPTIONS_ENABLED: true,
  URL_REDIRECTS_ENABLED: true,
  SHOPPER_ACCOUNTS_ENABLED: true,
}));

describe("Store settings with gift options and redirects switched on", () => {
  it("opens the Redirects section and reads the redirects of the store", async () => {
    const calls = fakeBackend({ "GET /redirects": { redirects: [], total: 0 } });
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/redirects", path: "/store-settings/:tab" });
    const tabs = await screen.findByRole("navigation", { name: "Store settings: sections" });
    expect(within(tabs).getByRole("button", { current: "page" })).toHaveTextContent("Redirects");
    expect(screen.getByRole("heading", { name: "Redirects" })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(calls, "GET", "/workspaces/ws_1/redirects").length).toBeGreaterThan(0));
    expect(await screen.findByText("No redirects yet")).toBeInTheDocument();
  });

  it("opens the Gift options section and reads the gift options of the store", async () => {
    const calls = fakeBackend({ "GET /gift-options": { enabled: false, wrapVariantId: null, messageMaxLength: 300 } });
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/gift-options", path: "/store-settings/:tab" });
    expect(await screen.findByRole("switch", { name: /Offer gift options at checkout/ })).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/gift-options")).toHaveLength(1);
  });

  it("opens the Customer accounts section and reads the store's accounts", async () => {
    const calls = fakeBackend({ "GET /shopper-accounts": { enabled: false, channels: ["sms"] } });
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/customer-accounts", path: "/store-settings/:tab" });
    expect(await screen.findByRole("switch", { name: /Let customers sign in to see their orders/ })).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/shopper-accounts")).toHaveLength(1);
  });

  it("names the sections in formal Arabic, each under its group", async () => {
    fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings", path: "/store-settings", locale: "ar" });
    const tabs = await screen.findByRole("navigation", { name: "أقسام إعدادات المتجر" });
    expect(within(tabs).getByRole("heading", { name: "الأساسيات" })).toBeInTheDocument();
    expect(within(tabs).getByRole("heading", { name: "الوصول" })).toBeInTheDocument();
    expect(tabs).toHaveTextContent("خيارات الهدايا");
    expect(tabs).toHaveTextContent("تحويل الروابط");
    expect(tabs).toHaveTextContent("حسابات العملاء");
  });
});
