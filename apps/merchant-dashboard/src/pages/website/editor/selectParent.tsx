import { useCallback, useEffect, useRef, useState } from "react";
import { IconCornerUp } from "@/components/icons";
import { Button } from "@store-builder/ui";
import type { PageSection } from "@store-builder/api-client";
import { columnTitle, sectionColumnCount, sectionLabel } from "./blocks";
import { editorUi, type EditorLocale } from "./editorLocale";

/**
 * "Select parent" (SPEC §9.3, the element menu) for the inspector. An
 * element's parent is its column when the section shows its columns (more
 * than one), else the section itself; a column's parent is the section.
 *
 * The inspector lists a section's whole tree at once, so "selecting" the
 * parent brings its controls into view, focuses them and outlines them for a
 * moment: the column's header, or the section's own settings at the top. The
 * nodes are found by `data-node-id`.
 */

export function parentOf(section: PageSection, nodeId: string, locale: EditorLocale): { id: string; label: string } | null {
  const ui = editorUi(locale);
  const sectionParent = { id: section.id, label: sectionLabel(section, locale) };
  const multiColumn = sectionColumnCount(section) > 1;
  let columnIndex = 0;
  for (const row of section.rows ?? []) {
    for (const column of row.columns ?? []) {
      const index = columnIndex++;
      if (column.id === nodeId) return sectionParent;
      if ((column.elements ?? []).some((el) => el.id === nodeId)) {
        return multiColumn ? { id: column.id, label: columnTitle(column) ?? ui.column(index + 1) } : sectionParent;
      }
    }
  }
  return null;
}

/** Brings a node of the inspector into view and outlines it briefly; `flashId` is the one outlined. */
export function useParentFocus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const focusNode = useCallback((id: string) => {
    const node = containerRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    if (!node) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    node.focus({ preventScroll: true });
    setFlashId(id);
  }, []);

  return { containerRef, flashId, focusNode };
}

export function SelectParentButton({ parent, locale, onSelect }: { parent: { id: string; label: string } | null; locale: EditorLocale; onSelect: (id: string) => void }) {
  if (!parent) return null;
  const label = editorUi(locale).selectParent(parent.label);
  return (
    <Button type="button" size="icon-sm" variant="ghost" aria-label={label} title={label} onClick={() => onSelect(parent.id)}>
      <IconCornerUp className="size-3.5 rtl:-scale-x-100" aria-hidden />
    </Button>
  );
}
