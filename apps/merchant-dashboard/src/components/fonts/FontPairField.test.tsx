import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import type { FontCatalog, PageElement } from "@store-builder/api-client";
import type { FontLevelPair, ResolvedFontPair } from "@store-builder/ui/fonts";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { resetFontCatalogForTests } from "@/lib/fontCatalog";
import { EditorFontsContext, editorFontsValue } from "@/lib/editorFonts";
import { ElementStylePanel } from "@/pages/website/editor/ElementStylePanel";
import { PageSettingsDialog } from "@/pages/website/editor/PageSettingsDialog";
import { PageFontField } from "@/pages/website/editor/PageFontField";
import { FontPairField } from "./FontPairField";
import { fontTarget, requestFontFocus } from "./fontFocus";

/**
 * A part's font field in the editors: where each script's face comes from
 * (this part, its section, the page, the store, or the theme), the reset
 * that says what it resets to, the canvas's "Aa" that brings it into view —
 * and which elements get one at all.
 */

const CATALOG: FontCatalog = {
  version: "test",
  scripts: ["ar", "latin", "both"],
  categories: ["sans", "serif", "display", "handwriting", "mono", "kufi", "naskh", "ruqaa"],
  fonts: [
    { id: "cairo", family: "Cairo", script: "both", category: "sans", weights: [400, 700], preview: "متجرك Your store" },
    { id: "amiri", family: "Amiri", script: "ar", category: "naskh", weights: [400, 700], preview: "متجرك" },
    { id: "inter", family: "Inter", script: "latin", category: "sans", weights: [400, 700], preview: "Your store" },
    { id: "lora", family: "Lora", script: "latin", category: "serif", weights: [400, 700], preview: "Your store" },
  ],
};

beforeEach(() => {
  resetFontCatalogForTests();
  api.request.mockImplementation(async (path: string) => {
    if (path === "/fonts") return CATALOG;
    throw new Error(`unexpected ${path}`);
  });
});

function Field({
  initial = null,
  level = "element",
  inherits,
  locale = "en",
  onChange = vi.fn(),
  focusTarget,
}: {
  initial?: ResolvedFontPair | null;
  level?: "element" | "section" | "page" | "header" | "footer";
  inherits?: FontLevelPair[];
  locale?: "en" | "ar";
  onChange?: (pair: ResolvedFontPair | null) => void;
  focusTarget?: string;
}) {
  const [value, setValue] = useState<ResolvedFontPair | null>(initial);
  return (
    <FontPairField
      value={value}
      onChange={(pair) => {
        setValue(pair);
        onChange(pair);
      }}
      locale={locale}
      level={level}
      inherits={inherits}
      focusTarget={focusTarget}
    />
  );
}

const sources = () => screen.getAllByText(/^Source:/).map((label) => label.parentElement!);

describe("FontPairField — where a face comes from", () => {
  it("names the nearest level that picks each script, and the theme when none does", async () => {
    renderWithProviders(
      <Field
        inherits={[
          { level: "section", pair: { en: "lora" } },
          { level: "page", pair: null },
          { level: "store", pair: { ar: "amiri", en: "inter" } },
        ]}
      />
    );
    await screen.findAllByText("Store fonts");
    const [ar, en] = sources();
    expect(ar).toHaveAttribute("data-level", "store");
    expect(ar).toHaveTextContent("Store fonts");
    expect(ar).toHaveTextContent("Amiri");
    expect(en).toHaveAttribute("data-level", "section");
    expect(en).toHaveTextContent("Section");
    expect(en).toHaveTextContent("Lora");
    // Nothing picked here: the pickers say what they inherit, and the reset says it inherits.
    expect(screen.getByRole("button", { name: /^Arabic font.*Inherited: Store fonts · Amiri/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^English font.*Inherited: Section · Lora/ })).toBeInTheDocument();
  });

  it("says a pick is this part's own, and its reset goes back to inheriting", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Field initial={{ ar: "cairo", en: null }} onChange={onChange} inherits={[{ level: "store", pair: { ar: "amiri" } }]} />
    );
    await screen.findByText("This element");
    const [ar, en] = sources();
    expect(ar).toHaveAttribute("data-level", "element");
    expect(ar).toHaveAttribute("data-own");
    expect(ar).toHaveTextContent("Cairo");
    expect(en).toHaveAttribute("data-level", "theme");
    expect(en).toHaveTextContent("Theme font");

    await user.click(screen.getByRole("button", { name: "Use default (inherit)" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(sources()[0]).toHaveAttribute("data-level", "store");
  });

  it("keeps 'Use store default' for the store's own parts, in Arabic too", async () => {
    renderWithProviders(<Field level="footer" locale="ar" initial={{ ar: null, en: "lora" }} inherits={[{ level: "store", pair: { ar: "amiri" } }]} />);
    expect(await screen.findByRole("button", { name: "استخدام خط المتجر الافتراضي" })).toBeInTheDocument();
    const [ar, en] = screen.getAllByText(/^المصدر:/).map((label) => label.parentElement!);
    expect(ar).toHaveTextContent("خطوط المتجر");
    expect(en).toHaveTextContent("تذييل الصفحة");
  });

  it("comes into view with the keyboard on it when the canvas's Aa asks for it", async () => {
    renderWithProviders(<Field focusTarget={fontTarget.element("e1")} inherits={[]} />);
    await screen.findAllByText(/^Source:/);
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    act(() => requestFontFocus(fontTarget.element("other")));
    expect(scroll).not.toHaveBeenCalled();
    act(() => requestFontFocus(fontTarget.element("e1")));
    expect(scroll).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Arabic font/ })).toHaveFocus();
  });
});

describe("the element's Font group", () => {
  const element = (type: string): PageElement => ({ id: `${type}-1`, type, props: {} }) as unknown as PageElement;
  const editor = editorFontsValue({ primaryAr: "amiri" }, { en: "inter" }, false);

  it("is first and open for an element with words, over its section, the page and the store", async () => {
    const onSettings = vi.fn();
    const { user } = renderWithProviders(
      <EditorFontsContext.Provider value={editor}>
        <ElementStylePanel element={element("button")} tab="all" named={[]} onSettingsChange={onSettings} sectionFont={{ ar: "cairo" }} />
      </EditorFontsContext.Provider>
    );
    const group = (await screen.findByText("Font")).closest("section")!;
    expect(group).toBe(document.querySelector('[data-slot="inspector-group"]'));
    const [ar, en] = within(group as HTMLElement).getAllByText(/^Source:/).map((label) => label.parentElement!);
    await waitFor(() => expect(ar).toHaveTextContent("Cairo"));
    expect(ar).toHaveAttribute("data-level", "section");
    expect(en).toHaveAttribute("data-level", "page");

    await user.click(within(group as HTMLElement).getByRole("button", { name: /^English font/ }));
    await user.click(await screen.findByRole("option", { name: /Lora/ }));
    expect(onSettings).toHaveBeenLastCalledWith({ font: { en: "lora" } });
  });

  it("is not offered on a picture, a gap or a line", () => {
    for (const type of ["image", "spacer", "divider"]) {
      const { unmount } = renderWithProviders(
        <ElementStylePanel element={element(type)} tab="all" named={[]} onSettingsChange={vi.fn()} />
      );
      expect(screen.queryByText("Font")).toBeNull();
      unmount();
    }
  });
});

describe("Page settings → Font", () => {
  it("edits the whole page's own font over the store's", async () => {
    const onFont = vi.fn();
    const { user } = renderWithProviders(
      <EditorFontsContext.Provider value={editorFontsValue({ primaryEn: "inter" }, null, false)}>
        <PageSettingsDialog
          name="Home"
          seo={{}}
          onSaveSeo={vi.fn()}
          scripts={{ kind: "page", id: "p1" }}
          initialTab="font"
          font={<PageFontField value={null} onChange={onFont} />}
          onClose={vi.fn()}
        />
      </EditorFontsContext.Provider>
    );
    expect(await screen.findByRole("button", { name: "Font", pressed: true })).toBeInTheDocument();
    const [, en] = screen.getAllByText(/^Source:/).map((label) => label.parentElement!);
    await waitFor(() => expect(en).toHaveTextContent("Inter"));
    expect(en).toHaveAttribute("data-level", "store");
    await user.click(screen.getByRole("button", { name: /^Arabic font/ }));
    await user.click(await screen.findByRole("option", { name: /Amiri/ }));
    expect(onFont).toHaveBeenLastCalledWith({ ar: "amiri", en: null });
  });
});
