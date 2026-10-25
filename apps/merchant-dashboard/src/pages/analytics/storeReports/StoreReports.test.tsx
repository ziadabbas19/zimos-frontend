import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { RfmOverview, ScheduledReportSettings, StoreReportInventoryValue, TrackingPixelList } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RfmGroupsTab } from "@/pages/customers/crm/RfmGroupsTab";
import { TrackingPixelsSection } from "@/pages/marketing/TrackingPixelsSection";
import { SummaryReportsSection } from "@/pages/settings/SummaryReportsSection";
import { StoreReportPage } from "./StoreReportPage";
import { STORE_REPORT_ROUTES } from "./storeReportStrings";

// The reports' address, the customer groups and the extra ad platforms: this file runs with their switches on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  STORE_REPORTS_ENABLED: true,
  AD_PIXELS_ENABLED: true,
}));

describe("store reports", () => {
  it("lists the reports this API answers, each on its own address", async () => {
    fakeBackend({});
    renderWithProviders(<StoreReportPage />, { route: "/analytics/reports", path: "/analytics/reports/:report?" });
    expect(await screen.findByRole("heading", { name: "More reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tax report/ })).toHaveAttribute("href", "/analytics/reports/tax");
    expect(screen.getByRole("link", { name: /Slow-moving stock/ })).toHaveAttribute("href", "/analytics/reports/slow-stock");
    // Cart offers have no report on this API.
    expect(STORE_REPORT_ROUTES.map((route) => route.slug)).toEqual([
      "tax",
      "order-times",
      "sales-by-collection",
      "sales-by-option",
      "returns",
      "inventory-value",
      "slow-stock",
    ]);
    expect(screen.queryByText(/Cart offers/)).not.toBeInTheDocument();
  });

  it("reads the stock value from the API and shows it at cost", async () => {
    const report: StoreReportInventoryValue = {
      currency: "EGP",
      totals: { variants: 1, units: 12, value: "120000", freeValue: "100000", withoutCost: 0 },
      locations: null,
      variants: [{ variantId: "var_1", productId: "prod_1", productName: "Linen shirt", sku: "LS-M", options: { Size: "M" }, onHand: 12, reserved: 2, free: 10, unitCost: "10000", value: "120000" }],
      withoutCost: [],
    };
    const calls = fakeBackend({ "GET /store-reports/inventory-value": report });
    renderWithProviders(<StoreReportPage />, { route: "/analytics/reports/inventory-value", path: "/analytics/reports/:report?" });
    expect(await screen.findByText("Linen shirt")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/store-reports/inventory-value")).toHaveLength(1);
    // No stock location is asked for: this store has none.
    expect(callsTo(calls, "GET", "/store-reports/inventory-value")[0].path).not.toContain("locationId");
  });

  it("names the reports in formal Arabic", async () => {
    fakeBackend({});
    renderWithProviders(<StoreReportPage />, { route: "/analytics/reports", path: "/analytics/reports/:report?", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "تقارير أخرى" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /أوقات الطلبات/ })).toBeInTheDocument();
  });
});

describe("customer groups (RFM)", () => {
  const overview: RfmOverview = {
    total: 40,
    computedAt: "2026-10-09T03:00:00.000Z",
    labels: [
      { label: "champions", customers: 8, spent: "4000000", avgOrders: 6.5 },
      { label: "at_risk", customers: 5, spent: "900000", avgOrders: 3 },
    ],
  };
  beforeEach(() => invalidateCached("rfm-overview:"));

  it("shows each group with its customers, and opens the group's own list", async () => {
    const calls = fakeBackend({ "GET /rfm": overview });
    renderWithProviders(<RfmGroupsTab />);
    expect(await screen.findByText("Champions")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Champions/ })).toHaveAttribute("href", "/customers?group=champions");
    expect(callsTo(calls, "GET", "/workspaces/ws_1/rfm")).toHaveLength(1);
  });

  it("names the groups in formal Arabic", async () => {
    fakeBackend({ "GET /rfm": overview });
    renderWithProviders(<RfmGroupsTab />, { locale: "ar" });
    expect(await screen.findByText("الأبطال")).toBeInTheDocument();
  });
});

describe("summary reports by email", () => {
  const settings: ScheduledReportSettings = {
    daily: { enabled: false, hour: 9 },
    weekly: { enabled: false, weekday: 0, hour: 9 },
    recipientUserIds: [],
    timeZone: "Africa/Cairo",
    members: [{ userId: "user_1", email: "owner@example.com", fullName: "Ziad", locale: "ar" }],
    lastSent: [],
  };

  it("reads the store's schedule and the members who may receive it", async () => {
    const calls = fakeBackend({ "GET /scheduled-reports": settings });
    renderWithProviders(<SummaryReportsSection />);
    expect(await screen.findByText("Summary reports by email")).toBeInTheDocument();
    expect(await screen.findByText("Daily report")).toBeInTheDocument();
    expect(screen.getByText("Weekly report")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/scheduled-reports")).toHaveLength(1);
    expect(callsTo(calls, "PUT", "/scheduled-reports")).toHaveLength(0);
  });
});

/** The Platform field is a list with the platforms' icons (components/IconSelect): opened, its options' spoken names in order. */
async function platformChoices(user: UserEvent, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("combobox", { name: /^Platform/ }));
  return within(screen.getByRole("listbox", { name: /^Platform/ }))
    .getAllByRole("option")
    .map((option) => {
      // The icons (a logo, or a letter in a circle) are hidden from screen readers.
      const copy = option.cloneNode(true) as Element;
      copy.querySelectorAll("[aria-hidden]").forEach((icon) => icon.remove());
      return copy.textContent;
    });
}

describe("the extra ad platforms' pixels", () => {
  const list = {
    pixels: [],
    platforms: [
      { name: "meta", capi: true, testEventCode: true },
      { name: "pinterest", capi: true, testEventCode: true, serverMode: "sandbox" },
      { name: "taboola", capi: false, testEventCode: false, serverMode: null },
    ],
  } as unknown as TrackingPixelList;

  it("offers Pinterest and Taboola beside the platforms the store already had", async () => {
    fakeBackend({ "GET /tracking-pixels": list });
    const { user } = renderWithProviders(<TrackingPixelsSection />);
    await user.click((await screen.findAllByRole("button", { name: "Add pixel" }))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(await platformChoices(user, dialog)).toEqual(["Meta (Facebook & Instagram)", "Pinterest", "Taboola"]);
  });

  it("asks Pinterest's ad account before its server events can be saved", async () => {
    const calls = fakeBackend({ "GET /tracking-pixels": list });
    const { user } = renderWithProviders(<TrackingPixelsSection />);
    await user.click((await screen.findAllByRole("button", { name: "Add pixel" }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: /^Platform/ }));
    await user.click(screen.getByRole("option", { name: "Pinterest" }));
    await user.type(within(dialog).getByPlaceholderText("2612345678901"), "2612345678901");
    await user.click(within(dialog).getByRole("switch", { name: /Conversions API/ }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled());
    expect(callsTo(calls, "POST", "/tracking-pixels")).toHaveLength(0);
  });
});
