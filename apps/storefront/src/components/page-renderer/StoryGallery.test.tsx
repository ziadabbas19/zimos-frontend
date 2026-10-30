import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageTree } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { PageRenderer } from "./PageRenderer";
import { StoryGalleryElement } from "./StoryGallery";

/**
 * `story_gallery` — the store's story in pictures (backend pages/pageTree.js):
 * a grid of the merchant's photos with their words under them, opened full
 * size in a lightbox that keeps the focus, closes on Escape and steps through
 * the photos the way the store reads.
 */

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/storeMeta", () => ({ getStoreMeta: async () => null }));

afterEach(cleanup);

const ITEMS = [
  { src: "https://cdn.zimos.test/first-shop.jpg", title: "First shop", description: "Where it all started, in 2015." },
  // An entry the merchant opened but never gave a photo: it is not drawn, and the next keeps its own place.
  { title: "No photo yet" },
  { src: "https://cdn.zimos.test/workshop.jpg", description: "Our workshop today." },
  { src: "https://cdn.zimos.test/team.jpg", title: "The team" },
];

const STORE = {} as unknown as StoreInfo;

function show(props: Record<string, unknown>, locale: "ar" | "en" = "en", editable = false) {
  return render(
    <StoreContextProvider locale={locale} store={STORE}>
      <StoryGalleryElement props={props} editable={editable} />
    </StoreContextProvider>
  );
}

const page = (props: Record<string, unknown>) =>
  ({
    sections: [
      { id: "s1", type: "section", rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", type: "story_gallery", props }] }] }] },
    ],
  }) as unknown as PageTree;

async function drawPage(props: Record<string, unknown>): Promise<HTMLElement> {
  const rendered = await PageRenderer({ tree: page(props), workspaceId: "w1", currency: "EGP", locale: "en", editable: false });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(rendered as React.ReactElement);
  return root;
}

/** Presses on a spot of the lightbox's stage and lets go further along, as a finger would. */
function drag(target: Element, fromX: number, toX: number) {
  act(() => {
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: fromX, clientY: 300 }));
    target.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: toX, clientY: 300 }));
  });
}

describe("story gallery: the grid", () => {
  it("draws nothing at all while no entry has a photo", async () => {
    expect(show({ title: "Our story", items: [] }).container.innerHTML).toBe("");
    cleanup();
    expect(show({ title: "Our story", items: [{ title: "No photo" }, { src: "javascript:alert(1)" }, "not an entry"] }).container.innerHTML).toBe("");
    cleanup();
    expect(show({ title: "Our story" }).container.innerHTML).toBe("");

    // Through the page renderer too: the section holds no title, no list, no picture.
    const root = await drawPage({ title: "Our story", columns: 3, items: [] });
    expect(root.textContent).not.toContain("Our story");
    expect(root.querySelector("ul, img, figure")).toBeNull();
  });

  it("draws the photos in a grid, each lazy, named by its title, with its words under it", () => {
    const { container } = show({ title: "Our story", columns: 4, items: ITEMS });

    expect(screen.getByRole("heading", { name: "Our story" }).getAttribute("dir")).toBe("auto");
    const grid = container.querySelector("ul")!;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("min-[400px]:grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-4");

    const images = Array.from(container.querySelectorAll("img"));
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://cdn.zimos.test/first-shop.jpg",
      "https://cdn.zimos.test/workshop.jpg",
      "https://cdn.zimos.test/team.jpg",
    ]);
    // The title is the photo's alt text; a photo without one is decoration to a screen reader.
    expect(images.map((img) => img.getAttribute("alt"))).toEqual(["First shop", "", "The team"]);
    for (const img of images) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");
    }

    const captions = Array.from(container.querySelectorAll("figcaption"));
    expect(captions.map((caption) => caption.textContent)).toEqual(["First shopWhere it all started, in 2015.", "Our workshop today.", "The team"]);
    for (const words of container.querySelectorAll("figcaption p")) expect(words.getAttribute("dir")).toBe("auto");
    expect(screen.queryByText("No photo yet")).toBeNull();
  });

  it("is reached through the page renderer, three columns on a computer unless told otherwise", async () => {
    const root = await drawPage({ title: "Our story", items: ITEMS });
    expect(root.querySelector("h2")?.textContent).toBe("Our story");
    expect(root.querySelector("ul")?.className).toContain("lg:grid-cols-3");
    expect(root.querySelectorAll("figure img")).toHaveLength(3);
    // Nothing of the lightbox is on the page until a photo is pressed.
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens nothing in the editor's preview, where a photo names its card in the inspector instead", () => {
    const { container } = show({ items: ITEMS }, "en", true);
    expect(screen.queryByRole("button")).toBeNull();
    expect(Array.from(container.querySelectorAll("figure")).map((figure) => figure.getAttribute("data-xs-item"))).toEqual(["items.0", "items.2", "items.3"]);
    fireEvent.click(container.querySelector("img")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("story gallery: the lightbox", () => {
  it("opens the pressed photo with its words, keeps the focus, and closes on Escape back to that photo", async () => {
    show({ title: "Our story", items: ITEMS });
    const opener = screen.getByRole("button", { name: "Open the photo larger: First shop" });
    // A photo without a title is named by its place.
    expect(screen.getByRole("button", { name: "Open photo 2 larger" })).toBeTruthy();

    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Our story" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByRole("img", { name: "First shop" }).getAttribute("src")).toBe("https://cdn.zimos.test/first-shop.jpg");
    expect(within(dialog).getByText("Where it all started, in 2015.")).toBeTruthy();
    expect(within(dialog).getByText("1 / 3")).toBeTruthy();
    // The page behind stops scrolling, and the focus moves inside.
    expect(document.body.style.overflow).toBe("hidden");
    const close = within(dialog).getByRole("button", { name: "Close the photo" });
    await waitFor(() => expect(document.activeElement).toBe(close));

    // Tab wraps inside the dialog rather than reaching the page behind.
    const next = within(dialog).getByRole("button", { name: "Next photo" });
    next.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });

  it("closes from its button and from the backdrop, not from the photo", () => {
    show({ items: ITEMS });
    fireEvent.click(screen.getByRole("button", { name: "Open the photo larger: The team" }));
    const dialog = screen.getByRole("dialog", { name: "Photos" });
    fireEvent.click(within(dialog).getByRole("img", { name: "The team" }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open the photo larger: The team" }));
    fireEvent.click(screen.getByRole("button", { name: "Close the photo" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("steps the way the arrows point in an LTR store", () => {
    show({ items: ITEMS });
    fireEvent.click(screen.getByRole("button", { name: "Open the photo larger: First shop" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("dir")).toBe("ltr");

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(within(dialog).getByText("Our workshop today.")).toBeTruthy();
    expect(within(dialog).getByText("2 / 3")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(within(dialog).getByText("1 / 3")).toBeTruthy();
    // Back from the first goes round to the last.
    fireEvent.click(within(dialog).getByRole("button", { name: "Previous photo" }));
    expect(within(dialog).getByRole("img", { name: "The team" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next photo" }));
    expect(within(dialog).getByRole("img", { name: "First shop" })).toBeTruthy();
  });

  it("puts the next photo on the left in an RTL store: keys, buttons and swipes", () => {
    show({ title: "قصتنا", items: ITEMS }, "ar");
    fireEvent.click(screen.getByRole("button", { name: "افتح الصورة أكبر: First shop" }));
    const dialog = screen.getByRole("dialog", { name: "قصتنا" });
    expect(dialog.getAttribute("dir")).toBe("rtl");
    expect(within(dialog).getByRole("button", { name: "اقفل الصورة" })).toBeTruthy();

    // ← is forward in Arabic, → is back.
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(within(dialog).getByText("2 / 3")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(within(dialog).getByText("1 / 3")).toBeTruthy();

    // The buttons say where they go: «اللي بعدها» is the next photo, whichever side it sits on.
    const next = within(dialog).getByRole("button", { name: "الصورة اللي بعدها" });
    const previous = within(dialog).getByRole("button", { name: "الصورة اللي قبلها" });
    fireEvent.click(next);
    expect(within(dialog).getByText("2 / 3")).toBeTruthy();
    fireEvent.click(previous);
    fireEvent.click(previous);
    expect(within(dialog).getByText("3 / 3")).toBeTruthy();
    // The next button sits at the end of the line (the left), its arrow turned to point there.
    expect(next.parentElement?.className).toContain("end-0");
    expect(next.querySelector("svg")?.getAttribute("class")).toContain("rtl:rotate-180");

    // A finger dragged to the right brings in the next photo (from the left); to the left, the one before.
    const stage = within(dialog).getByRole("img", { name: "The team" }).parentElement!;
    drag(stage, 100, 260);
    expect(within(dialog).getByText("1 / 3")).toBeTruthy();
    drag(stage, 260, 100);
    expect(within(dialog).getByText("3 / 3")).toBeTruthy();
    // The press that ended a swipe does not close the lightbox; the next one on the backdrop does.
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no steps for a single photo", () => {
    show({ items: [ITEMS[0]] });
    fireEvent.click(screen.getByRole("button", { name: "Open the photo larger: First shop" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Next photo" })).toBeNull();
    expect(within(dialog).queryByText("1 / 1")).toBeNull();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(within(dialog).getByRole("img", { name: "First shop" })).toBeTruthy();
  });
});
