import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/urls";
import robots from "./robots";
import sitemap from "./sitemap";

/**
 * The sitemap lists every public page once per language, at its full
 * https://zimos.co address — the page's own canonical, never an address the
 * site redirects — and robots.txt lets everything be crawled and points at it.
 */

const APP = resolve(__dirname, "[locale]");

/** Every page under app/[locale], as its path: "", "/pricing", … */
function pagesOnDisk(dir = APP, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pagesOnDisk(full, `${prefix}/${name}`);
    return name === "page.tsx" ? [prefix] : [];
  });
}

/** Kept out on purpose: noindex, opened by the dashboard in a hidden frame. */
const HIDDEN = ["/signed-up"];

describe("the sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  it("lists every public page in both languages, and nothing else", () => {
    const expected = pagesOnDisk()
      .filter((path) => !HIDDEN.includes(path))
      .flatMap((path) => [`${SITE_URL}/ar${path}`, `${SITE_URL}/en${path}`]);
    expect(urls.slice().sort()).toEqual(expected.sort());
    expect(urls).toHaveLength(16);
  });

  it("has each address once, absolute, on https://zimos.co, with a language", () => {
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/zimos\.co\/(ar|en)(\/[a-z-]+)?$/);
      expect(url.endsWith("/")).toBe(false);
    }
  });

  it("points each page at both languages and at x-default, all absolute", () => {
    for (const entry of entries) {
      const path = entry.url.replace(/^https:\/\/zimos\.co\/(ar|en)/, "");
      expect(entry.alternates?.languages).toEqual({
        ar: `${SITE_URL}/ar${path}`,
        en: `${SITE_URL}/en${path}`,
        "x-default": `${SITE_URL}${path || "/"}`,
      });
    }
  });
});

describe("robots.txt", () => {
  it("lets every crawler in and points at the sitemap", () => {
    const rules = robots();
    expect(rules.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(rules.sitemap).toBe("https://zimos.co/sitemap.xml");
  });
});
