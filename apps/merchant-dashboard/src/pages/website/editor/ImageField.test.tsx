import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { EditorLocaleContext } from "./editorLocale";
import { ImageField, ImageListField } from "./ImageField";
import { ItemListField, type ItemSubField } from "./ItemListField";
import { SHOWCASE_ELEMENT_SPECS } from "./showcaseBlocks";

/**
 * A picture field shows the picture it holds, not the empty field's icon:
 * an uploaded file by its own address, a template's own art (a path the
 * storefront serves) from the storefront. The icon is for an empty field,
 * or a picture that will not load.
 */

const PICTURE = "https://cdn.zimos.test/hero.jpg";
const TEMPLATE_ART = "/xs/16/slide-1.jpg";

const placeholder = (container: HTMLElement) => container.querySelector('[data-slot="image-placeholder"]');
const skeleton = (container: HTMLElement) => container.querySelector('[data-slot="image-skeleton"]');

describe("a picture field's thumbnail", () => {
  it("shows the stored picture, named after the field", () => {
    const { container } = renderWithProviders(<ImageField label="Picture" value={PICTURE} onChange={vi.fn()} />);
    const img = screen.getByRole("img", { name: "Picture" });
    expect(img).toHaveAttribute("src", PICTURE);
    expect(img).toHaveClass("object-cover");
    expect(placeholder(container)).toBeNull();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
  });

  it("asks the storefront for a template's own art", () => {
    renderWithProviders(<ImageField label="Picture" value={TEMPLATE_ART} onChange={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Picture" })).toHaveAttribute("src", `${STOREFRONT_URL}${TEMPLATE_ART}`);
  });

  it("holds the square with a skeleton until the picture has loaded", () => {
    const { container } = renderWithProviders(<ImageField label="Picture" value={PICTURE} onChange={vi.fn()} />);
    expect(skeleton(container)).not.toBeNull();
    fireEvent.load(screen.getByRole("img", { name: "Picture" }));
    expect(skeleton(container)).toBeNull();
    expect(screen.getByRole("img", { name: "Picture" })).not.toHaveClass("opacity-0");
  });

  it("shows the empty field's icon, and no picture, when nothing is stored", () => {
    const { container } = renderWithProviders(<ImageField label="Picture" value="" onChange={vi.fn()} />);
    expect(placeholder(container)).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("takes a blank address for an empty field", () => {
    const { container } = renderWithProviders(<ImageField label="Picture" value="   " onChange={vi.fn()} />);
    expect(placeholder(container)).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("falls back to the icon when the picture will not load, and can still be removed", async () => {
    const onChange = vi.fn();
    const { container, user } = renderWithProviders(<ImageField label="Picture" value={PICTURE} onChange={onChange} />);
    fireEvent.error(screen.getByRole("img", { name: "Picture" }));
    expect(container.querySelector("img")).toBeNull();
    expect(placeholder(container)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove image" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("loads a new picture afresh after one that would not load", () => {
    const { container, rerender } = renderWithProviders(<ImageField label="Picture" value={PICTURE} onChange={vi.fn()} />);
    fireEvent.error(screen.getByRole("img", { name: "Picture" }));
    expect(container.querySelector("img")).toBeNull();
    rerender(<ImageField label="Picture" value="https://cdn.zimos.test/other.jpg" onChange={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Picture" })).toHaveAttribute("src", "https://cdn.zimos.test/other.jpg");
  });

  it("names the picture and its remove button in Arabic", () => {
    renderWithProviders(
      <EditorLocaleContext.Provider value="ar">
        <ImageField label="الصورة" value={PICTURE} onChange={vi.fn()} />
      </EditorLocaleContext.Provider>
    );
    expect(screen.getByRole("img", { name: "الصورة" })).toHaveAttribute("src", PICTURE);
    expect(screen.getByRole("button", { name: "حذف الصورة" })).toBeInTheDocument();
  });

  it("numbers each picture of a gallery", () => {
    renderWithProviders(<ImageListField label="Pictures" value={[PICTURE, TEMPLATE_ART]} onChange={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Pictures 1" })).toHaveAttribute("src", PICTURE);
    expect(screen.getByRole("img", { name: "Pictures 2" })).toHaveAttribute("src", `${STOREFRONT_URL}${TEMPLATE_ART}`);
  });
});

/** The fields of one slide of the picture slider, as the inspector is given them. */
function slideFields(): ItemSubField[] {
  const slides = SHOWCASE_ELEMENT_SPECS.hero_slider.fields.find((field) => field.key === "slides");
  if (!slides || slides.kind !== "itemList") throw new Error("the picture slider has no slides field");
  return slides.fields;
}

function Slides({ start }: { start: Array<Record<string, unknown>> }) {
  const [value, setValue] = useState(start);
  return (
    <ItemListField label="Slides" value={value} itemLabel="Slide" itemLabelAr="شريحة" titleKey="alt" fields={slideFields()} max={8} onChange={setValue} />
  );
}

describe("a slide of a template's slider", () => {
  it("shows its pictures from the storefront", () => {
    const { container } = renderWithProviders(<Slides start={[{ image: TEMPLATE_ART, mobileImage: "/xs/16/slide-1-phone.jpg" }]} />);
    // Each picture is drawn as a two-language field; the Arabic store's side shows first.
    expect(screen.getByRole("img", { name: "Picture — Arabic" })).toHaveAttribute("src", `${STOREFRONT_URL}${TEMPLATE_ART}`);
    expect(screen.getByRole("img", { name: "Picture on a phone — Arabic" })).toHaveAttribute("src", `${STOREFRONT_URL}/xs/16/slide-1-phone.jpg`);
    // The card's own small picture, in its title row, comes from the storefront too.
    const header = container.querySelector("button[aria-expanded] img");
    expect(header).toHaveAttribute("src", `${STOREFRONT_URL}${TEMPLATE_ART}`);
  });
});
