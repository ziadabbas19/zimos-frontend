import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The console's public/sw.js is a notifications-only worker, as the merchant
// dashboard's (decision 1: no fetch handler, no cache, no precache, no
// imported scripts), and only src/lib/push registers it or links the manifest.

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const SRC = fileURLToPath(new URL("../..", import.meta.url));

describe("public/sw.js", () => {
  // Comments may say what is not there; the code may not do it.
  const code = read("../../../public/sw.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("has no fetch handler, touches no cache and imports nothing", () => {
    assert.doesNotMatch(code, /addEventListener\(\s*["'`]fetch["'`]/);
    assert.doesNotMatch(code, /\bonfetch\b|respondWith/);
    assert.doesNotMatch(code, /\bcaches\b|precache|workbox/i);
    assert.doesNotMatch(code, /importScripts|\bimport\s*\(/);
  });

  it("listens to push, notificationclick and pushsubscriptionchange", () => {
    for (const event of ["push", "notificationclick", "pushsubscriptionchange"]) assert.match(code, new RegExp(`addEventListener\\("${event}"`));
  });

  it("the manifest: the console at /, standalone", () => {
    const manifest = JSON.parse(read("../../../public/manifest.webmanifest"));
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
  });
});

describe("the service worker and the manifest", () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("are touched by src/lib/push alone", () => {
    const outside = files(SRC)
      .map((path) => relative(SRC, path).split(sep).join("/"))
      .filter((path) => !path.startsWith("lib/push/"))
      .filter((path) => /serviceWorker|PushManager|manifest\.webmanifest|rel\s*=\s*["']manifest/.test(readFileSync(join(SRC, path), "utf8")));
    assert.deepEqual(outside, []);
  });
});
