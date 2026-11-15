import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";
import type { PublicOffer } from "@/lib/plan-offer";
import { GALLERY, GALLERY_FIRST } from "@/lib/store-shots";
import { HomeEffects } from "./home-effects";
import { HomeFaq } from "./home-faq";
import { HomeHeader } from "./home-header";
import { HomePlans } from "./home-plans";
import { StoreShowcase } from "./store-showcase";

/**
 * The home page's own parts (app/[locale]/page.tsx): the plans with both
 * cycles in the HTML, the header, the stores gallery, the questions, and the
 * motion that starts once the page is idle.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/en" }));
// Next's Link needs the app router: a plain link, without the props an <a> has no use for.
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, className, "aria-label": label }: { href: string; children: ReactNode; onClick?: () => void; className?: string; "aria-label"?: string }) =>
    createElement("a", { href, onClick, className, "aria-label": label }, children),
}));

const en = getDictionary("en");

let media: Record<string, boolean>;
beforeEach(() => {
  media = {};
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: media[query] ?? false, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.className = "";
  document.body.innerHTML = "";
});

const offer: PublicOffer = {
  plans: [
    { id: "starter", name: "Starter", currency: "EGP", monthlyPrice: 31900, yearlyPrice: 319000, trialDays: 0, maxStores: 1, maxFunnelsPerMonth: 5, softOrderQuota: 1000, features: ["funnels", "custom_domain"] },
    { id: "max", name: "Max", currency: "EGP", monthlyPrice: 111900, yearlyPrice: 1119000, trialDays: 0, maxStores: null, maxFunnelsPerMonth: null, softOrderQuota: null, features: ["email_campaigns"] },
  ],
  payPerOrder: { id: "payg", name: "Pay per order", currency: "EGP", feePerOrder: 75, freeOrders: 50, feeChargedAt: "confirmation" },
};

describe("the home page's plans", () => {
  it("puts both cycles' prices in the HTML, for a reader without script", () => {
    const { container } = render(createElement(HomePlans, { initial: offer, copy: en.pricing, locale: "en" }));
    const text = container.textContent ?? "";
    for (const figure of ["319", "3,190", "1,119", "11,190"]) expect(text).toContain(figure);
    expect(container.querySelectorAll(".zm-m").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".zm-y").length).toBeGreaterThan(0);
  });

  it("switches the cycle with two radios the tag manager knows, and signs up for the plan and cycle", () => {
    const { container } = render(createElement(HomePlans, { initial: offer, copy: en.pricing, locale: "en" }));
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.name)).toEqual(["home-pricing-cycle", "home-pricing-cycle"]);
    expect(radios[1].classList.contains("cycle-yearly")).toBe(true);
    const starter = screen.getByRole("heading", { name: "Starter" }).closest("li")!;
    expect(starter.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Starter" }).id);
    const links = [...starter.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(["https://app.zimos.co/register?plan=starter&cycle=monthly", "https://app.zimos.co/register?plan=starter&cycle=yearly"]);
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);
  });

  it("raises the middle of three plans, with its badge and the brighter button, and no other", () => {
    const three: PublicOffer = {
      plans: [offer.plans[0], { ...offer.plans[0], id: "pro", name: "Pro", monthlyPrice: 71900, yearlyPrice: 719000 }, offer.plans[1]],
      payPerOrder: offer.payPerOrder,
    };
    const { container } = render(createElement(HomePlans, { initial: three, copy: en.pricing, locale: "en" }));
    const hot = container.querySelectorAll(".zm-plan--hot");
    expect(hot).toHaveLength(1);
    expect(hot[0].getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Pro" }).id);
    expect(hot[0].querySelector(".zm-badge")?.textContent).toBe(en.pricing.mostPopular);
    expect([...hot[0].querySelectorAll("a")].every((a) => a.classList.contains("zm-btn--volt"))).toBe(true);
    expect(container.querySelectorAll(".zm-badge")).toHaveLength(1);
    cleanup();
    // Two plans: no badge at all.
    const { container: two } = render(createElement(HomePlans, { initial: offer, copy: en.pricing, locale: "en" }));
    expect(two.querySelector(".zm-plan--hot, .zm-badge")).toBeNull();
  });

  it("offers pay per order as its own plan, and says so kindly when there is no plan", () => {
    render(createElement(HomePlans, { initial: offer, copy: en.pricing, locale: "en" }));
    expect(screen.getByRole("heading", { name: "Pay per order" }).closest("li")!.querySelector("a")!.getAttribute("href")).toBe("https://app.zimos.co/register?plan=payg");
    cleanup();
    render(createElement(HomePlans, { initial: null, copy: en.pricing, locale: "en" }));
    expect(screen.getByText(en.pricing.comingSoon)).toBeTruthy();
  });
});

describe("the home page's header", () => {
  const renderHeader = () => render(createElement(I18nProvider, { value: { locale: "en", dir: "ltr", dict: { nav: en.nav } } }, createElement(HomeHeader)));

  it("links each section by the id the other pages' header uses", () => {
    renderHeader();
    const nav = screen.getAllByRole("navigation", { name: en.nav.primaryLabel })[0];
    expect([...nav.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["#templates", "#benefits", "#how", "#growth", "#pricing", "#faq"]);
    expect([...nav.querySelectorAll("a")].every((a) => a.dataset.nav === a.getAttribute("href")!.slice(1))).toBe(true);
  });

  it("opens its sheet from the menu button and closes it on Escape", () => {
    renderHeader();
    const menu = screen.getByRole("button", { name: en.nav.openMenu });
    fireEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(menu.getAttribute("aria-controls")!)!.hidden).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: en.nav.openMenu }).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the stores gallery", () => {
  it("shows the first six, every store on asking, and a kind on its own", () => {
    const { container } = render(createElement(StoreShowcase, { copy: en.templates, locale: "en" }));
    const shown = () => container.querySelectorAll(".zm-sgrid > li:not([hidden])").length;
    expect(container.querySelectorAll(".zm-sgrid > li")).toHaveLength(GALLERY.length);
    expect(shown()).toBe(GALLERY_FIRST);
    fireEvent.click(screen.getByRole("button", { name: en.templates.showAll.replace("{n}", String(GALLERY.length)) }));
    expect(shown()).toBe(GALLERY.length);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.templates.kinds.food) }));
    expect(shown()).toBe(GALLERY.filter((store) => store.kind === "food").length);
  });

  it("links each card to the store's whole page, for a reader without script", () => {
    render(createElement(StoreShowcase, { copy: en.templates, locale: "en" }));
    const first = screen.getAllByRole("link", { name: en.templates.view })[0];
    expect(first.getAttribute("href")).toBe(`/stores/full/look-${GALLERY[0].look}-en-desk.webp`);
  });
});

describe("the questions", () => {
  it("are native disclosures, one open at a time, the first open", () => {
    const { container } = render(createElement(HomeFaq, { copy: en.faq, locale: "en" }));
    const details = [...container.querySelectorAll("details")];
    expect(details).toHaveLength(en.faq.items.length);
    expect(new Set(details.map((d) => d.getAttribute("name")))).toEqual(new Set(["zm-faq"]));
    expect(details.map((d) => d.open)).toEqual(details.map((_, i) => i === 0));
  });
});

describe("the home page's motion", () => {
  type Entry = { target: Element; isIntersecting: boolean };
  let observers: { cb: (entries: Entry[]) => void; observed: Element[] }[];

  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observed: Element[] = [];
        cb: (entries: Entry[]) => void;
        constructor(cb: (entries: Entry[]) => void) {
          this.cb = cb;
          observers.push(this);
        }
        observe(el: Element) {
          this.observed.push(el);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestIdleCallback", (fn: () => void) => {
      fn();
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", () => {});
  });

  const page = () => {
    document.body.innerHTML = `<div class="zm"><section class="zm-sec"><p class="rv" id="up"></p><p class="rv" id="down"></p><a class="zm-btn" data-mag id="mag" href="#"></a></section></div>`;
    const at = (id: string, top: number) =>
      vi.spyOn(document.getElementById(id)!, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 40, left: 100, right: 300, width: 200, height: 40, x: 100, y: top, toJSON() {} } as DOMRect);
    at("up", 100);
    at("down", 5000);
    at("mag", 200);
  };

  it("shows at once what is on screen, and reveals the rest as it comes into view", () => {
    page();
    render(createElement(HomeEffects));
    expect(document.documentElement.classList.contains("zm-fx")).toBe(true);
    expect(document.getElementById("up")!.classList.contains("is-in")).toBe(true);
    expect(document.getElementById("down")!.classList.contains("is-in")).toBe(false);
    act(() => observers[0].cb([{ target: document.getElementById("down")!, isIntersecting: true }]));
    expect(document.getElementById("down")!.classList.contains("is-in")).toBe(true);
  });

  it("moves nothing for someone who asked for less motion", () => {
    media["(prefers-reduced-motion: reduce)"] = true;
    media["(hover: hover) and (pointer: fine)"] = true;
    page();
    render(createElement(HomeEffects));
    expect(document.documentElement.classList.contains("zm-fx")).toBe(false);
    expect(observers[0].observed.some((el) => el.id === "mag")).toBe(false);
  });

  it("lets a button follow a mouse a few pixels at most", async () => {
    media["(hover: hover) and (pointer: fine)"] = true;
    page();
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
      fn(0);
      return 1;
    });
    render(createElement(HomeEffects));
    const mag = document.getElementById("mag")!;
    act(() => observers[0].cb([{ target: mag, isIntersecting: true }]));
    const move = new MouseEvent("pointermove", { clientX: 260, clientY: 230 }) as MouseEvent & { pointerType: string };
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    window.dispatchEvent(move);
    await waitFor(() => expect(mag.style.translate).not.toBe(""));
    const [x, y] = mag.style.translate.split(" ").map((v) => Math.abs(parseFloat(v)));
    expect(x).toBeLessThanOrEqual(4);
    expect(y).toBeLessThanOrEqual(3);
  });
});
