import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The dashboard (app.zimos.co) sits behind a sign-in: its page asks search
 * engines to leave it out of their results. The stores are apps/storefront,
 * with their own robots rules, and stay indexed.
 */
const page = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

describe("the dashboard and search engines", () => {
  it("asks them not to index or follow it, in the HTML that loads first", () => {
    const head = page.slice(0, page.indexOf("</head>"));
    expect(head).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});
