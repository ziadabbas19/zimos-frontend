import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { SplitTest } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { UiStep } from "./funnelAdapter";
import { FunnelGrowthButton } from "./FunnelGrowthPanel";
import { stepPageTree } from "./funnelPages";

/**
 * A split test takes two to five versions. A is the page as it is; every other
 * version starts as a copy of it and has a page of its own to edit.
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
  variants: [
    { key: "A", name: "A", weight: 50 },
    { key: "B", name: "Red button", weight: 30, builderData: pageB },
    { key: "C", name: "C", weight: 20, builderData: pageC },
  ],
});

function serve(tests: SplitTest[]) {
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (path === "/workspaces/ws_1/experiments?funnelId=f1") return { experiments: tests };
    if (path === "/workspaces/ws_1/experiments" && init?.method === "POST") return { experiment: threeWay };
    if (path === "/workspaces/ws_1/experiments/exp_1" && !init?.method) return { experiment: threeWay, results: { variants: [] } };
    if (path === "/workspaces/ws_1/experiments/exp_1" && init?.method === "PATCH") return { experiment: threeWay };
    return new Promise(() => undefined);
  });
}

async function openTests() {
  const view = renderWithProviders(<FunnelGrowthButton funnelId="f1" steps={[landing]} />);
  await view.user.click(screen.getByRole("button", { name: "Tests and settings" }));
  return view;
}

afterEach(() => {
  api.request.mockReset();
});

describe("a split test with more than two versions", () => {
  it("starts with three versions, each but the original a copy of the page", async () => {
    serve([]);
    const { user } = await openTests();
    await user.click(await screen.findByRole("button", { name: "New split test" }));
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
    await user.click(await screen.findByRole("button", { name: "New split test" }));
    await user.type(screen.getByRole("textbox", { name: "Test name" }), "Headline test");
    await user.click(screen.getByRole("button", { name: "Start test" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/experiments", expect.objectContaining({ method: "POST" })));
    const call = api.request.mock.calls.find(([path, init]) => path === "/workspaces/ws_1/experiments" && init?.method === "POST")!;
    const body = call[1]!.body as { variants: Array<{ key: string; weight: number }> };
    expect(body.variants.map((v) => `${v.key}:${v.weight}`)).toEqual(["A:50", "B:50"]);
  });

  it("lists every version of a running test, and each one but the original has a page to edit", async () => {
    serve([threeWay]);
    await openTests();
    const table = await screen.findByRole("table");
    const lines = within(table).getAllByRole("row").slice(1);
    expect(lines).toHaveLength(3);
    expect(lines[0].textContent).toContain("A — original");
    expect(lines[1].textContent).toContain("B · Red button");
    expect(within(lines[0]).queryByRole("button", { name: /Edit the page of version/ })).toBeNull();
    expect(within(lines[1]).getByRole("button", { name: "Edit the page of version B" })).toBeTruthy();
    expect(within(lines[2]).getByRole("button", { name: "Edit the page of version C" })).toBeTruthy();
  });

  it("saves one version's page without dropping the other versions' pages", async () => {
    serve([threeWay]);
    const { user } = await openTests();
    await user.click(await screen.findByRole("button", { name: "Edit the page of version C" }));
    await user.click(await screen.findByRole("button", { name: "Save the page of version C" }));
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
