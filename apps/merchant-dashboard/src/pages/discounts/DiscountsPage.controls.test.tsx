import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CouponReport, Discount } from "@store-builder/api-client";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DiscountsPage } from "./DiscountsPage";

/**
 * The coupon's controls (who, when, on what, limits), the sentence that says
 * the coupon in words, the list's expired / paused states, and each coupon's
 * report with its CSV file.
 */

const report = vi.hoisted(() => ({ get: vi.fn(), csv: vi.fn() }));

vi.mock("@store-builder/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@store-builder/api-client")>()),
  couponsReport: report.get,
  couponsReportCsv: report.csv,
}));

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
  api.listProducts.mockResolvedValue(fake({ products: [fake({ id: "p1", name: "Mug" }), fake({ id: "p2", name: "Cup" })], nextCursor: null }));
  api.listCollections.mockResolvedValue([fake({ id: "c1", name: "Summer" })]);
}

const card = (code: string) => screen.getByText(code).closest('[data-slot="list-row-card"]')?.querySelector("[data-row-open]") as HTMLElement;
const field = (dialog: HTMLElement, label: RegExp) => within(dialog).getByLabelText(label);

async function openNew(user: ReturnType<typeof renderWithProviders>["user"], name = "New code", title = "New discount") {
  await user.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog", { name: title });
}

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, slug: "nile", defaultCurrency: "EGP", settings: {} } });
  report.get.mockReset();
  report.csv.mockReset();
});

describe("the coupon's controls", () => {
  it("sends first order only, a minimum, a collection and the products left out — and no stackable", async () => {
    serve([discount({})]);
    api.createDiscount.mockResolvedValue(discount({ id: "d9", code: "WELCOME" }));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    const dialog = await openNew(user);
    await user.type(field(dialog, /^Code/), "welcome");
    await user.type(field(dialog, /^Percentage/), "10");
    await user.type(field(dialog, /^Maximum discount/), "50");
    await user.click(within(dialog).getByRole("radio", { name: "Specific collections" }));
    await user.click(await within(dialog).findByRole("checkbox", { name: "Summer" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Leave some products out" }));
    await user.click(await within(dialog).findByRole("checkbox", { name: "Mug" }));
    await user.click(within(dialog).getByRole("radio", { name: "First order only" }));
    await user.type(field(dialog, /^Minimum subtotal/), "300");
    await user.type(field(dialog, /^Minimum quantity/), "2");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));

    await waitFor(() => expect(api.createDiscount).toHaveBeenCalledTimes(1));
    const [workspaceId, payload] = api.createDiscount.mock.calls[0];
    expect(workspaceId).toBe("ws_1");
    expect(payload).toEqual({
      type: "percentage",
      status: "active",
      code: "WELCOME",
      value: 1000,
      minimumSubtotal: 30000,
      productRestrictions: [],
      collectionRestrictions: ["c1"],
      audience: "new",
      customerPhones: [],
      vipTierIds: [],
      schedule: null,
      maxDiscountAmount: 5000,
      minQuantity: 2,
      excludedProductIds: ["p1"],
      appliesToShipping: false,
      appliesToDiscounted: true,
      combinesWithOffers: true,
      strictCustomerLimit: true,
    });
    expect(payload).not.toHaveProperty("stackable");
  });

  it("starts a new coupon with the strict count on, and shows an existing one's own setting", async () => {
    serve([discount({ strictCustomerLimit: false })]);
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    const fresh = await openNew(user);
    expect(within(fresh).getByRole("switch", { name: /^Count the same e-mail and device/ })).toBeChecked();
    expect(within(fresh).getByText(/^One discount per order: a code the shopper types replaces the automatic discount\.$/)).toBeInTheDocument();
    expect(within(fresh).queryByText(/combined with other discounts/)).not.toBeInTheDocument();
    await user.click(within(fresh).getByRole("button", { name: "Cancel" }));

    await user.click(card("SAVE10"));
    const edit = await screen.findByRole("dialog", { name: "Edit discount" });
    expect(within(edit).getByRole("switch", { name: /^Count the same e-mail and device/ })).not.toBeChecked();
  });

  it("creates a coupon paused when its active switch is off, and sends the weekly hours", async () => {
    serve([discount({})]);
    api.createDiscount.mockResolvedValue(discount({ id: "d9" }));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    const dialog = await openNew(user);
    await user.type(field(dialog, /^Percentage/), "10");
    await user.click(within(dialog).getByRole("switch", { name: /^Active/ }));
    await user.click(within(dialog).getByRole("switch", { name: /^Only on certain days and hours/ }));
    for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]) {
      await user.click(within(dialog).getByRole("checkbox", { name: day }));
    }
    fireEvent.change(field(dialog, /^From$/), { target: { value: "22:00" } });
    fireEvent.change(field(dialog, /^To$/), { target: { value: "02:00" } });
    fireEvent.change(field(dialog, /^Start date/), { target: { value: "2026-11-01" } });
    fireEvent.change(field(dialog, /^End date/), { target: { value: "2026-11-30" } });
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));

    await waitFor(() => expect(api.createDiscount).toHaveBeenCalledTimes(1));
    expect(api.createDiscount.mock.calls[0][1]).toMatchObject({
      status: "disabled",
      schedule: { days: [5, 6], startMinute: 22 * 60, endMinute: 2 * 60 },
      startsAt: "2026-11-01",
      endsAt: "2026-11-30",
    });
  });

  it("refuses a phone list with something that is not a phone, and sends the numbers otherwise", async () => {
    serve([discount({})]);
    api.updateDiscount.mockResolvedValue(discount({}));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(card("SAVE10"));
    const dialog = await screen.findByRole("dialog", { name: "Edit discount" });
    const phones = field(dialog, /^Only these phone numbers/);
    await user.type(phones, "01012345678, hello");
    await user.click(within(dialog).getByRole("button", { name: "Save discount" }));
    expect(await within(dialog).findByText("“hello” is not a phone number.")).toBeInTheDocument();
    expect(api.updateDiscount).not.toHaveBeenCalled();

    await user.clear(phones);
    await user.type(phones, "01012345678{Enter}٠١١٢٢٣٣٤٤٥٥");
    await user.click(within(dialog).getByRole("button", { name: "Save discount" }));
    await waitFor(() => expect(api.updateDiscount).toHaveBeenCalledTimes(1));
    expect(api.updateDiscount.mock.calls[0][2]).toMatchObject({ customerPhones: ["01012345678", "01122334455"], strictCustomerLimit: false });
  });
});

describe("bulk codes", () => {
  it("send the same controls as one coupon, from «More rules»", async () => {
    serve([discount({})]);
    const calls = fakeBackend({ "POST /discounts/bulk": { count: 20, codes: ["A-1"] } });
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await user.click(screen.getByRole("button", { name: "Generate codes" }));
    const dialog = await screen.findByRole("dialog", { name: "Generate discount codes" });
    await user.click(within(dialog).getByRole("button", { name: /^More rules/ }));
    await user.click(within(dialog).getByRole("radio", { name: "Returning customers only" }));
    await user.type(field(dialog, /^Minimum quantity/), "3");
    await user.click(within(dialog).getByRole("button", { name: "Generate 20 codes" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/discounts/bulk")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/discounts/bulk")[0].body).toMatchObject({
      count: 20,
      type: "percentage",
      value: 1000,
      usageLimit: 1,
      audience: "existing",
      minQuantity: 3,
      strictCustomerLimit: true,
      schedule: null,
    });
  });
});

describe("the coupon in one sentence", () => {
  it("says what the form holds, as it changes", async () => {
    serve([discount({})]);
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    const dialog = await openNew(user);
    const sentence = within(dialog).getByRole("region", { name: "In short" });
    expect(sentence).toHaveTextContent("A discount on all products.");

    await user.type(field(dialog, /^Percentage/), "10");
    await user.type(field(dialog, /^Maximum discount/), "50");
    await user.click(within(dialog).getByRole("checkbox", { name: "Leave some products out" }));
    await user.click(await within(dialog).findByRole("checkbox", { name: "Mug" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Cup" }));
    await user.click(within(dialog).getByRole("radio", { name: "First order only" }));
    await user.click(within(dialog).getByRole("switch", { name: /^Only on certain days and hours/ }));
    for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]) {
      await user.click(within(dialog).getByRole("checkbox", { name: day }));
    }
    fireEvent.change(field(dialog, /^From$/), { target: { value: "18:00" } });
    fireEvent.change(field(dialog, /^To$/), { target: { value: "23:00" } });
    await user.type(field(dialog, /^Minimum subtotal/), "300");
    await user.type(field(dialog, /^Usage limit/), "100");
    await user.type(field(dialog, /^Per-customer limit/), "1");

    expect(sentence).toHaveTextContent(
      "10% off (up to EGP 50) on all products except 2 items, first order only, on Friday and Saturday from 6 PM to 11 PM, on orders of EGP 300 or more, for the first 100 uses, once per customer."
    );
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve([discount({})]);
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts", locale: "ar" });
    await screen.findByText("SAVE10");

    const dialog = await openNew(user, "كود جديد", "خصم جديد");
    await user.type(field(dialog, /^النسبة/), "10");
    await user.click(within(dialog).getByRole("radio", { name: "أول طلب فقط" }));
    await user.type(field(dialog, /^الحد لكل عميل/), "1");

    expect(within(dialog).getByRole("region", { name: "باختصار" })).toHaveTextContent("خصم 10% على كل المنتجات، لأول طلب فقط، مرة واحدة لكل عميل.");
  });
});

describe("the list's states", () => {
  it("counts a code whose uses are all taken as expired, and reads ?status=paused as the turned-off ones", async () => {
    serve([
      discount({}),
      discount({ id: "d2", code: "USEDUP", usageLimit: 3, usageCount: 3 }),
      discount({ id: "d3", code: "PAUSED", status: "disabled" }),
    ]);
    renderWithProviders(<DiscountsPage />, { route: "/discounts?status=paused" });

    expect(await screen.findByText("PAUSED")).toBeInTheDocument();
    expect(screen.queryByText("SAVE10")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Expired\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Active\s*1$/ })).toBeInTheDocument();
  });
});

describe("a coupon's report", () => {
  const data: CouponReport = {
    discount: { id: "d1", code: "SAVE10", type: "percentage", value: 1000, usageCount: 2, usageLimit: null },
    summary: { uses: 2, discountGiven: 3000, revenue: 40000, cancelled: 1, customers: 2 },
    uses: [
      {
        orderId: "o1",
        orderNumber: "1001",
        usedAt: "2026-10-20T10:00:00Z",
        discountAmount: 2000,
        orderTotal: 40000,
        currency: "EGP",
        orderState: "delivered",
        customerId: "c1",
        customerName: "Mona Ali",
        customerPhone: "01012345678",
        contactLocked: false,
      },
      {
        orderId: "o2",
        orderNumber: "1002",
        usedAt: "2026-10-21T10:00:00Z",
        discountAmount: 1000,
        orderTotal: 20000,
        currency: "EGP",
        orderState: "cancelled",
        customerId: "c2",
        customerName: "Omar",
        customerPhone: null,
        contactLocked: false,
      },
    ],
  };

  it("shows the summary and who used it, and downloads the server's CSV under the code's name", async () => {
    serve([discount({})]);
    report.get.mockResolvedValue(data);
    const blob = new Blob(["order_number\r\n1001\r\n"], { type: "text/csv" });
    report.csv.mockResolvedValue(blob);
    const created = vi.fn((_blob: Blob) => "blob:report");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });

    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");
    await user.click(card("SAVE10"));
    const sheet = await screen.findByRole("dialog", { name: "Edit discount" });
    await user.click(within(sheet).getByRole("button", { name: "Report" }));

    const dialog = await screen.findByRole("dialog", { name: "Report: SAVE10" });
    expect(report.get).toHaveBeenCalledWith(expect.anything(), "ws_1", "d1");
    expect(await within(dialog).findByText("Mona Ali")).toBeInTheDocument();
    const summary = dialog.querySelector('dl[aria-label="Summary"]') as HTMLElement;
    expect(within(summary).getByText("Uses").nextElementSibling).toHaveTextContent("2");
    expect(within(summary).getByText("Discount given").nextElementSibling).toHaveTextContent("EGP 30");
    expect(within(summary).getByText("Revenue").nextElementSibling).toHaveTextContent("EGP 400");
    expect(within(summary).getByText("Cancelled").nextElementSibling).toHaveTextContent("1");
    expect(within(dialog).getByRole("link", { name: "1001" })).toHaveAttribute("href", "/orders/o1");
    expect(within(dialog).getByText("Delivered")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(report.csv).toHaveBeenCalledWith(expect.anything(), "ws_1", "d1"));
    await waitFor(() => expect(names).toEqual(["coupon-SAVE10.csv"]));
    expect(created).toHaveBeenCalledWith(blob);
    click.mockRestore();
  });

  it("is in each discount's menu", async () => {
    serve([discount({})]);
    report.get.mockResolvedValue({ ...data, uses: [], summary: { uses: 0, discountGiven: 0, revenue: 0, cancelled: 0, customers: 0 } });
    renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    fireEvent.contextMenu(card("SAVE10"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Report" }));
    const dialog = await screen.findByRole("dialog", { name: "Report: SAVE10" });
    expect(await within(dialog).findByText("No order has used it yet.")).toBeInTheDocument();
  });
});
