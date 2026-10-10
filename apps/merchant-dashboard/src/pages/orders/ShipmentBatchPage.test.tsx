import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { ShipmentBatch } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ExportFilePage } from "../exports/ExportFilePage";
import { ShipmentBatchPage } from "./ShipmentBatchPage";

/** A courier booking of several orders: how far it got, what each order came to, and the ones to send again. */

const batch = fake<ShipmentBatch>({
  id: "b1",
  carrierCode: "bosta",
  status: "done",
  notes: null,
  createdBy: null,
  createdAt: "2026-10-09T10:00:00Z",
  startedAt: "2026-10-09T10:00:05Z",
  finishedAt: "2026-10-09T10:01:00Z",
  counts: { total: 3, pending: 0, booked: 2, failed: 1 },
  items: [
    { orderId: "o1", orderNumber: "#101", status: "booked", waybillNumber: "WB-1", shipmentId: "s1", errorCode: null, errorMessage: null, attempts: 1, updatedAt: "2026-10-09T10:00:20Z" },
    { orderId: "o2", orderNumber: "#102", status: "booked", waybillNumber: "WB-2", shipmentId: "s2", errorCode: null, errorMessage: null, attempts: 1, updatedAt: "2026-10-09T10:00:40Z" },
    { orderId: "o3", orderNumber: "#103", status: "failed", waybillNumber: null, shipmentId: null, errorCode: "CARRIER_REJECTED", errorMessage: "The courier refused the phone number", attempts: 1, updatedAt: "2026-10-09T10:01:00Z" },
  ],
});

function serveBatch() {
  api.listCarriers.mockResolvedValue(fake({ carriers: [{ code: "bosta", name: "Bosta" }] }));
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (path === "/workspaces/ws_1/shipment-batches/b1" && !init?.method) return { batch };
    if (path === "/workspaces/ws_1/shipment-batches/b1/retry" && init?.method === "POST") return { batch: { ...batch, status: "running" } };
    return new Promise(() => undefined);
  });
}

afterEach(() => {
  api.request.mockReset();
});

describe("a courier booking", () => {
  it("says how the booking ended and what each order came to", async () => {
    serveBatch();
    renderWithProviders(<ShipmentBatchPage />, { route: "/orders/shipment-batches/b1", path: "/orders/shipment-batches/:batchId" });

    expect(await screen.findByText("Finished. Still without a booking: 1 order.")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Open order #101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WB-2").length).toBeGreaterThan(0);
    // The refused order says why, in the courier's own words.
    expect(screen.getAllByText("The courier refused the phone number").length).toBeGreaterThan(0);
  });

  it("sends the orders that were not booked again, and only when asked", async () => {
    serveBatch();
    const { user } = renderWithProviders(<ShipmentBatchPage />, { route: "/orders/shipment-batches/b1", path: "/orders/shipment-batches/:batchId" });

    await user.click(await screen.findByRole("button", { name: "Send 1 order again" }));
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/shipment-batches/b1/retry", expect.objectContaining({ method: "POST" }))
    );
  });

  it("reads in the dashboard's own Arabic", async () => {
    serveBatch();
    renderWithProviders(<ShipmentBatchPage />, { route: "/orders/shipment-batches/b1", path: "/orders/shipment-batches/:batchId", locale: "ar" });

    expect(await screen.findByText(/انتهى\. ما زال بدون حجز/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("فتح الطلب #101").length).toBeGreaterThan(0);
  });
});

describe("an exported file", () => {
  const ready = { id: "x1", kind: "orders", format: "csv", status: "done", fileName: "orders-2026-10-09.csv", sizeBytes: 20480, errorMessage: null, createdAt: "2026-10-09T10:00:00Z", completedAt: "2026-10-09T10:00:30Z", expiresAt: "2026-10-16T10:00:30Z" };

  function serveFile(file: Record<string, unknown>) {
    api.request.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/workspaces/ws_1/exports/x1" && !init?.method) return { export: file };
      return new Promise(() => undefined);
    });
  }

  it("names the ready file, its size, and offers the download", async () => {
    serveFile(ready);
    renderWithProviders(<ExportFilePage />, { route: "/exports/x1", path: "/exports/:exportId" });

    expect(await screen.findByRole("heading", { name: "orders-2026-10-09.csv" })).toBeInTheDocument();
    expect(screen.getByText(/20 KB/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download the file" })).toBeEnabled();
  });

  it("says a failed export failed and sends the merchant back to the orders", async () => {
    serveFile({ ...ready, status: "failed", fileName: null, sizeBytes: null, errorMessage: "Too many rows" });
    renderWithProviders(<ExportFilePage />, { route: "/exports/x1", path: "/exports/:exportId" });

    expect(await screen.findByRole("heading", { name: "The file couldn't be prepared" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download the file" })).not.toBeInTheDocument();
    expect(screen.getByText("Go to orders").closest("a")).toHaveAttribute("href", "/orders");
  });
});
