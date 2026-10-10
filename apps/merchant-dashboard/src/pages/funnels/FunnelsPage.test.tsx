import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { FunnelDto } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelsPage } from "./FunnelsPage";

/**
 * The funnels list: search by name, statuses as chips with their counts, a row
 * per funnel that opens the editor, and everything else behind the row's menu.
 * The calls are the ones the old table made; the link of a funnel is still the
 * store's own.
 */

const funnel = (id: string, name: string, status: FunnelDto["status"], subdomain: string | null = null) =>
  fake<FunnelDto>({ id, name, status, subdomain, publishedRevisionId: status === "draft" ? null : "rev_1", createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-05T10:00:00Z" });

const FUNNELS = [
  funnel("f1", "Headphones COD", "published", "headphones"),
  funnel("f2", "Summer dress", "draft"),
  funnel("f3", "Old offer", "paused", "old-offer"),
  funnel("f4", "Headphones upsell test", "draft"),
];

function serve(funnels: FunnelDto[] = FUNNELS) {
  api.getFunnelAnalytics.mockResolvedValue(
    fake({
      currency: "EGP",
      totals: { sessions: 1200, orders: 84, revenue: 4200000, conversionRate: 7 },
      funnels: [{ id: "f1", sessions: 1000, orders: 80, revenue: 4000000, conversionRate: 8 }],
    })
  );
  api.request.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/workspaces/ws_1/funnels" && !init?.method) return { funnels };
    if (/\/funnels\/[^/]+\/steps$/.test(path) && !init?.method) return { steps: [{}, {}, {}] };
    if (/\/funnels\/f1\/(pause|resume)$/.test(path)) return { funnel: FUNNELS[0] };
    if (init?.method === "DELETE") return { deleted: true };
    return new Promise(() => undefined);
  });
}

const renderPage = (locale: "en" | "ar" = "en") =>
  renderWithProviders(<FunnelsPage />, {
    route: "/funnels",
    locale,
    workspace: { currentWorkspace: { ...testWorkspace, slug: "nile", role: "owner" } as typeof testWorkspace },
  });

const rows = async () => within(await screen.findByRole("list", { name: "Funnels" })).getAllByRole("listitem");
const names = async () => (await rows()).map((row) => within(row).getAllByRole("link")[0].textContent);

afterEach(() => {
  api.request.mockReset();
  api.getFunnelAnalytics.mockReset();
});

describe("the funnels list", () => {
  it("lists every funnel with its status, steps and numbers, and a row opens the editor", async () => {
    serve();
    renderPage();
    expect(await names()).toEqual(["Headphones COD", "Summer dress", "Old offer", "Headphones upsell test"]);
    const [first] = await rows();
    expect(within(first).getAllByRole("link")[0].getAttribute("href")).toBe("/funnels/f1");
    expect(within(first).getByText("Live")).toBeTruthy();
    await waitFor(() => expect(first.textContent).toContain("1,000"));
    // The totals of the period stand over the list.
    expect(screen.getByText("1,200")).toBeTruthy();
  });

  it("narrows by name as the merchant types", async () => {
    serve();
    const { user } = renderPage();
    await rows();
    await user.type(screen.getByRole("searchbox", { name: "Search funnels" }), "headph");
    await waitFor(async () => expect(await names()).toEqual(["Headphones COD", "Headphones upsell test"]));
  });

  it("counts each status on its chip and filters by it", async () => {
    serve();
    const { user } = renderPage();
    await rows();
    const chips = screen.getByRole("group", { name: "Funnel status" });
    expect(within(chips).getByRole("button", { name: /All.*4/ })).toBeTruthy();
    await user.click(within(chips).getByRole("button", { name: /Draft.*2/ }));
    expect(await names()).toEqual(["Summer dress", "Headphones upsell test"]);
    await user.click(within(chips).getByRole("button", { name: /Paused.*1/ }));
    expect(await names()).toEqual(["Old offer"]);
  });

  it("says when nothing matches, and shows everything again", async () => {
    serve();
    const { user } = renderPage();
    await rows();
    await user.type(screen.getByRole("searchbox", { name: "Search funnels" }), "zzz");
    expect(await screen.findByText("No funnel matches")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(await names()).toHaveLength(4);
  });

  it("keeps the rest behind the row's menu: no tick boxes, no bulk bar, no template market", async () => {
    serve();
    const { user } = renderPage();
    const [first] = await rows();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    await user.click(within(first).getByRole("button", { name: "Actions for “Headphones COD”" }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Preview", "Copy the link", "Report", "Pause", "Duplicate", "Share", "Delete"]);
  });

  it("offers a link only for a funnel that answers, and copies the store's own address", async () => {
    serve();
    const { user } = renderPage();
    const all = await rows();
    const copied = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(within(all[0]).getByRole("button", { name: "Actions for “Headphones COD”" }));
    await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Copy the link" }));
    await waitFor(() => expect(copied).toHaveBeenCalledTimes(1));
    expect(copied.mock.calls[0][0]).toMatch(/nile.*\/f\/headphones$/);
    // A draft has no public address yet.
    await user.click(within(all[1]).getByRole("button", { name: "Actions for “Summer dress”" }));
    const draftItems = within(await screen.findByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent);
    expect(draftItems).toEqual(["Report", "Publish", "Duplicate", "Share", "Delete"]);
  });

  it("pauses with the call it always made, and offers to undo it", async () => {
    serve();
    const { user } = renderPage();
    const [first] = await rows();
    await user.click(within(first).getByRole("button", { name: "Actions for “Headphones COD”" }));
    await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Pause" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/funnels/f1/pause", { method: "POST", body: {} }));
    expect(await screen.findByText("“Headphones COD” paused.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/funnels/f1/resume", { method: "POST", body: {} }));
  });

  it("asks before deleting, and says what stops working", async () => {
    serve();
    const { user } = renderPage();
    const all = await rows();
    await user.click(within(all[1]).getByRole("button", { name: "Actions for “Summer dress”" }));
    await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Delete “Summer dress”?")).toBeTruthy();
    expect(within(dialog).getByText(/Past orders are kept/)).toBeTruthy();
    expect(api.request).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete funnel" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/funnels/f2", { method: "DELETE" }));
  });

  it("shows no numbers to a role without the reports permission, and says why once", async () => {
    serve();
    renderWithProviders(<FunnelsPage />, {
      route: "/funnels",
      workspace: { currentWorkspace: { ...testWorkspace, slug: "nile", role: "order_operator" } as typeof testWorkspace },
    });
    await rows();
    expect(api.getFunnelAnalytics).not.toHaveBeenCalled();
    expect(screen.getByText(/Your role can't see the numbers/)).toBeTruthy();
  });

  it("starts an empty store with one action", async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText("No funnels yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make your first funnel" })).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve();
    renderPage("ar");
    expect(await screen.findByRole("heading", { name: "مسارات البيع" })).toBeTruthy();
    expect(await screen.findByRole("list", { name: "مسارات البيع" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "مسار بيع جديد" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "ابحث في مسارات البيع" })).toBeTruthy();
  });
});
