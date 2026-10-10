import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { EditorLocaleContext } from "./editorLocale";
import { ItemListField, type ItemSubField } from "./ItemListField";
import { SHOWCASE_ELEMENT_SPECS } from "./showcaseBlocks";
import { renderWithProviders } from "@/test/renderWithProviders";

// The switch on: what the editor offers once VITE_HERO_MEDIA_ENABLED is "true".
vi.mock("@/lib/features", async (original) => ({ ...(await original<typeof import("@/lib/features")>()), HERO_MEDIA_ENABLED: true }));

type Slide = Record<string, unknown>;

function slideFields(): ItemSubField[] {
  const slides = SHOWCASE_ELEMENT_SPECS.hero_slider.fields.find((field) => field.key === "slides");
  if (!slides || slides.kind !== "itemList") throw new Error("the picture slider has no slides field");
  return slides.fields;
}

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

describe("a slide of the picture slider, with the hero media switch on", () => {
  it("adds the phone's place and the veil right after the computer's place", () => {
    const keys = slideFields().map((field) => field.key);
    const at = keys.indexOf("vertical");
    expect(keys.slice(at + 1, at + 5)).toEqual(["sideMobile", "verticalMobile", "overlay", "overlayMobile"]);
  });

  it("stores nothing for a slide until one of them is touched", () => {
    const { onChange } = open({ image: PICTURE, side: "start", vertical: "top" });
    expect(onChange).not.toHaveBeenCalled();
    // Unset, a phone shows as following the computer.
    expect(screen.getByLabelText("Text sits at, on a phone")).toHaveValue("");
    expect(screen.getByLabelText("Text height, on a phone")).toHaveValue("");
    expect(screen.getByLabelText("Veil over the picture (%)")).toHaveValue(null);
    expect(screen.getByLabelText("Veil on a phone (%)")).toHaveValue(null);
  });

  it("stores a phone's own place, and drops it again for \"same as on a computer\"", async () => {
    const { user, last } = open({ image: PICTURE, side: "start" });
    const side = screen.getByLabelText("Text sits at, on a phone");
    expect(Array.from(side.querySelectorAll("option"), (option) => option.textContent)).toEqual(["Same as on a computer", "Start", "Centre", "End"]);

    await user.selectOptions(side, "End");
    expect(last()).toEqual({ image: PICTURE, side: "start", sideMobile: "end" });

    await user.selectOptions(screen.getByLabelText("Text height, on a phone"), "Top");
    expect(last()).toEqual({ image: PICTURE, side: "start", sideMobile: "end", verticalMobile: "top" });

    await user.selectOptions(side, "Same as on a computer");
    expect(last()).toEqual({ image: PICTURE, side: "start", verticalMobile: "top" });
    expect("sideMobile" in last()).toBe(false);
  });

  it("stores the veil as a whole number from 0 to 60", async () => {
    const { user, last } = open();
    const veil = screen.getByLabelText("Veil over the picture (%)");

    await user.type(veil, "40");
    expect(last()).toEqual({ image: PICTURE, overlay: 40 });

    await user.clear(veil);
    expect(last()).toEqual({ image: PICTURE });

    await user.type(veil, "85");
    await user.tab();
    expect(last()).toEqual({ image: PICTURE, overlay: 60 });

    // The steppers move in fives and stop at the ends.
    await user.click(screen.getByRole("button", { name: "Decrease Veil over the picture (%)" }));
    expect(last()).toEqual({ image: PICTURE, overlay: 55 });
    expect(screen.getByRole("button", { name: "Increase Veil over the picture (%)" })).toBeEnabled();
  });

  it("keeps 0 on a phone as a value of its own, and an emptied field as \"same as on a computer\"", async () => {
    const { user, last } = open({ image: PICTURE, overlay: 40 });
    const phone = screen.getByLabelText("Veil on a phone (%)");

    await user.type(phone, "0");
    expect(last()).toEqual({ image: PICTURE, overlay: 40, overlayMobile: 0 });

    await user.clear(phone);
    expect(last()).toEqual({ image: PICTURE, overlay: 40 });
    expect("overlayMobile" in last()).toBe(false);
  });

  it("names them in Arabic", () => {
    renderWithProviders(
      <EditorLocaleContext.Provider value="ar">
        <Slides start={[{ image: PICTURE }]} onChange={() => undefined} />
      </EditorLocaleContext.Provider>
    );
    const side = screen.getByLabelText("مكان النص على الموبايل");
    expect(side.querySelector("option")?.textContent).toBe("كما على الكمبيوتر");
    expect(screen.getByLabelText("ارتفاع النص على الموبايل")).toBeInTheDocument();
    expect(screen.getByLabelText("طبقة فوق الصورة (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("الطبقة على الموبايل (%)")).toBeInTheDocument();
  });
});
