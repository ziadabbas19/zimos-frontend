import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreShowcase } from "@/components/store-showcase";
import { getDictionary } from "@/i18n/dictionaries";
import CreditsPage from "./page";

/**
 * The store designs' credits live on the credits page, in both languages,
 * with every name and link the gallery used to carry; the gallery itself no
 * longer writes them, and the footer links to the page. ZIMOS's own design
 * (look 23) is in the gallery and asks for no credit.
 */

// The header and footer read the router and the console's settings; neither plays a part here.
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

const DESIGNS = [
  ["13", "Watch"],
  ["08", "Karma"],
  ["04", "Ashion"],
  ["10", "Estore"],
];

afterEach(cleanup);

describe("the credits page", () => {
  it.each(["ar", "en"] as const)("credits every store design in %s", async (locale) => {
    render(await CreditsPage({ params: Promise.resolve({ locale }) }));
    const dict = getDictionary(locale);

    expect(screen.getByRole("heading", { level: 1, name: dict.credits.title })).toBeTruthy();
    for (const [n, name] of DESIGNS) {
      expect(screen.getByText(new RegExp(`${dict.templates.templateLabel.replace("{n}", n)}:`))).toBeTruthy();
      expect(screen.getByText(new RegExp(`${name} by`))).toBeTruthy();
    }
    const authors = screen.getAllByRole("link", { name: "Colorlib" });
    expect(authors.map((a) => a.getAttribute("href"))).toEqual(Array(4).fill("https://colorlib.com"));
    const licences = screen.getAllByRole("link", { name: "CC BY 3.0" });
    expect(licences.map((a) => a.getAttribute("href"))).toEqual(Array(4).fill("https://creativecommons.org/licenses/by/3.0/"));
    // ZIMOS's own design is not an imported one: no line for it.
    expect(screen.queryByText(new RegExp(`${dict.templates.templateLabel.replace("{n}", "23")}:`))).toBeNull();
  });

  it.each(["ar", "en"] as const)("is linked from the footer, and the gallery carries no credit, in %s", (locale) => {
    const dict = getDictionary(locale);
    expect(dict.footer.links.map((l) => l.href)).toContain("/credits");

    render(<StoreShowcase copy={dict.templates} locale={locale} />);
    expect(screen.queryByRole("link", { name: "Colorlib" })).toBeNull();
    expect(screen.queryByText(/CC BY/)).toBeNull();
    for (const [, name] of DESIGNS) expect(screen.queryByText(new RegExp(`${name} by`))).toBeNull();
    expect(screen.getByText(dict.templates.caption)).toBeTruthy();
    expect(screen.getAllByText(dict.templates.ownBadge).length).toBeGreaterThan(0);
  });
});
