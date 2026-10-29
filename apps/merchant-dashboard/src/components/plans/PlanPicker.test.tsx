import { useState } from "react";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicPlan } from "@store-builder/api-client";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PlanPicker, type PlanChoice } from "./PlanPicker";

/**
 * The plan step of sign-up (and of an account made through Google): under a
 * yearly price, the year at the monthly price struck out and what it comes
 * to a month, from the plan's prices (@store-builder/ui/plan-pricing, as on
 * the marketing site's pricing page); nothing of the kind on monthly.
 */

const plan = (overrides: Partial<PublicPlan> = {}): PublicPlan => ({
  id: "plan_basic",
  name: "Basic",
  currency: "EGP",
  monthlyPrice: 31900,
  yearlyPrice: 319000,
  trialDays: 14,
  maxStores: 1,
  maxFunnelsPerMonth: null,
  softOrderQuota: null,
  features: [],
  ...overrides,
});

function Picker({ plans }: { plans: PublicPlan[] }) {
  const [choice, setChoice] = useState<PlanChoice>({ planId: plans[0].id, billingCycle: "monthly" });
  return <PlanPicker plans={plans} value={choice} onChange={setChoice} />;
}

const cardOf = (name: string) => screen.getByText(name).closest("label")!;

afterEach(cleanup);

describe("PlanPicker's yearly price", () => {
  it("shows nothing more on monthly, and on yearly the struck year and the price a month", async () => {
    const { user } = renderWithProviders(<Picker plans={[plan()]} />);
    const basic = cardOf("Basic");
    expect(basic.querySelector("s")).toBeNull();
    expect(within(basic).queryByText(/^= /)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Yearly · Save" }));
    // EGP 3,190 a year: 12 × 319 = 3,828 struck out, 3,190 / 12 = 265.83 → 266 a month.
    expect(basic.querySelector("s")?.textContent).toMatch(/3,828/);
    expect(within(basic).getByText(/^= .*266 \/ month$/)).toBeInTheDocument();
    expect(basic.textContent).toContain("Instead of paying monthly for a year:");
    expect(document.body.textContent).not.toMatch(/months free/);
  });

  it("strikes nothing, and the switch says no saving, when yearly is twelve months", async () => {
    const { user } = renderWithProviders(<Picker plans={[plan({ monthlyPrice: 10000, yearlyPrice: 120000 })]} />);
    await user.click(screen.getByRole("radio", { name: "Yearly" }));
    const basic = cardOf("Basic");
    expect(basic.querySelector("s")).toBeNull();
    expect(within(basic).getByText(/^= .*100 \/ month$/)).toBeInTheDocument();
  });

  it("writes Arabic digits under Arabic", async () => {
    const { user } = renderWithProviders(<Picker plans={[plan()]} />, { locale: "ar" });
    await user.click(screen.getByRole("radio", { name: "سنوي · وفّر" }));
    const basic = cardOf("Basic");
    expect(basic.querySelector("s")?.textContent).toMatch(/٣٬٨٢٨/);
    expect(within(basic).getByText(/^= .*٢٦٦.* \/ شهر$/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/شهران مجان/);
  });
});
