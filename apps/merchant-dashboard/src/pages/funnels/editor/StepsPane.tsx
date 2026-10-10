import { useState } from "react";
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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconCopy,
  IconDelete,
  IconDragHandle,
  IconDraft,
  IconEdit,
  IconInfo,
  IconMoreActions,
  IconPlus,
  IconPushLeft,
  IconWarning,
} from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import type { FunnelProblem } from "@store-builder/api-client";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import type { UiFunnel, UiStep, UiStepType } from "../funnelAdapter";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import { GenericPagesPanel } from "../GenericPagesPanel";
import { flowSteps, type GenericPreset } from "../genericPageRules";
import { PANE_STRINGS } from "../panes/paneStrings";
import { StepTypePicker, StepTypeTile } from "../panes/StepTypePicker";

// The step-type menu list lives with the picker (panes/StepTypePicker.tsx);
// the flow map imports it from here, as the split left it.
export { StepTypeList, type StepTypeListProps } from "../panes/StepTypePicker";

// ------------------------------------------------------------- left pane --

/** Where the "dragging only reorders the list" note is remembered as read, per browser. */
const REORDER_NOTE_KEY = "zimos:funnel-editor:reorder-note-read";

function readNoteSeen(): boolean {
  try {
    return window.localStorage.getItem(REORDER_NOTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** The inspector's name field (editor/StepInspector.tsx) — where "Rename" sends the keyboard by default. */
const NAME_FIELD_ID = "step-name";

export interface StepsPaneProps {
  /** The funnel as it is being edited: its path steps fill the list, its off-path pages the panel below. */
  funnel: UiFunnel;
  /** The selected step's key, or null. */
  selectedKey: string | null;
  /** What stops each step from publishing, by step key (the count shows on the row). */
  problemsByStep: Map<string, FunnelProblem[]>;
  /** Desktop only: true hides the pane (the page shows a rail in its place). */
  collapsed: boolean;
  /** The pane's collapse button was pressed. */
  onCollapse: () => void;
  /** A type picked from "Add step". */
  onAddStep: (type: UiStepType) => void;
  /** A row was clicked. */
  onSelectStep: (key: string) => void;
  /** Delete was pressed on a row or on a generic page (the page asks to confirm). */
  onDeleteStep: (step: UiStep) => void;
  /** A row was dragged onto another: move the first to the second's place. */
  onReorder: (activeKey: string, overKey: string) => void;
  /** A generic page (contact, about, policies, blank) was added from the panel. */
  onAddGenericPage: (preset: GenericPreset, name: string, body: string) => void;
  /** Open a step's page in the page editor. */
  onOpenPage: (key: string) => void;
  /**
   * "Rename" in a row's menu. Left out, the row selects its step and puts the
   * keyboard in the inspector's name field.
   */
  onRenameStep?: (step: UiStep) => void;
  /** "Duplicate" in a row's menu (funnelFlow.ts `duplicateStep`). Left out, the menu has no such line. */
  onDuplicateStep?: (step: UiStep) => void;
  /** True drops the pane's own collapse button (a shell that draws its own, or a phone sheet). Default false. */
  hideCollapse?: boolean;
}

/**
 * The steps of the path as a sortable list, with the funnel's other pages
 * under it. It fills the box it is given — a side pane on a desktop, a bottom
 * sheet on a phone — and scrolls inside it.
 */
export function StepsPane({
  funnel,
  selectedKey,
  problemsByStep,
  collapsed,
  onCollapse,
  onAddStep,
  onSelectStep,
  onDeleteStep,
  onReorder,
  onAddGenericPage,
  onOpenPage,
  onRenameStep,
  onDuplicateStep,
  hideCollapse = false,
}: StepsPaneProps) {
  const t = useT(PANE_STRINGS);
  const [noteSeen, setNoteSeen] = useState(readNoteSeen);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const steps = flowSteps(funnel.steps, funnel.edges);

  function onSortEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  function dismissNote() {
    setNoteSeen(true);
    try {
      window.localStorage.setItem(REORDER_NOTE_KEY, "1");
    } catch {
      // Storage blocked: the note is gone for this visit only.
    }
  }

  function rename(step: UiStep) {
    if (onRenameStep) {
      onRenameStep(step);
      return;
    }
    onSelectStep(step.key);
    // The inspector mounts (or its sheet rises) after this render: reach for its name field once it is there.
    window.setTimeout(() => {
      const field = document.getElementById(NAME_FIELD_ID);
      if (field instanceof HTMLInputElement) {
        field.focus();
        field.select();
      }
    }, 160);
  }

  return (
    <aside
      data-slot="funnel-steps-pane"
      aria-label={t.steps}
      className={cn("zimos-funnel-pane flex h-full min-h-0 w-full min-w-0 flex-col", collapsed && "lg:hidden")}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-ink">
          <span className="truncate">{t.steps}</span>
          <bdi className="zimos-funnel-count inline-flex min-w-6 items-center justify-center rounded-full bg-paper-sunken px-1.5 py-0.5 text-xs font-medium text-ink-soft tabular-nums">
            {fmt("{n}", { n: steps.length })}
          </bdi>
        </h2>
        <AddStepMenu onAdd={onAddStep} />
        {!hideCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t.collapse}
            title={t.collapse}
            className="zimos-funnel-icon-button hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none lg:inline-flex"
          >
            <IconPushLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-2 pb-2">
          {steps.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-soft">{t.noSteps}</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onSortEnd}>
              <SortableContext items={steps.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1">
                  {steps.map((s) => (
                    <SortableStepRow
                      key={s.key}
                      step={s}
                      selected={s.key === selectedKey}
                      problemCount={problemsByStep.get(s.key)?.length ?? 0}
                      onSelect={() => onSelectStep(s.key)}
                      onDelete={() => onDeleteStep(s)}
                      onOpenPage={() => onOpenPage(s.key)}
                      onRename={() => rename(s)}
                      onDuplicate={onDuplicateStep ? () => onDuplicateStep(s) : undefined}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          {steps.length > 1 && !noteSeen && (
            <p className="mt-2 flex items-start gap-2 px-2 text-xs leading-5 text-ink-soft">
              <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                {t.reorderNote}{" "}
                <button
                  type="button"
                  onClick={dismissNote}
                  className="relative cursor-pointer font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:before:absolute pointer-coarse:before:-inset-3 pointer-coarse:before:content-['']"
                >
                  {t.reorderNoteOk}
                </button>
              </span>
            </p>
          )}
        </div>
        <GenericPagesPanel funnel={funnel} selectedKey={selectedKey} onAdd={onAddGenericPage} onOpen={onOpenPage} onDelete={onDeleteStep} />
      </div>
    </aside>
  );
}

export interface AddStepMenuProps {
  /** A type was picked from the menu. */
  onAdd: (type: UiStepType) => void;
}

/** "Add step": the nine step types, each with a line saying what it is for. A menu on a desktop, a sheet on a phone. */
export function AddStepMenu({ onAdd }: AddStepMenuProps) {
  const t = useT(PANE_STRINGS);
  return (
    <StepTypePicker
      title={t.addStepTitle}
      description={t.addStepHint}
      onPick={onAdd}
      trigger={
        <button
          type="button"
          className="zimos-funnel-add inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:min-h-11"
        >
          <IconPlus className="size-4" aria-hidden />
          {t.addStep}
        </button>
      }
    />
  );
}

export interface SortableStepRowProps {
  /** The step this row stands for. */
  step: UiStep;
  /** True when this step is the selected one. */
  selected: boolean;
  /** How many problems stop this step from publishing (0 hides the badge). */
  problemCount: number;
  /** The row was clicked. */
  onSelect: () => void;
  /** "Delete" in the row's menu. */
  onDelete: () => void;
  /** "Open the page" in the row's menu. Left out, the menu has no such line. */
  onOpenPage?: () => void;
  /** "Rename" in the row's menu. Left out, the menu has no such line. */
  onRename?: () => void;
  /** "Duplicate" in the row's menu. Left out, the menu has no such line. */
  onDuplicate?: () => void;
}

/** One step in the list, 52px: drag handle, the type on its tile, name with type, problem count, and a menu. */
export function SortableStepRow({ step, selected, problemCount, onSelect, onDelete, onOpenPage, onRename, onDuplicate }: SortableStepRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.key });
  const t = useT(PANE_STRINGS);
  const { locale } = useLocale();
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-slot="funnel-step-row"
      data-selected={selected ? "" : undefined}
      data-dragging={isDragging ? "" : undefined}
      className={cn(
        "zimos-funnel-step-row relative flex min-h-[52px] items-center rounded-[0.875rem] text-ink",
        selected ? "bg-primary-soft ring-1 ring-primary/40" : "hover:bg-paper-sunken",
        isDragging && "z-10 bg-paper-raised shadow-[var(--shadow-raised)] ring-1 ring-line"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={fmt(t.reorder, { name: step.name })}
        className="zimos-funnel-row-quiet flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-[0.75rem] text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:cursor-grabbing pointer-coarse:w-11"
      >
        <IconDragHandle className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[0.75rem] py-1.5 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <StepTypeTile type={step.type} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-medium" dir="auto">
            {step.name}
          </span>
          <span className="zimos-funnel-row-quiet block truncate text-xs leading-4 text-ink-soft">{STEP_TYPE_LABELS[locale][step.type]}</span>
        </span>
        {problemCount > 0 && (
          <span
            title={fmt(t.toFix, { n: problemCount })}
            className="zimos-funnel-row-badge inline-flex shrink-0 items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-xs font-medium text-danger"
          >
            <IconWarning className="size-3.5" aria-hidden />
            <bdi aria-hidden>{fmt("{n}", { n: problemCount })}</bdi>
            <span className="sr-only">{fmt(t.toFix, { n: problemCount })}</span>
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={fmt(t.rowMenu, { name: step.name })}
              className="zimos-funnel-row-quiet flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            />
          }
        >
          <IconMoreActions className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {onOpenPage && (
            <DropdownMenuItem className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={onOpenPage}>
              <IconDraft className="size-4" aria-hidden />
              {t.openPage}
            </DropdownMenuItem>
          )}
          {onRename && (
            <DropdownMenuItem className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={onRename}>
              <IconEdit className="size-4" aria-hidden />
              {t.rename}
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={onDuplicate}>
              <IconCopy className="size-4" aria-hidden />
              {t.duplicate}
            </DropdownMenuItem>
          )}
          {(onOpenPage || onRename || onDuplicate) && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={onDelete}>
            <IconDelete className="size-4" aria-hidden />
            {t.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
