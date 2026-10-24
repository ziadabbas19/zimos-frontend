import { describe, expect, it } from "vitest";
import { editDistance, matchScore, searchWords, type Searchable } from "./match";

const item = (titles: string[], extra: Partial<Searchable> = {}): Searchable => ({ titles, ...extra });

/** The titles of `items` that `query` finds, closest first. */
function ranked(query: string, items: Searchable[]): string[] {
  return items
    .map((entry) => ({ entry, score: matchScore(query, entry) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry.titles[0]);
}

describe("how Arabic is typed", () => {
  it("ignores the marks over and under the letters", () => {
    expect(matchScore("الإِعْدَادَات", item(["الإعدادات"]))).toBeGreaterThan(0);
    expect(matchScore("الإعدادات", item(["الإِعْدَادَات"]))).toBeGreaterThan(0);
  });

  it("reads أ إ آ as ا, ة as ه and ى as ي", () => {
    expect(matchScore("اضافات الطلب", item(["إضافات الطلب"]))).toBeGreaterThan(0);
    expect(matchScore("الخطه", item(["الخطة"]))).toBeGreaterThan(0);
    expect(matchScore("مستوي", item(["مستوى VIP"]))).toBeGreaterThan(0);
    expect(matchScore("امان", item(["الأمان"]))).toBeGreaterThan(0);
    expect(matchScore("اسعار", item(["أسعار الشحن"]))).toBeGreaterThan(0);
    expect(matchScore("الإعدادات", item(["اعدادات"]))).toBeGreaterThan(0);
  });

  it("finds a word with or without «ال»", () => {
    expect(matchScore("شحن", item(["الشحن والضرائب"]))).toBeGreaterThan(0);
    expect(matchScore("الشحن", item(["شركات شحن"]))).toBeGreaterThan(0);
  });

  it("folds the words the same way on both sides", () => {
    expect(searchWords("الإِعدادات")).toEqual(searchWords("اعدادات"));
    expect(searchWords("Store-Settings")).toEqual(["store", "settings"]);
  });
});

describe("both languages at once", () => {
  const whatsapp = item(["WhatsApp connection", "ربط واتساب"], { keywords: ["cloud api", "ميتا"] });

  it("finds an entry by its English or its Arabic name, whatever the screen is in", () => {
    expect(matchScore("whatsapp", whatsapp)).toBeGreaterThan(0);
    expect(matchScore("واتساب", whatsapp)).toBeGreaterThan(0);
    expect(matchScore("ميتا", whatsapp)).toBeGreaterThan(0);
  });

  it("needs every word typed", () => {
    expect(matchScore("whatsapp connection", whatsapp)).toBeGreaterThan(0);
    expect(matchScore("whatsapp invoices", whatsapp)).toBe(0);
  });
});

describe("a slip of the finger", () => {
  it("allows one slip in a word of four to seven letters", () => {
    expect(matchScore("watsapp", item(["WhatsApp"]))).toBeGreaterThan(0);
    expect(matchScore("favicn", item(["favicon"]))).toBeGreaterThan(0);
    expect(matchScore("pasword", item(["Password"]))).toBeGreaterThan(0);
    expect(matchScore("shpiping", item(["Shipping"]))).toBeGreaterThan(0);
    expect(matchScore("اعدادت", item(["الإعدادات"]))).toBeGreaterThan(0);
  });

  it("allows none in a short word, and not two in a short one", () => {
    expect(matchScore("shp", item(["Ship"]))).toBe(0);
    expect(matchScore("wtsap", item(["WhatsApp"]))).toBe(0);
  });

  it("finds the start of a word still being typed, with a slip in it", () => {
    expect(matchScore("whatsap", item(["WhatsApp"]))).toBeGreaterThan(0);
    expect(matchScore("notifc", item(["Notifications"]))).toBeGreaterThan(0);
  });

  it("measures the distance with swaps", () => {
    expect(editDistance("ab", "ba", 2)).toBe(1);
    expect(editDistance("kitten", "sitting", 5)).toBe(3);
    expect(editDistance("short", "a much longer word", 2)).toBe(3);
  });
});

describe("the order of the results", () => {
  it("puts the name before the extra words, and those before the description", () => {
    const items = [
      item(["Home"], { details: ["Everything about your orders"] }),
      item(["Store settings"], { keywords: ["orders"] }),
      item(["Orders"]),
    ];
    expect(ranked("orders", items)).toEqual(["Orders", "Store settings", "Home"]);
  });

  it("puts the whole name before a name it only starts", () => {
    expect(ranked("payments", [item(["Payments due"]), item(["Payments"])])).toEqual(["Payments", "Payments due"]);
  });

  it("puts a word found as typed before one found by a slip", () => {
    expect(ranked("glass", [item(["Grass"]), item(["Glass effect"])])).toEqual(["Glass effect", "Grass"]);
  });

  it("counts the place an entry sits in least", () => {
    const token = item(["Access token"], { trail: ["Settings", "WhatsApp connection"] });
    const page = item(["WhatsApp inbox"]);
    expect(ranked("whatsapp", [token, page])).toEqual(["WhatsApp inbox", "Access token"]);
    // Found by its place and its name together.
    expect(matchScore("whatsapp token", token)).toBeGreaterThan(0);
  });
});
