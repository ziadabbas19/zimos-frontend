import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Discount } from "@store-builder/api-client";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DiscountsPage } from "./DiscountsPage";

/**
 * The discount codes tab of the offers hub. The list, the form in a sheet and
 * the share link are new; what is sent to the API is what the old form sent,
 * plus the three numbers a "buy X get Y" discount needs to work at all.
 */

function discount(over: Partial<Discount>): Discount {
  return fake<Discount>({
    id: "d1",
    workspaceId: "ws_1",
    code: "SAVE10",
    type: "percentage",
    value: "1000",
    buyXGetYConfig: null,
    minimumSubtotal: null,
    productRestrictions: [],
    collectionRestrictions: [],
    customerRestrictions: [],
    funnelRestrictions: [],
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    usageCount: 3,
    stackable: false,
    status: "active",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    ...over,
  });
}

function serve(list: Discount[]) {
  api.listDiscounts.mockResolvedValue(list);
  api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
}

/** The card of a discount: a press opens its sheet. */
const card = (code: string) => screen.getByText(code).closest('[data-slot="list-row-card"]')?.querySelector("[data-row-open]") as HTMLElement;
const field = (dialog: HTMLElement, label: RegExp) => within(dialog).getByLabelText(label);

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, slug: "nile", defaultCurrency: "EGP", settings: {} } });
});

describe("the discount codes tab", () => {
  it("sits in the offers hub and lists the codes with their status counts", async () => {
    serve([discount({}), discount({ id: "d2", code: "OLD5", status: "disabled", value: "500" }), discount({ id: "d3", code: null, type: "free_shipping", value: null })]);
    renderWithProviders(<DiscountsPage />, { route: "/discounts" });

    expect(await screen.findByText("SAVE10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discount codes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(screen.getByText("OLD5")).toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Active\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Disabled\s*1$/ })).toBeInTheDocument();
  });

  it("asks nothing about results while the store reports switch is off", async () => {
    serve([discount({})]);
    renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    expect(api.request.mock.calls.filter(([path]) => String(path).includes("store-reports"))).toHaveLength(0);
    expect(screen.queryByText(/Results for/)).not.toBeInTheDocument();
  });

  it("creates a percentage code with exactly what the old form sent", async () => {
    serve([discount({})]);
    api.createDiscount.mockResolvedValue(discount({ id: "d9", code: "EID15", value: "1500" }));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(screen.getByRole("button", { name: "New code" }));
    const dialog = await screen.findByRole("dialog", { name: "New discount" });
    await user.type(field(dialog, /^Code/), "eid15");
    await user.type(field(dialog, /^Percentage/), "15");
    await user.type(field(dialog, /^Minimum subtotal/), "200");
    await user.type(field(dialog, /^Usage limit/), "50");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));

    await waitFor(() => expect(api.createDiscount).toHaveBeenCalledTimes(1));
    expect(api.createDiscount).toHaveBeenCalledWith("ws_1", {
      type: "percentage",
      stackable: false,
      productRestrictions: [],
      code: "EID15",
      value: 1500,
      minimumSubtotal: 20000,
      usageLimit: 50,
    });
  });

  it("saves an edited fixed discount with every key, cleared ones as null", async () => {
    const saved = discount({ type: "fixed", value: "5000", minimumSubtotal: "30000", usageLimit: 10 });
    serve([saved]);
    api.updateDiscount.mockResolvedValue(saved);
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(card("SAVE10"));
    const dialog = await screen.findByRole("dialog", { name: "Edit discount" });
    const amount = field(dialog, /^Amount off/) as HTMLInputElement;
    expect(amount.value).toMatch(/^50(\.00)?$/);
    await user.clear(amount);
    await user.type(amount, "75");
    await user.clear(field(dialog, /^Usage limit/));
    await user.click(within(dialog).getByRole("button", { name: "Save discount" }));

    await waitFor(() => expect(api.updateDiscount).toHaveBeenCalledTimes(1));
    expect(api.updateDiscount).toHaveBeenCalledWith("ws_1", "d1", {
      type: "fixed",
      code: "SAVE10",
      value: 7500,
      minimumSubtotal: 30000,
      productRestrictions: [],
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      perCustomerLimit: null,
      stackable: false,
    });
  });

  it("sends the three numbers of a buy X get Y discount, and nothing when one of them is wrong", async () => {
    serve([discount({})]);
    api.createDiscount.mockResolvedValue(discount({ id: "d9", code: "B2G1", type: "buy_x_get_y", value: null }));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(screen.getByRole("button", { name: "New code" }));
    const dialog = await screen.findByRole("dialog", { name: "New discount" });
    await user.type(field(dialog, /^Code/), "b2g1");
    await user.selectOptions(field(dialog, /^Type/), "buy_x_get_y");

    const buy = field(dialog, /^Units to buy/);
    await user.clear(buy);
    await user.type(buy, "0");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));
    expect(await within(dialog).findByText("Enter a whole number from 1 to 1000.")).toBeInTheDocument();
    expect(api.createDiscount).not.toHaveBeenCalled();

    await user.clear(buy);
    await user.type(buy, "3");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));
    await waitFor(() => expect(api.createDiscount).toHaveBeenCalledTimes(1));
    expect(api.createDiscount).toHaveBeenCalledWith("ws_1", {
      type: "buy_x_get_y",
      stackable: false,
      productRestrictions: [],
      code: "B2G1",
      buyXGetYConfig: { buyQuantity: 3, getQuantity: 1, getDiscountBasisPoints: 10000 },
    });
  });

  it("turns a discount off from its sheet and takes that back with the same call", async () => {
    serve([discount({})]);
    api.setDiscountStatus.mockResolvedValue(discount({ status: "disabled" }));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(card("SAVE10"));
    const dialog = await screen.findByRole("dialog", { name: "Edit discount" });
    await user.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(api.setDiscountStatus).toHaveBeenCalledWith("ws_1", "d1", "disabled"));

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(api.setDiscountStatus).toHaveBeenLastCalledWith("ws_1", "d1", "active"));
  });

  it("archives only after asking", async () => {
    serve([discount({})]);
    api.deleteDiscount.mockResolvedValue(fake({}));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(card("SAVE10"));
    const dialog = await screen.findByRole("dialog", { name: "Edit discount" });
    await user.click(within(dialog).getByRole("button", { name: "Archive…" }));
    expect(api.deleteDiscount).not.toHaveBeenCalled();

    const question = await screen.findByRole("dialog", { name: "Archive “SAVE10”?" });
    await user.click(within(question).getByRole("button", { name: "Archive discount" }));
    await waitFor(() => expect(api.deleteDiscount).toHaveBeenCalledWith("ws_1", "d1"));
  });

  it("gives a share link on the store's own address that carries the code", async () => {
    serve([discount({})]);
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(card("SAVE10"));
    const dialog = await screen.findByRole("dialog", { name: "Edit discount" });
    await user.click(within(dialog).getByRole("button", { name: "Share link" }));

    const sheet = await screen.findByRole("dialog", { name: "Share link for SAVE10" });
    const link = (await within(sheet).findByLabelText("Link")) as HTMLInputElement;
    expect(link.value).toMatch(/^https:\/\/nile\.[^/]+\/\?coupon=SAVE10$/);
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve([discount({})]);
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts", locale: "ar" });
    await screen.findByText("SAVE10");

    expect(screen.getByRole("button", { name: "كود جديد" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^مفعّل/ })).toBeInTheDocument();
    await user.click(card("SAVE10"));
    const dialog = await screen.findByRole("dialog", { name: "تعديل الخصم" });
    expect(within(dialog).getByRole("button", { name: "رابط المشاركة" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "حفظ الخصم" })).toBeInTheDocument();
  });
});
