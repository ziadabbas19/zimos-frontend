import { describe, expect, it } from "vitest";
import { demoWordCount, demoWordsTo, inArabic, loadDemoWords } from "./demoWords";

const WORDS = { "Shop now": "تسوق الآن", "Free shipping": "شحن مجاني" };

describe("a template's sample words", () => {
  it("go into Arabic and back", () => {
    const tree = { heading: "Shop now", items: [{ title: "Free shipping" }] };
    const arabic = inArabic(tree, demoWordsTo(WORDS, "ar"));
    expect(arabic).toEqual({ heading: "تسوق الآن", items: [{ title: "شحن مجاني" }] });
    expect(inArabic(arabic, demoWordsTo(WORDS, "en"))).toEqual(tree);
  });

  it("leave what the merchant wrote, addresses and choices alone", () => {
    const tree = { heading: "My own words", buttonHref: "Shop now", look: "Shop now", image: "Shop now" };
    expect(inArabic(tree, demoWordsTo(WORDS, "ar"))).toEqual(tree);
    expect(demoWordCount(tree, demoWordsTo(WORDS, "ar"))).toBe(0);
  });

  it("are counted only when they are in the other language", () => {
    const english = { a: "Shop now", b: ["Free shipping", "Other"] };
    expect(demoWordCount(english, demoWordsTo(WORDS, "ar"))).toBe(2);
    expect(demoWordCount(english, demoWordsTo(WORDS, "en"))).toBe(0);
  });

  it("are found for a template that has them, and not for one that doesn't", async () => {
    expect(Object.keys((await loadDemoWords("24")) ?? {}).length).toBeGreaterThan(10);
    expect(await loadDemoWords("99")).toBeNull();
  });
});
