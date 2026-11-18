import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("./xs-shell.css", import.meta.url), "utf8");

test("a store on an imported template never scrolls sideways", () => {
  const rules = [...css.matchAll(/\.brand-theme\[data-xs-shell\]\s*\{([^}]*)\}/g)].map((match) => match[1]);
  assert.ok(rules.some((body) => /overflow-x:\s*clip/.test(body)));
  // `clip`, not `hidden`: a hidden wrapper would stop the sticky header from sticking.
  assert.ok(!rules.some((body) => /overflow(-x)?:\s*hidden/.test(body)));
});

test("a template's dark logo turns white on a dark store, and a merchant's logo is left alone", () => {
  const rule = /([^{}]*)\{\s*filter:\s*brightness\(0\) invert\(1\);/.exec(css);
  assert.ok(rule, "the rule is there");
  for (const selector of rule[1].split(/,\s*\n/)) {
    assert.match(selector, /\[data-color-mode="dark"\]/);
    assert.match(selector, /img\[data-xs-logo="template"\]/);
  }
});
