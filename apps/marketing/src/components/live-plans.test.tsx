import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { readOffer, type PublicOffer, type PublicPlan } from "@/lib/plan-offer";
import { LivePlans } from "./live-plans";

/**
 * The plans follow the console: the page is drawn with what the server read,
 * then the browser asks the API again on every visit and each time the tab
 * comes back, and the cards show what it answers (the owner, 2026-11-14).
 */

const copy = getDictionary("en").pricing;

const plan = (over: Partial<PublicPlan> = {}): PublicPlan => ({
  id: "p1",
  name: "Starter",
  currency: "EGP",
  monthlyPrice: 31900,
  yearlyPrice: 319000,
  trialDays: 0,
  maxStores: 1,
  maxFunnelsPerMonth: 5,
  softOrderQuota: 1000,
  features: ["custom_domain"],
  ...over,
});

const offer = (...plans: PublicPlan[]): PublicOffer => ({ plans, payPerOrder: null });

const answer = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the live plans", () => {
  it("draws the server's plans first, then what the API has now", async () => {
    fetchMock.mockResolvedValue(answer({ plans: [plan({ features: ["custom_domain", "loyalty"] })], payPerOrder: null }));
    render(<LivePlans initial={offer(plan())} copy={copy} locale="en" idPrefix="t" />);
    expect(screen.getByText(copy.features.custom_domain)).toBeTruthy();
    expect(screen.queryByText(copy.features.loyalty)).toBeNull();
    // A feature switched on in the console is there without a new build.
    expect(await screen.findByText(copy.features.loyalty)).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/plans\/public$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("follows a price, a plan added and a feature switched off", async () => {
    fetchMock.mockResolvedValue(
      answer({ plans: [plan({ features: [], monthlyPrice: 39900 }), plan({ id: "p2", name: "Growth" })], payPerOrder: null }),
    );
    render(<LivePlans initial={offer(plan())} copy={copy} locale="en" idPrefix="t" />);
    expect(await screen.findByRole("heading", { name: "Growth" })).toBeTruthy();
    expect(screen.getByText(/399/)).toBeTruthy();
    expect(screen.getAllByText(copy.features.custom_domain)).toHaveLength(1);
  });

  it("asks again when the tab comes back into view", async () => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [plan()], payPerOrder: null }));
    render(<LivePlans initial={offer(plan())} copy={copy} locale="en" idPrefix="t" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockResolvedValueOnce(answer({ plans: [plan({ name: "Renamed" })], payPerOrder: null }));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(await screen.findByRole("heading", { name: "Renamed" })).toBeTruthy();
    delete (document as { visibilityState?: string }).visibilityState;
  });

  it("keeps the page's plans when the API fails or answers oddly", async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: "down" }, 503));
    render(<LivePlans initial={offer(plan())} copy={copy} locale="en" idPrefix="t" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Starter" })).toBeTruthy();
  });

  it("shows what it is given for no plans, and the plans once the API has some", async () => {
    fetchMock.mockResolvedValue(answer({ plans: [plan()], payPerOrder: null }));
    render(<LivePlans initial={null} copy={copy} locale="en" idPrefix="t" empty={<p>coming soon</p>} />);
    expect(screen.getByText("coming soon")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Starter" })).toBeTruthy();
  });

  it("says a trial only on a plan the console gives one", async () => {
    fetchMock.mockResolvedValue(answer({ plans: [plan(), plan({ id: "p2", name: "Trial", trialDays: 14 })], payPerOrder: null }));
    const { container } = render(<LivePlans initial={null} copy={copy} locale="en" idPrefix="t" />);
    expect(await screen.findByRole("heading", { name: "Trial" })).toBeTruthy();
    expect(container.textContent).not.toContain(copy.noTrial);
    expect(screen.getAllByText(/14/).length).toBeGreaterThan(0);
  });

  it("names a feature only when the site has a name for it", async () => {
    fetchMock.mockResolvedValue(answer({ plans: [plan({ features: ["custom_domain", "brand_new_thing" as never] })], payPerOrder: null }));
    const { container } = render(<LivePlans initial={null} copy={copy} locale="en" idPrefix="t" />);
    expect(await screen.findByText(copy.features.custom_domain)).toBeTruthy();
    expect(container.textContent).not.toContain("brand_new_thing");
  });
});

describe("readOffer", () => {
  it("keeps the plans in the console's order, with the fields a card shows", () => {
    const read = readOffer({ plans: [plan({ id: "b" }), { ...plan({ id: "a" }), secret: 1 }], payPerOrder: null });
    expect(read?.plans.map((p) => p.id)).toEqual(["b", "a"]);
    expect(read?.plans[1]).not.toHaveProperty("secret");
  });

  it("leaves out a plan it cannot show honestly, and is null for no list", () => {
    expect(readOffer({ plans: [plan(), { id: "x", name: "No price" }] })?.plans).toHaveLength(1);
    expect(readOffer({ error: "x" })).toBeNull();
    expect(readOffer(null)).toBeNull();
  });
});
