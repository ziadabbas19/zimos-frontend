import { describe, expect, it } from "vitest";
import { XS_CREDITS } from "../../../storefront/src/lib/xsShell";
import { HERO_LOOKS, SHOT_CREDITS, STORE_SHOTS } from "./store-shots";

/**
 * Every capture on the site is of an imported design whose licence asks for
 * a credit; the gallery writes SHOT_CREDITS, copied from the storefront's
 * XS_CREDITS. A new capture without its credit, or a credit that drifts from
 * the storefront's, fails here.
 */
describe("store shot credits", () => {
  it("has a credit for every look the site shows", () => {
    for (const look of [...Object.keys(STORE_SHOTS), ...HERO_LOOKS]) {
      expect(SHOT_CREDITS[look], `look ${look}`).toBeDefined();
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
