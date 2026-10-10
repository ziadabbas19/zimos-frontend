import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { heroLookMarkup, resolveHeroLook } from "./heroLook";
import { HeroSlider, type HeroSlide } from "./HeroSlider";

// Read from disk: this runner hands back an empty string for an imported stylesheet.
const css = readFileSync(resolve(__dirname, "../../../app/store-sections.css"), "utf8").replace(/\r\n/g, "\n");

// A plain anchor: the slider's button needs no store around it here.
vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const PICTURE = "https://cdn.zimos.test/hero.jpg";

/** A slide as showcase/index.tsx hands it over, from the props a merchant saved. */
function slideOf(props: Record<string, unknown>, enabled: boolean): HeroSlide {
  const look = resolveHeroLook(props, enabled);
  return {
    key: "0",
    image: PICTURE,
    mobileImage: null,
    alt: "",
    eyebrow: "",
    heading: "Summer",
    subheading: "",
    buttonLabel: "",
    buttonHref: null,
    side: look.desktop.side,
    vertical: look.desktop.vertical,
    ...heroLookMarkup(look),
    contentWidth: 620,
    text: props.text === "light" ? "light" : "dark",
  };
}

function draw(slides: HeroSlide[], more: Partial<ComponentProps<typeof HeroSlider>> = {}) {
  const view = render(
    <HeroSlider
      slides={slides}
      autoplay={false}
      seconds={5}
      startDelay={5}
      arrows
      dots
      wave={false}
      rtl={false}
      label="Offers"
      labels={{ previous: "Previous", next: "Next", slide: "Slide" }}
      {...more}
    />
  );
  return { ...view, slide: view.container.querySelector<HTMLElement>(".zs-hero__slide")! };
}

describe("a slide's place and veil", () => {
  it("draws a slide saved before them exactly as it was: no new attribute, no veil", () => {
    for (const enabled of [true, false]) {
      const { slide, unmount } = draw([slideOf({ side: "start", vertical: "top" }, enabled)]);
      expect(slide.getAttributeNames().sort()).toEqual(["class", "data-h", "data-text", "data-v"]);
      expect(slide.getAttribute("data-h")).toBe("start");
      expect(slide.getAttribute("data-v")).toBe("top");
      expect(slide.querySelector(".zs-hero__overlay")).toBeNull();
      expect(Array.from(slide.querySelector(".zs-hero__media")!.children, (child) => child.tagName)).toEqual(["PICTURE"]);
      unmount();
    }
  });

  it("names the phone's place only where it differs, and draws the veil with an opacity for each device", () => {
    const { slide } = draw([slideOf({ side: "start", vertical: "top", sideMobile: "center", verticalMobile: "top", overlay: 40, overlayMobile: 20, text: "light" }, true)]);
    expect(slide.getAttribute("data-h")).toBe("start");
    expect(slide.getAttribute("data-hm")).toBe("center");
    // The same height on both: nothing to say for the phone.
    expect(slide.hasAttribute("data-vm")).toBe(false);
    expect(slide.getAttribute("data-text")).toBe("light");

    const veil = slide.querySelector<HTMLElement>(".zs-hero__overlay")!;
    expect(veil.getAttribute("aria-hidden")).toBe("true");
    expect(veil.style.getPropertyValue("--zs-ov")).toBe("0.4");
    expect(veil.style.getPropertyValue("--zs-ov-m")).toBe("0.2");
    // Inside the picture's own box, so it is clipped with it; the text sits above both.
    expect(veil.parentElement?.className).toBe("zs-hero__media");
  });

  it("draws none of it while the switch is off, whatever the slide holds", () => {
    const { slide } = draw([slideOf({ sideMobile: "end", verticalMobile: "top", overlay: 50, overlayMobile: 10 }, false)]);
    expect(slide.getAttributeNames().sort()).toEqual(["class", "data-h", "data-text", "data-v"]);
    expect(slide.querySelector(".zs-hero__overlay")).toBeNull();
  });
});

describe("the stylesheet behind them", () => {
  // The phone's block: from its comment to the brace that closes its media query.
  const from = css.indexOf("A phone's own veil");
  const phone = css.slice(from, css.indexOf("\n}\n", from));

  it("keeps the phone's rules in the hero's own narrow layout", () => {
    expect(from).toBeGreaterThan(0);
    expect(phone).toContain("@media (max-width: 749px) {");
  });

  it("moves the text on a phone for each of the six places", () => {
    for (const rule of [
      '[data-vm="top"] .zs-hero__shell { align-items: flex-start; }',
      '[data-vm="middle"] .zs-hero__shell { align-items: center; }',
      '[data-vm="bottom"] .zs-hero__shell { align-items: flex-end; }',
      '[data-hm="start"] .zs-hero__shell { justify-content: flex-start; }',
      '[data-hm="center"] .zs-hero__shell { justify-content: center; }',
      '[data-hm="end"] .zs-hero__shell { justify-content: flex-end; }',
    ]) {
      expect(phone).toContain(rule);
    }
    // After the computer's rules, so on a phone the phone's rule is the one that holds.
    expect(css.indexOf('[data-vm="top"]')).toBeGreaterThan(css.indexOf('.zs-hero__slide[data-v="top"]'));
  });

  it("falls back to the computer's veil on a phone, and to none at all", () => {
    expect(css).toContain("opacity: var(--zs-ov, 0);");
    expect(phone).toContain(".zs-hero__overlay { opacity: var(--zs-ov-m, var(--zs-ov, 0)); }");
  });

  it("is light under dark text and dark under light text, and never takes a press", () => {
    const base = css.slice(css.indexOf(".zs-hero__overlay {"), css.indexOf("}", css.indexOf(".zs-hero__overlay {")));
    expect(base).toContain("background: #fff;");
    expect(base).toContain("pointer-events: none;");
    expect(css).toMatch(/\.zs-hero__slide\[data-text="light"\] \.zs-hero__overlay \{\s*background: #000;/);
  });
});
