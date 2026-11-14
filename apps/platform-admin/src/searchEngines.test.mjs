import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The console sits behind a sign-in: its page asks search engines to leave
 * it out of their results. The stores are apps/storefront, with their own
 * robots rules, and stay indexed.
 */
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("the console and search engines", () => {
  it("asks them not to index or follow it, in the HTML that loads first", () => {
    const head = page.slice(0, page.indexOf("</head>"));
    assert.ok(head.includes('<meta name="robots" content="noindex, nofollow" />'));
  });
});
