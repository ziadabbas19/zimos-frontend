import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import type { PageSection, PageTree, Website, WebsiteDetail, WebsitePage } from "@store-builder/api-client";
import type { StorefrontPreview } from "@/components/StorefrontPreview";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BLOCK_PRESETS, createSection, sectionElements, sectionLabel } from "./blocks";
import { WebsiteEditorPage } from "./WebsiteEditorPage";

type PreviewProps = Parameters<typeof StorefrontPreview>[0];

// The preview is the real storefront in a frame: nothing for jsdom to draw. What the editor hands it is kept,
// so a test can read the page as the preview gets it and press on it the way the frame does.
const preview = vi.hoisted(() => ({ props: null as unknown as PreviewProps }));
vi.mock("@/components/StorefrontPreview", async (original) => ({
  ...(await original<typeof import("@/components/StorefrontPreview")>()),
  StorefrontPreview: (props: PreviewProps) => {
    preview.props = props;
    return null;
  },
}));

/**
 * A section holding one element opens that element at once (its settings with no second click), but the keys
 * still act on the section: Delete asks to delete it, Ctrl/⌘+D and Ctrl/⌘+C copy all of it. An element the
 * merchant picks on the page keeps the keys on itself, as before.
 */

const onePreset = BLOCK_PRESETS.find((preset) => sectionElements(createSection(preset, "en")).length === 1);
if (!onePreset) throw new Error("no block preset holds a single element");
const band: PageSection = { ...createSection(onePreset, "en"), id: "s_band" };
const bandElement = sectionElements(band)[0].id;
const other: PageSection = { ...createSection(BLOCK_PRESETS[0], "en"), id: "s_other" };
const tree: PageTree = { version: 1, sections: [band, other] };

const home = fake<WebsitePage>({
  id: "p_home",
  websiteId: "w1",
  title: "Home",
  path: "/",
  pageType: "home",
  seo: {},
  draftData: tree,
  publishedData: tree,
  isLive: true,
});

const site = fake<Website>({ id: "w1", name: "Nile Store", status: "published", publishedRevisionId: "rev_3" });

function serve() {
  api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: site, pages: [home], publishedRevision: { id: "rev_3", revisionNumber: 3 } }));
  api.updateWebsitePage.mockImplementation(async (_ws: string, _site: string, _page: string, body: { draftData?: PageTree }) =>
    fake<WebsitePage>({ ...home, draftData: body.draftData ?? home.draftData })
  );
  api.request.mockImplementation(() => new Promise(() => undefined));
}

/** A store wearing an imported template: the editor's copy, paste and duplicate keys are on. */
const templateStore = { currentWorkspace: { ...testWorkspace, themeSettings: { xsLook: "01" } } };

function renderEditor() {
  serve();
  return renderWithProviders(<WebsiteEditorPage />, {
    route: "/website/w1/edit",
    path: "/website/:websiteId/edit",
    workspace: templateStore,
  });
}

/** The page as the preview has it now. */
const shown = () => preview.props.tree.sections;

/** Picks the one-element section from the section list (the phone's sheet: the test screen has no width). */
async function pickBandFromList(user: ReturnType<typeof renderEditor>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Sections" }));
  const list = await screen.findByRole("dialog");
  await user.click(within(list).getByRole("button", { name: new RegExp(`^${sectionLabel(band, "en")}`) }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

afterEach(() => {
  api.getWebsite.mockReset();
  api.updateWebsitePage.mockReset();
  api.request.mockReset();
});

describe("a section holding one element", () => {
  it("opens that element when it is picked from the list", async () => {
    const { user } = renderEditor();
    await pickBandFromList(user);
    expect(preview.props.canvas?.selectedId).toBe("s_band");
    expect(preview.props.selectedElementId).toBe(bandElement);
  });

  it("asks to delete the section on Delete", async () => {
    const { user } = renderEditor();
    await pickBandFromList(user);
    await user.keyboard("{Delete}");
    const confirm = await screen.findByRole("dialog", { name: "Delete this section?" });
    await user.click(within(confirm).getByRole("button", { name: "Delete section" }));
    await waitFor(() => expect(shown().map((s) => s.id)).toEqual(["s_other"]));
  });

  it("copies the whole section on Ctrl+D, not its element inside it", async () => {
    const { user } = renderEditor();
    await pickBandFromList(user);
    await user.keyboard("{Control>}d{/Control}");
    await waitFor(() => expect(shown()).toHaveLength(3));
    const [first, copy, last] = shown();
    expect(first.id).toBe("s_band");
    expect(last.id).toBe("s_other");
    expect(copy.id).not.toBe("s_band");
    // Each band still holds its one element.
    expect(sectionElements(first)).toHaveLength(1);
    expect(sectionElements(copy)).toHaveLength(1);
  });

  it("copies the whole section on Ctrl+C", async () => {
    const { user } = renderEditor();
    await pickBandFromList(user);
    await user.keyboard("{Control>}c{/Control}");
    const clip = JSON.parse(localStorage.getItem("zimos:editor-clipboard") ?? "null") as { kind: string; node: { id: string } };
    expect(clip.kind).toBe("section");
    expect(clip.node.id).toBe("s_band");
  });

  it("takes the same keys from the page while the page has the focus", async () => {
    const { user } = renderEditor();
    await pickBandFromList(user);
    act(() => preview.props.canvas?.onCanvasKey?.("duplicate"));
    await waitFor(() => expect(shown()).toHaveLength(3));
    expect(sectionElements(shown()[0])).toHaveLength(1);
    act(() => preview.props.canvas?.onCanvasKey?.("delete"));
    expect(await screen.findByText("Delete this section?")).toBeTruthy();
  });
});

describe("an element picked on the page", () => {
  /** A click on the band in the preview: the frame names the element under the pointer. */
  function pickOnPage() {
    act(() => preview.props.onSelectElement?.({ sectionId: "s_band", elementId: bandElement, elementType: "" }));
  }

  it("keeps the keys on itself: Delete leaves the section, Ctrl+D copies the element", async () => {
    const { user } = renderEditor();
    await screen.findByRole("button", { name: "Sections" });
    pickOnPage();
    expect(preview.props.selectedElementId).toBe(bandElement);
    await user.keyboard("{Delete}");
    expect(screen.queryByText("Delete this section?")).toBeNull();
    await user.keyboard("{Control>}d{/Control}");
    await waitFor(() => expect(sectionElements(shown()[0])).toHaveLength(2));
    expect(shown()).toHaveLength(2);
  });

  it("takes over from a section picked in the list once it is pressed", async () => {
    const { user } = renderEditor();
    await pickBandFromList(user);
    pickOnPage();
    await user.keyboard("{Delete}");
    expect(screen.queryByText("Delete this section?")).toBeNull();
  });
});
