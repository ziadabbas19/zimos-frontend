import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretRight } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";

export interface OfferTool {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
  /** The tool's own numbers for the period, when it has any. */
  stat?: string;
  /** What the page already knows about the tool's state («٣ شغّالين»). */
  state?: string;
}

// Every tool's glyph is drawn in two tones on its tile, without touching the callers.
/**
 * One tool of the offers hub: a link to the tool's own screen.
 *
 * On a phone it is a compact 72px row — the tile, the name, ONE line (the
 * tool's numbers when it has any, otherwise what it does) and a caret. From sm
 * up it is a card: the name, two lines of what it does, and its numbers.
 *
 * Material (the pane, the lift under the pointer, the tile's soft brand
 * gradient) is in glass/offers.css; without the glass layer it is a solid
 * raised card with a hairline.
 */
export function OfferToolCard({ tool }: { tool: OfferTool }) {
  return (
    <ViewLink
      to={tool.to}
      data-slot="offer-tool"
      className={cn(
        "zimos-offer-tool group flex h-full min-h-[72px] items-center gap-3 rounded-[1.25rem] bg-paper-raised px-3.5 py-3 text-ink shadow-[var(--shadow-card)] ring-1 ring-line sm:items-start sm:gap-4 sm:rounded-[1.5rem] sm:p-5",
        "transition-[translate,scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100",
        "pointer-fine:hover:-translate-y-0.5 motion-reduce:pointer-fine:hover:translate-y-0"
      )}
    >
      <span
        data-slot="offer-tile"
        className="zimos-offer-tile flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-primary-soft text-primary sm:size-12 sm:rounded-2xl [&>svg]:size-6"
      >
        {tool.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[15px] leading-[1.375rem] font-semibold text-ink">{tool.title}</span>
          {tool.state && (
            <span className="zimos-offer-state inline-flex h-5 shrink-0 items-center rounded-full bg-success-soft px-2 text-[11px] leading-none font-semibold whitespace-nowrap text-success tabular-nums">
              {tool.state}
            </span>
          )}
        </span>
        <span className={cn("mt-0.5 line-clamp-1 text-[13px] leading-5 text-ink-soft sm:line-clamp-2", tool.stat && "max-sm:hidden")}>
          {tool.hint}
        </span>
        {tool.stat && (
          <span className="zimos-offer-stat mt-0.5 block truncate text-[13px] leading-5 font-medium text-primary tabular-nums sm:mt-1.5">
            {tool.stat}
          </span>
        )}
      </span>
      <IconCaretRight
        className="size-4 shrink-0 text-ink-soft sm:mt-1 rtl:-scale-x-100"
        aria-hidden
      />
    </ViewLink>
  );
}
