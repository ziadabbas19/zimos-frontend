import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OWN_DARK, OWN_LIGHT, accentsOf, colourTokensOf, ownColour, ownDeclarations, ownRulesOf, ownTokenRule, xsAccentCss } from "../../scripts/xs-accent.mjs";
import { xsLookBundles } from "../../scripts/xs-look-css.mjs";
import { tokensOf } from "../../scripts/xs-dark.mjs";
import { xsDarkAccentOf, xsOwnAccent, xsOwnAccentDark } from "../lib/xsShell.ts";

/**
 * A store's own brand colour on the imported templates (scripts/xs-accent.mjs):
 * what a template wrote down as a plain colour follows it, and a store that
 * never chose one is drawn exactly as before.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const decl = (prop, value) => ({ prop, value, important: false });
const ACCENTS = accentsOf({ "--xs-brand": "#e8415b" });

describe("a plain colour as the store's", () => {
  it("is the store's colour when it is the template's accent, see-through or not", () => {
    assert.equal(ownColour("#e8415b", ACCENTS), "var(--xs-brand)");
    assert.equal(ownColour("rgba(232, 65, 91, 0.12)", ACCENTS), "color-mix(in srgb, var(--xs-brand) 12%, transparent)");
  });

  it("keeps a second colour's own lightness under the store's hue", () => {
    assert.match(ownColour("#235d90", ACCENTS), /^oklch\(from var\(--xs-brand\) 0\.4\d+ 0\.\d+ h\)$/);
  });

  it("leaves greys alone", () => {
    for (const grey of ["#fff", "#000", "#333333", "#e6e6e6", "rgba(0, 0, 0, 0.2)"]) assert.equal(ownColour(grey, ACCENTS), null, grey);
  });
});

describe("the rules a store's own colour adds", () => {
  it("gives words on an accent ground the store's readable label colour", () => {
    const own = ownDeclarations([decl("background", "var(--xs-button)"), decl("color", "#fff")], ACCENTS);
    assert.deepEqual(own.find((d) => d.prop === "color")?.value, "var(--color-on-primary)");
  });

  it("paints a main button drawn in the template's ink, and darkens it under the pointer", () => {
    const solid = ownDeclarations([decl("background", "var(--xs-ink)"), decl("border-color", "var(--xs-ink)"), decl("color", "#fff")], ACCENTS, { button: true });
    assert.deepEqual(Object.fromEntries(solid.map((d) => [d.prop, d.value])), {
      background: "var(--xs-button)",
      "border-color": "var(--xs-button)",
      color: "var(--color-on-primary)",
    });
    const hover = ownDeclarations([decl("background", "var(--xs-dark)")], ACCENTS, { button: true, hover: true });
    assert.equal(hover[0].value, "color-mix(in oklab, var(--xs-button) 85%, #000)");
  });

  it("gives a button the readable label when a look colours its words in a rule of their own", () => {
    const css = '.xs-go { background: var(--xs-button) }\n[data-xs-look="24"] .xs-go { color: #fff }\n[data-xs-look="24"] .xs-other { color: #fff }';
    const own = ownRulesOf(css, ACCENTS);
    assert.match(own, /\[data-xs-look="24"\] \.xs-go \{\s*color: var\(--color-on-primary\)/);
    assert.doesNotMatch(own, /\.xs-other/);
  });

  it("knows an accent by the look's own name for it", () => {
    const accents = accentsOf({ "--xs-brand": "#e8415b", "--uo-pink": "#e8415b", "--uo-teal": "#0bb3b8" });
    assert.deepEqual(accents.names, ["--xs-brand", "--uo-pink"]);
    const own = ownDeclarations([decl("background", "var(--uo-pink)"), decl("color", "#fff")], accents);
    assert.equal(own[0].value, "var(--color-on-primary)");
  });

  it("does not repaint ink that is not a button", () => {
    assert.deepEqual(ownDeclarations([decl("background", "var(--xs-ink)"), decl("color", "#fff")], ACCENTS), []);
  });

  it("leaves pictures and colours that mean something", () => {
    assert.deepEqual(ownDeclarations([decl("background", "#e8415b url(/a.png)")], ACCENTS), []);
    assert.equal(ownRulesOf(".xs-error { color: #e8415b } .xs-stars { color: #e8415b }", ACCENTS), "");
  });

  it("reads a word in the look's own palette as the store's readable colour in the dark", () => {
    const [own] = ownDeclarations([decl("color", "var(--uo-navy)")], ACCENTS, { dark: true, hued: new Set(["--uo-navy"]) });
    assert.equal(own.value, "var(--xs-brand-text, var(--xs-brand))");
  });

  it("is inert until the store wrapper says the colour is the merchant's", () => {
    const css = ownRulesOf('.xs-a { color: #e8415b }\n[data-xs-look="24"] .xs-b { background: #235d90 }', ACCENTS);
    assert.ok(css.includes(`:where(${OWN_LIGHT}) .xs-a`));
    assert.match(css, /@supports \(color: oklch\(from red l c h\)\)/);
    const rule = ownTokenRule("24", { "--xs-brand": "#e8415b", "--uo-teal": "#0bb3b8" });
    assert.ok(rule.includes(`${OWN_LIGHT}[data-xs-shell="24"]`) && rule.includes(`${OWN_DARK} [data-xs-look="24"]`));
  });
});

describe("every template", () => {
  const LOOKS = Object.keys(JSON.parse(read("../lib/xsLookCss.json")).looks).sort();
  const base = tokensOf(read("./xs-sections.css"));

  it("has its colours covered in its own stylesheet", () => {
    const bundles = xsLookBundles();
    for (const look of LOOKS) assert.ok(bundles.looks[look].includes("data-xs-own-accent"), `look ${look}`);
    assert.ok(bundles.dark.includes("data-xs-own-accent-dark"));
  });

  it("repoints the second palette of the look that has one", () => {
    const source = read("./xs-look-24.css");
    const css = xsAccentCss("24", source, base);
    for (const name of Object.keys(colourTokensOf(source)).filter((n) => /^--uo-(navy|pink|teal)$/.test(n))) assert.ok(css.includes(`${name}:`), name);
  });
});

describe("whose colour it is", () => {
  it("is the template's until the merchant picks one", () => {
    assert.equal(xsOwnAccent({ primaryColor: "#112233", primaryColorSource: "template" }), false);
    assert.equal(xsOwnAccentDark({ primaryColor: "#112233", primaryColorSource: "template" }), false);
    assert.equal(xsOwnAccent({ primaryColor: "#112233" }), true);
    assert.equal(xsOwnAccentDark({ primaryColor: "#112233" }), true);
  });

  it("answers for each mode on its own", () => {
    const settings = { primaryColor: "#112233", primaryColorSource: "template", primaryColorDark: "#ff00aa" };
    assert.equal(xsOwnAccent(settings), false);
    assert.equal(xsOwnAccentDark(settings), true);
    assert.equal(xsDarkAccentOf(settings), "#ff00aa");
    assert.equal(xsDarkAccentOf({ primaryColor: "#112233" }), "#112233");
    assert.equal(xsDarkAccentOf({ primaryColor: "#112233", primaryColorSource: "template" }), null);
  });
});

describe("the built template stylesheets", () => {
  it("each carry the rules for a store's own colour", () => {
    const { looks } = JSON.parse(readFileSync(new URL("../lib/xsLookCss.json", import.meta.url), "utf8"));
    assert.equal(Object.keys(looks).length, 24);
    for (const [look, file] of Object.entries(looks)) {
      const css = readFileSync(new URL(`../../public${file}`, import.meta.url), "utf8");
      assert.ok(css.includes("data-xs-own-accent"), `look ${look}`);
    }
  });
});
