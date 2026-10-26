import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type OrderExportCatalogue, type Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ExportAcceptedOrdersDialog } from "./ExportAcceptedOrders";

const CATALOGUE = fake<OrderExportCatalogue>({
  columns: [],
  defaults: { order: [], item: [] },
  maxOrders: 20000,
  presets: { accepted: { columns: ["orderNumber"] } },
  direct: { maxOrders: 2000, maxDays: 31 },
});

beforeEach(() => {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("export accepted orders", () => {
  it("downloads the accepted-orders preset for the dates and stage chosen", async () => {
    api.getOrderExportColumns.mockResolvedValue(CATALOGUE);
    api.exportOrdersCsv.mockResolvedValue(new Blob(["x"]));
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <ExportAcceptedOrdersDialog initial={{ from: "2026-10-01", to: "2026-10-20", stage: "delivered" }} onClose={onClose} />
    );
    expect(await screen.findByText(/Up to 31 days and 2,000 orders/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.exportOrdersCsv).toHaveBeenCalledWith("ws_1", {
      preset: "accepted",
      from: "2026-10-01",
      to: "2026-10-20",
      stage: "delivered",
      lang: "en",
      format: "csv",
    });
  });

  it("prepares the file in the background when the API says it is too large to download now", async () => {
    api.getOrderExportColumns.mockResolvedValue(CATALOGUE);
    api.exportOrdersCsv.mockRejectedValue(new ApiError("Too many", 413, "EXPORT_TOO_LARGE", null));
    const calls = fakeBackend({ "POST /exports/orders": { export: { id: "exp_1", status: "queued" } } });
    const onClose = vi.fn();
    const { user } = renderWithProviders(<ExportAcceptedOrdersDialog initial={{ from: "2026-01-01", to: "2026-10-20" }} onClose={onClose} />);
    await user.click(await screen.findByRole("button", { name: "Export" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/exports/orders")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/exports/orders")[0].body).toMatchObject({ preset: "accepted", from: "2026-01-01", to: "2026-10-20", format: "csv" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("offers nothing to an API that does not know the preset (it would export every order)", async () => {
    api.getOrderExportColumns.mockResolvedValue(fake<OrderExportCatalogue>({ columns: [], defaults: { order: [], item: [] }, maxOrders: 20000 }));
    api.exportOrdersCsv.mockClear();
    renderWithProviders(<ExportAcceptedOrdersDialog onClose={() => undefined} />);
    expect(await screen.findByText("This export is not available yet. Try again later.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(api.exportOrdersCsv).not.toHaveBeenCalled();
  });
});
