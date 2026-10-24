// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The API's two addresses stay apart (lib/serverApiBase.ts). The public one,
 * NEXT_PUBLIC_API_BASE_URL, is read directly only by the code the browser
 * runs or links to; everything on the server goes through serverApiBase, so
 * INTERNAL_API_BASE_URL applies to it. The private one is read in that one
 * file, never under a NEXT_PUBLIC_ name, and never by browser code, so it
 * can't end up in a bundle or in the HTML.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const APP = fileURLToPath(new URL("../..", import.meta.url));

/** Run or rendered for the browser: they must keep the public address. */
const BROWSER_FILES = ["lib/apiClient.ts", "lib/analyticsEvents.ts", "components/DigitalDownload.tsx", "components/LearnPortal.tsx"];
const READS_PUBLIC = /process\.env\.NEXT_PUBLIC_API_BASE_URL|process\.env\[\s*["']NEXT_PUBLIC_API_BASE_URL/;
const READS_INTERNAL = /process\.env\.INTERNAL_API_BASE_URL|process\.env\[\s*["']INTERNAL_API_BASE_URL|\{[^}]*\bINTERNAL_API_BASE_URL\b[^}]*\}\s*=\s*process\.env/;
const IMPORTS_SERVER_BASE = /from\s+["'](?:@\/lib\/serverApiBase|(?:\.\.?\/)+(?:lib\/)?serverApiBase)["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.(ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe("where the API's address is read", () => {
  const files = sourceFiles(SRC).map((path) => ({
    name: relative(SRC, path).split(sep).join("/"),
    text: readFileSync(path, "utf8"),
  }));

  it("sees the browser files, so the checks below are not empty", () => {
    for (const name of BROWSER_FILES) {
      const file = files.find((f) => f.name === name);
      expect(file, name).toBeDefined();
      expect(READS_PUBLIC.test(file!.text), name).toBe(true);
    }
  });

  it("reads the public address directly only in browser code and lib/serverApiBase", () => {
    const offenders = files
      .filter((file) => READS_PUBLIC.test(file.text))
      .map((file) => file.name)
      .filter((name) => name !== "lib/serverApiBase.ts" && !BROWSER_FILES.includes(name));
    expect(offenders).toEqual([]);
  });

  it("reads the private address in lib/serverApiBase alone, and never under a NEXT_PUBLIC_ name", () => {
    const readers = files.filter((file) => READS_INTERNAL.test(file.text)).map((file) => file.name);
    expect(readers).toEqual(["lib/serverApiBase.ts"]);
    expect(files.filter((file) => /NEXT_PUBLIC_INTERNAL_API/.test(file.text)).map((file) => file.name)).toEqual([]);
    // next.config's `env` would write it into the browser bundle.
    expect(readFileSync(join(APP, "next.config.ts"), "utf8")).not.toMatch(/INTERNAL_API_BASE_URL/);
  });

  it("is never imported by browser code", () => {
    const offenders = files
      .filter((file) => IMPORTS_SERVER_BASE.test(file.text))
      .filter((file) => BROWSER_FILES.includes(file.name) || /^\s*["']use client["']/.test(file.text))
      .map((file) => file.name);
    expect(offenders).toEqual([]);
  });

  it("is what the server's calls are built on", () => {
    for (const name of ["lib/serverApiClient.ts", "lib/customDomains.ts", "app/store/[workspaceId]/preview/route.ts"]) {
      const file = files.find((f) => f.name === name);
      expect(file, name).toBeDefined();
      expect(file!.text, name).toMatch(/serverApiBase\(\)/);
      expect(file!.text, name).toMatch(/serverApiFetch/);
    }
  });
});
