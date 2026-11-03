/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Everything the generated templates name is served by the storefront: every
 * file a template under ./generated or ./generated/console points at (its
 * pictures, and any other file by its address), the stylesheet of every look
 * it is drawn in (storefront src/lib/xsLookCss.json) and of the phone header,
 * and every face and picture those stylesheets — and the shared ones every
 * store page loads (storefront src/app/xs*.css) — point at in turn.
 *
 * The files are read as they are checked in: this holds what is pasted into
 * the platform console, not what the definitions would build.
 */

const GENERATED = fileURLToPath(new URL("./generated/", import.meta.url));
const CONSOLE = fileURLToPath(new URL("./generated/console/", import.meta.url));
const STOREFRONT = fileURLToPath(new URL("../../../../../storefront/", import.meta.url));
const PUBLIC = join(STOREFRONT, "public");
const APP = join(STOREFRONT, "src", "app");

const read = (path: string) => readFileSync(path, "utf8");
const jsonFiles = (dir: string) => readdirSync(dir).filter((name) => name.endsWith(".json"));

/** Every string in a value, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Every `look` a value names (an element's props, or the store's themeSettings' xsLook), however deep. */
function looks(value: unknown, key = ""): string[] {
  if (typeof value === "string") return key === "look" || key === "xsLook" ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => looks(item, key));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => looks(v, k));
  return [];
}

/** A file by its address on the store: a root-relative path that ends in a file's ending. */
const FILE_ADDRESS = /^\/[^\s?#]+\.(?:jpe?g|png|webp|avif|gif|svg|ico|mp4|webm|css|woff2?|ttf|otf|json|pdf)$/i;

/** The root-relative addresses in a stylesheet's url(…). */
function cssAddresses(css: string): string[] {
  return [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1].trim()).filter((url) => url.startsWith("/") && !url.startsWith("//"));
}

const onStorefront = (address: string) => existsSync(join(PUBLIC, decodeURI(address).slice(1)));

const manifest = JSON.parse(read(join(STOREFRONT, "src", "lib", "xsLookCss.json"))) as { looks: Record<string, string>; phone: string };

const sets = [
  { name: "generated", dir: GENERATED },
  { name: "generated/console", dir: CONSOLE },
];

describe("the generated templates' files", () => {
  it.each(sets)("$name: hold the 52 templates", ({ dir }) => {
    expect(jsonFiles(dir)).toHaveLength(52);
  });

  it.each(sets)("$name: name no file the storefront does not carry", ({ dir }) => {
    let named = 0;
    for (const file of jsonFiles(dir)) {
      const addresses = strings(JSON.parse(read(join(dir, file)))).filter((value) => FILE_ADDRESS.test(value));
      expect(addresses.length, file).toBeGreaterThan(0);
      for (const address of addresses) expect(onStorefront(address), `${file}: ${address}`).toBe(true);
      named += addresses.length;
    }
    expect(named).toBeGreaterThan(48);
  });

  it.each(sets)("$name: are drawn only in looks whose stylesheet the storefront carries", ({ dir }) => {
    for (const file of jsonFiles(dir)) {
      const used = new Set(looks(JSON.parse(read(join(dir, file)))));
      expect(used.size, file).toBe(1);
      for (const look of used) {
        const sheet = manifest.looks[look];
        expect(sheet, `${file}: look ${look} has no stylesheet in xsLookCss.json`).toBeDefined();
        expect(onStorefront(sheet), `${file}: ${sheet}`).toBe(true);
      }
    }
  });
});

describe("the stylesheets the templates are drawn with", () => {
  it("carry every face and picture they point at: each look's, and the phone header's", () => {
    const sheets = [...Object.values(manifest.looks), manifest.phone];
    expect(sheets.length).toBe(25);
    for (const sheet of sheets) {
      expect(onStorefront(sheet), sheet).toBe(true);
      for (const address of cssAddresses(read(join(PUBLIC, sheet.slice(1))))) expect(onStorefront(address), `${sheet}: ${address}`).toBe(true);
    }
  });

  it("and the shared ones every store page loads (xs.css and what it imports)", () => {
    const imported = [...read(join(APP, "xs.css")).matchAll(/^@import\s+"\.\/([^"]+)";/gm)].map((match) => match[1]);
    expect(imported.length).toBeGreaterThan(0);
    for (const name of ["xs.css", ...imported]) {
      for (const address of cssAddresses(read(join(APP, name)))) expect(onStorefront(address), `${name}: ${address}`).toBe(true);
    }
  });
});
