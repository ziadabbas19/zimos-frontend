import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { XS_CREDITS } from "../../../storefront/src/lib/xsShell";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";
import {
  GALLERY,
  GALLERY_FIRST,
  GALLERY_LOOKS,
  HERO_LOOKS,
  HERO_PHONES,
  JOURNEY_LOOK,
  JOURNEY_SHOT,
  OWN_LOOKS,
  SHOT_CREDITS,
  STORE_KINDS,
  galleryShot,
} from "./store-shots";

/**
 * A store on the site is one of the library's imported designs, whose licence
 * asks for a credit, or one of ZIMOS's own (OWN_LOOKS), which asks for none;
 * the credits page writes SHOT_CREDITS, copied from the storefront's
 * XS_CREDITS, for the imported ones. So every look shown anywhere on the
 * page must be one of the gallery's, with its credit unless it is ZIMOS's
 * own — and 07 and 11, whose pictures' licence is unclear, are shown nowhere
 * (the owner, 2026-10-23).
 */
const ELSEWHERE = [...HERO_LOOKS, ...HERO_PHONES, JOURNEY_LOOK];
const IMPORTED = GALLERY_LOOKS.filter((look) => !OWN_LOOKS.includes(look));
const WITHHELD = ["07", "11"];
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../../public");

describe("the gallery's stores", () => {
  it("are many, each once, each of a known kind", () => {
    expect(GALLERY.length).toBeGreaterThan(GALLERY_FIRST);
    expect(new Set(GALLERY_LOOKS).size).toBe(GALLERY.length);
    for (const { look, kind } of GALLERY) expect(STORE_KINDS, `look ${look}`).toContain(kind);
  });

  it("open on six of more than one kind, an Arabic design of ZIMOS's own first", () => {
    const first = GALLERY.slice(0, GALLERY_FIRST);
    expect(OWN_LOOKS).toContain(first[0].look);
    expect(new Set(first.map((store) => store.kind)).size).toBeGreaterThanOrEqual(4);
  });

  it("each have their four pictures on disk, in both languages", () => {
    for (const look of GALLERY_LOOKS) {
      for (const locale of locales) {
        for (const device of ["desk", "phone"] as const) {
          for (const size of ["card", "full"] as const) {
            const src = galleryShot(look, locale, device, size);
            expect(existsSync(join(PUBLIC, src)), src).toBe(true);
          }
        }
      }
    }
  });

  it("each have a name, and every kind a name, in both languages", () => {
    for (const locale of locales) {
      const { names, kinds } = getDictionary(locale).templates;
      for (const look of GALLERY_LOOKS) expect(names[look], `${locale} ${look}`).toBeTruthy();
      for (const kind of ["all", ...STORE_KINDS] as const) expect(kinds[kind], `${locale} ${kind}`).toBeTruthy();
    }
  });

  it("show neither 07 nor 11", () => {
    for (const look of WITHHELD) {
      expect(GALLERY_LOOKS, `look ${look}`).not.toContain(look);
      expect(ELSEWHERE, `look ${look}`).not.toContain(look);
      expect(SHOT_CREDITS[look], `look ${look}`).toBeUndefined();
    }
  });
});

describe("the hero's and the journey's stores", () => {
  it("keeps three stores on the hero's laptop and three on its phones", () => {
    expect(HERO_LOOKS).toHaveLength(3);
    expect(HERO_PHONES).toHaveLength(3);
  });

  it("are gallery stores", () => {
    for (const look of ELSEWHERE) expect(GALLERY_LOOKS, `look ${look}`).toContain(look);
  });

  it("has the journey's picture on disk", () => {
    expect(existsSync(join(PUBLIC, JOURNEY_SHOT)), JOURNEY_SHOT).toBe(true);
  });
});

describe("store shot credits", () => {
  it("cover every imported look shown, and nothing else", () => {
    expect(Object.keys(SHOT_CREDITS).sort()).toEqual([...IMPORTED].sort());
  });

  it("counts as ZIMOS's own only the designs the storefront asks no credit for", () => {
    expect(OWN_LOOKS.length).toBeGreaterThan(0);
    for (const look of OWN_LOOKS) {
      expect(XS_CREDITS[look], `look ${look}`).toBeNull();
      expect(SHOT_CREDITS[look], `look ${look}`).toBeUndefined();
    }
  });

  it("matches the storefront's credit for each look", () => {
    for (const [look, credit] of Object.entries(SHOT_CREDITS)) {
      const { name, author, href, licence } = credit;
      expect({ name, author, href, licence }, `look ${look}`).toEqual(XS_CREDITS[look]);
    }
  });

  it("links only the Creative Commons licences, to their own deed", () => {
    for (const { licence, licenceHref } of Object.values(SHOT_CREDITS)) {
      const cc = /^CC BY (\d\.\d)$/.exec(licence);
      expect(licenceHref).toBe(cc ? `https://creativecommons.org/licenses/by/${cc[1]}/` : undefined);
    }
  });
});
