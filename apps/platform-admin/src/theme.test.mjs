import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * The console is drawn with the merchant dashboard's theme: one copy of the
 * stylesheets and of the look's store, in packages/ui. What cannot be shared
 * as a file is held together here instead: the list of layers each app loads,
 * and the script that sets the look before the first paint. This app's tests
 * run without a DOM, so they read the sources.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const adminMain = read("./main.tsx");
const dashboardMain = read("../../merchant-dashboard/src/main.tsx");
const adminPage = read("../index.html");
const dashboardPage = read("../../merchant-dashboard/index.html");
const entry = read("./index.css");
const dashboardEntry = read("../../merchant-dashboard/src/index.css");

/** The stylesheets a main.tsx loads from the shared theme (and the shared fonts), in the order it loads them. */
const sharedLayers = (source) => [...source.matchAll(/^import '(@store-builder\/ui\/(?:styles\.css|fonts\.css|theme\/[^']+))'/gm)].map((m) => m[1]);
/** Every stylesheet it loads, the app's own included. */
const layers = (source) => [...source.matchAll(/^import '([^']+\.css)'/gm)].map((m) => m[1]);
const script = (page) => /<script>([\s\S]*?)<\/script>/.exec(page)?.[1];

/** The one stylesheet both apps take Tajawal, Plus Jakarta Sans and Fraunces from, as their main.tsx names it. */
const FONTS_LAYER = "@store-builder/ui/fonts.css";
const sharedFonts = read("../../../packages/ui/src/fonts.css");
const uiPackage = JSON.parse(read("../../../packages/ui/package.json"));
/** Resolves a name the way the build does from that file: from packages/ui. */
const resolveFromUi = createRequire(new URL("../../../packages/ui/package.json", import.meta.url)).resolve;

/**
 * The font families an app loads, each with its weights ({ tajawal: [400, 500, 700], … }),
 * from the fonts stylesheets its main.tsx imports: the shared @store-builder/ui/fonts.css, or a
 * src/fonts.css of its own. Each declares files served with the app (fontsource, the same
 * Google files). A family is named the way fontsource names its package: "Plus Jakarta
 * Sans" is plus-jakarta-sans.
 */
const loadedFonts = (app) => {
  const fonts = {};
  const add = (family, weight) => {
    const key = family.toLowerCase().replaceAll(" ", "-");
    fonts[key] = [...new Set([...(fonts[key] ?? []), weight])].sort((a, b) => a - b);
  };
  const main = read(`../../${app}/src/main.tsx`);
  const sheets = [];
  if (main.split("\n").includes(`import '${FONTS_LAYER}'`)) sheets.push(["packages/ui/src/fonts.css", sharedFonts]);
  if (/^import '\.\/fonts\.css'$/m.test(main)) sheets.push([`${app}/src/fonts.css`, read(`../../${app}/src/fonts.css`)]);
  for (const [where, css] of sheets) {
    for (const [, path] of css.matchAll(/^@import "([^"]+)";/gm)) {
      const [, slug, weight] = /^@fontsource\/([a-z0-9-]+)\/(\d+)\.css$/.exec(path) ?? [];
      assert.ok(slug, `${where} imports ${path}: teach loadedFonts what it holds`);
      add(slug, Number(weight));
    }
    for (const [, rule] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const family = /font-family:\s*"([^"]+)"/.exec(rule)?.[1];
      const [, from, to = from] = /font-weight:\s*(\d+)(?:\s+(\d+))?/.exec(rule) ?? [];
      assert.ok(family && from, `an @font-face of ${where} without a family or a weight`);
      // A variable font's range ("500 700") holds every weight between.
      for (let weight = Number(from); weight <= Number(to); weight += 100) add(family, weight);
    }
  }
  return fonts;
};

describe("the console's theme is the merchant dashboard's", () => {
  it("loads the same shared layers, in the same order", () => {
    const shared = sharedLayers(adminMain);
    assert.ok(shared.length >= 15, `only ${shared.length} shared layers`);
    assert.deepEqual(shared, sharedLayers(dashboardMain));
  });

  it("loads them after its own index.css, and nothing else of its own on top", () => {
    assert.deepEqual(layers(adminMain), ["@store-builder/ui/styles.css", "./index.css", ...sharedLayers(adminMain).slice(1)]);
  });

  it("builds its index.css from the dashboard's base, straight after Tailwind", () => {
    const imports = (source) => [...source.matchAll(/^@import "([^"]+)";/gm)].map((m) => m[1]);
    assert.deepEqual(imports(entry), imports(dashboardEntry));
    assert.equal(imports(entry).at(-1), "../../../packages/ui/src/theme/app.css");
    // The palette lives in that one copy: no colour token is set again here.
    assert.doesNotMatch(entry, /--color-[a-z-]+\s*:/);
    assert.doesNotMatch(entry, /--brand\s*:/);
  });

  it("every layer it names is a file of the shared theme", () => {
    for (const layer of sharedLayers(adminMain)) {
      const file = layer.replace("@store-builder/ui/", "../../../packages/ui/src/");
      assert.ok(existsSync(new URL(file, import.meta.url)), layer);
    }
  });

  it("reads the look from the shared store, on every page", () => {
    assert.match(adminMain, /^import '@store-builder\/ui\/appearance'$/m);
    assert.match(read("./components/ThemeToggle.tsx"), /export \{ ThemeToggle \} from "@store-builder\/ui\/appearance";/);
  });
});

describe("the look before first paint", () => {
  it("is set by the dashboard's own script, word for word", () => {
    assert.ok(script(adminPage), "no inline script in index.html");
    assert.equal(script(adminPage), script(dashboardPage));
  });

  it("covers the three looks, the tone, the glass switch and the glow colours", () => {
    const text = script(adminPage);
    for (const key of ["zimos.look", "zimos.darkLook", "zimos.darkTone", "zimos.glass", "zimos.glowLeft", "zimos.glowRight", "zimos.glowIntensity", "theme"]) {
      assert.ok(text.includes(`get("${key}")`), key);
    }
    assert.ok(text.includes('e.setAttribute("data-look", s)'));
    assert.ok(text.includes('e.setAttribute("data-glass", "off")'));
    assert.ok(text.includes("(prefers-color-scheme: dark)"));
  });
});

describe("the console's fonts", () => {
  // Both apps serve them with the app, from one file in packages/ui; neither links Google Fonts.
  it("come from the shared @store-builder/ui/fonts.css, as the dashboard's do", () => {
    assert.ok(adminMain.split("\n").includes(`import '${FONTS_LAYER}'`), `the console's main.tsx does not import ${FONTS_LAYER}`);
    assert.ok(dashboardMain.split("\n").includes(`import '${FONTS_LAYER}'`), `the dashboard's main.tsx does not import ${FONTS_LAYER}`);
    // The package's exports name it, and it is the file read here.
    const fromConsole = createRequire(new URL("../package.json", import.meta.url)).resolve(FONTS_LAYER);
    assert.equal(realpathSync(fromConsole), realpathSync(new URL("../../../packages/ui/src/fonts.css", import.meta.url)));
  });

  it("are the dashboard's, family for family and weight for weight (Tajawal draws the Arabic)", () => {
    const fonts = loadedFonts("platform-admin");
    assert.ok(fonts.tajawal, "no Tajawal: every Arabic word would fall back to a system font");
    assert.deepEqual(fonts, loadedFonts("merchant-dashboard"));
    // What the Google Fonts link of both apps asked for, before they were served with the apps.
    assert.deepEqual(fonts, { tajawal: [400, 500, 700], "plus-jakarta-sans": [400, 500, 600, 700], fraunces: [500, 600, 700] });
  });

  it("take nothing from Google: no stylesheet, no preconnect, no font file", () => {
    for (const app of ["platform-admin", "merchant-dashboard"]) {
      assert.doesNotMatch(read(`../../${app}/index.html`), /fonts\.(googleapis|gstatic)\.com/, `${app}/index.html`);
    }
    assert.doesNotMatch(sharedFonts, /url\(\s*["']?(https?:)?\/\//, "fonts.css loads a file from another origin");
  });

  it("name only packages @store-builder/ui depends on, and files those packages have", () => {
    const names = [...sharedFonts.matchAll(/^@import "([^"]+)";/gm), ...sharedFonts.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(names.length >= 10, `only ${names.length} imports and files in fonts.css`);
    for (const name of names) {
      const pkg = /^@[^/]+\/[^/]+/.exec(name)?.[0];
      assert.ok(pkg && uiPackage.dependencies?.[pkg], `${name}: ${pkg} is not a dependency of @store-builder/ui`);
      assert.doesNotThrow(() => resolveFromUi(name), `${name} does not resolve from packages/ui`);
    }
  });

  it("are built as files of their own, not written into the stylesheet, in both apps", () => {
    const inlineRule = (app) => /assetsInlineLimit:\s*([^\n]+)/.exec(read(`../../${app}/vite.config.ts`))?.[1];
    assert.ok(inlineRule("platform-admin"), "the console's vite.config.ts sets no assetsInlineLimit");
    assert.equal(inlineRule("platform-admin"), inlineRule("merchant-dashboard"));
  });
});
