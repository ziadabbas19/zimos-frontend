/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The dashboard's home-screen and app icons (public/brand/README.md, "The
// dashboard's app icons"): the four files, what the manifest and index.html
// say about them, and what each file really is (its PNG header).

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));
const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));
const page = readFileSync(join(PUBLIC, "..", "index.html"), "utf8");

/** Width, height and whether the PNG has an alpha channel (colour type 6 or 4), from its IHDR. */
function png(file: string) {
  const bytes = readFileSync(join(PUBLIC, file));
  expect(bytes.subarray(1, 4).toString("ascii"), file).toBe("PNG");
  const colourType = bytes[25];
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), alpha: colourType === 6 || colourType === 4 };
}

const EXPECTED = [
  { src: "/icon-192.png", sizes: "192x192", purpose: "any", alpha: true },
  { src: "/icon-512.png", sizes: "512x512", purpose: "any", alpha: true },
  { src: "/icon-maskable-512.png", sizes: "512x512", purpose: "maskable", alpha: false },
  { src: "/apple-touch-icon.png", sizes: "180x180", purpose: "any", alpha: false },
];

describe("the dashboard's app icons", () => {
  it("the manifest lists the four, each with its size, type and purpose", () => {
    expect(manifest.icons).toEqual(EXPECTED.map(({ src, sizes, purpose }) => ({ src, sizes, type: "image/png", purpose })));
  });

  it("each file exists, is the size the manifest says, and has transparency only where it may", () => {
    for (const icon of EXPECTED) {
      const file = icon.src.slice(1);
      expect(existsSync(join(PUBLIC, file)), file).toBe(true);
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(png(file), file).toEqual({ width: w, height: h, alpha: icon.alpha });
    }
  });

  it("iOS gets the white 180 tile, with no alpha channel (it would fill transparency with black)", () => {
    expect(page).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" sizes="180x180" \/>/);
    expect(png("apple-touch-icon.png")).toEqual({ width: 180, height: 180, alpha: false });
  });

  it("keeps the manifest's own address and scope", () => {
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
  });
});
