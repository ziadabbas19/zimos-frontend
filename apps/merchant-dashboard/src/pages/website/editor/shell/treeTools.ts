import type { PageElement, PageSection, PageTree, WebsitePage } from "@store-builder/api-client";
import { normalizeTree, sectionElements, setElementProp } from "../blocks";

/**
 * Small pure helpers the shell needs on top of blocks.ts: writing one prop of
 * one element from the canvas (a picked image), and telling what a publish
 * would change.
 */

/** The element with this id in the section, or null. */
export function findElement(section: PageSection, elementId: string): PageElement | null {
  return sectionElements(section).find((element) => element.id === elementId) ?? null;
}

/**
 * One prop of one element set from outside the inspector — the picture a
 * click on the canvas replaces. Goes through `setElementProp`, the same path a
 * field change takes. The same array back when nothing changes.
 */
export function setElementField(
  sections: PageSection[],
  sectionId: string,
  elementId: string,
  field: string,
  value: unknown
): PageSection[] {
  // The frame names the section; an element dragged elsewhere a moment ago may sit in another one.
  const owner =
    sections.find((section) => section.id === sectionId && findElement(section, elementId) !== null) ??
    sections.find((section) => findElement(section, elementId) !== null);
  if (!owner) return sections;
  const element = findElement(owner, elementId);
  if (!element) return sections;
  const props = (element.props ?? {}) as Record<string, unknown>;
  if (props[field] === value) return sections;
  const next = setElementProp(owner, element, field, value);
  return sections.map((section) => (section === owner ? next : section));
}

// --- what a publish changes ---------------------------------------------------

/**
 * JSON with its keys in a fixed order. The API keeps trees in jsonb, which
 * hands keys back in its own order, while a save answers with the keys as
 * they were sent — so two equal trees can differ as plain JSON text.
 */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

// A page's trees are replaced, never edited in place, so the text of one object never changes.
const stableCache = new WeakMap<object, string>();

function stableTree(tree: PageTree | null): string {
  if (tree === null) return "null";
  const cached = stableCache.get(tree);
  if (cached !== undefined) return cached;
  const text = stable(normalizeTree(tree));
  stableCache.set(tree, text);
  return text;
}

export type PageChange = "new" | "changed" | "same";

/**
 * How a page's saved draft stands against what is live. The API mirrors the
 * live content of every page in `publishedData` (set by publish and by a
 * rollback), so the draft can be compared with it here. It covers the content
 * only: a changed search title or description is not in either tree.
 */
export function pageChange(page: WebsitePage): PageChange {
  if (page.publishedData == null) return "new";
  return stableTree(page.draftData) === stableTree(page.publishedData) ? "same" : "changed";
}

export interface LocalPublishProblem {
  kind: "no-home" | "empty";
  /** The page to fix, when the problem is one page's. */
  page: WebsitePage | null;
}

function elementCount(sections: PageSection[]): number {
  return sections.reduce((count, section) => count + sectionElements(section).length, 0);
}

/**
 * The two things the publish check always refuses (backend
 * pagesService.publishWebsite): a site without a page at "/", and a page with
 * nothing on it. Found here first so the merchant reads them before pressing
 * Publish; the server's own list still shows if it finds anything else.
 */
export function localPublishProblems(pages: WebsitePage[]): LocalPublishProblem[] {
  const problems: LocalPublishProblem[] = [];
  if (!pages.some((page) => page.path === "/")) problems.push({ kind: "no-home", page: null });
  for (const page of pages) {
    if (elementCount(normalizeTree(page.draftData).sections) === 0) problems.push({ kind: "empty", page });
  }
  return problems;
}
