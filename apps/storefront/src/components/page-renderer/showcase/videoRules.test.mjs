import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HERO_PHONE_MAX_PX } from "./heroLook.ts";
import { HERO_PHONE_QUERY, REDUCED_MOTION_QUERY, connectionOf, heroVideoAllowed, videoTypeOf } from "./videoRules.ts";

/** A wide screen, motion allowed, and a browser that says nothing about its connection. */
const FINE = { phone: false, reducedMotion: false };

describe("heroVideoAllowed", () => {
  it("plays on a wide screen when nothing speaks against it", () => {
    assert.equal(heroVideoAllowed(FINE), true);
    assert.equal(heroVideoAllowed({ ...FINE, saveData: false, effectiveType: "4g" }), true);
  });

  it("keeps the picture on a phone-wide screen", () => {
    assert.equal(heroVideoAllowed({ ...FINE, phone: true }), false);
    assert.equal(heroVideoAllowed({ ...FINE, phone: true, effectiveType: "4g" }), false);
  });

  it("keeps the picture for a visitor who asked for less motion", () => {
    assert.equal(heroVideoAllowed({ ...FINE, reducedMotion: true }), false);
  });

  it("keeps the picture with data saving on", () => {
    assert.equal(heroVideoAllowed({ ...FINE, saveData: true }), false);
    assert.equal(heroVideoAllowed({ ...FINE, saveData: true, effectiveType: "4g" }), false);
  });

  it("keeps the picture on a slow connection", () => {
    for (const effectiveType of ["slow-2g", "2g", "3g"]) assert.equal(heroVideoAllowed({ ...FINE, effectiveType }), false, effectiveType);
  });

  it("takes a browser that does not say, or says something unknown, as fast enough", () => {
    for (const effectiveType of [undefined, null, "", "5g", 4]) assert.equal(heroVideoAllowed({ ...FINE, effectiveType }), true, String(effectiveType));
    // Only a real `true` is data saving.
    for (const saveData of [undefined, null, false, "true", 1]) assert.equal(heroVideoAllowed({ ...FINE, saveData }), true, String(saveData));
  });
});

describe("the phone width", () => {
  it("is the hero's own narrow layout, the same in the script as in the place rules", () => {
    assert.equal(HERO_PHONE_QUERY, `(max-width: ${HERO_PHONE_MAX_PX}px)`);
    assert.equal(REDUCED_MOTION_QUERY, "(prefers-reduced-motion: reduce)");
  });
});

describe("connectionOf", () => {
  it("reads navigator.connection, and is null where there is none", () => {
    const connection = { saveData: true, effectiveType: "2g" };
    assert.equal(connectionOf({ connection }), connection);
    for (const nav of [undefined, null, {}, { connection: null }, { connection: "wifi" }]) assert.equal(connectionOf(nav), null);
  });
});

describe("videoTypeOf", () => {
  it("names MP4 and WebM by the address, whatever follows it", () => {
    assert.equal(videoTypeOf("https://cdn.test/ws/clip.mp4"), "video/mp4");
    assert.equal(videoTypeOf("https://cdn.test/ws/CLIP.MP4?v=2#t=1"), "video/mp4");
    assert.equal(videoTypeOf("/uploads/ws/clip.webm"), "video/webm");
  });

  it("says nothing for an address it cannot read a type from", () => {
    assert.equal(videoTypeOf("https://cdn.test/ws/clip"), undefined);
    assert.equal(videoTypeOf("https://cdn.test/mp4/clip.mov"), undefined);
  });
});
