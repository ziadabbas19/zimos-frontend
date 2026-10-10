import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { PageTree, PublishProblem, Website, WebsitePage } from "@store-builder/api-client";
import { api, authMock, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BLOCK_PRESETS, createSection } from "../blocks";
import { PublishSheet } from "./PublishSheet";
import { VersionHistorySheet } from "./VersionHistorySheet";

/**
 * Publish asks first: a sheet that says what will change and what stands in
 * the way. Every publish stays in "Published versions", where any of them can
 * be put back in front of shoppers.
 */

const tree = (): PageTree => ({ version: 1, sections: [createSection(BLOCK_PRESETS[0], "en")] });
const liveTree = tree();

const home = fake<WebsitePage>({ id: "p_home", title: "Home", path: "/", pageType: "home", draftData: liveTree, publishedData: liveTree });
const about = fake<WebsitePage>({ id: "p_about", title: "About us", path: "/about", pageType: "custom", draftData: tree(), publishedData: liveTree });
const offers = fake<WebsitePage>({ id: "p_offers", title: "Offers", path: "/offers", pageType: "custom", draftData: tree(), publishedData: null });
const blank = fake<WebsitePage>({ id: "p_blank", title: "Contact", path: "/contact", pageType: "custom", draftData: { version: 1, sections: [] }, publishedData: null });

const liveSite = fake<Website>({ id: "w1", name: "Nile Store", status: "published", publishedRevisionId: "rev_3" });
const draftSite = fake<Website>({ id: "w1", name: "Nile Store", status: "draft", publishedRevisionId: null });

const REVISIONS = [
  { id: "rev_3", revisionNumber: 3, note: null, publishedByUserId: "user_1", createdAt: "2026-10-09T10:00:00Z", pageCount: 4 },
  { id: "rev_2", revisionNumber: 2, note: null, publishedByUserId: "user_9", createdAt: "2026-10-01T10:00:00Z", pageCount: 2 },
];

function serveRevisions(rows = REVISIONS) {
  api.request.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/workspaces/ws_1/websites/w1/revisions" && !init?.method) return { revisions: rows };
    if (path === "/workspaces/ws_1/websites/w1/revisions/rev_2/rollback" && init?.method === "POST") {
      return { website: { ...liveSite, publishedRevisionId: "rev_2" }, rolledBackTo: { id: "rev_2", revisionNumber: 2 } };
    }
    return new Promise(() => undefined);
  });
}

function renderSheet(over: Partial<Parameters<typeof PublishSheet>[0]> = {}, locale: "en" | "ar" = "en") {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    workspaceId: "ws_1",
    website: liveSite,
    pages: [home, about, offers],
    checking: false,
    publishing: false,
    error: null,
    problems: [] as PublishProblem[],
    lookDirty: false,
    savingLook: false,
    onSaveLook: vi.fn(),
    onPublish: vi.fn(),
    onOpenPage: vi.fn(),
    ...over,
  };
  const view = renderWithProviders(<PublishSheet {...props} />, { locale });
  return { ...view, props };
}

afterEach(() => {
  api.request.mockReset();
});

describe("the publish sheet", () => {
  it("names the pages that differ from what is live, and leaves out the ones that do not", async () => {
    serveRevisions();
    renderSheet();
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("What changes in your store")).toBeTruthy();
    const rows = within(sheet).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("About us"), expect.stringContaining("Offers")]);
    expect(within(rows[0]).getByText("Edited")).toBeTruthy();
    expect(within(rows[1]).getByText("New")).toBeTruthy();
    expect(within(sheet).queryByText("Home")).toBeNull();
  });

  it("counts the pages that were deleted since the last publish", async () => {
    // The live version froze 4 pages; 2 of today's pages have been live.
    serveRevisions();
    renderSheet();
    expect(await screen.findByText("2 deleted pages leave your store.")).toBeTruthy();
  });

  it("leaves that line out when the versions cannot be read", async () => {
    api.request.mockRejectedValue(new Error("offline"));
    renderSheet();
    await screen.findByText("What changes in your store");
    expect(screen.queryByText(/deleted page/)).toBeNull();
  });

  it("says so when nothing changed", async () => {
    serveRevisions([{ ...REVISIONS[0], pageCount: 1 }]);
    renderSheet({ pages: [home] });
    expect(await screen.findByText("No page content changed since the last publish.")).toBeTruthy();
  });

  it("says what a first publish does, without asking for the versions", () => {
    renderSheet({ website: draftSite });
    expect(screen.getByText(/First publish: every page of the site goes live/)).toBeTruthy();
    expect(screen.getByText("(3 pages)")).toBeTruthy();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("publishes only when asked", async () => {
    serveRevisions();
    const { user, props } = renderSheet();
    expect(props.onPublish).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Publish now" }));
    expect(props.onPublish).toHaveBeenCalledTimes(1);
  });

  it("waits while the last changes are being stored", async () => {
    serveRevisions();
    renderSheet({ checking: true });
    expect(await screen.findByText("Saving your last changes…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish now" })).toHaveProperty("disabled", true);
  });

  it("names an empty page before the server has to, and opens it", async () => {
    serveRevisions();
    const { user, props } = renderSheet({ pages: [home, blank] });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/This page is empty/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish now" })).toHaveProperty("disabled", true);
    await user.click(within(alert).getByRole("button", { name: "Open the page" }));
    expect(props.onOpenPage).toHaveBeenCalledWith("p_blank");
  });

  it("names a site with no home page", async () => {
    serveRevisions();
    renderSheet({ pages: [about] });
    expect(await screen.findByText(/no home page at the address/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish now" })).toHaveProperty("disabled", true);
  });

  it("shows the server's own list after a refused publish", async () => {
    serveRevisions();
    renderSheet({ problems: [{ pageId: "p_about", path: "/about", field: "sections", message: "A button has no link" }] });
    expect(await screen.findByText("A button has no link")).toBeTruthy();
    // Once in the list of changes, once beside the problem.
    expect(screen.getAllByText("/about")).toHaveLength(2);
  });

  it("says the look is not part of a publish, and saves it from there", async () => {
    serveRevisions();
    const { user, props } = renderSheet({ lookDirty: true });
    expect(await screen.findByText(/Your look changes aren't saved yet/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save the look" }));
    expect(props.onSaveLook).toHaveBeenCalledTimes(1);
  });

  it("reads in the dashboard's own Arabic", async () => {
    serveRevisions();
    renderSheet({}, "ar");
    expect(await screen.findByText("ما سيتغيّر في متجرك")).toBeTruthy();
    expect(screen.getByRole("button", { name: "انشر الآن" })).toBeTruthy();
    expect(screen.getByText("عُدّلت")).toBeTruthy();
  });
});

describe("published versions", () => {
  function renderHistory(over: { liveRevisionId?: string | null; locale?: "en" | "ar" } = {}) {
    const onRestored = vi.fn();
    Object.assign(authMock, { user: { id: "user_1", email: "agent@zimos.test", fullName: "Amr Hassan", status: "active" } });
    const view = renderWithProviders(
      <VersionHistorySheet
        open
        onOpenChange={vi.fn()}
        workspaceId="ws_1"
        websiteId="w1"
        liveRevisionId={over.liveRevisionId === undefined ? "rev_3" : over.liveRevisionId}
        onRestored={onRestored}
      />,
      { locale: over.locale ?? "en" }
    );
    return { ...view, onRestored };
  }

  it("lists every publish, marks the one shoppers see, and says who published it", async () => {
    serveRevisions();
    renderHistory();
    const sheet = await screen.findByRole("dialog");
    const rows = await within(sheet).findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Version 3")).toBeTruthy();
    expect(within(rows[0]).getByText("Live now")).toBeTruthy();
    expect(rows[0].textContent).toContain("You published it");
    expect(rows[0].textContent).toContain("4 pages");
    expect(rows[1].textContent).toContain("Someone on your team published it");
    // The live version has nothing to restore.
    expect(within(rows[0]).queryByRole("button", { name: "Restore this version" })).toBeNull();
  });

  it("asks before a restore, and says the draft and the look do not change", async () => {
    serveRevisions();
    const { user, onRestored } = renderHistory();
    await user.click(await screen.findByRole("button", { name: "Restore this version" }));
    const question = screen.getByRole("alertdialog", { name: "Restore version 2?" });
    expect(within(question).getByText(/The draft you are editing does not change/)).toBeTruthy();
    expect(api.request).not.toHaveBeenCalledWith(expect.stringContaining("rollback"), expect.anything());

    await user.click(within(question).getByRole("button", { name: "Keep the current one" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("puts the chosen version live and tells the editor", async () => {
    serveRevisions();
    const { user, onRestored } = renderHistory();
    await user.click(await screen.findByRole("button", { name: "Restore this version" }));
    await user.click(screen.getByRole("button", { name: "Restore it" }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/websites/w1/revisions/rev_2/rollback", { method: "POST", body: {} });
    expect(await screen.findByText("Version 2 is live for your customers.")).toBeTruthy();
  });

  it("says a site that was never published has no versions yet", async () => {
    serveRevisions([]);
    renderHistory({ liveRevisionId: null });
    expect(await screen.findByText(/You haven't published this site yet/)).toBeTruthy();
  });

  it("reads in the dashboard's own Arabic", async () => {
    serveRevisions();
    renderHistory({ locale: "ar" });
    expect(await screen.findByText("النسخ المنشورة")).toBeTruthy();
    expect(await screen.findByText("تظهر للعملاء الآن")).toBeTruthy();
    expect(screen.getByRole("button", { name: "استعادة هذه النسخة" })).toBeTruthy();
  });
});
