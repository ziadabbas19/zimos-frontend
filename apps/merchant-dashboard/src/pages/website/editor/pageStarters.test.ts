import { describe, expect, it } from "vitest";
import { ELEMENT_SPECS, sectionElements } from "./blocks";
import { PAGE_STARTERS, starterPageType, starterSections, type PageBuildStarter } from "./pageStarters";

const built = PAGE_STARTERS.filter((starter): starter is PageBuildStarter => starter !== "products");

describe("how a new page starts", () => {
  it("offers the six starting points", () => {
    expect([...PAGE_STARTERS]).toEqual(["blank", "products", "about", "contact", "faq", "landing"]);
  });

  it("starts a blank page with only its name, so it never blocks publishing the site", () => {
    const sections = starterSections("blank", "Notes", "en");
    expect(sections).toHaveLength(1);
    expect(sectionElements(sections[0]!)[0]?.props?.text).toBe("Notes");
  });

  it.each(built)("fills the %s page with sections the editor knows", (starter) => {
    const sections = starterSections(starter, "Our page", "en");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      for (const element of sectionElements(section)) expect(ELEMENT_SPECS[element.type]).toBeDefined();
    }
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
  });

  it.each(["blank", "about", "contact", "faq"] as const)("opens the %s page with its name as the title", (starter) => {
    const [first] = starterSections(starter, "Our page", "ar");
    const [title] = sectionElements(first!);
    expect(title?.type).toBe("heading");
    expect(title?.props?.text).toBe("Our page");
  });

  it("gives the contact page a message form", () => {
    const types = starterSections("contact", "Contact", "en").flatMap((section) => sectionElements(section).map((element) => element.type));
    expect(types).toContain("form");
  });

  it("marks information pages as static", () => {
    expect(starterPageType("about")).toBe("static");
    expect(starterPageType("landing")).toBe("custom");
  });
});
