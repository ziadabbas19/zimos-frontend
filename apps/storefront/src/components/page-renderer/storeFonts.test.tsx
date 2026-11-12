import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageTree } from "@store-builder/api-client";
import { fontFaceCss, fontStack, googleFontsCssUrl, readStoreFonts, resolveFontPair, type FontOption } from "@store-builder/ui/fonts";
import { productFontPair, storeFontRules } from "@/lib/storeFonts";
import { pageFontPairs } from "./fonts";
import { PageRenderer } from "./PageRenderer";

/**
 * Store fonts on the storefront: which pick wins where (element → section →
 * page → store), what reaches the page as CSS, and that nothing but a
 * catalog-shaped id and Google's own font files ever does.
 */

const store = { fonts: { primaryAr: "cairo", primaryEn: "inter" } };
let themeSettings: Record<string, unknown> = store;

vi.mock("@/lib/storeMeta", () => ({ getStoreMeta: async () => ({ themeSettings }) }));
// The faces are fetched on the server; here only which pairs asked for them is recorded.
vi.mock("@/components/fonts/StoreFontFaces", () => ({
  StoreFontFaces: ({ pairs }: { pairs: unknown[] }) => <meta data-faces={JSON.stringify(pairs)} />,
}));
vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a>,
}));

type Node = Record<string, unknown>;
const heading = (id: string, settings?: Node): Node => ({ id, type: "heading", props: { text: "مرحبا Hello", level: 2 }, ...(settings ? { settings } : {}) });
const section = (id: string, settings: Node | null, elements: Node[]): Node => ({
  id,
  type: "section",
  ...(settings ? { settings } : {}),
  rows: [{ id: `${id}-r`, type: "row", columns: [{ id: `${id}-c`, type: "column", span: 12, elements }] }],
});
const tree = (sections: Node[], font?: Node) => ({ version: 1, ...(font ? { font } : {}), sections }) as unknown as PageTree;

async function draw(t: PageTree): Promise<HTMLElement> {
  const element = await PageRenderer({ tree: t, workspaceId: "w1", currency: "EGP", locale: "ar" });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(element as React.ReactElement);
  return root;
}

describe("which pick wins", () => {
  it("takes each script from the nearest level that picked one", () => {
    expect(resolveFontPair({ ar: "amiri" }, { en: "lora", ar: "reem-kufi" }, { ar: "cairo", en: "inter" })).toEqual({ ar: "amiri", en: "lora" });
    expect(resolveFontPair(null, undefined, { ar: "cairo", en: null })).toEqual({ ar: "cairo", en: null });
    expect(resolveFontPair()).toEqual({ ar: null, en: null });
  });

  it("ignores anything that is not shaped like a catalog id", () => {
    expect(resolveFontPair({ ar: 'x"}body{', en: "Comic Sans" }, { ar: "cairo" })).toEqual({ ar: "cairo", en: null });
    expect(readStoreFonts({ fonts: { primaryAr: "</style>", primaryEn: 7, header: "inter" } })).toEqual({
      primary: { ar: null, en: null },
      header: { ar: null, en: null },
      products: { ar: null, en: null },
    });
  });

  it("resolves a product's own font over the store's product font and the store's", () => {
    const ts = { fonts: { primaryAr: "cairo", primaryEn: "inter", products: { en: "lora" } } };
    expect(productFontPair(ts, { ar: "amiri" })).toEqual({ ar: "amiri", en: "lora" });
    expect(productFontPair({}, { en: "poppins" })).toEqual({ ar: null, en: "poppins" });
  });

  it("walks a page tree element → section → page → store", () => {
    const t = tree(
      [section("s1", { font: { ar: "amiri" } }, [heading("e1", { font: { en: "lora" } }), heading("e2")]), section("s2", null, [heading("e3")])],
      { en: "poppins" }
    );
    const { page, levels, pairs } = pageFontPairs(t, store);
    expect(page).toEqual({ ar: "cairo", en: "poppins" });
    expect(levels).toEqual([{ ar: "cairo", en: "poppins" }, { ar: "cairo", en: "inter" }]);
    expect(pairs).toEqual([
      { ar: "cairo", en: "poppins" },
      { ar: "amiri", en: "poppins" },
      { ar: "amiri", en: "lora" },
    ]);
  });
});

describe("the stack", () => {
  it("is the English pick, then the Arabic pick, then the store's own", () => {
    expect(fontStack({ en: "inter", ar: "cairo" }, "var(--zf-base-sans)")).toBe('"zf-en-inter", "zf-ar-cairo", var(--zf-base-sans)');
    expect(fontStack({ en: null, ar: "cairo" }, "var(--zf-base-sans)")).toBe('"zf-ar-cairo", var(--zf-base-sans)');
    expect(fontStack({ en: null, ar: null }, "var(--zf-base-sans)")).toBeNull();
  });
});

describe("the store's rules (layout)", () => {
  it("adds nothing for a store that picked no font", () => {
    expect(storeFontRules({}).css).toBe("");
    expect(storeFontRules({ fontFamily: "modern", primaryColor: "#123456" }).css).toBe("");
  });

  it("sets the store's pair on the wrapper's children, never on a store wearing a template", () => {
    const { css } = storeFontRules(store);
    expect(css).toContain('.brand-theme:not([data-xs-shell])>*{--font-sans:"zf-en-inter", "zf-ar-cairo", var(--zf-base-sans);');
    expect(css).toContain('--font-display:"zf-en-inter", "zf-ar-cairo", var(--zf-base-display);font-family:var(--font-sans)}');
  });

  it("gives the header and products their own pair, and lets a nearer pick win over the products one", () => {
    const { css, pairs } = storeFontRules({ fonts: { primaryAr: "cairo", header: { en: "bebas-neue" }, products: { ar: "amiri" } } });
    expect(css).toContain('.brand-theme [data-zf-part="header"]{--font-sans:"zf-en-bebas-neue", "zf-ar-cairo", var(--zf-base-sans)');
    expect(css).toContain('.brand-theme [data-zf-part="product"]:not([data-zf-node] *){--font-sans:"zf-ar-amiri", var(--zf-base-sans)');
    expect(pairs).toEqual([
      { ar: "cairo", en: null },
      { ar: "cairo", en: "bebas-neue" },
      { ar: "amiri", en: null },
    ]);
  });
});

describe("the faces", () => {
  const cairo: FontOption = { id: "cairo", family: "Cairo", script: "both", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800, 900], variable: [200, 1000], preview: "" };
  const lalezar: FontOption = { id: "lalezar", family: "Lalezar", script: "ar", category: "display", weights: [400], preview: "" };
  const lato: FontOption = { id: "lato", family: "Lato", script: "latin", category: "sans", weights: [100, 300, 400, 700, 900], preview: "" };

  it("asks Google for the weights a store page draws, and a picker preview for its own letters only", () => {
    expect(googleFontsCssUrl(cairo)).toBe("https://fonts.googleapis.com/css2?family=Cairo:wght@300..800&display=swap");
    expect(googleFontsCssUrl(lalezar)).toBe("https://fonts.googleapis.com/css2?family=Lalezar&display=swap");
    expect(googleFontsCssUrl(lato)).toBe("https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap");
    expect(googleFontsCssUrl(cairo, { text: "Aa ب" })).toBe("https://fonts.googleapis.com/css2?family=Cairo&text=Aa%20%D8%A8&display=swap");
    expect(googleFontsCssUrl({ ...cairo, family: "Cairo&evil=1" })).toBeNull();
  });

  const google = (subset: string, src: string, more = "") => `/* ${subset} */
@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 300 800;
  font-display: swap;
  src: url(${src}) format('woff2');
  unicode-range: U+0600-06FF, U+200C-200E;${more}
}`;
  const GSTATIC = "https://fonts.gstatic.com/s/cairo/v31/abc.woff2";

  it("keeps only the role's own letters, under the role's own name", () => {
    const css = [google("arabic", GSTATIC), google("latin-ext", GSTATIC), google("latin", GSTATIC), google("vietnamese", GSTATIC)].join("\n");
    const ar = fontFaceCss(css, "ar", "zf-ar-cairo");
    expect(ar.match(/@font-face/g)).toHaveLength(1);
    expect(ar).toBe(
      `@font-face{font-family:"zf-ar-cairo";font-style:normal;font-weight:300 800;font-display:swap;src:url(${GSTATIC}) format("woff2");unicode-range:U+0600-06FF, U+200C-200E}`
    );
    expect(fontFaceCss(css, "en", "zf-en-cairo").match(/@font-face/g)).toHaveLength(2);
  });

  it("drops a face whose file is not on fonts.gstatic.com, and never copies anything else across", () => {
    expect(fontFaceCss(google("arabic", "https://evil.example/x.woff2"), "ar", "zf-ar-cairo")).toBe("");
    expect(fontFaceCss(google("arabic", "https://fonts.gstatic.com/x.woff2);}body{color:red"), "ar", "zf-ar-cairo")).toBe("");
    const extra = fontFaceCss(google("arabic", GSTATIC, "\n  color: red; background: url(//evil);"), "ar", "zf-ar-cairo");
    expect(extra).not.toContain("evil");
    expect(extra).not.toContain("color");
    expect(fontFaceCss(google("arabic", GSTATIC), "ar", 'zf-ar-x"}')).toBe("");
  });
});

describe("a built page", () => {
  it("draws a page without fonts exactly as before", async () => {
    themeSettings = store;
    const root = await draw(tree([section("s1", null, [heading("e1")])]));
    expect(root.querySelector("[data-zf-node]")).toBeNull();
    expect(root.querySelector("[data-faces]")).toBeNull();
    expect(root.querySelector("section")!.getAttribute("style")).toBeNull();
  });

  it("puts each pick on its section and element, resolved over the store's, and asks for their faces", async () => {
    themeSettings = store;
    const root = await draw(tree([section("s1", { font: { ar: "amiri" } }, [heading("e1", { font: { en: "lora" } }), heading("e2")])]));
    const sectionEl = root.querySelector("section")!;
    expect(sectionEl.hasAttribute("data-zf-node")).toBe(true);
    expect(sectionEl.style.getPropertyValue("--font-sans")).toBe('"zf-en-inter", "zf-ar-amiri", var(--zf-base-sans)');
    expect(sectionEl.style.fontFamily).toBe("var(--font-sans)");

    const wrappers = root.querySelectorAll<HTMLElement>("div[data-zf-node]");
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].className).toBe("contents");
    expect(wrappers[0].style.getPropertyValue("--font-display")).toBe('"zf-en-lora", "zf-ar-amiri", var(--zf-base-display)');

    expect(JSON.parse(root.querySelector("[data-faces]")!.getAttribute("data-faces")!)).toEqual([
      { ar: "amiri", en: "inter" },
      { ar: "amiri", en: "lora" },
    ]);
  });

  it("keeps a styled element's own box and adds the font to it", async () => {
    themeSettings = {};
    const root = await draw(tree([section("s1", null, [heading("e1", { style: { base: { color: "#112233" } }, font: { ar: "amiri" } })])]));
    const box = root.querySelector<HTMLElement>('[data-zs="e1"]')!;
    expect(box.hasAttribute("data-zf-node")).toBe(true);
    expect(box.style.getPropertyValue("--font-sans")).toBe('"zf-ar-amiri", var(--zf-base-sans)');
  });

  it("puts the page's own font on the page", async () => {
    themeSettings = {};
    const root = await draw(tree([section("s1", null, [heading("e1")])], { en: "poppins" }));
    const pageEl = root.querySelector<HTMLElement>(".zt-sections")!;
    expect(pageEl.style.getPropertyValue("--font-sans")).toBe('"zf-en-poppins", var(--zf-base-sans)');
  });
});
