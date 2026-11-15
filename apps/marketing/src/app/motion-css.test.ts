import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The rules the site's motion and the home page's scale stand on, read from
 * the stylesheets themselves: app/landing.css (the kit every other page
 * shares) and app/home.css (the home page, every rule under `.zm`).
 */

// A path, not a URL: under jsdom `URL` is jsdom's, which node:fs does not take.
const read = (file: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), file), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const landing = read("landing.css");
const home = read("home.css");

/** The innermost rules of `text`: each selector, and the body it carries. */
function rules(text: string) {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) =>
    selectors
      .split(";")
      .pop()!
      .split(",")
      .map((selector) => ({ selector: selector.trim().replace(/\s+/g, " "), body })),
  );
}

/** What the at-rule blocks opened with `head` hold, end to end. */
function block(text: string, head: string) {
  let out = "";
  for (let at = text.indexOf(`${head} {`); at !== -1; at = text.indexOf(`${head} {`, at + 1)) {
    let depth = 0;
    for (let i = text.indexOf("{", at); i < text.length; i += 1) {
      if (text[i] === "{") depth += 1;
      else if (text[i] === "}" && (depth -= 1) === 0) {
        out += text.slice(text.indexOf("{", at) + 1, i);
        break;
      }
    }
  }
  return out;
}

describe("the other pages' endless animations (landing.css)", () => {
  const endless = [...new Set(rules(landing).filter((rule) => /animation:[^;]*\binfinite\b/.test(rule.body)).map((rule) => rule.selector))];

  it("are found", () => {
    expect(endless).toEqual(expect.arrayContaining([".lz-marquee__track", ".lz-fx__orb", ".lz-fx__wave"]));
  });

  it("all stop for someone who asked for less motion", () => {
    const stopped = rules(block(landing, "@media (prefers-reduced-motion: reduce)"))
      .filter((rule) => /animation:\s*none/.test(rule.body))
      .map((rule) => rule.selector);
    expect(stopped).toEqual(expect.arrayContaining(endless));
  });
});

describe("the home page's motion (home.css)", () => {
  const keyframes = [...home.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];

  it("animates only transform and opacity", () => {
    expect(keyframes.length).toBeGreaterThan(20);
    const other = keyframes.flatMap(([, name, body]) =>
      [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((prop) => !["transform", "opacity", "translate", "rotate", "scale"].includes(prop)).map((prop) => `${name}: ${prop}`),
    );
    expect(other).toEqual([]);
  });

  it("stops every animation for someone who asked for less motion", () => {
    const reduced = block(home, "@media (prefers-reduced-motion: reduce)");
    expect(rules(reduced)).toContainEqual(expect.objectContaining({ selector: ".zm *", body: expect.stringMatching(/animation:\s*none\s*!important/) }));
  });

  it("holds the endless animations of a section out of view", () => {
    expect(rules(home)).toContainEqual(expect.objectContaining({ selector: ".zm .is-off *", body: expect.stringMatching(/animation-play-state:\s*paused/) }));
  });

  it("reveals on scroll by transform alone, and only once the effects run", () => {
    const reveal = rules(home).filter((rule) => rule.selector.includes(".rv"));
    expect(reveal.map((rule) => rule.selector)).toEqual(expect.arrayContaining([".zm-fx .rv", ".zm-fx .rv:not(.is-in)"]));
    for (const rule of reveal) expect(rule.body).not.toMatch(/opacity|visibility|display/);
  });
});

describe("the home page's scale (home.css)", () => {
  it("leaves the site's zoom off and draws with one factor from the root font size", () => {
    const root = rules(home).filter((rule) => rule.selector === "html:has(.zm)");
    expect(root[0].body).toMatch(/zoom:\s*1;/);
    expect(root[0].body).toMatch(/font-size:\s*calc\(var\(--s\) \* 100%\)/);
    expect(block(home, "@media (min-width: 601px)")).toMatch(/--s:\s*0\.9;/);
    expect(block(home, "@media (min-width: 1024px)")).toMatch(/--s:\s*calc\(0\.9 \* 0\.67\);/);
    // The zoom it replaces, which every other page keeps.
    expect(block(landing, "@media (min-width: 601px)")).toMatch(/zoom:\s*0\.9/);
  });

  it("keeps buttons on one line, at least 12px apart, stacked on a phone", () => {
    const all = rules(home);
    expect(home).toMatch(/--gap-btn:\s*max\(12px,/);
    expect(all.find((rule) => rule.selector === ".zm-ctas")?.body).toMatch(/gap:\s*var\(--gap-btn\)/);
    expect(all.find((rule) => rule.selector === ".zm-btn")?.body).toMatch(/white-space:\s*nowrap/);
    expect(rules(block(home, "@media (max-width: 639.98px)"))).toContainEqual(expect.objectContaining({ selector: ".zm-ctas", body: expect.stringMatching(/flex-direction:\s*column/) }));
    // A button never grows on hover, so the magnetic pull alone moves it.
    for (const rule of all.filter((r) => /\.zm-btn[^ ]*:hover$/.test(r.selector))) expect(rule.body).not.toMatch(/scale/);
  });
});
