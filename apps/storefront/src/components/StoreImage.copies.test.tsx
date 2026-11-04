import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { thumbnailSrcSet } from "@store-builder/image-tools/thumbnails";

const UUID = "00000000-0000-4000-8000-000000000001";
const MARKED = `https://media.example.com/w/${UUID}-t.jpg`;
const PLAIN = `https://media.example.com/w/${UUID}.jpg`;

async function load(origins = "") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_STORE_IMAGE_ORIGINS", origins);
  return import("./StoreImage");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("thumbnailSrcSet", () => {
  it("names the four copies of a picture whose name says it has them", () => {
    expect(thumbnailSrcSet(MARKED)).toBe(
      [320, 640, 1024, 1600].map((w) => `https://media.example.com/w/${UUID}-t-w${w}.webp ${w}w`).join(", "),
    );
    expect(thumbnailSrcSet(`${MARKED}?v=1`)).toContain("-t-w320.webp 320w");
    for (const ext of ["png", "webp", "jpeg", "JPG"]) expect(thumbnailSrcSet(`https://m.example.com/${UUID}-t.${ext}`)).not.toBeNull();
  });

  it("is null for everything else, an older picture among them", () => {
    for (const url of [null, undefined, "", PLAIN, `https://m.example.com/${UUID}-t.gif`, "https://m.example.com/some-picture-t.jpg", `${UUID}-t.jpg`, "https://m.example.com/not-a-t.jpg"]) {
      expect(thumbnailSrcSet(url)).toBeNull();
    }
  });
});

describe("StoreImage", () => {
  it("picks among the copies by sizes, with no work for the optimizer, its own file staying the src", async () => {
    const { StoreImage } = await load("https://media.example.com");
    const html = renderToStaticMarkup(<StoreImage src={MARKED} alt="Lamp" width={600} height={600} sizes="50vw" loading="lazy" />);
    expect(html).toContain(`src="${MARKED}"`);
    expect(html).toContain("-t-w640.webp 640w");
    expect(html).toContain('sizes="50vw"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain("/_next/image");
  });

  it("leaves an older picture exactly as it was, with and without the optimizer", async () => {
    const off = await load("");
    expect(renderToStaticMarkup(<off.StoreImage src={PLAIN} alt="Lamp" width={600} height={600} sizes="50vw" loading="lazy" />)).toBe(`<img src="${PLAIN}" alt="Lamp" width="600" height="600" loading="lazy"/>`);
    const on = await load("https://media.example.com");
    expect(renderToStaticMarkup(<on.StoreImage src={PLAIN} alt="Lamp" width={600} height={600} sizes="50vw" loading="lazy" />)).toContain("/_next/image");
  });
});
