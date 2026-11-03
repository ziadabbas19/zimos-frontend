import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buyGroups, colourOf, compactPrice, fabricAt, garmentColour, garmentKind, garmentText, isNewProduct, optionDetails, plainDescription } from "./railGarment.ts";

describe("the garment a product hangs as", () => {
  it("reads the kind from English and Arabic names", () => {
    assert.equal(garmentKind("Heavyweight tee · Bone"), "tee");
    assert.equal(garmentKind("Classic T-shirt"), "tee");
    assert.equal(garmentKind("Piqué polo"), "tee");
    assert.equal(garmentKind("Oxford shirt · Sky"), "shirt");
    assert.equal(garmentKind("قميص كتان"), "shirt");
    assert.equal(garmentKind("Hoodie · Maestiq"), "hoodie");
    assert.equal(garmentKind("هودي قطن"), "hoodie");
    assert.equal(garmentKind("Knit cardigan · Olive"), "knit");
    assert.equal(garmentKind("بلوفر صوف"), "knit");
    assert.equal(garmentKind("Bomber jacket"), "jacket");
    assert.equal(garmentKind("جاكيت جينز"), "jacket");
    assert.equal(garmentKind("Wool overcoat"), "coat");
    assert.equal(garmentKind("بالطو شتوي"), "coat");
  });

  it("keeps a sweatshirt a knit and a t-shirt a tee, though both say shirt", () => {
    assert.equal(garmentKind("Crewneck sweatshirt · Lilac"), "knit");
    assert.equal(garmentKind("سويت شيرت"), "knit");
    assert.equal(garmentKind("تي شيرت أسود"), "tee");
  });

  it("hangs anything it cannot name as a tee", () => {
    assert.equal(garmentKind("Demo Product"), "tee");
    assert.equal(garmentKind(""), "tee");
  });

  it("reads the product type and tags along with the name", () => {
    assert.equal(garmentKind(garmentText({ name: "Nova 01", productType: "physical", tags: ["hoodie"] })), "hoodie");
  });
});

describe("the colour it is drawn in", () => {
  it("takes a hex code as written and knows common names", () => {
    assert.equal(colourOf("#185B37"), "#185B37");
    assert.equal(colourOf("Black"), "#1d1f22");
    assert.equal(colourOf("كحلي"), "#22314d");
    assert.equal(colourOf("Off white"), "#e8dfcc");
    assert.equal(colourOf("Sky blue"), "#a3d3eb");
    assert.equal(colourOf("Sparkle"), null);
  });

  it("reads the first colour option it can paint", () => {
    const product = {
      variants: [
        { optionValues: { Size: "M", Color: "Sparkle" } },
        { optionValues: { Size: "L", اللون: "أخضر" } },
      ],
    };
    assert.equal(garmentColour(product), "#2f6b45");
    assert.equal(garmentColour({ variants: [{ optionValues: { Size: "M" } }] }), null);
  });

  it("prefers the swatch the merchant picked over the colour's name", () => {
    const product = {
      options: [
        { name: "Size", values: ["M"] },
        { name: "اللون", values: ["زيتي", "أسود"], displayType: "color", swatches: { "أسود": "#000000", "زيتي": "#6b7340" } },
      ],
      variants: [{ optionValues: { Size: "M", اللون: "أسود" } }],
    };
    assert.equal(garmentColour(product), "#6b7340");
  });

  it("gives products with no colour a shade in turn", () => {
    assert.match(fabricAt(0), /^#[0-9a-f]{6}$/);
    assert.notEqual(fabricAt(0), fabricAt(1));
    assert.equal(fabricAt(-1), fabricAt(7));
  });
});

describe("what the detail view says", () => {
  it("lists the choices other than colour, once each", () => {
    const product = {
      variants: [
        { optionValues: { Size: "S", Color: "Black" } },
        { optionValues: { Size: "M", Color: "Black" } },
        { optionValues: { Size: "M", Color: "White" } },
      ],
    };
    assert.deepEqual(optionDetails(product), ["S", "M"]);
  });

  it("keeps the order the merchant gave the sizes, not the variants' order", () => {
    const product = {
      options: [
        { name: "اللون", values: ["زيتي"] },
        { name: "المقاس", values: ["S", "M", "L", "XL"] },
      ],
      variants: [{ optionValues: { المقاس: "XL" } }, { optionValues: { المقاس: "S" } }],
    };
    assert.deepEqual(optionDetails(product), ["S", "M", "L", "XL"]);
  });

  it("reads a description as plain words and cuts it at a word", () => {
    assert.equal(plainDescription("<p>Soft&nbsp;cotton, <b>240 gsm</b>.</p>"), "Soft cotton, 240 gsm .");
    const long = plainDescription("word ".repeat(80), 40);
    assert.ok(long.length <= 41);
    assert.ok(long.endsWith("…"));
    assert.equal(plainDescription(null), "");
  });
});

describe("the hang-tag and the buy panel", () => {
  it("drops a fraction of zeros from a price, in Arabic and Latin digits", () => {
    assert.equal(compactPrice("‏٨٢٠٫٠٠ ج.م.‏"), "‏٨٢٠ ج.م.‏");
    assert.equal(compactPrice("EGP 820.00"), "EGP 820");
    assert.equal(compactPrice("EGP 1,250.00"), "EGP 1,250");
    assert.equal(compactPrice("EGP 820.50"), "EGP 820.50");
    assert.equal(compactPrice("٨٢٠٫٥٠ ج.م."), "٨٢٠٫٥٠ ج.م.");
  });

  it("lays the choices out in the merchant's order, with the swatches, and only what the variants have", () => {
    const product = {
      options: [
        { name: "اللون", values: ["أسود", "زيتي"], swatches: { "أسود": "#101214", "زيتي": "#6b7340", "أحمر": "#ff0000" } },
        { name: "المقاس", values: ["S", "M", "L", "XL"] },
      ],
      variants: [
        { optionValues: { "اللون": "زيتي", "المقاس": "XL" } },
        { optionValues: { "اللون": "زيتي", "المقاس": "S" } },
        { optionValues: { "اللون": "أسود", "المقاس": "M" } },
      ],
    };
    assert.deepEqual(buyGroups(product), [
      { name: "اللون", values: ["أسود", "زيتي"], swatches: { "أسود": "#101214", "زيتي": "#6b7340" } },
      { name: "المقاس", values: ["S", "M", "XL"] },
    ]);
  });

  it("falls back to the variants' own values when the product names no options", () => {
    const product = { variants: [{ optionValues: { Size: "L" } }, { optionValues: { Size: "S" } }] };
    assert.deepEqual(buyGroups(product), [{ name: "Size", values: ["L", "S"] }]);
    assert.deepEqual(buyGroups({ variants: [{ optionValues: {} }] }), []);
  });

  it("marks a product new when the merchant tags it so", () => {
    assert.equal(isNewProduct({ tags: ["ملابس", "جديد"] }), true);
    assert.equal(isNewProduct({ tags: ["New"] }), true);
    assert.equal(isNewProduct({ tags: ["newsletter"] }), false);
    assert.equal(isNewProduct({ tags: [] }), false);
  });
});
