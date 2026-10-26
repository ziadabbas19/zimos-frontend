import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Order, Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { KitchenTicketButton } from "./KitchenTicket";
import { esc, ticketHtml, type TicketContext } from "./kitchenTicketHtml";

const ORDER = fake<Order>({
  id: "o_1",
  orderNumber: "1043",
  createdAt: "2026-10-24T12:30:00.000Z",
  paymentMethod: "cod",
  financialState: "pending",
  currency: "EGP",
  subtotalAmount: "26000",
  shippingAmount: "3000",
  discountAmount: "1000",
  totalAmount: "28000",
  amountPaid: "0",
  deliveryMethod: "delivery",
  cancelledAt: null,
  notes: "<b>بدون بصل</b>",
  contactSnapshot: { fullName: '<img src=x onerror="alert(1)">', phone: "01012345678", email: "buyer@example.com" },
  shippingAddressSnapshot: { country: "EG", city: "Nasr City", addressLine: "5 Abbas El Akkad St" },
  items: [
    {
      id: "i_1",
      productNameSnapshot: "برجر",
      variantOptionsSnapshot: null,
      quantity: 2,
      lineTotalAmount: "26000",
      optionsSnapshot: [
        { groupName: "الحجم", choices: [{ name: "كبير", priceDeltaAmount: 3000 }] },
        { groupName: "إضافات", choices: [{ name: "جبنة", priceDeltaAmount: 1000 }] },
      ],
      customizations: [
        { fieldId: "msg", type: "text", label: { ar: "رسالة", en: "Message" }, value: "Happy <birthday>" },
        { fieldId: "pic", type: "image", label: { ar: "صورة", en: "Photo" }, uploadId: "6f0c2a8e-1d7b-4a55-9b1e-3f5a2c7d9e10" },
      ],
    },
  ],
});

const CONTEXT: TicketContext = {
  storeName: "Nile <Grill>",
  dir: "rtl",
  lang: "ar",
  words: {
    order: "طلب",
    delivery: "توصيل",
    pickup: "استلام من المتجر",
    notes: "ملاحظة",
    photo: "صورة في صفحة الطلب",
    subtotal: "المنتجات",
    shipping: "التوصيل",
    discount: "الخصم",
    total: "الإجمالي",
    paid: "مدفوع",
    toCollect: "المطلوب تحصيله",
    cancelled: "ملغي",
  },
  paymentMethod: "الدفع عند الاستلام",
  financial: "غير مدفوع",
  money: (minor) => (Number(minor) / 100).toFixed(2),
  date: () => "24 Oct 2026, 15:30",
};

describe("kitchen ticket", () => {
  it("holds the lines with their options and answers, the note, the totals and how it is paid", () => {
    const html = ticketHtml(ORDER, CONTEXT);
    expect(html).toContain("طلب #1043");
    expect(html).toContain("2×");
    expect(html).toContain("الحجم: كبير · إضافات: جبنة");
    expect(html).toContain("رسالة: Happy &lt;birthday&gt;");
    expect(html).toContain("صورة: صورة في صفحة الطلب");
    expect(html).toContain("ملاحظة: &lt;b&gt;بدون بصل&lt;/b&gt;");
    expect(html).toContain("280.00");
    expect(html).toContain("المطلوب تحصيله");
    expect(html).toContain("@page { size: 80mm auto");
  });

  it("escapes everything a shopper typed, and carries no phone, address, email, upload id or script", () => {
    const html = ticketHtml(ORDER, CONTEXT);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Nile &lt;Grill&gt;");
    expect(html).not.toContain("01012345678");
    expect(html).not.toContain("Abbas El Akkad");
    expect(html).not.toContain("buyer@example.com");
    expect(html).not.toContain("6f0c2a8e");
    expect(html).not.toMatch(/<script/i);
    expect(esc(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("leaves the customer's name and the note off a locked order, and keeps every line and the totals", () => {
    const locked = { ...ORDER, contactLocked: true, contactSnapshot: { fullName: "••••", phone: "••••", email: "••••" }, notes: "••••" } as Order;
    const html = ticketHtml(locked, CONTEXT);
    expect(html).not.toContain("••••");
    expect(html).not.toContain(CONTEXT.words.notes);
    for (const item of ORDER.items) expect(html).toContain(item.productNameSnapshot);
    expect(html).toContain(CONTEXT.money(ORDER.totalAmount, ORDER.currency));
  });

  it("is off for a locked order, saying why", () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    renderWithProviders(<KitchenTicketButton order={{ ...ORDER, contactLocked: true } as Order} />);
    const button = screen.getByRole("button", { name: /kitchen ticket|تذكرة المطبخ/i });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toBeTruthy();
  });

  it("prints from a frame that may run no script", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    const { user } = renderWithProviders(<KitchenTicketButton order={ORDER} />);
    await user.click(screen.getByRole("button", { name: "Kitchen ticket" }));
    const frame = document.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin allow-modals");
    expect(frame?.getAttribute("srcdoc")).toContain("#1043");
    frame?.remove();
  });
});
