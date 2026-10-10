import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import type { PageElement, PageElementType, PageSection } from "@store-builder/api-client";
import { ELEMENT_SPECS, setElementProp } from "./blocks";
import { ElementField } from "./inspector/ElementFields";
import { ItemListField, type ItemSubField } from "./ItemListField";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * "—" in a list of choices means "not set". It used to be stored as "", and
 * the server refuses "" wherever it checks a value against a list (a slide's
 * place, a band's background, what a button does…), so the page then failed
 * to save. The choice now takes the value out instead.
 */

type Entry = Record<string, unknown>;
type SelectSub = Extract<ItemSubField, { kind: "select" }>;

/** Every list of choices inside an entry of a list: a slide's place, a trust card's icon, a need's icon. */
const IN_LISTS = Object.entries(ELEMENT_SPECS).flatMap(([type, spec]) =>
  spec.fields.flatMap((list) =>
    list.kind === "itemList"
      ? list.fields.filter((sub): sub is SelectSub => sub.kind === "select").map((sub) => ({ name: `${type}.${list.key}.${sub.key}`, list, sub }))
      : []
  )
);

const isNumbers = (options: Array<{ value: string }>) => options.every((option) => /^\d+$/.test(option.value));

/** Every list of words that is an element's own field: a band's background, a rail's speed, what a button does. */
const ON_ELEMENTS = Object.entries(ELEMENT_SPECS).flatMap(([type, spec]) =>
  spec.fields.flatMap((field) => (field.kind === "select" && !isNumbers(field.options) ? [{ name: `${type}.${field.key}`, type: type as PageElementType, field }] : []))
);

/** The list as the inspector holds it: what it reports is what it is given back. */
function Entries({ list, start, onChange }: { list: (typeof IN_LISTS)[number]["list"]; start: Entry[]; onChange: (next: Entry[]) => void }) {
  const [value, setValue] = useState<Entry[]>(start);
  if (list.kind !== "itemList") return null;
  return (
    <ItemListField
      label={list.label}
      value={value}
      itemLabel={list.itemLabel}
      itemLabelAr={list.itemLabelAr}
      titleKey={list.titleKey}
      fields={list.fields}
      max={list.max}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("«—» in a list of choices", () => {
  it("covers the picture slider's two places, and the other lists of the editor", () => {
    const names = IN_LISTS.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining(["hero_slider.slides.side", "hero_slider.slides.vertical", "trust_strip.items.icon", "need_picker.stages.icon"]));
    // The slider has no list of words among its own fields: its lists are all inside a slide.
    expect(ON_ELEMENTS.some((entry) => entry.type === "hero_slider")).toBe(false);
    expect(ON_ELEMENTS.map((entry) => entry.name)).toEqual(expect.arrayContaining(["product_rail.tone", "product_rail.speed", "button.action"]));
  });

  it("takes the value out of an entry instead of storing an empty one", async () => {
    for (const { name, list, sub } of IN_LISTS) {
      const onChange = vi.fn<(next: Entry[]) => void>();
      const picked = sub.options[0].value;
      const { user } = renderWithProviders(<Entries list={list} start={[{ kept: "as it is", [sub.key]: picked }]} onChange={onChange} />);
      const select = screen.getByLabelText(sub.label);
      expect([name, (select as HTMLSelectElement).value]).toEqual([name, picked]);

      await user.selectOptions(select, "—");
      const entry = onChange.mock.calls.at(-1)?.[0]?.[0] as Entry;
      expect([name, entry]).toEqual([name, { kept: "as it is" }]);
      expect([name, sub.key in entry]).toEqual([name, false]);
      // What goes to the server holds no empty value for it either.
      expect([name, JSON.stringify(entry)]).toEqual([name, '{"kept":"as it is"}']);
      // The list shows "—" again, and a value picked after it is stored as before.
      expect([name, (select as HTMLSelectElement).value]).toEqual([name, ""]);
      await user.selectOptions(select, picked);
      expect([name, onChange.mock.calls.at(-1)?.[0]?.[0]]).toEqual([name, { kept: "as it is", [sub.key]: picked }]);
      cleanup();
    }
  });

  it("takes the prop out of an element instead of storing an empty one", async () => {
    for (const { name, type, field } of ON_ELEMENTS) {
      if (field.kind !== "select") continue;
      const onChange = vi.fn<(key: string, value: unknown) => void>();
      const { user } = renderWithProviders(<ElementField elementType={type} spec={field} props={{ [field.key]: field.options[0].value }} onChange={onChange} />);
      await user.selectOptions(screen.getByRole("combobox"), "—");
      expect([name, onChange.mock.calls.at(-1)]).toEqual([name, [field.key, undefined]]);
      // A real choice is still stored as the word it is.
      await user.selectOptions(screen.getByRole("combobox"), field.options[0].value);
      expect([name, onChange.mock.calls.at(-1)]).toEqual([name, [field.key, field.options[0].value]]);
      cleanup();
    }
  });

  it("leaves no key behind in the element that is saved", () => {
    const element = { id: "e1", type: "product_rail", props: { heading: "New in", tone: "cool", speed: "fast" } } as unknown as PageElement;
    const section = {
      id: "s1",
      type: "section",
      rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [element] }] }],
    } as unknown as PageSection;

    const next = setElementProp(section, element, "tone", undefined);
    const props = next.rows?.[0]?.columns?.[0]?.elements?.[0]?.props as Record<string, unknown>;
    expect(props).toEqual({ heading: "New in", speed: "fast" });
    expect("tone" in props).toBe(false);
    // The element it was made from is not changed.
    expect(element.props).toEqual({ heading: "New in", tone: "cool", speed: "fast" });
    // A value, an empty text included, is stored as it always was.
    const typed = setElementProp(section, element, "heading", "");
    expect(typed.rows?.[0]?.columns?.[0]?.elements?.[0]?.props).toEqual({ heading: "", tone: "cool", speed: "fast" });
  });

  it("leaves a list of numbers as it was: a heading's level", async () => {
    const level = ELEMENT_SPECS.heading.fields.find((field) => field.key === "level");
    if (level?.kind !== "select") throw new Error("the heading has no level list");
    expect(isNumbers(level.options)).toBe(true);
    const onChange = vi.fn<(key: string, value: unknown) => void>();
    const { user } = renderWithProviders(<ElementField elementType="heading" spec={level} props={{ level: 3 }} onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "H2");
    expect(onChange).toHaveBeenLastCalledWith("level", 2);
    await user.selectOptions(screen.getByRole("combobox"), "—");
    expect(onChange).toHaveBeenLastCalledWith("level", 0);
  });
});
