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
 * gateway by name (InstaPay and wallets may be named), the platform not
 * described as cash on delivery in its title or description, and nothing
 * that is not built (AI, a WhatsApp bot). The features page's own words
 * have content/features/features.test.ts.
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
  ])("do not describe the platform as cash on delivery in its title and description (%s)", (_, dict) => {
    expect(hits([dict.meta.title, dict.meta.description], [/الدفع عند الاستلام|cash.on.delivery/i])).toEqual([]);
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
