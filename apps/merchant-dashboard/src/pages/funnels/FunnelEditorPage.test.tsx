import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { FunnelDetailDto, FunnelEdgeDto, FunnelStepDto } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelEditorPage } from "./FunnelEditorPage";
import { stepPageTree } from "./funnelPages";
import { funnelPreviewUrl } from "./FunnelPublicLink";

function step(key: string, stepType: FunnelStepDto["stepType"], name: string, i: number, offerId: string | null = null): FunnelStepDto {
  return fake<FunnelStepDto>({
    id: `step_${key}`,
    key,
    stepType,
    name,
    builderData: stepPageTree(stepType, "en"),
    offerId,
    abTestExperimentId: null,
    seo: { zimosCanvas: { x: 40 + i * 280, y: 64, order: i } },
  });
}

function edge(id: string, fromStepKey: string, toStepKey: string, type: string, priority = 0): FunnelEdgeDto {
  return fake<FunnelEdgeDto>({ id, fromStepKey, toStepKey, condition: { type }, priority });
}

const liveFunnel = fake<FunnelDetailDto>({
  funnel: { id: "f1", name: "Headphones COD", subdomain: "headphones", status: "published", publishedRevisionId: "rev_3", createdAt: "", updatedAt: "" },
  steps: [
    step("product", "landing", "Product page", 0),
    step("checkout", "checkout", "COD checkout", 1),
    step("upsell", "upsell", "Extra offer", 2),
    step("thank-you", "thank_you", "Thank you", 3),
  ],
  edges: [
    edge("e1", "product", "checkout", "always"),
    edge("e2", "checkout", "upsell", "completed_checkout"),
    edge("e3", "upsell", "thank-you", "accepted_offer", 1),
    edge("e4", "upsell", "thank-you", "declined_offer"),
  ],
  publishedRevision: { id: "rev_3", revisionNumber: 3, note: null, createdAt: "" },
});

const emptyFunnel = fake<FunnelDetailDto>({
  funnel: { id: "f1", name: "New funnel", subdomain: "new", status: "draft", publishedRevisionId: null, createdAt: "", updatedAt: "" },
  steps: [],
  edges: [],
  publishedRevision: null,
});

function serve(detail: FunnelDetailDto) {
  api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (!init?.method && path === "/workspaces/ws_1/funnels/f1") return detail;
    if (init?.method === "PATCH") return { step: {} };
    return new Promise(() => undefined);
  });
}

const withSlug = { currentWorkspace: { ...testWorkspace, slug: "nile" } };

const renderEditor = (locale: "en" | "ar" = "en") =>
  renderWithProviders(<FunnelEditorPage />, { route: "/funnels/f1", path: "/funnels/:funnelId", workspace: withSlug, locale });

/** The bar's «…» menu, opened; its rows by name. */
async function openMore(user: ReturnType<typeof renderEditor>["user"]) {
  await user.click(screen.getAllByRole("button", { name: "More" })[0]);
  return (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
}

afterEach(() => vi.restoreAllMocks());

describe("FunnelEditorPage", () => {
  it("says what visitors get now and puts each publish problem on its step", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();

    expect(await screen.findByText("Live · rev #3")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    // The upsell has no offer: flagged on its card, counted in the bar.
    expect(screen.getByText("No offer picked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "1 thing before publishing" }));
    const panel = screen.getByRole("alert");
    expect(within(panel).getByText("Extra offer")).toBeInTheDocument();
    expect(within(panel).getByText(/needs an offer/)).toBeInTheDocument();

    // "Show step" opens that step's details, with the same problem inline.
    await user.click(within(panel).getByRole("button", { name: "Show step" }));
    expect(await screen.findByLabelText("Name")).toHaveValue("Extra offer");
    expect(screen.getByText("Fix before publishing")).toBeInTheDocument();
  });

  it("Preview opens the published funnel on its store", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    serve(liveFunnel);
    const { user } = renderEditor();

    await user.click(await screen.findByRole("button", { name: "Preview" }));
    expect(open).toHaveBeenCalledWith("https://nile.zimos.co/f/headphones", "_blank", "noopener");
  });

  it("has no Preview while the funnel is a draft, in the bar or in the menu", async () => {
    serve(emptyFunnel);
    const { user } = renderEditor();

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
    expect(await openMore(user)).not.toContain("Preview");
  });

  it("offers the page, the preview, the history, the report, the settings and the pause in its menu, and nothing else", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();
    await screen.findByText("Live · rev #3");

    // No template market, no order emails, no conversion event: those parts are not in this product.
    expect(await openMore(user)).toEqual(["Edit the step's page", "Preview", "History", "The funnel's report", "Tests and settings", "Pause"]);
  });

  it("adds a step into a connector, from a menu that sits outside the map's zoom", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();
    await screen.findByText("Live · rev #3");

    await user.click(screen.getByRole("button", { name: "Add a step between Product page and COD checkout" }));
    const menu = screen.getByRole("dialog", { name: "Add which step?" });
    // A zoomed ancestor would scale the menu and trap it inside the map's box.
    for (let el = menu.parentElement; el; el = el.parentElement) expect(el.style.transform).not.toMatch(/scale\(/);

    await user.click(within(menu).getByRole("button", { name: "Sales page" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("button", { name: "Add a step between Product page and Sales page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a step between Sales page and COD checkout" })).toBeInTheDocument();
  });

  it("copies a step from the steps list, as unsaved work", async () => {
    serve(liveFunnel);
    const { user } = renderEditor();
    await screen.findByText("Live · rev #3");

    await user.click(screen.getByRole("button", { name: "Steps" }));
    await user.click(await screen.findByRole("button", { name: "Actions for Extra offer" }));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Open the page", "Rename", "Duplicate", "Delete"]);
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(await screen.findByRole("button", { name: "Actions for Extra offer (copy)" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Unsaved changes");
    // Nothing is sent until Save.
    expect(api.request.mock.calls.filter(([, init]) => init?.method)).toHaveLength(0);
  });

  it(
    "edits a step's page with the section library and saves it with the funnel",
    async () => {
      serve(liveFunnel);
      const { user } = renderEditor();
      await screen.findByText("Live · rev #3");

      await user.click(screen.getAllByRole("button", { name: "More" })[0]);
      await user.click(await screen.findByRole("menuitem", { name: "Edit the step's page" }));
      expect(await screen.findByText("Page of “Product page”")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add section" }));
      await user.click(await screen.findByTitle("Add FAQ"));
      await user.click(screen.getByRole("button", { name: /^Save$/ }));

      await waitFor(() =>
        expect(api.request).toHaveBeenCalledWith(
          "/workspaces/ws_1/funnels/f1/steps/step_product",
          expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ builderData: expect.anything() }) })
        )
      );
    },
    // The whole section library renders here: give this one test real headroom rather than the suite's default.
    15_000
  );

  it("offers templates on an empty funnel, in the dashboard's own Arabic", async () => {
    serve(emptyFunnel);
    const { user } = renderEditor("ar");

    expect(await screen.findByText("مسودة")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ابدأ مسار البيع من قالب" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /منتج بالدفع عند الاستلام مع عرض إضافي بنقرة/ }));

    expect(screen.getByRole("button", { name: "إضافة خطوة بعد صفحة المنتج" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة خطوة بعد عرض إضافي بنقرة" })).toBeInTheDocument();
    // Its upsell still needs an offer before it can go live.
    expect(screen.getByText("لم تختر عرضًا بعد")).toBeInTheDocument();
  });
});

describe("funnelPreviewUrl", () => {
  afterEach(() => vi.unstubAllEnvs());
  const base = "https://nile.zimos.co";
  const published = { id: "f1", subdomain: "headphones", status: "published" as const };

  it("uses the store link, by subdomain or id, for a published funnel only", () => {
    expect(funnelPreviewUrl(base, published)).toBe("https://nile.zimos.co/f/headphones");
    expect(funnelPreviewUrl(base, { ...published, subdomain: null })).toBe("https://nile.zimos.co/f/f1");
    expect(funnelPreviewUrl(base, { ...published, status: "draft" })).toBeNull();
    expect(funnelPreviewUrl(base, { ...published, status: "paused" })).toBeNull();
    expect(funnelPreviewUrl(null, published)).toBeNull();
  });

  it("keeps VITE_FUNNEL_PUBLIC_BASE_URL when it is set", () => {
    vi.stubEnv("VITE_FUNNEL_PUBLIC_BASE_URL", "https://{subdomain}.funnels.example");
    expect(funnelPreviewUrl(base, published)).toBe("https://headphones.funnels.example");
    expect(funnelPreviewUrl(base, { ...published, status: "draft" })).toBe("https://headphones.funnels.example");
  });
});
