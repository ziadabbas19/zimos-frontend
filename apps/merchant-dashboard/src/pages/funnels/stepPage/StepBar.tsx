import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@store-builder/ui";
import {
  IconArrowLeft,
  IconCaretDown,
  IconCaretLeft,
  IconCaretRight,
  IconCheck,
  IconDesktop,
  IconMoreActions,
  IconPhoneDevice,
  IconRedo,
  IconSections,
  IconSliders,
  IconTablet,
  IconUndo,
} from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { TOOL_BUTTON, type EditorMenuItem } from "../../website/editor/shell/EditorToolbar";
import { SHELL_STRINGS } from "../../website/editor/shell/shellStrings";
import type { EditorDevice } from "../../website/editor/shell/useEditorLayout";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import type { UiStep } from "../funnelAdapter";
import { StepIcon } from "../editor/funnelMeta";
import { STEP_PAGE_STRINGS } from "./strings";

// The row of the editor's menus: 36px under a mouse, 44px under a thumb (EditorToolbar's).
const MENU_ITEM =
  "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/**
 * The slim bar over a step's page. The funnel's own bar (name, save, publish)
 * is above it, so this one only says WHICH page is open and holds the page's
 * tools — one row, 48px, and it never wraps:
 *
 *  start   «الخريطة» (back to the flow map) · (wide) the sections panel's
 *          switch · (roomy) previous step · the step's name and type, which
 *          opens the list of the funnel's steps · (roomy) next step
 *  centre  (roomy) the device switch — in a box as narrow as a phone the
 *          phone IS the device
 *  end     undo / redo · «…» (page settings, light / dark, outlines, reload)
 *          · (wide) the editing panel's switch
 *
 * It wears the store editor's toolbar slot and tool buttons, so the glass
 * layer (glass/editor.css, `[shell]`) gives it the same material.
 */
export function StepBar({
  steps,
  step,
  onSelectStep,
  onBack,
  roomy,
  device,
  onDeviceChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  menu,
  panels,
}: {
  /** The funnel's pages in list order: what previous / next and the picker walk. */
  steps: UiStep[];
  step: UiStep;
  onSelectStep: (key: string) => void;
  onBack: () => void;
  /** The box has room for the device switch and the previous / next arrows. */
  roomy: boolean;
  device: EditorDevice;
  onDeviceChange: (device: EditorDevice) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** The «…» menu, in groups; a hairline is drawn between groups. */
  menu: EditorMenuItem[][];
  /** The two side panels' switches; null where the layout has no side panels. */
  panels: { start: boolean; onStart: () => void; end: boolean; onEnd: () => void } | null;
}) {
  const t = useT(STEP_PAGE_STRINGS);
  const shell = useT(SHELL_STRINGS);
  const { locale, dir } = useLocale();
  const types = STEP_TYPE_LABELS[locale];

  const index = steps.findIndex((s) => s.key === step.key);
  const previous = index > 0 ? steps[index - 1] : null;
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
  const many = steps.length > 1;
  const groups = menu.filter((group) => group.length > 0);

  const previousLabel = previous ? fmt(t.previousStep, { name: previous.name }) : t.firstStep;
  const nextLabel = next ? fmt(t.nextStep, { name: next.name }) : t.lastStep;

  const title = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark dark:text-primary">
        <StepIcon type={step.type} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col text-start leading-tight">
        <span className="truncate text-sm font-semibold text-ink" dir="auto">
          {step.name}
        </span>
        <span className="truncate text-[11px] text-ink-soft">{types[step.type]}</span>
      </span>
    </>
  );

  return (
    <header
      data-slot="editor-toolbar"
      data-step-bar=""
      role="group"
      aria-label={t.bar}
      className="relative z-10 flex h-12 shrink-0 items-center gap-0.5 border-b border-line bg-paper-raised px-1.5 pointer-coarse:h-14 md:gap-1.5 md:px-3"
    >
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-0.5 md:gap-1.5">
        <button
          type="button"
          onClick={onBack}
          title={t.backToMapHint}
          aria-label={t.backToMapHint}
          className="zimos-editor-tool inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full ps-2.5 pe-3 text-sm font-medium text-ink transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none pointer-coarse:h-11"
        >
          <IconArrowLeft className="size-5 shrink-0 rtl:-scale-x-100" aria-hidden />
          <span aria-hidden>{t.backToMap}</span>
        </button>

        {panels && (
          <button
            type="button"
            aria-pressed={panels.start}
            aria-label={panels.start ? shell.hideSectionsPanel : shell.showSectionsPanel}
            title={panels.start ? shell.hideSectionsPanel : shell.showSectionsPanel}
            onClick={panels.onStart}
            className={cn(TOOL_BUTTON, panels.start && "bg-paper-sunken text-ink")}
          >
            <IconSections className="size-5" aria-hidden />
          </button>
        )}

        {roomy && many && (
          <button
            type="button"
            aria-label={previousLabel}
            title={previousLabel}
            disabled={!previous}
            onClick={() => previous && onSelectStep(previous.key)}
            className={TOOL_BUTTON}
          >
            <IconCaretLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        )}

        {many ? (
          <DirectionProvider direction={dir}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    data-slot="editor-page-pill"
                    aria-label={fmt(t.stepPicker, { name: step.name })}
                    className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-full bg-paper-sunken ps-1.5 pe-2.5 transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none pointer-coarse:h-11"
                  />
                }
              >
                {title}
                <IconCaretDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                sideOffset={8}
                className="max-h-[min(24rem,70dvh)] w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 overflow-y-auto rounded-[1.125rem] p-1.5"
              >
                {steps.map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    onClick={() => {
                      if (s.key !== step.key) onSelectStep(s.key);
                    }}
                    className={MENU_ITEM}
                  >
                    <StepIcon type={s.type} className="size-[18px] shrink-0 text-ink-soft" />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm text-ink" dir="auto">
                        {s.name}
                      </span>
                      <span className="truncate text-xs text-ink-soft">{types[s.type]}</span>
                    </span>
                    {s.key === step.key && <IconCheck className="size-4 shrink-0 text-primary-dark dark:text-primary" aria-hidden />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </DirectionProvider>
        ) : (
          <div className="flex h-10 min-w-0 items-center gap-2 ps-1.5 pe-2.5">{title}</div>
        )}

        {roomy && many && (
          <button
            type="button"
            aria-label={nextLabel}
            title={nextLabel}
            disabled={!next}
            onClick={() => next && onSelectStep(next.key)}
            className={TOOL_BUTTON}
          >
            <IconCaretRight className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        )}
      </div>

      {roomy && (
        <Segmented<EditorDevice>
          value={device}
          onChange={onDeviceChange}
          label={shell.device}
          size="sm"
          options={[
            { value: "phone", label: shell.devicePhone, icon: IconPhoneDevice },
            { value: "tablet", label: shell.deviceTablet, icon: IconTablet },
            { value: "desktop", label: shell.deviceDesktop, icon: IconDesktop },
          ]}
          // Icons alone: the words stay for a screen reader (the funnel's bar above already took the room).
          className="inline-grid shrink-0 [&_[role=radio]>span]:sr-only"
        />
      )}

      <div className={cn("flex shrink-0 items-center justify-end gap-0.5 md:gap-1.5", roomy && "flex-1 basis-0")}>
        <span className="flex items-center">
          <button type="button" aria-label={shell.undo} title={shell.undo} disabled={!canUndo} onClick={onUndo} className={TOOL_BUTTON}>
            <IconUndo className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" aria-label={shell.redo} title={shell.redo} disabled={!canRedo} onClick={onRedo} className={TOOL_BUTTON}>
            <IconRedo className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </span>

        {groups.length > 0 && (
          <DirectionProvider direction={dir}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" aria-label={shell.more} title={shell.more} className={TOOL_BUTTON} />}>
                <IconMoreActions className="size-5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={8}
                className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5"
              >
                {groups.map((group, groupIndex) => (
                  <Fragment key={group[0].id}>
                    {groupIndex > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                    {group.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          disabled={item.disabled === true}
                          onClick={() => {
                            if (item.disabled !== true) item.onSelect();
                          }}
                          className={MENU_ITEM}
                        >
                          <ItemIcon className="size-[18px] text-ink-soft" aria-hidden />
                          <span className="min-w-0 flex-1">{item.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </DirectionProvider>
        )}

        {panels && (
          <button
            type="button"
            aria-pressed={panels.end}
            aria-label={panels.end ? shell.hideEditPanel : shell.showEditPanel}
            title={panels.end ? shell.hideEditPanel : shell.showEditPanel}
            onClick={panels.onEnd}
            className={cn(TOOL_BUTTON, panels.end && "bg-paper-sunken text-ink")}
          >
            <IconSliders className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
