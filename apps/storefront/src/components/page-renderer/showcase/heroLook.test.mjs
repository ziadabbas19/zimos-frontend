import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HERO_OVERLAY_MAX, heroLookMarkup, resolveHeroLook } from "./heroLook.ts";

/**
 * Pins the promise the hero's new settings make: a slide saved before they
 * existed resolves to what the store always drew and adds nothing to its
 * markup, and a phone falls back to the computer's value one setting at a
 * time.
 */

const OLD = { desktop: { side: "center", vertical: "bottom", overlay: 0 }, phone: { side: "center", vertical: "bottom", overlay: 0 } };

describe("resolveHeroLook", () => {
  it("draws a slide with no settings as it always was, switch on or off", () => {
    for (const enabled of [true, false]) {
      assert.deepEqual(resolveHeroLook({}, enabled), OLD);
      assert.deepEqual(resolveHeroLook({ image: "https://cdn.test/a.jpg", heading: "Summer" }, enabled), OLD);
    }
  });

  it("keeps a saved computer place on both devices when the phone sets nothing", () => {
    for (const enabled of [true, false]) {
      const look = resolveHeroLook({ side: "start", vertical: "top" }, enabled);
      assert.deepEqual(look.desktop, { side: "start", vertical: "top", overlay: 0 });
      assert.deepEqual(look.phone, look.desktop);
    }
  });

  it("falls back to the computer one setting at a time", () => {
    const look = resolveHeroLook({ side: "end", vertical: "middle", overlay: 40, verticalMobile: "bottom" }, true);
    assert.deepEqual(look.desktop, { side: "end", vertical: "middle", overlay: 40 });
    assert.deepEqual(look.phone, { side: "end", vertical: "bottom", overlay: 40 });
  });

  it("lets a phone have a place and a veil of its own", () => {
    const look = resolveHeroLook({ side: "start", vertical: "top", overlay: 20, sideMobile: "center", verticalMobile: "bottom", overlayMobile: 55 }, true);
    assert.deepEqual(look.desktop, { side: "start", vertical: "top", overlay: 20 });
    assert.deepEqual(look.phone, { side: "center", vertical: "bottom", overlay: 55 });
  });

  it("takes 0 on a phone as no veil there, not as unset", () => {
    assert.equal(resolveHeroLook({ overlay: 30, overlayMobile: 0 }, true).phone.overlay, 0);
    assert.equal(resolveHeroLook({ overlay: 30 }, true).phone.overlay, 30);
    assert.equal(resolveHeroLook({ overlayMobile: 25 }, true).desktop.overlay, 0);
    assert.equal(resolveHeroLook({ overlayMobile: 25 }, true).phone.overlay, 25);
  });

  it("holds the veil inside 0 to 60 and rounds it", () => {
    assert.equal(HERO_OVERLAY_MAX, 60);
    assert.equal(resolveHeroLook({ overlay: 95 }, true).desktop.overlay, 60);
    assert.equal(resolveHeroLook({ overlay: -5 }, true).desktop.overlay, 0);
    assert.equal(resolveHeroLook({ overlay: 12.6 }, true).desktop.overlay, 13);
    assert.equal(resolveHeroLook({ overlay: "35" }, true).desktop.overlay, 35);
    assert.equal(resolveHeroLook({ overlay: 10, overlayMobile: 300 }, true).phone.overlay, 60);
  });

  it("reads anything that is not a known value as unset", () => {
    const junk = { side: "left", vertical: 3, sideMobile: "", verticalMobile: null, overlay: "lots", overlayMobile: {} };
    assert.deepEqual(resolveHeroLook(junk, true), OLD);
    // An unknown phone value falls back to the computer's, not to the default.
    const look = resolveHeroLook({ side: "end", vertical: "top", overlay: 30, sideMobile: "up", verticalMobile: [], overlayMobile: "" }, true);
    assert.deepEqual(look.phone, { side: "end", vertical: "top", overlay: 30 });
  });

  it("reads none of the new settings while the switch is off", () => {
    const slide = { side: "end", vertical: "top", sideMobile: "start", verticalMobile: "bottom", overlay: 50, overlayMobile: 20 };
    const look = resolveHeroLook(slide, false);
    assert.deepEqual(look.desktop, { side: "end", vertical: "top", overlay: 0 });
    assert.deepEqual(look.phone, look.desktop);
  });
});

describe("heroLookMarkup", () => {
  it("adds nothing for a slide that sets nothing", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({}, true)), { overlay: null });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ side: "start", vertical: "top" }, true)), { overlay: null });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ side: "end", sideMobile: "start", overlay: 40 }, false)), { overlay: null });
  });

  it("names the phone's place only where it differs", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ side: "start", sideMobile: "start", verticalMobile: "top" }, true)), {
      overlay: null,
      phoneVertical: "top",
    });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ sideMobile: "end", verticalMobile: "bottom" }, true)), { overlay: null, phoneSide: "end" });
  });

  it("gives the veil as an opacity for each device", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlay: 40 }, true)).overlay, { desktop: 0.4, phone: 0.4 });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlay: 40, overlayMobile: 0 }, true)).overlay, { desktop: 0.4, phone: 0 });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlayMobile: 60 }, true)).overlay, { desktop: 0, phone: 0.6 });
    assert.equal(heroLookMarkup(resolveHeroLook({ overlay: 0, overlayMobile: 0 }, true)).overlay, null);
  });
});
