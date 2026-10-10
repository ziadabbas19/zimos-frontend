import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type Product, type WorkspaceOfferOption } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelWizardSheet } from "./FunnelWizard";
import { buildFunnel } from "./wizard/buildFunnel";

/**
 * A new funnel in three questions: what you sell, which offer, which look.
 * The funnel is made with the calls this API has: a ready funnel, a copy of
 * one of the store's own, or a share code. No currency of its own.
 */

const product = fake<Product>({
  id: "p1",
  name: "Headphones Pro",
  status: "active",
  media: [],
  variants: [{ id: "v1", status: "active", priceAmount: "45000", currency: "EGP" }],
  offers: [{ id: "o1", name: "Buy one", status: "active", isDefault: true, priceAmount: "45000", currency: "EGP" }],
});

const caseOffer = fake<WorkspaceOfferOption>({
  id: "o9",
  name: "Carry case",
  priceAmount: "9000",
  currency: "EGP",
  isDefault: false,
  productId: "p2",
  productName: "Case",
  imageUrl: null,
  lines: [],
  bumpProblem: null,
});

const page = { version: 1, sections: [{ id: "s", elements: [] }] };
const madeSteps = [
  { id: "st_page", key: "product", stepType: "landing", builderData: page, offerId: null },
  { id: "st_thanks", key: "thank-you", stepType: "thank_you", builderData: { version: 1, sections: [] }, offerId: null },
  { id: "st_offer", key: "upsell", stepType: "upsell", builderData: page, offerId: null },
];

interface Init {
  method?: string;
  body?: unknown;
}

/** The API a new funnel talks to; `over` answers first. */
function serve(over: (path: string, init?: Init) => unknown = () => undefined) {
  api.listProducts.mockResolvedValue(fake({ products: [product], nextCursor: null }));
  api.listWorkspaceOffers.mockResolvedValue([caseOffer]);
  api.request.mockImplementation(async (path: string, init?: Init) => {
    const answer = over(path, init);
    if (answer !== undefined) return answer;
    if (path === "/workspaces/ws_1/funnels" && init?.method === "POST") return { funnel: { id: "f9", name: (init.body as { name: string }).name } };
    if (path === "/workspaces/ws_1/funnels/f9/steps" && init?.method === "POST") return { step: {} };
    if (path === "/workspaces/ws_1/funnels/f9/edges" && init?.method === "POST") return { edge: {} };
    if (path === "/workspaces/ws_1/funnels/f9/steps" && !init?.method) return { steps: madeSteps };
    if (path.startsWith("/workspaces/ws_1/funnels/f9/steps/") && init?.method === "PATCH") return { step: {} };
    return new Promise(() => undefined);
  });
}

const sent = (method: string) => api.request.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method).map(([path, init]) => ({ path, body: init?.body }));

function openWizard() {
  const onCreated = vi.fn();
  const view = renderWithProviders(<FunnelWizardSheet open onOpenChange={() => undefined} onCreated={onCreated} />);
  return { ...view, onCreated };
}

afterEach(() => {
  api.request.mockReset();
});

describe("the new-funnel wizard", () => {
  it("asks what you sell, which offer and which look, then builds the funnel with both on it", async () => {
    serve();
    const { user, onCreated } = openWizard();

    expect(await screen.findByRole("heading", { name: "What do you sell?" })).toBeInTheDocument();
    await user.click(await screen.findByRole("radio", { name: /Headphones Pro/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Which offer?" })).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: /Offer after the order/ }));
    await user.click(await screen.findByRole("radio", { name: /Carry case/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Which look?" })).toBeInTheDocument();
    // The name follows the product until the merchant types one.
    expect(screen.getByLabelText("Funnel name")).toHaveValue("Headphones Pro");
    // The answer to the second question chose the ready funnel that has an offer step.
    expect(screen.getByRole("radio", { name: /COD product \+ one-click upsell/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Build the funnel" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("f9"));
    expect(sent("POST")[0]).toEqual({ path: "/workspaces/ws_1/funnels", body: { name: "Headphones Pro" } });
    const patches = sent("PATCH");
    // The product goes on every page that has sections; the offer on the offer step.
    expect(patches).toContainEqual({ path: "/workspaces/ws_1/funnels/f9/steps/st_page", body: { builderData: { ...page, productId: "p1" } } });
    expect(patches).toContainEqual({ path: "/workspaces/ws_1/funnels/f9/steps/st_offer", body: { offerId: "o9" } });
    expect(patches.some((call) => call.path.endsWith("/st_thanks"))).toBe(false);
    // The funnel has no currency of its own here: nothing is written to its settings.
    expect(api.request.mock.calls.some(([path]) => path.includes("/settings"))).toBe(false);
  });

  it("offers the ready funnels and the store's own, and asks for a name and a link only", async () => {
    serve();
    const { user } = openWizard();

    await user.click(await screen.findByRole("radio", { name: /Continue without a product/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("radio", { name: "Ready" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "My funnels" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Marketplace" })).not.toBeInTheDocument();
    // The AI card shows only while AI is switched on (it is off by default).
    expect(screen.queryByRole("radio", { name: /AI template/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Link" }));
    expect(screen.getByLabelText("Link")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Currency/)).not.toBeInTheDocument();
  });

  it("refuses a link that could not be a funnel's address", async () => {
    serve();
    const { user, onCreated } = openWizard();
    await user.click(await screen.findByRole("radio", { name: /Headphones Pro/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.type(screen.getByLabelText("Link"), "Not A Link!");
    await user.click(screen.getByRole("button", { name: "Build the funnel" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Use 3 to 63 small letters, numbers and hyphens.");
    expect(sent("POST")).toHaveLength(0);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("points at the plan page when the month's funnels are used up", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/funnels" && init?.method === "POST") throw new ApiError("Plan limit reached", 403, "PLAN_LIMIT_REACHED");
      return undefined;
    });
    const { user, onCreated } = openWizard();
    await user.click(await screen.findByRole("radio", { name: /Headphones Pro/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Build the funnel" }));

    expect(await screen.findByRole("link", { name: "Upgrade the plan" })).toHaveAttribute("href", "/subscription");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("copies a funnel from the code another merchant gave", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/funnels/import" && init?.method === "POST") return { funnel: { id: "f7", name: "Shared" }, stepCount: 3, edgeCount: 2 };
      return undefined;
    });
    const { user, onCreated } = openWizard();

    await user.click(await screen.findByRole("button", { name: "I have a funnel code" }));
    expect(screen.getByRole("heading", { name: "Copy a funnel by code" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Funnel code"), "abc123");
    await user.click(screen.getByRole("button", { name: "Copy the funnel" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("f7"));
    expect(sent("POST")).toEqual([{ path: "/workspaces/ws_1/funnels/import", body: { shareCode: "ABC123" } }]);
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve();
    renderWithProviders(<FunnelWizardSheet open onOpenChange={() => undefined} onCreated={() => undefined} />, { locale: "ar" });

    expect(await screen.findByRole("heading", { name: "ماذا تبيع؟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "لديّ كود مسار بيع" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التالي" })).toBeInTheDocument();
  });
});

describe("building the funnel", () => {
  const answers = { goal: "sell" as const, productId: "p1", offerId: "o9", name: "Headphones Pro", subdomain: "" };

  it("copies one of the store's funnels with its name and link", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/funnels/src/duplicate" && init?.method === "POST") return { funnel: { id: "f2", name: "Headphones Pro" } };
      return undefined;
    });
    const outcome = await buildFunnel("ws_1", { ...answers, subdomain: "headphones", template: { kind: "copy", funnelId: "src" } });

    expect(outcome).toMatchObject({ status: "created", id: "f2", partial: null, touchError: null, offerError: null });
    expect(sent("POST")).toEqual([{ path: "/workspaces/ws_1/funnels/src/duplicate", body: { name: "Headphones Pro", subdomain: "headphones" } }]);
  });

  it("still opens the funnel when the offer cannot be written, and says so", async () => {
    const refused = new ApiError("Offer is not active", 422, "OFFER_NOT_ACTIVE");
    serve((path, init) => {
      // The product is written to the offer step's page first; only the offer itself is refused.
      if (path === "/workspaces/ws_1/funnels/f9/steps/st_offer" && init?.method === "PATCH" && "offerId" in (init.body as object)) throw refused;
      return undefined;
    });
    const outcome = await buildFunnel("ws_1", { ...answers, template: { kind: "starter", id: "cod-upsell", lang: "en" } });

    expect(outcome).toMatchObject({ status: "created", id: "f9", offerError: refused, touchError: null });
  });

  it("opens a funnel whose first pages did not all get made, as unfinished", async () => {
    const down = new ApiError("Server error", 500);
    serve((path, init) => {
      if (path === "/workspaces/ws_1/funnels/f9/steps" && init?.method === "POST") throw down;
      return undefined;
    });
    const outcome = await buildFunnel("ws_1", { ...answers, template: { kind: "starter", id: "cod-single", lang: "en" } });

    expect(outcome).toMatchObject({ status: "created", id: "f9", partial: down });
  });

  it("fails without a funnel when the funnel itself is refused", async () => {
    const full = new ApiError("Plan limit reached", 403, "PLAN_LIMIT_REACHED");
    serve((path, init) => {
      if (path === "/workspaces/ws_1/funnels" && init?.method === "POST") throw full;
      return undefined;
    });
    const outcome = await buildFunnel("ws_1", { ...answers, template: { kind: "starter", id: "cod-single", lang: "en" } });

    expect(outcome).toEqual({ status: "failed", source: "funnel", error: full });
  });
});
