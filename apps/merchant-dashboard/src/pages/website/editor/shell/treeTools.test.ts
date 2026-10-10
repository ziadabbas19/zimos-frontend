import { describe, expect, it } from "vitest";
import type { PageTree, WebsitePage } from "@store-builder/api-client";
import { BLOCK_PRESETS, createSection } from "../blocks";
import { localPublishProblems, pageChange } from "./treeTools";

/**
 * What the publish sheet reads off the pages: which of them differ from what
 * is live, and the two things the server always refuses.
 */

const preset = BLOCK_PRESETS[0];

function tree(count = 1): PageTree {
  return { version: 1, sections: Array.from({ length: count }, () => createSection(preset, "en")) };
}

function page(over: Partial<WebsitePage>): WebsitePage {
  return {
    id: "p1",
    title: "Home",
    path: "/",
    pageType: "home",
    draftData: tree(),
    publishedData: null,
    ...over,
  } as unknown as WebsitePage;
}

/** The same tree with every object's keys in the opposite order, as jsonb may hand it back. */
function reordered<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reordered) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, v]) => [key, reordered(v)])
    ) as T;
  }
  return value;
}

describe("how a page stands against what is live", () => {
  it("is new while it has never been published", () => {
    expect(pageChange(page({ publishedData: null }))).toBe("new");
  });

  it("is the same when the draft is what is live, whatever order the keys come back in", () => {
    const draft = tree(2);
    expect(pageChange(page({ draftData: draft, publishedData: JSON.parse(JSON.stringify(draft)) }))).toBe("same");
    expect(pageChange(page({ draftData: draft, publishedData: reordered(draft) }))).toBe("same");
  });

  it("is changed when a section was added or a word was edited", () => {
    const live = tree(1);
    expect(pageChange(page({ draftData: { ...live, sections: [...live.sections, createSection(preset, "en")] }, publishedData: live }))).toBe(
      "changed"
    );
    const edited = JSON.parse(JSON.stringify(live)) as PageTree;
    edited.sections[0].settings = { ...(edited.sections[0].settings ?? {}), label: "Renamed" };
    expect(pageChange(page({ draftData: edited, publishedData: live }))).toBe("changed");
  });
});

describe("what the server would refuse", () => {
  it("finds nothing wrong with a site that has a home page with content", () => {
    expect(localPublishProblems([page({}), page({ id: "p2", path: "/about", title: "About", pageType: "custom" })])).toEqual([]);
  });

  it("names a site without a page at /", () => {
    const about = page({ id: "p2", path: "/about", title: "About", pageType: "custom" });
    expect(localPublishProblems([about])).toEqual([{ kind: "no-home", page: null }]);
  });

  it("names each page with nothing on it", () => {
    const empty = page({ id: "p2", path: "/about", title: "About", pageType: "custom", draftData: { version: 1, sections: [] } });
    const problems = localPublishProblems([page({}), empty]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ kind: "empty", page: { id: "p2" } });
  });
});
