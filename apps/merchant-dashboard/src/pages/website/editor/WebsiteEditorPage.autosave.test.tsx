import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { PageTree, Website, WebsiteDetail, WebsitePage } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BLOCK_PRESETS, createSection, normalizeTree } from "./blocks";
import { WebsiteEditorPage } from "./WebsiteEditorPage";

// The preview is the real storefront in a frame: nothing for jsdom to draw.
vi.mock("@/components/StorefrontPreview", () => ({ StorefrontPreview: () => null }));

/**
 * The editor page with the features it gained: the draft saves by itself,
 * Publish asks first in a sheet, and the published versions are one button
 * away. The page and its panes are otherwise the ones they were.
 */

const liveTree: PageTree = { version: 1, sections: [createSection(BLOCK_PRESETS[0], "en")] };

const home = fake<WebsitePage>({
  id: "p_home",
  websiteId: "w1",
  title: "Home",
  path: "/",
  pageType: "home",
  seo: {},
  draftData: liveTree,
  publishedData: liveTree,
  isLive: true,
});

const site = fake<Website>({ id: "w1", name: "Nile Store", status: "published", publishedRevisionId: "rev_3" });

function serve() {
  api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: site, pages: [home], publishedRevision: { id: "rev_3", revisionNumber: 3 } }));
  // The server answers a save with the page as it stored it.
  api.updateWebsitePage.mockImplementation(async (_ws: string, _site: string, _page: string, body: { draftData?: PageTree }) =>
    fake<WebsitePage>({ ...home, draftData: body.draftData ?? home.draftData })
  );
  api.publishWebsite.mockResolvedValue(fake({ website: { ...site, publishedRevisionId: "rev_4" }, revision: { id: "rev_4", revisionNumber: 4 } }));
  api.request.mockImplementation(async (path: string) => {
    if (path === "/workspaces/ws_1/websites/w1/revisions") {
      return { revisions: [{ id: "rev_3", revisionNumber: 3, note: null, publishedByUserId: "user_1", createdAt: "2026-10-09T10:00:00Z", pageCount: 1 }] };
    }
    return new Promise(() => undefined);
  });
}

const renderEditor = () => renderWithProviders(<WebsiteEditorPage />, { route: "/website/w1/edit", path: "/website/:websiteId/edit" });

/** The toolbar's line about the draft (other things on the page are a "status" too: a toast, a spinner). */
const draftStatus = () => document.querySelector<HTMLElement>("[data-save-state]")!;
const saveStatus = () =>
  waitFor(() => {
    const found = document.querySelector<HTMLElement>("[data-save-state]");
    if (!found) throw new Error("the editor has not drawn yet");
    return found;
  });

/** Adds the first block of the library to the page: the smallest edit there is. */
async function addBlock(user: ReturnType<typeof renderEditor>["user"]) {
  // A library card is the one draggable button on the screen.
  const card = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>('button[draggable="true"]');
    if (!found) throw new Error("the block library has not drawn yet");
    return found;
  });
  await user.click(card);
}

afterEach(() => {
  api.getWebsite.mockReset();
  api.updateWebsitePage.mockReset();
  api.publishWebsite.mockReset();
  api.request.mockReset();
});

describe("the website editor", () => {
  it("opens saved, and says so", async () => {
    serve();
    renderEditor();
    const status = await saveStatus();
    expect(status.getAttribute("data-save-state")).toBe("idle");
    expect(status.textContent).toContain("All saved");
    expect(api.updateWebsitePage).not.toHaveBeenCalled();
  });

  it("saves the draft by itself after an edit, without Save being pressed", async () => {
    serve();
    const { user } = renderEditor();
    await saveStatus();
    await addBlock(user);
    await waitFor(() => expect(draftStatus().getAttribute("data-save-state")).toBe("saving"));
    await waitFor(() => expect(api.updateWebsitePage).toHaveBeenCalledTimes(1), { timeout: 4000 });
    const [ws, websiteId, pageId, body] = api.updateWebsitePage.mock.calls[0];
    expect([ws, websiteId, pageId]).toEqual(["ws_1", "w1", "p_home"]);
    // The whole draft, with the new section in it; nothing else is written.
    expect(Object.keys(body as object)).toEqual(["draftData"]);
    expect(normalizeTree((body as { draftData: PageTree }).draftData).sections).toHaveLength(2);
    await waitFor(() => expect(draftStatus().getAttribute("data-save-state")).toBe("saved"));
    expect(draftStatus().textContent).toContain("Saved just now");
  });

  it("says a save failed, keeps the edit, and tries again when asked", async () => {
    serve();
    api.updateWebsitePage.mockRejectedValueOnce(new Error("offline"));
    const { user } = renderEditor();
    await saveStatus();
    await addBlock(user);
    await waitFor(() => expect(draftStatus().getAttribute("data-save-state")).toBe("failed"), { timeout: 4000 });
    expect(screen.getByText("Your last changes aren't saved yet.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api.updateWebsitePage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(draftStatus().getAttribute("data-save-state")).toBe("saved"));
  });

  it("asks before publishing: the sheet first, the publish only on its button", async () => {
    serve();
    const { user } = renderEditor();
    await saveStatus();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const sheet = await screen.findByRole("dialog", { name: "Publish your site" });
    expect(api.publishWebsite).not.toHaveBeenCalled();
    expect(await within(sheet).findByText("No page content changed since the last publish.")).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(api.publishWebsite).toHaveBeenCalledWith("ws_1", "w1"));
    expect(await screen.findByText("Published — version 4 is live for your customers.")).toBeTruthy();
  });

  it("stores an edit that is still waiting before it publishes", async () => {
    serve();
    const { user } = renderEditor();
    await saveStatus();
    await addBlock(user);
    // Publish at once, before the pause is over.
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const sheet = await screen.findByRole("dialog", { name: "Publish your site" });
    await waitFor(() => expect(api.updateWebsitePage).toHaveBeenCalledTimes(1));
    // The sheet reads the stored draft: the page now differs from what is live.
    expect(await within(sheet).findByText("Edited")).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(api.publishWebsite).toHaveBeenCalledTimes(1));
    const saved = api.updateWebsitePage.mock.invocationCallOrder[0];
    expect(saved).toBeLessThan(api.publishWebsite.mock.invocationCallOrder[0]);
  });

  it("opens the published versions from the toolbar", async () => {
    serve();
    const { user } = renderEditor();
    await saveStatus();
    await user.click(screen.getByRole("button", { name: "Published versions" }));
    const sheet = await screen.findByRole("dialog", { name: "Published versions" });
    expect(await within(sheet).findByText("Version 3")).toBeTruthy();
    expect(within(sheet).getByText("Live now")).toBeTruthy();
  });
});
