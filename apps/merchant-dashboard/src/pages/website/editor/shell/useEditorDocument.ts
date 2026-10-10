import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateWebsitePagePayload,
  PageSection,
  PageTree,
  PublishProblem,
  WebsiteDetail,
  WebsitePage,
  WebsiteRevision,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useWorkspace } from "@/context/WorkspaceContext";
import { createStarterSections, normalizeTree } from "../blocks";
import { useEditHistory } from "../editHistory";
import { editorUi, useEditorLocale } from "../editorLocale";
import {
  lookToWorkspacePatch,
  readStoreLook,
  sameAppearance,
  sameLook,
  sameShellParts,
  themeSettingsSize,
  type StoreLook,
} from "../storeLook";
import { THEME_SETTINGS_MAX_CHARS } from "../storeShell";
import { useAutosave } from "./useAutosave";

/**
 * The editor's document: the website and its pages, the open page's tree with
 * undo / redo, the store look, and how each of them is saved.
 *
 * Two things are edited here and they are saved differently:
 *
 *  - the PAGE (its sections, named styles and page product) is a draft in the
 *    backend. It saves by itself shortly after the last change (useAutosave)
 *    through the same PATCH the old Save button made — `draftData` and nothing
 *    else. The rest of the tree (`version`, `globalStyles`) is carried through
 *    verbatim: dropping keys this editor can't edit would destroy template data.
 *  - the LOOK (theme, colours, logo, header, footer, announcement bar) is not
 *    drafted: the workspace PATCH puts it live at once. So it never saves by
 *    itself — `saveLook` runs only when the merchant asks.
 *
 * Undo / redo steps through `{ sections, look }` exactly as before; named
 * styles and the page product stay outside it.
 */

/** Everything in the tree the editor doesn't lay out, preserved across a save. */
export type TreeMeta = Omit<PageTree, "sections">;

/** What undo/redo steps through: the open page's sections and the store look. */
export interface EditorDoc {
  sections: PageSection[];
  look: StoreLook;
}

export type PublishResult =
  | { ok: true; revision: WebsiteRevision }
  /** The draft could not be stored first, so nothing was published. */
  | { ok: false; reason: "save" }
  /** The server refused: its list of problems (one per offending page), or one message. */
  | { ok: false; reason: "refused"; problems: PublishProblem[]; error: string | null };

const NO_PAGES: WebsitePage[] = [];

/**
 * The pre-publish check's 422 body. Its `details[]` is page-scoped
 * (`{ field, message, pageId?, path? }`) rather than the flat form-field shape
 * `getFieldErrors` expects, so it is unpacked here instead.
 */
export function publishProblemsOf(err: unknown): PublishProblem[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  const body = err.details as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return [];
  return (details as PublishProblem[]).filter((d) => d && typeof d.message === "string");
}

/** Which page the editor opens by default, and falls back to after a delete. */
export function pickEditablePage(pages: WebsitePage[]): WebsitePage | null {
  if (pages.length === 0) return null;
  return pages.find((p) => p.pageType === "home") ?? pages.find((p) => p.path === "/") ?? pages[0];
}

export function useEditorDocument(workspaceId: string, websiteId: string) {
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const locale = useEditorLocale();
  const ui = editorUi(locale);

  const site = useAsync(() => apiClient.getWebsite(workspaceId, websiteId), [workspaceId, websiteId]);
  const pages = site.data?.pages ?? NO_PAGES;
  const website = site.data?.website ?? null;

  // Which page is open. Adjusted during render (below) whenever it no longer
  // names a real page — on first load, and after the open page is deleted.
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  if (pages.length > 0 && !pages.some((p) => p.id === selectedPageId)) {
    setSelectedPageId(pickEditablePage(pages)!.id);
  }
  const page = pages.find((p) => p.id === selectedPageId) ?? null;

  // Editing state, with undo/redo. `baseline` / `lookBaseline` are what was
  // last loaded or saved — the dirty checks compare against them rather than
  // tracking every mutation.
  const history = useEditHistory<EditorDoc>({ sections: [], look: readStoreLook(null) });
  const { set: historySet, reset: historyReset, undo, redo } = history;
  const { sections, look } = history.value;
  const [baseline, setBaseline] = useState<string>("[]");
  // The rest of the tree (named styles, the page product) is saved with the page too.
  const [metaBaseline, setMetaBaseline] = useState<string>("{}");
  const [lookBaseline, setLookBaseline] = useState<StoreLook>(() => readStoreLook(null));
  const [treeMeta, setTreeMeta] = useState<TreeMeta>({ version: 1 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lookError, setLookError] = useState<string | null>(null);
  const [savingLook, setSavingLook] = useState(false);
  /** How many times the look was saved in this visit (the first-run steps tick "brand it" on the first). */
  const [lookSaves, setLookSaves] = useState(0);

  // Seed the editing state from the loaded page and the workspace's look,
  // adjusting state during render (React's documented pattern for "reset state
  // when a prop changes") rather than in an effect, which would render once
  // with the previous page's tree.
  //
  // Keyed on the page / workspace id we last seeded from, NOT on the objects: a
  // save swaps fresh ones in, and re-seeding on that would wipe the merchant's
  // current selection (and undo history) every time the draft saves.
  const [seededPageId, setSeededPageId] = useState<string | null>(null);
  const [seededLookFor, setSeededLookFor] = useState<string | null>(null);
  const needLook = currentWorkspace !== null && currentWorkspace.id !== seededLookFor;
  const needPage = page !== null && page.id !== seededPageId;
  if (needLook || needPage) {
    let nextSections = sections;
    let nextLook = look;
    if (needLook) {
      nextLook = readStoreLook(currentWorkspace);
      setSeededLookFor(currentWorkspace.id);
      setLookBaseline(nextLook);
    }
    if (needPage) {
      const { sections: loaded, ...meta } = normalizeTree(page.draftData);
      nextSections = loaded;
      setSeededPageId(page.id);
      setTreeMeta(meta);
      setMetaBaseline(JSON.stringify(meta));
      setBaseline(JSON.stringify(loaded));
      setSaveError(null);
    }
    historyReset({ sections: nextSections, look: nextLook });
  }

  const sectionsJson = useMemo(() => JSON.stringify(sections), [sections]);
  const metaJson = useMemo(() => JSON.stringify(treeMeta), [treeMeta]);
  const pageDirty = sectionsJson !== baseline || metaJson !== metaBaseline;
  const lookDirty = !sameLook(look, lookBaseline);
  /** Only the Store look panel's own fields. */
  const appearanceDirty = !sameAppearance(look, lookBaseline);
  /** The announcement bar, header or footer have unsaved changes the preview should show. */
  const shellDirty = !sameShellParts(look, lookBaseline);
  /** How much of the API's themeSettings allowance a save would use (1 = full). */
  const themeSettings = currentWorkspace?.themeSettings;
  const settingsUsage = useMemo(
    () => themeSettingsSize(themeSettings, look) / THEME_SETTINGS_MAX_CHARS,
    [themeSettings, look]
  );

  // What a save needs, as it is NOW: a save that starts from a timer or a
  // shortcut must send the newest tree, not the one of the render that armed it.
  const live = useRef({
    page,
    sections,
    treeMeta,
    look,
    sectionsJson,
    metaJson,
    detail: site.data,
    settingsUsage,
    saveThemeSettings,
    tooLarge: ui.shellTooLarge,
  });
  // The baselines are also written the moment a save answers (below), so the
  // very next "is there anything left to save?" is right without waiting for a render.
  const baselineRef = useRef(baseline);
  const metaBaselineRef = useRef(metaBaseline);
  useEffect(() => {
    live.current = {
      page,
      sections,
      treeMeta,
      look,
      sectionsJson,
      metaJson,
      detail: site.data,
      settingsUsage,
      saveThemeSettings,
      tooLarge: ui.shellTooLarge,
    };
    baselineRef.current = baseline;
    metaBaselineRef.current = metaBaseline;
  });

  const setSiteData = site.setData;
  const patchSite = useCallback(
    (change: (detail: WebsiteDetail) => WebsiteDetail) => {
      const loaded = live.current.detail;
      if (!loaded) return;
      setSiteData((prev) => change(prev ?? loaded));
    },
    [setSiteData]
  );

  const isPageDirty = useCallback(
    () => live.current.sectionsJson !== baselineRef.current || live.current.metaJson !== metaBaselineRef.current,
    []
  );

  /** The same PATCH the Save button made: `{ draftData }` for the open page. Resolves to whether it was stored. */
  const savePage = useCallback(async (): Promise<boolean> => {
    const now = live.current;
    const target = now.page;
    if (!target) return true;
    const sentMeta = now.treeMeta;
    const tree: PageTree = { ...sentMeta, sections: now.sections };
    try {
      const updated = await apiClient.updateWebsitePage(workspaceId, websiteId, target.id, { draftData: tree });
      patchSite((detail) => ({ ...detail, pages: detail.pages.map((p) => (p.id === updated.id ? updated : p)) }));
      // Another page is open by now: its state is not this save's to touch.
      if (live.current.page?.id !== target.id) return true;
      // Re-baseline off what the server stored, not off what we sent.
      const { sections: saved, ...savedMeta } = normalizeTree(updated.draftData);
      const savedJson = JSON.stringify(saved);
      const savedMetaJson = JSON.stringify(savedMeta);
      baselineRef.current = savedJson;
      metaBaselineRef.current = savedMetaJson;
      setBaseline(savedJson);
      setMetaBaseline(savedMetaJson);
      // Named styles or the page product changed while the save was away: keep the newer ones, they save next.
      if (live.current.treeMeta === sentMeta) setTreeMeta(savedMeta);
      setSaveError(null);
      return true;
    } catch (err) {
      if (live.current.page?.id !== target.id) return true;
      // A malformed tree comes back as a 422 whose details name the node path
      // (e.g. "data.sections[1].rows"); surface that instead of a bare message.
      const fields = getFieldErrors(err);
      const detail = Object.entries(fields)
        .filter(([key]) => key.includes("["))
        .map(([key, message]) => `${key}: ${message}`)[0];
      setSaveError(detail ?? getErrorMessage(err));
      return false;
    }
  }, [workspaceId, websiteId, patchSite]);

  const autosave = useAutosave({
    signature: `${sectionsJson}|${metaJson}`,
    dirty: pageDirty,
    isDirty: isPageDirty,
    save: savePage,
    scope: seededPageId,
  });
  const flush = autosave.flush;

  /**
   * Saves the look to the workspace. It goes LIVE with this call — which is
   * why nothing calls it but the merchant's own "save the look".
   */
  const saveLook = useCallback(async (): Promise<boolean> => {
    const now = live.current;
    // The API refuses a themeSettings blob over ~5KB with a bare 422; say why
    // before sending it, while the merchant can still trim a link or two.
    if (now.settingsUsage > 1) {
      setLookError(now.tooLarge);
      return false;
    }
    const saving = now.look;
    setSavingLook(true);
    setLookError(null);
    try {
      await now.saveThemeSettings((current) => lookToWorkspacePatch(current, saving));
      setLookBaseline(saving);
      setLookSaves((n) => n + 1);
      return true;
    } catch (err) {
      setLookError(getErrorMessage(err));
      return false;
    } finally {
      setSavingLook(false);
    }
  }, []);

  /** One tree edit; pass a `key` to fold a burst (typing in one section) into one undo step. */
  const setSections = useCallback(
    (update: (prev: PageSection[]) => PageSection[], key?: string) => {
      // An update that changes nothing (a drop in place) records no undo step.
      historySet((doc) => {
        const next = update(doc.sections);
        return next === doc.sections ? doc : { ...doc, sections: next };
      }, key);
    },
    [historySet]
  );

  const updateLook = useCallback(
    (next: StoreLook, key?: string) => {
      historySet((doc) => ({ ...doc, look: next }), key);
    },
    [historySet]
  );

  /** Puts the look back to what is saved — one more undo step, so it can itself be taken back. */
  const revertLook = useCallback(() => {
    setLookError(null);
    historySet((doc) => ({ ...doc, look: lookBaseline }));
  }, [historySet, lookBaseline]);

  const createPage = useCallback(
    async (payload: CreateWebsitePagePayload): Promise<WebsitePage> => {
      // A new page starts from a few placeholder sections rather than empty. The
      // create call validates `draftData` exactly like a save, so it goes in the
      // same request and the page opens saved, with nothing pending.
      const created = await apiClient.createPage(workspaceId, websiteId, {
        ...payload,
        draftData: { version: 1, sections: createStarterSections(payload.title, locale) },
      });
      patchSite((detail) => ({ ...detail, pages: [...detail.pages, created] }));
      // Open it straight away — the canvas re-seeds off the new id.
      setSelectedPageId(created.id);
      return created;
    },
    [workspaceId, websiteId, locale, patchSite]
  );

  const deletePage = useCallback(
    async (target: WebsitePage): Promise<boolean> => {
      // The backend deletes any page, home included; this is the real guard, not
      // just the disabled button in the page list.
      if (target.pageType === "home") return false;
      await apiClient.deletePage(workspaceId, websiteId, target.id);
      // If that was the open page, the render-time check above reselects home.
      patchSite((detail) => ({ ...detail, pages: detail.pages.filter((p) => p.id !== target.id) }));
      return true;
    },
    [workspaceId, websiteId, patchSite]
  );

  /** A page's search settings: saved at once, live with the next publish (as before). */
  const saveSeo = useCallback(
    async (pageId: string, seo: Record<string, unknown>) => {
      const saved = await apiClient.updateWebsitePage(workspaceId, websiteId, pageId, { seo });
      patchSite((detail) => ({
        ...detail,
        pages: detail.pages.map((p) => (p.id === saved.id ? { ...p, seo: saved.seo } : p)),
      }));
    },
    [workspaceId, websiteId, patchSite]
  );

  /**
   * Publishes the whole site. The server snapshots `draftData` as it is
   * stored, so whatever is still waiting to save goes out first — publishing
   * with unsaved edits would ship the previous content.
   */
  const publish = useCallback(async (): Promise<PublishResult> => {
    const stored = await flush();
    if (!stored) return { ok: false, reason: "save" };
    try {
      const { website: published, revision } = await apiClient.publishWebsite(workspaceId, websiteId);
      // The server copies every draft into its live mirror; do the same here so
      // "what changed since the last publish" is right without a reload.
      patchSite((detail) => ({
        ...detail,
        website: published,
        publishedRevision: revision,
        pages: detail.pages.map((p) => ({ ...p, publishedData: p.draftData, isLive: true })),
      }));
      return { ok: true, revision };
    } catch (err) {
      // A 422 is the pre-publish check: it reports every problem at once, keyed
      // by page rather than by form field, so getFieldErrors can't flatten it.
      const problems = publishProblemsOf(err);
      return { ok: false, reason: "refused", problems, error: problems.length > 0 ? null : getErrorMessage(err) };
    }
  }, [workspaceId, websiteId, flush, patchSite]);

  const refreshSite = site.refresh;
  /** After a rollback: what is live changed on the server, the drafts did not. */
  const reloadSite = useCallback(() => refreshSite({ silent: true }), [refreshSite]);

  return {
    site,
    website,
    pages,
    page,
    selectedPageId,
    /** Changes with every freshly opened page: the shell clears its selection on it. */
    seededPageId,
    openPage: setSelectedPageId,

    sections,
    look,
    lookBaseline,
    treeMeta,
    setTreeMeta,
    setSections,
    updateLook,
    revertLook,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,

    pageDirty,
    lookDirty,
    appearanceDirty,
    shellDirty,
    settingsUsage,

    saveState: autosave.state,
    saveError,
    flush,
    saveLook,
    savingLook,
    lookError,
    lookSaves,

    createPage,
    deletePage,
    saveSeo,
    publish,
    reloadSite,
  };
}

export type EditorDocument = ReturnType<typeof useEditorDocument>;
