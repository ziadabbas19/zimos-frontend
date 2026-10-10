import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { api, fake, testWorkspace } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { PaymentsPage } from "../payments/PaymentsPage";
import { ShippingTaxPage } from "./ShippingTaxPage";

/**
 * /shipping and /payments in the settings layout: a list of sections and one
 * section in the pane. The sections are the ones the pages had, at the
 * addresses they had.
 */

const owner = { currentWorkspace: { ...testWorkspace, role: "owner" } };

describe("the shipping page", () => {
  it("lists its four sections, each with what it holds", async () => {
    renderWithProviders(<ShippingTaxPage />, { route: "/shipping", workspace: owner });

    const list = await screen.findByRole("navigation", { name: "Shipping & Tax: sections" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("Shipping prices"),
      expect.stringContaining("Shipping options"),
      expect.stringContaining("Shipping companies"),
      expect.stringContaining("Taxes"),
    ]);
  });

  it("opens the section its address names, as the old tabs did", async () => {
    renderWithProviders(<ShippingTaxPage />, { route: "/shipping?tab=carriers", workspace: owner });

    const list = await screen.findByRole("navigation", { name: "Shipping & Tax: sections" });
    expect(within(list).getByRole("button", { current: "page" })).toHaveTextContent("Shipping companies");
    expect(screen.getByRole("heading", { name: "Shipping companies", level: 2 })).toBeInTheDocument();
  });

  it("keeps the section in the address when another is chosen", async () => {
    const { user } = renderWithProviders(<ShippingTaxPage />, { route: "/shipping", workspace: owner });

    const list = await screen.findByRole("navigation", { name: "Shipping & Tax: sections" });
    await user.click(within(list).getByRole("button", { name: /Taxes/ }));
    expect(currentPath()).toBe("/shipping?tab=taxes");
    expect(await screen.findByRole("heading", { name: "Taxes", level: 2 })).toBeInTheDocument();
  });

  it("names the sections in the dashboard's own Arabic", async () => {
    renderWithProviders(<ShippingTaxPage />, { route: "/shipping", workspace: owner, locale: "ar" });

    const list = await screen.findByRole("navigation", { name: "أقسام الشحن والضرائب" });
    expect(list).toHaveTextContent("أسعار الشحن");
    expect(list).toHaveTextContent("شركات الشحن التي يحجز متجرك شحناته معها.");
  });
});

describe("the payments page", () => {
  const gateways = { configured: true, onlineEnabled: true, gateways: [] };
  const methods = { methods: [{ id: "cod", kind: "cod", gateway: null, enabled: true, available: true }] };

  function serve() {
    api.listPaymentGateways.mockResolvedValue(fake(gateways));
    api.listPaymentMethods.mockResolvedValue(fake(methods));
  }

  it("has a section for the store's own numbers, one for the gateways and one for the checkout's methods", async () => {
    serve();
    renderWithProviders(<PaymentsPage />, { route: "/payments", workspace: owner });

    const list = await screen.findByRole("navigation", { name: "Payments: sections" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("InstaPay and wallets"),
      expect.stringContaining("Gateways"),
      expect.stringContaining("Checkout methods"),
    ]);
  });

  it("opens the checkout's methods at their own address", async () => {
    serve();
    renderWithProviders(<PaymentsPage />, { route: "/payments?tab=methods", workspace: owner });

    const list = await screen.findByRole("navigation", { name: "Payments: sections" });
    expect(within(list).getByRole("button", { current: "page" })).toHaveTextContent("Checkout methods");
    expect(await screen.findByRole("button", { name: "Save methods" })).toBeInTheDocument();
  });

  it("tells a role with no payment access so, and asks the API for nothing", () => {
    serve();
    renderWithProviders(<PaymentsPage />, { route: "/payments", workspace: { currentWorkspace: { ...testWorkspace, role: "confirmation_agent" } } });

    expect(screen.getByText("Only the store owner or a workspace manager can manage payments.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Payments: sections" })).not.toBeInTheDocument();
    expect(api.listPaymentGateways).not.toHaveBeenCalled();
  });
});
