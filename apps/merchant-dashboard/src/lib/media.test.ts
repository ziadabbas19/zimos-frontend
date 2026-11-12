import { describe, expect, it } from "vitest";
import { imageSrc, mediaSrc, storePictureSrc } from "./media";

describe("imageSrc", () => {
  it("keeps the absolute URL in a production build (no proxy there)", () => {
    expect(imageSrc("https://api.example.com/uploads/ws_1/a.png", false)).toBe("https://api.example.com/uploads/ws_1/a.png");
    expect(imageSrc("https://media.example.com/ws_1/a.png", false)).toBe("https://media.example.com/ws_1/a.png");
  });

  it("turns only /uploads/ links into proxy paths on the dev server", () => {
    expect(imageSrc("http://localhost:4000/uploads/ws_1/a.png?v=2", true)).toBe("/uploads/ws_1/a.png?v=2");
    // an R2 object key is not something the dev proxy serves
    expect(imageSrc("https://media.example.com/ws_1/a.png", true)).toBe("https://media.example.com/ws_1/a.png");
  });

  it("passes data, blob and relative URLs through, and nothing for nothing", () => {
    expect(imageSrc("data:image/png;base64,AAAA", false)).toBe("data:image/png;base64,AAAA");
    expect(imageSrc("blob:https://x/1", true)).toBe("blob:https://x/1");
    expect(imageSrc("/uploads/a.png", false)).toBe("/uploads/a.png");
    expect(imageSrc("", false)).toBeNull();
    expect(imageSrc(null)).toBeNull();
  });
});

describe("storePictureSrc", () => {
  const STORE = "https://store.example.com";
  it("asks the storefront for a host-relative path (a template's own art)", () => {
    expect(storePictureSrc("/xs/16/slide-1.jpg", STORE, false)).toBe("https://store.example.com/xs/16/slide-1.jpg");
    expect(storePictureSrc("  /template-art/a.webp ", STORE, false)).toBe("https://store.example.com/template-art/a.webp");
  });

  it("keeps an absolute address as imageSrc would", () => {
    expect(storePictureSrc("https://media.example.com/ws_1/a.png", STORE, false)).toBe("https://media.example.com/ws_1/a.png");
    expect(storePictureSrc("http://localhost:4000/uploads/ws_1/a.png", STORE, true)).toBe("/uploads/ws_1/a.png");
    expect(storePictureSrc("//cdn.example.com/a.png", STORE, false)).toBe("//cdn.example.com/a.png");
    expect(storePictureSrc("data:image/png;base64,AAAA", STORE, false)).toBe("data:image/png;base64,AAAA");
  });

  it("is null for nothing at all", () => {
    expect(storePictureSrc("", STORE, false)).toBeNull();
    expect(storePictureSrc("   ", STORE, false)).toBeNull();
    expect(storePictureSrc(undefined, STORE, false)).toBeNull();
  });
});

describe("mediaSrc", () => {
  it("uses the url, never the bare R2 object key", () => {
    expect(mediaSrc({ url: "https://media.example.com/ws_1/a.png", path: "/ws_1/a.png", mimeType: "image/png", size: 1 })).toBe(
      "https://media.example.com/ws_1/a.png"
    );
  });
});
