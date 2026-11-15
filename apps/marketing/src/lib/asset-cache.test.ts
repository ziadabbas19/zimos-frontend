import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_ASSET_CACHE, PUBLIC_ASSET_DIRS, publicAssetHeaders } from "./asset-cache";

// jsdom gives the module an http URL, so the folder comes from __dirname.
const PUBLIC = resolve(__dirname, "../../public");

describe("the cache of the files in public/", () => {
  it("covers every folder of public/", () => {
    const folders = readdirSync(PUBLIC).filter((name) => statSync(join(PUBLIC, name)).isDirectory());
    expect([...PUBLIC_ASSET_DIRS].sort()).toEqual(folders.sort());
  });

  it("keeps them a week and never marks names without a hash immutable", () => {
    expect(PUBLIC_ASSET_CACHE).toBe("public, max-age=604800, stale-while-revalidate=2592000");
    expect(PUBLIC_ASSET_CACHE).not.toMatch(/immutable/);
  });

  it("gives next.config one rule per folder, for everything under it", () => {
    expect(publicAssetHeaders()).toContainEqual({
      source: "/stores/:path*",
      headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE }],
    });
    expect(publicAssetHeaders()).toHaveLength(PUBLIC_ASSET_DIRS.length);
  });
});
