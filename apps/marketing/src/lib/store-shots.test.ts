import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { XS_CREDITS } from "../../../storefront/src/lib/xsShell";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";
import { END_LOOKS, FAN_LOOKS, GALLERY_LOOKS, HERO_LOOKS, SHOT_CREDITS, STORE_SHOTS } from "./store-shots";

/**
 * Every capture on the site is of an imported design whose licence asks for
 * a credit; the gallery writes SHOT_CREDITS, copied from the storefront's
 * XS_CREDITS, for the gallery's looks. So every look shown anywhere on the
 * page must be one of the gallery's, with its credit — and 07 and 11, whose
 * pictures' licence is unclear, are shown nowhere (the owner, 2026-10-23).
 */
const SHOWN = [...GALLERY_LOOKS, ...HERO_LOOKS, ...FAN_LOOKS, ...END_LOOKS];
const WITHHELD = ["07", "11"];
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../../public");

describe("store shots", () => {
  it("keeps three stores in the hero and at least four in the gallery", () => {
    expect(HERO_LOOKS).toHaveLength(3);
    expect(GALLERY_LOOKS.length).toBeGreaterThanOrEqual(4);
  });

  it("shows only gallery looks, each with its captures and its credit", () => {
    for (const look of SHOWN) {
      expect(GALLERY_LOOKS, `look ${look}`).toContain(look);
      expect(STORE_SHOTS[look], `look ${look}`).toBeDefined();
      expect(SHOT_CREDITS[look], `look ${look}`).toBeDefined();
    }
    expect(Object.keys(SHOT_CREDITS).sort()).toEqual([...GALLERY_LOOKS].sort());
  });

  it("shows neither 07 nor 11", () => {
    for (const look of WITHHELD) {
      expect(SHOWN, `look ${look}`).not.toContain(look);
      expect(STORE_SHOTS[look], `look ${look}`).toBeUndefined();
      expect(SHOT_CREDITS[look], `look ${look}`).toBeUndefined();
    }
  });

  it("has every capture it points at in public/stores", () => {
    for (const { desk, phone } of Object.values(STORE_SHOTS)) {
      for (const src of [desk, phone]) {
        expect(existsSync(join(PUBLIC, src)), src).toBe(true);
      }
    }
  });

  it("names each gallery look's category in both languages", () => {
    for (const locale of locales) {
      const { categories } = getDictionary(locale).templates;
      for (const look of GALLERY_LOOKS) expect(categories[look], `${locale} ${look}`).toBeTruthy();
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
