import type { PageSection } from "@store-builder/api-client";
import { stepEdit, type CanvasEdit, type CanvasStep } from "@/lib/canvasDrag";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { createSection, insertSection, moveSection, sectionLabel, type BlockPreset } from "../blocks";
import { applyCanvasEdit, nudgeElement } from "../canvasEdits";
import { duplicateSection, sectionHidden, setElementText, setSectionHidden } from "../canvasTools";
import { useEditorLocale } from "../editorLocale";
import { SHELL_STRINGS } from "./shellStrings";
import { setElementField } from "./treeTools";
import type { EditorDocument } from "./useEditorDocument";

/** What the small bar on a selected section can ask for (StorefrontPreview's onSectionAction). */
export type SectionActionKind = "up" | "down" | "duplicate" | "hide" | "delete";

/**
 * Every edit the shell makes to the open page's sections — from the canvas,
 * the section list, the library and the inspector. Each goes through the
 * document's `setSections`, so each is one undo step (a burst of typing in
 * one section, or of arrow keys on one handle, folds into one).
 *
 * `onSelect` is told which section an edit produced or landed in (a new
 * block, a copy, the section an element was dragged into); `onDeselect` that
 * the selected one is gone.
 */
export function useSectionEdits({
  doc,
  selectedSectionId,
  onSelect,
  onDeselect,
}: {
  doc: EditorDocument;
  selectedSectionId: string | null;
  onSelect: (sectionId: string, how: { scroll: boolean }) => void;
  onDeselect: () => void;
}) {
  const locale = useEditorLocale();
  const t = useT(SHELL_STRINGS);
  const toast = useToast();
  const { sections, setSections } = doc;

  /** A drag or resize released on the canvas: one tree edit, one undo step. */
  function applyCanvas(edit: CanvasEdit, key?: string) {
    setSections((prev) => applyCanvasEdit(prev, edit), key);
    // Keep the moved element's section in the inspector.
    if (edit.kind === "move-element") {
      const owner = sections.find((s) =>
        (s.rows ?? []).some((r) => (r.columns ?? []).some((c) => c.id === edit.columnId))
      );
      if (owner && owner.id !== selectedSectionId) onSelect(owner.id, { scroll: false });
    }
  }

  /**
   * One arrow-key press on a canvas handle. Repeated presses on the same
   * handle fold into one undo step, like a burst of typing.
   */
  function stepCanvas(step: CanvasStep) {
    if (step.kind === "element") {
      setSections((prev) => nudgeElement(prev, step.sectionId, step.elementId, step.delta));
      return;
    }
    const edit = stepEdit(step);
    if (edit) applyCanvas(edit, `canvas:${step.kind}:${step.sectionId}`);
  }

  /** Double-click text editing on the page (canvasTools.ts): one undo step per edit. */
  function editText(elementId: string, text: string) {
    setSections((prev) => setElementText(prev, elementId, text));
  }

  /** Creates a section from `preset` and drops it at `index`, then selects and scrolls to it. */
  function addPreset(preset: BlockPreset, index: number) {
    const section = createSection(preset, locale);
    setSections((prev) => insertSection(prev, section, index));
    onSelect(section.id, { scroll: true });
  }

  /** A ready-made section (from the saved ones) at `index`; the end of the page when null. */
  function addSection(section: PageSection, index: number | null) {
    setSections((prev) => insertSection(prev, section, index ?? prev.length));
    onSelect(section.id, { scroll: true });
  }

  /** The list's drag and drop. */
  function move(from: number, to: number) {
    setSections((prev) => moveSection(prev, from, to));
  }

  /** Up / down from the canvas or the section's own bar — reorder without opening the list. */
  function moveBy(sectionId: string, direction: "up" | "down") {
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === sectionId);
      if (from === -1) return prev;
      return moveSection(prev, from, direction === "up" ? from - 1 : from + 1);
    });
  }

  /** The inspector's changes: one undo step per burst of typing in a section, not per keystroke. */
  function update(next: PageSection) {
    setSections((prev) => prev.map((s) => (s.id === next.id ? next : s)), `section:${next.id}`);
  }

  function duplicate(sectionId: string) {
    const source = sections.find((s) => s.id === sectionId);
    if (!source) return;
    const copy = duplicateSection(source);
    setSections((prev) => insertSection(prev, copy, prev.findIndex((s) => s.id === source.id) + 1));
    onSelect(copy.id, { scroll: true });
  }

  /**
   * Deleting a section is one undo step, so it is not asked about: it goes,
   * and a toast offers to put it back where it was (Ctrl/⌘+Z does the same).
   */
  function remove(section: PageSection) {
    const index = sections.findIndex((s) => s.id === section.id);
    if (index === -1) return;
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    if (selectedSectionId === section.id) onDeselect();
    toast.undo(fmt(t.sectionDeleted, { name: sectionLabel(section, locale) }), () => {
      // Already back (an undo from the keyboard): nothing to do.
      setSections((prev) => (prev.some((s) => s.id === section.id) ? prev : insertSection(prev, section, index)));
    });
  }

  /**
   * Hide / show. The tree has no hidden flag on a section; canvasTools.ts
   * hides every element in it the way the Style tab's "hide on this device"
   * does on the base device, which the store obeys.
   */
  function toggleHidden(sectionId: string) {
    const target = sections.find((s) => s.id === sectionId);
    if (!target) return;
    const hide = !sectionHidden(target);
    if (setSectionHidden(target, hide) === target) return;
    setSections((prev) => prev.map((s) => (s.id === sectionId ? setSectionHidden(s, hide) : s)));
    if (!hide) return;
    toast.undo(fmt(t.sectionHidden, { name: sectionLabel(target, locale) }), () => {
      setSections((prev) => prev.map((s) => (s.id === sectionId && sectionHidden(s) ? target : s)));
    });
  }

  /** The small bar a selected section carries in the preview. */
  function act(sectionId: string, action: SectionActionKind) {
    const target = sections.find((s) => s.id === sectionId);
    if (!target) return;
    switch (action) {
      case "up":
      case "down":
        moveBy(sectionId, action);
        break;
      case "duplicate":
        duplicate(sectionId);
        break;
      case "hide":
        toggleHidden(sectionId);
        break;
      case "delete":
        remove(target);
        break;
    }
  }

  /** The picture a click on the canvas replaces: the same tree edit a field change makes, one undo step. */
  function setImage(target: { sectionId: string; elementId: string; field: string }, url: string) {
    setSections((prev) => setElementField(prev, target.sectionId, target.elementId, target.field, url));
  }

  return { applyCanvas, stepCanvas, editText, addPreset, addSection, move, moveBy, update, duplicate, remove, toggleHidden, act, setImage };
}
