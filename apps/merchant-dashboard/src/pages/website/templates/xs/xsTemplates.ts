import type { PageSection, PageTree } from "@store-builder/api-client";
import { xsTemplatePages } from "../../editor/xsBlocks";
import xs01Shell from "./xs01.shell.json";
import xs02Shell from "./xs02.shell.json";
import xs03Shell from "./xs03.shell.json";
import xs04Shell from "./xs04.shell.json";
import xs05Shell from "./xs05.shell.json";
import xs06Shell from "./xs06.shell.json";
import xs07Shell from "./xs07.shell.json";
import xs08Shell from "./xs08.shell.json";
import xs09Shell from "./xs09.shell.json";
import xs10Shell from "./xs10.shell.json";
import xs11Shell from "./xs11.shell.json";
import xs12Shell from "./xs12.shell.json";
import xs13Shell from "./xs13.shell.json";
import xs14Shell from "./xs14.shell.json";
import xs15Shell from "./xs15.shell.json";
import xs16Shell from "./xs16.shell.json";
import xs17Shell from "./xs17.shell.json";
import xs18Shell from "./xs18.shell.json";
import xs19Shell from "./xs19.shell.json";
import xs20Shell from "./xs20.shell.json";
import xs21Shell from "./xs21.shell.json";
import xs22Shell from "./xs22.shell.json";
import xs23Shell from "./xs23.shell.json";
import xs24Shell from "./xs24.shell.json";

/**
 * The imported templates ("xs" looks) as whole store templates for the
 * gallery: taking one gives a store the template's home page — its bands, in
 * its order (editor/xsBlocks.ts) — and its shell, the header, strip and
 * footer drawn by the storefront's components/xs with the template's own
 * menu, notice and footer columns as their starting content (the
 * `xsNN.shell.json` beside this file, which becomes the store's
 * `themeSettings` through the gallery's takeTemplateLook).
 *
 * These are the store templates: third-party designs carried over as they
 * are, pictures and wording included, and added or dropped as a set. The
 * files under ../generated are what the platform console takes, written by
 * `npm run templates:build` and held to these definitions by the test: one
 * JSON file per template, each one's version alone under ../generated/console
 * (pasted as the template's version), and INDEX.md there (xsTemplateIndex).
 *
 * A look with Arabic wording (./ar/xsNN.ar.json: every English string of its
 * pages and shell, as an Arabic merchant would write it) is offered a second
 * time, right to left: `xs-NN-ar`, "XS NN عربي". Only shown text is
 * replaced — addresses, pictures, colours and the bands' settings never are.
 */

export interface XsStoreTemplate {
  key: string;
  name: string;
  category: string;
  kind: "store";
  tags: string[];
  rtl: boolean;
  primaryColor: string;
  version: {
    globalStyles: { primaryColor: string; themeSettings: Record<string, unknown> };
    pages: Array<{ path: string; title: string; pageType: "home" | "static"; builderData: PageTree; seo: Record<string, never> }>;
    sections: [];
  };
}

/** A look's wording in Arabic: English string → Arabic, for exactly the strings its template shows. */
export interface XsArabic {
  look: string;
  strings: Record<string, string>;
}

const ARABIC: Record<string, XsArabic> = Object.fromEntries(
  Object.values(import.meta.glob<XsArabic>("./ar/xs*.ar.json", { eager: true, import: "default" })).map((arabic) => [arabic.look, arabic])
);

/** Props and settings that are never words: what they hold is a choice, an address, a picture or a product's slug. */
const NOT_WORDS = new Set(["look", "variant", "layout", "image", "images", "phoneImage", "video", "product", "also", "icon", "kind", "url", "collection", "align", "headingWeight", "imageRatio", "imageFit", "endsAt", "xsLook", "primaryColor", "primaryColorSource", "id", "type", "width", "padding"]);

/** `value` with every shown English string that `strings` knows put in Arabic. */
export function inArabic<T>(value: T, strings: Record<string, string>, key = ""): T {
  if (NOT_WORDS.has(key) || /(?:Href|href|Color|Url)$/.test(key)) return value;
  if (typeof value === "string") return (Object.hasOwn(strings, value) ? strings[value] : value) as T;
  if (Array.isArray(value)) return value.map((item) => inArabic(item, strings, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, inArabic(v, strings, k)])) as T;
  }
  return value;
}

interface XsDraft {
  look: string;
  /** Another home page of the same look (editor/xsBlocks.ts XS_ALT_HOMES); absent, the look's first. */
  home?: string;
  name: string;
  category: string;
  primaryColor: string;
  shell: Record<string, unknown>;
}

const DRAFTS: XsDraft[] = [
  { look: "01", name: "XS 01", category: "fashion", primaryColor: "#717FE0", shell: xs01Shell },
  { look: "01", home: "01b", name: "XS 01 B", category: "fashion", primaryColor: "#717FE0", shell: xs01Shell },
  { look: "01", home: "01c", name: "XS 01 C", category: "fashion", primaryColor: "#717FE0", shell: xs01Shell },
  { look: "02", name: "XS 02", category: "home_living", primaryColor: "#3B5D50", shell: xs02Shell },
  { look: "03", name: "XS 03", category: "fashion", primaryColor: "#8C907E", shell: xs03Shell },
  { look: "04", name: "XS 04", category: "fashion", primaryColor: "#CA1515", shell: xs04Shell },
  { look: "05", name: "XS 05", category: "fashion", primaryColor: "#E53637", shell: xs05Shell },
  { look: "06", name: "XS 06", category: "fashion", primaryColor: "#D19C97", shell: xs06Shell },
  { look: "07", name: "XS 07", category: "food_beverage", primaryColor: "#81C408", shell: xs07Shell },
  { look: "08", name: "XS 08", category: "fashion", primaryColor: "#FFBA00", shell: xs08Shell },
  { look: "09", name: "XS 09", category: "home_living", primaryColor: "#B08EAD", shell: xs09Shell },
  { look: "10", name: "XS 10", category: "fashion", primaryColor: "#FF003C", shell: xs10Shell },
  { look: "11", name: "XS 11", category: "fashion", primaryColor: "#EC6C5A", shell: xs11Shell },
  { look: "12", name: "XS 12", category: "electronics", primaryColor: "#72AEC8", shell: xs12Shell },
  { look: "13", name: "XS 13", category: "single_product", primaryColor: "#235EE7", shell: xs13Shell },
  { look: "14", name: "XS 14", category: "fashion", primaryColor: "#F7444E", shell: xs14Shell },
  { look: "15", name: "XS 15", category: "electronics", primaryColor: "#D10024", shell: xs15Shell },
  { look: "16", name: "XS 16", category: "fashion", primaryColor: "#FF0042", shell: xs16Shell },
  { look: "17", name: "XS 17", category: "food_beverage", primaryColor: "#FC5D35", shell: xs17Shell },
  { look: "18", name: "XS 18", category: "food_beverage", primaryColor: "#FFBE33", shell: xs18Shell },
  { look: "19", name: "XS 19", category: "food_beverage", primaryColor: "#EA272D", shell: xs19Shell },
  { look: "20", name: "XS 20", category: "food_beverage", primaryColor: "#FEA116", shell: xs20Shell },
  { look: "21", name: "XS 21", category: "food_beverage", primaryColor: "#50A06C", shell: xs21Shell },
  { look: "22", name: "XS 22", category: "general", primaryColor: "#937AFF", shell: xs22Shell },
  // Zimos's own boutique around the clothing rail.
  { look: "23", name: "Atelier", category: "fashion", primaryColor: "#1D1B18", shell: xs23Shell },
  // A mother-and-baby store, from the merchant's own Shopify theme.
  { look: "24", name: "Cradle", category: "kids_toys", primaryColor: "#E8415B", shell: xs24Shell },
];

/** A full-bleed section holding one band, with ids fixed by its place so a rebuild writes the same file. */
function bandSection(look: string, page: number, index: number, band: { type: string; props: Record<string, unknown> }): PageSection {
  const id = `xs${look}-p${page + 1}-s${index + 1}`;
  return {
    id,
    type: "section",
    settings: { width: "full", padding: "tight" },
    rows: [
      {
        id: `${id}-r1`,
        type: "row",
        columns: [{ id: `${id}-c1`, type: "column", span: 12, elements: [{ id: `${id}-e1`, type: band.type, props: band.props }] }],
      },
    ],
  } as PageSection;
}

function build(draft: XsDraft): XsStoreTemplate {
  return {
    key: `xs-${draft.home ?? draft.look}`,
    name: draft.name,
    category: draft.category,
    kind: "store",
    tags: ["xs"],
    rtl: false,
    primaryColor: draft.primaryColor,
    version: {
      globalStyles: { primaryColor: draft.primaryColor, themeSettings: draft.shell },
      pages: xsTemplatePages(draft.look, draft.home).map((page, p) => ({
        path: page.path,
        title: page.title,
        pageType: page.path === "/" ? ("home" as const) : ("static" as const),
        builderData: { version: 1, sections: page.bands.map((band, i) => bandSection(draft.home ?? draft.look, p, i, band)) },
        seo: {},
      })),
      sections: [],
    },
  };
}

/** The same template in Arabic, right to left: its pages and shell in the look's Arabic wording. */
function inArabicTemplate(template: XsStoreTemplate, arabic: XsArabic): XsStoreTemplate {
  const { version } = template;
  return {
    ...template,
    key: `${template.key}-ar`,
    name: `${template.name} عربي`,
    tags: [...template.tags, "ar"],
    rtl: true,
    version: {
      ...version,
      globalStyles: { ...version.globalStyles, themeSettings: inArabic(version.globalStyles.themeSettings, arabic.strings) },
      pages: version.pages.map((page) => ({
        ...page,
        title: inArabic(page.title, arabic.strings),
        builderData: inArabic(page.builderData, arabic.strings),
      })),
    },
  };
}

/** Every imported template, in the order the gallery lists them, each followed by its Arabic one where the look has Arabic wording. */
export function buildXsTemplates(): XsStoreTemplate[] {
  return DRAFTS.flatMap((draft) => {
    const template = build(draft);
    const arabic = ARABIC[draft.look];
    return arabic ? [template, inArabicTemplate(template, arabic)] : [template];
  });
}

/**
 * INDEX.md beside the console files: every template in the order to add them,
 * with what the platform console's "New template" form asks for and the file
 * whose whole content is pasted as its version.
 */
export function xsTemplateIndex(templates: XsStoreTemplate[]): string {
  const rows = templates.map(
    (t, i) => `| ${i + 1} | ${t.key} | ${t.name} | ${t.category} | ${t.tags.join(", ")} | ${t.rtl} | ${t.primaryColor} | ${t.key}.json |`
  );
  return [
    "# Store templates for the platform console",
    "",
    "Written by `npm run templates:build` (apps/merchant-dashboard) from",
    "src/pages/website/templates/xs/xsTemplates.ts. Do not edit by hand.",
    "",
    "In the platform console (Templates), for each row in this order: New",
    'template with the row\'s name, Kind "store", its category, its tags',
    '(comma-separated), Right-to-left ticked only where rtl is "true" (the',
    "form ticks it by default) and its primaryColor as the Swatch colour;",
    "then New version, paste the whole of the row's version file from this",
    'folder, keep "Make it the version the gallery offers" ticked, Add',
    "version, and Publish. The key only names the files.",
    "",
    "| # | key | name | category | tags | rtl | primaryColor | version file |",
    "|---|-----|------|----------|------|-----|--------------|--------------|",
    ...rows,
    "",
  ].join("\n");
}
