import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LostOrdersPage } from "./LostOrdersPage";

/**
 * The lost orders page: the month's figures, one toolbar, rows that open a
 * quick look. It makes the calls the old page made; what is new around them is
 * Undo on a status, a question before the store's WhatsApp template is sent,
 * and a Tools menu.
 */

const session = {
  id: "s1",
  status: "abandoned",
  lostReason: "incomplete",
  reviewStatus: "under_review",
  recoveryStatus: "not_contacted",
  customerName: "Mona Adel",
  phone: "0100***4567",
  email: null,
  shippingAddress: null,
  paymentMethod: "cod",
  items: [{ productId: "p1", name: "Headphones Pro", quantity: 2, unitPriceAmount: 45000 }],
  subtotalAmount: 90000,
  currency: "EGP",
  source: "store",
  ipAddress: null,
  ipCountry: "EG",
  recoveryPath: "/r/tok1",
  lastActivityAt: "2026-10-10T09:00:00Z",
  contactedAt: null,
  createdAt: "2026-10-10T08:40:00Z",
  convertedOrder: null,
};

const stats = {
  from: "2026-10-01",
  to: "2026-10-31",
  lost: 4,
  byReason: { incomplete: 4 },
  visits: 200,
  lostRate: 2,
  recovered: 1,
  recoveredAmount: "45000",
  currency: "EGP",
  abandonedAfterMinutes: 15,
};

function serve(extra: Record<string, unknown> = {}, whatsappConnected = false) {
  api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
  api.getWhatsappIntegration.mockResolvedValue(fake({ connected: whatsappConnected }));
  return fakeBackend({
    "GET /checkout-sessions": { sessions: [session], nextCursor: null, abandonedAfterMinutes: 15 },
    "GET /checkout-sessions/stats": stats,
    ...extra,
  });
}

const row = () => document.querySelector('[data-slot="lost-row"] td:nth-child(2)') as HTMLElement;

async function openTools(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.click(screen.getByRole("button", { name: /Tools/ }));
  return screen.findByRole("menu");
}

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, role: "owner", slug: "nile", settings: {} } });
});

describe("the lost orders page", () => {
  it("reads the list and the month's figures, as the old page did", async () => {
    const calls = serve();
    renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });

    expect(await screen.findByText("Mona Adel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lost orders" })).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/checkout-sessions")).toHaveLength(1);
    expect(callsTo(calls, "GET", "/checkout-sessions/stats")).toHaveLength(1);
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
    for (const tab of ["All", "Under review", "Reviewed", "Won back"]) expect(screen.getByRole("button", { name: tab })).toBeInTheDocument();
  });

  it("keeps the abandon-after tool out of the Tools menu while its switch is off, and exports CSV", async () => {
    const calls = serve({ "POST /checkout-sessions/export": { csv: "name,phone\n", count: 1, filename: "lost-orders.csv" } });
    URL.createObjectURL = () => "blob:lost";
    URL.revokeObjectURL = () => undefined;
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });
    await screen.findByText("Mona Adel");

    const menu = await openTools(user);
    const items = within(menu).getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual([expect.stringContaining("Refresh the list"), expect.stringContaining("Select orders"), "Export as CSV"]);

    await user.click(within(menu).getByRole("menuitem", { name: "Export as CSV" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/checkout-sessions/export")).toHaveLength(1));
    // The filters in effect, and no file format: this API writes CSV.
    expect(callsTo(calls, "POST", "/checkout-sessions/export")[0].body).toEqual({ tab: "all" });
    expect(await screen.findByText("1 lost order exported.")).toBeInTheDocument();
  });

  it("marks a lost order contacted from its quick look, and takes that back with the same call", async () => {
    const calls = serve({
      "PATCH /checkout-sessions/s1": ({ body }: { body?: unknown }) => ({ session: { ...session, ...(body as object) } }),
    });
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });
    await screen.findByText("Mona Adel");

    await user.click(row());
    const peek = await screen.findByRole("dialog");
    await user.click(within(peek).getByRole("button", { name: "Contacted" }));
    await waitFor(() => expect(callsTo(calls, "PATCH", "/checkout-sessions/s1")).toHaveLength(1));
    expect(callsTo(calls, "PATCH", "/checkout-sessions/s1")[0].body).toEqual({ recoveryStatus: "contacted" });

    // The toast lies outside the open quick look, which hides the rest of the page from assistive tech.
    await user.click(await screen.findByRole("button", { name: "Undo", hidden: true }));
    await waitFor(() => expect(callsTo(calls, "PATCH", "/checkout-sessions/s1")).toHaveLength(2));
    expect(callsTo(calls, "PATCH", "/checkout-sessions/s1")[1].body).toEqual({ recoveryStatus: "not_contacted" });
  });

  it("deletes only after asking", async () => {
    const calls = serve({ "DELETE /checkout-sessions/s1": {} });
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });
    await screen.findByText("Mona Adel");

    await user.click(row());
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(callsTo(calls, "DELETE", "/checkout-sessions/s1")).toHaveLength(0);

    const question = await screen.findByRole("dialog", { name: "Delete the lost order of Mona Adel?" });
    await user.click(within(question).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/checkout-sessions/s1")).toHaveLength(1));
  });

  it("asks before the store's WhatsApp sends its recovery message, and sends it once", async () => {
    const calls = serve({ "POST /checkout-sessions/s1/whatsapp": { session: { ...session, recoveryStatus: "contacted" } } }, true);
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts" });
    await screen.findByText("Mona Adel");

    await user.click(await screen.findByRole("button", { name: "Send the store's recovery message to Mona Adel on WhatsApp" }));
    const ask = await screen.findByRole("dialog", { name: "Send the recovery message?" });
    expect(callsTo(calls, "POST", "/whatsapp")).toHaveLength(0);

    await user.click(within(ask).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/checkout-sessions/s1/whatsapp")).toHaveLength(1));
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve();
    const { user } = renderWithProviders(<LostOrdersPage />, { route: "/abandoned-carts", locale: "ar" });
    expect(await screen.findByText("Mona Adel")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "الطلبات المفقودة" })).toBeInTheDocument();
    await user.click(row());
    const peek = await screen.findByRole("dialog");
    expect(within(peek).getByRole("button", { name: "تحويل إلى طلب" })).toBeInTheDocument();
    expect(within(peek).getByRole("button", { name: "تم التواصل" })).toBeInTheDocument();
  });
});
