import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./page";

/**
 * The pricing page with and without the pay-per-order plan: the card, its
 * questions and the service words that mention it only while the API sends
 * the plan; the page as before when it doesn't (the plan switched off or
 * hidden), and "coming soon" when the API can't be reached.
 */

// The header and footer read the router and the console's settings; neither plays a part here.
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

const PLANS = ["a", "b", "c"].map((id, i) => ({
  id,
  name: `Plan ${id}`,
  currency: "EGP",
  monthlyPrice: 29900 * (i + 1),
  yearlyPrice: 299000 * (i + 1),
  trialDays: 14,
  maxStores: 1,
  maxFunnelsPerMonth: null,
  softOrderQuota: null,
  features: [],
}));
const PPO = { id: "ppo-1", name: "الدفع لكل طلب", currency: "EGP", feePerOrder: 500, freeOrders: 10, feeChargedAt: "confirmation" };

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const renderPage = async (locale: "ar" | "en") => render(await PricingPage({ params: Promise.resolve({ locale }) }));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the pricing page", () => {
  it("shows the pay-per-order card, its questions and the words for it", async () => {
    fetchMock.mockResolvedValue(answer({ plans: PLANS, payPerOrder: PPO }));
    await renderPage("ar");

    expect(screen.getByRole("heading", { level: 2, name: "الدفع لكل طلب" })).toBeTruthy();
    expect(screen.getByText("أول ١٠ طلبات مجانا")).toBeTruthy();
    expect(screen.getByText(/أو تدفع لكل طلب فقط دون اشتراك/)).toBeTruthy();

    expect(screen.getByRole("heading", { level: 2, name: "أسئلة عن الدفع لكل طلب" })).toBeTruthy();
    expect(screen.getByText("ماذا يحدث بعد انتهاء الطلبات المجانية؟")).toBeTruthy();
    expect(screen.getByText(/بعد أول ١٠ طلبات، يتم خصم/)).toBeTruthy();
    expect(screen.getByText("هل ينتهي رصيدي؟")).toBeTruthy();
    expect(screen.getByText("لا. رصيدك لا تنتهي صلاحيته ولا يقل بمرور الوقت.")).toBeTruthy();
    expect(screen.getByText(/^عند تأكيد الطلب، أو عند وصول دفعه/)).toBeTruthy();

    expect(screen.getByText(/أو رسوما على كل طلب من رصيد مدفوع مسبقا/)).toBeTruthy();
  });

  it("asks nothing about free orders when the plan has none", async () => {
    fetchMock.mockResolvedValue(answer({ plans: PLANS, payPerOrder: { ...PPO, freeOrders: 0 } }));
    await renderPage("en");
    expect(screen.getByText("Questions about pay per order")).toBeTruthy();
    expect(screen.queryByText("What happens after the free orders?")).toBeNull();
    expect(screen.getByText("Does my balance expire?")).toBeTruthy();
  });

  it("opens as before, with no trace of the plan, when the API sends none", async () => {
    fetchMock.mockResolvedValue(answer({ plans: PLANS, payPerOrder: null }));
    await renderPage("ar");

    expect(screen.getByRole("heading", { level: 1, name: "الخطط والأسعار" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Plan a" })).toBeTruthy();
    expect(screen.queryByText(/لكل طلب/)).toBeNull();
    expect(screen.queryByText("أسئلة عن الدفع لكل طلب")).toBeNull();
    expect(screen.getByText("ZIMOS منصة SaaS لإنشاء المتاجر الإلكترونية. تشترك في المنصة شهريا أو سنويا، بالخطة التي تناسب متجرك.")).toBeTruthy();
    expect(screen.getByText("اشتراك في منصة ZIMOS، شهري أو سنوي.")).toBeTruthy();
  });

  it("shows the card alone when it is the only plan on offer", async () => {
    fetchMock.mockResolvedValue(answer({ plans: [], payPerOrder: PPO }));
    await renderPage("ar");
    expect(screen.getByRole("heading", { level: 2, name: "الدفع لكل طلب" })).toBeTruthy();
    expect(screen.queryByText("ستتوفر الأسعار قريبا.")).toBeNull();
  });

  it("says prices are coming soon when the API can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await renderPage("ar");
    expect(screen.getByText("ستتوفر الأسعار قريبا.")).toBeTruthy();
    expect(screen.queryByText(/لكل طلب/)).toBeNull();
  });
});
