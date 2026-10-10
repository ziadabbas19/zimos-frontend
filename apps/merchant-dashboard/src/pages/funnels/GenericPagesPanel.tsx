import { useId, useState } from "react";
import { IconCaretDown, IconCopy, IconDelete, IconDocument, IconDraft, IconMoreActions, IconPlus } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@store-builder/ui";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import type { UiFunnel, UiStep } from "./funnelAdapter";
import { genericPagePath, isGenericStep, type GenericPreset } from "./genericPageRules";
import { PANE_STRINGS } from "./panes/paneStrings";

/**
 * The funnel's generic pages (genericPageRules.ts) — contact, about, policies:
 * pages off the map, each at its own address. A second group under the steps
 * list, folded while there are none: add from a preset, open, copy the link,
 * delete.
 */

const PRESETS: GenericPreset[] = ["contact", "about", "policies", "blank"];

export function GenericPagesPanel({
  funnel,
  selectedKey,
  onAdd,
  onOpen,
  onDelete,
}: {
  funnel: UiFunnel;
  selectedKey: string | null;
  onAdd: (preset: GenericPreset, name: string, body: string) => void;
  onOpen: (key: string) => void;
  onDelete: (step: UiStep) => void;
}) {
  const t = useT(PANE_STRINGS);
  const toast = useToast();
  const listId = useId();
  const pages = funnel.steps.filter((s) => isGenericStep(s, funnel.edges));
  // Folded while empty, open once there is a page; a press on the heading overrides either.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? pages.length > 0;

  async function copy(step: UiStep) {
    const path = genericPagePath(funnel, step.key);
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // Clipboard blocked: the toast still shows the link to copy by hand.
    }
    toast.success(fmt(t.copied, { path }));
  }

  return (
    <section data-slot="funnel-generic-pages" className="zimos-funnel-group border-t border-line px-2 pt-1 pb-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOverride(!open)}
          aria-expanded={open}
          aria-controls={listId}
          title={open ? t.pagesHide : t.pagesShow}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[0.75rem] px-2 text-start text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <IconCaretDown
            className={cn(
              "size-3.5 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              !open && "-rotate-90 rtl:rotate-90"
            )}
            aria-hidden
          />
          <span className="truncate">{t.pagesTitle}</span>
          <bdi className="zimos-funnel-count inline-flex min-w-6 items-center justify-center rounded-full bg-paper-sunken px-1.5 py-0.5 text-xs font-medium text-ink-soft tabular-nums">
            {fmt("{n}", { n: pages.length })}
          </bdi>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t.pagesAdd}
                title={t.pagesAdd}
                className="zimos-funnel-icon-button flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              />
            }
          >
            <IconPlus className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            {PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset}
                className="min-h-11 gap-2.5"
                onClick={() => {
                  setOverride(true);
                  onAdd(preset, t[preset], t[`${preset}Body` as const]);
                }}
              >
                <IconDocument className="size-4" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm leading-5">{t[preset]}</span>
                  <span className="block text-xs leading-4 text-ink-soft">{t[`${preset}Why` as const]}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div id={listId} hidden={!open}>
        <p className="px-2 pb-2 text-xs leading-5 text-ink-soft">{t.pagesHint}</p>
        {pages.length === 0 ? (
          <p className="px-2 pb-1 text-xs text-ink-soft">{t.pagesEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {pages.map((step) => {
              const selected = step.key === selectedKey;
              return (
                <li
                  key={step.key}
                  data-slot="funnel-step-row"
                  data-selected={selected ? "" : undefined}
                  className={cn(
                    "zimos-funnel-step-row flex min-h-[52px] items-center rounded-[0.875rem] ps-2 text-ink",
                    selected ? "bg-primary-soft ring-1 ring-primary/40" : "hover:bg-paper-sunken"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(step.key)}
                    aria-current={selected ? "true" : undefined}
                    className="flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[0.75rem] py-1.5 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <span data-slot="funnel-type-tile" className="grid size-8 shrink-0 place-items-center rounded-[0.625rem] bg-paper-sunken text-ink-soft">
                      <IconDocument className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-5 font-medium" dir="auto">
                        {step.name}
                      </span>
                      <span className="zimos-funnel-row-quiet block truncate text-xs leading-4 text-ink-soft">
                        {step.id ? <bdi dir="ltr">{genericPagePath(funnel, step.key)}</bdi> : t.unsaved}
                      </span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          aria-label={fmt(t.pageMenu, { name: step.name })}
                          className="zimos-funnel-row-quiet flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                        />
                      }
                    >
                      <IconMoreActions className="size-5" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                      <DropdownMenuItem className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={() => onOpen(step.key)}>
                        <IconDraft className="size-4" aria-hidden />
                        {t.openPage}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={() => void copy(step)}>
                        <IconCopy className="size-4" aria-hidden />
                        {t.copyLink}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" className="min-h-9 gap-2.5 pointer-coarse:min-h-11" onClick={() => onDelete(step)}>
                        <IconDelete className="size-4" aria-hidden />
                        {t.remove}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
