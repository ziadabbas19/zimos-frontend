import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CartRewardsBar, cartRewardsStatus, nextTier, previewApplied, rewardsFill, type RewardTier } from "@store-builder/ui/cart-rewards";

// The rewards bar (packages/ui/src/cart-rewards), as the cart sheet, the cart
// page, the checkout and the dashboard's preview draw it: what the line above
// it says, how full it is and which dots are reached, in both directions.

const TIERS: RewardTier[] = [
  { thresholdAmount: 50000, type: "free_shipping", value: null, label: { en: "Free shipping", ar: "شحن مجاني" } },
  { thresholdAmount: 100000, type: "percent", value: 5, label: { en: "5% off", ar: "خصم 5%" } },
  { thresholdAmount: 200000, type: "percent", value: 10, label: { en: "10% off", ar: "خصم 10%" } },
];
const egp = (n: number) => `EGP ${(n / 100).toLocaleString("en")}`;
const arEgp = (n: number) => `${(n / 100).toLocaleString("ar-EG")} ج.م`;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function bar(props: Partial<Parameters<typeof CartRewardsBar>[0]> = {}) {
  return render(<CartRewardsBar tiers={TIERS} subtotal={0} applied={null} locale="en" formatMoney={egp} {...props} />);
}

const progress = () => screen.getByRole("progressbar", { name: "Rewards progress" });
const fill = () => progress().firstElementChild as HTMLElement;

describe("where a cart stands", () => {
  it("fills in equal steps, each step in proportion to the money between its thresholds", () => {
    expect(rewardsFill(TIERS, 0)).toBe(0);
    expect(rewardsFill(TIERS, 25000)).toBeCloseTo(1 / 6);
    expect(rewardsFill(TIERS, 50000)).toBeCloseTo(1 / 3);
    expect(rewardsFill(TIERS, 150000)).toBeCloseTo(5 / 6);
    expect(rewardsFill(TIERS, 999999)).toBe(1);
    expect(rewardsFill([], 5000)).toBe(0);
  });

  it("names the next tier and what it needs; none once all are reached", () => {
    expect(nextTier(TIERS, 120000)).toMatchObject({ index: 2, remainingAmount: 80000 });
    expect(nextTier(TIERS, 100000)).toMatchObject({ index: 2 });
    expect(nextTier(TIERS, 200000)).toBeNull();
  });

  it("the dashboard's preview applies the biggest reached discount, else free shipping", () => {
    expect(previewApplied(TIERS, 40000)).toBeNull();
    expect(previewApplied(TIERS, 60000)?.type).toBe("free_shipping");
    expect(previewApplied(TIERS, 250000)?.value).toBe(10);
  });
});

describe("the bar", () => {
  it("no tier reached: says what the first one needs, empty fill, every dot open", () => {
    bar({ subtotal: 20000 });
    expect(screen.getByText("Add EGP 300 more for Free shipping")).toBeTruthy();
    expect(progress().getAttribute("aria-valuenow")).toBe("13");
    expect(progress().getAttribute("aria-valuetext")).toBe("Add EGP 300 more for Free shipping");
    // A transform, never a width.
    expect(fill().style.transform).toMatch(/^scaleX\(/);
    expect(fill().style.width).toBe("");
  });

  it("between tiers: what is applied and what the next one needs", () => {
    bar({ subtotal: 100000, applied: { label: TIERS[1].label } });
    expect(screen.getByText("5% off applied automatically, EGP 1,000 more for 10% off")).toBeTruthy();
    expect(progress().getAttribute("aria-valuenow")).toBe("67");
  });

  it("all reached: says so, full bar", () => {
    bar({ subtotal: 210000, applied: { label: TIERS[2].label } });
    expect(screen.getByText("10% off applied automatically. Every reward unlocked")).toBeTruthy();
    expect(progress().getAttribute("aria-valuenow")).toBe("100");
  });

  it("right to left: Arabic words, the fill growing from the right edge", () => {
    render(
      <div dir="rtl">
        <CartRewardsBar tiers={TIERS} subtotal={60000} applied={{ label: TIERS[0].label }} locale="ar" formatMoney={arEgp} />
      </div>
    );
    const bar = screen.getByRole("progressbar", { name: "التقدم نحو المكافآت" });
    expect(bar.getAttribute("aria-valuetext")).toBe(`شحن مجاني اتطبّق تلقائيًا، ضيف ${arEgp(40000)} كمان وتاخد خصم 5%`);
    const inner = bar.firstElementChild as HTMLElement;
    expect(inner.className).toContain("origin-left");
    expect(inner.className).toContain("rtl:origin-right");
    // The dots sit on the inline start side's scale, whatever the direction.
    const dots = bar.parentElement!.querySelectorAll<HTMLElement>("span[aria-hidden='true'][style]");
    expect(dots).toHaveLength(3);
    expect(dots[0].style.insetInlineStart).toContain("0.3333");
  });

  it("the server's notes, in the shopper's language", () => {
    bar({ subtotal: 150000, applied: { label: TIERS[1].label }, notes: ["discount_over_free_shipping", "unknown_note"] });
    expect(screen.getByText("Discount applied instead of free shipping, it saves you more")).toBeTruthy();
    expect(screen.queryByText("unknown_note")).toBeNull();
  });

  it("a skeleton of the same card while there are no numbers yet", () => {
    bar({ loading: true });
    expect(screen.getByLabelText("Loading your rewards").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("announces a tier the moment it is reached", () => {
    const view = bar({ subtotal: 40000 });
    view.rerender(<CartRewardsBar tiers={TIERS} subtotal={60000} applied={{ label: TIERS[0].label }} locale="en" formatMoney={egp} />);
    expect(screen.getByText("Free shipping unlocked")).toBeTruthy();
  });

  it("under reduced motion the fill is where it belongs at once", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }));
    bar({ subtotal: 200000 });
    expect(fill().style.transform).toBe("scaleX(1)");
  });

  it("draws nothing for a store without tiers", () => {
    const { container } = bar({ tiers: [] });
    expect(container.innerHTML).toBe("");
  });

  it("the status line is one function, shared with the screen reader text", () => {
    expect(cartRewardsStatus({ tiers: TIERS, subtotal: 0, applied: null, locale: "en", formatMoney: egp })).toBe("Add EGP 500 more for Free shipping");
  });
});
