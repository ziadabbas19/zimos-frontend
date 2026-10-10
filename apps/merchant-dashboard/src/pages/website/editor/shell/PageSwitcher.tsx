import { useState } from "react";
import type { WebsitePage } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconCaretDown, IconHome, IconPage } from "@/components/icons";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { Sheet } from "@/components/Sheet";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageTabs } from "../PageTabs";
import { SHELL_STRINGS } from "./shellStrings";

/**
 * The toolbar's page switcher: a pill that names the open page and opens the
 * site's pages — a popover beside the pill on a wide screen, a bottom sheet on
 * a phone (`asSheet`). The list itself is PageTabs' `list` variant, the same
 * one the start panel's «الصفحات» tab shows.
 *
 * Below lg the pill also carries the save state as a second, smaller line
 * (`caption`): the toolbar has no room there to say it anywhere else.
 */
export function PageSwitcher({
  pages,
  page,
  onSelect,
  onDelete,
  onAdd,
  asSheet,
  caption,
  captionTone = "quiet",
}: {
  pages: WebsitePage[];
  page: WebsitePage | null;
  onSelect: (pageId: string) => void;
  onDelete: (page: WebsitePage) => void;
  onAdd: () => void;
  asSheet: boolean;
  /** Shown under the page's name below `lg`, where the toolbar has no room to say it. */
  caption?: string;
  captionTone?: "quiet" | "alert";
}) {
  const t = useT(SHELL_STRINGS);
  const [open, setOpen] = useState(false);
  if (!page) return null;

  const PageIcon = page.pageType === "home" ? IconHome : IconPage;
  const list = (
    <PageTabs
      variant="list"
      pages={pages}
      selectedId={page.id}
      onSelect={(pageId) => {
        setOpen(false);
        onSelect(pageId);
      }}
      onDelete={(target) => {
        setOpen(false);
        onDelete(target);
      }}
      onAdd={() => {
        setOpen(false);
        onAdd();
      }}
    />
  );

  const pill = (
    <button
      type="button"
      data-slot="editor-page-pill"
      aria-label={fmt(t.pageSwitcher, { name: page.title })}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={asSheet ? () => setOpen(true) : undefined}
      className="flex h-11 max-w-52 min-w-0 cursor-pointer items-center gap-1 rounded-full bg-paper-sunken ps-2.5 pe-2 text-start ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none md:h-10 md:gap-2 md:ps-3 md:pe-2.5 pointer-coarse:md:h-11"
    >
      <PageIcon className="hidden size-4 shrink-0 text-ink-soft md:block" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-[1.15rem] font-semibold text-ink md:text-sm md:leading-5">
          {page.title}
        </span>
        {caption && (
          <span
            className={cn(
              "block truncate text-[11px] leading-[0.95rem] lg:hidden",
              captionTone === "alert" ? "font-medium text-danger" : "text-ink-soft"
            )}
          >
            {caption}
          </span>
        )}
      </span>
      <IconCaretDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
    </button>
  );

  if (asSheet) {
    return (
      <>
        {pill}
        <Sheet open={open} onOpenChange={setOpen} title={t.pagesTitle} side="auto" size="sm">
          {list}
        </Sheet>
      </>
    );
  }

  return (
    <Popover
      trigger={pill}
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="start"
      label={t.pagesTitle}
      className="max-h-[min(70dvh,32rem)] w-80 overflow-y-auto p-2"
    >
      {list}
    </Popover>
  );
}
