import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { PageTree, Website, WebsiteDetail, WebsitePage as SitePage } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { invalidateCached } from "@/lib/useCachedAsync";
import { currentSiteOf, siteFactsOf, siteStateOf } from "./gallery/siteFacts";
import { WebsitePage } from "./WebsitePage";

/**
 * /website answers "where is my store and how do I edit it": the store's
 * site first, with whether shoppers see it and whether edits are waiting,
 * then its other sites, then the templates. A store without a site sees the
 * three steps and the templates.
 */

const tree = (label: string): PageTree => ({ version: 1, sections: [{ id: `s_${label}`, type: "section", rows: [] }] }) as unknown as PageTree;

const site = (id: string, name: string, status: Website["status"]) =>
  fake<Website>({ id, name, status, subdomain: `${id}.zimos.test`, publishedRevisionId: status === "published" ? "rev_1" : null, sourceTemplateVersionId: null });

const page = (id: string, draft: PageTree, published: PageTree | null) =>
  fake<SitePage>({ id, title: id, path: id === "home" ? "/" : `/${id}`, pageType: id === "home" ? "home" : "custom", draftData: draft, publishedData: published });

class NoIntersections {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", NoIntersections);
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
  invalidateCached("website:");
  api.listWebsiteTemplates.mockResolvedValue([]);
  api.me.mockResolvedValue(fake({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("what the page works out about a site", () => {
  it("takes the published site as the store's, else the first", () => {
    const draft = site("a", "Draft", "draft");
    const live = site("b", "Live", "published");
    expect(currentSiteOf([draft, live])).toBe(live);
    expect(currentSiteOf([draft])).toBe(draft);
    expect(currentSiteOf([])).toBeNull();
  });

  it("counts the pages whose draft is not what shoppers see", () => {
    const same = tree("a");
    const facts = siteFactsOf(fake<WebsiteDetail>({ pages: [page("home", same, same), page("about", tree("new"), tree("old")), page("offers", tree("x"), null)] }));
    expect(facts).toMatchObject({ pageCount: 3, changedPages: 2 });
    expect(siteStateOf(site("b", "Live", "published"), facts)).toBe("changes");
    expect(siteStateOf(site("a", "Draft", "draft"), facts)).toBe("draft");
    expect(siteStateOf(site("b", "Live", "published"), { ...facts, changedPages: 0 })).toBe("published");
    // Until the one extra call answers, a published site just says it is published.
    expect(siteStateOf(site("b", "Live", "published"), null)).toBe("published");
  });
});

describe("the store's site", () => {
  it("leads the page with its name, its state and one way in to edit it", async () => {
    const live = site("w1", "Nile Store", "published");
    api.listWebsites.mockResolvedValue([live]);
    const same = tree("a");
    api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: live, pages: [page("home", same, same)], publishedRevision: null }));
    renderWithProviders(<WebsitePage />, { route: "/website" });

    expect(await screen.findByRole("heading", { name: "Nile Store" })).toBeTruthy();
    expect((await screen.findAllByText("Published")).length).toBeGreaterThan(0);
    const edit = screen.getAllByText("Edit the store")[0].closest("a");
    expect(edit?.getAttribute("href")).toBe("/website/w1/edit");
    expect(screen.getByText("1 page")).toBeTruthy();
  });

  it("says when saved edits are not published yet", async () => {
    const live = site("w1", "Nile Store", "published");
    api.listWebsites.mockResolvedValue([live]);
    api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: live, pages: [page("home", tree("new"), tree("old"))], publishedRevision: null }));
    renderWithProviders(<WebsitePage />, { route: "/website" });

    expect(await screen.findByText("Unpublished changes")).toBeTruthy();
    expect(screen.getByText(/You saved changes that are not published yet/)).toBeTruthy();
  });

  it("keeps its links to what exists here: settings and pages, no store texts, no emails, no trash", async () => {
    const live = site("w1", "Nile Store", "published");
    api.listWebsites.mockResolvedValue([live, site("w2", "Winter", "draft")]);
    api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: live, pages: [], publishedRevision: null }));
    renderWithProviders(<WebsitePage />, { route: "/website" });

    const more = await screen.findByRole("navigation", { name: "More for your store" });
    expect(within(more).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/store-settings", "/store-settings/pages"]);
    expect(document.body.textContent).not.toMatch(/Store texts|trash|emails/i);
  });

  it("asks before deleting a site, says it is for good, and warns when it is live", async () => {
    const live = site("w1", "Nile Store", "published");
    api.listWebsites.mockResolvedValue([live]);
    api.getWebsite.mockResolvedValue(fake<WebsiteDetail>({ website: live, pages: [], publishedRevision: null }));
    api.deleteWebsite.mockResolvedValue(undefined as never);
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    await user.click(await screen.findByRole("button", { name: "Site tools" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete this site…" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/will be deleted permanently\. This cannot be undone\./)).toBeTruthy();
    expect(within(dialog).getByText(/This site is live right now/)).toBeTruthy();
    expect(api.deleteWebsite).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete site" }));
    await waitFor(() => expect(api.deleteWebsite).toHaveBeenCalledWith("ws_1", "w1"));
    expect(await screen.findByText("Site “Nile Store” deleted.")).toBeTruthy();
    // Deleted for good: nothing offers to put it back.
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});

describe("a store without a site", () => {
  it("shows the three steps, with the templates as the first of them", async () => {
    api.listWebsites.mockResolvedValue([]);
    renderWithProviders(<WebsitePage />, { route: "/website" });

    const steps = await screen.findByRole("list", { name: "How your store gets started" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(api.getWebsite).not.toHaveBeenCalled();
  });

  it("reads in the dashboard's own Arabic", async () => {
    api.listWebsites.mockResolvedValue([]);
    renderWithProviders(<WebsitePage />, { route: "/website", locale: "ar" });
    expect(await screen.findByRole("list", { name: "كيف يبدأ متجرك" })).toBeTruthy();
    expect(screen.getByText("اختر القالب")).toBeTruthy();
  });
});
