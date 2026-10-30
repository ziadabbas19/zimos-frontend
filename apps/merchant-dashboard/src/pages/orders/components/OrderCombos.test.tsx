import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Order } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EditItemsButton } from "./EditItemsDialog";
import { OrderDiscountsCard } from "./OrderDiscountsCard";
import { OrderSummary } from "./OrderSummary";

/** As the screen reads once its spaces are made plain (Intl puts a no-break space after the currency). */
const money = (minor: number) => formatMoney(minor, "EGP").replace(/\s+/g, " ");

const line = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  orderId: "o1",
  productId: `p-${id}`,
  variantId: `v-${id}`,
  offerId: null,
  productNameSnapshot: name,
  variantOptionsSnapshot: null,
  skuSnapshot: null,
  offerNameSnapshot: null,
  quantity: 1,
  unitPriceAmount: "10000",
  unitCostAmount: null,
  lineDiscountAmount: "0",
  lineTotalAmount: "10000",
  isOrderBump: false,
  isUpsell: false,
  comboId: null,
  comboKey: null,
  comboNameSnapshot: null,
  ...extra,
});

const inCombo = { comboId: "c1", comboKey: "k1", comboNameSnapshot: "Morning set", lineDiscountAmount: "2500", lineTotalAmount: "7500" };

const order = (items: unknown[], extra: Record<string, unknown> = {}) =>
  fake<Order>({
    id: "o1",
    orderNumber: "A-1",
    currency: "EGP",
    items,
    subtotalAmount: "30000",
    discountAmount: "0",
    shippingAmount: "0",
    taxAmount: "0",
    totalAmount: "25000",
    amountPaid: "0",
    amountRefunded: "0",
    contactSnapshot: { fullName: "Mona Adel", phone: "01000000000" },
    shippingAddressSnapshot: null,
    paymentMethod: "cod",
    notes: null,
    riskFlags: [],
    discountsSnapshot: [],
    cancelledAt: null,
    confirmationState: "pending",
    financialState: "pending",
    fulfillmentState: "unfulfilled",
    shipments: [],
    ...extra,
  });

describe("an order that holds a combo", () => {
  it("lists the combo's lines under its name, with what the combo saved", () => {
    renderWithProviders(<OrderSummary order={order([line("a", "Mug", inCombo), line("b", "Notebook"), line("c", "T-shirt", inCombo)])} />);

    const heading = screen.getByText("Combo: Morning set");
    expect(heading.closest("th")).toHaveAttribute("scope", "rowgroup");
    const group = heading.closest("tbody") as HTMLElement;
    expect(within(group).getByText(`Combo saving: − ${money(5000)}`)).toBeInTheDocument();
    // Both of its lines sit under it, though another line came between them; that line does not.
    expect(within(group).getByText("Mug")).toBeInTheDocument();
    expect(within(group).getByText("T-shirt")).toBeInTheDocument();
    expect(within(group).queryByText("Notebook")).not.toBeInTheDocument();
    expect(screen.getByText("Notebook")).toBeInTheDocument();
  });

  it("changes nothing for an order without a combo", () => {
    const { container } = renderWithProviders(<OrderSummary order={order([line("a", "Mug"), line("b", "Notebook")])} />);
    expect(screen.queryByText(/^Combo/)).not.toBeInTheDocument();
    expect(container.querySelectorAll("tbody")).toHaveLength(1);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("names the combo's saving in the discounts", () => {
    renderWithProviders(
      <OrderDiscountsCard order={order([], { discountsSnapshot: [{ kind: "combo", comboId: "c1", key: "k1", name: "Morning set", count: 1, amount: 5000 }] })} />
    );
    expect(screen.getByText("Combo saving: Morning set")).toBeInTheDocument();
    expect(screen.getByText("Already taken off the item prices above.")).toBeInTheDocument();
  });

  it("does not offer to edit its items, and says why", () => {
    renderWithProviders(<EditItemsButton order={order([line("a", "Mug", inCombo), line("c", "T-shirt", inCombo)])} onChanged={() => undefined} />);
    expect(screen.getByRole("button", { name: "Edit items" })).toBeDisabled();
    expect(screen.getByText("Holds a combo: cancel and place it again to change its items.")).toBeInTheDocument();
  });

  it("still offers to edit the items of an order without a combo", () => {
    renderWithProviders(<EditItemsButton order={order([line("a", "Mug")])} onChanged={() => undefined} />);
    expect(screen.getByRole("button", { name: "Edit items" })).toBeEnabled();
    expect(screen.queryByText(/Holds a combo/)).not.toBeInTheDocument();
  });

  it("is in formal Arabic", () => {
    renderWithProviders(<OrderSummary order={order([line("a", "Mug", inCombo), line("c", "T-shirt", inCombo)])} />, { locale: "ar" });
    expect(screen.getByText("باقة: Morning set")).toBeInTheDocument();
  });
});
