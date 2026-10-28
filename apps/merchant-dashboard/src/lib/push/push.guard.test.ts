/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Decision 1: the service worker is registered from src/lib/push only, behind
// VITE_PUSH_ENABLED, and the manifest is linked from there too (index.html and
// main.tsx stay without either: theme.test.ts and routes/prefetch.test.ts).

const SRC = fileURLToPath(new URL("../..", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../../../public", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("the service worker and the manifest", () => {
  it("are touched by src/lib/push alone", () => {
    const outside = files(SRC)
      .map((path) => relative(SRC, path).split(sep).join("/"))
      // src/test/: the browser doubles the push tests use (pushFakes.ts).
      .filter((path) => !path.startsWith("lib/push/") && !path.startsWith("test/"))
      .filter((path) => /serviceWorker|PushManager|manifest\.webmanifest|rel\s*=\s*["']manifest/.test(readFileSync(join(SRC, path), "utf8")));
    expect(outside).toEqual([]);
    // Reads every source file: on a busy machine that is far past the default 5 s.
  }, 120_000);

  // The manifest's icons (four since the app icons got their tiles): src/lib/appIcons.test.ts.
  it("the manifest: the dashboard at /, standalone", () => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));
    expect(manifest).toMatchObject({ start_url: "/", scope: "/", display: "standalone", short_name: "Zimos" });
  });
});
