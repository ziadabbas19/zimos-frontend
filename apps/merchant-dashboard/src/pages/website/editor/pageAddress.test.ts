import { describe, expect, it } from "vitest";
import type { WebsitePage } from "@store-builder/api-client";
import { addressProblem, copyPath, orderPages, pathOfSlug, slugFromName, slugOfPath } from "./pageAddress";

describe("a page's address", () => {
  it.each([
    ["Our Story", "our-story"],
    ["  Summer   Sale 2026! ", "summer-sale-2026"],
    ["Café & Crème", "cafe-creme"],
    ["من نحن", "mn-nhn"],
    ["عروض ٢٠٢٦", "arwd-2026"],
    ["!!!", ""],
  ])("is written from the name %s", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });

  it("is always something the store can use when written from a name", () => {
    for (const name of ["Our Story", "من نحن", "Sale -- now", "a".repeat(300)]) {
      expect(addressProblem(slugFromName(name), [])).toBeNull();
    }
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["Our-Story", "format"],
    ["our story", "format"],
    ["our_story", "format"],
    ["-story", "format"],
    ["story-", "format"],
    ["story--time", "format"],
    ["صفحة", "format"],
    ["a/../b", "format"],
  ])("refuses %j as %s", (slug, problem) => {
    expect(addressProblem(slug, [])).toBe(problem);
  });

  it.each(["cart", "checkout", "account", "search", "products", "orders", "blog", "login", "products/sale"])("keeps /%s for the store itself", (slug) => {
    expect(addressProblem(slug, [])).toBe("reserved");
  });

  it("allows words that only start like a reserved one", () => {
    for (const slug of ["cart-guide", "my-orders", "about/cart", "searching"]) expect(addressProblem(slug, [])).toBeNull();
  });

  it("refuses an address another page has, and lets a page keep its own", () => {
    expect(addressProblem("about", ["/about"])).toBe("taken");
    expect(addressProblem("about", ["/about"], "/about")).toBeNull();
    // An older address the rules would refuse today can stay while the page is edited.
    expect(addressProblem("track", [], "/track")).toBeNull();
  });

  it("goes between the box and the stored path", () => {
    expect(pathOfSlug("/about")).toBe("/about");
    expect(pathOfSlug("about")).toBe("/about");
    expect(slugOfPath("/about/team")).toBe("about/team");
  });

  it("finds a free address for a copy", () => {
    expect(copyPath("/about", ["/about"])).toBe("/about-copy");
    expect(copyPath("/about", ["/about", "/about-copy", "/about-copy-2"])).toBe("/about-copy-3");
    expect(copyPath("/", ["/"])).toBe("/home-copy");
  });
});

describe("the order of the pages", () => {
  const page = (path: string, menuOrder?: number | null, pageType: WebsitePage["pageType"] = "custom") => ({ id: path, path, menuOrder, pageType }) as WebsitePage;

  it("puts home first, then the merchant's order, then the rest by address", () => {
    const ordered = orderPages([page("/zebra"), page("/faq", 1), page("/about"), page("/contact", 0), page("/", null, "home")]);
    expect(ordered.map((p) => p.path)).toEqual(["/", "/contact", "/faq", "/about", "/zebra"]);
  });
});
