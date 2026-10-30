// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLOR_MODE_COOKIE } from "./colorModeCookie";
import { PRIVATE_ROUTES, PUBLIC_ROUTES, isPersonalCookie } from "./edgeCache";
import { LOCALE_COOKIE } from "./localeCookie";
import { STORE_PREVIEW_COOKIE } from "./storePreview";

/**
 * A page the CDN keeps (lib/edgeCache) is served to every visitor, so what the
 * server reads from a request to render it must be known. A file that starts
 * reading a cookie or a request header, or a new route under the store, fails
 * here until lib/edgeCache (and the CDN's rule, docs/edge-cache/README.md)
 * says what it means for the cache.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const STORE_ROUTES = join(SRC, "app", "store", "[workspaceId]");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  name: relative(SRC, path).split(sep).join("/"),
  text: readFileSync(path, "utf8"),
}));

const importsFromNextHeaders = (text: string, name: string) =>
  new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']next/headers["']`).test(text);

describe("what the server reads from a request (lib/edgeCache)", () => {
  it("classifies every route under the store as public or private", () => {
    const routes = readdirSync(STORE_ROUTES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "[...path]")
      .map((entry) => entry.name)
      .sort();
    expect([...PUBLIC_ROUTES, ...PRIVATE_ROUTES].sort()).toEqual(routes);
  });

  it("reads cookies only in the files known to, and only cookies that keep a page out of the cache", () => {
    const readers = files
      .filter((file) => importsFromNextHeaders(file.text, "cookies") || /\brequest\.cookies\.get\(/.test(file.text))
      .map((file) => file.name)
      .sort();
    expect(readers).toEqual(["lib/serverApiClient.ts", "lib/storeColorMode.ts", "lib/storeLocale.ts", "proxy.ts"]);
    for (const cookie of [LOCALE_COOKIE, COLOR_MODE_COOKIE, STORE_PREVIEW_COOKIE]) {
      expect(isPersonalCookie(cookie), cookie).toBe(true);
    }
  });

  it("reads request headers only in the files known to", () => {
    const readers = files
      .filter((file) => importsFromNextHeaders(file.text, "headers"))
      .map((file) => file.name)
      .sort();
    expect(readers).toEqual(["lib/documentLocale.ts", "lib/editorView.ts", "lib/serverApiClient.ts", "lib/storeRoute.ts"]);
  });
});
