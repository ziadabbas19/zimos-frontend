import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { WorksWith } from "@/components/works-with";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";

/**
 * The home page and the site's translation files (i18n/dictionaries) under
 * the owner's marketing rules (2026-10-29): no shipping company or payment
 * gateway by name (InstaPay and wallets may be named), and nothing that is
 * not built (AI, a WhatsApp bot). The home page's title and description name
 * the platform and say what it is — an online store builder — so Google tells
 * "Zimos" apart from other things of that name (2026-11-14); since 2026-11-16
 * neither they nor the hero's pill call it a cash-on-delivery platform: cash
 * on delivery is one of the ways to pay, named where the payments are (the
 * questions). The features page's own words have content/features/features.test.ts.
 */

/** Every string in the copy, wherever it sits. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const NAMES: RegExp[] = [
  /بوسطة|Bosta/i,
  /مايلرز|Mylerz/i,
  /J&T|جي آند تي|jt-express/i,
  /أرامكس|Aramex/i,
  /تربو|Turbo/i,
  /باي ?موب|Paymob/i,
  /كاشير|Kashier/i,
  /فواتيرك|Fawaterak/i,
];

const KEPT_OFF: RegExp[] = [
  ...NAMES,
  /\bCOD\b/,
  /\bAI\b|ذكاء اصطناعي|الذكاء الاصطناعي|artificial intelligence/i,
  /بوت|\bbots?\b|chatbot/i,
];

const hits = (texts: string[], rules: RegExp[]) =>
  texts.flatMap((text) => rules.filter((rule) => rule.test(text)).map((rule) => `${rule} in “${text}”`));

afterEach(cleanup);

describe("the home page's words", () => {
  it.each([
    ["ar", ar],
    ["en", en],
  ])("name no shipping company or gateway, and nothing not built (%s)", (_, dict) => {
    expect(hits(strings(dict), KEPT_OFF)).toEqual([]);
  });

  it.each([
    ["ar", ar],
    ["en", en],
  ])("name Zimos in its title and description, and call it no cash-on-delivery platform there or in the hero (%s)", (_, dict) => {
    for (const text of [dict.meta.title, dict.meta.description]) expect(text).toMatch(/^Zimos /);
    const hero = [dict.meta.title, dict.meta.description, dict.hero.badge, ...dict.hero.lines, dict.hero.accent, dict.hero.body];
    expect(hero.filter((text) => /عند الاستلام|cash.on.delivery/i.test(text))).toEqual([]);
  });

  // The 7-day free trial is gone (the owner, 2026-11-14): the home page says
  // what the dashboard does — build the store, subscribe when it is ready to
  // publish. What a plan itself offers is written from the API on /pricing.
  // Since 2026-11-16 the hero's first button says "Start free" ("ابدأ
  // مجانا"), with no length, card or price beside it: those two words, on
  // that button only.
  it.each([
    ["ar", ar, "ابدأ مجانا"],
    ["en", en, "Start free"],
  ])("promise no free trial on the home page (%s)", (_, dict, startFree) => {
    expect(dict.hero.primaryCta).toBe(startFree);
    const { primaryCta, ...hero } = dict.hero;
    const home = [dict.nav, hero, dict.templates, dict.journey, dict.growth, dict.dashboard, dict.start, dict.trust, dict.faq, dict.finalCta];
    const trial = /تجرب\S* مجاني|free trial|\b7 أيام|7[- ]days?\b|start (for )?free|try (it )?free|ابدأ مجان|جرب\S* مجان/i;
    expect(strings(home).filter((text) => trial.test(text))).toEqual([]);
    expect(trial.test(primaryCta.replace(startFree, ""))).toBe(false);
  });

  it("describe the platform as a complete store in 5 minutes", () => {
    expect(ar.meta.description).toContain("منصة لإنشاء متجر إلكتروني كامل في 5 دقائق");
    expect(en.meta.description).toContain("build a complete online store in 5 minutes");
  });
});

describe("the strip under the hero", () => {
  it.each([
    ["ar", ar],
    ["en", en],
  ])("says shipping companies and payment gateways in words, with no brand's mark (%s)", (_, dict) => {
    const { container } = render(createElement(WorksWith, { copy: dict.integrations }));
    expect(hits([container.innerHTML], NAMES)).toEqual([]);
    expect(container.textContent).toContain(dict.integrations.shippingCompanies);
    expect(container.textContent).toContain(dict.integrations.paymentGateways);
    expect(container.querySelector('img[src="/integrations/instapay.png"]')).not.toBeNull();
  });

  it("has no shipping company's or gateway's logo file left to serve", () => {
    // jsdom gives the module an http URL, so the folder comes from __dirname.
    const files = readdirSync(resolve(__dirname, "../../public/integrations"));
    expect(files).toContain("instapay.png");
    expect(hits(files, NAMES)).toEqual([]);
  });
});
