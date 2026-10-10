import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { EditorLocaleContext } from "./editorLocale";
import { ItemListField, type ItemSubField } from "./ItemListField";
import { SHOWCASE_ELEMENT_SPECS } from "./showcaseBlocks";
import { renderWithProviders } from "@/test/renderWithProviders";

type Slide = Record<string, unknown>;

/** The fields of one slide of the picture slider, as the inspector is given them. */
function slideFields(): ItemSubField[] {
  const slides = SHOWCASE_ELEMENT_SPECS.hero_slider.fields.find((field) => field.key === "slides");
  if (!slides || slides.kind !== "itemList") throw new Error("the picture slider has no slides field");
  return slides.fields;
}

/** The list as the inspector holds it: what it reports is what it is given back. */
function Slides({ start, onChange }: { start: Slide[]; onChange: (next: Slide[]) => void }) {
  const [value, setValue] = useState<Slide[]>(start);
  return (
    <ItemListField
      label="Slides"
      value={value}
      itemLabel="Slide"
      itemLabelAr="شريحة"
      titleKey="alt"
      fields={slideFields()}
      max={8}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const PICTURE = "https://cdn.zimos.test/hero.jpg";

function open(start: Slide = { image: PICTURE }) {
  const onChange = vi.fn<(next: Slide[]) => void>();
  const view = renderWithProviders(<Slides start={[start]} onChange={onChange} />);
  const last = () => onChange.mock.calls.at(-1)?.[0]?.[0] as Slide;
  return { ...view, onChange, last };
}

describe("a slide of the picture slider", () => {
  it("offers the three things the store already draws: the small line, the text colour and the text width", () => {
    const keys = slideFields().map((field) => field.key);
    expect(keys).toEqual(expect.arrayContaining(["eyebrow", "text", "contentWidth"]));
    // The small line is written where it is read: above the heading.
    expect(keys.indexOf("eyebrow")).toBe(keys.indexOf("heading") - 1);

    open();
    expect(screen.getByLabelText("Small line above the heading")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Text colour" })).toBeInTheDocument();
    expect(screen.getByLabelText("Text width (px)")).toBeInTheDocument();
  });

  it("offers nothing of the hero media while its switch is off", () => {
    const keys = slideFields().map((field) => field.key);
    for (const key of ["sideMobile", "verticalMobile", "overlay", "overlayMobile", "video"]) expect(keys).not.toContain(key);
    open();
    expect(screen.queryByLabelText("Text sits at, on a phone")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Veil over the picture (%)")).not.toBeInTheDocument();
  });

  it("keeps every value inside what the server accepts", () => {
    const fields = slideFields();
    const colour = fields.find((field) => field.key === "text");
    const width = fields.find((field) => field.key === "contentWidth");
    if (colour?.kind !== "choice" || width?.kind !== "number") throw new Error("unexpected field kinds");
    // showcaseElements.js: text is "dark" or "light", contentWidth a whole number from 200 to 900.
    expect(colour.options.map((option) => option.value).sort()).toEqual(["dark", "light"]);
    expect(colour.fallback).toBe("dark");
    expect(width.min).toBeGreaterThanOrEqual(200);
    expect(width.max).toBeLessThanOrEqual(900);
  });

  it("shows dark text while nothing is stored, and stores the colour that is picked", async () => {
    const { user, onChange, last } = open();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(last()).toEqual({ image: PICTURE, text: "light" });
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(last()).toEqual({ image: PICTURE, text: "dark" });
  });

  it("stores the width as a whole number inside the range, and nothing while it is out of it", async () => {
    const { user, onChange, last } = open();
    const width = screen.getByLabelText("Text width (px)");

    await user.type(width, "400");
    // "4" and "40" are on the way to 400: neither is sent to the server.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ image: PICTURE, contentWidth: 400 });

    await user.clear(width);
    expect(last()).toEqual({ image: PICTURE });
    expect("contentWidth" in last()).toBe(false);

    await user.type(width, "50");
    await user.tab();
    expect(last()).toEqual({ image: PICTURE, contentWidth: 200 });

    await user.clear(width);
    await user.type(width, "9999");
    await user.tab();
    expect(last()).toEqual({ image: PICTURE, contentWidth: 600 });
  });

  it("starts the steppers from the store's own width", async () => {
    const { user, last } = open();
    await user.click(screen.getByRole("button", { name: "Decrease Text width (px)" }));
    expect(last()).toEqual({ image: PICTURE, contentWidth: 580 });
    await user.click(screen.getByRole("button", { name: "Increase Text width (px)" }));
    expect(last()).toEqual({ image: PICTURE, contentWidth: 600 });
    expect(screen.getByRole("button", { name: "Increase Text width (px)" })).toBeDisabled();
  });

  it("writes the small line as the slide's eyebrow", async () => {
    const { user, last } = open();
    await user.type(screen.getByLabelText("Small line above the heading"), "New");
    expect(last()).toEqual({ image: PICTURE, eyebrow: "New" });
  });

  it("leaves a slide saved before these fields exactly as it was until one of them is touched", () => {
    const { onChange } = open({ image: PICTURE, heading: "Summer", side: "start", vertical: "top" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the three fields in Arabic", () => {
    renderWithProviders(
      <EditorLocaleContext.Provider value="ar">
        <Slides start={[{ image: PICTURE }]} onChange={() => undefined} />
      </EditorLocaleContext.Provider>
    );
    expect(screen.getByLabelText("سطر صغير فوق العنوان")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "لون النص" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "فاتح" })).toBeInTheDocument();
    expect(screen.getByLabelText("عرض النص (بكسل)")).toBeInTheDocument();
  });
});
