import { cn } from "@store-builder/ui";
import { IconEdit, IconPlus, IconSections, IconSliders, type IconComponent } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "../../website/editor/shell/shellStrings";
import { STEP_PAGE_STRINGS } from "./strings";

/**
 * The bottom bar of a step's page in a box as narrow as a phone — the store
 * editor's dock (shell/PhoneBars.tsx, `PhoneDock`) with the funnel's third
 * slot: «الأقسام» (the section list, as a sheet), «ضيف قسم» (the library
 * sheet) and «الإعدادات» (this page's settings) where the store editor has
 * the store's look, which a funnel step does not own.
 *
 * While something is selected and its sheet is down, the same pill floats
 * over the bar naming it — «عدّل: …» — and one tap brings the inspector up.
 *
 * It wears PhoneDock's slots (`editor-dock`, `editor-dock-edit`, `data-lead`),
 * so glass/editor.css gives it the same material. (PhoneDock itself could not
 * be used: its third button is fixed to the store look.)
 */
export function StepDock({
  onSections,
  onAdd,
  onSettings,
  edit,
}: {
  onSections: () => void;
  onAdd: () => void;
  /** Left out where the page has no settings (a split-test version): the bar has two buttons. */
  onSettings?: () => void;
  /** What is selected, when its inspector is closed. */
  edit: { label: string; onOpen: () => void } | null;
}) {
  const t = useT(STEP_PAGE_STRINGS);
  const shell = useT(SHELL_STRINGS);
  return (
    <nav
      data-slot="editor-dock"
      aria-label={shell.dock}
      className="relative z-10 shrink-0 border-t border-line bg-paper-raised px-3 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      {edit && (
        <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center px-3 pb-2">
          <button
            type="button"
            data-slot="editor-dock-edit"
            onClick={edit.onOpen}
            className="pointer-events-auto flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-paper-raised shadow-[var(--shadow-raised)] transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
          >
            <IconEdit className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{fmt(shell.dockEdit, { name: edit.label })}</span>
          </button>
        </div>
      )}
      <div className={cn("mx-auto grid max-w-md items-stretch gap-2", onSettings ? "grid-cols-3" : "grid-cols-2")}>
        <DockButton icon={IconSections} label={shell.dockSections} onClick={onSections} />
        <DockButton icon={IconPlus} label={shell.dockAdd} onClick={onAdd} lead />
        {onSettings && <DockButton icon={IconSliders} label={t.dockSettings} onClick={onSettings} />}
      </div>
    </nav>
  );
}

function DockButton({
  icon: Glyph,
  label,
  onClick,
  lead = false,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  /** The one that adds: its glyph sits in a tinted bead. */
  lead?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-lead={lead || undefined}
      className="group flex min-h-12 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] leading-4 font-medium text-ink-soft transition-[scale,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
    >
      <span
        className={cn(
          "flex h-7 items-center justify-center rounded-full",
          lead ? "w-12 bg-primary-soft text-primary-dark dark:text-primary" : "w-7"
        )}
      >
        <Glyph className="size-[22px]" aria-hidden />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
