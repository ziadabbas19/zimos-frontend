/// <reference types="node" />
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOCK_PRESETS } from "../../editor/blocks";
import { buildXsTemplates, xsTemplateIndex } from "./xsTemplates";

/**
 * The store templates as they are built, held equal to the files that are
 * checked in under ../generated — what the platform console takes: one JSON
 * file per template, each one's version alone under ../generated/console
 * (pasted as the template's version), and INDEX.md there. Those files are
 * written, not compared, by `npm run templates:build`.
 */

const GENERATED = fileURLToPath(new URL("../generated/", import.meta.url));
/** Each template's version alone, as the platform console's "add version" takes it. */
const CONSOLE = fileURLToPath(new URL("../generated/console/", import.meta.url));
const ART = fileURLToPath(new URL("../../../../../../storefront/public/xs/", import.meta.url));
/** `npm run templates:build` sets it: the files are written instead of compared. */
const WRITE = process.env.UPDATE_STORE_TEMPLATES === "1";

const templates = buildXsTemplates();
/** A checkout on Windows may hand the file back with CRLF line ends. */
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Writes (in writing mode) or compares each file, and leaves no file in `dir` with that ending that is not one of them. */
function holdFolder(dir: string, files: Array<{ name: string; content: string }>, ending: string) {
  if (WRITE) {
    mkdirSync(dir, { recursive: true });
    for (const stale of readdirSync(dir).filter((name) => name.endsWith(ending) && !files.some((f) => f.name === name))) rmSync(join(dir, stale));
    for (const file of files) writeFileSync(join(dir, file.name), file.content, "utf8");
  }
  expect(existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(ending)).sort() : []).toEqual(files.map((f) => f.name).sort());
  for (const file of files) expect(read(join(dir, file.name)), file.name).toBe(file.content);
}

function elementsOf(template: (typeof templates)[number]) {
  return template.version.pages.flatMap((page) =>
    page.builderData.sections.flatMap((section) => section.rows.flatMap((row) => row.columns.flatMap((column) => column.elements)))
  );
}

/** Every string in a value, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("the imported (xs) templates", () => {
  it("each bring a home page made of their own look's bands, and that look as the store's shell", () => {
    for (const template of templates) {
      // "xs-01b" is another home page of look 01.
      const look = template.key.replace(/^xs-/, "").slice(0, 2);
      const elements = elementsOf(template);
      expect(elements.length, template.key).toBeGreaterThan(0);
      for (const element of elements) {
        expect(element.type.startsWith("xs_"), `${template.key}: ${element.type}`).toBe(true);
        expect((element.props as { look?: string }).look, template.key).toBe(look);
      }
      expect(template.version.globalStyles.themeSettings.xsLook, template.key).toBe(look);
    }
  });

  it("offer the same bands as blocks in the editor's library", () => {
    const presetTypes = new Set(BLOCK_PRESETS.filter((preset) => preset.key.startsWith("xs-")).flatMap((preset) => preset.elements));
    for (const template of templates) {
      for (const element of elementsOf(template)) expect(presetTypes.has(element.type), element.type).toBe(true);
    }
  });

  it("name no picture the storefront does not carry", () => {
    for (const template of templates) {
      const pictures = strings(template.version).filter((value) => value.startsWith("/xs/"));
      expect(pictures.length, template.key).toBeGreaterThan(0);
      for (const picture of pictures) expect(existsSync(join(ART, picture.slice("/xs/".length))), picture).toBe(true);
    }
  });

  it("come in Arabic too, right to left, with no English word left on show", () => {
    const english = templates.filter((template) => !template.rtl);
    for (const template of english) {
      const arabic = templates.find((t) => t.key === `${template.key}-ar`);
      expect(arabic, `${template.key} has no Arabic template`).toBeDefined();
      expect(arabic!.rtl).toBe(true);
      // Shown words only: settings, addresses, e-mail addresses and phone numbers stay as they are.
      const shown = (value: unknown, key = ""): string[] => {
        if (/^(look|variant|layout|hanger|image|images|phoneImage|video|product|also|icon|kind|url|collection|align|headingWeight|imageRatio|imageFit|endsAt|xsLook|primaryColor|primaryColorSource|id|type|width|padding|pageType|path)$/.test(key) || /(Href|href|Color|Url)$/.test(key)) return [];
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value.flatMap((item) => shown(item, key));
        if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => shown(v, k));
        return [];
      };
      const left = shown(arabic!.version).filter((text) => /[A-Za-z]{3}/.test(text) && !/[؀-ۿ]/.test(text) && !/@|^\+?[\d\s()-]+$/.test(text));
      expect(left, arabic!.key).toEqual([]);
    }
  });

  it("are 52: 24 looks (22 imported, Zimos's own Atelier, a merchant's own Cradle) and look 01's two other home pages, each in English and in Arabic", () => {
    expect(templates).toHaveLength(52);
    expect(new Set(templates.map((t) => t.key)).size).toBe(52);
    expect(templates.filter((t) => t.rtl).map((t) => t.key)).toEqual(templates.filter((t) => !t.rtl).map((t) => `${t.key}-ar`));
    for (const template of templates) {
      expect(template.kind, template.key).toBe("store");
      expect(template.primaryColor, template.key).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(template.version.globalStyles.primaryColor, template.key).toBe(template.primaryColor);
      expect(template.version.pages.filter((p) => p.path === "/"), template.key).toHaveLength(1);
    }
  });
});

describe("the generated files", () => {
  it("hold each template exactly as it is built", () => {
    holdFolder(GENERATED, templates.map((t) => ({ name: `${t.key}.json`, content: `${JSON.stringify(t, null, 2)}\n` })), ".json");
  });

  it("hold each template's version alone, ready to paste into the platform console", () => {
    holdFolder(CONSOLE, templates.map((t) => ({ name: `${t.key}.json`, content: `${JSON.stringify(t.version, null, 2)}\n` })), ".json");
    for (const template of templates) {
      const pasted = JSON.parse(read(join(CONSOLE, `${template.key}.json`))) as Record<string, unknown>;
      // Exactly the three keys the console's form expects.
      expect(Object.keys(pasted)).toEqual(["globalStyles", "pages", "sections"]);
    }
  });

  it("list every template in INDEX.md, in the gallery's order, with its version file", () => {
    holdFolder(CONSOLE, [{ name: "INDEX.md", content: xsTemplateIndex(templates) }], ".md");
    const index = read(join(CONSOLE, "INDEX.md"));
    for (const template of templates) expect(index, template.key).toContain(`| ${template.key} | ${template.name} | ${template.category} |`);
  });
});
