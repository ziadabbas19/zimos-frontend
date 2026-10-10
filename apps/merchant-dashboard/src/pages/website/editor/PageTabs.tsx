import type { Ref } from "react";
import { IconCheck, IconClose, IconDelete, IconHome, IconPage, IconPlus } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { WebsitePage } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    pages: "Pages",
    homeHint: "The home page can't be deleted — your store opens on it.",
    homeBadge: "Home",
    deletePage: "Delete “{name}”",
    newPage: "New page",
  },
  ar: {
    pages: "الصفحات",
    homeHint: "الصفحة الرئيسية لا تُحذف — متجرك يفتح عليها.",
    homeBadge: "الرئيسية",
    deletePage: "حذف «{name}»",
    newPage: "صفحة جديدة",
  },
} satisfies Messages;

/**
 * The site's pages, to switch between.
 *
 *  - `variant="list"` (the editor's page switcher and its «الصفحات» tab): one
 *    row per page — home marker, title, address — with the open one ticked, a
 *    delete button on every page but the home, and «صفحة جديدة» last. Rows are
 *    44px, so it works in a popover and in a phone sheet alike.
 *  - `variant="tabs"` (the default, as before): a horizontal strip. `inline`
 *    puts it inside a toolbar row; otherwise it is a slim row of its own.
 *    `ref` lands on the strip itself, which is `w-max`, so a caller can
 *    measure whether it fits.
 *
 * The home page can't be deleted from here: the backend would happily delete
 * it and leave the site without an entry point.
 */
export function PageTabs({
  pages,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
  inline = false,
  variant = "tabs",
  ref,
}: {
  pages: WebsitePage[];
  selectedId: string | null;
  onSelect: (pageId: string) => void;
  onDelete: (page: WebsitePage) => void;
  onAdd: () => void;
  inline?: boolean;
  variant?: "tabs" | "list";
  ref?: Ref<HTMLDivElement>;
}) {
  const t = useT(STRINGS);

  if (variant === "list") {
    return (
      <div ref={ref} data-slot="editor-pages" className="flex flex-col gap-1.5">
        <ul aria-label={t.pages} className="flex flex-col gap-0.5">
          {pages.map((page) => {
            const active = page.id === selectedId;
            const home = page.pageType === "home";
            const PageIcon = home ? IconHome : IconPage;
            return (
              <li
                key={page.id}
                data-active={active || undefined}
                className={cn(
                  "flex items-center rounded-[0.875rem] transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                  active ? "bg-primary-soft" : "hover:bg-paper-sunken"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(page.id)}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[0.875rem] px-2 py-1.5 text-start focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      active ? "bg-primary text-primary-foreground" : "bg-paper-sunken text-ink-soft"
                    )}
                  >
                    <PageIcon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{page.title}</span>
                      {home && (
                        <span className="shrink-0 rounded-full bg-paper-sunken px-1.5 py-px text-[11px] font-medium text-ink-soft">
                          {t.homeBadge}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      <bdi dir="ltr">{page.path}</bdi>
                    </span>
                  </span>
                  {active && <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />}
                </button>
                {!home && (
                  <button
                    type="button"
                    onClick={() => onDelete(page)}
                    aria-label={fmt(t.deletePage, { name: page.title })}
                    title={fmt(t.deletePage, { name: page.title })}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-danger focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    <IconDelete className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[0.875rem] border border-dashed border-line px-2 text-sm font-medium text-ink transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:border-primary hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none dark:hover:text-primary"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-sunken text-ink-soft">
            <IconPlus className="size-4" aria-hidden />
          </span>
          {t.newPage}
        </button>
      </div>
    );
  }

  return (
    <div className={inline ? "min-w-0" : "px-3 pb-1.5"}>
      <div ref={ref} className="flex w-max max-w-full items-center gap-2 overflow-x-auto">
        <ul aria-label={t.pages} className="flex min-w-0 items-center gap-1">
          {pages.map((page) => {
            const active = page.id === selectedId;
            // The home page is the site's entry point — deleting it would orphan
            // the site, so its delete button stays disabled.
            const home = page.pageType === "home";
            const deleteLabel = home ? t.homeHint : fmt(t.deletePage, { name: page.title });
            return (
              <li key={page.id} className="shrink-0">
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-full border ps-3 pe-1 transition-colors motion-reduce:transition-none",
                    active ? "border-primary bg-primary-soft" : "border-transparent hover:border-line hover:bg-paper"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(page.id)}
                    aria-current={active ? "page" : undefined}
                    title={page.path}
                    className="flex min-h-9 cursor-pointer items-center gap-1.5 text-sm focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11"
                  >
                    {home && <IconHome className="size-3.5 shrink-0 text-ink-soft" aria-hidden />}
                    <span
                      className={cn(
                        "max-w-40 truncate",
                        active ? "font-medium text-primary-dark dark:text-primary" : "text-ink"
                      )}
                    >
                      {page.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(page)}
                    disabled={home}
                    title={deleteLabel}
                    aria-label={deleteLabel}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-ink-soft transition-colors focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:size-11",
                      home ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-danger hover:text-paper-raised"
                    )}
                  >
                    <IconClose className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onAdd}
          className="ms-1 flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:min-h-11"
        >
          <IconPlus className="size-3.5" aria-hidden />
          {t.newPage}
        </button>
      </div>
    </div>
  );
}
