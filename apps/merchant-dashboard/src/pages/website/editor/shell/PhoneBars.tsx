import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import {
  IconCaretDown,
  IconCollapse,
  IconEdit,
  IconExpand,
  IconPlus,
  IconSections,
  IconTheme,
  type IconComponent,
} from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { fmt, useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";

/**
 * The phone's bottom bar (below lg): the three things a thumb needs while the
 * store fills the screen — «الأقسام» (the section list, as a sheet),
 * «ضيف قسم» (the library sheet) and «الشكل» (the store look, as a sheet).
 *
 * While something is selected and its sheet is down, a pill floats over the
 * bar naming it: one tap brings the inspector back up.
 *
 * Material (frost, rim) is in glass/editor.css, `[shell]`.
 */
export function PhoneDock({
  onSections,
  onAdd,
  onLook,
  edit,
}: {
  onSections: () => void;
  onAdd: () => void;
  onLook: () => void;
  /** What is selected, when its inspector is closed. */
  edit: { label: string; onOpen: () => void } | null;
}) {
  const t = useT(SHELL_STRINGS);
  return (
    <nav
      data-slot="editor-dock"
      aria-label={t.dock}
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
            <span className="truncate">{fmt(t.dockEdit, { name: edit.label })}</span>
          </button>
        </div>
      )}
      <div className="mx-auto grid max-w-md grid-cols-3 items-stretch gap-2">
        <DockButton icon={IconSections} label={t.dockSections} onClick={onSections} />
        <DockButton icon={IconPlus} label={t.dockAdd} onClick={onAdd} lead />
        <DockButton icon={IconTheme} label={t.dockLook} onClick={onLook} />
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
  /** The middle one: its glyph sits in a tinted bead. */
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

/** Dragged this far down, the panel steps down (tall → half → away); this far up, it grows. */
const DRAG_DOWN_PX = 90;
const DRAG_UP_PX = 40;

const STRIP_BUTTON =
  "relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-sunken text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-2 before:content-[''] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/**
 * The inspector on a phone: a bottom sheet that rises over the lower 45% of
 * the screen, so the store stays in view above it — and stays ALIVE: this
 * sheet does not dim or lock the page. A tap on another section swaps what it
 * shows, a double-tap on a text still types in place, and the selected
 * section's own bar can be used while the fields are open. (The shared Sheet
 * is a modal dialog; a sheet that locked the store would make each of those
 * two taps instead of one, so this one is its own small pane that only looks
 * like one: same slot names, so glass/sheet.css gives it the same material.)
 *
 * The strip on top is the handle: drag it up for 90% of the screen, down to
 * step back (and then away); the two buttons on it do the same. Putting it
 * away keeps the selection — the bottom bar offers it again. The panel inside
 * has its own header with the name, «…» and a close that lets go of it.
 *
 * It takes no focus when it opens, so typing in the store is never cut short.
 * Heights are switched, not animated; it enters on the house spring
 * (`shell-sheet-up`, glass/editor.css) and follows the finger by `translate`.
 */
export function PhoneInspectorSheet({
  title,
  onHide,
  children,
}: {
  /** What is being edited, for screen readers. */
  title: string;
  /** Put away, selection kept. */
  onHide: () => void;
  children: ReactNode;
}) {
  const t = useT(SHELL_STRINGS);
  const [tall, setTall] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; startY: number; dy: number } | null>(null);
  const TallIcon = tall ? IconCollapse : IconExpand;

  function stepDown() {
    if (tall) setTall(false);
    else onHide();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    drag.current = { id: event.pointerId, startY: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    const node = panel.current;
    if (!current || current.id !== event.pointerId || !node) return;
    current.dy = event.clientY - current.startY;
    // It follows the finger down; pulled up, it stays and grows on release.
    node.style.transition = "none";
    node.style.translate = `0 ${Math.max(0, current.dy)}px`;
  }

  function settle(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const node = panel.current;
    if (node) {
      node.style.transition = "";
      node.style.translate = "";
    }
    if (cancelled) return;
    if (current.dy > DRAG_DOWN_PX) stepDown();
    else if (current.dy < -DRAG_UP_PX) setTall(true);
  }

  return (
    <section
      ref={panel}
      data-slot="sheet"
      data-side="bottom"
      data-peek=""
      aria-label={title}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[1.75rem] bg-paper-raised pb-[env(safe-area-inset-bottom)] text-ink shadow-[var(--shadow-pop)] ring-1 ring-line",
        "animate-[shell-sheet-up_var(--dur-move)_var(--ease-spring)_both] transition-[translate] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:animate-none motion-reduce:transition-none",
        tall ? "h-[90dvh]" : "h-[45dvh]"
      )}
    >
      <div
        data-slot="sheet-header"
        className="relative flex h-9 shrink-0 touch-none items-center justify-between px-3 select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => settle(event, false)}
        onPointerCancel={(event) => settle(event, true)}
      >
        <button
          type="button"
          aria-pressed={tall}
          aria-label={tall ? t.sheetShrink : t.sheetGrow}
          title={tall ? t.sheetShrink : t.sheetGrow}
          onClick={() => setTall((value) => !value)}
          className={STRIP_BUTTON}
        >
          <TallIcon className="size-4" aria-hidden />
        </button>
        <span
          aria-hidden
          data-slot="sheet-handle"
          className="pointer-events-none absolute inset-x-0 top-2 mx-auto h-[5px] w-9 rounded-full bg-line-strong/60"
        />
        <button type="button" aria-label={t.sheetHide} title={t.sheetHide} onClick={onHide} className={STRIP_BUTTON}>
          <IconCaretDown className="size-4" aria-hidden />
        </button>
      </div>
      <div data-slot="editor-peek-body" className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line">
        {children}
      </div>
    </section>
  );
}

/**
 * Below lg the side panels are sheets (the shared Sheet: a bottom sheet on a
 * phone, a centred pane from 640px):
 *
 *  - «أقسام الصفحة»: the section list;
 *  - «شكل المتجر»: the store look, with its two actions pinned under it while
 *    it has changes (the look goes live when saved, so it is never saved for
 *    the merchant);
 *  - «لوّنه بهويتك»: the first-run step — the ready styles alone, in a short
 *    sheet, so the store stays in view above it while a style is tried on.
 */
export function PhoneSheets({
  sectionsOpen,
  onSectionsOpenChange,
  sectionList,
  lookOpen,
  onLookOpenChange,
  lookPanel,
  brandOpen,
  onBrandOpenChange,
  presets,
  lookDirty,
  savingLook,
  onSaveLook,
  onRevertLook,
}: {
  sectionsOpen: boolean;
  onSectionsOpenChange: (open: boolean) => void;
  sectionList: ReactNode;
  lookOpen: boolean;
  onLookOpenChange: (open: boolean) => void;
  lookPanel: ReactNode;
  brandOpen: boolean;
  onBrandOpenChange: (open: boolean) => void;
  presets: ReactNode;
  lookDirty: boolean;
  savingLook: boolean;
  onSaveLook: () => void;
  onRevertLook: () => void;
}) {
  const t = useT(SHELL_STRINGS);
  const saveLook = (
    <Button type="button" variant="secondary" className="rounded-full px-5" disabled={savingLook} onClick={onSaveLook}>
      {savingLook ? t.lookSaving : t.lookSave}
    </Button>
  );
  return (
    <>
      <Sheet open={sectionsOpen} onOpenChange={onSectionsOpenChange} title={t.sectionsSheet} size="md">
        {sectionList}
      </Sheet>

      <Sheet
        open={lookOpen}
        onOpenChange={onLookOpenChange}
        title={t.lookTitle}
        description={t.lookHint}
        size="md"
        footer={
          lookDirty ? (
            <>
              <Button type="button" variant="outline" className="rounded-full px-5" disabled={savingLook} onClick={onRevertLook}>
                {t.lookRevert}
              </Button>
              {saveLook}
            </>
          ) : undefined
        }
      >
        {lookPanel}
      </Sheet>

      <Sheet
        open={brandOpen}
        onOpenChange={onBrandOpenChange}
        title={t.guideBrand}
        description={t.brandHint}
        side="bottom"
        size="md"
        // glass/editor.css keeps the page behind this one bright.
        className="zimos-editor-peek"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-5"
              onClick={() => {
                onBrandOpenChange(false);
                onLookOpenChange(true);
              }}
            >
              {t.brandMore}
            </Button>
            {lookDirty && saveLook}
          </>
        }
      >
        {presets}
      </Sheet>
    </>
  );
}
