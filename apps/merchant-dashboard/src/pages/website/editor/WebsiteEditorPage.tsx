import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Save } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type { PageSection, PageTree, WebsitePage } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { BlockLibrary } from "./BlockLibrary";
import { SectionCard } from "./SectionCard";
import { SectionInspector } from "./SectionInspector";
import { createSection, moveSection, normalizeTree, sectionLabel, type BlockPreset } from "./blocks";

/**
 * Phase 1 of the website editor: one page, sections reordered by drag, basic
 * content editing, save.
 *
 * The page it edits is the site's home page (`pageType: "home"`, else path
 * "/", else the first page) — there is no multi-page navigation yet, so the
 * other pages of a template are loaded but left untouched.
 *
 * `draftData` is the only field written back. The rest of the tree —
 * `version`, any `globalStyles` — is carried through verbatim: this editor has
 * no styling controls, and dropping keys it can't edit would silently destroy
 * template data.
 */

/** Which of a site's pages the editor opens. */
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

  const page = useMemo(() => pickEditablePage(site.data?.pages ?? []), [site.data]);

  // Editing state. `baseline` is the tree as last loaded/saved — the dirty
  // check compares against it rather than tracking every mutation.
  const [sections, setSections] = useState<PageSection[]>([]);
  const [baseline, setBaseline] = useState<string>("[]");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  }, []);

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
          actions={
            <>
              {dirty && <span className="text-xs text-ink-soft">Unsaved changes</span>}
              <Button type="button" onClick={() => void save()} disabled={!page || !dirty || saving}>
                {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        />
        {saveError && <Alert variant="danger">{saveError}</Alert>}
      </div>

      <div className="min-h-0 flex-1">
        <DataState
          loading={site.loading}
          error={site.error}
          empty={!page}
          emptyMessage="This site has no pages to edit yet."
          onRetry={() => site.refresh()}
        >
          <div className="flex h-full min-h-0">
            <aside className="hidden w-56 shrink-0 border-r border-line bg-paper-raised lg:block">
              <BlockLibrary onAdd={addBlock} />
            </aside>

            <main className="min-w-0 flex-1 overflow-y-auto bg-paper p-6">
              <div className="mx-auto max-w-2xl">
                {sections.length === 0 ? (
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
    </div>
  );
}
