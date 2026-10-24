import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider } from "@/lib/StoreShellContext";
import { XS_LOGOS } from "@/lib/xsShell";

/*
 * The footer of an imported template: which logo its brand column shows (and
 * says it shows, for the editor's preview), the tile that keeps the store's
 * logo seen on a footer of the other ground than the look's bar
 * (app/xs-shell.css).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({ workspaceId: "shop" }),
  useSearchParams: () => new URLSearchParams(),
}));

import { XsFooter } from "./XsFooter";

const INFO = { workspaceId: "shop", id: "shop", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
const STORE_LOGO = "https://media.example.com/shop/logo.png";
const SHELL_CSS = readFileSync(resolve(__dirname, "../../app/xs-shell.css"), "utf8");

function show(
  look: string,
  { logoUrl = STORE_LOGO, footer = {}, removeBranding = false, dark = false }: { logoUrl?: string | null; footer?: Record<string, unknown>; removeBranding?: boolean; dark?: boolean } = {}
) {
  const store = {
    id: "shop",
    name: "Shop",
    slug: "shop",
    logoUrl,
    tagline: null,
    currency: "EGP",
    removeBranding,
    themeSettings: { xsLook: look, footer },
    navPages: [],
    headerCollections: [],
  } as unknown as StorefrontMeta;
  render(
    <StoreContextProvider locale="en" store={INFO}>
      <StoreShellProvider>
        <style>{SHELL_CSS}</style>
        <div className="brand-theme" data-xs-shell={look} data-color-mode={dark ? "dark" : undefined}>
          <XsFooter store={store} locale="en" year={2026} look={look} />
        </div>
      </StoreShellProvider>
    </StoreContextProvider>
  );
  const title = document.querySelector<HTMLElement>('[data-xs-col="brand"] .xs-footer__title')!;
  return { title, img: title.querySelector<HTMLImageElement>("img"), powered: document.querySelector('a[href="https://zimos.co"]') };
}

/** Whether the logo sits on the tile (xs-shell.css): its padding is the tile's. */
const onTile = (img: HTMLImageElement | null) => img !== null && getComputedStyle(img).paddingTop === "8px";

afterEach(cleanup);

describe("an imported template footer's logo", () => {
  it("is the store's logo once the store has one, on every look", () => {
    for (const look of ["05", "15", "01", "04"]) {
      const { title, img } = show(look);
      expect(img?.getAttribute("src")).toBe(STORE_LOGO);
      expect(img?.hasAttribute("data-xs-logo")).toBe(false);
      expect(title.getAttribute("data-logo-source")).toBe("store");
      cleanup();
    }
  });

  it("is the template's own with no store logo, and the footer's own picture before both", () => {
    const template = show("05", { logoUrl: null });
    expect(template.img?.getAttribute("src")).toBe(XS_LOGOS["05"].footer);
    expect(template.img?.getAttribute("data-xs-logo")).toBe("template");
    expect(template.title.getAttribute("data-logo-source")).toBe("template");
    cleanup();
    const own = show("05", { footer: { logo: { image: "/media/footer-logo.png" } } });
    expect(own.img?.getAttribute("src")).toBe("/media/footer-logo.png");
    expect(own.title.getAttribute("data-logo-source")).toBe("own");
  });

  it("sits on a tile of the bar's colour where the footer is on the other ground than the bar", () => {
    // Measured on the templates' colours: dark under a white bar, or white under a green or navy one.
    for (const look of ["01", "02", "05", "07", "08", "16"]) {
      expect(onTile(show(look).img), `look ${look}`).toBe(true);
      cleanup();
    }
  });

  it("sits bare where footer and bar share a ground, and on the template's or the footer's own logo", () => {
    for (const look of ["03", "04", "10", "11", "15", "18", "19", "20", "21", "22"]) {
      expect(onTile(show(look).img), `look ${look}`).toBe(false);
      cleanup();
    }
    expect(onTile(show("05", { logoUrl: null }).img)).toBe(false);
    cleanup();
    expect(onTile(show("05", { footer: { logo: { image: "/media/footer-logo.png" } } }).img)).toBe(false);
  });

  it("sits bare in dark mode, and on a footer the merchant gave its own colour", () => {
    expect(onTile(show("05", { dark: true }).img)).toBe(false);
    cleanup();
    expect(onTile(show("05", { footer: { colors: { background: "#ffffff" } } }).img)).toBe(false);
  });
});

