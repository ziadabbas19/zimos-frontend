/// <reference types="node" />
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildXsDictionary, englishFor, type CatalogFile, type TemplateFile, type XsDictionary } from "./xsDictionary";

/**
 * The imported templates' English for their Arabic copies (xsDictionary.ts),
 * built from the generated templates and held equal to xsDictionary.json —
 * written, not compared, by `npm run templates:build`.
 */

const GENERATED = fileURLToPath(new URL("../generated/", import.meta.url));
const PRODUCTS = fileURLToPath(new URL("./products/", import.meta.url));
const FILE = fileURLToPath(new URL("./xsDictionary.json", import.meta.url));
const WRITE = process.env.UPDATE_STORE_TEMPLATES === "1";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const json = <T,>(path: string) => JSON.parse(read(path)) as T;

const keys = readdirSync(GENERATED).filter((name) => /^xs-[\w]+\.json$/.test(name) && !name.endsWith("-ar.json")).map((name) => name.slice(0, -5)).sort();
const pairs = keys.map((key) => ({ en: json<TemplateFile>(join(GENERATED, `${key}.json`)), ar: json<TemplateFile>(join(GENERATED, `${key}-ar.json`)) }));
const catalogs = readdirSync(PRODUCTS).filter((name) => name.endsWith(".products.json")).sort().map((name) => json<CatalogFile>(join(PRODUCTS, name)));
const dictionary = buildXsDictionary(pairs, catalogs);
const content = `${JSON.stringify(dictionary, null, 2)}\n`;

describe("the imported templates' dictionary", () => {
  it("pairs every English template with its Arabic copy: the 24 looks, and XS 01's B and C", () => {
    expect(keys).toHaveLength(26);
    expect(keys).toEqual(expect.arrayContaining(["xs-01", "xs-01b", "xs-01c", "xs-22", "xs-23", "xs-24"]));
  });

  it("finds something at the same place in the Arabic copy for every text of the English template", () => {
    expect(dictionary.absent).toEqual({});
  });

  it("gives the English of the Arabic copies' texts, and of their products", () => {
    expect(Object.keys(dictionary.arToEn).length).toBeGreaterThan(1000);
    // XS 01's header word for the language switch, its menu and a product.
    expect(englishFor(dictionary, "العربية")).toBe("EN");
    expect(englishFor(dictionary, "  ج.م ")).toBe("EGP");
    expect(englishFor(dictionary, "تيشيرت قطن أبيض رقبة مدورة")).toBe("Essential Cotton Crew Tee");
    expect(englishFor(dictionary, "words no template has")).toBeNull();
  });

  it("gives a store its own template's English where two templates say the same Arabic differently", () => {
    const [arabic, englishes] = Object.entries(dictionary.conflicts)[0];
    const look = Object.keys(dictionary.byLook).find((l) => Object.hasOwn(dictionary.byLook[l], arabic));
    expect(look).toBeDefined();
    expect(englishFor(dictionary, arabic, look)).toBe(dictionary.byLook[look!][arabic]);
    expect(englishFor(dictionary, arabic)).toBe(englishes[0]);
    expect(englishFor(dictionary, arabic, look)).not.toBe(englishes[0]);
  });

  it("is the file the dashboard reads, as the templates are now", () => {
    if (WRITE) writeFileSync(FILE, content, "utf8");
    expect(read(FILE)).toBe(content);
  });
});

describe("englishFor", () => {
  const small: Pick<XsDictionary, "arToEn" | "byLook"> = { arToEn: { "تسوق": "Shop" }, byLook: { "05": { "تسوق": "Shop now" } } };
  it("reads the store's text as the template wrote it, spaces at the ends aside", () => {
    expect(englishFor(small, " تسوق ")).toBe("Shop");
    expect(englishFor(small, "تسوق الآن")).toBeNull();
    expect(englishFor(small, "")).toBeNull();
    expect(englishFor(small, "constructor")).toBeNull();
    expect(englishFor(small, "تسوق", "05")).toBe("Shop now");
    expect(englishFor(small, "تسوق", "07")).toBe("Shop");
  });
});
