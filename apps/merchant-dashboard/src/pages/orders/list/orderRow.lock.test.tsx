import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Order } from "@store-builder/api-client";
import { fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { useOrderRowViews } from "./orderRow";

// A locked order (locked orders on) in the orders list: said as hidden, with
// the Locked chip, the governorate only, and nothing to dial.

function Rows({ orders }: { orders: Order[] }) {
  const views = useOrderRowViews(orders);
  return (
    <ul>
      {views.map((v) => (
        <li key={v.order.id} data-testid={v.order.id}>
          <span>{v.name}</span>
          <span>{v.place}</span>
          <span>{v.phone ?? "no-phone"}</span>
          {v.flags.map((f) => (
            <span key={f.id} title={f.title}>
              {f.label}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

const base = {
  paymentMethod: "cod",
  totalAmount: "25000",
  currency: "EGP",
  riskFlags: [],
  items: [],
  tags: [],
};

describe("useOrderRowViews and locked orders", () => {
  it("hides a locked order's customer and keeps a visible one as it was", () => {
    const locked = fake<Order>({
      ...base,
      id: "o_locked",
      contactLocked: true,
      lockReason: "subscription",
      contactSnapshot: { fullName: "••••", phone: "••••" },
      shippingAddressSnapshot: { country: "EG", province: "Giza", city: "••••", addressLine: "••••" },
    });
    const open = fake<Order>({
      ...base,
      id: "o_open",
      contactLocked: false,
      contactSnapshot: { fullName: "Mona Ali", phone: "01012345678" },
      shippingAddressSnapshot: { country: "EG", province: "Cairo", city: "Nasr City", addressLine: "1 St" },
    });
    renderWithProviders(<Rows orders={[locked, open]} />);

    const hidden = screen.getByTestId("o_locked");
    expect(hidden).toHaveTextContent("Customer details hidden");
    expect(hidden).toHaveTextContent("Giza");
    expect(hidden).not.toHaveTextContent("••••");
    expect(hidden).toHaveTextContent("no-phone");
    expect(screen.getByTitle("Customer details hidden: your subscription has expired.")).toHaveTextContent("Locked");

    const shown = screen.getByTestId("o_open");
    expect(shown).toHaveTextContent("Mona Ali");
    expect(shown).not.toHaveTextContent("Locked");
  });
});
