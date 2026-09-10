import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Rocket, Save } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type {
  CreateWebsitePagePayload,
  PageSection,
  PageTree,
  PublishProblem,
  WebsitePage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { BlockLibrary } from "./BlockLibrary";
import { SectionCard } from "./SectionCard";
import { SectionInspector } from "./SectionInspector";
import { NewPageDialog } from "./NewPageDialog";
import { PageTabs } from "./PageTabs";
import { createSection, moveSection, normalizeTree, sectionLabel, type BlockPreset } from "./blocks";

/**
 * The website editor: pick a page, reorder its sections by drag, edit their
 * content, save. Pages can be added and removed from the tab strip above the
 * canvas.
 *
 * `draftData` is the only field written back on save. The rest of the tree —
 * `version`, any `globalStyles` — is carried through verbatim: this editor has
 * no styling controls, and dropping keys it can't edit would silently destroy
 * template data.
 */

/**
 * The pre-publish check's 422 body. Its `details[]` is page-scoped
 * (`{ field, message, pageId?, path? }`) rather than the flat form-field shape
 * `getFieldErrors` expects, so it is unpacked here instead.
 */
function publishProblemsOf(err: unknown): PublishProblem[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  const body = err.details as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return [];
  return (details as PublishProblem[]).filter(
    (d) => d && typeof d.message === "string"
  );
}

/** Which page the editor opens by default, and falls back to after a delete. */
function pickEditablePage(pages: WebsitePage[]): WebsitePage | null {
  if (pages.length === 0) return null;
  return (
    pages.find((p) => p.pageType === "home") ?? pages.find((p) => p.path === "/") ?? pages[0]
  );
}

export function WebsiteEditorPage() {
  const { websiteId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const site = useAsync(
    () => apiClient.getWebsite(workspaceId, websiteId),
    [workspaceId, websiteId]
  );

  const pages = site.data?.pages ?? [];

  // Which page is open. Adjusted during render (below) whenever it no longer
  // names a real page — on first load, and after the open page is deleted.
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  if (pages.length > 0 && !pages.some((p) => p.id === selectedPageId)) {
    setSelectedPageId(pickEditablePage(pages)!.id);
  }
  const page = pages.find((p) => p.id === selectedPageId) ?? null;

  // Editing state. `baseline` is the tree as last loaded/saved — the dirty
  // check compares against it rather than tracking every mutation.
  const [sections, setSections] = useState<PageSection[]>([]);
  const [baseline, setBaseline] = useState<string>("[]");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Publishing. A failed publish comes back with a *list* of problems (one per
  // offending page), so they get their own state rather than sharing saveError.
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishProblems, setPublishProblems] = useState<PublishProblem[]>([]);

  // Page-level dialogs.
  const [showNewPage, setShowNewPage] = useState(false);
  const [pendingPageDelete, setPendingPageDelete] = useState<WebsitePage | null>(null);
  /** Page the merchant asked to switch to while the canvas had unsaved edits. */
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);

  // Everything in the tree the editor doesn't touch, preserved across a save.
  const [treeMeta, setTreeMeta] = useState<Omit<PageTree, "sections">>({ version: 1 });

  // Seed the editing state from the loaded page, adjusting state during render
  // (React's documented pattern for "reset state when a prop changes") rather
  // than in an effect, which would render once with the previous page's tree.
  //
  // Keyed on the page id we last seeded from, NOT on the page object: a save
  // swaps a fresh page object into `site.data`, and re-seeding on that would
  // wipe the merchant's current selection every time they save.
  const [seededPageId, setSeededPageId] = useState<string | null>(null);
  if (page && page.id !== seededPageId) {
    const { sections: loaded, ...meta } = normalizeTree(page.draftData);
    setSeededPageId(page.id);
    setSections(loaded);
    setTreeMeta(meta);
    setBaseline(JSON.stringify(loaded));
    setSelectedId(null);
    setSaveError(null);
  }

  const dirty = JSON.stringify(sections) !== baseline;

  // Browsers only honour this on a real user gesture, but it's the standard
  // guard against losing an unsaved tree to a refresh or a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const sensors = useSensors(
    // A small distance threshold so a click on the handle still selects rather
    // than starting a phantom drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      return moveSection(prev, from, to);
    });
  }, [setSections]);

  function addBlock(preset: BlockPreset) {
    const section = createSection(preset);
    setSections((prev) => [...prev, section]);
    setSelectedId(section.id);
  }

  function updateSection(next: PageSection) {
    setSections((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  }

  function deleteSection(section: PageSection) {
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    setSelectedId((prev) => (prev === section.id ? null : prev));
    setPendingDelete(null);
  }

  /**
   * Switching pages throws away whatever is in the canvas, so an unsaved tree
   * has to be confirmed away first.
   */
  function requestPageSwitch(pageId: string) {
    if (pageId === selectedPageId) return;
    if (dirty) {
      setPendingSwitchId(pageId);
      return;
    }
    setSelectedPageId(pageId);
  }

  async function createPage(payload: CreateWebsitePagePayload) {
    const created = await apiClient.createPage(workspaceId, websiteId, payload);
    const detail = site.data;
    if (detail) site.setData({ ...detail, pages: [...detail.pages, created] });
    // Open it straight away — the canvas re-seeds off the new id.
    setSelectedPageId(created.id);
    setShowNewPage(false);
    toast.success(`"${created.title}" created.`);
  }

  async function deletePage(target: WebsitePage) {
    // The backend deletes any page, home included; this is the real guard, not
    // just the disabled button in the tab strip.
    if (target.pageType === "home") return;
    await apiClient.deletePage(workspaceId, websiteId, target.id);
    const detail = site.data;
    if (detail) {
      site.setData({ ...detail, pages: detail.pages.filter((p) => p.id !== target.id) });
    }
    // If that was the open page, the render-time check above reselects home.
    setPendingPageDelete(null);
    toast.success(`"${target.title}" deleted.`);
  }

  async function save() {
    if (!page) return;
    setSaving(true);
    setSaveError(null);
    const tree: PageTree = { ...treeMeta, sections };
    try {
      const updated = await apiClient.updateWebsitePage(workspaceId, websiteId, page.id, {
        draftData: tree,
      });
      // Re-baseline off what the server stored, not off what we sent.
      const { sections: saved } = normalizeTree(updated.draftData);
      setBaseline(JSON.stringify(saved));
      const detail = site.data;
      if (detail) {
        site.setData({
          ...detail,
          pages: detail.pages.map((p) => (p.id === updated.id ? updated : p)),
        });
      }
      toast.success("Page saved.");
    } catch (err) {
      // A malformed tree comes back as a 422 whose details name the node path
      // (e.g. "data.sections[1].rows"); surface that instead of a bare message.
      const fields = getFieldErrors(err);
      const detail = Object.entries(fields)
        .filter(([key]) => key.includes("["))
        .map(([key, message]) => `${key}: ${message}`)[0];
      setSaveError(detail ?? getErrorMessage(err));
      toast.error("Couldn't save the page.");
    } finally {
      setSaving(false);
    }
  }

  const website = site.data?.website;

  /**
   * Publishes the whole site. The server snapshots `draftData` as it is stored,
   * so this deliberately refuses to run while the canvas is dirty — publishing
   * unsaved edits would silently ship the *previous* content.
   */
  async function publish() {
    if (!website || dirty) return;
    setPublishing(true);
    setPublishError(null);
    setPublishProblems([]);
    try {
      const { website: published, revision } = await apiClient.publishWebsite(
        workspaceId,
        websiteId
      );
      const detail = site.data;
      if (detail) site.setData({ ...detail, website: published, publishedRevision: revision });
      toast.success(`Site published — revision ${revision.revisionNumber} is live.`);
    } catch (err) {
      // A 422 is the pre-publish check: it reports every problem at once, keyed
      // by page rather than by form field, so getFieldErrors can't flatten it.
      const problems = publishProblemsOf(err);
      if (problems.length > 0) {
        setPublishProblems(problems);
      } else {
        setPublishError(getErrorMessage(err));
      }
      toast.error("Couldn't publish the site.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-paper-raised px-6 py-4">
        <PageHeader
          title={website ? website.name : "Website editor"}
          titleMeta={page ? page.path : undefined}
          back={{ to: "/website", label: "Back to website" }}
          description={
            page
              ? `Editing "${page.title}". Drag sections to reorder, click one to edit its content.`
              : undefined
          }
          titleBadge={
            website && (
              <StatusBadge
                value={website.status}
                tone={
                  website.status === "published"
                    ? "success"
                    : website.status === "suspended"
                      ? "danger"
                      : "neutral"
                }
              />
            )
          }
          actions={
            <>
              {dirty && <span className="text-xs text-ink-soft">Unsaved changes</span>}
              <Button type="button" onClick={() => void save()} disabled={!page || !dirty || saving}>
                {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void publish()}
                disabled={!website || dirty || publishing}
                title={
                  dirty
                    ? "Save your changes first — publishing ships the last saved version."
                    : "Publish the saved draft of every page"
                }
              >
                {publishing ? (
                  <Spinner className="size-4" />
                ) : (
                  <Rocket className="size-4" aria-hidden />
                )}
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            </>
          }
        />
        {saveError && <Alert variant="danger">{saveError}</Alert>}
        {publishError && <Alert variant="danger">{publishError}</Alert>}
        {publishProblems.length > 0 && (
          <Alert variant="danger">
            <p className="font-medium">This site can&rsquo;t be published yet:</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {publishProblems.map((problem, i) => (
                <li key={`${problem.pageId ?? problem.field}-${i}`}>
                  {problem.path && <span className="font-medium">{problem.path}: </span>}
                  {problem.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataState
          loading={site.loading}
          error={site.error}
          empty={!site.data}
          emptyMessage="This site has no pages to edit yet."
          onRetry={() => site.refresh()}
        >
          <div className="flex h-full min-h-0 flex-col">
            <PageTabs
              pages={pages}
              selectedId={selectedPageId}
              onSelect={requestPageSwitch}
              onDelete={setPendingPageDelete}
              onAdd={() => setShowNewPage(true)}
            />

            <div className="flex min-h-0 flex-1">
              <aside className="hidden w-56 shrink-0 border-r border-line bg-paper-raised lg:block">
                <BlockLibrary onAdd={addBlock} />
              </aside>

              <main className="min-w-0 flex-1 overflow-y-auto bg-paper p-6">
                <div className="mx-auto max-w-2xl">
                  {!page ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-16 text-center text-sm text-ink-soft">
                      This site has no pages yet. Use “New page” above to add one.
                    </div>
                  ) : sections.length === 0 ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-16 text-center text-sm text-ink-soft">
                      This page is empty. Add a block from the left to get started.
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={sections.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {sections.map((section) => (
                            <SectionCard
                              key={section.id}
                              section={section}
                              selected={section.id === selectedId}
                              onSelect={() => setSelectedId(section.id)}
                              onDelete={() => setPendingDelete(section)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* The library lives in the sidebar on desktop; on small screens
                      it moves below the canvas so the editor stays usable. */}
                  <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper-raised lg:hidden">
                    <BlockLibrary onAdd={addBlock} />
                  </div>
                </div>
              </main>

              <aside className="hidden w-80 shrink-0 border-l border-line bg-paper-raised xl:block">
                {selected ? (
                  <SectionInspector
                    section={selected}
                    onChange={updateSection}
                    onDelete={() => setPendingDelete(selected)}
                    onClose={() => setSelectedId(null)}
                  />
                ) : (
                  <p className="px-4 py-6 text-sm text-ink-soft">
                    Select a section on the canvas to edit its content.
                  </p>
                )}
              </aside>
            </div>
          </div>
        </DataState>
      </div>

      {/* Below xl the panel can't sit beside the canvas, so it becomes an overlay. */}
      {selected && (
        <div className="fixed inset-y-0 right-0 z-30 w-80 max-w-full border-l border-line bg-paper-raised shadow-xl xl:hidden">
          <SectionInspector
            section={selected}
            onChange={updateSection}
            onDelete={() => setPendingDelete(selected)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this section?"
        description={
          pendingDelete
            ? `"${sectionLabel(pendingDelete)}" and its content will be removed from the page. Nothing is deleted until you save.`
            : undefined
        }
        confirmLabel="Delete section"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteSection(pendingDelete)}
      />

      <NewPageDialog
        open={showNewPage}
        onClose={() => setShowNewPage(false)}
        onCreate={createPage}
      />

      <ConfirmDialog
        open={pendingPageDelete !== null}
        title="Delete this page?"
        description={
          pendingPageDelete
            ? `"${pendingPageDelete.title}" (${pendingPageDelete.path}) and everything on it will be permanently deleted. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete page"
        destructive
        onCancel={() => setPendingPageDelete(null)}
        onConfirm={() => pendingPageDelete && deletePage(pendingPageDelete)}
      />

      <ConfirmDialog
        open={pendingSwitchId !== null}
        title="Leave without saving?"
        description="This page has changes you haven't saved. Switching pages will discard them."
        confirmLabel="Discard and switch"
        destructive
        onCancel={() => setPendingSwitchId(null)}
        onConfirm={() => {
          setSelectedPageId(pendingSwitchId);
          setPendingSwitchId(null);
        }}
      />
    </div>
  );
}
