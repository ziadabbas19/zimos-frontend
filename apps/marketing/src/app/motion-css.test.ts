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
const plans = read("plans.css");

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

  it("holds the endless animations of a section out of view, its pseudo-elements' too", () => {
    for (const selector of [".zm .is-off *", ".zm .is-off *::before", ".zm .is-off *::after"])
      expect(rules(home)).toContainEqual(expect.objectContaining({ selector, body: expect.stringMatching(/animation-play-state:\s*paused/) }));
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

describe("the night panels (home.css)", () => {
  const all = rules(home);
  const body = (selector: string) => all.filter((rule) => rule.selector === selector).map((rule) => rule.body).join("");

  it("are light by day and night blue by night, through the site's own `.dark` class", () => {
    expect(body(".zm-night")).toMatch(/--n-bg:\s*linear-gradient\([^;]*var\(--color-primary-soft\)/);
    expect(body(".zm-night")).toMatch(/background:\s*var\(--n-bg\)/);
    expect(body(".dark .zm-night")).toMatch(/--n-bg:\s*var\(--night\)/);
    // The closing band stays night blue in both.
    expect(body(".zm-end")).toMatch(/background:\s*var\(--night\)/);
  });

  it("colour the journey and the dashboard with the panel's tokens only", () => {
    const parts = /^\.zm-(js|jlist|jstage|dhead|dnav|dtab|dwin|dcap|cap)\b|^\.zm-night \./;
    const own = all.filter((rule) => parts.test(rule.selector));
    expect(own.length).toBeGreaterThan(15);
    // Two colours are the same in both themes on purpose: the browser frame's
    // own grey (a device, as the phone is) and white type on the blue of a hovered button.
    const same = new Set([".zm-dwin { background: #eef2fa }", ".zm-dnav .zm-navbtn:hover { color: #fff }"]);
    const fixed = own.flatMap((rule) =>
      rule.body
        .split(";")
        .map((declaration) => declaration.trim().replace(/\s+/g, " "))
        .filter((declaration) => /^(?:color|background|border(?:-[a-z-]+)?|box-shadow):[^;]*(?:#[0-9a-f]{3,8}\b|rgb\()/i.test(declaration))
        .map((declaration) => `${rule.selector} { ${declaration} }`)
        .filter((line) => !same.has(line)),
    );
    expect(fixed).toEqual([]);
  });

  it("show the phone's screens coming in from a written start to a written end", () => {
    const keyframes = (name: string) => home.match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)\\s*\\}`))?.[1] ?? "";
    expect(keyframes("zm-in")).toMatch(/from\s*\{[^}]*opacity:\s*0;/);
    expect(keyframes("zm-in")).toMatch(/to\s*\{[^}]*opacity:\s*1;/);
    expect(keyframes("zm-grow")).toMatch(/to\s*\{[^}]*scaleY\(1\)/);
    // The cards that come in are never hidden by a rule of their own: with no animation they simply show.
    for (const selector of [".zm-q--slim", ".zm-pf .row", ".zm-bars i"]) expect(body(selector)).not.toMatch(/opacity:\s*0/);
  });
});

describe("the plan cards (plans.css)", () => {
  const all = rules(plans);
  const body = (selector: string) => all.filter((rule) => rule.selector === selector).map((rule) => rule.body).join("");

  it("let the marked plan's glow breathe by its opacity, and stand still for someone who asked for less motion", () => {
    expect(body(".zp-plan--hot::after")).toMatch(/animation:\s*zp-glow[^;]*infinite/);
    expect(plans).toMatch(/@keyframes zp-glow\s*\{\s*from\s*\{\s*opacity:[^}]*\}\s*to\s*\{\s*opacity:[^}]*\}\s*\}/);
    expect(rules(block(plans, "@media (prefers-reduced-motion: reduce)"))).toContainEqual(expect.objectContaining({ selector: ".zp-plan--hot::after", body: expect.stringMatching(/animation:\s*none/) }));
  });

  it("never raise or enlarge the marked plan, so the cards of a row stay one height", () => {
    expect(body(".zp-plan--hot")).not.toMatch(/scale|translate|transform/);
    expect(body(".zp-buy")).toMatch(/margin-block-start:\s*auto/);
  });

  it("set the colours for the light theme and again under `.dark`", () => {
    expect(body(".zp")).toMatch(/--zp-hot-bg:/);
    expect(body(".dark .zp")).toMatch(/--zp-hot-bg:\s*linear-gradient\(170deg, var\(--zp-navy\), #070b14\)/);
  });

  it("are loaded by the home page after its own stylesheet, and by the pricing page", () => {
    const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "[locale]/page.tsx"), "utf8");
    expect(home.indexOf('import "../plans.css"')).toBeGreaterThan(home.indexOf('import "../home.css"'));
    const pricing = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "[locale]/pricing/page.tsx"), "utf8");
    expect(pricing).toContain('import "../../plans.css"');
  });
});

describe("the home page on a phone and a tablet (home.css)", () => {
  const phone = rules(block(home, "@media (max-width: 639.98px)"));
  const below = rules(block(home, "@media (max-width: 1023.98px)"));
  const at = (list: ReturnType<typeof rules>, selector: string) => list.filter((rule) => rule.selector === selector).map((rule) => rule.body).join("");

  it("makes the store kinds, the stores and the dashboard's tabs rows to swipe, not stacks that wrap", () => {
    for (const selector of [".zm-chips", ".zm-sgrid", ".zm-dtabs"]) {
      expect(at(phone, selector)).toMatch(/flex-wrap:\s*nowrap/);
      expect(at(phone, selector)).toMatch(/overflow-x:\s*auto/);
      expect(at(phone, selector)).toMatch(/scroll-snap-type:\s*x/);
    }
    // The next store peeks in.
    expect(at(phone, ".zm-sgrid > li")).toMatch(/flex:\s*0 0 84%/);
  });

  it("puts the features in two columns and the steps, growth tools and reassurances in compact rows", () => {
    expect(at(phone, ".zm-fgrid")).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    for (const selector of [".zm-step", ".zm-gc", ".zm-tp"]) expect(at(phone, selector)).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\)/);
    expect(at(phone, ".zm-sec")).toMatch(/padding-block:\s*3\.25rem/);
  });

  it("stands the journey's phone, about 290px wide, under the steps with no tall box, and lays the dashboard flat", () => {
    expect(at(phone, ".zm-jph")).toMatch(/width:\s*min\(100%, 18\.125rem\)/);
    expect(at(below, ".zm-jstage")).toMatch(/min-height:\s*0/);
    expect(at(below, ".zm-dwin")).toMatch(/transform:\s*none/);
  });

  it("keeps the plans one under the other with room for the badge, and the switch centred", () => {
    expect(at(phone, ".zm-plans")).toMatch(/gap:\s*1\.75rem/);
    const tog = all(".zm-tog");
    expect(tog).toMatch(/width:\s*fit-content/);
    expect(tog).toMatch(/margin:\s*1\.75rem auto 0/);
  });

  it("keeps the header's buttons inside its pill on narrow phones", () => {
    const narrow = rules(block(home, "@media (max-width: 399.98px)"));
    expect(at(narrow, ".zm-hact > .zm-btn")).toMatch(/padding-inline:/);
    expect(at(narrow, ".zm-hdr-in")).toMatch(/gap:\s*0\.5rem/);
  });

  function all(selector: string) {
    return rules(home)
      .filter((rule) => rule.selector === selector)
      .map((rule) => rule.body)
      .join("");
  }
});
