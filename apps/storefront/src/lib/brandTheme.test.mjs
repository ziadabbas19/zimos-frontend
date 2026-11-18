import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_VAR_NAMES,
  ORIGINAL_LOOK,
  STORE_THEMES,
  TEMPLATE_COLOR_SOURCE,
  brandVars,
  onColor,
  previewBootScript,
  previewStoreTheme,
  readColorMode,
  readPreviewTheme,
  storeThemeOf,
} from "./brandTheme.ts";

/**
 * What the store wrapper's inline style is built from. The promise that
 * matters most: a store that saved nothing, or saved one colour before the two
 * modes could differ, renders exactly as it did — the same colour in light
 * and dark, the same font and corners.
 */

describe("brandVars — backward compatibility", () => {
  it("writes nothing for a store that saved nothing, so the stylesheet defaults apply", () => {
    assert.deepEqual(brandVars({}), {});
    assert.deepEqual(brandVars(undefined), {});
    assert.deepEqual(brandVars(null), {});
  });

  it("uses a single saved colour for both modes, with the same contrast-picked foreground", () => {
    const vars = brandVars({ primaryColor: "#1E40AF" });
    assert.equal(vars["--brand-primary-light-mode"], "#1E40AF");
    assert.equal(vars["--brand-primary-dark-mode"], "#1E40AF");
    assert.equal(vars["--brand-primary-light-mode-fg"], "#ffffff");
    assert.equal(vars["--brand-primary-dark-mode-fg"], "#ffffff");
    // The single inline value is no longer written: the stylesheet derives it per mode.
    assert.equal("--brand-primary" in vars, false);
  });

  it("keeps the original look's secondary colour, font and corners exactly as before", () => {
    const vars = brandVars({ secondaryColor: "#E2A33D", fontFamily: "modern", cornerRadius: "round" });
    assert.equal(vars["--brand-secondary"], "#E2A33D");
    assert.equal(vars["--brand-secondary-foreground"], "#16211f");
    assert.match(vars["--font-display"], /Plus Jakarta Sans/);
    assert.equal(vars["--radius-card"], "1.25rem");
  });

  it("ignores malformed colours and unknown choices", () => {
    assert.deepEqual(brandVars({ primaryColor: "teal", primaryColorDark: 12, fontFamily: "comic", cornerRadius: 3 }), {});
  });
});

describe("brandVars — one accent per mode", () => {
  it("writes the dark-mode accent separately when the merchant picked one", () => {
    const vars = brandVars({ primaryColor: "#1F3A5F", primaryColorDark: "#9DB9E8" });
    assert.equal(vars["--brand-primary-light-mode"], "#1F3A5F");
    assert.equal(vars["--brand-primary-dark-mode"], "#9DB9E8");
    assert.equal(vars["--brand-primary-light-mode-fg"], "#ffffff");
    // A light accent gets dark text on it.
    assert.equal(vars["--brand-primary-dark-mode-fg"], "#16211f");
  });

  it("lets a dark-mode accent stand alone, leaving light mode on the default", () => {
    const vars = brandVars({ primaryColorDark: "#A594FF" });
    assert.equal("--brand-primary-light-mode" in vars, false);
    assert.equal(vars["--brand-primary-dark-mode"], "#A594FF");
  });
});

describe("brandVars — themes own everything but the accent", () => {
  it("drops the saved secondary colour, font and corners on a theme", () => {
    const saved = {
      storeTheme: "elegant",
      primaryColor: "#7A5A3A",
      secondaryColor: "#E2A33D",
      fontFamily: "tajawal",
      cornerRadius: "sharp",
    };
    const vars = brandVars(saved);
    assert.deepEqual(Object.keys(vars).sort(), [
      "--brand-primary-dark-mode",
      "--brand-primary-dark-mode-fg",
      "--brand-primary-light-mode",
      "--brand-primary-light-mode-fg",
    ]);
    // Even in the preview's `complete` mode, which fills in the original look's defaults.
    assert.deepEqual(Object.keys(brandVars(saved, { complete: true })).sort(), Object.keys(vars).sort());
  });

  it("fills in the original look's defaults for the preview only", () => {
    const vars = brandVars({}, { complete: true });
    assert.match(vars["--font-display"], /Fraunces/);
    assert.equal(vars["--radius-card"], "0.625rem");
    assert.equal("--brand-primary-light-mode" in vars, false);
  });

  it("names only real themes", () => {
    for (const key of STORE_THEMES) assert.equal(storeThemeOf({ storeTheme: key }), key);
    assert.equal(storeThemeOf({ storeTheme: "perfume" }), null);
    assert.equal(storeThemeOf({ storeTheme: ORIGINAL_LOOK }), null);
    assert.equal(storeThemeOf({}), null);
    assert.equal(STORE_THEMES.length, 6);
  });

  it("keeps every theme's own accent when the saved colour came from a website template", () => {
    for (const key of STORE_THEMES) {
      const vars = brandVars({ storeTheme: key, primaryColor: "#2563EB", primaryColorSource: TEMPLATE_COLOR_SOURCE });
      assert.equal("--brand-primary-light-mode" in vars, false, key);
      assert.equal("--brand-primary-dark-mode" in vars, false, key);
    }
  });

  it("still uses a template's colour on the original look, and a merchant's own on a theme", () => {
    const template = { primaryColor: "#2563EB", primaryColorSource: TEMPLATE_COLOR_SOURCE };
    assert.equal(brandVars(template)["--brand-primary-light-mode"], "#2563EB");
    assert.equal(brandVars({ ...template, storeTheme: ORIGINAL_LOOK })["--brand-primary-light-mode"], "#2563EB");
    const own = brandVars({ storeTheme: "warm", primaryColor: "#B45309" });
    assert.equal(own["--brand-primary-light-mode"], "#B45309");
    // A dark-mode accent the merchant picked survives a template's light colour.
    const mixed = brandVars({ ...template, storeTheme: "warm", primaryColorDark: "#F59E0B" });
    assert.equal("--brand-primary-light-mode" in mixed, false);
    assert.equal(mixed["--brand-primary-dark-mode"], "#F59E0B");
  });

  it("only ever writes properties the preview bridge knows how to clear", () => {
    const all = [
      brandVars({ primaryColor: "#111111", primaryColorDark: "#EEEEEE", secondaryColor: "#222222", fontFamily: "system", cornerRadius: "sharp" }),
      brandVars({}, { complete: true }),
      brandVars({ storeTheme: "glass", primaryColor: "#6D4AFF" }),
    ];
    for (const vars of all) {
      for (const name of Object.keys(vars)) assert.ok(BRAND_VAR_NAMES.includes(name), name);
    }
  });
});

describe("onColor", () => {
  it("puts white on dark colours and ink on light ones", () => {
    assert.equal(onColor("#000000"), "#ffffff");
    assert.equal(onColor("#1F5D5B"), "#ffffff");
    assert.equal(onColor("#FFFFFF"), "#16211f");
    assert.equal(onColor("#FFD60A"), "#16211f");
  });
});

describe("readPreviewTheme", () => {
  it("keeps only validated values", () => {
    assert.deepEqual(
      readPreviewTheme({
        storeTheme: "bold",
        primaryColor: "#E11D2E",
        primaryColorDark: "#FF4D5A",
        secondaryColor: "red",
        fontFamily: "modern",
        cornerRadius: "huge",
        logoUrl: "javascript:alert(1)",
        extra: 1,
      }),
      { storeTheme: "bold", primaryColor: "#E11D2E", primaryColorDark: "#FF4D5A", fontFamily: "modern" }
    );
  });

  it("accepts an explicit switch back to the original look, and nothing else", () => {
    assert.equal(readPreviewTheme({ storeTheme: ORIGINAL_LOOK }).storeTheme, ORIGINAL_LOOK);
    assert.equal(readPreviewTheme({ storeTheme: "<script>" }).storeTheme, undefined);
    assert.equal(readPreviewTheme("bold"), null);
    assert.equal(readPreviewTheme([]), null);
  });

  it("tells the preview what to do with the saved theme", () => {
    assert.equal(previewStoreTheme({ storeTheme: "warm" }), "warm");
    assert.equal(previewStoreTheme({ storeTheme: ORIGINAL_LOOK }), null);
    assert.equal(previewStoreTheme({}), undefined);
    assert.equal(previewStoreTheme(null), undefined);
  });
});

describe("previewBootScript", () => {
  it("is empty when there is nothing to put in place", () => {
    assert.equal(previewBootScript(null, null), "");
    assert.equal(previewBootScript({ primaryColor: "#111111" }, null), "");
  });

  it("carries only validated values", () => {
    const script = previewBootScript({ storeTheme: "glass" }, "dark");
    assert.match(script, /"glass"/);
    assert.match(script, /"dark"/);
    assert.doesNotMatch(script, /<\/script/i);
    // The original look removes the attribute rather than setting a value.
    assert.match(previewBootScript({ storeTheme: ORIGINAL_LOOK }, null), /var k=null/);
  });

  it("reads colour modes strictly", () => {
    assert.equal(readColorMode("dark"), "dark");
    assert.equal(readColorMode("light"), "light");
    assert.equal(readColorMode("DARK"), null);
    assert.equal(readColorMode(undefined), null);
  });
});

describe("readPreviewTheme — whose colour it is", () => {
  it("keeps the mark of a colour a template brought", () => {
    assert.equal(readPreviewTheme({ primaryColor: "#112233", primaryColorSource: TEMPLATE_COLOR_SOURCE }).primaryColorSource, TEMPLATE_COLOR_SOURCE);
  });

  it("drops the mark without a colour, and any other value", () => {
    assert.equal(readPreviewTheme({ primaryColorSource: TEMPLATE_COLOR_SOURCE }).primaryColorSource, undefined);
    assert.equal(readPreviewTheme({ primaryColor: "#112233", primaryColorSource: "x" }).primaryColorSource, undefined);
  });
});

describe("previewBootScript — a template's own dark mode", () => {
  it("puts the asked-for mode on a template's wrapper, except the looks that are dark already", () => {
    const script = previewBootScript(null, "dark");
    assert.match(script, /data-xs-shell/);
    assert.match(script, /data-color-mode/);
    assert.match(script, /\["19","22"\]/);
  });
});
