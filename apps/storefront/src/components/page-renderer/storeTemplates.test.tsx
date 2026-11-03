import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { renderToPipeableStream } from "react-dom/server.node";
import type { PageElement, PageTree, StorefrontProduct } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { XS_CREDITS } from "@/lib/xsShell";
import { PageRenderer } from "./PageRenderer";

/**
 * The store templates (the merchant dashboard's pages/website/templates/xs,
 * one generated JSON file each under templates/generated), drawn by the real
 * page renderer the way a shopper's page is, in the template's own language:
 * every section and every element draws something, every picture the home
 * page names is on it, every picture comes from the store itself, every link
 * a template writes leads to one of its own pages or the catalogue, and the
 * only link out of the store is the design's attribution its licence asks for.
 *
 * The catalogue is a stand-in (eight products, three collections): a template
 * brings no products, and its product sections draw the store's own.
 */

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "",
}));
vi.mock("@/lib/storeMeta", () => ({ getStoreMeta: async () => null }));
const cartStub = vi.hoisted(() => ({ addItem: async () => undefined, openDrawer: () => undefined, itemCount: 0 }));
vi.mock("@/lib/CartProvider", () => ({ useCart: () => cartStub, useOptionalCart: () => cartStub }));

const catalogue = vi.hoisted(() => ({ products: [] as unknown[] }));
vi.mock("@/lib/serverApiClient", () => ({
  createServerStorefrontApiClient: async () => ({
    listStorefrontProducts: async (_ws: string, query: { limit?: number } = {}) => ({ products: catalogue.products.slice(0, query.limit ?? 8), nextCursor: null }),
    searchStorefrontProducts: async (_ws: string, query: { limit?: number } = {}) => ({ products: catalogue.products.slice(0, query.limit ?? 8), nextCursor: null }),
    getStorefrontProduct: async () => catalogue.products[0],
    listStorefrontCollections: async () => [
      { id: "c1", name: "قسم ١", slug: "one", description: null, seo: null },
      { id: "c2", name: "قسم ٢", slug: "two", description: null, seo: null },
      { id: "c3", name: "قسم ٣", slug: "three", description: null, seo: null },
    ],
  }),
}));

const PRODUCTS: StorefrontProduct[] = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `منتج ${i + 1}`,
  slug: `product-${i + 1}`,
  description: null,
  productType: "physical",
  media: [{ url: `https://cdn.zimos.test/product-${i + 1}.jpg`, mimeType: "image/jpeg" }],
  tags: [],
  seo: null,
  variants: [{ id: `v${i + 1}`, sku: `S${i + 1}`, optionValues: {}, priceAmount: "25000", compareAtAmount: i === 0 ? "30000" : null, currency: "EGP", inStock: true } as unknown as StorefrontProduct["variants"][number]],
  offers: [],
  customFields: [],
  hasOptionGroups: false,
}));

const STORE: StoreInfo = {
  workspaceId: "w1",
  id: "w1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};


interface Template {
  key: string;
  name: string;
  rtl: boolean;
  version: { globalStyles: Record<string, unknown>; pages: Array<{ path: string; title: string; pageType: string; builderData: PageTree }> };
}

const GENERATED = resolve(__dirname, "../../../../merchant-dashboard/src/pages/website/templates/generated");
const PUBLIC = resolve(__dirname, "../../../public");
const templates: Template[] = readdirSync(GENERATED)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(readFileSync(resolve(GENERATED, name), "utf8")) as Template);
const pages = templates.flatMap((template) => template.version.pages.map((page) => [`${template.key} ${page.path}`, template, page] as const));
const byKey = templates.map((t) => [t.key, t] as const);
/** A template is drawn in its own language: an Arabic store wears the Arabic one. */
const localeOf = (template: Template) => (template.rtl ? "ar" : "en");

const CATALOGUES = resolve(__dirname, "../../../../merchant-dashboard/src/pages/website/templates/xs/products");
/** The groups a template makes in the store whether or not its products come too (its catalogue's `linkedGroups`). */
function groupsOf(template: Template): string[] {
  const file = resolve(CATALOGUES, `xs${template.key.replace(/^xs-/, "").slice(0, 2)}.products.json`);
  if (!existsSync(file)) return [];
  const catalogue = JSON.parse(readFileSync(file, "utf8")) as { linkedGroups?: boolean; collections: Array<{ slug: string }> };
  return catalogue.linkedGroups ? catalogue.collections.map((c) => c.slug) : [];
}

/** The whole page as the server sends it: the catalogue sections wait for their products before the markup is taken. */
async function draw(tree: PageTree, locale: "ar" | "en", editable = false): Promise<HTMLElement> {
  const rendered = await PageRenderer({ tree, workspaceId: "w1", currency: "EGP", locale, editable });
  const html = await new Promise<string>((done, fail) => {
    let out = "";
    const sink = new Writable({
      write(chunk, _encoding, next) {
        out += chunk.toString();
        next();
      },
      final(next) {
        done(out);
        next();
      },
    });
    const stream = renderToPipeableStream(
      <StoreContextProvider locale={locale} store={STORE}>
        {rendered as React.ReactElement}
      </StoreContextProvider>,
      { onAllReady: () => stream.pipe(sink), onError: fail }
    );
  });
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

const elementsOf = (tree: PageTree): PageElement[] => tree.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));

/** A band a shopper is not shown until the merchant fills it in: a video band with no video yet (the editor shows a note there). */
function waitsForMerchant(section: PageTree["sections"][number]): boolean {
  const elements = section.rows.flatMap((r) => r.columns.flatMap((c) => c.elements));
  return elements.length > 0 && elements.every((e) => e.type === "xs_video" && !(e.props as { url?: unknown } | undefined)?.url);
}

/** The pictures a value names, by their address on the store. */
const PICTURE = /\/xs\/[A-Za-z0-9/_.-]+\.(?:jpe?g|png|webp|gif|svg)/g;

/** A picture the store serves itself (public/), or one of the stand-in catalogue's products. */
const fromStore = (src: string) => src.startsWith("https://cdn.zimos.test/product-") || (src.startsWith("/") && existsSync(resolve(PUBLIC, decodeURI(src.split("?")[0]).slice(1))));

describe("the store templates on the storefront", () => {
  it("are the generated files: 52, each English one with its Arabic twin, right to left", () => {
    expect(templates).toHaveLength(52);
    const english = templates.filter((t) => !t.rtl);
    expect(english).toHaveLength(26);
    for (const template of english) expect(templates.find((t) => t.key === `${template.key}-ar`)?.rtl, template.key).toBe(true);
  });

  it.each(pages)("%s: every section and every element draws something", async (_name, template, page) => {
    catalogue.products = PRODUCTS;
    const tree = page.builderData;

    // As a shopper gets it: one drawn section per section of the tree.
    const shopper = await draw(tree, localeOf(template));
    const sections = Array.from(shopper.querySelectorAll<HTMLElement>("[data-zt-section]"));
    expect(sections).toHaveLength(tree.sections.length);
    sections.forEach((section, i) => {
      if (waitsForMerchant(tree.sections[i])) return;
      expect(section.textContent!.trim().length + section.querySelectorAll("img, svg, iframe, video").length, tree.sections[i].id).toBeGreaterThan(0);
    });
    // No "nothing here yet" placeholder anywhere: the catalogue is there and every block is filled.
    expect(shopper.querySelector(".border-dashed")).toBeNull();

    // In the editor's preview each element carries its id: none of them is empty.
    const canvas = await draw(tree, localeOf(template), true);
    for (const element of elementsOf(tree)) {
      const marker = canvas.querySelector<HTMLElement>(`[data-zimos-el="${element.id}"]`);
      expect(marker, element.id).not.toBeNull();
      expect(marker!.innerHTML.trim().length, `${element.id} (${element.type})`).toBeGreaterThan(0);
    }
  });

  it.each(pages)("%s: every picture comes from the store itself, and every link stays in it", async (_name, template, page) => {
    catalogue.products = PRODUCTS;
    const root = await draw(page.builderData, localeOf(template));
    for (const img of Array.from(root.querySelectorAll<HTMLImageElement>("img"))) {
      const src = img.getAttribute("src") ?? "";
      expect(fromStore(src), src).toBe(true);
    }
    for (const source of Array.from(root.querySelectorAll("source[srcset]"))) {
      for (const candidate of (source.getAttribute("srcset") ?? "").split(",")) {
        const src = candidate.trim().split(/\s+/)[0];
        expect(fromStore(src), src).toBe(true);
      }
    }
    // The design's attribution, which its licence asks for (page-renderer/xs XsCredit), is on every page
    // and names its author's site; every other link stays in the store. A look Zimos designed itself
    // (lib/xsShell XS_CREDITS null) owes no one a line, so it has none.
    const look = String((template.version.globalStyles.themeSettings as { xsLook?: unknown } | undefined)?.xsLook ?? "");
    if (XS_CREDITS[look]) expect(root.querySelector(".xs-credit"), "attribution").not.toBeNull();
    else expect(root.querySelector(".xs-credit"), "no attribution on Zimos's own look").toBeNull();
    for (const link of Array.from(root.querySelectorAll("a"))) {
      const href = link.getAttribute("href") ?? "";
      if (link.closest(".xs-credit")) expect(href, link.textContent ?? "").toMatch(/^https:\/\//);
      else expect(href, link.textContent ?? "").toMatch(/^\//);
    }
  });

  it.each(byKey)("%s: every link it writes leads to one of its own pages or the catalogue", (_key, template) => {
    // A template whose catalogue's groups are made with it (`linkedGroups`) may also link to those groups.
    const groups = groupsOf(template).map((slug) => `/products?collection=${slug}`);
    const paths = new Set([...template.version.pages.map((p) => p.path), "/products", ...groups]);
    const links: string[] = [];
    const walk = (value: unknown, key = ""): void => {
      if (typeof value === "string") {
        if (/(?:href|link)$/i.test(key) && value !== "") links.push(value);
      } else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
      else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
    };
    walk(template.version.pages);
    for (const href of links) expect(paths.has(href), href).toBe(true);
  });

  it.each(byKey)("%s: the home page shows every picture the template names", async (_key, template) => {
    catalogue.products = PRODUCTS;
    const home = template.version.pages[0].builderData;
    const root = await draw(home, localeOf(template));
    const html = root.innerHTML;
    const named = [...new Set(JSON.stringify(home).match(PICTURE) ?? [])];
    expect(named.length).toBeGreaterThan(0);
    for (const url of named) expect(html.includes(url), url).toBe(true);
  });

  it.each(byKey)("%s: a store with no products yet reads as not ready, not as broken", async (_key, template) => {
    catalogue.products = [];
    const home = template.version.pages[0].builderData;
    const root = await draw(home, localeOf(template));
    // Every section is still there, and no product of another store shows.
    expect(root.querySelectorAll("[data-zt-section]")).toHaveLength(home.sections.length);
    for (const product of PRODUCTS) expect(root.textContent).not.toContain(product.name);
  });

  it("words a shopper reads on an Arabic template are Arabic on every page", async () => {
    catalogue.products = PRODUCTS;
    for (const [, template, page] of pages.filter(([, t]) => t.rtl)) {
      const root = await draw(page.builderData, "ar");
      for (const heading of Array.from(root.querySelectorAll("h1, h2"))) {
        const text = (heading.textContent ?? "").trim();
        if (text) expect(text, `${template.key} ${page.path}`).toMatch(/\p{Script=Arabic}/u);
      }
    }
  });
});
