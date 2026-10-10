import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { api, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { WaBotPage } from "../inbox/WaBotPage";
import { ProfitCostsPage } from "./ProfitCostsPage";

/**
 * Two settings pages that save from one bar: what an order costs, and the
 * WhatsApp bot. They make the calls they made before.
 */

interface Init {
  method?: string;
  body?: unknown;
}

function serve(answer: (path: string, init?: Init) => unknown) {
  api.request.mockImplementation(async (path: string, init?: Init) => {
    const found = answer(path, init);
    return found !== undefined ? found : new Promise(() => undefined);
  });
}

const writes = () => api.request.mock.calls.filter(([, init]) => init?.method).map(([path, init]) => ({ path, method: init?.method, body: init?.body }));

afterEach(() => {
  api.request.mockReset();
});

describe("the costs page", () => {
  const defaults = { packagingCostAmount: 500, shippingCostAmount: 4000, returnCostAmount: 2500, collectionFeeBp: 100, gatewayFeeBp: 250, damageBp: 0 };
  const product = {
    productId: "p1",
    name: "Headphones Pro",
    status: "active",
    minCostAmount: 20000,
    maxCostAmount: 20000,
    minPriceAmount: 45000,
    maxPriceAmount: 45000,
    variants: 1,
    variantsWithoutCost: 0,
    overrides: null,
  };

  function serveCosts() {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/profit/economics" && !init?.method) return { defaults, products: [product] };
      if (path === "/workspaces/ws_1/profit/economics/defaults" && init?.method === "PUT") return { defaults: { ...defaults, ...(init.body as object) } };
      return undefined;
    });
  }

  it("shows the store's defaults and each product, and saves a changed default from the bar", async () => {
    serveCosts();
    const { user } = renderWithProviders(<ProfitCostsPage />, { route: "/profit/costs" });

    const shipping = await screen.findByLabelText("Courier charge per order");
    expect((shipping as HTMLInputElement).value).toMatch(/^40(\.00)?$/);
    expect(screen.getAllByText("Headphones Pro").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

    await user.clear(shipping);
    await user.type(shipping, "55");
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ path: "/workspaces/ws_1/profit/economics/defaults", method: "PUT", body: { shippingCostAmount: 5500 } });
  });

  it("says what is wrong under the field and sends nothing", async () => {
    serveCosts();
    const { user } = renderWithProviders(<ProfitCostsPage />, { route: "/profit/costs" });

    const shipping = await screen.findByLabelText("Courier charge per order");
    await user.clear(shipping);
    await user.type(shipping, "abc");
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("Type the amount in digits only, with no letters or symbols.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it("reads in the dashboard's own Arabic", async () => {
    serveCosts();
    renderWithProviders(<ProfitCostsPage />, { route: "/profit/costs", locale: "ar" });
    expect(await screen.findByLabelText("تكلفة الشحن لكل طلب")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "التكاليف" })).toBeInTheDocument();
  });
});

describe("the WhatsApp bot page", () => {
  const bot = { enabled: false, alwaysOn: true, from: "09:00", to: "21:00", days: [0, 1, 2, 3, 4], dialect: "egyptian", extraInfo: "" };
  const view = { bot, usage: { repliesThisMonth: 12, limit: 500 }, timezone: "Africa/Cairo" };

  function serveBot() {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/wa-bot" && !init?.method) return view;
      if (path === "/workspaces/ws_1/wa-bot" && init?.method === "PUT") return { ...view, bot: init.body };
      return undefined;
    });
  }

  it("switches the bot on from the save bar, sending the settings whole", async () => {
    serveBot();
    const { user } = renderWithProviders(<WaBotPage />, { route: "/inbox/bot", workspace: { currentWorkspace: { ...testWorkspace, role: "owner" } } });

    await user.click(await screen.findByRole("switch", { name: "Let the bot answer customers" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes()).toEqual([{ path: "/workspaces/ws_1/wa-bot", method: "PUT", body: { ...bot, enabled: true } }]));
  });

  it("only shows the settings to a role that cannot change them", async () => {
    serveBot();
    renderWithProviders(<WaBotPage />, { route: "/inbox/bot", workspace: { currentWorkspace: { ...testWorkspace, role: "confirmation_agent" } }, locale: "ar" });

    expect(await screen.findByText("مالك المتجر أو المدير فقط يمكنه تغيير إعدادات البوت.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "السماح للبوت بالرد على العملاء" })).toBeDisabled();
  });
});
