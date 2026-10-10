import type { PageTree, Website, WebsiteDetail } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/**
 * What the website page says about a site beyond its list row — how many
 * pages it has, whether its draft has moved on since the last publish, and
 * the home page to draw as its thumbnail.
 *
 * There is no flag for "changed since publish" on the list (see
 * Store editor), so it is worked out here from the
 * one call the editor itself opens with: publishing copies each page's draft
 * onto `publishedData` as it is, so a page whose two trees differ has edits
 * that shoppers do not see yet. Only the small answer is kept, never the trees
 * of every page.
 */
export interface SiteFacts {
  pageCount: number;
  /** Pages whose draft is not what was last published (a page never published counts). */
  changedPages: number;
  /** The home page as it is being edited, else as published; null when it has nothing to draw. */
  home: PageTree | null;
}

/** The store's website: the published one, or the first while none is live (as Store settings → Pages reads it). */
export function currentSiteOf(sites: ReadonlyArray<Website>): Website | null {
  return sites.find((site) => site.status === "published") ?? sites[0] ?? null;
}

function sameTree(a: PageTree | null, b: PageTree | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function drawable(tree: PageTree | null | undefined): PageTree | null {
  if (!tree || typeof tree !== "object" || !Array.isArray(tree.sections) || tree.sections.length === 0) return null;
  return tree;
}

export function siteFactsOf(detail: Pick<WebsiteDetail, "pages">): SiteFacts {
  const pages = detail.pages ?? [];
  const home = pages.find((page) => page.pageType === "home" || page.path === "/") ?? pages[0];
  return {
    pageCount: pages.length,
    changedPages: pages.filter((page) => !sameTree(page.draftData, page.publishedData)).length,
    home: drawable(home?.draftData) ?? drawable(home?.publishedData),
  };
}

export async function loadSiteFacts(workspaceId: string, websiteId: string): Promise<SiteFacts> {
  return siteFactsOf(await apiClient.getWebsite(workspaceId, websiteId));
}

/** `status` plus "published, with edits waiting": the four words the status chip can say. */
export type SiteState = Website["status"] | "changes";

export function siteStateOf(site: Pick<Website, "status">, facts: SiteFacts | null): SiteState {
  if (site.status === "published" && facts && facts.changedPages > 0) return "changes";
  return site.status;
}
