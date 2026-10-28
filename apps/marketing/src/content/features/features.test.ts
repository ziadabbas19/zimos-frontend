import { describe, expect, it } from "vitest";
import { matchesQuery, searchable } from "@/lib/searchable";
import { ar } from "./ar";
import { en } from "./en";
import { FEATURE_SECTION_IDS, HOME_CARD_IDS } from "./types";

/**
 * The features page's words (content/features): both languages say the same
 * things, and none of what the owner keeps off the page appears — brand names
 * of shipping companies and payment gateways, "COD platform", prices or
 * "cheapest", AI or "smart", Shopify, device notifications, total counts or
 * any number that reads as a plan's limit, and what the list marks as not
 * built.
 */

/** Every string in the copy, wherever it sits. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const KEPT_OFF: RegExp[] = [
  /\bCOD\b/,
  /cash on delivery platform/i,
  /بوسطة|Bosta/i,
  /مايلرز|Mylerz/i,
  /J&T|جي آند تي/i,
  /باي ?موب|Paymob/i,
  /كاشير|Kashier/i,
  /فواتيرك|Fawaterak/i,
  /أرامكس|Aramex/i,
  /تربو|Turbo/i,
  /\bAI\b|ذكاء اصطناعي|الذكاء الاصطناعي|artificial intelligence/i,
  /ذكي|\bsmart\b/i,
  /Shopify|شوبيفاي/i,
  /107/,
  /push/i,
  /أرخص|cheapest|cheaper/i,
  /\d[\d,.]*\s*(جنيه|ج\.م|EGP|LE\b)/i,
  /\d+\s*(ميزة|features?\b)/i,
  /مستودعات|warehouses?/i,
  /3D/,
  /عمل(ة|ات)|currenc/i,
  /حذف الحساب|delete (your|the) account/i,
  /كلمة السر|change (your )?password/i,
  /أدوار مخصصة|custom roles/i,
  /نقل (ال)?ملكية|ownership/i,
  /حملات واتساب|broadcast/i,
  /عروض أسعار|quotes?\b/i,
  /حجز مواعيد|appointment/i,
];

describe("the features copy", () => {
  it("has every section, with the same number of features in both languages", () => {
    for (const id of FEATURE_SECTION_IDS) {
      expect(ar.sections[id].items.length, id).toBeGreaterThan(0);
      expect(en.sections[id].items.length, id).toBe(ar.sections[id].items.length);
    }
    expect(Object.keys(ar.sections).sort()).toEqual([...FEATURE_SECTION_IDS].sort());
    expect(Object.keys(en.sections).sort()).toEqual([...FEATURE_SECTION_IDS].sort());
  });

  it("has the home page's eight cards", () => {
    expect(HOME_CARD_IDS).toHaveLength(8);
    for (const copy of [ar, en]) expect(Object.keys(copy.home.cards).sort()).toEqual([...HOME_CARD_IDS].sort());
  });

  it("names no feature twice in a language", () => {
    for (const copy of [ar, en]) {
      const titles = FEATURE_SECTION_IDS.flatMap((id) => copy.sections[id].items.map((item) => item.title));
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it.each([
    ["ar", ar],
    ["en", en],
  ])("keeps off the page what the owner keeps off it (%s)", (_, copy) => {
    const found = strings(copy).flatMap((text) =>
      KEPT_OFF.filter((rule) => rule.test(text)).map((rule) => `${rule} in “${text}”`),
    );
    expect(found).toEqual([]);
  });

  // No number that reads as a plan's limit (products, roles, sections…): the
  // page does not tell plans apart. Only the trial's days, the five minutes,
  // the redirect codes and GA4's name carry digits.
  it.each([
    ["ar", ar],
    ["en", en],
  ])("shows no number but the allowed ones (%s)", (_, copy) => {
    const allowed = /7 أيام|7-day|7 days|5 دقايق|5 minutes|301\/302|GA4/g;
    const found = strings(copy).filter((text) => /[0-9٠-٩]/.test(text.replace(allowed, "")));
    expect(found).toEqual([]);
  });

  it("states the trial and the five minutes from the owner's rules", () => {
    expect(ar.hero.cta).toBe("ابدأ تجربتك المجانية 7 أيام");
    expect(ar.cta.heading).toBe("افتح متجرك في أقل من 5 دقايق");
    expect(ar.home.cta).toBe("شاهد كل المميزات");
  });
});

describe("the features search", () => {
  it("ignores hamza forms, taa marbuta, alef maqsura, diacritics and case", () => {
    expect(searchable("أسعار إضافية آخر")).toBe(searchable("اسعار اضافيه اخر"));
    expect(searchable("مُسلَّم")).toBe("مسلم");
    expect(searchable("على")).toBe(searchable("علي"));
    expect(searchable("WhatsApp")).toBe("whatsapp");
  });

  it("needs every word, in any order", () => {
    expect(matchesQuery("شحن مجاني بعد مبلغ", "مبلغ شحن")).toBe(true);
    expect(matchesQuery("شحن مجاني بعد مبلغ", "شحن سريع")).toBe(false);
    expect(matchesQuery("Ad pixels for Meta", "  meta   PIXELS ")).toBe(true);
  });
});
