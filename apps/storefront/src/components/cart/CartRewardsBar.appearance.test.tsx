import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  CartRewardsBar,
  INHERITED_LOOK,
  autoFixLook,
  contrastProblems,
  contrastRatio,
  parseCssColor,
  readableAccent,
  rewardIconOf,
  type BarAppearance,
  type BarLook,
  type RewardTier,
} from "@store-builder/ui/cart-rewards";

// The bar's look (packages/ui/src/cart-rewards): the store's theme by default,
// drawn as it always was with the theme's colour tokens (so a theme change, dark
// mode included, reaches it with no say of its own); or the merchant's custom
// look — each shape, corner, colour, marker, size, icon and line. A reached
// reward reads as reached by its shape too, not only its colour.

const TIERS: RewardTier[] = [
  { thresholdAmount: 50000, type: "free_shipping", value: null, label: { en: "Free shipping", ar: "شحن مجاني" } },
  { thresholdAmount: 100000, type: "percent", value: 5, label: { en: "5% off", ar: "خصم 5%" }, icon: "crown" },
  { thresholdAmount: 200000, type: "fixed", value: 2000, label: { en: "EGP 20 off", ar: "خصم ٢٠ ج.م" } },
];
const egp = (n: number) => `EGP ${(n / 100).toLocaleString("en")}`;

afterEach(cleanup);

const custom = (change: Partial<BarLook> = {}): BarAppearance => ({ mode: "custom", ...INHERITED_LOOK, ...change });
function bar(props: Partial<Parameters<typeof CartRewardsBar>[0]> = {}, dir: "ltr" | "rtl" = "ltr") {
  return render(
    <div dir={dir}>
      <CartRewardsBar tiers={TIERS} subtotal={120000} applied={null} locale={dir === "rtl" ? "ar" : "en"} formatMoney={egp} {...props} />
    </div>
  );
}
const track = () => screen.getByRole("progressbar");
const markers = () => Array.from(document.querySelectorAll<HTMLElement>("span[aria-hidden='true'].absolute"));

describe("match the store style (the default)", () => {
  it("fills with the store's accent, on the theme's tokens: a rounded 8px track, 28px circles, amounts, the message at the start", () => {
    bar();
    expect(track().className).toBe("relative h-2 overflow-hidden rounded-full bg-line");
    const fill = track().firstElementChild as HTMLElement;
    expect(fill.className).toContain("bg-primary");
    expect(fill.className).not.toContain("bg-success");
    expect(fill.className).toContain("rounded-full");
    expect(fill.className).toContain("rtl:origin-right");
    expect(fill.style.backgroundColor).toBe("");
    expect(track().style.backgroundColor).toBe("");
    const [first, second, third] = markers();
    expect(first.className).toContain("h-7 w-7");
    expect(first.className).toContain("rounded-full");
    expect(first.style.backgroundColor).toBe("");
    expect(second.className).toContain("border-primary bg-primary text-on-primary");
    expect(third.className).toContain("border-line-strong bg-paper-raised text-ink-soft");
    expect(screen.getByText("EGP 500")).toBeTruthy();
    expect(screen.getByText(/more for EGP 20 off/).className).not.toContain("text-center");
  });

  it("draws the same with no look, an `inherit` one, and in a dark store: the theme decides the colours", () => {
    // useId differs per render; nothing else may.
    const markup = (html: string) => html.replace(/_r_\w+_/g, "id");
    const none = markup(bar({ appearance: null }).container.firstElementChild!.innerHTML);
    cleanup();
    const inherit = markup(bar({ appearance: { mode: "inherit" } }).container.firstElementChild!.innerHTML);
    cleanup();
    const dark = markup(
      render(
        <div data-color-mode="dark" dir="ltr">
          <CartRewardsBar tiers={TIERS} subtotal={120000} applied={null} locale="en" formatMoney={egp} appearance={{ mode: "inherit" }} />
        </div>
      ).container.firstElementChild!.innerHTML
    );
    expect(inherit).toBe(none);
    expect(dark).toBe(none);
    // No colour of its own anywhere: only the theme's classes.
    expect(none).not.toMatch(/background-color|border-color/);
  });

  it("still shows each reward's icon, the merchant's or its kind's", () => {
    bar();
    const icons = Array.from(document.querySelectorAll("[data-reward-icon]")).map((el) => el.getAttribute("data-reward-icon"));
    expect(icons).toEqual(["truck", "crown", "tag"]);
    expect(rewardIconOf({ type: "percent" })).toBe("percent");
    expect(rewardIconOf({ type: "free_shipping", icon: "rocket" })).toBe("truck");
  });
});

describe("the accent, kept readable (the store's style)", () => {
  // The page's colours, as a theme would draw them: the accent, the track (line) and the card (paper).
  function themed(accent: string, mode: "light" | "dark" = "light") {
    const style = document.createElement("style");
    const [line, paper] = mode === "light" ? ["#dcdace", "#f5f4ef"] : ["#22304a", "#0b1220"];
    style.textContent = `.bg-primary{background-color:${accent}} .bg-line{background-color:${line}} .bg-paper{background-color:${paper}}`;
    document.head.appendChild(style);
    return () => style.remove();
  }
  afterEach(() => vi.unstubAllGlobals());

  it("keeps an accent that reads on the track and the card as it is (its class, no colour of its own)", async () => {
    const undo = themed("#1f5d5b");
    bar();
    await new Promise((r) => setTimeout(r, 30));
    const fill = track().firstElementChild as HTMLElement;
    expect(fill.className).toContain("bg-primary");
    expect(fill.style.backgroundColor).toBe("");
    undo();
  });

  it("swaps a pale accent for the nearest shade that reaches 3:1, on its markers too", async () => {
    const undo = themed("#ffe066");
    bar();
    const fill = track().firstElementChild as HTMLElement;
    await waitFor(() => expect(fill.style.backgroundColor).not.toBe(""));
    const shown = parseCssColor(fill.style.backgroundColor)!;
    expect(contrastRatio(shown, "#dcdace")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(shown, "#f5f4ef")).toBeGreaterThanOrEqual(3);
    expect(markers()[0].style.backgroundColor).toBe(fill.style.backgroundColor);
    undo();
  });

  it("in dark mode, lightens an accent too dark to read there", () => {
    const shown = readableAccent("#1f2a44", ["#22304a", "#0b1220"]);
    expect(contrastRatio(shown, "#22304a")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(shown, "#0b1220")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(shown, "#ffffff")).toBeLessThan(contrastRatio("#1f2a44", "#ffffff"));
    // And leaves the dark default accent (#5b8df6) alone.
    expect(readableAccent("#5b8df6", ["#22304a", "#0b1220"])).toBe("#5b8df6");
  });

  it("reads the colours the browser gives back", () => {
    expect(parseCssColor("rgb(31, 93, 91)")).toBe("#1f5d5b");
    expect(parseCssColor("rgba(0, 0, 0, 0)")).toBeNull();
    expect(parseCssColor("color(srgb 1 0 0)")).toBe("#ff0000");
    expect(parseCssColor("oklch(0.6 0.15 150)")).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseCssColor("oklab(1 0 0)")).toBe("#ffffff");
    expect(parseCssColor("transparent")).toBeNull();
  });
});

describe("customize", () => {
  it.each([
    ["thin", "h-1"],
    ["thick", "h-2"],
  ] as const)("%s bar", (shape, height) => {
    bar({ appearance: custom({ shape }) });
    expect(track().className).toContain(height);
  });

  it("segmented: one segment per reward, each filling over its own step", async () => {
    bar({ appearance: custom({ shape: "segmented" }) });
    const segments = track().querySelectorAll("[data-segment]");
    expect(segments).toHaveLength(3);
    const scale = (i: number) => (segments[i].firstElementChild as HTMLElement).style.transform;
    await waitFor(() => expect(scale(0)).toBe("scaleX(1)"));
    expect(scale(1)).toBe("scaleX(1)");
    expect(scale(2)).toMatch(/^scaleX\(0\.2/);
  });

  it("square corners, and its own fill and track colours", () => {
    bar({ appearance: custom({ corners: "square", fillColor: "#1d4ed8", trackColor: "#e5e7eb" }) });
    expect(track().className).toContain("rounded-none");
    expect(track().style.backgroundColor).toBe("rgb(229, 231, 235)");
    const fill = track().firstElementChild as HTMLElement;
    expect(fill.style.backgroundColor).toBe("rgb(29, 78, 216)");
    // A reached marker takes the fill, and an icon colour that reads on it.
    const reached = markers()[0];
    expect(reached.style.backgroundColor).toBe("rgb(29, 78, 216)");
    expect(reached.style.color).toBe("rgb(255, 255, 255)");
  });

  it.each([
    ["sm", "h-[22px] w-[22px]", "12"],
    ["md", "h-7 w-7", "14"],
    ["lg", "h-9 w-9", "18"],
  ] as const)("%s markers", (markerSize, cls, icon) => {
    bar({ appearance: custom({ markerSize }) });
    expect(markers()[0].className).toContain(cls);
    expect(markers()[0].querySelector("svg")?.getAttribute("width")).toBe(icon);
  });

  it("rounded square markers", () => {
    bar({ appearance: custom({ marker: "rounded_square" }) });
    expect(markers()[0].className).toContain("rounded-md");
  });

  it("no markers: the icon sits by each name, filled once reached, outlined until then", () => {
    bar({ appearance: custom({ marker: "none" }) });
    expect(markers()).toHaveLength(0);
    const icons = Array.from(document.querySelectorAll("li [data-reward-icon]"));
    expect(icons.map((el) => el.hasAttribute("data-filled"))).toEqual([true, true, false]);
  });

  it("the amounts under the markers and the message can go; the message can be centred", () => {
    bar({ appearance: custom({ showAmounts: false, messageAlign: "center" }) });
    expect(screen.queryByText("EGP 500")).toBeNull();
    expect(screen.getByText(/more for EGP 20 off/).className).toContain("text-center");
    cleanup();
    bar({ appearance: custom({ showMessage: false }) });
    expect(screen.queryByText(/more for EGP 20 off/)).toBeNull();
    // Screen readers still hear it, as the bar's value.
    expect(track().getAttribute("aria-valuetext")).toMatch(/more for EGP 20 off/);
  });

  it("fills from the start side in Arabic", () => {
    bar({ appearance: custom({ fillColor: "#1d4ed8" }) }, "rtl");
    expect((track().firstElementChild as HTMLElement).className).toContain("rtl:origin-right");
    expect(markers()[0].style.insetInlineStart).toContain("calc(");
  });

  it("reached and not reached differ by more than colour: a filled marker against an outlined one", () => {
    bar({ appearance: custom({ fillColor: "#1d4ed8", trackColor: "#e5e7eb" }) });
    const [reached, , unreached] = markers();
    expect(reached.hasAttribute("data-reached")).toBe(true);
    expect(reached.style.backgroundColor).not.toBe("");
    expect(unreached.hasAttribute("data-reached")).toBe(false);
    expect(unreached.className).toContain("bg-paper-raised");
    expect(unreached.className).toContain("border-2");
  });
});

describe("the cart's speed", () => {
  it("glides the fill at the merchant's speed; none moves nothing", () => {
    bar({ speed: "normal" });
    expect((track().firstElementChild as HTMLElement).style.transitionDuration).toBe("500ms");
    cleanup();
    bar({ speed: "none" });
    expect((track().firstElementChild as HTMLElement).style.transitionDuration).toBe("0ms");
    cleanup();
    bar({ speed: "fast" });
    expect((track().firstElementChild as HTMLElement).style.transitionDuration).toBe("");
  });
});

describe("contrast", () => {
  it("names a failing pair, and the auto-fix nudges the merchant's colour until it passes", () => {
    const pale: BarLook = { ...INHERITED_LOOK, fillColor: "#e0e0e0", trackColor: "#eeeeee" };
    const problems = contrastProblems(pale);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ field: "fillColor", pair: "fill_track" });
    const fixed = autoFixLook(pale);
    expect(fixed.trackColor).toBe("#eeeeee");
    expect(contrastRatio(fixed.fillColor!, "#eeeeee")).toBeGreaterThanOrEqual(3);
    expect(contrastProblems(fixed)).toEqual([]);
    // Only the track is the merchant's: the track moves, against the theme's fill.
    const trackOnly = autoFixLook({ ...INHERITED_LOOK, trackColor: "#3a7a58" });
    expect(contrastProblems(trackOnly)).toEqual([]);
    expect(contrastProblems(INHERITED_LOOK)).toEqual([]);
  });
});
