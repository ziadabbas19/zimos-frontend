import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { PageElement, PageElementType, PageSection } from "@store-builder/api-client";
import { BLOCK_PRESETS, ELEMENT_SPECS, createSection, setElementProp } from "./blocks";
import { EditorLocaleContext, elementLabel, presetText, type EditorLocale } from "./editorLocale";
import { ElementFields } from "./inspector/ElementFields";
import { InspectorEnvProvider, type RequestImage } from "./inspector/env";
import { offeredPresets, purposesOf, searchPresets } from "./library/purposes";
import { plainText } from "./plainText";
import { renderWithProviders } from "@/test/renderWithProviders";

/**
 * `story_gallery` — the store's story in pictures, for the About page. The
 * backend (pages/pageTree.js) takes at most 24 photos, each an image address
 * with a plain-text title (≤120) and description (≤500), a plain-text section
 * title (≤200) and 2, 3 or 4 columns. What the editor writes has to stay
 * inside that, or the page fails to save.
 */

const PHOTO_A = "https://cdn.zimos.test/first-shop.jpg";
const PHOTO_B = "https://cdn.zimos.test/workshop.jpg";

/** Outside the api-client's element union, like the other builder extras. */
const STORY_GALLERY = "story_gallery" as PageElementType;

function sectionWith(element: PageElement): PageSection {
  return {
    id: "s1",
    type: "section",
    rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [element] }] }],
  } as unknown as PageSection;
}

const elementOf = (section: PageSection) => section.rows[0].columns[0].elements[0];

/**
 * The element's fields as the inspector draws them, writing through the one place a field's change is
 * written (SectionInspector → setElementProp). The media library hands back the next of `library`.
 */
function Inspector({ start, onSave, library, locale = "en" }: { start: Record<string, unknown>; onSave: (section: PageSection) => void; library: string[]; locale?: EditorLocale }) {
  const [section, setSection] = useState(() => sectionWith({ id: "e1", type: "story_gallery", props: start } as unknown as PageElement));
  const [picked] = useState(() => [...library]);
  const requestImage: RequestImage = (apply) => {
    const url = picked.shift();
    if (url) apply(url);
  };
  return (
    <EditorLocaleContext.Provider value={locale}>
      <InspectorEnvProvider value={{ compact: false, pairImages: false, requestImage }}>
        <ElementFields
          element={elementOf(section)}
          onPropChange={(key, value) => {
            const next = setElementProp(section, elementOf(section), key, value);
            setSection(next);
            onSave(next);
          }}
        />
      </InspectorEnvProvider>
    </EditorLocaleContext.Provider>
  );
}

function open(start: Record<string, unknown>, library: string[] = [], locale: EditorLocale = "en") {
  const onSave = vi.fn<(section: PageSection) => void>();
  const view = renderWithProviders(<Inspector start={start} onSave={onSave} library={library} locale={locale} />);
  const saved = () => elementOf(onSave.mock.calls.at(-1)![0]).props as Record<string, unknown>;
  const cards = () => Array.from(view.container.querySelectorAll<HTMLElement>('[data-slot="inspector-item"]'));
  return { ...view, onSave, saved, cards };
}

describe("story gallery: the block", () => {
  const preset = BLOCK_PRESETS.find((entry) => entry.key === "story-gallery");

  it("is offered with the store's story blocks, starting with a title and no photos", () => {
    expect(preset).toBeDefined();
    expect(preset!.group).toBe("story");
    expect(preset!.elements).toEqual(["story_gallery"]);
    expect(purposesOf(preset!)).toEqual(["content"]);
    expect(offeredPresets(BLOCK_PRESETS, false)).toContain(preset);

    const ar = createSection(preset!, "ar");
    expect(ar.rows).toHaveLength(1);
    expect(ar.rows[0].columns[0].span).toBe(12);
    expect(elementOf(ar).type).toBe("story_gallery");
    expect(elementOf(ar).props).toEqual({ title: "قصتنا", columns: 3, items: [] });
    expect(elementOf(createSection(preset!, "en")).props).toEqual({ title: "Our story", columns: 3, items: [] });
  });

  it("is named in Modern Standard Arabic and found by «من نحن» or «about»", () => {
    expect(presetText("story-gallery", preset!, "ar").label).toBe("معرض صور القصة");
    expect(elementLabel(STORY_GALLERY, "Story gallery", "ar")).toBe("معرض صور القصة");
    expect(searchPresets("about").map((entry) => entry.key)).toContain("story-gallery");
    expect(searchPresets("من نحن").map((entry) => entry.key)).toContain("story-gallery");
    expect(searchPresets("معرض صور القصة")[0]?.key).toBe("story-gallery");
  });

  it("asks for what the server takes: 2 to 4 columns, at most 24 photos, plain words of its lengths", () => {
    const fields = ELEMENT_SPECS[STORY_GALLERY].fields;
    const columns = fields.find((field) => field.key === "columns");
    const items = fields.find((field) => field.key === "items");
    const title = fields.find((field) => field.key === "title");
    if (columns?.kind !== "number" || items?.kind !== "itemList" || title?.kind !== "text") throw new Error("unexpected field kinds");
    expect([columns.min, columns.max, columns.strict]).toEqual([2, 4, true]);
    expect([title.plain, title.maxLength]).toEqual([true, 200]);
    expect(items.max).toBe(24);
    expect(items.arrange).toBe(true);
    expect(items.fields.map((field) => [field.key, field.kind])).toEqual([
      ["src", "image"],
      ["title", "text"],
      ["description", "textarea"],
    ]);
    const words = items.fields.filter((field) => field.kind === "text" || field.kind === "textarea") as Array<{ plain?: boolean; maxLength?: number }>;
    expect(words.map((field) => [field.plain, field.maxLength])).toEqual([
      [true, 120],
      [true, 500],
    ]);
  });
});

describe("story gallery: its settings", () => {
  it("adds photos from the media library, with their words, and saves them as the server takes them", async () => {
    const { user, saved, cards } = open({ title: "Our story", columns: 3, items: [] }, [PHOTO_A]);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add photo" }));
    expect(saved().items).toEqual([{}]);
    // The new card is open: its picture comes from the library, like every picture of the editor.
    await user.click(screen.getByRole("button", { name: "Choose from the library" }));
    expect(saved().items).toEqual([{ src: PHOTO_A }]);

    // Markup is dropped as it is typed; a lone "<" is a word like any other.
    await user.type(screen.getByLabelText("Title (also read out for the photo)"), "<b>First</b> shop");
    await user.type(screen.getByLabelText("Description"), "Where it began, 1 < 2.");
    expect(saved().items).toEqual([{ src: PHOTO_A, title: "First shop", description: "Where it began, 1 < 2." }]);
    expect(cards()).toHaveLength(1);
    expect(JSON.stringify(saved())).toBe(
      `{"title":"Our story","columns":3,"items":[{"src":"${PHOTO_A}","title":"First shop","description":"Where it began, 1 < 2."}]}`
    );
  });

  it("reorders with the buttons and by dragging, and deletes a photo", async () => {
    const { user, saved, cards } = open({
      title: "Our story",
      columns: 3,
      items: [
        { src: PHOTO_A, title: "First shop" },
        { src: PHOTO_B, title: "Workshop" },
      ],
    });

    // Up and Down, inside an open card: what a keyboard reaches.
    await user.click(screen.getByRole("button", { name: "Workshop" }));
    await user.click(screen.getByRole("button", { name: "Move Workshop up" }));
    expect((saved().items as Array<{ title: string }>).map((item) => item.title)).toEqual(["Workshop", "First shop"]);

    // The grip at the start of each card drags it to another place.
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    const grip = screen.getByRole("img", { name: "Drag First shop to another place in the list" });
    fireEvent.dragStart(grip, { dataTransfer });
    fireEvent.dragOver(cards()[0], { dataTransfer });
    fireEvent.drop(cards()[0], { dataTransfer });
    expect((saved().items as Array<{ title: string }>).map((item) => item.title)).toEqual(["First shop", "Workshop"]);

    // The open card went with its photo: Workshop's card is still the open one.
    await user.click(screen.getByRole("button", { name: "Remove Workshop" }));
    expect(saved().items).toEqual([{ src: PHOTO_A, title: "First shop" }]);
    expect(cards()).toHaveLength(1);
  });

  it("stops at 24 photos and says so", () => {
    const items = Array.from({ length: 24 }, (_, i) => ({ src: `https://cdn.zimos.test/${i}.jpg` }));
    open({ title: "", columns: 3, items });
    expect(screen.getByRole("button", { name: "Add photo" })).toBeDisabled();
    expect(screen.getByText("That's the most it takes (24).")).toBeInTheDocument();
  });

  it("keeps the section title plain and the columns between 2 and 4", async () => {
    const { user, onSave, saved } = open({ title: "", columns: 3, items: [] });
    await user.type(screen.getByLabelText("Section title"), "<i>Our</i> story");
    expect(saved().title).toBe("Our story");

    const columns = screen.getByRole("spinbutton");
    await user.clear(columns);
    await user.type(columns, "5");
    await user.tab();
    expect(saved().columns).toBe(4);
    expect(onSave.mock.calls.map(([section]) => (elementOf(section).props as Record<string, unknown>).columns)).not.toContain(5);
  });

  it("speaks Modern Standard Arabic in an Arabic editor", () => {
    open({ title: "", columns: 3, items: [{ src: PHOTO_A }] }, [], "ar");
    expect(screen.getByLabelText("عنوان القسم")).toBeInTheDocument();
    expect(screen.getByText("عدد الأعمدة على الكمبيوتر")).toBeInTheDocument();
    expect(screen.getByText("الصور")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة صورة" })).toBeInTheDocument();
    expect(within(document.body).getByText(/يظهر القسم في المتجر بعد إضافة أول صورة/)).toBeInTheDocument();
  });
});

describe("plainText", () => {
  it("drops markup and the characters the server refuses, and keeps the rest", () => {
    expect(plainText("<b>Hi</b> there")).toBe("Hi there");
    expect(plainText('<img src=x onerror="alert(1)">Shop')).toBe("Shop");
    expect(plainText("a < b and c > d")).toBe("a  d");
    expect(plainText("1 < 2")).toBe("1 < 2");
    expect(plainText("x > y")).toBe("x > y");
    // Zero-width and direction marks, controls and DEL go; tabs and line breaks stay.
    expect(plainText(`a${String.fromCharCode(0x200b)}b${String.fromCharCode(0x202e)}c${String.fromCharCode(0)}d${String.fromCharCode(0x7f)}e\tf\ng\r\n`)).toBe("abcde\tf\ng\r\n");
    expect(plainText("قصتنا منذ البداية")).toBe("قصتنا منذ البداية");
  });
});
