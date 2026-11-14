import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { XS_CREDITS } from "../../../storefront/src/lib/xsShell";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";
import { GALLERY_LOOKS, HERO_LOOKS, HERO_PHONES, JOURNEY_LOOK, OWN_LOOKS, SHOT_CREDITS, STORE_SHOTS, deskShot } from "./store-shots";

/**
 * A capture on the site is of an imported design whose licence asks for a
 * credit, or of one of ZIMOS's own (OWN_LOOKS), which asks for none; the
 * credits page writes SHOT_CREDITS, copied from the storefront's XS_CREDITS,
 * for the gallery's imported looks. So every look shown anywhere on the page
 * must be one of the gallery's, with its credit unless it is ZIMOS's own —
 * and 07 and 11, whose pictures' licence is unclear, are shown nowhere (the
 * owner, 2026-10-23).
 */
const SHOWN = [...GALLERY_LOOKS, ...HERO_LOOKS, ...HERO_PHONES, JOURNEY_LOOK];
const IMPORTED = GALLERY_LOOKS.filter((look) => !OWN_LOOKS.includes(look));
const WITHHELD = ["07", "11"];
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../../public");

describe("store shots", () => {
  it("keeps three stores on the hero's laptop, three on its phones, and at least four in the gallery", () => {
    expect(HERO_LOOKS).toHaveLength(3);
    expect(HERO_PHONES).toHaveLength(3);
    expect(GALLERY_LOOKS.length).toBeGreaterThanOrEqual(4);
  });

  it("shows only gallery looks, each with its captures, and its credit unless it is ZIMOS's own", () => {
    for (const look of SHOWN) {
      expect(GALLERY_LOOKS, `look ${look}`).toContain(look);
      expect(STORE_SHOTS[look], `look ${look}`).toBeDefined();
      if (!OWN_LOOKS.includes(look)) expect(SHOT_CREDITS[look], `look ${look}`).toBeDefined();
    }
    expect(Object.keys(SHOT_CREDITS).sort()).toEqual([...IMPORTED].sort());
  });

  it("counts as ZIMOS's own only the designs the storefront asks no credit for", () => {
    expect(OWN_LOOKS.length).toBeGreaterThan(0);
    for (const look of OWN_LOOKS) {
      expect(XS_CREDITS[look], `look ${look}`).toBeNull();
      expect(SHOT_CREDITS[look], `look ${look}`).toBeUndefined();
    }
  });

  it("puts on a phone only the looks that have a phone capture", () => {
    for (const look of HERO_PHONES) expect(STORE_SHOTS[look].phone, `look ${look}`).toBeTruthy();
  });

  it("shows a look in Arabic where it has an Arabic capture, in English otherwise", () => {
    for (const look of GALLERY_LOOKS) {
      const { desk, deskAr } = STORE_SHOTS[look];
      expect(deskShot(look, "en")).toBe(desk);
      expect(deskShot(look, "ar")).toBe(deskAr ?? desk);
    }
  });

  it("shows neither 07 nor 11", () => {
    for (const look of WITHHELD) {
      expect(SHOWN, `look ${look}`).not.toContain(look);
      expect(STORE_SHOTS[look], `look ${look}`).toBeUndefined();
      expect(SHOT_CREDITS[look], `look ${look}`).toBeUndefined();
    }
  });

  it("has every capture it points at in public/stores", () => {
    for (const { desk, deskAr, phone } of Object.values(STORE_SHOTS)) {
      for (const src of [desk, deskAr, phone]) {
        if (src) expect(existsSync(join(PUBLIC, src)), src).toBe(true);
      }
    }
  });

  it("names each gallery look's category, and says a line about it, in both languages", () => {
    for (const locale of locales) {
      const { categories, blurbs } = getDictionary(locale).templates;
      for (const look of GALLERY_LOOKS) {
        expect(categories[look], `${locale} ${look}`).toBeTruthy();
        expect(blurbs[look], `${locale} ${look}`).toBeTruthy();
      }
    }
  });
});

describe("store shot credits", () => {
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
