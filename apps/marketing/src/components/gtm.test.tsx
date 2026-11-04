import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tag Manager on the marketing site (lib/gtm.ts, components/gtm.tsx): off
 * without NEXT_PUBLIC_GTM_ID or when the visitor refuses tracking, and the
 * events it puts on the dataLayer for each kind of click.
 */

const nav = vi.hoisted(() => ({ path: "/en/pricing", query: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useSearchParams: () => new URLSearchParams(nav.query) }));

type Win = Window & { dataLayer?: Record<string, unknown>[] };

/** The modules read the id once, on import. */
async function load(id: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", id);
  return { lib: await import("@/lib/gtm"), component: await import("./gtm") };
}

const page = new URL("https://zimos.co/en");

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

const el = (selector: string) => document.querySelector(selector) as Element;

afterEach(() => {
  cleanup();
  nav.path = "/en/pricing";
  nav.query = "";
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete (window as Win).dataLayer;
  document.getElementById("gtm-script")?.remove();
  document.body.innerHTML = "";
});

describe("loading", () => {
  it("loads nothing without a container id", async () => {
    const { component } = await load("");
    render(createElement(component.Gtm));
    expect(document.getElementById("gtm-script")).toBeNull();
    expect((window as Win).dataLayer).toBeUndefined();
  });

  it("loads nothing when the visitor asks not to be tracked", async () => {
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    const { component } = await load("GTM-ABC1234");
    render(createElement(component.Gtm));
    expect(document.getElementById("gtm-script")).toBeNull();
  });

  it("loads the container, then sends the page view", async () => {
    const { component } = await load("GTM-ABC1234");
    render(createElement(component.Gtm));
    expect(document.getElementById("gtm-script")?.getAttribute("src")).toBe(
      "https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234"
    );
    const events = (window as Win).dataLayer!.map((e) => e.event);
    expect(events).toEqual(["gtm.js", "virtual_page_view"]);
    expect((window as Win).dataLayer![1]).toMatchObject({ page_type: "pricing", site_language: "en", page_path: "/en/pricing" });
  });

  it("the hidden sign-up page: the container, then the sign-up, and no page view", async () => {
    nav.path = "/ar/signed-up";
    nav.query = "method=email&plan=basic&cycle=monthly";
    const { component } = await load("GTM-ABC1234");
    const { SignedUp } = await import("./signed-up");
    render(createElement("div", null, createElement(SignedUp), createElement(component.Gtm)));
    expect((window as Win).dataLayer).toEqual([
      expect.objectContaining({ event: "gtm.js" }),
      { event: "sign_up", method: "email", plan_id: "basic", billing_cycle: "monthly" },
    ]);
  });

  it("refuses an id that is not a container's", async () => {
    const { lib } = await load("G-ABC1234");
    expect(lib.GTM_ID).toBeNull();
  });
});

describe("events", () => {
  it("names the page", async () => {
    const { lib } = await load("GTM-ABC1234");
    expect(lib.pageTypeOf("/ar")).toBe("home");
    expect(lib.pageTypeOf("/en/features")).toBe("features");
    expect(lib.pageTypeOf("/ar/refund-policy")).toBe("refund-policy");
  });

  it("a sign-up from a plan card names the plan, the cycle and where it was", async () => {
    const { lib } = await load("GTM-ABC1234");
    mount(`<main><section data-section="pricing"><ul><li aria-labelledby="p-1"><h3 id="p-1">Pro</h3>
      <a id="go" href="https://app.zimos.co/register?plan=pro-id&cycle=yearly">Start</a></li></ul></section></main>`);
    expect(lib.clickEvent(el("#go"), page)).toEqual({
      event: "sign_up_click",
      cta_location: "pricing",
      cta_text: "Start",
      plan_id: "pro-id",
      plan_name: "Pro",
      billing_cycle: "yearly",
    });
  });

  it("a sign-up without a plan, and a sign-in from the header", async () => {
    const { lib } = await load("GTM-ABC1234");
    mount(`<header class="lz-top"><a id="in" href="https://app.zimos.co/login">Sign in</a></header>
      <main><section data-section="hero"><section><a id="up" href="https://app.zimos.co/register">Start free</a></section></section></main>`);
    expect(lib.clickEvent(el("#up"), page)).toMatchObject({ event: "sign_up_click", cta_location: "hero", plan_id: "", plan_name: "" });
    expect(lib.clickEvent(el("#in"), page)).toEqual({ event: "login_click", cta_location: "header", cta_text: "Sign in" });
  });

  it("contact, social, language and site links", async () => {
    const { lib } = await load("GTM-ABC1234");
    mount(`<footer>
      <a id="mail" href="mailto:hi@zimos.co">mail</a><a id="tel" href="tel:+20100">tel</a>
      <a id="wa" href="https://wa.me/20100">wa</a><a id="ig" href="https://www.instagram.com/zimos">ig</a>
      <a id="ar" href="/ar">العربية</a><a id="pr" href="/en/pricing#plans">Pricing</a>
      <a id="out" href="https://example.com/x">other</a></footer>`);
    expect(lib.clickEvent(el("#mail"), page)).toEqual({ event: "contact_click", contact_method: "email", cta_location: "footer" });
    expect(lib.clickEvent(el("#tel"), page)).toMatchObject({ contact_method: "phone" });
    expect(lib.clickEvent(el("#wa"), page)).toMatchObject({ contact_method: "whatsapp" });
    expect(lib.clickEvent(el("#ig"), page)).toEqual({ event: "social_click", social_network: "instagram", cta_location: "footer" });
    expect(lib.clickEvent(el("#ar"), page)).toEqual({ event: "language_switch", language_to: "ar", cta_location: "footer" });
    expect(lib.clickEvent(el("#pr"), page)).toEqual({
      event: "nav_click",
      link_text: "Pricing",
      link_url: "/en/pricing#plans",
      cta_location: "footer",
    });
    expect(lib.clickEvent(el("#out"), page)).toBeNull();
  });

  it("a section with neither data-section nor id is named by its heading", async () => {
    const { lib } = await load("GTM-ABC1234");
    mount(`<main><section aria-labelledby="contact-heading"><h2 id="contact-heading">Contact</h2>
      <a id="mail" href="mailto:hi@zimos.co">mail</a></section></main>`);
    expect(lib.clickEvent(el("#mail"), page)).toMatchObject({ event: "contact_click", cta_location: "contact" });
  });

  it("tabs, buttons, the mobile menu", async () => {
    const { lib } = await load("GTM-ABC1234");
    mount(`<header class="lz-top"><button id="menu" aria-label="Open menu"></button>
      <div class="lz-sheet"><a id="sheet" href="/en/features">Features</a></div></header>
      <main><section id="panel" data-section="dashboard"><div role="tablist" aria-label="The dashboard">
      <button id="tab" role="tab"><span>Orders</span></button></div></section></main>`);
    expect(lib.clickEvent(el("#tab span"), page)).toEqual({
      event: "tab_click",
      tab_group: "The dashboard",
      tab_name: "Orders",
      cta_location: "dashboard",
    });
    expect(lib.clickEvent(el("#menu"), page)).toEqual({ event: "ui_click", click_text: "Open menu", cta_location: "header" });
    expect(lib.clickEvent(el("#sheet"), page)).toMatchObject({ event: "nav_click", cta_location: "header_menu" });
  });

  it("a FAQ question opened, the pricing cycle, the features search", async () => {
    const { lib } = await load("GTM-ABC1234");
    mount(`<main><section id="faq"><div><details id="q1"><summary>One?</summary></details>
      <details id="q2" open><summary> Two? </summary></details></div></section>
      <input id="m" type="radio" name="p-cycle" /><input id="y" type="radio" name="p-cycle" class="cycle-yearly" checked />
      <input id="s" type="search" value=" sms " /></main>`);
    expect(lib.faqEvent(el("#q1"))).toBeNull();
    expect(lib.faqEvent(el("#q2"))).toEqual({ event: "faq_open", faq_question: "Two?", faq_position: 2, cta_location: "faq" });
    expect(lib.changeEvent(el("#y"))).toEqual({ event: "pricing_cycle_change", billing_cycle: "yearly" });
    expect(lib.changeEvent(el("#m"))).toBeNull();
    expect(lib.changeEvent(el("#s"))).toEqual({ event: "search", search_term: "sms", cta_location: "page" });
  });

  it("reads the sign-up the dashboard reports, keeping only plain words", async () => {
    const { lib } = await load("GTM-ABC1234");
    expect(lib.signUpEvent(new URLSearchParams("method=google&plan=pro-1&cycle=yearly"))).toEqual({
      event: "sign_up",
      method: "google",
      plan_id: "pro-1",
      billing_cycle: "yearly",
    });
    expect(lib.signUpEvent(new URLSearchParams("method=x&plan=<b>&cycle="))).toEqual({
      event: "sign_up",
      method: "email",
      plan_id: "",
      billing_cycle: "",
    });
  });

  it("pushes a click through the listener", async () => {
    const { component } = await load("GTM-ABC1234");
    render(createElement(component.Gtm));
    const a = document.createElement("a");
    a.href = "https://app.zimos.co/register";
    a.textContent = "Start free";
    a.addEventListener("click", (e) => e.preventDefault());
    document.body.appendChild(a);
    a.click();
    expect((window as Win).dataLayer!.at(-1)).toMatchObject({ event: "sign_up_click", cta_location: "page", cta_text: "Start free" });
  });
});
