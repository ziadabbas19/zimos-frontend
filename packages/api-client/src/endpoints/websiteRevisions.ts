import type { ApiClient } from "../client";
import type { Website } from "../types";

/**
 * A website's publish history (backend modules/pages/pagesRoutes.js,
 * pagesService.js `listRevisions` / `rollbackToRevision`).
 *
 * Every Publish freezes all the site's pages into one revision; the store
 * serves the revision the website points at. Rolling back repoints the LIVE
 * site at an older revision: shoppers see that version again. It does NOT
 * change the drafts being edited, and it does not bring back the store look
 * (theme, header, footer), which is not part of a revision.
 *
 * There is no endpoint that returns a revision's content, and no history of
 * drafts: the list is of published versions only.
 */

/** One row of GET /workspaces/:ws/websites/:websiteId/revisions (newest first). */
export interface WebsiteRevisionRow {
  id: string;
  /** Starts at 1 and goes up by one with every publish. */
  revisionNumber: number;
  /** The optional note sent with the publish (the editor sends none today). */
  note: string | null;
  /** Who pressed Publish: a user id, with no name beside it. Null when the account is gone. */
  publishedByUserId: string | null;
  createdAt: string;
  /** How many pages the revision froze. */
  pageCount: number;
}

/** 200 body of POST .../revisions/:revisionId/rollback. */
export interface WebsiteRollbackResult {
  /** The website as it is now: `status` "published", `publishedRevisionId` the chosen revision. */
  website: Website;
  rolledBackTo: { id: string; revisionNumber: number };
}

const base = (workspaceId: string, websiteId: string) => `/workspaces/${workspaceId}/websites/${websiteId}/revisions`;

/** The site's published versions, newest first. Needs website.edit. */
export async function websiteRevisionsList(
  client: ApiClient,
  workspaceId: string,
  websiteId: string
): Promise<WebsiteRevisionRow[]> {
  const { revisions } = await client.request<{ revisions: WebsiteRevisionRow[] }>(base(workspaceId, websiteId));
  return revisions;
}

/**
 * Puts an older published version live again. Needs website.publish and a
 * store that is out of draft (403 SUBSCRIPTION_REQUIRED otherwise), like
 * Publish itself.
 */
export function websiteRevisionsRollback(
  client: ApiClient,
  workspaceId: string,
  websiteId: string,
  revisionId: string
): Promise<WebsiteRollbackResult> {
  return client.request<WebsiteRollbackResult>(`${base(workspaceId, websiteId)}/${revisionId}/rollback`, {
    method: "POST",
    body: {},
  });
}
