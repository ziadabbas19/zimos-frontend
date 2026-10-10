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
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconMoreActions } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";

// A menu line: 36px under a mouse, 44px under a thumb (the list kit's measure).
const ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11";

/**
 * «…» at the end of a section's row: what can be done to that section, one
 * press away — the same list a right-click (or a long press) on the row gives
 * (components/ContextMenu.tsx), so a thumb never needs the long press. Base
 * UI's Menu underneath: arrow keys, Enter, Escape and type-to-find; focus goes
 * back to the button when it closes.
 */
export function RowMenu({
  items,
  label,
  onBrand = false,
  className,
}: {
  items: readonly ContextMenuItem[];
  /** What the menu is for, said by a screen reader and shown as the button's tooltip. */
  label: string;
  /** The row is the selected one: the button is drawn in the row's own text colour. */
  onBrand?: boolean;
  className?: string;
}) {
  const { dir } = useLocale();
  if (items.length === 0) return null;

  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              title={label}
              data-slot="section-row-menu"
              className={cn(
                "zimos-row-menu relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none",
                "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:-outline-offset-4 active:scale-[0.97] motion-reduce:active:scale-100",
                onBrand
                  ? "text-current hover:bg-current/15 focus-visible:outline-current aria-expanded:bg-current/15"
                  : "text-ink-soft hover:bg-ink/8 hover:text-ink focus-visible:outline-primary aria-expanded:bg-ink/8 aria-expanded:text-ink",
                className
              )}
            />
          }
        >
          <IconMoreActions className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={4}
          className="w-auto max-w-[min(20rem,calc(100vw_-_1.5rem))] min-w-52 rounded-[1.125rem] p-1.5"
        >
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled) item.onSelect();
                  }}
                  className={ITEM}
                >
                  {ItemIcon && <ItemIcon className="size-[18px]" aria-hidden />}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}
