import { describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import type { PageElement, PageElementType, PageSection } from "@store-builder/api-client";
import { ELEMENT_SPECS, setElementProp } from "./blocks";
import { ElementField } from "./inspector/ElementFields";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * An emptied number field means "not set". It used to be stored as "", and
 * the server refuses "" wherever it checks a number against a range (seconds
 * per slide, a slider's height, how many products a band shows…), so the page
 * then failed to save. Emptying the field now takes the prop out instead.
 */

/** Every number that is an element's own field. */
const NUMBERS = Object.entries(ELEMENT_SPECS).flatMap(([type, spec]) =>
  spec.fields.flatMap((field) => (field.kind === "number" ? [{ name: `${type}.${field.key}`, type: type as PageElementType, field }] : []))
);

function sectionWith(element: PageElement): PageSection {
  return {
    id: "s1",
    type: "section",
    rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [element] }] }],
  } as unknown as PageSection;
}

const propsOf = (section: PageSection) => section.rows?.[0]?.columns?.[0]?.elements?.[0]?.props as Record<string, unknown>;

describe("an emptied number field", () => {
  it("covers the picture slider's four numbers, and the other numbers of the editor", () => {
    const names = NUMBERS.map((entry) => entry.name);
    expect(names).toEqual(
      expect.arrayContaining(["hero_slider.seconds", "hero_slider.startDelay", "hero_slider.height", "hero_slider.heightTablet", "product_rail.limit", "image_banner.height"])
    );
    expect(names.length).toBeGreaterThan(20);
  });

  it("takes the prop out of the element instead of storing an empty value", async () => {
    for (const { name, type, field } of NUMBERS) {
      if (field.kind !== "number") continue;
      const start = field.min ?? 5;
      const onChange = vi.fn<(key: string, value: unknown) => void>();
      const { user } = renderWithProviders(<ElementField elementType={type} spec={field} props={{ [field.key]: start }} onChange={onChange} />);
      const input = screen.getByRole("spinbutton");
      expect([name, (input as HTMLInputElement).value]).toEqual([name, String(start)]);

      await user.clear(input);
      expect([name, onChange.mock.calls.at(-1)]).toEqual([name, [field.key, undefined]]);
      cleanup();
    }
  });

  it("still stores a typed number as a number", async () => {
    const seconds = ELEMENT_SPECS.hero_slider.fields.find((field) => field.key === "seconds");
    if (seconds?.kind !== "number") throw new Error("the picture slider has no seconds field");
    const onChange = vi.fn<(key: string, value: unknown) => void>();
    const { user } = renderWithProviders(<ElementField elementType="hero_slider" spec={seconds} props={{}} onChange={onChange} />);
    await user.type(screen.getByRole("spinbutton"), "12");
    expect(onChange).toHaveBeenLastCalledWith("seconds", 12);
  });

  it("leaves no key behind in the slider that is saved", async () => {
    const element = { id: "e1", type: "hero_slider", props: { slides: [{ image: "https://cdn.zimos.test/a.jpg" }], seconds: 5, height: 620, autoplay: true } } as unknown as PageElement;
    let section = sectionWith(element);

    // Through the field itself and the one place a field's change is written (SectionInspector → setElementProp).
    for (const key of ["seconds", "height"]) {
      const field = ELEMENT_SPECS.hero_slider.fields.find((entry) => entry.key === key);
      if (field?.kind !== "number") throw new Error(`the picture slider has no ${key} field`);
      const current = section.rows?.[0]?.columns?.[0]?.elements?.[0] as PageElement;
      const { user } = renderWithProviders(
        <ElementField elementType="hero_slider" spec={field} props={propsOf(section)} onChange={(k, value) => (section = setElementProp(section, current, k, value))} />
      );
      await user.clear(screen.getByRole("spinbutton"));
      cleanup();
    }

    expect(propsOf(section)).toEqual({ slides: [{ image: "https://cdn.zimos.test/a.jpg" }], autoplay: true });
    // What goes to the server: neither number, and no empty value in their place.
    expect(JSON.stringify(propsOf(section))).toBe('{"slides":[{"image":"https://cdn.zimos.test/a.jpg"}],"autoplay":true}');
  });

  it("keeps a picture's two ways of sizing apart, as before", () => {
    const image = { id: "e1", type: "image", props: { src: "/a.png", width: 60 } } as unknown as PageElement;
    const cleared = setElementProp(sectionWith(image), image, "width", undefined);
    expect(propsOf(cleared)).toEqual({ src: "/a.png" });
    // Emptying the width never removes a named size.
    const sized = { id: "e1", type: "image", props: { src: "/a.png", size: "small" } } as unknown as PageElement;
    expect(propsOf(setElementProp(sectionWith(sized), sized, "width", undefined))).toEqual({ src: "/a.png", size: "small" });
  });
});
