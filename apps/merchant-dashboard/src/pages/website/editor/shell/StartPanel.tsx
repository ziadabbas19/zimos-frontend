import type { ReactNode } from "react";
import { Button } from "@store-builder/ui";
import { IconPage, IconPlus, IconSections } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";

export type StartTab = "sections" | "pages";

/**
 * The start zone on a wide screen (18rem): two tabs — the open page's
 * sections, and the site's pages — over one full-width «ضيف قسم» that opens
 * the library sheet (where the saved sections are too). The lists themselves
 * are LayerList and PageTabs; this is the frame around them.
 *
 * Shown and hidden from the toolbar (WebsiteEditorPage remembers which).
 */
export function StartPanel({
  tab,
  onTabChange,
  sections,
  pages,
  onAddSection,
}: {
  tab: StartTab;
  onTabChange: (tab: StartTab) => void;
  /** The section list (LayerList). It scrolls by itself. */
  sections: ReactNode;
  /** The page list (PageTabs, `list`). */
  pages: ReactNode;
  onAddSection: () => void;
}) {
  const t = useT(SHELL_STRINGS);
  return (
    <aside
      data-slot="editor-panel"
      data-side="start"
      aria-label={t.startPanel}
      className="flex w-72 shrink-0 flex-col border-e border-line bg-paper-raised"
    >
      <div className="shrink-0 px-3 pt-3 pb-2">
        <Segmented<StartTab>
          value={tab}
          onChange={onTabChange}
          label={t.panelTabs}
          size="sm"
          className="w-full"
          options={[
            { value: "sections", label: t.tabSections, icon: IconSections },
            { value: "pages", label: t.tabPages, icon: IconPage },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "sections" ? sections : <div className="px-3 pt-1 pb-3">{pages}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-line p-3">
        <Button type="button" variant="secondary" onClick={onAddSection} className="zimos-editor-soft h-11 min-w-0 flex-1 rounded-full">
          <IconPlus className="size-4" aria-hidden />
          <span className="truncate">{t.addSection}</span>
        </Button>
      </div>
    </aside>
  );
}
