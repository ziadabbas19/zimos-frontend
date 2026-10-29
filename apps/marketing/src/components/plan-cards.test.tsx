import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { formatOrderCount, formatPrice } from "@/lib/format";
import type { PayPerOrderPlan, PublicPlan } from "@/lib/plans";
import { PlanCards } from "./plan-cards";

/**
 * The pay-per-order card on the pricing page (PlanCards `payPerOrder`): shown
 * only when the API sends the plan, with its fee and its free orders as the
 * plan says — never a number of the page's own — and its button on the same
 * sign-up as the other plans.
 */

const plan = (id: string, monthlyPrice = 29900): PublicPlan => ({
  id,
  name: `Plan ${id}`,
  currency: "EGP",
  monthlyPrice,
  yearlyPrice: monthlyPrice * 10,
  trialDays: 14,
  maxStores: 1,
  maxFunnelsPerMonth: null,
  softOrderQuota: null,
  features: [],
});

const PPO: PayPerOrderPlan = { id: "ppo-1", name: "الدفع لكل طلب", currency: "EGP", feePerOrder: 500, freeOrders: 10, feeChargedAt: "confirmation" };
const THREE = [plan("a"), plan("b", 49900), plan("c", 99900)];

function renderCards(locale: "ar" | "en", payPerOrder: PayPerOrderPlan | null, plans = THREE) {
  const dict = getDictionary(locale);
  return render(<PlanCards plans={plans} payPerOrder={payPerOrder} copy={dict.pricing} locale={locale} idPrefix="t" headingLevel={2} />);
}

const card = (name: string) => screen.getByRole("listitem", { name });

afterEach(cleanup);

describe("the pay-per-order card", () => {
  it("shows the plan beside the others, with its fee and 10 free orders from the plan", () => {
    renderCards("ar", PPO);
    const ppo = card("الدفع لكل طلب");
    expect(within(ppo).getByRole("heading", { level: 2, name: "الدفع لكل طلب" })).toBeTruthy();
    expect(within(ppo).getByText("ادفع لكل طلب فقط، دون اشتراك شهري أو سنوي.")).toBeTruthy();
    expect(within(ppo).getByText("أول ١٠ طلبات مجانا")).toBeTruthy();
    // 500 piastres: EGP 5, as Intl writes it (with its own spaces and marks).
    expect(ppo.textContent).toContain(`${formatPrice(500, "EGP", "ar")} / لكل طلب`);
    expect(formatPrice(500, "EGP", "ar")).toMatch(/٥/);
    expect(within(ppo).getByText("رصيدك لا تنتهي صلاحيته")).toBeTruthy();
    // The three plans and this one, in one list, this one last.
    const items = screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-labelledby"));
    expect(items).toHaveLength(4);
    expect(items[3]).toBe(ppo);
  });

  it("follows the console's free orders when they change", () => {
    const { unmount } = renderCards("ar", { ...PPO, freeOrders: 25 });
    expect(within(card("الدفع لكل طلب")).getByText("أول ٢٥ طلبا مجانا")).toBeTruthy();
    unmount();

    renderCards("en", { ...PPO, name: "Pay per order", freeOrders: 3 });
    expect(within(card("Pay per order")).getByText("Your first 3 orders free")).toBeTruthy();
  });

  it("says nothing of free orders when the plan has none", () => {
    renderCards("ar", { ...PPO, freeOrders: 0 });
    expect(card("الدفع لكل طلب").textContent).not.toMatch(/مجانا/);
  });

  it("says when the fee is taken as the API does", () => {
    const { unmount } = renderCards("ar", PPO);
    expect(within(card("الدفع لكل طلب")).getByText(/عند تأكيد الطلب/)).toBeTruthy();
    unmount();

    renderCards("ar", { ...PPO, feeChargedAt: "placement" });
    const ppo = card("الدفع لكل طلب");
    expect(within(ppo).getByText(/عند استلامه، ويتم ردها إذا تم إلغاؤه قبل الشحن/)).toBeTruthy();
    expect(ppo.textContent).not.toMatch(/عند تأكيد الطلب/);
  });

  it("goes to the same sign-up as the other plans, naming this plan", () => {
    renderCards("en", { ...PPO, name: "Pay per order" });
    const link = within(card("Pay per order")).getByRole("link", { name: "Get started" });
    expect(link.getAttribute("href")).toBe("https://app.zimos.co/register?plan=ppo-1");
    expect(within(card("Plan a")).getByRole("link", { name: "Subscribe" }).getAttribute("href")).toMatch(/^https:\/\/app\.zimos\.co\/register\?/);
  });

  it("is not there when the API sends no pay-per-order plan (inactive or hidden from sign-up)", () => {
    renderCards("ar", null);
    expect(screen.queryByText(/لكل طلب/)).toBeNull();
    expect(screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-labelledby"))).toHaveLength(3);
  });

  it("sits beside one or two plans, and alone when there is no other", () => {
    const { container, unmount } = renderCards("ar", PPO, [plan("a")]);
    expect(container.querySelector("ul")?.className).toMatch(/md:grid-cols-2/);
    expect(card("الدفع لكل طلب").className).not.toMatch(/col-span-full/);
    unmount();

    const alone = renderCards("ar", PPO, []);
    expect(alone.container.querySelector("ul")?.className).toMatch(/max-w-md/);
    // No plan with a yearly price: no monthly/yearly switch.
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("is a wide card under three plans", () => {
    renderCards("ar", PPO);
    expect(card("الدفع لكل طلب").className).toMatch(/col-span-full/);
  });
});

/**
 * Under a plan's yearly price: twelve monthly payments struck out and the
 * year over twelve months, from the plan's own prices. Both sit in the block
 * the yearly switch shows (CSS, so jsdom keeps both blocks): the monthly one
 * holds neither.
 */
describe("the yearly price", () => {
  const YEARLY_BLOCK = "group-has-[.cycle-yearly:checked]/pricing:block";
  // Intl puts a no-break space in a price; getByText reads text with its spaces collapsed.
  const perMonthText = (text: string) => text.replace(/\s+/g, " ");
  const blocks = (li: HTMLElement) => ({
    monthly: li.querySelector<HTMLElement>('[class*="group-has-[.cycle-yearly:checked]/pricing:hidden"]')!,
    yearly: li.querySelector<HTMLElement>(`[class*="${YEARLY_BLOCK}"]`)!,
  });

  it("strikes the year at the monthly price and says what it comes to a month, on yearly only (en)", () => {
    renderCards("en", null, [{ ...plan("a"), monthlyPrice: 31900, yearlyPrice: 319000 }]);
    const { monthly, yearly } = blocks(card("Plan a"));
    expect(yearly.className).toMatch(/(^| )hidden( |$)/);

    expect(yearly.textContent).toContain(`${formatPrice(319000, "EGP", "en")} / year`);
    const struck = yearly.querySelector("s")!;
    expect(struck.textContent).toBe(formatPrice(382800, "EGP", "en"));
    expect(struck.textContent).toMatch(/3,828/);
    expect(within(yearly).getByText(perMonthText(`= ${formatPrice(26600, "EGP", "en")} / month`))).toBeTruthy();
    expect(formatPrice(26600, "EGP", "en")).toMatch(/266/);
    // Read with what it stands for: the struck price is not the price.
    expect(yearly.textContent).toContain("Instead of paying monthly for a year:");

    expect(monthly.querySelector("s")).toBeNull();
    expect(monthly.textContent).not.toMatch(/= .* \/ month/);
    expect(monthly.textContent).not.toContain(formatPrice(382800, "EGP", "en"));
  });

  it("writes the numbers as the rest of the page does in Arabic", () => {
    renderCards("ar", null, [{ ...plan("a"), monthlyPrice: 31900, yearlyPrice: 319000 }]);
    const { yearly } = blocks(card("Plan a"));
    expect(yearly.querySelector("s")!.textContent).toBe(formatPrice(382800, "EGP", "ar"));
    expect(formatPrice(382800, "EGP", "ar")).toMatch(/٣٬?٨٢٨/);
    expect(within(yearly).getByText(perMonthText(`= ${formatPrice(26600, "EGP", "ar")} / شهر`))).toBeTruthy();
  });

  it("follows the plan's prices when the console changes them", () => {
    renderCards("en", null, [{ ...plan("a"), monthlyPrice: 50000, yearlyPrice: 540000 }]);
    const { yearly } = blocks(card("Plan a"));
    expect(yearly.querySelector("s")!.textContent).toBe(formatPrice(600000, "EGP", "en"));
    expect(within(yearly).getByText(perMonthText(`= ${formatPrice(45000, "EGP", "en")} / month`))).toBeTruthy();
  });

  it("strikes nothing and says no saving when yearly is not less than twelve months", () => {
    renderCards("ar", null, [{ ...plan("a"), monthlyPrice: 10000, yearlyPrice: 120000 }]);
    const { yearly } = blocks(card("Plan a"));
    expect(yearly.querySelector("s")).toBeNull();
    expect(within(yearly).getByText(perMonthText(`= ${formatPrice(10000, "EGP", "ar")} / شهر`))).toBeTruthy();
    const switchLabel = screen.getByRole("radio", { name: /سنوي/ }).closest("label")!;
    expect(switchLabel.textContent).toBe("سنوي");
  });

  it("says save on the switch while one plan saves, with no number", () => {
    renderCards("en", null, [{ ...plan("a"), monthlyPrice: 10000, yearlyPrice: 120000 }, plan("b")]);
    expect(screen.getByRole("radio", { name: "Yearly · Save" })).toBeTruthy();
    // Plan a saves nothing: no struck price on it, while plan b has one.
    expect(blocks(card("Plan a")).yearly.querySelector("s")).toBeNull();
    expect(blocks(card("Plan b")).yearly.querySelector("s")).not.toBeNull();
  });

  it("no longer says two months free anywhere", () => {
    for (const locale of ["ar", "en"] as const) {
      const { container, unmount } = renderCards(locale, null);
      expect(container.textContent).not.toMatch(/شهر[اي]ن مجان|months? free/i);
      unmount();
    }
  });

  it.each([
    ["ar", getDictionary("ar")],
    ["en", getDictionary("en")],
  ])("is written with no number of its own (%s)", (_, dict) => {
    const { yearly, yearlySave, fullYearLabel, perMonthEquivalent, yearlyEquivalent } = dict.pricing;
    for (const text of [yearly, yearlySave, fullYearLabel, perMonthEquivalent, yearlyEquivalent]) {
      expect(text).not.toMatch(/[0-9٠-٩]/);
      expect(text).not.toMatch(/مجان|free/i);
    }
  });
});

describe("formatOrderCount", () => {
  it.each([
    [1, "طلب"],
    [2, "طلبين"],
    [3, "٣ طلبات"],
    [10, "١٠ طلبات"],
    [11, "١١ طلبا"],
    [99, "٩٩ طلبا"],
    [100, "١٠٠ طلب"],
    [103, "١٠٣ طلبات"],
  ])("%i in Arabic, after أول", (count, text) => {
    expect(formatOrderCount(count, "ar")).toBe(text);
  });

  it("says order or orders in English", () => {
    expect(formatOrderCount(1, "en")).toBe("order");
    expect(formatOrderCount(10, "en")).toBe("10 orders");
  });
});

describe("the pay-per-order words", () => {
  it.each([
    ["ar", getDictionary("ar")],
    ["en", getDictionary("en")],
  ])("hold no number of their own, and nothing not built (%s)", (_, dict) => {
    const texts = [
      ...Object.values(dict.pricing.payPerOrder).filter((v): v is string => typeof v === "string"),
      ...Object.values(dict.pricing.payPerOrder.faq),
      dict.service.bodyWithPayPerOrder,
      ...dict.service.points.flatMap((p) => (p.withPayPerOrder ? [p.withPayPerOrder] : [])),
    ];
    for (const text of texts) {
      // The fee and the free orders come from the plan: no digit in the words.
      expect(text).not.toMatch(/[0-9٠-٩]/);
      expect(text).not.toMatch(/Shopify|شوبيفاي|ذكي|\bAI\b|ذكاء اصطناعي/i);
    }
  });
});
