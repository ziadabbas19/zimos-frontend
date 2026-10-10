import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { FunnelDetailDto, SplitTest } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { UiStep } from "./funnelAdapter";
import { FunnelGrowthButton } from "./FunnelGrowthPanel";
import { stepPageTree } from "./funnelPages";

/**
 * The funnel's settings sheet: its settings, its split tests and its country
 * rules. A split test takes two to five versions. A is the page as it is;
 * every other version starts as a copy of it and has a page of its own to edit.
 */

const landing: UiStep = {
  id: "step_landing",
  key: "landing",
  name: "Product page",
  type: "landing",
  offerId: null,
  bumpOfferId: null,
  experimentId: null,
  seo: {},
  tree: stepPageTree("landing", "en"),
  x: 40,
  y: 64,
};

const pageB = { version: 1, sections: [] };
const pageC = { version: 1, sections: [] };

const threeWay = fake<SplitTest>({
  id: "exp_1",
  name: "Headline test",
  funnelId: "f1",
  stepKey: "landing",
  status: "running",
  winnerVariantKey: null,
  updatedAt: "2026-10-05T10:00:00Z",
  autoWinner: { enabled: false, afterVisits: 2000, metric: "conversion_rate" },
  variants: [
    { key: "A", name: "A", weight: 50 },
    { key: "B", name: "Red button", weight: 30, builderData: pageB },
    { key: "C", name: "C", weight: 20, builderData: pageC },
  ],
});

const funnel = fake<FunnelDetailDto>({
  funnel: { id: "f1", name: "Headphones COD", subdomain: "headphones", status: "published", publishedRevisionId: "rev_3", createdAt: "", updatedAt: "" },
  steps: [],
  edges: [],
  publishedRevision: null,
});

function serve(tests: SplitTest[]) {
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (path === "/workspaces/ws_1/experiments?funnelId=f1") return { experiments: tests };
    if (path === "/workspaces/ws_1/experiments" && init?.method === "POST") return { experiment: threeWay };
    if (path === "/workspaces/ws_1/experiments/exp_1" && !init?.method) return { experiment: threeWay, results: { variants: [] } };
    if (path === "/workspaces/ws_1/experiments/exp_1" && init?.method === "PATCH") return { experiment: threeWay };
    if (path === "/workspaces/ws_1/funnels/f1" && !init?.method) return funnel;
    if (path === "/workspaces/ws_1/funnels/f1/settings" && !init?.method) return { settings: {}, currency: "EGP" };
    return new Promise(() => undefined);
  });
}

const withSlug = { currentWorkspace: { ...testWorkspace, slug: "nile" } };

async function openSheet() {
  const view = renderWithProviders(<FunnelGrowthButton funnelId="f1" steps={[landing]} />, { workspace: withSlug });
  await view.user.click(screen.getByRole("button", { name: "Funnel settings" }));
  return view;
}

async function openTests() {
  const view = await openSheet();
  await view.user.click(screen.getByRole("radio", { name: "A/B tests" }));
  return view;
}

afterEach(() => {
  api.request.mockReset();
});

describe("the funnel's settings sheet", () => {
  it("has the settings, the split tests and the countries, and no order emails", async () => {
    serve([]);
    await openSheet();
    expect(screen.getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Settings", "A/B tests", "Countries"]);
  });

  it("shows the address shoppers open, on the store's own domain, under the link field", async () => {
    serve([]);
    await openSheet();

    expect(await screen.findByLabelText("Funnel link")).toHaveValue("headphones");
    expect(screen.getByTestId("funnel-link-url")).toHaveTextContent("https://nile.zimos.co/f/headphones");
    expect(screen.getByRole("link", { name: "Open the funnel in a new tab" })).toHaveAttribute("href", "https://nile.zimos.co/f/headphones");
    // The shipping group is the only shipping setting here: no threshold of the funnel's own.
    expect(screen.getByLabelText("Shipping group")).toBeInTheDocument();
    expect(screen.queryByText(/free shipping/i)).not.toBeInTheDocument();
  });
});

describe("a split test with more than two versions", () => {
  it("starts with three versions, each but the original a copy of the page", async () => {
    serve([]);
    const { user } = await openTests();
    await user.click(await screen.findByRole("button", { name: "New test" }));
    await user.type(screen.getByRole("textbox", { name: "Test name" }), "Headline test");
    await user.click(screen.getByRole("button", { name: "Add a version" }));
    await user.click(screen.getByRole("button", { name: "Start test" }));

    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/experiments", expect.objectContaining({ method: "POST" })));
    const call = api.request.mock.calls.find(([path, init]) => path === "/workspaces/ws_1/experiments" && init?.method === "POST")!;
    const body = call[1]!.body as { variants: Array<{ key: string; weight: number; builderData?: unknown }>; stepKey: string };
    expect(body.stepKey).toBe("landing");
    expect(body.variants.map((v) => `${v.key}:${v.weight}`)).toEqual(["A:34", "B:33", "C:33"]);
    expect(body.variants.reduce((sum, v) => sum + v.weight, 0)).toBe(100);
    expect(body.variants[0]).not.toHaveProperty("builderData");
    expect(body.variants[1].builderData).toEqual(landing.tree);
    expect(body.variants[2].builderData).toEqual(landing.tree);
  });

  it("still sends the two halves a test always had when nothing is added", async () => {
    serve([]);
    const { user } = await openTests();
    await user.click(await screen.findByRole("button", { name: "New test" }));
    await user.type(screen.getByRole("textbox", { name: "Test name" }), "Headline test");
    await user.click(screen.getByRole("button", { name: "Start test" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/experiments", expect.objectContaining({ method: "POST" })));
    const call = api.request.mock.calls.find(([path, init]) => path === "/workspaces/ws_1/experiments" && init?.method === "POST")!;
    const body = call[1]!.body as { variants: Array<{ key: string; weight: number }> };
    expect(body.variants.map((v) => `${v.key}:${v.weight}`)).toEqual(["A:50", "B:50"]);
  });

  it("lists every version of a running test, and each one but the original has a page to edit", async () => {
    serve([threeWay]);
    const { user } = await openTests();
    await user.click(await screen.findByRole("button", { name: "Open the test «Headline test»" }));

    const sheet = screen.getByRole("dialog");
    expect(await within(sheet).findByText("A — original")).toBeInTheDocument();
    expect(within(sheet).getByText(/Red button/)).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Edit A's page" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Edit B's page" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Edit C's page" })).toBeInTheDocument();
  });

  it("saves one version's page without dropping the other versions' pages", async () => {
    serve([threeWay]);
    const { user } = await openTests();
    await user.click(await screen.findByRole("button", { name: "Open the test «Headline test»" }));
    await user.click(await screen.findByRole("button", { name: "Edit C's page" }));
    await user.click(await screen.findByRole("button", { name: "Save C's page" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/experiments/exp_1", expect.objectContaining({ method: "PATCH" })));
    const call = api.request.mock.calls.find(([path, init]) => path === "/workspaces/ws_1/experiments/exp_1" && init?.method === "PATCH")!;
    const body = call[1]!.body as { variants: Array<{ key: string; builderData?: unknown }> };
    // The server checks every version's page on a save: each one but A has to come back.
    expect(body.variants.map((v) => v.key)).toEqual(["A", "B", "C"]);
    expect(body.variants[0]).not.toHaveProperty("builderData");
    expect(body.variants[1].builderData).toEqual(pageB);
    expect(body.variants[2].builderData).toBeTruthy();
  });
});
