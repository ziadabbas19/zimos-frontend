// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FACES, readXsTokens, xsTokenCss, xsTokenLooks } from "./xsTokens";
import { XS_READABLE } from "./xsReadable";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("xsTokens: easier-to-read text", () => {
  it("darkens a template's too-light text colours just enough, on request, for the look the store wears", () => {
    expect(xsTokenCss(readXsTokens({ readable: true }), "05")).toContain(`--xs-muted:${XS_READABLE["05"]["--xs-muted"]}`);
    expect(xsTokenCss(readXsTokens({ readable: true }), "02")).toBe("");
    expect(xsTokenCss(readXsTokens({}), "05")).toBe("");
  });

  it("gives shades of body and muted text that read at 4.5:1 or better on white", () => {
    for (const [look, shades] of Object.entries(XS_READABLE)) {
      for (const [name, shade] of Object.entries(shades)) {
        if (name === "--xs-footer-ink") continue;
        expect([look, name, (1 + 0.05) / (luminance(shade) + 0.05) >= 4.5]).toEqual([look, name, true]);
      }
    }
  });
});

describe("xsTokens: a store's Template look", () => {
  it("keeps the template's own when nothing (or nothing sound) was chosen", () => {
    expect(readXsTokens(undefined)).toEqual({});
    expect(readXsTokens({ display: "comic-sans", radius: 99, scale: 300, space: -1 })).toEqual({});
    // 100% is the template's size and spacing: nothing to write.
    expect(readXsTokens({ scale: 100, space: 100 })).toEqual({});
    expect(xsTokenCss({})).toBe("");
  });

  it("writes the chosen faces as the look's own tokens, at the look's specificity, after it", () => {
    const css = xsTokenCss(readXsTokens({ display: "cookie", sans: "marcellus" }));
    expect(css).toContain(`--xs-display:${FACES.cookie.stack}`);
    expect(css).toContain(`--xs-sans:${FACES.marcellus.stack}`);
    expect(css.startsWith(".brand-theme[data-xs-shell],:where(.brand-theme[data-xs-shell]) [data-xs-look]{")).toBe(true);
  });

  it("pairs every Latin face with an Arabic one, and names a look that carries both", () => {
    for (const face of Object.values(FACES)) {
      // A Latin face may be followed by its sized fallbacks (app/xs-fonts.css), named after it.
      expect(face.stack).toMatch(/^"([^"]+)", (?:"\1 Fallback", "\1 Fallback Android", )?"XS Ar [^"]+", (sans-)?serif$/);
      expect(face.via).toMatch(/^\d\d$/);
    }
    expect(xsTokenLooks({ display: "cookie", sans: "marcellus" })).toEqual(["18", "03"]);
    expect(xsTokenLooks({ display: "poppins", sans: "playfair" })).toEqual(["01"]);
  });

  it("rounds the buttons, sizes the words and spaces the sections", () => {
    const css = xsTokenCss(readXsTokens({ radius: 24, scale: 115, space: 60 }));
    expect(css).toContain("--xs-btn-radius:24px");
    expect(css).toContain("border-radius:24px!important");
    expect(css).toContain("zoom:1.15");
    expect(css).toContain("--xs-space:0.6");
  });
});
