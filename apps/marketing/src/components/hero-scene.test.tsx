import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { HeroScene } from "./hero-scene";

/**
 * The hero's scene (hero-scene.tsx, app/hero-scene.css): decoration that
 * costs no script and little else — the rules the owner set for it
 * (2026-11-16), read from the markup and the stylesheet.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) =>
  readFileSync(join(here, path), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
const css = read("../app/hero-scene.css");
const home = read("../app/home.css");

/** Each innermost rule: its selectors, and the body it carries. */
const rules = (text: string) =>
  [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({ selectors: selectors.trim().replace(/\s+/g, " "), body }));

afterEach(cleanup);

describe("the hero's scene", () => {
  for (const locale of ["en", "ar"] as const) {
    const copy = getDictionary(locale).hero.scene;

    it(`is decoration, out of the reading and the tab order (${locale})`, () => {
      const { container } = render(createElement(HeroScene, { copy }));
      const layers = container.querySelectorAll(":scope > div");
      expect(layers).toHaveLength(2);
      for (const layer of layers) expect(layer.getAttribute("aria-hidden")).toBe("true");
      const boxes = container.querySelectorAll("input");
      expect(boxes).toHaveLength(16);
      for (const box of boxes) {
        expect(box.type).toBe("checkbox");
        expect(box.tabIndex).toBe(-1);
        expect(box.closest("label")).not.toBeNull();
      }
      // Nothing to fetch: no picture of any kind.
      expect(container.querySelectorAll("img, picture, video, canvas, iframe")).toHaveLength(0);
    });

    it(`says every word from the dictionary (${locale})`, () => {
      const { container } = render(createElement(HeroScene, { copy }));
      const labels = [...container.querySelectorAll("label")];
      expect(new Set(labels.map((label) => label.dataset.pop))).toEqual(new Set(Object.values(copy.pops)));
      for (const label of labels) expect(Object.values(copy.tips)).toContain(label.dataset.tip);
      const stat = container.querySelector(".zs-stat") as HTMLElement;
      expect(stat.dataset).toMatchObject({ t: copy.stat.today, o: copy.stat.orders, r: copy.stat.reviews });
      expect(container.querySelector(".zs-hint")?.textContent).toBe(copy.hint);
      expect(container.textContent).toContain(copy.chat.title);
    });

    it(`stays within 120 elements, and puts five objects and four stars on a phone's shelf (${locale})`, () => {
      const { container } = render(createElement(HeroScene, { copy }));
      expect(container.querySelectorAll("*").length).toBeLessThanOrEqual(120);
      expect(container.querySelectorAll("label.zs-q")).toHaveLength(5);
      expect(container.querySelectorAll(".zs-star:not(.zs-d)")).toHaveLength(4);
      // The shelf: the two boxes, the bell, the check and the rocket; no coin.
      const shelf = [...container.querySelectorAll("label.zs-q")].map((label) => label.className.match(/zk-(\w+)/)?.[1]).sort();
      expect(shelf).toEqual(["bell", "cube", "cube", "ok", "rocket"]);
    });
  }

  it("is a server component: no script of its own", () => {
    expect(readFileSync(join(here, "hero-scene.tsx"), "utf8")).not.toMatch(/["']use client["']/);
  });
});

describe("the hero's scene in CSS (app/hero-scene.css)", () => {
  it("travels inside home.css, so it is no request of its own", () => {
    expect(home.trimStart().startsWith('@import "./hero-scene.css";')).toBe(true);
  });

  it("moves by transform and opacity only, in its keyframes and its transitions", () => {
    const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    expect(keyframes.length).toBeGreaterThan(10);
    const moving = ["transform", "opacity", "translate", "rotate", "scale", "animation-timing-function"];
    const other = keyframes.flatMap(([, name, body]) => [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((prop) => !moving.includes(prop)).map((prop) => `${name}: ${prop}`));
    expect(other).toEqual([]);
    const transitions = [...css.matchAll(/transition:\s*([a-z-]+)/g)].map((m) => m[1]);
    expect(transitions.every((prop) => ["opacity", "scale", "translate"].includes(prop))).toBe(true);
  });

  it("asks for a layer of its own only for the boxes and the drifting light, and blurs nothing", () => {
    const layered = rules(css).filter((rule) => /will-change:\s*transform/.test(rule.body)).map((rule) => rule.selectors);
    expect(layered.sort()).toEqual([".zs-cube", ".zs-mesh"]);
    expect(css).not.toMatch(/backdrop-filter|filter:\s*blur|(?<![-\w])filter:/);
  });

  it("contains both layers and skips their rendering off screen", () => {
    const layers = rules(css).find((rule) => rule.selectors === ".zs-bg, .zs");
    expect(layers?.body).toMatch(/contain:\s*layout paint style/);
    expect(layers?.body).toMatch(/content-visibility:\s*auto/);
    expect(layers?.body).toMatch(/contain-intrinsic-size:\s*auto 900px/);
  });

  it("holds the light still on a phone, and keeps the hover hints to a mouse", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 1023.98px)"));
    expect(phone).toMatch(/\.zs-mesh\s*\{[^}]*animation:\s*none/);
    expect(phone).toMatch(/\.zs-q \.zs-in > \*,[^{]*\{[^}]*animation:\s*none/);
    expect(rules(css).filter((rule) => rule.selectors.includes(":hover")).length).toBeGreaterThan(0);
    // Every :hover rule sits in @media (hover: hover).
    const outside = css.replace(/@media \(hover: hover\)[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
    expect(outside).not.toMatch(/:hover/);
  });

  it("answers a tap without motion for someone who asked for less", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/scale:\s*1\.12/);
    expect(reduced).toMatch(/content:\s*none/);
    // home.css stops every animation on the page for them.
    expect(home).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.zm \*,\s*\.zm \*::before,\s*\.zm \*::after\s*\{\s*animation:\s*none !important/);
  });
});
