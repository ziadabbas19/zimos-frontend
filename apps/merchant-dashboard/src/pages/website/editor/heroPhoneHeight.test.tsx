import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ELEMENT_SPECS } from "./blocks";
import { EditorLocaleContext } from "./editorLocale";
import { ElementField } from "./inspector/ElementFields";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * The picture slider had a height for a computer and one for a tablet, and
 * none for a phone: there it is always a box 4 wide to 5 tall. It now has a
 * third, optional one. Unset is the old box, so the field starts empty and a
 * new slider stores nothing for it.
 */

function heightField(key: string) {
  const field = ELEMENT_SPECS.hero_slider.fields.find((entry) => entry.key === key);
  if (field?.kind !== "number") throw new Error(`the picture slider has no ${key} field`);
  return field;
}

describe("the picture slider's height on a phone", () => {
  it("comes last, after the computer's and the tablet's", () => {
    const keys = ELEMENT_SPECS.hero_slider.fields.map((field) => field.key);
    expect(keys.slice(-3)).toEqual(["height", "heightTablet", "heightMobile"]);
  });

  it("is held inside what the store draws, 200 to 900", () => {
    const phone = heightField("heightMobile");
    expect(phone.min).toBe(200);
    expect(phone.max).toBe(900);
  });

  it("is not set on a new slider, which keeps the phone's usual box", () => {
    const defaults = ELEMENT_SPECS.hero_slider.defaultProps as Record<string, unknown>;
    expect("heightMobile" in defaults).toBe(false);
    expect(defaults.height).toBe(620);
    expect(defaults.heightTablet).toBe(520);
  });

  it("starts empty, stores the number typed, and is taken out again when emptied", async () => {
    const onChange = vi.fn<(key: string, value: unknown) => void>();
    const { user, rerender } = renderWithProviders(<ElementField elementType="hero_slider" spec={heightField("heightMobile")} props={{ height: 620 }} onChange={onChange} />);
    const input = screen.getByLabelText("Height on a phone (px)");
    expect(input).toHaveValue(null);
    expect(screen.getByText("Leave empty for the slider's usual shape on a phone: 4 wide to 5 tall, and no taller than 560px.")).toBeInTheDocument();

    await user.type(input, "320");
    expect(onChange).toHaveBeenLastCalledWith("heightMobile", 320);

    rerender(<ElementField elementType="hero_slider" spec={heightField("heightMobile")} props={{ height: 620, heightMobile: 320 }} onChange={onChange} />);
    await user.clear(screen.getByLabelText("Height on a phone (px)"));
    expect(onChange).toHaveBeenLastCalledWith("heightMobile", undefined);
  });

  it("names the three heights in Arabic, each by its device", () => {
    for (const [key, label] of [
      ["height", "الارتفاع على الكمبيوتر (بكسل)"],
      ["heightTablet", "الارتفاع على التابلت (بكسل)"],
      ["heightMobile", "الارتفاع على الموبايل (بكسل)"],
    ]) {
      const { unmount } = renderWithProviders(
        <EditorLocaleContext.Provider value="ar">
          <ElementField elementType="hero_slider" spec={heightField(key)} props={{}} onChange={() => undefined} />
        </EditorLocaleContext.Provider>
      );
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("says in Arabic what an empty phone height means", () => {
    renderWithProviders(
      <EditorLocaleContext.Provider value="ar">
        <ElementField elementType="hero_slider" spec={heightField("heightMobile")} props={{}} onChange={() => undefined} />
      </EditorLocaleContext.Provider>
    );
    expect(screen.getByText("اتركه فارغا ليأخذ السلايدر شكله المعتاد على الموبايل: ٤ عرضا إلى ٥ ارتفاعا، وبحد أقصى ٥٦٠ بكسل.")).toBeInTheDocument();
  });
});
