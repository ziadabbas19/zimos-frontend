import { describe, expect, it } from "vitest";
import { LOGO_HEIGHTS, LOGO_MAX_BYTES, LOGO_MIN_SIDE, logoFileProblem } from "./logoFile";

const file = (type: string, bytes = 1000) => new File([new Uint8Array(bytes)], "logo", { type });
const sized = (width: number, height: number) => async () => ({ width, height });

describe("logoFileProblem", () => {
  it("takes a square logo and a wide one", async () => {
    expect(await logoFileProblem(file("image/png"), sized(192, 192))).toBeNull();
    expect(await logoFileProblem(file("image/webp"), sized(600, 150))).toBeNull();
  });

  it("refuses anything that is not a PNG, JPG or WEBP", async () => {
    for (const type of ["image/gif", "image/svg+xml", "application/pdf", ""]) {
      expect(await logoFileProblem(file(type), sized(192, 192))).toEqual({ kind: "type" });
    }
  });

  it("refuses a file over the limit", async () => {
    expect(await logoFileProblem(file("image/png", LOGO_MAX_BYTES + 1), sized(192, 192))).toEqual({ kind: "heavy", bytes: LOGO_MAX_BYTES + 1 });
  });

  it("refuses a logo too small to stay sharp, on either side", async () => {
    expect(await logoFileProblem(file("image/png"), sized(LOGO_MIN_SIDE - 1, 200))).toEqual({ kind: "small", width: LOGO_MIN_SIDE - 1, height: 200 });
    expect(await logoFileProblem(file("image/png"), sized(300, LOGO_MIN_SIDE - 1))).toMatchObject({ kind: "small" });
    expect(await logoFileProblem(file("image/png"), sized(LOGO_MIN_SIDE, LOGO_MIN_SIDE))).toBeNull();
  });

  it("says so when the browser can't open the file", async () => {
    expect(await logoFileProblem(file("image/png"), async () => null)).toEqual({ kind: "unreadable" });
  });
});

describe("LOGO_HEIGHTS", () => {
  it("draws the default at 48 px on a computer and 40 px on a phone", () => {
    expect(LOGO_HEIGHTS.md).toEqual({ desktop: 48, phone: 40 });
  });

  it("grows from small to large on both screens", () => {
    expect(LOGO_HEIGHTS.sm.desktop).toBeLessThan(LOGO_HEIGHTS.md.desktop);
    expect(LOGO_HEIGHTS.md.desktop).toBeLessThan(LOGO_HEIGHTS.lg.desktop);
    expect(LOGO_HEIGHTS.sm.phone).toBeLessThan(LOGO_HEIGHTS.md.phone);
    expect(LOGO_HEIGHTS.md.phone).toBeLessThan(LOGO_HEIGHTS.lg.phone);
  });
});
