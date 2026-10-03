import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type OrderExportCatalogue, type Workspace } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrdersListPage } from "../OrdersListPage";

function catalogue(canRevealSensitive: boolean): OrderExportCatalogue {
  const col = (key: string, en: string, ar: string, extra: { perItem?: boolean; sensitive?: boolean } = {}) => ({
    key,
    label: { en, ar },
    perItem: Boolean(extra.perItem),
    sensitive: Boolean(extra.sensitive),
    available: canRevealSensitive || !extra.sensitive,
  });
  return {
    columns: [
      col("orderNumber", "Order number", "رقم الطلب"),
      col("customerName", "Customer", "العميل"),
      col("phone", "Phone", "الهاتف", { sensitive: true }),
      col("total", "Total", "الإجمالي"),
      col("productName", "Product", "المنتج", { perItem: true }),
    ],
    defaults: {
      order: canRevealSensitive ? ["orderNumber", "customerName", "phone", "total"] : ["orderNumber", "customerName", "total"],
      item: ["orderNumber", "productName"],
    },
    maxRows: 10000,
    canRevealSensitive,
  };
}

const exportCalls = () => api.request.mock.calls.filter(([path]) => /\/orders\/export\?/.test(String(path)));

function serve({ canReveal = true, file = async () => "﻿Order number\r\nZM-1\r\n" as string } = {}) {
  api.request.mockImplementation(async (path: string) => {
    if (path === "/workspaces/ws_1/orders/export/columns") return catalogue(canReveal);
    if (path.startsWith("/workspaces/ws_1/orders/export?")) return file();
    return new Promise(() => undefined);
  });
  api.getOrderPipeline.mockResolvedValue(fake({ stages: {}, total: 0 }));
  api.listOrders.mockResolvedValue({ orders: [], nextCursor: null });
}

let createObjectURL: ReturnType<typeof vi.fn>;
beforeEach(() => {
  createObjectURL = vi.fn(() => "blob:orders");
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Orders CSV export", () => {
  it("downloads the file with the list's filters and the chosen shape, language and columns", async () => {
    serve();
    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders?stage=cancelled&from=2026-09-01&to=2026-09-30" });

    await user.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(await screen.findByRole("dialog", { name: "Export orders" })).toBeInTheDocument();
    // Defaults ticked, the per-line column hidden on a row-per-order file.
    expect(screen.getByRole("checkbox", { name: "Phone" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Product" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Customer" }));
    await user.click(screen.getByRole("radio", { name: "Arabic" }));
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    const params = new URL(`http://x${exportCalls()[0][0]}`).searchParams;
    expect(params.get("columns")).toBe("orderNumber,phone,total");
    expect(params.get("rowPer")).toBe("order");
    expect(params.get("lang")).toBe("ar");
    expect(params.get("stage")).toBe("cancelled");
    expect(params.get("from")).toBe("2026-09-01");
    expect(params.get("to")).toBe("2026-09-30");
    expect(params.get("sort")).toBe("newest");
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    // The dialog closes once the file is on its way.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("locks the contact columns without the permission to see them", async () => {
    serve({ canReveal: false });
    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders" });
    await user.click(await screen.findByRole("button", { name: "Export CSV" }));
    const phone = await screen.findByRole("checkbox", { name: /Phone/ });
    expect(phone).toBeDisabled();
    expect(phone).not.toBeChecked();
    expect(screen.getAllByText("Needs permission to see customers' contact details").length).toBeGreaterThan(0);
  });

  it("explains an export over the row ceiling", async () => {
    serve({
      file: async () => {
        throw new ApiError("too large", 422, "EXPORT_TOO_LARGE", {
          error: { code: "EXPORT_TOO_LARGE", details: { rows: 12500, maxRows: 10000 } },
        });
      },
    });
    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders" });
    await user.click(await screen.findByRole("button", { name: "Export CSV" }));
    await user.click(await screen.findByRole("button", { name: "Download CSV" }));
    expect(
      await screen.findByText("This export has 12500 rows, and a file holds up to 10000. Narrow the dates or filters and try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows no export button to a system role without orders.export", async () => {
    serve();
    renderWithProviders(<OrdersListPage />, {
      route: "/orders",
      workspace: { currentWorkspace: fake<Workspace>({ ...testWorkspace, role: "order_operator" }) },
    });
    await waitFor(() => expect(api.listOrders).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
  });

  it("explains a refusal from the server", async () => {
    api.request.mockImplementation(async (path: string) => {
      if (path === "/workspaces/ws_1/orders/export/columns") throw new ApiError("Missing required permission: orders.export", 403, "FORBIDDEN");
      return new Promise(() => undefined);
    });
    api.getOrderPipeline.mockResolvedValue(fake({ stages: {}, total: 0 }));
    api.listOrders.mockResolvedValue({ orders: [], nextCursor: null });
    const { user } = renderWithProviders(<OrdersListPage />, {
      route: "/orders",
      workspace: { currentWorkspace: fake<Workspace>({ ...testWorkspace, role: "custom_role" }) },
    });
    await user.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(await screen.findByText(/You don't have permission to export orders/)).toBeInTheDocument();
  });

  it("speaks Arabic", async () => {
    serve();
    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders", locale: "ar" });
    await user.click(await screen.findByRole("button", { name: "تصدير CSV" }));
    expect(await screen.findByRole("dialog", { name: "تصدير الطلبات" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "الهاتف" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تنزيل ملف CSV" })).toBeInTheDocument();
  });
});
