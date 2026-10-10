import { describe, expect, it } from "vitest";
import { lookToWorkspacePatch, readStoreLook, sameLook } from "./storeLook";
import {
  DEFAULT_FOOTER_LOOK,
  DEFAULT_HEADER_LOOK,
  readFooterLook,
  readHeaderLook,
  sameFooter,
  sameHeader,
  submenuCount,
  writeFooter,
  writeHeader,
} from "./storeShell";

/**
 * The header and footer panels edit a link's label, target and kind, a group's
 * title and links, the logo's size and alignment, and a handful of switches.
 * Whatever else a store's saved header or footer carries (a template's
 * dropdown under a menu link is the one that matters: the storefront's
 * NavDropdown draws `menu[i].children`) has to come back out of a save exactly
 * as it went in.
 */

const ANNOUNCEMENT = { enabled: false };

const children = [
  { label: "Dresses", href: "/products?collection=dresses" },
  { label: "Shoes", href: "/products?collection=shoes", badge: "new" },
];

/** A header as a template writes it: a dropdown on the second link, no `kind` anywhere. */
const templateHeader = () => ({
  announcement: { enabled: true, messages: ["Free delivery"] },
  menu: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/products", children },
    { label: "About", href: "/about", icon: "info", children: [] },
  ],
  megaMenu: { columns: 3 },
});

describe("a menu link's dropdown survives the header panel", () => {
  it("is read beside the link, never as a field", () => {
    const look = readHeaderLook(templateHeader());
    expect(look.menu).toHaveLength(3);
    expect(look.menu![0].extra).toBeUndefined();
    expect(look.menu![1].extra).toEqual({ children });
    expect(submenuCount(look.menu![0])).toBe(0);
    expect(submenuCount(look.menu![1])).toBe(2);
    expect(submenuCount(look.menu![2])).toBe(0);
  });

  it("is written back untouched by a save that changed nothing", () => {
    const saved = templateHeader();
    const out = writeHeader(saved, readHeaderLook(saved), ANNOUNCEMENT);
    const menu = out.menu as Array<Record<string, unknown>>;
    expect(menu[1].children).toEqual(children);
    expect(menu[2].children).toEqual([]);
    expect(menu[2].icon).toBe("info");
    expect(menu[0]).toEqual({ label: "Home", href: "/", kind: "home" });
  });

  it("stays with its link when the label, the target, the order or another setting changes", () => {
    const saved = templateHeader();
    const look = readHeaderLook(saved);
    const [home, shop, about] = look.menu!;
    const edited = {
      ...look,
      sticky: false,
      logoSize: "lg" as const,
      menu: [{ ...shop, label: "  All products ", kind: "url" as const, href: "https://example.com/all" }, about, home],
    };
    const menu = writeHeader(saved, edited, ANNOUNCEMENT).menu as Array<Record<string, unknown>>;
    expect(menu[0]).toEqual({ children, label: "All products", href: "https://example.com/all", kind: "url" });
    expect(menu[1]).toEqual({ icon: "info", children: [], label: "About", href: "/about", kind: "page" });
    expect(menu[2]).toEqual({ label: "Home", href: "/", kind: "home" });
  });

  it("goes only when the merchant removes the link itself, or goes back to the built-in menu", () => {
    const saved = templateHeader();
    const look = readHeaderLook(saved);
    const without = writeHeader(saved, { ...look, menu: look.menu!.filter((_, i) => i !== 1) }, ANNOUNCEMENT);
    expect(JSON.stringify(without.menu)).not.toContain("Dresses");
    expect(writeHeader(saved, { ...look, menu: null }, ANNOUNCEMENT)).not.toHaveProperty("menu");
  });

  it("never lets a kept key replace what the panel edits", () => {
    const saved = { menu: [{ label: "Old", href: "/old", kind: "page", id: "x1", children }] };
    const look = readHeaderLook(saved);
    const menu = writeHeader(saved, { ...look, menu: [{ ...look.menu![0], label: "New", href: "/new" }] }, ANNOUNCEMENT)
      .menu as Array<Record<string, unknown>>;
    expect(menu[0]).toEqual({ id: "x1", children, label: "New", href: "/new", kind: "page" });
  });

  it("keeps the header's other keys, and the keys inside logo and show the panel has no field for", () => {
    const saved = {
      ...templateHeader(),
      logo: { size: "lg", align: "center", shape: "round" },
      show: { cart: false, search: false, wishlist: true },
    };
    const look = readHeaderLook(saved);
    const out = writeHeader(saved, { ...look, logoSize: "md", logoAlign: "start", showCart: true, showTheme: false }, ANNOUNCEMENT);
    expect(out.megaMenu).toEqual({ columns: 3 });
    expect(out.logo).toEqual({ shape: "round" });
    expect(out.show).toEqual({ search: false, wishlist: true, theme: false });
    expect(out.announcement).toBe(ANNOUNCEMENT);
  });
});

describe("a footer group's other keys survive the footer panel", () => {
  const savedFooter = () => ({
    groups: [
      { title: "Shop", icon: "bag", links: [{ label: "All", href: "/products", children }] },
      { title: "Help", links: [{ label: "", href: "/track" }] },
    ],
    text: "Since 2020",
    show: { help: false, newsletter: false },
    social: { instagram: "store" },
  });

  it("round-trips a group's keys and its links' keys", () => {
    const saved = savedFooter();
    const look = readFooterLook(saved);
    expect(look.groups![0].extra).toEqual({ icon: "bag" });
    expect(look.groups![1].extra).toBeUndefined();
    const out = writeFooter(saved, { ...look, groups: [{ ...look.groups![0], title: " Store " }, look.groups![1]] })!;
    expect(out.groups).toEqual([
      { icon: "bag", title: "Store", links: [{ children, label: "All", href: "/products", kind: "page" }] },
      { title: "Help", links: [{ label: "", href: "/track", kind: "track" }] },
    ]);
    expect(out.social).toEqual({ instagram: "store" });
    expect(out.show).toEqual({ newsletter: false, help: false });
    expect(out.text).toBe("Since 2020");
  });

  it("keeps a switch the panel does not have when every switch it has is on", () => {
    const saved = savedFooter();
    const out = writeFooter(saved, { ...readFooterLook(saved), showHelp: true })!;
    expect(out.show).toEqual({ newsletter: false });
  });
});

describe("a store with nothing extra saves the blob it always saved", () => {
  it("writes a link as label, href and kind and nothing else", () => {
    const saved = { menu: [{ label: "Home", href: "/", kind: "home" }, { label: "Blog", href: "/blog", kind: "page" }] };
    const out = writeHeader(saved, readHeaderLook(saved), ANNOUNCEMENT);
    expect(out).toEqual({ announcement: ANNOUNCEMENT, menu: saved.menu });
  });

  it("writes no logo, show, menu or footer for a header and footer left at their defaults", () => {
    expect(writeHeader(undefined, DEFAULT_HEADER_LOOK, ANNOUNCEMENT)).toEqual({ announcement: ANNOUNCEMENT });
    expect(writeFooter(undefined, DEFAULT_FOOTER_LOOK)).toBeUndefined();
    expect(writeHeader({ show: { cart: false } }, { ...DEFAULT_HEADER_LOOK, showCart: false }, ANNOUNCEMENT).show).toEqual({
      cart: false,
    });
    expect(writeHeader({ show: { cart: false } }, DEFAULT_HEADER_LOOK, ANNOUNCEMENT)).not.toHaveProperty("show");
  });
});

describe("unsaved-changes checks see the kept keys", () => {
  it("treats two reads of one header as the same, and a changed dropdown as a change", () => {
    const a = readHeaderLook(templateHeader());
    const b = readHeaderLook(templateHeader());
    expect(sameHeader(a, b)).toBe(true);
    const other = templateHeader();
    (other.menu[1] as Record<string, unknown>).children = [children[0]];
    expect(sameHeader(a, readHeaderLook(other))).toBe(false);
  });

  it("does the same for a footer group", () => {
    const footer = { groups: [{ title: "Shop", icon: "bag", links: [] }] };
    expect(sameFooter(readFooterLook(footer), readFooterLook(footer))).toBe(true);
    expect(sameFooter(readFooterLook(footer), readFooterLook({ groups: [{ title: "Shop", icon: "box", links: [] }] }))).toBe(
      false
    );
  });
});

describe("the Store look's save, end to end", () => {
  it("sends the dropdown back in themeSettings when only a colour changed", () => {
    const themeSettings = { primaryColor: "#112233", header: templateHeader(), customKey: 1 };
    const look = readStoreLook({ themeSettings, logoUrl: null });
    const patch = lookToWorkspacePatch(themeSettings, { ...look, primaryColor: "#445566" });
    const header = patch.themeSettings.header as { menu: Array<Record<string, unknown>>; megaMenu: unknown };
    expect(header.menu[1].children).toEqual(children);
    expect(header.megaMenu).toEqual({ columns: 3 });
    expect(patch.themeSettings.customKey).toBe(1);
    expect(sameLook(look, readStoreLook({ themeSettings: patch.themeSettings, logoUrl: null }))).toBe(false);
    expect(sameHeader(look.header, readStoreLook({ themeSettings: patch.themeSettings, logoUrl: null }).header)).toBe(true);
  });
});
