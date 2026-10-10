import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@store-builder/ui";
import {
  IconArrowLeft,
  IconCheck,
  IconDesktop,
  IconLaunch,
  IconMoreActions,
  IconPhoneDevice,
  IconRedo,
  IconSections,
  IconSliders,
  IconSpinner,
  IconTablet,
  IconUndo,
  IconWarning,
  type IconComponent,
} from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";
import type { SaveState } from "./useAutosave";
import type { EditorDevice } from "./useEditorLayout";

/** What the chip beside the site's name says. `changed` is a published site whose drafts moved on. */
export type SiteStatus = "published" | "draft" | "changed" | "suspended";

export interface EditorMenuItem {
  id: string;
  label: string;
  icon: IconComponent;
  onSelect: () => void;
  disabled?: boolean;
}

/** A round 40px button (44px under a finger) for the bar's icon actions. */
export const TOOL_BUTTON =
  "zimos-editor-tool inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 aria-expanded:bg-paper-sunken aria-expanded:text-ink motion-reduce:transition-none pointer-coarse:size-11";

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const MENU_ITEM =
  "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

const STATUS_TONE: Record<SiteStatus, "success" | "neutral" | "warning" | "danger"> = {
  published: "success",
  draft: "neutral",
  changed: "warning",
  suspended: "danger",
};

/**
 * The editor's one bar: 56px, one row, and it never wraps — what does not fit
 * a narrower screen is left out, not pushed onto a second line.
 *
 *  start   back to the sites · (lg) hide / show the sections panel · (xl) the
 *          site's name and its status · the page switcher
 *  centre  (md) the device switch — on a phone the phone IS the device
 *  end     undo / redo · (lg) the save state in words · «…» · (lg) hide / show
 *          the editing panel · «انشر», the one main button
 *
 * Material (the pane's glass and rim) is in glass/editor.css, `[shell]`.
 */
export function EditorToolbar({
  siteName,
  status,
  switcher,
  device,
  onDeviceChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveState,
  onSaveNow,
  menu,
  onPublish,
  publishDisabled = false,
  panels,
}: {
  siteName: string;
  status: SiteStatus | null;
  /** The page switcher (PageSwitcher), or null until the site has loaded. */
  switcher: ReactNode;
  device: EditorDevice;
  onDeviceChange: (device: EditorDevice) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveState: SaveState;
  /** ⌘S, and the "try again" of a failed save. */
  onSaveNow: () => void;
  /** The «…» menu, in groups; a hairline is drawn between groups. */
  menu: EditorMenuItem[][];
  onPublish: () => void;
  publishDisabled?: boolean;
  /** The two side panels' switches; null where the layout has no side panels (below lg). */
  panels: { start: boolean; onStart: () => void; end: boolean; onEnd: () => void } | null;
}) {
  const t = useT(SHELL_STRINGS);
  const { dir } = useLocale();
  const statusText: Record<SiteStatus, string> = {
    published: t.statusPublished,
    draft: t.statusDraft,
    changed: t.statusChanged,
    suspended: t.statusSuspended,
  };
  const groups = menu.filter((group) => group.length > 0);

  const saveWords =
    saveState === "failed" ? (
      <button
        type="button"
        onClick={onSaveNow}
        className="hidden min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-danger-soft px-3 text-xs font-medium whitespace-nowrap text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:inline-flex pointer-coarse:min-h-11"
      >
        <IconWarning className="size-4 shrink-0" aria-hidden />
        {t.saveFailed}
      </button>
    ) : (
      <span className="hidden items-center gap-1.5 px-1 text-xs whitespace-nowrap text-ink-soft lg:inline-flex">
        {saveState === "saving" ? (
          <IconSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <IconCheck className="size-4 shrink-0 text-success" aria-hidden />
        )}
        {saveState === "saving" ? t.saveSaving : saveState === "saved" ? t.saveSaved : t.saveIdle}
      </span>
    );

  return (
    <header
      data-slot="editor-toolbar"
      role="group"
      aria-label={t.toolbar}
      className="relative z-10 flex h-14 shrink-0 items-center gap-0.5 border-b border-line bg-paper-raised px-1.5 md:gap-2 md:px-3"
    >
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-0.5 md:gap-2">
        <Link to="/website" aria-label={t.back} title={t.back} className={TOOL_BUTTON}>
          <IconArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
        </Link>
        {panels && (
          <button
            type="button"
            aria-pressed={panels.start}
            aria-label={panels.start ? t.hideSectionsPanel : t.showSectionsPanel}
            title={panels.start ? t.hideSectionsPanel : t.showSectionsPanel}
            onClick={panels.onStart}
            className={cn(TOOL_BUTTON, panels.start && "bg-paper-sunken text-ink")}
          >
            <IconSections className="size-5" aria-hidden />
          </button>
        )}
        <h1 className="sr-only min-w-0 truncate font-display text-[15px] font-semibold text-ink xl:not-sr-only xl:max-w-40">
          {siteName}
        </h1>
        {status && (
          <StatusBadge value={status} text={statusText[status]} tone={STATUS_TONE[status]} className="hidden shrink-0 xl:inline-flex" />
        )}
        {switcher}
      </div>

      <Segmented<EditorDevice>
        value={device}
        onChange={onDeviceChange}
        label={t.device}
        size="sm"
        options={[
          { value: "phone", label: t.devicePhone, icon: IconPhoneDevice },
          { value: "tablet", label: t.deviceTablet, icon: IconTablet },
          { value: "desktop", label: t.deviceDesktop, icon: IconDesktop },
        ]}
        // Icons alone until there is room for the words; the words stay for a screen reader.
        className="hidden shrink-0 md:inline-grid [&_[role=radio]>span]:sr-only 2xl:[&_[role=radio]>span]:not-sr-only"
      />

      <div className="flex shrink-0 items-center justify-end gap-0.5 md:flex-1 md:basis-0 md:gap-1.5">
        <span className="flex items-center">
          <button type="button" aria-label={t.undo} title={t.undo} disabled={!canUndo} onClick={onUndo} className={TOOL_BUTTON}>
            <IconUndo className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" aria-label={t.redo} title={t.redo} disabled={!canRedo} onClick={onRedo} className={TOOL_BUTTON}>
            <IconRedo className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </span>

        <span role="status" aria-live="polite" className="contents">
          {saveWords}
        </span>

        <DirectionProvider direction={dir}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" aria-label={t.more} title={t.more} className={TOOL_BUTTON} />}>
              <IconMoreActions className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              sideOffset={8}
              className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5"
            >
              {groups.map((group, index) => (
                <Fragment key={group[0].id}>
                  {index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
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

        {panels && (
          <button
            type="button"
            aria-pressed={panels.end}
            aria-label={panels.end ? t.hideEditPanel : t.showEditPanel}
            title={panels.end ? t.hideEditPanel : t.showEditPanel}
            onClick={panels.onEnd}
            className={cn(TOOL_BUTTON, panels.end && "bg-paper-sunken text-ink")}
          >
            <IconSliders className="size-5" aria-hidden />
          </button>
        )}

        <Button
          type="button"
          onClick={onPublish}
          disabled={publishDisabled}
          className="ms-1 h-10 shrink-0 rounded-full px-3.5 pointer-coarse:h-11 md:ms-0 md:px-5"
        >
          <IconLaunch className="hidden size-4 md:block" aria-hidden />
          {t.publish}
        </Button>
      </div>
    </header>
  );
}
