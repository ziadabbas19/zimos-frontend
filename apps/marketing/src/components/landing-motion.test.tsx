import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LandingMotion } from "./landing-motion";

/**
 * The landing's endless animations (app/landing.css): each one stops under
 * reduced motion, and on a phone waits for the page to finish loading —
 * components/landing-motion.tsx lets them go once `load` has fired.
 */

// A path, not a URL: under jsdom `URL` is jsdom's, which node:fs does not take.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/landing.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

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

/** What the @media blocks opened with `query` hold, end to end. */
function media(query: string) {
  let out = "";
  for (let at = css.indexOf(`@media ${query} {`); at !== -1; at = css.indexOf(`@media ${query} {`, at + 1)) {
    let depth = 0;
    for (let i = css.indexOf("{", at); i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}" && (depth -= 1) === 0) {
        out += css.slice(css.indexOf("{", at) + 1, i);
        break;
      }
    }
  }
  return out;
}

const endless = [...new Set(rules(css).filter((rule) => /animation:[^;]*\binfinite\b/.test(rule.body)).map((rule) => rule.selector))];

describe("the landing's endless animations", () => {
  it("are found (the hero's lights, chips and crossfade, the strip, the closing band…)", () => {
    expect(endless).toEqual(expect.arrayContaining([".lz-fx__orb", ".lz-fx__wave", ".lz-hero .lz-float", ".lz-cycle img", ".lz-marquee__track"]));
  });

  it("all stop for someone who asked for less motion", () => {
    const stopped = rules(media("(prefers-reduced-motion: reduce)"))
      .filter((rule) => /animation:\s*none/.test(rule.body))
      .map((rule) => rule.selector);
    expect(stopped).toEqual(expect.arrayContaining(endless));
  });

  it("all wait on a phone for the home page to finish loading", () => {
    const held = rules(media("(max-width: 600px)"))
      .filter((rule) => /animation-play-state:\s*paused/.test(rule.body) && rule.selector.startsWith("html:not(.lz-loaded) .lz-home "))
      .map((rule) => rule.selector.slice("html:not(.lz-loaded) .lz-home ".length));
    expect(held).toEqual(expect.arrayContaining(endless));
  });

  it("leave the hero's lights and lines still on a phone, and its chips without the blur", () => {
    const phone = rules(media("(max-width: 600px)"));
    const body = (selector: string) => phone.filter((rule) => rule.selector === selector).map((rule) => rule.body).join("");
    expect(body(".lz-hero .lz-fx__orb")).toMatch(/animation:\s*none/);
    expect(body(".lz-hero .lz-fx__wave")).toMatch(/animation:\s*none/);
    expect(body(".lz-hero .lz-float")).toMatch(/(^|[^-])backdrop-filter:\s*none/);
  });
});

describe("LandingMotion lets them go", () => {
  const html = document.documentElement;

  afterEach(() => {
    cleanup();
    delete (document as { readyState?: string }).readyState;
  });

  function loading(state: DocumentReadyState) {
    Object.defineProperty(document, "readyState", { configurable: true, get: () => state });
  }

  it("once the page has loaded", () => {
    loading("interactive");
    const { unmount } = render(createElement(LandingMotion));
    expect(html.classList.contains("lz-loaded")).toBe(false);
    window.dispatchEvent(new Event("load"));
    expect(html.classList.contains("lz-loaded")).toBe(true);
    unmount();
    expect(html.classList.contains("lz-loaded")).toBe(false);
  });

  it("at once when it already has (back on the home page from another)", () => {
    loading("complete");
    render(createElement(LandingMotion));
    expect(html.classList.contains("lz-loaded")).toBe(true);
  });
});
